import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, Logger } from "@nestjs/common";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

const logger = new Logger("Bootstrap");

async function bootstrap() {
  try {

    const app = await NestFactory.create(AppModule, {
      logger: ["error", "warn", "log", "debug", "verbose"],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    const domain = process.env.DOMAIN || "http://localhost";
    const port = process.env.PORT || 3010;


    app.enableCors({
      origin: ["http://localhost:5173", "http://localhost:3000", domain],
      credentials: true,
    });
    app.enableShutdownHooks();
    await app.listen(port, "0.0.0.0");
    process.on("SIGTERM", async () => {
      await app.close();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      await app.close();
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
