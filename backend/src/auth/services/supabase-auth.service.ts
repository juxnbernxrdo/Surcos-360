import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthService {
  private supabaseAdmin: ReturnType<typeof createClient>;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      'https://mock.supabase.co';
    const supabaseServiceKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      'mock-service-role-key';

    this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Creates a user in Supabase Auth via Admin API.
   */
  async createUser(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string }> {
    const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      const errMsg = error?.message || 'Unknown authentication service error';
      if (
        errMsg.toLowerCase().includes('already') ||
        errMsg.toLowerCase().includes('exists') ||
        errMsg.toLowerCase().includes('registered')
      ) {
        throw new ConflictException(
          'An account with this email address already exists.',
        );
      }
      throw new BadRequestException(
        `Unable to create authentication credentials: ${errMsg}`,
      );
    }

    return {
      id: data.user.id,
      email: data.user.email || email,
    };
  }

  /**
   * Signs in a user using email & password against Supabase Auth.
   */
  async signInWithPassword(email: string, password: string) {
    const { data, error } = await this.supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      userId: data.user.id,
    };
  }

  /**
   * Validates user credentials without creating a persistent login session.
   */
  async validateUserCredentials(
    email: string,
    password: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });
      return !error && !!data.user;
    } catch {
      return false;
    }
  }

  /**
   * Refreshes an active session using a Supabase refresh token.
   */
  async refreshSession(refreshToken: string) {
    const { data, error } = await this.supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException(
        'Invalid, expired or revoked refresh token',
      );
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      userId: data.user?.id || data.session.user.id,
    };
  }

  /**
   * Signs out a user by revoking their active JWT session.
   */
  async signOut(jwtToken: string): Promise<void> {
    try {
      await this.supabaseAdmin.auth.admin.signOut(jwtToken);
    } catch {
      // Ignore if token is already expired/invalid
    }
  }

  /**
   * Revokes all active sessions for a given user (Global Logout).
   */
  async signOutAll(userId: string): Promise<void> {
    try {
      await this.supabaseAdmin.auth.admin.signOut(userId, 'global');
    } catch {
      // Ignore if already revoked
    }
  }

  /**
   * Initiates password recovery email trigger via Supabase Auth.
   */
  async resetPasswordForEmail(email: string): Promise<void> {
    try {
      await this.supabaseAdmin.auth.resetPasswordForEmail(email);
    } catch {
      // Keep silent for anti-user enumeration
    }
  }

  /**
   * Updates user password directly in Supabase Auth via Admin API.
   */
  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const { error } = await this.supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword },
    );

    if (error) {
      throw new BadRequestException(
        `Error al actualizar la contraseña: ${error.message}`,
      );
    }
  }

  /**
   * Deletes a user in Supabase Auth (used for transactional rollback compensation).
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await this.supabaseAdmin.auth.admin.deleteUser(userId);
    } catch {
      // Ignore if user deletion fails during emergency cleanup
    }
  }
}
