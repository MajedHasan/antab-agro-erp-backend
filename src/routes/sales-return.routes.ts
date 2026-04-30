// src/routes/sales-return.routes.ts

import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { salesReturnController } from "../controllers/sales-return.controller";

const router = Router();

/* ===============================
   SALES RETURN WORKFLOW ROUTES
================================ */

/* ---------- APPROVAL FLOW ---------- */
router.post("/:id/approve", salesReturnController.approve);
router.post("/:id/reject", salesReturnController.reject);

/* ---------- HOLD / RESOLVE ---------- */
router.post("/:id/hold", salesReturnController.hold);
router.post("/:id/resolve-hold", salesReturnController.resolveHold);

/* ---------- PRINT FLOW ---------- */
router.post("/:id/printed", salesReturnController.markPrinted);
router.get("/:id/print", salesReturnController.getPrintableReturnData);

/* ---------- SUBMIT TO WAREHOUSE ---------- */
router.post("/:id/send-to-warehouse", salesReturnController.sendToWarehouse);

/* ---------- WAREHOUSE RECEIVING ---------- */
router.post("/:id/warehouse-receive", salesReturnController.warehouseReceive);

/* ---------- COMPLETE ---------- */
router.post("/:id/complete", salesReturnController.complete);

/* ---------- CANCEL ---------- */
router.post("/:id/cancel", salesReturnController.cancel);

/* ===============================
   STANDARD CRUD ROUTES
================================ */

const crudRouter = createCrudRouter(salesReturnController);
router.use("/", crudRouter);

export default router;
