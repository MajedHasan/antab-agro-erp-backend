import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { salesOrderController } from "../controllers/sales-order.controller";

const router = Router();

/* ===============================
   Custom Workflow Routes
================================ */

// Approve order
router.post("/:id/approve", salesOrderController.approve);

// Ship order
router.post("/:id/ship", salesOrderController.ship);

// Deliver order (creates invoice automatically)
router.post("/:id/deliver", salesOrderController.deliver);

/* ===============================
   Attach Standard CRUD Routes
================================ */

const crudRouter = createCrudRouter(salesOrderController);
router.use("/", crudRouter);

export default router;
