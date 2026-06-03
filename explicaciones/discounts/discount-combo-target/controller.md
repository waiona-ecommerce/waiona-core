```ts
@ApiTags('Discounts — Combo Targets')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
// Ruta doblemente anidada: discounts/:discountId/targets/combos
// Espeja la estructura de discount-product-target pero para combos.
// El segmento "targets" separa los endpoints de productos y combos
// bajo el mismo discount padre, evitando ambigüedad en la URL.
@Controller({ version: '1', path: 'discounts/:discountId/targets/combos' })
export class DiscountComboTargetController {
  constructor(private readonly service: DiscountComboTargetService) {}

  // POST /v1/discounts/:discountId/targets/combos
  @Post()
  @ApiOperation({ summary: 'Asignar combo a un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiResponse({ status: 201, type: DiscountComboTargetResponseDto })
  @ApiResponse({ status: 404, description: 'Descuento no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El combo ya tiene un descuento asignado',
  })
  async create(
    @Param('discountId', ParseIntPipe) discountId: number,
    // comboId viene en el body (CreateDiscountComboTargetDto), no en la URL.
    @Body() dto: CreateDiscountComboTargetDto,
  ): Promise<DiscountComboTargetResponseDto> {
    return this.service.create(discountId, dto);
  }

  // GET /v1/discounts/:discountId/targets/combos
  @Get()
  @ApiOperation({ summary: 'Listar combos asignados a un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiResponse({ status: 200, type: DiscountComboTargetResponseDto, isArray: true })
  @ApiResponse({ status: 404, description: 'Descuento no encontrado' })
  async findAll(
    @Param('discountId', ParseIntPipe) discountId: number,
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<DiscountComboTargetResponseDto>> {
    return this.service.findAll(discountId, page, limit);
  }

  // DELETE /v1/discounts/:discountId/targets/combos/:comboId
  @Delete(':comboId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar combo de un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiParam({ name: 'comboId', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async remove(
    @Param('discountId', ParseIntPipe) discountId: number,
    // comboId en la URL (no el id interno del registro) — misma decisión de diseño
    // que en DiscountProductTargetController: la URL describe la acción de negocio,
    // no el id técnico de la tabla de unión.
    @Param('comboId', ParseIntPipe) comboId: number,
  ): Promise<void> {
    return this.service.remove(discountId, comboId);
  }
  // Sin PATCH: las asignaciones de target son atómicas, no se editan.
}
```
