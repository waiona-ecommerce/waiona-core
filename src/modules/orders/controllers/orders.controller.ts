import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { OrdersService } from '../services/orders.service';
import { OrderResponseDto } from '../dto/order-response.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RoleType } from '../../../common/enums/role-type.enum';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ version: '1', path: 'orders' })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid payload or insufficient stock',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.sub, dto);
  }

  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List all orders (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: OrderResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Get()
  findAll(@Query() { page, limit }: PaginationQueryDto) {
    return this.ordersService.findAll(page, limit);
  }

  @ApiOperation({ summary: 'Get orders by user' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, type: OrderResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Get('user/:userId')
  findByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: JwtPayload,
  ) {
    if (user.role === RoleType.CLIENT && user.sub !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return this.ordersService.findByUser(userId);
  }

  @ApiOperation({ summary: 'Get a single order by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    const order = await this.ordersService.findOne(id);
    if (user.role === RoleType.CLIENT && order.userId !== user.sub) {
      throw new ForbiddenException('Access denied');
    }
    return order;
  }

  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update order status (admin)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }
}
