import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import Stripe from 'stripe';
import { OrdersService } from '../orders/orders.service';

@Controller('webhooks')
export class StripeWebhookController {
  private stripe: Stripe | null;

  constructor(
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
  }

  @Post('stripe')
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !secret) {
      throw new BadRequestException('Stripe webhook is not configured');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const raw = req.rawBody;
    if (!raw) {
      throw new BadRequestException('Missing raw body');
    }
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(raw, signature, secret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    if (event.type === 'checkout.session.completed') {
      await this.orders.markPaidFromStripeSession(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Stripe.Event typing
        event.data.object as Stripe.Checkout.Session,
      );
    }

    return { received: true };
  }
}
