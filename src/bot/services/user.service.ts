import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface CreateUserDto {
  telegramId: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  language?: string;
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createOrUpdateUser(data: CreateUserDto) {
    return this.prisma.user.upsert({
      where: { telegramId: BigInt(data.telegramId) },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
      },
      create: {
        telegramId: BigInt(data.telegramId),
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        
      },
    });
  }

  async findByTelegramId(telegramId: number) {
    return this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
  }

  async updateUserChoice(
    userId: number,
    choice: {
      category?: string;
      fakultet?: string;
      kurs: string;
      guruh: string;
      url?: string;
    }
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        lastChoice: choice,
      },
    });
  }

  async updateUserLanguage(userId: number, language: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        language,
      },
    });
  }

  async createChoice(
    userId: number,
    fakultet: string,
    kurs: string,
    guruh: string
  ) {
    return this.prisma.choice.create({
      data: {
        userId,
        fakultet,
        kurs,
        guruh,
      },
    });
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async getUsersWithFilters(filters: {
    fakultet?: string;
    kurs?: string;
    guruh?: string;
  }) {
    if (!filters.fakultet && !filters.kurs && !filters.guruh) {
      return this.prisma.user.findMany({
        include: {
          choices: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
    }

    return this.prisma.user.findMany({
      where: {
        AND: [
          filters.fakultet
            ? {
                lastChoice: {
                  path: ["fakultet"],
                  equals: filters.fakultet,
                },
              }
            : {},
          filters.kurs
            ? {
                lastChoice: {
                  path: ["kurs"],
                  equals: filters.kurs,
                },
              }
            : {},
          filters.guruh
            ? {
                lastChoice: {
                  path: ["guruh"],
                  equals: filters.guruh,
                },
              }
            : {},
        ],
      },
      include: {
        choices: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async getUserStats() {
    const totalUsers = await this.prisma.user.count();
    const usersToday = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    });
    const usersThisWeek = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      total: totalUsers,
      today: usersToday,
      thisWeek: usersThisWeek,
    };
  }
}
