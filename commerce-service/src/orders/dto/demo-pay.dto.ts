import { IsUUID } from 'class-validator';

export class DemoPayDto {
  @IsUUID()
  orderId: string;
}
