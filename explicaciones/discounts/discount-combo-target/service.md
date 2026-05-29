```ts
@Injectable()
export class DiscountComboTargetService {
  constructor(
    @InjectRepository(DiscountComboTargetEntity)
    private readonly repo: Repository<DiscountComboTargetEntity>,

    // Se inyecta el repositorio del descuento padre para validar su existencia
    // antes de cualquier operación, igual que en DiscountProductTargetService.
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,

    // Invalida la caché cuando se asigna o quita un combo de un descuento,
    // porque eso cambia qué precio ve el cliente en el shop.
    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(
    discountId: number,
    dto: CreateDiscountComboTargetDto,
  ): Promise<DiscountComboTargetResponseDto> {

    // Secuencia de validaciones en orden de falla-rápida:
    // 1. ¿Existe el descuento padre? → 404 si no.
    await this.findDiscount(discountId);

    // 2. ¿Este combo ya está asignado a ESTE descuento? → 409 si sí.
    await this.validateUniqueTarget(discountId, dto.comboId);

    // 3. ¿Este combo ya tiene ALGÚN descuento activo en el sistema? → 409 si sí.
    //    Misma regla de negocio que en DiscountProductTargetService:
    //    un combo no puede tener más de un descuento activo a la vez,
    //    para evitar solapamientos en el motor de cálculo de precios.
    await this.validateComboHasNoActiveDiscount(dto.comboId);

    const entity = this.repo.create({
      discountId,
      comboId: dto.comboId,
    });

    const saved = await this.repo.save(entity);
    void this.shopCacheService.invalidate();
    return new DiscountComboTargetResponseDto(saved);
  }

  // ─── GET ALL BY DISCOUNT ─────────────────────────────────────────────────────

  async findAll(discountId: number): Promise<DiscountComboTargetResponseDto[]> {
    // Verifica que el discount padre exista antes de listar.
    // Devuelve 404 si fue borrado, en vez de una lista vacía que podría confundir.
    await this.findDiscount(discountId);

    const targets = await this.repo.find({
      where: { discountId },
    });

    return targets.map((t) => new DiscountComboTargetResponseDto(t));
  }

  // ─── DELETE (soft) ───────────────────────────────────────────────────────────

  async remove(discountId: number, comboId: number): Promise<void> {
    await this.findDiscount(discountId);

    // Búsqueda por (discountId, comboId) — no por el id interno del registro.
    // La semántica es "quitar este combo de este descuento", igual que en product-target.
    const entity = await this.repo.findOne({
      where: { discountId, comboId },
    });

    if (!entity) {
      throw new NotFoundException(
        `El combo ${comboId} no está asignado al descuento ${discountId}`,
      );
    }

    await this.repo.softDelete(entity.id);
    void this.shopCacheService.invalidate();
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
    comboId: number,
  ): Promise<void> {
    // Unicidad dentro del mismo descuento: este combo ya está en este descuento.
    const existing = await this.repo.findOne({
      where: { discountId, comboId },
    });

    if (existing) {
      throw new ConflictException(
        `El combo ${comboId} ya es un target del descuento ${discountId}`,
      );
    }
  }

  private async validateComboHasNoActiveDiscount(
    comboId: number,
  ): Promise<void> {
    // Unicidad global: busca solo por comboId sin importar el discountId.
    // Garantiza que un combo tenga como máximo un descuento activo en todo el sistema.
    const existing = await this.repo.findOne({
      where: { comboId },
    });

    if (existing) {
      throw new ConflictException(
        `El combo ${comboId} ya tiene un descuento activo asignado`,
      );
    }
  }
}
```
