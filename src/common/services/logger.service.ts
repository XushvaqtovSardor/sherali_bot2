import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class LoggerService {
  private readonly logger = new Logger(LoggerService.name);

  constructor(private prisma: PrismaService) {}

  async log(userId: number | null, action: string, metadata?: any) {
    try {
      await this.prisma.log.create({
        data: {
          userId,
          action,
          metadata: metadata || {},
        },
      });
    } catch (error) {
      this.logger.error("Failed to log action", error);
    }
  }

  async getUserLogs(userId: number, limit = 50) {
    return this.prisma.log.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  }

  async getRecentLogs(limit = 100) {
    return this.prisma.log.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            telegramId: true,
          },
        },
      },
    });
  }
}
