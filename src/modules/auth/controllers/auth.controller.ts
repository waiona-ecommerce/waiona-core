import {
  Controller,
  Post,
  Get,
  Patch,
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
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { Payload } from '../models/payload.model';

@ApiTags('Auth')
@Controller({ version: '1', path: 'auth' })
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
    description: 'Access token, refresh token y datos del usuario autenticado',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas o cuenta no activada',
  })
  async login(@Req() req: Request): Promise<{
    user: UserEntity;
    access_token: string;
    refresh_token: string;
  }> {
    const user = req.user as UserEntity;
    const tokens = await this.authService.login(user);
    return { user, ...tokens };
  }

  // ==========================
  // POST /auth/refresh
  // ==========================

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener nuevo access token con refresh token' })
  @ApiResponse({ status: 200, description: 'Nuevos access y refresh token' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido, expirado o revocado',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return this.authService.refresh(dto.refresh_token);
  }

  // ==========================
  // POST /auth/logout
  // ==========================

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar refresh token (logout)' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada correctamente' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido o ya revocado',
  })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refresh_token);
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

  // ==========================
  // PATCH /auth/change-password
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar contraseña (usuario autenticado)' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada correctamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Contraseña actual incorrecta o datos inválidos',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const payload = (req as any).user as Payload;
    await this.authService.changePassword(payload.sub, dto);
    return { message: 'Password changed successfully' };
  }

  // ==========================
  // POST /auth/logout-all
  // ==========================

  @UseGuards(AuthGuard('jwt'))
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión en todos los dispositivos' })
  @ApiResponse({ status: 204, description: 'Todas las sesiones cerradas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async logoutAll(@Req() req: Request): Promise<void> {
    const payload = (req as any).user as Payload;
    await this.authService.logoutAll(payload.sub);
  }
}
