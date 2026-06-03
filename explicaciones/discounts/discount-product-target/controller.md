```ts
@ApiTags('Discounts — Product Targets')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
// Ruta doblemente anidada: discounts/:discountId/targets/products
// El segmento "targets" actúa como namespace para separar los endpoints
// de productos y combos bajo el mismo descuento padre.
// Sin ese segmento, /discounts/:discountId/products chocaría semánticamente
// con rutas de otro módulo que pudieran existir bajo /products.
@Controller({ version: '1', path: 'discounts/:discountId/targets/products' })
export class DiscountProductTargetController {
  // Nombre corto "service" en vez de "discountProductTargetService": válido
  // cuando hay un solo servicio inyectado y el contexto lo hace claro.
  constructor(private readonly service: DiscountProductTargetService) {}

  // POST /v1/discounts/:discountId/targets/products
  @Post()
  @ApiOperation({ summary: 'Asignar producto a un descuento' })
  // @ApiParam por método (no a nivel de clase) porque aquí el parámetro
  // documentado en Swagger varía entre métodos (discountId en POST/GET, más productId en DELETE).
  @ApiParam({ name: 'discountId', type: Number })
  @ApiResponse({ status: 201, type: DiscountProductTargetResponseDto })
  @ApiResponse({ status: 404, description: 'Descuento no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El producto ya tiene un descuento asignado',
  })
  async create(
    @Param('discountId', ParseIntPipe) discountId: number,
    // productId viene en el body (CreateDiscountProductTargetDto), no en la URL.
    // A diferencia de product-taxes donde productId venía del URL, aquí el diseño
    // elige ponerlo en el body porque el "target" es el dato que se está creando.
    @Body() dto: CreateDiscountProductTargetDto,
  ): Promise<DiscountProductTargetResponseDto> {
    return this.service.create(discountId, dto);
  }

  // GET /v1/discounts/:discountId/targets/products
  @Get()
  @ApiOperation({ summary: 'Listar productos asignados a un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  @ApiResponse({ status: 200, type: DiscountProductTargetResponseDto, isArray: true })
  @ApiResponse({ status: 404, description: 'Descuento no encontrado' })
  async findAll(
    @Param('discountId', ParseIntPipe) discountId: number,
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<DiscountProductTargetResponseDto>> {
    return this.service.findAll(discountId, page, limit);
  }

  // DELETE /v1/discounts/:discountId/targets/products/:productId
  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar producto de un descuento' })
  @ApiParam({ name: 'discountId', type: Number })
  // Se documenta también el segundo param del URL.
  @ApiParam({ name: 'productId', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async remove(
    @Param('discountId', ParseIntPipe) discountId: number,
    // El ID en la URL es productId, no el id interno del registro.
    // Esto hace la URL semánticamente clara: "quitar el producto X del descuento Y",
    // sin necesidad de que el cliente conozca el id interno de la tabla de unión.
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<void> {
    return this.service.remove(discountId, productId);
  }
  // No hay PATCH: los targets son asignaciones atómicas (create o delete, no update).
}
```
