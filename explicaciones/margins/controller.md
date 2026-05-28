```ts
// @ApiTags agrupa todos los endpoints bajo la sección "Margins" en Swagger UI.
@ApiTags('Margins')

// @ApiBearerAuth le dice a Swagger que estos endpoints requieren un token JWT
// en el header "Authorization: Bearer <token>".
@ApiBearerAuth()

// @Roles declara que solo super_admin y admin pueden acceder. Es metadata que
// lee RolesGuard para decidir si permite o rechaza el request.
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)

// @UseGuards aplica dos guardas EN ORDEN para todos los endpoints del controller:
// 1. AuthGuard('jwt'): valida el token JWT. Si es inválido, devuelve 401 y corta.
// 2. RolesGuard: verifica que el rol del payload JWT esté en @Roles(). Devuelve 403 si no.
// Al estar a nivel de clase y no por método, garantiza que ningún endpoint
// nuevo se olvide de proteger.
@UseGuards(AuthGuard('jwt'), RolesGuard)

// version: '1' + path: 'margins' → con versionado global configurado en main.ts,
// todos los endpoints quedan bajo /v1/margins.
@Controller({ version: '1', path: 'margins' })
export class MarginsController {

  // NestJS inyecta MarginsService automáticamente.
  // El controller no tiene lógica de negocio: solo enruta y delega.
  constructor(private readonly marginsService: MarginsService) {}

  // ─── POST /v1/margins ────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Crear un margen de ganancia' })
  @ApiResponse({ status: 201, type: MarginResponseDto })
  @ApiResponse({ status: 400, description: 'Valor mayor a 1000 o datos inválidos' })
  @ApiResponse({ status: 409, description: 'Ya existe un margen con ese nombre' })
  create(@Body() dto: CreateMarginDto): Promise<MarginResponseDto> {
    // @Body() extrae el body del request y lo pasa por el ValidationPipe global.
    // El pipe ejecuta los decoradores de class-validator en CreateMarginDto
    // (name entre 3-100 chars, value entre 0.01 y 1000 con máx 2 decimales).
    // Los márgenes son siempre porcentuales: no existe campo isPercentage.
    // Si alguna validación falla, el pipe lanza BadRequestException antes de
    // que este método se ejecute siquiera.
    // NestJS devuelve HTTP 201 por defecto para métodos @Post().
    return this.marginsService.create(dto);
  }

  // ─── GET /v1/margins ─────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar márgenes paginados' })
  @ApiResponse({ status: 200, type: MarginResponseDto, isArray: true })
  findAll(
    // @Query() extrae los query params del URL (ej: /v1/margins?page=2&limit=10)
    // y los mapea a PaginationQueryDto. El ValidationPipe transforma los strings
    // del query string a números gracias a @Type(() => Number) en el DTO,
    // y aplica valores por defecto si no vienen.
    // Se desestructura directamente { page, limit } para pasar solo lo necesario
    // al servicio, sin pasar el objeto DTO completo.
    @Query() { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<MarginResponseDto>> {
    return this.marginsService.findAll(page, limit);
  }

  // ─── GET /v1/margins/:id ─────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un margen por ID' })
  // @ApiParam documenta en Swagger que :id es numérico. Solo afecta la documentación,
  // no tiene efecto en runtime.
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: MarginResponseDto })
  @ApiResponse({ status: 404, description: 'Margen no encontrado' })
  findOne(
    // @Param('id') extrae el segmento dinámico :id de la URL (siempre llega como string).
    // ParseIntPipe lo convierte a number antes de pasarlo al método.
    // Si el valor no es un número válido (ej: /v1/margins/abc), ParseIntPipe
    // lanza BadRequestException automáticamente sin ejecutar el handler.
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MarginResponseDto> {
    return this.marginsService.findOne(id);
  }

  // ─── PATCH /v1/margins/:id ───────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un margen (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: MarginResponseDto })
  @ApiResponse({ status: 400, description: 'Valor mayor a 1000 o datos inválidos' })
  @ApiResponse({ status: 404, description: 'Margen no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un margen con ese nombre' })
  update(
    @Param('id', ParseIntPipe) id: number,
    // UpdateMarginDto extiende PartialType(CreateMarginDto): todos los campos son
    // opcionales. El cliente puede mandar solo los campos que quiere cambiar.
    // PATCH (parcial) vs PUT (reemplazo total): se usa PATCH porque no se requiere
    // mandar el recurso completo en cada actualización.
    @Body() dto: UpdateMarginDto,
  ): Promise<MarginResponseDto> {
    // NestJS puede extraer @Param y @Body en la misma firma sin problema.
    // Ambos se resuelven antes de ejecutar el método.
    return this.marginsService.update(id, dto);
  }

  // ─── DELETE /v1/margins/:id ──────────────────────────────────────────────────

  @Delete(':id')
  // Por defecto NestJS devuelve 200 para métodos que no son @Post.
  // @HttpCode sobreescribe eso a 204 (No Content): operación exitosa, sin body.
  // HttpStatus.NO_CONTENT es la constante para el valor 204, más legible que el literal.
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un margen (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado correctamente' })
  @ApiResponse({ status: 404, description: 'Margen no encontrado' })
  @ApiResponse({ status: 409, description: 'Margen en uso por uno o más pricings' })
  remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    // El servicio retorna void → NestJS no serializa nada en la respuesta,
    // lo cual es consistente con el HTTP 204.
    return this.marginsService.remove(id);
  }
}
```
