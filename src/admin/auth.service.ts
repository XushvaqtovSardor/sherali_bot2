import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async validatePassword(password: string): Promise<boolean> {
    const adminPassword = this.configService.get<string>("ADMIN_PASSWORD");
    return password === adminPassword;
  }

  async login(password: string): Promise<{ access_token: string } | null> {
    const isValid = await this.validatePassword(password);

    if (!isValid) {
      return null;
    }

    const payload = { sub: "admin", role: "admin" };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async verify(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      return null;
    }
  }
}
