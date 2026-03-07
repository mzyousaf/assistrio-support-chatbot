import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(_email: string, _password: string): Promise<{ accessToken: string }> {
    // TODO: validate super-admin credentials (e.g. from DB or env)
    const payload = { sub: 'super-admin', email: _email };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }
}
