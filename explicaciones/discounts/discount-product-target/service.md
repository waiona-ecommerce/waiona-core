```ts
@Injectable()
export class DiscountProductTargetService {
  constructor(
    // Repositorio de la tabla de unión "discount_product_targets".
    // Nombre corto "repo" en vez de "discountProductTargetRepository": válido
    // cuando hay un solo repositorio principal y el contexto es claro.
    @InjectRepository(DiscountProductTargetEntity)
    private readonly repo: Repository<DiscountProductTargetEntity>,

    // Se inyecta el repositorio del descuento padre para validar que exista
    // antes de operar. Sin esto, se podría asignar un producto a un descuento
    // que no existe o fue borrado con soft delete.
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,

    // Invalida la caché cuando se asigna o quita un producto de un descuento,
    // porque eso cambia qué precio ve el cliente en el shop.
    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(
    discountId: number,
    dto: CreateDiscountProductTargetDto,
  ): Promise<DiscountProductTargetResponseDto> {

    // 1. Valida que el descuento padre exista (404 si no).
    await this.findDiscount(discountId);

    // 2. Valida que esta combinación exacta (discountId + productId) no exista ya.
    //    Evita asignar el mismo producto dos veces al mismo descuento.
    await this.validateUniqueTarget(discountId, dto.productId);

    // 3. Valida que el producto no tenga YA un descuento activo de CUALQUIER otro descuento.
    //    Esta es una regla de negocio más amplia que la anterior: un producto
    //    solo puede estar en un descuento a la vez (en toda la tabla, no solo en este discountId).
    //    Esto evita descuentos solapados que confundirían al motor de cálculo de precios.
    await this.validateProductHasNoActiveDiscount(dto.productId);

    const entity = this.repo.create({
      discountId,
      productId: dto.productId,
    });

    const saved = await this.repo.save(entity);
    void this.shopCacheService.invalidate();
    return new DiscountProductTargetResponseDto(saved);
  }

  // ─── GET ALL BY DISCOUNT ─────────────────────────────────────────────────────

  async findAll(
    discountId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<DiscountProductTargetResponseDto>> {
    // Se verifica que el discount padre exista antes de listar.
    // Si el discount fue borrado, devolver una lista vacía podría ser confuso;
    // mejor fallar con 404 para que el cliente sepa que el recurso padre no existe.
    await this.findDiscount(discountId);

    const [targets, total] = await this.repo.findAndCount({
      where: { discountId },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      targets.map((t) => new DiscountProductTargetResponseDto(t)),
      total,
      page,
      limit,
    );
  }

  // ─── DELETE (soft) ───────────────────────────────────────────────────────────

  async remove(discountId: number, productId: number): Promise<void> {
    await this.findDiscount(discountId);

    // La búsqueda es por (discountId, productId), no por el id interno del registro.
    // La semántica del delete es "quitar este producto de este descuento",
    // no "borrar el registro con id X". Por eso el controller recibe productId en la URL.
    const entity = await this.repo.findOne({
      where: { discountId, productId },
    });

    if (!entity) {
      throw new NotFoundException(
        `El producto ${productId} no está asignado al descuento ${discountId}`,
      );
    }

    await this.repo.softDelete(entity.id);
    void this.shopCacheService.invalidate();
    // No hay PATCH/update: las asignaciones de target son atómicas.
    // Se crean o se borran; no hay "actualizar qué producto tiene un descuento".
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private async findDiscount(discountId: number): Promise<DiscountEntity> {
    const discount = await this.discountRepository.findOne({
      where: { id: discountId },
    });

    if (!discount) {
      throw new NotFoundException(`Descuento con id ${discountId} no encontrado`);
    }

    return discount;
  }

  private async validateUniqueTarget(
    discountId: number,
    productId: number,
  ): Promise<void> {
    // Unicidad dentro del mismo descuento: este producto ya está asignado a este descuento.
    // withDeleted: true + deletedAt: IsNull() para buscar solo targets activos,
    // de modo que un target previamente borrado no bloquee una reasignación.
    const existing = await this.repo.findOne({
      where: { discountId, productId, deletedAt: IsNull() },
      withDeleted: true,
    });

    if (existing) {
      throw new ConflictException(
        `El producto ${productId} ya es un target del descuento ${discountId}`,
      );
    }
  }

  private async validateProductHasNoActiveDiscount(
    productId: number,
  ): Promise<void> {
    // Unicidad global: este producto ya está asignado a ALGÚN descuento (de cualquiera).
    // Usa QueryBuilder con innerJoin para verificar que tanto el target como
    // el descuento padre estén activos (no borrados).
    // Garantiza que un producto tenga como máximo un descuento activo en todo el sistema.
    const existing = await this.repo
      .createQueryBuilder('target')
      .innerJoin('target.discount', 'discount')
      .where('target.productId = :productId', { productId })
      .andWhere('target.deletedAt IS NULL')
      .andWhere('discount.deletedAt IS NULL')
      .getOne();

    if (existing) {
      throw new ConflictException(
        `El producto ${productId} ya tiene un descuento activo asignado`,
      );
    }
  }
}
```
