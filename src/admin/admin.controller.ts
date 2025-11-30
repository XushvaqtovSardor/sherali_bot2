import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UnauthorizedException,
  Param,
} from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { BotService } from "../bot/bot.service";
import { ScreenshotService } from "../screenshot/screenshot.service";

@Controller("api/admin")
export class AdminController {
  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private botService: BotService,
    private screenshotService: ScreenshotService
  ) {}

  @Post("login")
  async login(@Body() body: { password: string }) {
    const result = await this.authService.login(body.password);

    if (!result) {
      throw new UnauthorizedException("Invalid password");
    }

    return result;
  }

  @Get("verify")
  @UseGuards(JwtAuthGuard)
  async verify() {
    return { valid: true };
  }

  @Get("stats")
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get("users")
  @UseGuards(JwtAuthGuard)
  async getUsers(
    @Query("fakultet") fakultet?: string,
    @Query("kurs") kurs?: string,
    @Query("guruh") guruh?: string
  ) {
    return this.adminService.getUsers({ fakultet, kurs, guruh });
  }

  @Get("cache")
  @UseGuards(JwtAuthGuard)
  async getCache() {
    return this.adminService.getCache();
  }

  @Get("logs")
  @UseGuards(JwtAuthGuard)
  async getLogs(@Query("limit") limit?: string) {
    return this.adminService.getLogs(limit ? parseInt(limit) : 100);
  }

  @Get("settings")
  @UseGuards(JwtAuthGuard)
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Post("settings")
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Body() body: { key: string; value: string }) {
    return this.adminService.updateSetting(body.key, body.value);
  }

  @Post("broadcast")
  @UseGuards(JwtAuthGuard)
  async broadcast(@Body() body: { message: string }) {
    // Broadcast functionality temporarily disabled
    return {
      success: false,
      message: "Broadcast not available in new version",
    };
  }

  @Post("refresh-screenshot")
  @UseGuards(JwtAuthGuard)
  async refreshScreenshot(@Body() body: { url: string; cacheKey: string }) {
    const path = await this.screenshotService.forceRefresh(
      body.url,
      body.cacheKey
    );
    return { path };
  }
}
