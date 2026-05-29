```ts
@Injectable()
export class TaxTypesService {
  constructor(
    // TaxType es el tipo de impuesto (ej: IVA, IIBB, Sellos).
    // Este servicio solo necesita su propio repositorio — no depende de otras entidades.
    @InjectRepository(TaxTypeEntity)
    private taxTypeRepository: Repository<TaxTypeEntity>,

    // Invalida la caché cuando se modifica un tipo de impuesto.
    // Aunque los TaxTypes son entidades administrativas, su nombre y código
    // pueden aparecer en la respuesta del shop vía los taxes asociados.
    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ─── FIND ALL (paginado) ──────────────────────────────────────────────────────

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<TaxTypeResponseDto>> {
    const [entities, total] = await this.taxTypeRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      // TypeORM agrega WHERE deletedAt IS NULL automáticamente por el @DeleteDateColumn.
    });
    return new PaginatedResponseDto(
      // Patrón de factory estática: TaxTypeResponseDto.fromEntity(entity) en vez
      // de new TaxTypeResponseDto(entity). Ambos son válidos; fromEntity es más
      // expresivo cuando el DTO tiene lógica de mapeo compleja.
      entities.map(TaxTypeResponseDto.fromEntity),
      total,
      page,
      limit,
    );
  }

  // ─── FIND BY ID ──────────────────────────────────────────────────────────────

  async findById(id: number): Promise<TaxTypeResponseDto> {
    const entity = await this.findEntity(id);
    return TaxTypeResponseDto.fromEntity(entity);
  }

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(dto: CreateTaxTypeDto): Promise<TaxTypeResponseDto> {
    // Valida unicidad del código antes de intentar el INSERT. Un código duplicado
    // rompería la constraint UNIQUE de la DB y daría un error 500 genérico.
    // Esta validación adelanta eso con un mensaje claro y un HTTP 400.
    // (Nota: usa BadRequestException en vez de ConflictException — otra elección
    // de diseño válida; semánticamente 409 sería más preciso para un duplicado.)
    await this.ensureCodeIsUnique(dto.code);

    const newEntity = this.taxTypeRepository.create(dto);
    const saved = await this.taxTypeRepository.save(newEntity);
    void this.shopCacheService.invalidate();
    return TaxTypeResponseDto.fromEntity(saved);
    // A diferencia de TaxesService.create(), aquí NO se re-fetchea la entidad
    // después del save(). Se usa "saved" directamente porque TaxType no tiene
    // relaciones que cargar para construir el DTO de respuesta.
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  async update(
    id: number,
    changes: UpdateTaxTypeDto,
  ): Promise<TaxTypeResponseDto> {
    const entity = await this.findEntity(id);

    // Valida unicidad del code solo si el DTO trae un code diferente al actual.
    // Si se manda el mismo code que ya tiene, no hay necesidad de validar
    // (el registro existente sería el propio, no un duplicado).
    if (changes.code && changes.code !== entity.code) {
      await this.ensureCodeIsUnique(changes.code);
    }

    const merged = this.taxTypeRepository.merge(entity, changes);
    const saved = await this.taxTypeRepository.save(merged);
    void this.shopCacheService.invalidate();
    return TaxTypeResponseDto.fromEntity(saved);
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  async delete(id: number): Promise<void> {
    const entity = await this.findEntity(id);
    // Soft delete: setea deletedAt en la fila. TypeORM excluye este registro
    // de todos los find* futuros automáticamente.
    await this.taxTypeRepository.softDelete(entity.id);
    void this.shopCacheService.invalidate();
  }

  // ─── PRIVATE ─────────────────────────────────────────────────────────────────

  private async findEntity(id: number): Promise<TaxTypeEntity> {
    const entity = await this.taxTypeRepository.findOne({
      where: { id },
      // Sin relations: TaxType no tiene relaciones que sean necesarias para
      // construir su DTO de respuesta.
    });

    if (!entity) {
      throw new NotFoundException(`Tipo de impuesto con id ${id} no encontrado`);
    }

    return entity;
  }

  // Valida que no exista otro TaxType con el mismo código.
  // El "code" es el identificador semántico del tipo (ej: "IVA", "IIBB").
  private async ensureCodeIsUnique(code: string): Promise<void> {
    const existing = await this.taxTypeRepository.findOne({
      where: { code },
    });

    if (existing) {
      throw new BadRequestException(
        `Ya existe un tipo de impuesto con el código "${code}"`,
      );
    }
  }
}
```
