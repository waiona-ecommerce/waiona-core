import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

import { UsersService } from '../../users/services/users.service';
import { UserEntity } from '../../users/entities/user.entity';
import { TokenEntity } from '../../mail/entities/token.entity';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { ChangePasswordDto } from '../dto/change-password.dto';

import { MailService } from '../../mail/services/mail.service';
import { Payload } from '../models/payload.model';
import { RoleType } from '../../../common/enums/role-type.enum';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { ResetPasswordDto } from '../../mail/dto/reset-password.dto';
import { TokenType } from '../../mail/enum/token-type.enum';

const REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,

    @InjectRepository(TokenEntity)
    private readonly tokenRepo: Repository<TokenEntity>,

    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
  ) {}

  // ==========================
  // VALIDATE (usado por LocalStrategy)
  // ==========================

  async validateUser(email: string, password: string): Promise<UserEntity> {
    const user = await this.usersService.findByEmail(email);

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      throw new UnauthorizedException('Credenciales inválidas');

    if (!user.isActive) {
      throw new UnauthorizedException('La cuenta no está activada');
    }

    return user;
  }

  // ==========================
  // LOGIN — access + refresh token
  // ==========================

  async login(
    user: UserEntity,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const access_token = this.generateToken(user);
    const refresh_token = await this.issueRefreshToken(user.id);
    return { access_token, refresh_token };
  }

  // ==========================
  // REFRESH — rotate refresh token
  // ==========================

  async refresh(
    rawToken: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const tokenEntity = await this.findValidRefreshToken(rawToken);

    // Emitir nuevos tokens ANTES de revocar el viejo — si algo falla al emitir,
    // el cliente conserva el token anterior y puede reintentar.
    const user = await this.usersService.findOne(tokenEntity.userId);
    const payload: Payload = { sub: user.id, role: user.role };
    const access_token = this.jwtService.sign(payload);
    const refresh_token = await this.issueRefreshToken(user.id);

    tokenEntity.revokedAt = new Date();
    await this.refreshTokenRepo.save(tokenEntity);

    return { access_token, refresh_token };
  }

  // ==========================
  // LOGOUT — revoke refresh token
  // ==========================

  async logout(rawToken: string): Promise<void> {
    const tokenEntity = await this.findValidRefreshToken(rawToken);
    tokenEntity.revokedAt = new Date();
    await this.refreshTokenRepo.save(tokenEntity);
  }

  // ==========================
  // GENERATE ACCESS TOKEN
  // ==========================

  generateToken(user: UserEntity): string {
    const payload: Payload = {
      sub: user.id,
      role: (user.role?.type as RoleType) ?? null,
    };
    return this.jwtService.sign(payload);
  }

  // ==========================
  // REGISTER
  // ==========================

  async register(dto: CreateUserDto): Promise<void> {
    const user = await this.usersService.create(dto);

    const token = await this.createToken(
      user.id,
      TokenType.ACCOUNT_ACTIVATION,
      24,
    );

    await this.mailService.sendActivationEmail(
      user.email,
      user.profile.name,
      token,
    );
  }

  // ==========================
  // ACTIVATE ACCOUNT
  // ==========================

  async activateAccount(token: string): Promise<void> {
    const tokenEntity = await this.findValidToken(
      token,
      TokenType.ACCOUNT_ACTIVATION,
    );

    const user = await this.usersService.findOne(tokenEntity.userId);
    if (user.isActive)
      throw new BadRequestException('La cuenta ya fue activada');

    await this.usersService.activate(tokenEntity.userId);

    tokenEntity.usedAt = new Date();
    await this.tokenRepo.save(tokenEntity);
  }

  // ==========================
  // FORGOT PASSWORD
  // ==========================

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // no dar pistas si el email existe o no
    if (!user || !user.isActive) return;

    // invalidar tokens previos de reset
    await this.tokenRepo.update(
      { userId: user.id, type: TokenType.PASSWORD_RESET },
      { usedAt: new Date() },
    );

    const token = await this.createToken(user.id, TokenType.PASSWORD_RESET, 1);

    await this.mailService.sendPasswordResetEmail(
      user.email,
      user.profile.name,
      token,
    );
  }

  // ==========================
  // RESET PASSWORD
  // ==========================

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenEntity = await this.findValidToken(
      dto.token,
      TokenType.PASSWORD_RESET,
    );

    await this.usersService.updatePassword(tokenEntity.userId, dto.password);

    await this.tokenRepo.update(
      { userId: tokenEntity.userId, type: TokenType.PASSWORD_RESET },
      { usedAt: new Date() },
    );
  }

  // ==========================
  // CHANGE PASSWORD (authenticated)
  // ==========================

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findEntityWithPassword(userId);

    if (!user) throw new BadRequestException('Usuario no encontrado');

    const passwordMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordMatch)
      throw new BadRequestException('La contraseña actual es incorrecta');

    await this.usersService.updatePassword(userId, dto.newPassword);
  }

  // ==========================
  // LOGOUT ALL DEVICES
  // ==========================

  async logoutAll(userId: number): Promise<void> {
    await this.refreshTokenRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // ==========================
  // PRIVATE — issue refresh token
  // ==========================

  private async issueRefreshToken(userId: number): Promise<string> {
    const raw = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const entity = this.refreshTokenRepo.create({
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });
    await this.refreshTokenRepo.save(entity);

    return raw;
  }

  // ==========================
  // PRIVATE — find and validate refresh token
  // ==========================

  private async findValidRefreshToken(
    rawToken: string,
  ): Promise<RefreshTokenEntity> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const entity = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
    });

    if (!entity) throw new UnauthorizedException('Token de refresco inválido');
    if (entity.isRevoked)
      throw new UnauthorizedException('El token de refresco fue revocado');
    if (entity.isExpired)
      throw new UnauthorizedException('El token de refresco ha expirado');

    return entity;
  }

  // ==========================
  // PRIVATE — crear token de email
  // ==========================

  private async createToken(
    userId: number,
    type: TokenType,
    expiresInHours: number,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const tokenEntity = this.tokenRepo.create({
      token: raw,
      type,
      userId,
      expiresAt,
      usedAt: null,
    });

    await this.tokenRepo.save(tokenEntity);
    return raw;
  }

  // ==========================
  // PRIVATE — validar token de email
  // ==========================

  private async findValidToken(
    raw: string,
    type: TokenType,
  ): Promise<TokenEntity> {
    const tokenEntity = await this.tokenRepo.findOne({
      where: { token: raw, type },
    });

    if (!tokenEntity)
      throw new BadRequestException('Token inválido o expirado');
    if (tokenEntity.isUsed)
      throw new BadRequestException('El token ya fue utilizado');
    if (tokenEntity.isExpired)
      throw new BadRequestException('El token ha expirado');

    return tokenEntity;
  }
}
