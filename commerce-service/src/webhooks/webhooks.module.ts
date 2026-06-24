import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [OrdersModule],
  controllers: [StripeWebhookController],
})
export class WebhooksModule {}
