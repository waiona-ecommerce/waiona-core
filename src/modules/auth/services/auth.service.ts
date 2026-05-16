import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { UsersService } from '../../users/services/users.service';
import { UserEntity } from '../../users/entities/user.entity';
import { TokenEntity } from 'src/modules/mail/entities/token.entity';

import { MailService } from 'src/modules/mail/services/mail.service';
import { Payload } from '../models/payload.model';
import { RoleType } from 'src/common/enums/role-type.enum';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { ResetPasswordDto } from 'src/modules/mail/dto/reset-password.dto';
import { TokenType } from 'src/modules/mail/enum/token-type.enum';

@Injectable()
export class AuthService {

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,

    @InjectRepository(TokenEntity)
    private readonly tokenRepo: Repository<TokenEntity>,
  ) {}

  // ==========================
  // VALIDATE (usado por LocalStrategy)
  // ==========================

  async validateUser(email: string, password: string): Promise<UserEntity> {
    const user = await this.usersService.findByEmail(email);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) {
      throw new UnauthorizedException('Account not activated — check your email');
    }

    return user;
  }

  // ==========================
  // GENERATE TOKEN
  // ==========================

  generateToken(user: UserEntity): string {
    const payload: Payload = {
      sub:  user.id,
      role: (user.role?.type as RoleType) ?? null,
    };
    return this.jwtService.sign(payload);
  }

  // ==========================
  // REGISTER
  // ==========================

  async register(dto: CreateUserDto): Promise<void> {
    const user = await this.usersService.create(dto);

    const token = await this.createToken(user.id, TokenType.ACCOUNT_ACTIVATION, 24);

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
    const tokenEntity = await this.findValidToken(token, TokenType.ACCOUNT_ACTIVATION);

    const user = await this.usersService.findOne(tokenEntity.userId);
    if (user.isActive) throw new BadRequestException('Account already activated');

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
    const tokenEntity = await this.findValidToken(dto.token, TokenType.PASSWORD_RESET);

    await this.usersService.updatePassword(tokenEntity.userId, dto.password);

    await this.tokenRepo.update(
      { userId: tokenEntity.userId, type: TokenType.PASSWORD_RESET },
      { usedAt: new Date() },
    );
  }

  // ==========================
  // PRIVATE — crear token
  // ==========================

  private async createToken(
    userId: number,
    type: TokenType,
    expiresInHours: number,
  ): Promise<string> {

    const raw       = randomBytes(32).toString('hex');
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
  // PRIVATE — validar token
  // ==========================

  private async findValidToken(raw: string, type: TokenType): Promise<TokenEntity> {
    const tokenEntity = await this.tokenRepo.findOne({
      where: { token: raw, type },
    });

    if (!tokenEntity) throw new BadRequestException('Invalid or expired token');
    if (tokenEntity.isUsed) throw new BadRequestException('Token already used');
    if (tokenEntity.isExpired) throw new BadRequestException('Token has expired');

    return tokenEntity;
  }
}