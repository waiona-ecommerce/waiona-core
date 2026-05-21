import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { AuthService } from '../services/auth.service';
import { UserEntity } from '../../users/entities/user.entity';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { ForgotPasswordDto } from 'src/modules/mail/dto/forgot-password.dto';
import { ResetPasswordDto } from 'src/modules/mail/dto/reset-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ==========================
  // POST /auth/register
  // ==========================

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado — se envía email de activación',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El email ya existe' })
  async register(@Body() dto: CreateUserDto): Promise<{ message: string }> {
    await this.authService.register(dto);
    return {
      message:
        'Registration successful — check your email to activate your account',
    };
  }

  // ==========================
  // GET /auth/activate?token=xxx
  // ==========================

  @Get('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar cuenta con token' })
  @ApiResponse({ status: 200, description: 'Cuenta activada correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Token inválido, expirado o ya usado',
  })
  async activate(@Query('token') token: string): Promise<{ message: string }> {
    await this.authService.activateAccount(token);
    return { message: 'Account activated successfully' };
  }

  // ==========================
  // POST /auth/login
  // ==========================

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login con email y contraseña' })
  @ApiResponse({
    status: 200,
    description: 'JWT y datos del usuario autenticado',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas o cuenta no activada',
  })
  login(@Req() req: Request): { user: UserEntity; access_token: string } {
    const user = req.user as UserEntity;
    return {
      user,
      access_token: this.authService.generateToken(user),
    };
  }

  // ==========================
  // POST /auth/forgot-password
  // ==========================

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar reset de contraseña' })
  @ApiResponse({
    status: 200,
    description: 'Siempre OK — sin hints sobre si el email existe',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto.email);
    // siempre responder OK — no dar pistas sobre si el email existe
    return {
      message: 'If the email exists, you will receive a reset link shortly',
    };
  }

  // ==========================
  // POST /auth/reset-password
  // ==========================

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resetear contraseña con token' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada correctamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Token inválido, expirado o ya usado',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successfully' };
  }
}
