import { Controller, Get, Logger } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("api")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  @Get("health")
  async health() {
    this.logger.log("🏥 Health check endpoint called");
    return this.healthService.check();
  }

  @Get("status")
  async status() {
    this.logger.log("📊 Status endpoint called");
    return this.healthService.getDetailedStatus();
  }
}
