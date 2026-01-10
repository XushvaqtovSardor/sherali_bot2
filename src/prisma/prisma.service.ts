import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      this.logger.log("========================================");
      this.logger.log("📦 Connecting to PostgreSQL database...");

      await this.$connect();

      this.logger.log("✅ PostgreSQL connected successfully");

      // Test the connection
      const result = await this.$queryRaw`SELECT NOW()`;
      this.logger.log(`✓ Database time check: ${JSON.stringify(result)}`);

      this.logger.log("========================================");
    } catch (error) {
      this.logger.error("========================================");
      this.logger.error("❌ Failed to connect to PostgreSQL!");
      this.logger.error(`Error: ${error.message}`);
      this.logger.error(`Code: ${error.code}`);
      this.logger.error("========================================");
      this.logger.error("Possible causes:");
      this.logger.error("1. Database is not running");
      this.logger.error("2. Wrong DATABASE_URL configuration");
      this.logger.error("3. Network connection issues");
      this.logger.error("4. Database credentials are incorrect");
      this.logger.error("========================================");
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log("📦 Disconnecting from PostgreSQL...");
    await this.$disconnect();
    this.logger.log("✓ PostgreSQL disconnected");
  }
}
