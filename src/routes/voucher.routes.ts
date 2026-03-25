// src/routes/voucher.routes.ts

import { Router } from "express";
import { voucherController } from "../controllers/voucher.controller";

const router = Router();

/* =========================================================
   Helper
========================================================= */

// Export should come BEFORE :id to avoid route conflict
router.get("/export", voucherController.exportCSV);

/* =========================================================
   Standard CRUD
========================================================= */

router.get("/", voucherController.list);

router.get("/:id", voucherController.get);
router.post("/", voucherController.create);
router.put("/:id", voucherController.update);
router.delete("/:id", voucherController.remove);

/* =========================================================
   Workflow
   (Only Approval Flow)
========================================================= */

// Pending → Approved
router.post("/:id/approve", voucherController.approve);

// Pending → Rejected
router.post("/:id/reject", voucherController.reject);

/* =========================================================
   Helper Voucher Types
========================================================= */

router.post("/journal", voucherController.journal);
router.post("/contra", voucherController.contra);

router.post(
  "/cash-receive",
  voucherController.simplePaymentOrReceive("CashReceive"),
);

router.post(
  "/bank-receive",
  voucherController.simplePaymentOrReceive("BankReceive"),
);

router.post(
  "/cash-payment",
  voucherController.simplePaymentOrReceive("CashPayment"),
);

router.post(
  "/bank-payment",
  voucherController.simplePaymentOrReceive("BankPayment"),
);

export default router;
