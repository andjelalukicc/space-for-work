import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** U aplikaciji: admin | member (CUSTOMER). */
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'member'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
