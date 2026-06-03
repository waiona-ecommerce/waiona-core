```ts
@Injectable()
export class TaxesService {
  constructor(
    // Repositorio principal: tabla "taxes". Se usa para todas las operaciones CRUD.
    @InjectRepository(TaxEntity)
    private taxRepository: Repository<TaxEntity>,

    // Se inyecta el repositorio de TaxType para validar que el tipo de impuesto
    // padre exista antes de crear un tax. Sin esto, se podría crear un tax huérfano
    // con un taxTypeId inválido.
    @InjectRepository(TaxTypeEntity)
    private taxTypeRepository: Repository<TaxTypeEntity>,

    // Invalida la caché del shop cuando cambia un impuesto, porque los impuestos
    // afectan directamente el precio final que ve el cliente.
    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ─── FIND ALL BY TAX TYPE ────────────────────────────────────────────────────

  async findAll(
    taxTypeId: number,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<TaxResponseDto>> {
    // findAndCount en una sola query: devuelve [entidades, total].
    // El total es necesario para construir el PaginatedResponseDto.
    const [entities, total] = await this.taxRepository.findAndCount({
      where: { taxTypeId },
      relations: ['taxType'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      entities.map((entity) => new TaxResponseDto(entity)),
      total,
      page,
      limit,
    );
  }

  // ─── FIND BY ID ──────────────────────────────────────────────────────────────

  async findById(id: number): Promise<TaxResponseDto> {
    const entity = await this.findEntity(id);
    return new TaxResponseDto(entity);
  }

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(taxTypeId: number, dto: CreateTaxDto): Promise<TaxResponseDto> {
    // Verifica que el taxType padre exista. Si no existe, lanza 404 antes
    // de intentar insertar el tax. Esto complementa la FK de la DB con un mensaje
    // claro y predecible.
    const taxType = await this.taxTypeRepository.findOne({
      where: { id: taxTypeId },
    });

    if (!taxType) {
      throw new NotFoundException(
        `Tipo de impuesto con id ${taxTypeId} no encontrado`,
      );
    }

    // Todos los impuestos son porcentuales (0.01% – 100%).
    // El rango se valida en el DTO con @Min(0.01) y @Max(100).
    // No hay campo isPercentage ni currency: el motor de cálculo asume porcentaje siempre.
    const newEntity = this.taxRepository.create({
      taxTypeId,
      value: dto.value,
      isGlobal: dto.isGlobal ?? false, // ?? false: si no viene en el DTO, es false por defecto.
    });

    const saved = await this.taxRepository.save(newEntity);
    void this.shopCacheService.invalidate(); // Fire-and-forget: no bloquea la respuesta.

    // Se vuelve a llamar findEntity en vez de usar "saved" directamente,
    // porque .save() no carga las relaciones. findEntity hace el findOne con
    // relations: ['taxType'], necesario para construir el TaxResponseDto completo.
    return new TaxResponseDto(await this.findEntity(saved.id));
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  async update(id: number, changes: UpdateTaxDto): Promise<TaxResponseDto> {
    const entity = await this.findEntity(id);

    // .merge() aplica el DTO parcial sobre la entidad sin perder los campos
    // que el cliente no mandó en este PATCH.
    const merged = this.taxRepository.merge(entity, changes);
    const saved = await this.taxRepository.save(merged);
    void this.shopCacheService.invalidate();

    // Igual que en create: se re-fetchea para que el DTO de respuesta
    // tenga la relación taxType cargada.
    return new TaxResponseDto(await this.findEntity(saved.id));
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  async delete(id: number): Promise<void> {
    const entity = await this.findEntity(id);
    // Soft delete: setea deletedAt = NOW(). El registro sigue en la DB pero
    // TypeORM lo excluye automáticamente de todos los find* futuros.
    await this.taxRepository.softDelete(entity.id);
    void this.shopCacheService.invalidate();
  }

  // ─── PRIVATE ─────────────────────────────────────────────────────────────────

  private async findEntity(id: number): Promise<TaxEntity> {
    // Carga la relación taxType en cada búsqueda porque el TaxResponseDto
    // necesita exponer los datos del tipo de impuesto (nombre, código), no solo el ID.
    const entity = await this.taxRepository.findOne({
      where: { id },
      relations: ['taxType'],
    });

    if (!entity) throw new NotFoundException(`Impuesto con id ${id} no encontrado`);
    return entity;
  }
}
```
