import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { DemoPayDto } from './dto/demo-pay.dto';
import { AdminGuard } from '../common/admin.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  async checkout(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    if (!userId) throw new UnauthorizedException('User ID is required');
    return this.orders.createCheckout(userId, dto);
  }

  @Get('my')
  async myOrders(@Headers('x-user-id') userId: string) {
    if (!userId) throw new UnauthorizedException('User ID is required');
    return this.orders.findMine(userId);
  }

  @Post('demo-pay')
  async demoPay(
    @Headers('x-user-id') userId: string,
    @Body() body: DemoPayDto,
  ) {
    if (!userId) throw new UnauthorizedException('User ID is required');
    return this.orders.syncOrderFromDemoCheckout(body.orderId, userId);
  }

  @Get('admin/transactions')
  @UseGuards(AdminGuard)
  adminTransactions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '50', 10) || 50));
    return this.orders.findAdminTransactions(p, l);
  }
}
