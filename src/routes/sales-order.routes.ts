// src/routes/sales-order.routes.ts

import { Router } from "express";
import { createCrudRouter } from "./crud.routes";
import { salesOrderController } from "../controllers/sales-order.controller";

const router = Router();

/* =====================================================
   SALES ORDER WORKFLOW ROUTES
===================================================== */

/* ---------- APPROVAL FLOW ---------- */

// Approve (A.M → R.M → N.S.M)
router.post("/:id/approve", salesOrderController.approve);

// Reject (any approval stage)
router.post("/:id/reject", salesOrderController.reject);

/* ---------- SHIPPING FLOW ---------- */

// Ship → Generate invoice + QR + printable payload
router.post("/:id/ship", salesOrderController.ship);

/* ---------- PRINT FLOW ---------- */

// Get printable invoice (QR IMAGE + signature box)
router.get("/:id/print", salesOrderController.getPrintableInvoice);

/* ---------- DELIVERY FLOW ---------- */

// Deliver → Upload signed invoice → QR + Signature verification + stock deduction
router.post("/:id/deliver", salesOrderController.deliver);

/* ---------- CANCEL ---------- */

router.post("/:id/cancel", salesOrderController.cancel);

/* ---------- DELIVERY CHALAN (DC) ---------- */

// Upload DC (optional) – no complex verification, just stores media reference
router.post("/:id/upload-dc", salesOrderController.uploadDc);

/* =====================================================
   STANDARD CRUD ROUTES
===================================================== */

const crudRouter = createCrudRouter(salesOrderController);
router.use("/", crudRouter);

export default router;