// src/routes/warehouse-transfer.routes.ts

import { Router } from "express";
import { warehouseTransferController } from "../controllers/warehouse-transfer.controller";
import { createCrudRouter } from "./crud.routes";

const router = Router();

/* ==========================================================
   CUSTOM WORKFLOW ROUTES
========================================================== */

// Receive transfer
router.post("/:id/receive", warehouseTransferController.receive);

// Final approval
router.post("/:id/final-approve", warehouseTransferController.finalApprove);

// Cancel transfer
router.post("/:id/cancel", warehouseTransferController.cancel);

/* ==========================================================
   CRUD ROUTES (list, get, create, update, delete)
========================================================== */

const crudRouter = createCrudRouter(warehouseTransferController);
router.use("/", crudRouter);

export default router;
