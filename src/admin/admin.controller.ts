import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UnauthorizedException,
  Headers,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { ConfigService } from "@nestjs/config";

@Controller("api/admin")
export class AdminController {
  private readonly adminPassword: string;

  constructor(
    private adminService: AdminService,
    private configService: ConfigService
  ) {
    this.adminPassword = this.configService.get<string>("ADMIN_PASSWORD");
  }

  private checkAuth(password: string) {
    if (password !== this.adminPassword) {
      throw new UnauthorizedException("Invalid password");
    }
  }

  @Post("login")
  async login(@Body() body: { password: string }) {
    this.checkAuth(body.password);
    return { success: true, message: "Login successful" };
  }

  @Get("stats")
  async getStats(@Headers("x-admin-password") password: string) {
    this.checkAuth(password);
    return this.adminService.getDashboardStats();
  }

  @Get("users")
  async getUsers(@Headers("x-admin-password") password: string) {
    this.checkAuth(password);
    return this.adminService.getUsers();
  }

  @Post("broadcast")
  async broadcast(
    @Headers("x-admin-password") password: string,
    @Body() body: { message: string }
  ) {
    this.checkAuth(password);
    return this.adminService.broadcast(body.message);
  }

  @Post("cache/clear")
  async clearCache(@Headers("x-admin-password") password: string) {
    this.checkAuth(password);
    return this.adminService.clearCache();
  }

  @Get("admins")
  async getAdmins(@Headers("x-admin-password") password: string) {
    this.checkAuth(password);
    return this.adminService.getAdmins();
  }

  @Post("admins")
  async addAdmin(
    @Headers("x-admin-password") password: string,
    @Body() body: { telegramId: string; username: string }
  ) {
    this.checkAuth(password);
    return this.adminService.addAdmin(body.telegramId, body.username);
  }

  @Delete("admins/:id")
  async removeAdmin(
    @Headers("x-admin-password") password: string,
    @Param("id") id: string
  ) {
    this.checkAuth(password);
    return this.adminService.removeAdmin(id);
  }
}
