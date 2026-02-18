import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Start time must be in HH:MM format' })
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'End time must be in HH:MM format' })
  endTime: string;
}
