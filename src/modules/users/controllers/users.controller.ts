import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { UsersService } from '../services/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { SearchUsersDto } from '../dto/search-users.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleType } from 'src/common/enums/role-type.enum';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==========================
  // GET ALL — solo admin
  // ==========================

  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get()
  findAll(@Query() query: SearchUsersDto) {
    return this.usersService.findAll(query, query.page, query.limit);
  }

  // ==========================
  // GET ONE — propio usuario
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const payload = req.user as { sub: number };
    if (payload.sub !== id) throw new ForbiddenException('Access denied');
    return this.usersService.findOne(id);
  }

  // ==========================
  // UPDATE — propio usuario
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
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
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const payload = req.user as { sub: number };
    if (payload.sub !== id) throw new ForbiddenException('Access denied');
    return this.usersService.remove(id);
  }
}