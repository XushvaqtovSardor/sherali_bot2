import { Controller, Get, Head } from "@nestjs/common";

@Controller("api/health")
export class HealthController {
  @Get()
  @Head()
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
