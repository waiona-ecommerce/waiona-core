import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { StockItemEntity } from '../stocks/stock-item/entities/stock-item.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: Repository<OrderItemEntity>,
    @InjectRepository(StockItemEntity)
    private readonly stockItemRepo: Repository<StockItemEntity>,
  ) {}

  async getOrdersSummary() {
    const byStatusRaw = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();

    const byStatus: Record<string, number> = {};
    for (const row of byStatusRaw) {
      byStatus[row.status] = Number(row.count);
    }

    const revenueBase = this.orderRepo
      .createQueryBuilder('o')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED });

    const [totalRevenue, revenueToday, revenueThisMonth] = await Promise.all([
      revenueBase
        .clone()
        .select('COALESCE(SUM(o.total), 0)', 'v')
        .getRawOne<{ v: string }>(),
      revenueBase
        .clone()
        .andWhere('o.createdAt >= CURRENT_DATE')
        .select('COALESCE(SUM(o.total), 0)', 'v')
        .getRawOne<{ v: string }>(),
      revenueBase
        .clone()
        .andWhere("o.createdAt >= DATE_TRUNC('month', NOW())")
        .select('COALESCE(SUM(o.total), 0)', 'v')
        .getRawOne<{ v: string }>(),
    ]);

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

    return {
      total,
      byStatus: {
        pending: byStatus[OrderStatus.PENDING] ?? 0,
        confirmed: byStatus[OrderStatus.CONFIRMED] ?? 0,
        dispatched: byStatus[OrderStatus.DISPATCHED] ?? 0,
        delivered: byStatus[OrderStatus.DELIVERED] ?? 0,
        cancelled: byStatus[OrderStatus.CANCELLED] ?? 0,
      },
      totalRevenue: Number(totalRevenue?.v ?? 0),
      revenueToday: Number(revenueToday?.v ?? 0),
      revenueThisMonth: Number(revenueThisMonth?.v ?? 0),
    };
  }

  async getTopProducts(limit = 10) {
    const rows = await this.orderItemRepo
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .innerJoin('oi.product', 'p')
      .select('oi.productId', 'productId')
      .addSelect('p.name', 'name')
      .addSelect('p.sku', 'sku')
      .addSelect('SUM(oi.quantity)', 'totalSold')
      .where('o.status = :status', { status: OrderStatus.DELIVERED })
      .andWhere('oi.productId IS NOT NULL')
      .groupBy('oi.productId')
      .addGroupBy('p.name')
      .addGroupBy('p.sku')
      .orderBy('SUM(oi.quantity)', 'DESC')
      .limit(limit)
      .getRawMany<{
        productId: string;
        name: string;
        sku: string;
        totalSold: string;
      }>();

    return rows.map((r) => ({
      productId: Number(r.productId),
      name: r.name,
      sku: r.sku,
      totalSold: Number(r.totalSold),
    }));
  }

  async getCriticalStock() {
    const rows = await this.stockItemRepo
      .createQueryBuilder('si')
      .innerJoin('si.product', 'p')
      .innerJoin('si.location', 'l')
      .select('si.id', 'id')
      .addSelect('p.id', 'productId')
      .addSelect('p.name', 'productName')
      .addSelect('p.sku', 'sku')
      .addSelect('l.id', 'locationId')
      .addSelect('l.name', 'locationName')
      .addSelect('si.quantityCurrent', 'quantityCurrent')
      .addSelect('si.quantityReserved', 'quantityReserved')
      .addSelect('si.stockCritical', 'stockCritical')
      .addSelect('si.stockMin', 'stockMin')
      .where('si.quantityCurrent <= si.stockCritical')
      .orderBy('si.quantityCurrent', 'ASC')
      .getRawMany<{
        id: string;
        productId: string;
        productName: string;
        sku: string;
        locationId: string;
        locationName: string;
        quantityCurrent: string;
        quantityReserved: string;
        stockCritical: string;
        stockMin: string;
      }>();

    return rows.map((r) => ({
      id: Number(r.id),
      productId: Number(r.productId),
      productName: r.productName,
      sku: r.sku,
      locationId: Number(r.locationId),
      locationName: r.locationName,
      quantityCurrent: Number(r.quantityCurrent),
      quantityReserved: Number(r.quantityReserved),
      quantityAvailable: Number(r.quantityCurrent) - Number(r.quantityReserved),
      stockCritical: Number(r.stockCritical),
      stockMin: Number(r.stockMin),
    }));
  }
}
