import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class SearchUsersDto extends PaginationQueryDto {

  @ApiProperty({ example: 'juan@example.com', required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ example: 'Juan', required: false, description: 'Busca por nombre o apellido' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}