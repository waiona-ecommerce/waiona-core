```ts
// @Injectable() le dice al sistema de inyección de dependencias de NestJS que esta
// clase puede ser instanciada y provista automáticamente a otros componentes.
// NestJS la crea una sola vez y la reutiliza (singleton por defecto).
@Injectable()
export class MarginsService {
  constructor(
    // @InjectRepository(MarginEntity) inyecta el repositorio de TypeORM para la
    // tabla "margins". Con él se hacen todas las operaciones CRUD sobre márgenes.
    @InjectRepository(MarginEntity)
    private readonly marginRepository: Repository<MarginEntity>,

    // Se inyectan también los repositorios de pricing de productos y combos.
    // No se usan para crear/editar márgenes, sino solo en remove() para verificar
    // si el margen está siendo usado antes de permitir borrarlo.
    @InjectRepository(ProductPricingEntity)
    private readonly productPricingRepository: Repository<ProductPricingEntity>,

    @InjectRepository(ComboPricingEntity)
    private readonly comboPricingRepository: Repository<ComboPricingEntity>,

    // ShopCacheService maneja la caché de Redis del shop. Cada vez que un margen
    // cambia (create/update/remove), hay que invalidar la caché para que el shop
    // no sirva precios desactualizados.
    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(dto: CreateMarginDto): Promise<MarginResponseDto> {
    // Antes de crear, verifica que no exista otro margen con el mismo nombre.
    // Si existe, lanza ConflictException (HTTP 409).
    await this.validateUniqueName(dto.name);

    // Los márgenes son siempre porcentuales. El límite superior (1000%) y el
    // inferior (0.01%) se validan en el DTO con @Min y @Max, no en el servicio.
    // No hay campo isPercentage: el motor de cálculo asume porcentaje siempre.
    const margin = this.marginRepository.create(dto);

    // .save() ejecuta el INSERT en la tabla "margins" y devuelve la entidad
    // ya persistida con id, createdAt y updatedAt populados por la DB.
    const saved = await this.marginRepository.save(margin);

    // void: se dispara la invalidación de caché pero NO se espera su resultado.
    // Es fire-and-forget intencional — si falla silenciosamente, no queremos
    // que eso rompa la respuesta al cliente.
    void this.shopCacheService.invalidate();

    // Nunca se devuelve la entidad cruda. Se mapea a un DTO de respuesta que
    // expone solo los campos públicos y protege contra filtrar datos internos.
    return new MarginResponseDto(saved);
  }

  // ─── GET ALL ─────────────────────────────────────────────────────────────────

  async findAll(
    page = 1,   // Valores por defecto por si se llama al servicio directamente
    limit = 20, // sin pasar por el controller (que siempre los pasa desde el DTO).
  ): Promise<PaginatedResponseDto<MarginResponseDto>> {

    // findAndCount hace una sola query que devuelve dos cosas en paralelo:
    // el array de resultados de la página actual y el total de registros (sin paginar).
    // Es más eficiente que hacer dos queries separadas (una para los datos, otra para el total).
    const [margins, total] = await this.marginRepository.findAndCount({
      order: { createdAt: 'DESC' }, // Los más recientes primero.
      skip: (page - 1) * limit,    // Offset SQL: si page=2 y limit=20, omite los primeros 20.
      take: limit,                  // Equivale al LIMIT de SQL.
      // TypeORM agrega automáticamente WHERE deletedAt IS NULL porque la entidad
      // tiene @DeleteDateColumn. Los registros con soft delete nunca aparecen aquí.
    });

    // PaginatedResponseDto es un wrapper genérico que encapsula el array de items,
    // el total, la página actual y el límite para que el front pueda calcular la paginación.
    return new PaginatedResponseDto(
      margins.map((margin) => new MarginResponseDto(margin)),
      total,
      page,
      limit,
    );
  }

  // ─── GET BY ID ───────────────────────────────────────────────────────────────

  async findOne(id: number): Promise<MarginResponseDto> {
    // Toda la lógica de búsqueda y "no encontrado" vive en el helper privado findEntity.
    // Esto evita duplicar ese bloque en update() y remove(), que también necesitan
    // buscar el registro antes de operar sobre él.
    const margin = await this.findEntity(id);
    return new MarginResponseDto(margin);
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  async update(id: number, dto: UpdateMarginDto): Promise<MarginResponseDto> {
    // Primero verifica que el margen exista. Si no, falla con 404 antes de hacer nada más.
    const margin = await this.findEntity(id);

    // Solo valida unicidad del nombre si el DTO trae un nombre nuevo Y ese nombre
    // es distinto al actual. Sin esta condición, un PATCH que mande el mismo nombre
    // que ya tiene el margen fallaría con 409 aunque no esté cambiando nada.
    if (dto.name && dto.name !== margin.name) {
      await this.validateUniqueName(dto.name);
    }

    // .merge() aplica los campos del DTO sobre la entidad existente sin perder los campos
    // que el DTO no mandó. Es el equivalente a Object.assign pero específico de TypeORM,
    // manteniendo los metadatos internos de la entidad.
    const merged = this.marginRepository.merge(margin, dto);

    // .save() sobre una entidad existente ejecuta un UPDATE en la DB.
    const updated = await this.marginRepository.save(merged);

    // Fire-and-forget, igual que en create().
    void this.shopCacheService.invalidate();
    return new MarginResponseDto(updated);
  }

  // ─── SOFT DELETE ─────────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const margin = await this.findEntity(id);

    // Se ejecutan las dos queries de verificación EN PARALELO con Promise.all,
    // no en secuencia. Esto reduce la latencia al tiempo de la query más lenta
    // en vez de sumar ambas.
    // Se busca si algún product_pricing o combo_pricing referencia este margen.
    const [productUsage, comboUsage] = await Promise.all([
      this.productPricingRepository.findOne({ where: { margin: { id } } }),
      this.comboPricingRepository.findOne({ where: { margin: { id } } }),
    ]);

    // Si el margen está en uso, se lanza ConflictException (409).
    // Borrar un margen en uso dejaría pricings con una FK inválida o huérfana.
    // Esta validación protege la consistencia de datos desde la capa de aplicación.
    if (productUsage || comboUsage) {
      throw new ConflictException(
        'El margen está en uso por uno o más pricings y no puede eliminarse',
      );
    }

    // softDelete NO borra el registro físicamente. TypeORM setea deletedAt = NOW()
    // en la fila. Todas las queries futuras ignorarán este registro automáticamente.
    // El dato sigue en la DB y puede auditarse o recuperarse si fuera necesario.
    await this.marginRepository.softDelete(margin.id);
    void this.shopCacheService.invalidate();
    // Retorna void → el controller responde HTTP 204 (No Content), sin body.
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  // Método privado: centraliza la búsqueda por ID y el lanzamiento de NotFoundException.
  // Al ser privado, es un detalle de implementación interna. Ningún módulo externo
  // puede llamarlo. Para leer un margen desde afuera se usa findOne() (que devuelve DTO).
  private async findEntity(id: number): Promise<MarginEntity> {
    const margin = await this.marginRepository.findOne({ where: { id } });
    if (!margin) throw new NotFoundException(`Margen con id ${id} no encontrado`);
    return margin;
  }

  // Aunque MarginEntity tiene un índice UNIQUE en la columna "name" a nivel de DB,
  // esta validación en el servicio sirve para: (1) devolver un mensaje claro y
  // predecible en vez de dejar explotar una constraint de DB con error 500 genérico,
  // (2) permitir que los tests unitarios verifiquen este comportamiento sin tocar la DB.
  private async validateUniqueName(name: string): Promise<void> {
    const existing = await this.marginRepository.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`Ya existe un margen con el nombre "${name}"`);
    }
  }
}
```
