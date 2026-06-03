```ts
@ApiTags('Taxes')
@ApiBearerAuth()
// @ApiParam a nivel de clase documenta el parámetro :taxTypeId en Swagger para
// TODOS los endpoints del controller, ya que todos viven bajo la ruta anidada.
// Sin esto, Swagger no sabría que existe ese segmento dinámico en la URL.
@ApiParam({ name: 'taxTypeId', type: Number })
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
// Ruta anidada: tax-types/:taxTypeId/taxes
// Representa que un Tax siempre pertenece a un TaxType (relación padre-hijo).
// El taxTypeId viene del segmento de URL, no del body del request.
@Controller({ version: '1', path: 'tax-types/:taxTypeId/taxes' })
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  // GET /v1/tax-types/:taxTypeId/taxes
  @ApiOperation({ summary: 'List taxes for a tax type' })
  @ApiResponse({ status: 200, type: TaxResponseDto, isArray: true })
  @Get()
  findAll(
    // taxTypeId viene del segmento de URL :taxTypeId. ParseIntPipe lo convierte
    // de string a number. Si no es un número válido, falla con 400 antes de
    // ejecutar el handler.
    @Param('taxTypeId', ParseIntPipe) taxTypeId: number,
    // page y limit vienen del query string. PaginationQueryDto tiene @ApiPropertyOptional
    // para que Swagger los muestre como parámetros opcionales.
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<TaxResponseDto>> {
    return this.taxesService.findAll(taxTypeId, page, limit);
  }

  // GET /v1/tax-types/:taxTypeId/taxes/:id
  @ApiOperation({ summary: 'Get a tax by ID' })
  @ApiResponse({ status: 200, type: TaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TaxResponseDto> {
    // El taxTypeId no se pasa al servicio porque findById solo necesita el id
    // del tax en sí. El filtro por taxTypeId solo aplica en findAll.
    return this.taxesService.findById(id);
  }

  // POST /v1/tax-types/:taxTypeId/taxes
  @ApiOperation({ summary: 'Create a tax' })
  @ApiResponse({ status: 201, type: TaxResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Validation error or tax type not found',
  })
  @Post()
  create(
    // taxTypeId viene del URL (define el padre), dto viene del body (define el tax).
    // Son dos fuentes de datos distintas que el servicio combina al crear la entidad.
    @Param('taxTypeId', ParseIntPipe) taxTypeId: number,
    @Body() dto: CreateTaxDto,
  ): Promise<TaxResponseDto> {
    return this.taxesService.create(taxTypeId, dto);
  }

  // PATCH /v1/tax-types/:taxTypeId/taxes/:id
  @ApiOperation({ summary: 'Update a tax' })
  @ApiResponse({ status: 200, type: TaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaxDto,
  ): Promise<TaxResponseDto> {
    // El taxTypeId del URL no se pasa al update: el servicio no lo necesita
    // porque el tax ya tiene su taxTypeId guardado y no se puede reasignar.
    return this.taxesService.update(id, dto);
  }

  // DELETE /v1/tax-types/:taxTypeId/taxes/:id
  @ApiOperation({ summary: 'Delete a tax' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Delete(':id')
  // @HttpCode sobreescribe el 200 por defecto a 204 (No Content): delete exitoso sin body.
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.taxesService.delete(id);
  }
}
```
