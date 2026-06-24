import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Order } from './order.entity';
import { OrderLine } from './order-line.entity';
import { Product } from '../products/product.entity';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Injectable()
export class OrdersService {
  private stripe: Stripe | null;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderLine)
    private readonly lineRepo: Repository<OrderLine>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
  }

  async createCheckout(userId: string, dto: CreateCheckoutDto) {
    const lines: Partial<OrderLine>[] = [];
    let total = 0;

    for (const row of dto.lines) {
      const product = await this.productRepo.findOne({
        where: { id: row.productId },
      });
      if (!product || !product.isActive) {
        throw new BadRequestException(`Product ${row.productId} not available`);
      }
      if (row.quantity > product.stockQuantity) {
        throw new BadRequestException(
          `Nema dovoljno stanja za "${product.name}". Dostupno: ${product.stockQuantity}`,
        );
      }
      const unit = parseFloat(product.price);
      const lineTotal = unit * row.quantity;
      total += lineTotal;
      lines.push({
        productId: product.id,
        productName: product.name,
        quantity: row.quantity,
        unitPrice: unit.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });
    }

    const order = this.orderRepo.create({
      userId,
      status: 'pending',
      totalAmount: total.toFixed(2),
      currency: 'eur',
    });
    await this.orderRepo.save(order);

    for (const l of lines) {
      await this.lineRepo.save(
        this.lineRepo.create({
          order,
          productId: l.productId!,
          productName: l.productName!,
          quantity: l.quantity!,
          unitPrice: l.unitPrice!,
          lineTotal: l.lineTotal!,
        }),
      );
    }

    if (!this.stripe) {
      return {
        demo: true,
        orderId: order.id,
        checkoutSessionId: `cs_demo_${order.id}`,
        message:
          'Stripe nije konfigurisan (STRIPE_SECRET_KEY). Koristi simulaciju plaćanja u portalu.',
      };
    }

    const frontend =
      this.config.get<string>('FRONTEND_BASE_URL')?.replace(/\/$/, '') ||
      'http://127.0.0.1:5500';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: dto.lines.map((row, idx) => {
        const line = lines[idx];
        const amount = Math.round(parseFloat(line.unitPrice!) * 100);
        return {
          quantity: row.quantity,
          price_data: {
            currency: 'eur',
            unit_amount: amount,
            product_data: {
              name: line.productName!,
            },
          },
        };
      }),
      success_url: `${frontend}/spaceforwork-portal.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontend}/spaceforwork-portal.html?checkout=cancel`,
      metadata: {
        orderId: order.id,
        userId,
      },
    });

    order.stripeSessionId = session.id;
    await this.orderRepo.save(order);

    return {
      demo: false,
      orderId: order.id,
      checkoutSessionId: session.id,
      url: session.url,
    };
  }

  async findMine(userId: string) {
    return this.orderRepo.find({
      where: { userId },
      relations: ['lines', 'lines.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAdminTransactions(page = 1, limit = 50) {
    const [data, total] = await this.orderRepo.findAndCount({
      relations: ['lines', 'lines.product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markPaidFromStripeSession(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['lines'],
    });
    if (!order || order.status === 'paid') return;

    order.status = 'paid';
    order.paidAt = new Date();
    const piRef = session.payment_intent;
    const piId =
      typeof piRef === 'string' ? piRef : (piRef as Stripe.PaymentIntent)?.id;
    order.stripePaymentIntentId = piId ?? null;

    let last4: string | null = null;
    if (this.stripe && piId) {
      const pi = await this.stripe.paymentIntents.retrieve(piId, {
        expand: ['payment_method'],
      });
      const pm = pi.payment_method as Stripe.PaymentMethod | null;
      if (pm?.card?.last4) last4 = pm.card.last4;
    }

    order.cardLast4 = last4;

    for (const line of order.lines) {
      const product = await this.productRepo.findOne({
        where: { id: line.productId },
      });
      if (product) {
        product.stockQuantity = Math.max(
          0,
          product.stockQuantity - line.quantity,
        );
        await this.productRepo.save(product);
      }
    }

    await this.orderRepo.save(order);
  }

  async syncOrderFromDemoCheckout(orderId: string, userId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, userId },
      relations: ['lines'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'paid') return order;

    order.status = 'paid';
    order.paidAt = new Date();
    order.stripePaymentIntentId = `pi_demo_${order.id}`;
    order.cardLast4 = order.cardLast4 ?? '4242';
    order.stripeSessionId = order.stripeSessionId ?? `cs_demo_${order.id}`;

    for (const line of order.lines) {
      const product = await this.productRepo.findOne({
        where: { id: line.productId },
      });
      if (product) {
        product.stockQuantity = Math.max(
          0,
          product.stockQuantity - line.quantity,
        );
        await this.productRepo.save(product);
      }
    }

    return this.orderRepo.save(order);
  }
}
