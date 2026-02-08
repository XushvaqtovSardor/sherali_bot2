import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BotService } from "../bot/bot.service";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
  ) { }

  async isAdmin(telegramId: number): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { telegramId: telegramId.toString() },
    });
    return !!admin;
  }

  async addAdmin(telegramId: number | string, username: string): Promise<boolean> {
    try {
      await this.prisma.admin.create({
        data: {
          telegramId: telegramId.toString(),
          username: username || "unknown",
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async removeAdmin(telegramId: number | string): Promise<boolean> {
    try {
      await this.prisma.admin.delete({
        where: { telegramId: telegramId.toString() },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async listAdmins() {
    return this.prisma.admin.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async getAdmins() {
    return this.listAdmins();
  }

  async getDashboardStats() {
    const totalUsers = await this.prisma.user.count();
    const activeUsers = await this.prisma.user.count({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    return {
      totalUsers,
      activeUsers,
    };
  }

  async getUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async broadcast(message: string) {
    // This will be called from bot service
    return {
      success: true,
      message: "Use /broadcast command in Telegram bot",
    };
  }

  async clearCache() {
    // Cache is removed, return success
    return {
      success: true,
      message: "Cache functionality has been removed",
    };
  }
}
