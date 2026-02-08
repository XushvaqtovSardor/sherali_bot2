import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface SubscriptionData {
    chatId: string;
    chatType: "private" | "group";
    userId?: number;
    category: string;
    fakultet?: string;
    kurs: string;
    guruh: string;
    url: string;
    time: string;
}

@Injectable()
export class SubscriptionService {
    private readonly logger = new Logger(SubscriptionService.name);

    constructor(private prisma: PrismaService) { }

    async createSubscription(data: SubscriptionData) {
        try {
            // Check if subscription already exists
            await this.prisma.subscription.deleteMany({
                where: {
                    chatId: data.chatId,
                },
            });

            const subscription = await this.prisma.subscription.create({
                data: {
                    chatId: data.chatId,
                    chatType: data.chatType,
                    userId: data.userId,
                    category: data.category,
                    fakultet: data.fakultet,
                    kurs: data.kurs,
                    guruh: data.guruh,
                    url: data.url,
                    time: data.time,
                    isActive: true,
                },
            });

            this.logger.log(`Subscription created for chat ${data.chatId} at ${data.time}`);
            return subscription;
        } catch (error) {
            this.logger.error(`Failed to create subscription: ${error.message}`);
            throw error;
        }
    }

    async getActiveSubscription(chatId: string) {
        return this.prisma.subscription.findFirst({
            where: {
                chatId,
                isActive: true,
            },
        });
    }

    async deleteSubscription(chatId: string) {
        try {
            await this.prisma.subscription.deleteMany({
                where: {
                    chatId,
                },
            });
            this.logger.log(`Subscription deleted for chat ${chatId}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to delete subscription: ${error.message}`);
            return false;
        }
    }

    async getSubscriptionsByTime(time: string) {
        const [hour, minute] = time.split(":");
        const targetTime = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

        return this.prisma.subscription.findMany({
            where: {
                time: targetTime,
                isActive: true,
            },
            include: {
                user: true,
            },
        });
    }

    async getAllActiveSubscriptions() {
        return this.prisma.subscription.findMany({
            where: {
                isActive: true,
            },
            include: {
                user: true,
            },
        });
    }
}
