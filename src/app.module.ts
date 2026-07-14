import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import * as Joi from 'joi';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppController } from './app.controller';
import { HealthModule } from './modules/health/health.module';

import { TaxationModule } from './modules/taxation/taxation.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { ProductsModule } from './modules/products/products.module';
import { StocksModule } from './modules/stocks/stocks.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { SeedModule } from './modules/seed/seed.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ShopModule } from './modules/products/shop/shop.module';
import { MailModule } from './modules/mail/mail.module';
import { StorageModule } from './modules/storage/storage.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().optional(),
        POSTGRES_HOST: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        POSTGRES_PORT: Joi.number().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        POSTGRES_DB: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        POSTGRES_USER: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        POSTGRES_PASSWORD: Joi.string().when('DATABASE_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        JWT_SECRET: Joi.string().required(),
        MP_ACCESS_TOKEN: Joi.string().required(),
        MP_NOTIFICATION_URL: Joi.string().required(),
        RESEND_API_KEY: Joi.string().required(),
        FRONTEND_URL: Joi.string().required(),
        API_URL: Joi.string().required(),
        REDIS_URL: Joi.string().uri().optional(),
        REDIS_HOST: Joi.string().when('REDIS_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        REDIS_PORT: Joi.number().when('REDIS_URL', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required(),
        }),
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),
      }),
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        customProps: (req) => ({ requestId: req.headers['x-request-id'] }),
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) return { url: redisUrl };
        return {
          redis: {
            host: config.get('REDIS_HOST'),
            port: config.get<number>('REDIS_PORT'),
          },
        };
      },
    }),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService): any => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) return { store: redisStore, url: redisUrl, ttl: 60_000 };
        return {
          store: redisStore,
          socket: {
            host: config.get('REDIS_HOST'),
            port: config.get<number>('REDIS_PORT'),
          },
          ttl: 60_000,
        };
      },
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const base = {
          autoLoadEntities: true,
          synchronize:
            process.env.DB_SYNCHRONIZE === 'true' ||
            process.env.NODE_ENV !== 'production',
        };
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            ssl: { rejectUnauthorized: false },
            ...base,
          };
        }
        return {
          type: 'postgres',
          host: config.get<string>('POSTGRES_HOST'),
          port: config.get<number>('POSTGRES_PORT'),
          username: config.get<string>('POSTGRES_USER'),
          password: config.get<string>('POSTGRES_PASSWORD'),
          database: config.get<string>('POSTGRES_DB'),
          ...base,
        };
      },
    }),

    HealthModule,
    TaxationModule,
    DiscountsModule,
    ProductsModule,
    StocksModule,
    PricingModule,
    CouponsModule,
    UsersModule,
    AuthModule,
    SeedModule,
    OrdersModule,
    PaymentsModule,
    ShopModule,
    MailModule,
    StorageModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
