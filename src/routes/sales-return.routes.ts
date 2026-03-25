import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { salesReturnController } from "../controllers/sales-return.controller";

const router = Router();

/* ===============================
   Custom Return Workflow Routes
================================ */

// Approve return
router.post("/:id/approve", salesReturnController.approve);

// Complete return (warehouse received)
router.post("/:id/complete", salesReturnController.complete);

/* ===============================
   Attach Standard CRUD Routes
================================ */

const crudRouter = createCrudRouter(salesReturnController);
router.use("/", crudRouter);

export default router;
