```ts
@Injectable()
export class ProductTaxesService {
  constructor(
    // Repositorio de la tabla "product_taxes": la tabla de unión entre productos y taxes.
    @InjectRepository(ProductTaxEntity)
    private readonly productTaxRepository: Repository<ProductTaxEntity>,

    // Se inyecta el repositorio de Tax (no de Product) para validar que el tax
    // exista y que sea de tipo no-global antes de asignarlo al producto.
    // No se inyecta el repositorio de Product porque no se valida que el producto
    // exista aquí — esa responsabilidad queda en la capa de base de datos (FK).
    @InjectRepository(TaxEntity)
    private readonly taxRepository: Repository<TaxEntity>,

    // Invalida la caché cuando cambia la asignación de impuestos a un producto,
    // porque afecta directamente el precio final visible en el shop.
    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(
    // La firma combina CreateProductTaxDto (los datos del body) con productId
    // (que viene del URL). El controller hace el merge antes de llamar a este método.
    dto: CreateProductTaxDto & { productId: number },
  ): Promise<ProductTaxResponseDto> {

    // Verifica que el tax exista. Sin esta validación, se podría crear un
    // product_tax con un taxId inválido y solo fallaría con error de FK en la DB.
    const tax = await this.taxRepository.findOne({
      where: { id: dto.taxId },
    });

    if (!tax) {
      throw new NotFoundException(`Impuesto con id ${dto.taxId} no encontrado`);
    }

    // Regla de negocio clave: los impuestos globales (isGlobal: true) se aplican
    // automáticamente a todos los productos por el motor de cálculo de precios.
    // Asignarlos manualmente a un producto específico sería redundante y confuso.
    if (tax.isGlobal) {
      throw new BadRequestException(
        'Un impuesto global no puede asignarse a un producto específico',
      );
    }

    // Solo se guardan productId y taxId. No hay campos adicionales en esta
    // tabla de unión más allá de los que hereda de BaseEntity (id, timestamps).
    const productTax = this.productTaxRepository.create({
      productId: dto.productId,
      taxId: dto.taxId,
    });

    const saved = await this.productTaxRepository.save(productTax);
    void this.shopCacheService.invalidate();
    // A diferencia de TaxesService.create(), aquí se usa "saved" directamente
    // sin re-fetchear, porque ProductTaxEntity no tiene relaciones que necesiten
    // cargarse para construir el DTO de respuesta.
    return new ProductTaxResponseDto(saved);
  }

  // ─── GET ALL BY PRODUCT ──────────────────────────────────────────────────────

  async findAll(
    productId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<ProductTaxResponseDto>> {
    const [productTaxes, total] = await this.productTaxRepository.findAndCount({
      where: { productId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      productTaxes.map((pt) => new ProductTaxResponseDto(pt)),
      total,
      page,
      limit,
    );
  }

  // ─── GET BY ID ───────────────────────────────────────────────────────────────

  async findOne(id: number): Promise<ProductTaxResponseDto> {
    // El wrapping en una sola línea funciona porque findEntity lanza
    // NotFoundException si no existe, por lo que el await no puede retornar null.
    return new ProductTaxResponseDto(await this.findEntity(id));
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  async update(
    id: number,
    dto: UpdateProductTaxDto,
  ): Promise<ProductTaxResponseDto> {
    const productTax = await this.findEntity(id);
    const merged = this.productTaxRepository.merge(productTax, dto);
    const updated = await this.productTaxRepository.save(merged);
    void this.shopCacheService.invalidate();
    return new ProductTaxResponseDto(updated);
    // Nótese que update() NO re-valida las reglas de negocio (isGlobal, etc.).
    // UpdateProductTaxDto hereda de PartialType(CreateProductTaxDto), pero en
    // la práctica esta tabla de unión tiene muy pocos campos cambiables.
  }

  // ─── SOFT DELETE ─────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const productTax = await this.findEntity(id);
    // Soft delete: no borra la fila, solo setea deletedAt. El tax sigue
    // registrado históricamente pero deja de afectar el cálculo de precios.
    await this.productTaxRepository.softDelete(productTax.id);
    void this.shopCacheService.invalidate();
  }

  // ─── PRIVATE ─────────────────────────────────────────────────────────────────

  private async findEntity(id: number): Promise<ProductTaxEntity> {
    const entity = await this.productTaxRepository.findOne({ where: { id } });
    if (!entity)
      throw new NotFoundException(`Impuesto de producto con id ${id} no encontrado`);
    return entity;
  }
}
```
