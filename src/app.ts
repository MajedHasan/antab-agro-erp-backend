import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import express from "express";
import logger from "./utils/logger";
import compression from "compression";
import path from "path";

import rateLimit from "express-rate-limit";
import { errorHandler } from "./middlewares/error.middleware";

import authRoutes from "./routes/auth.routes";
import roleRoutes from "./routes/roles.routes";
import permissionRoutes from "./routes/permissions.routes";
import userRoutes from "./routes/user.routes";
import zonesRoutes from "./routes/zones.routes";
import regionsRoutes from "./routes/regions.routes";
import areasRoutes from "./routes/areas.routes";
import territoriesRoutes from "./routes/territories.routes";
import dealersRoutes from "./routes/dealers.routes";
import warehouseRoutes from "./routes/warehouse.routes";
import productsRoutes from "./routes/product.routes";
import workordersRoutes from "./routes/workorder.routes";
import userLocationAccessRoutes from "./routes/userLocationAccess.routes";
import supplier from "./routes/supplier.routes";

import classroomRoutes from "./routes/classroom.routes";
import mediaRoutes from "./routes/media.routes";
// import uploadRouter from "./routes/upload.routes";

const app = express();

// app.use(express.static("uploads"));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // your frontend dev URL
    credentials: true, // allow cookies/authorization headers
  })
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan("combined", { stream: { write: (s) => logger.info(s.trim()) } })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});
app.use(limiter);
// app.use("/api/uploads", uploadRouter);
app.use("/api/media", mediaRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/zones", zonesRoutes);
app.use("/api/regions", regionsRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/territories", territoriesRoutes);
app.use("/api/dealers", dealersRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/workorders", workordersRoutes);
app.use("/api/user-location-access", userLocationAccessRoutes);
app.use("/api/supplier", supplier);

app.use("/api/classrooms", classroomRoutes);

app.get("/", (req, res) => res.json({ status: "ok", version: "1.0.0" }));

app.use(errorHandler);

export default app;
