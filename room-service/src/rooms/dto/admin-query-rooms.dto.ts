import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Query za GET /rooms/admin/list — uključuje i neaktivne (soft-delete) zapise. */
export class AdminQueryRoomsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  sort?: string = 'name';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'ASC';

  /** all | active | inactive — podrazumevano sve prostorije. */
  @IsOptional()
  @IsIn(['all', 'active', 'inactive'])
  activeFilter?: 'all' | 'active' | 'inactive';
}
