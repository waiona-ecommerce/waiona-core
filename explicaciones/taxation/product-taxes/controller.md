```ts
@ApiTags('Product Taxes')
@ApiBearerAuth()
// @ApiParam a nivel de clase documenta el segmento :productId del URL en Swagger
// para todos los endpoints, ya que todos viven bajo la ruta anidada.
@ApiParam({ name: 'productId', type: Number })
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
// Ruta anidada: products/:productId/taxes
// Semánticamente: "los taxes de un producto específico".
// El productId en la URL define el scope del recurso, no va en el body.
@Controller({ version: '1', path: 'products/:productId/taxes' })
export class ProductTaxesController {
  constructor(private readonly productTaxesService: ProductTaxesService) {}

  // GET /v1/products/:productId/taxes
  @ApiOperation({ summary: 'List taxes for a product' })
  @ApiResponse({ status: 200, type: ProductTaxResponseDto, isArray: true })
  @Get()
  findAll(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ProductTaxResponseDto>> {
    return this.productTaxesService.findAll(productId, page, limit);
  }

  // GET /v1/products/:productId/taxes/:id
  @ApiOperation({ summary: 'Get a product tax by ID' })
  @ApiResponse({ status: 200, type: ProductTaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ProductTaxResponseDto> {
    // productId no se pasa al servicio: findOne solo necesita el id del registro
    // en la tabla product_taxes, no el del producto padre.
    return this.productTaxesService.findOne(id);
  }

  // POST /v1/products/:productId/taxes
  @ApiOperation({ summary: 'Assign a tax to a product' })
  @ApiResponse({ status: 201, type: ProductTaxResponseDto })
  @ApiResponse({ status: 400, description: 'Tax not found or is global' })
  @Post()
  create(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: CreateProductTaxDto,
  ): Promise<ProductTaxResponseDto> {
    // El spread { ...dto, productId } fusiona el body DTO con el productId del URL
    // en un único objeto. El servicio recibe todo lo que necesita en un solo argumento.
    // Es una alternativa a pasar productId como segundo parámetro separado.
    return this.productTaxesService.create({ ...dto, productId });
  }

  // PATCH /v1/products/:productId/taxes/:id
  @ApiOperation({ summary: 'Update a product tax assignment' })
  @ApiResponse({ status: 200, type: ProductTaxResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductTaxDto,
  ): Promise<ProductTaxResponseDto> {
    return this.productTaxesService.update(id, dto);
  }

  // DELETE /v1/products/:productId/taxes/:id
  @ApiOperation({ summary: 'Remove a tax from a product' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.productTaxesService.remove(id);
  }
}
```
