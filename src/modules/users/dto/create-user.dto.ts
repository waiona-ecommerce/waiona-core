import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  // ==========================
  // Auth
  // ==========================

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123', minLength: 8, maxLength: 255 })
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  // ==========================
  // Profile
  // ==========================

  @ApiProperty({ example: 'Juan', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Pérez', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName: string;

  @ApiProperty({ example: null, nullable: true, required: false })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  avatar?: string;
}
