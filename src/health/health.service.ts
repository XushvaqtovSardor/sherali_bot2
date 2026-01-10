import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private startTime = Date.now();

  constructor(private prismaService: PrismaService) {}

  async check() {
    const status = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };

    this.logger.log(`✅ Health check: ${JSON.stringify(status)}`);
    return status;
  }

  async getDetailedStatus() {
    const status: any = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {},
    };

    // Check Database
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      status.services.database = {
        status: "connected",
        type: "PostgreSQL",
      };
      this.logger.log("✅ Database: Connected");
    } catch (error) {
      status.services.database = {
        status: "disconnected",
        error: error.message,
      };
      status.status = "degraded";
      this.logger.error(`❌ Database: ${error.message}`);
    }

    // Environment info
    status.environment = {
      nodeEnv: process.env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
      port: process.env.PORT || 4010,
    };

    this.logger.log(`📊 Detailed status: ${JSON.stringify(status)}`);
    return status;
  }
}
