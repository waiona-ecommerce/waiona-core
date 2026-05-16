import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class SearchUsersDto extends PaginationQueryDto {

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  // busca por nombre completo (name + lastName)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}