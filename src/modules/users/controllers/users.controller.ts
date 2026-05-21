import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { UsersService } from '../services/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { SearchUsersDto } from '../dto/search-users.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==========================
  // GET ALL — solo admin
  // ==========================

  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get()
  @ApiOperation({ summary: 'Listar usuarios paginados' })
  @ApiResponse({ status: 200, description: 'Lista paginada de usuarios' })
  findAll(@Query() query: SearchUsersDto) {
    return this.usersService.findAll(query, query.page, query.limit);
  }

  // ==========================
  // GET ONE — propio usuario
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  @ApiOperation({ summary: 'Obtener propio usuario' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const payload = req.user as { sub: number };
    if (payload.sub !== id) throw new ForbiddenException('Access denied');
    return this.usersService.findOne(id);
  }

  // ==========================
  // UPDATE — propio usuario
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar perfil propio (parcial)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Body() dto: UpdateUserDto,
  ) {
    const payload = req.user as { sub: number };
    if (payload.sub !== id) throw new ForbiddenException('Access denied');
    return this.usersService.update(id, dto);
  }

  // ==========================
  // DELETE — propio usuario
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar propia cuenta (soft delete)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Eliminado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const payload = req.user as { sub: number };
    if (payload.sub !== id) throw new ForbiddenException('Access denied');
    return this.usersService.remove(id);
  }
}
