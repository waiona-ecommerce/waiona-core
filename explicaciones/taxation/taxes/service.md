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

  async findAll(taxTypeId: number): Promise<TaxResponseDto[]> {
    // Filtra los taxes por taxTypeId (que viene del segmento de URL :taxTypeId).
    // Carga la relación "taxType" para que el DTO de respuesta pueda incluir
    // el nombre y código del tipo de impuesto, no solo su ID.
    const entities = await this.taxRepository.find({
      where: { taxTypeId },
      relations: ['taxType'],
      order: { createdAt: 'DESC' },
    });

    // No hay paginación aquí: se devuelve la lista completa de taxes de ese taxType.
    // La cantidad de impuestos por tipo se espera que sea pequeña, por eso no se pagina.
    return entities.map((entity) => new TaxResponseDto(entity));
  }

  // ─── FIND BY ID ──────────────────────────────────────────────────────────────

  async findById(id: number): Promise<TaxResponseDto> {
    const entity = await this.findEntity(id);
    return new TaxResponseDto(entity);
  }

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(taxTypeId: number, dto: CreateTaxDto): Promise<TaxResponseDto> {
    // Verifica que el taxType padre exista. Si no existe, falla con 400 antes
    // de intentar insertar el tax. Esto complementa la FK de la DB con un mensaje
    // claro y predecible.
    const taxType = await this.taxTypeRepository.findOne({
      where: { id: taxTypeId },
    });

    if (!taxType) {
      throw new BadRequestException(
        `Tipo de impuesto con id ${taxTypeId} no encontrado`,
      );
    }

    // Regla de negocio: isPercentage y currency son mutuamente excluyentes.
    // Un impuesto de tipo porcentaje (ej: IVA 21%) no tiene sentido que lleve moneda.
    // Un impuesto de monto fijo (ej: tasa fija de $10 ARS) sí requiere moneda.
    if (!dto.isPercentage && !dto.currency) {
      throw new BadRequestException(
        'Los impuestos de monto fijo requieren una moneda',
      );
    }

    if (dto.isPercentage && dto.currency) {
      throw new BadRequestException(
        'Los impuestos porcentuales no deben tener moneda',
      );
    }

    // Validación del rango del valor según su tipo.
    // No puede vivir solo en el DTO porque depende de isPercentage (otro campo).
    this.validateTaxValue(dto.value, dto.isPercentage);

    // Se construye manualmente el objeto a crear en lugar de hacer create(dto)
    // directamente, porque taxTypeId viene del URL (no del body del DTO) y
    // isGlobal tiene un default de false si no se manda.
    const newEntity = this.taxRepository.create({
      taxTypeId,
      value: dto.value,
      isPercentage: dto.isPercentage,
      currency: dto.currency,
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

    // Se resuelve el estado efectivo de isPercentage y currency combinando el
    // valor actual de la entidad con lo que manda el DTO (que es parcial).
    // Si el DTO no trae isPercentage, se usa el que ya tiene la entidad.
    const isPercentage = changes.isPercentage ?? entity.isPercentage;

    // currency puede ser null/undefined intencionalmente, por eso se usa !== undefined
    // en lugar de ?? — si el DTO manda currency: null explícitamente (para borrarla),
    // hay que respetar ese null y no fallback al valor actual.
    const currency =
      changes.currency !== undefined ? changes.currency : entity.currency;

    // Se re-evalúa la regla de negocio sobre el estado efectivo final,
    // no sobre los valores parciales del DTO.
    if (!isPercentage && !currency) {
      throw new BadRequestException(
        'Los impuestos de monto fijo requieren una moneda',
      );
    }

    if (isPercentage && currency) {
      throw new BadRequestException(
        'Los impuestos porcentuales no deben tener moneda',
      );
    }

    // Ídem que en create: se valida el valor sobre el estado efectivo final.
    const value = changes.value !== undefined ? Number(changes.value) : Number(entity.value);
    this.validateTaxValue(value, isPercentage);

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

  // Validación del rango del valor según el tipo de impuesto.
  // Separada en un método privado porque se reutiliza en create() y update().
  // No puede vivir en el DTO porque depende del valor de isPercentage (otro campo).
  // Sincrónica porque no hace IO: solo evalúa números en memoria.
  private validateTaxValue(value: number, isPercentage: boolean): void {
    if (isPercentage && value > 100) {
      throw new BadRequestException(
        'El valor del impuesto no puede superar el 100%',
      );
    }
    if (!isPercentage && value > 1_000_000) {
      throw new BadRequestException(
        'El monto fijo del impuesto no puede superar 1.000.000',
      );
    }
  }
}
```
