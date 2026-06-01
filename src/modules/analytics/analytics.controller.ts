import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RoleType } from '../../common/enums/role-type.enum';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ version: '1', path: 'analytics' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({
    summary: 'Order summary: counts by status and revenue totals',
  })
  @ApiResponse({ status: 200, description: 'Aggregated order metrics' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Get('orders')
  getOrdersSummary() {
    return this.analyticsService.getOrdersSummary();
  }

  @ApiOperation({
    summary: 'Top 10 best-selling products by units in delivered orders',
  })
  @ApiResponse({ status: 200, description: 'Ranked product list' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Get('products/top')
  getTopProducts() {
    return this.analyticsService.getTopProducts();
  }

  @ApiOperation({ summary: 'Stock items at or below their critical threshold' })
  @ApiResponse({
    status: 200,
    description: 'Critical stock items per location',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Get('stock/critical')
  getCriticalStock() {
    return this.analyticsService.getCriticalStock();
  }
}
