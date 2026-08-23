import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { InstitutionStatus } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get<string>('SUPABASE_JWT_SECRET');
        const env = configService.get<string>('NODE_ENV');
        if (!secret) {
          if (env === 'production' || env === 'staging') {
            throw new Error(
              'FATAL: SUPABASE_JWT_SECRET environment variable is missing in production/staging mode.',
            );
          }
          return 'dev-only-mock-jwt-secret-key-change-in-prod';
        }
        return secret;
      })(),
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const person = await this.prisma.institutionalPerson.findUnique({
      where: { userId },
      include: {
        studentProfile: true,
        teacherProfile: true,
        authorityProfile: true,
        representativeProfile: true,
        memberships: true,
      },
    });

    if (!person || person.status !== InstitutionStatus.ACTIVE) {
      throw new UnauthorizedException('User account is inactive or not found');
    }

    return {
      id: person.id,
      userId: payload.sub,
      email: payload.email,
      institutionalPerson: person,
      memberships: person.memberships,
    };
  }
}
