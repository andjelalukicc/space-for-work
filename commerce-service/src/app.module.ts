import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsController } from './metrics.controller';
import { HealthController } from './health.controller';
import { Product } from './products/product.entity';
import { Order } from './orders/order.entity';
import { OrderLine } from './orders/order-line.entity';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'coworking_commerce'),
        entities: [Product, Order, OrderLine],
        synchronize: false,
        migrationsRun: true,
        migrations: [join(__dirname, 'migrations', '*.js')],
      }),
      inject: [ConfigService],
    }),
    ProductsModule,
    OrdersModule,
    WebhooksModule,
  ],
  controllers: [MetricsController, HealthController],
})
export class AppModule {}
