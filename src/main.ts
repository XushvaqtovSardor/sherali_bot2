import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

const logger = new Logger("Bootstrap");

async function bootstrap() {
  try {
    logger.log("🚀 Starting application...");

    const app = await NestFactory.create(AppModule, {
      logger: ["error", "warn", "log", "debug", "verbose"],
    });

    logger.log("✓ NestJS application created");

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    // Get domain and port from environment
    const domain = process.env.DOMAIN || "http://localhost";
    const port = process.env.PORT || 4010;

    logger.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    logger.log(`Port: ${port}`);
    logger.log(`Domain: ${domain}`);

    app.enableCors({
      origin: ["http://localhost:5173", "http://localhost:3000", domain],
      credentials: true,
    });

    logger.log("✓ CORS enabled");

    // Enable graceful shutdown
    app.enableShutdownHooks();
    logger.log("✓ Shutdown hooks enabled");

    await app.listen(port, "0.0.0.0");

    logger.log("═══════════════════════════════════════");
    logger.log(`✓ Application is running on: ${domain}:${port}`);
    logger.log(`✓ Health check: ${domain}:${port}/api/health`);
    logger.log("═══════════════════════════════════════");

    // Handle process termination
    process.on("SIGTERM", async () => {
      logger.warn("⚠ SIGTERM signal received: closing application");
      await app.close();
      logger.log("✓ Application closed gracefully");
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.warn("⚠ SIGINT signal received: closing application");
      await app.close();
      logger.log("✓ Application closed gracefully");
      process.exit(0);
    });
  } catch (error) {
    logger.error("💥 Failed to start application");
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

bootstrap();

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("💥 Unhandled Promise Rejection");
  logger.error(`Reason: ${reason}`);
  logger.error(`Promise: ${promise}`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("💥 Uncaught Exception");
  logger.error(`Error: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
  process.exit(1);
});
