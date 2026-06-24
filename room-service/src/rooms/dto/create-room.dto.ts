import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsIn(['meeting_room', 'phone_booth'])
  type: string;

  @IsInt()
  @Min(1)
  @Max(500)
  capacity: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  amenities?: string[];
}
