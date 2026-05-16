import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    ParseIntPipe,
    UseGuards,
  } from '@nestjs/common';

  import { ProductService } from '../services/product.service';

  import { CreateProductDto } from '../dto/create-product.dto';
  import { UpdateProductDto } from '../dto/update-product.dto';
  import { ProductResponseDto } from '../dto/product-response.dto';
  import { Roles } from 'src/common/decorators/roles.decorator';
  import { RoleType } from 'src/common/enums/role-type.enum';
  import { AuthGuard } from '@nestjs/passport';
  import { RolesGuard } from 'src/common/guards/roles.guard';
  import { PaginatedResponseDto } from 'src/common/dto/paginated-response.dto';
  import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
  
  
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Controller('products')
  export class ProductController {
  
    constructor(
      private readonly productService: ProductService,
    ) {}
  
    // ==========================
    // GET ALL
    // ==========================
  
    @Get()
    async findAll(@Query() { page, limit }: PaginationQueryDto): Promise<PaginatedResponseDto<ProductResponseDto>> {
      return this.productService.findAll(page, limit);
    }
  
    // ==========================
    // GET BY ID
    // ==========================
  
    @Get(':id')
    async findById(
      @Param('id', ParseIntPipe) id: number,
    ): Promise<ProductResponseDto> {
      return this.productService.findById(id);
    }
  
    // ==========================
    // CREATE
    // ==========================
  
    @Post()
    async create(
      @Body() body: CreateProductDto,
    ): Promise<ProductResponseDto> {
      return this.productService.create(body);
    }
  
    // ==========================
    // UPDATE
    // ==========================
  
    @Put(':id')
    async update(
      @Param('id', ParseIntPipe) id: number,
      @Body() body: UpdateProductDto,
    ): Promise<ProductResponseDto> {
      return this.productService.update(id, body);
    }
  
    // ==========================
    // DELETE (soft)
    // ==========================
  
    @Delete(':id')
    async delete(
      @Param('id', ParseIntPipe) id: number,
    ): Promise<void> {
      return this.productService.delete(id);
    }
  }