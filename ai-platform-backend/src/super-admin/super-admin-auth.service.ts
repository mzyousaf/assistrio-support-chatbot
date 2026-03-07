import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SuperAdminUser } from '../models';

export interface SuperAdminTokenPayload {
  sub: string;
  role: 'superadmin';
}

@Injectable()
export class SuperAdminAuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(SuperAdminUser.name) private readonly superAdminModel: Model<SuperAdminUser>,
  ) {}

  async findSuperAdminByEmail(email: string) {
    return this.superAdminModel
      .findOne({ email: email.trim().toLowerCase() })
      .exec();
  }

  async countSuperAdmins(): Promise<number> {
    return this.superAdminModel.countDocuments().exec();
  }

  async createSuperAdmin(email: string, password: string) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed)) {
      throw new Error('Invalid email');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const existing = await this.findSuperAdminByEmail(trimmed);
    if (existing) {
      throw new Error('Super admin with this email already exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const doc = await this.superAdminModel.create({
      email: trimmed,
      passwordHash,
      role: 'superadmin',
    });
    return doc;
  }

  signToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, role: 'superadmin' },
      { expiresIn: '7d' },
    );
  }

  verifyToken(token: string): SuperAdminTokenPayload {
    const decoded = this.jwtService.verify<SuperAdminTokenPayload>(token);
    if (typeof decoded?.sub !== 'string' || decoded.role !== 'superadmin') {
      throw new Error('Invalid super admin token claims');
    }
    return decoded;
  }

  async validateCredentials(email: string, password: string): Promise<SuperAdminUser | null> {
    const user = await this.findSuperAdminByEmail(email);
    if (!user) return null;
    const match = await bcrypt.compare(password, (user as { passwordHash: string }).passwordHash);
    return match ? (user as unknown as SuperAdminUser) : null;
  }

  async getAuthenticatedUser(token: string): Promise<SuperAdminUser | null> {
    let payload: SuperAdminTokenPayload;
    try {
      payload = this.verifyToken(token);
    } catch {
      return null;
    }
    const user = await this.superAdminModel.findById(payload.sub).exec();
    if (!user || (user as { role?: string }).role !== 'superadmin') return null;
    return user as unknown as SuperAdminUser;
  }
}
