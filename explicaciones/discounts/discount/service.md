```ts
@Injectable()
export class DiscountsService {
  constructor(
    @InjectRepository(DiscountEntity)
    private readonly discountRepository: Repository<DiscountEntity>,

    // Invalida la caché del shop cuando cambia un descuento, porque los descuentos
    // afectan el precio que ve el cliente.
    private readonly shopCacheService: ShopCacheService,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(dto: CreateDiscountDto): Promise<DiscountResponseDto> {
    // Los descuentos son siempre porcentuales (0.01% – 100%).
    // No existe campo isPercentage ni currency: el DTO los bloquea con
    // forbidNonWhitelisted y el motor de cálculo asume porcentaje siempre.
    // La única validación de negocio que no puede vivir en el DTO
    // es la consistencia entre startsAt y endsAt.
    this.validateDates(dto.startsAt, dto.endsAt);

    const discount = this.discountRepository.create(dto);
    const saved = await this.discountRepository.save(discount);
    void this.shopCacheService.invalidate(); // Fire-and-forget.
    return new DiscountResponseDto(saved);
  }

  // ─── GET ALL ─────────────────────────────────────────────────────────────────

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<DiscountResponseDto>> {
    const [discounts, total] = await this.discountRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      // TypeORM agrega WHERE deletedAt IS NULL automáticamente por @DeleteDateColumn.
    });

    return new PaginatedResponseDto(
      discounts.map((discount) => new DiscountResponseDto(discount)),
      total,
      page,
      limit,
    );
  }

  // ─── GET ONE ─────────────────────────────────────────────────────────────────

  async findOne(id: number): Promise<DiscountResponseDto> {
    const discount = await this.findEntity(id);
    return new DiscountResponseDto(discount);
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  async update(
    id: number,
    dto: UpdateDiscountDto,
  ): Promise<DiscountResponseDto> {
    const discount = await this.findEntity(id);

    // Se resuelve el estado efectivo de las fechas combinando el DTO parcial
    // con los valores actuales de la entidad. Así validateDates siempre recibe
    // el rango completo que quedará en la DB, no solo los campos que cambian.
    const startsAt = dto.startsAt ?? discount.startsAt;
    const endsAt = dto.endsAt ?? discount.endsAt;
    this.validateDates(startsAt, endsAt);

    // .merge() aplica el DTO parcial sobre la entidad sin perder los campos
    // que el cliente no mandó en este PATCH.
    const merged = this.discountRepository.merge(discount, dto);
    const updated = await this.discountRepository.save(merged);
    void this.shopCacheService.invalidate();
    return new DiscountResponseDto(updated);
  }

  // ─── DELETE (soft) ───────────────────────────────────────────────────────────

  async remove(id: number): Promise<void> {
    const discount = await this.findEntity(id);
    await this.discountRepository.softDelete(discount.id);
    void this.shopCacheService.invalidate();
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private async findEntity(id: number): Promise<DiscountEntity> {
    const discount = await this.discountRepository.findOne({
      where: { id },
    });

    if (!discount) {
      throw new NotFoundException(`Descuento con id ${id} no encontrado`);
    }

    return discount;
  }

  private validateDates(startsAt?: Date | null, endsAt?: Date | null): void {
    if (startsAt && endsAt) {
      // >= en lugar de > para rechazar el caso startsAt === endsAt,
      // que crearía un rango vacío (ningún momento del tiempo pertenecería al descuento).
      if (new Date(startsAt) >= new Date(endsAt)) {
        throw new BadRequestException(
          'La fecha de inicio debe ser anterior a la fecha de fin',
        );
      }
    }
    // Si alguna de las dos es null/undefined, no se valida: ambas son opcionales.
    // Un descuento sin fechas es válido (aplica siempre hasta que se borre).
  }
}
```
