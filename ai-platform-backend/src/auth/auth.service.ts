import * as bcrypt from 'bcryptjs';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { User, USER_ROLES, type UserRole } from '../models';
import { WorkspacesService } from '../workspaces/workspaces.service';

export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
}

/** Map legacy platform roles so existing JWTs keep working after enum change. */
function normalizeTokenRole(role: string): UserRole {
  if (role === 'admin' || role === 'viewer') return 'customer';
  if ((USER_ROLES as readonly string[]).includes(role)) return role as UserRole;
  throw new Error('Invalid role in token');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async findUserByEmail(email: string) {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .exec();
  }

  async countUsers(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async createUser(email: string, password: string, role: UserRole) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed)) {
      throw new Error('Invalid email');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const existing = await this.findUserByEmail(trimmed);
    if (existing) {
      throw new Error('User with this email already exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const doc = await this.userModel.create({
      email: trimmed,
      passwordHash,
      role,
    });
    const uid = (doc as unknown as { _id: Types.ObjectId })._id;
    await this.workspacesService.createWorkspaceWithAdminMember(uid);
    return doc;
  }

  signToken(userId: string, role: UserRole): string {
    return this.jwtService.sign(
      { sub: userId, role },
      { expiresIn: '7d' },
    );
  }

  verifyToken(token: string): AuthTokenPayload {
    const decoded = this.jwtService.verify<AuthTokenPayload>(token);
    if (typeof decoded?.sub !== 'string' || !decoded.role) {
      throw new Error('Invalid token claims');
    }
    const role = normalizeTokenRole(decoded.role);
    return { sub: decoded.sub, role };
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.findUserByEmail(email);
    if (!user) return null;
    const u = user as unknown as { passwordHash: string };
    const match = await bcrypt.compare(password, u.passwordHash);
    return match ? (user as unknown as User) : null;
  }

  async getAuthenticatedUser(token: string): Promise<User | null> {
    let payload: AuthTokenPayload;
    try {
      payload = this.verifyToken(token);
    } catch {
      return null;
    }
    const user = await this.userModel.findById(payload.sub).exec();
    if (!user) return null;
    return user as unknown as User;
  }
}
