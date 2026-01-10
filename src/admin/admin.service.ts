import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../screenshot/cache.service";
import { BotService } from "../bot/bot.service";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private botService: BotService
  ) {}

  async getDashboardStats() {
    const totalUsers = await this.prisma.user.count();
    const activeUsers = await this.prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });
    const cacheCount = await this.prisma.jadvalCache.count();

    return {
      totalUsers,
      activeUsers,
      cacheCount,
    };
  }

  async getUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async broadcast(message: string) {
    const users = await this.prisma.user.findMany();
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        await this.botService.sendMessage(user.telegramId.toString(), message);
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    return {
      success: true,
      totalUsers: users.length,
      successCount,
      failCount,
    };
  }

  async clearCache() {
    const count = await this.cacheService.clearAllCache();
    return { success: true, deletedCount: count };
  }

  async getAdmins() {
    return this.prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async addAdmin(telegramId: string, username: string) {
    return this.prisma.admin.create({
      data: {
        telegramId,
        username,
      },
    });
  }

  async removeAdmin(id: string) {
    return this.prisma.admin.delete({
      where: { id },
    });
  }
}
