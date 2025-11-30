import { Injectable } from "@nestjs/common";
import { UserService } from "../bot/services/user.service";
import { CacheService } from "../screenshot/cache.service";
import { LoggerService } from "../common/services/logger.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AdminService {
  constructor(
    private userService: UserService,
    private cacheService: CacheService,
    private loggerService: LoggerService,
    private prisma: PrismaService,
    private configService: ConfigService
  ) {}

  async getUsers(filters?: {
    fakultet?: string;
    kurs?: string;
    guruh?: string;
  }) {
    if (filters && (filters.fakultet || filters.kurs || filters.guruh)) {
      return this.userService.getUsersWithFilters(filters);
    }
    return this.userService.getAllUsers();
  }

  async getUserStats() {
    return this.userService.getUserStats();
  }

  async getCache() {
    return this.cacheService.getAllCached();
  }

  async getLogs(limit = 100) {
    return this.loggerService.getRecentLogs(limit);
  }

  async getSettings() {
    const settings = await this.prisma.settings.findMany();

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    return {
      screenshotCacheDuration:
        settingsMap["screenshot_cache_duration"] ||
        this.configService.get<string>("SCREENSHOT_CACHE_DURATION"),
      puppeteerConcurrency:
        settingsMap["puppeteer_concurrency"] ||
        this.configService.get<string>("PUPPETEER_CONCURRENCY"),
      screenshotQuality:
        settingsMap["screenshot_quality"] ||
        this.configService.get<string>("SCREENSHOT_QUALITY"),
    };
  }

  async updateSetting(key: string, value: string) {
    return this.prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getDashboardStats() {
    const userStats = await this.getUserStats();
    const cacheCount = await this.prisma.jadvalCache.count();
    const recentLogs = await this.loggerService.getRecentLogs(10);

    return {
      users: userStats,
      cacheCount,
      recentLogs,
    };
  }
}
