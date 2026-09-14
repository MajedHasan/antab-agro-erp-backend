import mongoose from "mongoose";
import app from "./app";
import config from "./config";
import logger from "./utils/logger";
import seed from "./scripts/seedRoles";
import seedRoles from "./scripts/seedRoles";
import seedPermissions from "./scripts/seedPermissions";

const port = config.port || 5001;

async function bootstrap() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info("Connected to MongoDB");

     // RBAC must be seeded in this order.
    await seedPermissions();
    await seedRoles();

    const server = app.listen(port, () => {
      logger.info(`Server listening on port ${port}`);
    });

    process.on("SIGINT", async () => {
      logger.info("SIGINT received. Shutting down gracefully...");
      await mongoose.disconnect();
      server.close(() => {
        logger.info("Server closed");
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error("Failed to start", err);
    process.exit(1);
  }
}

bootstrap();
