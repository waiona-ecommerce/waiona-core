import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    Query,
    UseGuards,
  } from '@nestjs/common';

  import { CategoryService } from '../services/category.service';
  import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

  import { CreateCategoryDto } from '../dto/create-category.dto';
  import { UpdateCategoryDto } from '../dto/update-category.dto';
  import { CategoryResponseDto } from '../dto/category-response.dto';
  import { CategoryTreeResponseDto } from '../dto/category-tree-response.dto';

  import { AuthGuard } from '@nestjs/passport';
  import { RolesGuard } from 'src/common/guards/roles.guard';
  import { Roles } from 'src/common/decorators/roles.decorator';
  import { RoleType } from 'src/common/enums/role-type.enum';
 
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Controller('categories')
  export class CategoryController {

    constructor(
      private readonly categoryService: CategoryService,
    ) {}

    // ==========================
    // GET ALL (plano)
    // ==========================

    @Get()
    async findAll(@Query() { page, limit }: PaginationQueryDto) {
      return this.categoryService.findAll(page, limit);
    }

    // ==========================
    // GET TREE
    // ==========================

    @Get('tree')
    async getTree(): Promise<CategoryTreeResponseDto[]> {
      return this.categoryService.getTree();
    }

    // ==========================
    // GET BY ID
    // ==========================

    @Get(':id')
    async findById(
      @Param('id', ParseIntPipe) id: number,
    ): Promise<CategoryResponseDto> {
      return this.categoryService.findById(id);
    }

    // ==========================
    // CREATE
    // ==========================

    @Post()
    async create(
      @Body() body: CreateCategoryDto,
    ): Promise<CategoryResponseDto> {
      return this.categoryService.create(body);
    }

    // ==========================
    // UPDATE
    // ==========================

    @Put(':id')
    async update(
      @Param('id', ParseIntPipe) id: number,
      @Body() body: UpdateCategoryDto,
    ): Promise<CategoryResponseDto> {
      return this.categoryService.update(id, body);
    }

    // ==========================
    // DELETE (soft)
    // ==========================

    @Delete(':id')
    async delete(
      @Param('id', ParseIntPipe) id: number,
    ): Promise<void> {
      return this.categoryService.delete(id);
    }
  }