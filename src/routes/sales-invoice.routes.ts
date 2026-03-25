import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { salesInvoiceController } from "../controllers/sales-invoice.controller";

const router = Router();

/* ===============================
   Custom Invoice Routes
================================ */

// Add payment
router.post("/:id/pay", salesInvoiceController.addPayment);

// Cancel invoice
router.post("/:id/cancel", salesInvoiceController.cancel);

/* ===============================
   Attach Standard CRUD Routes
================================ */

const crudRouter = createCrudRouter(salesInvoiceController);
router.use("/", crudRouter);

export default router;
