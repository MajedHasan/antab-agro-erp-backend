// src/routes/warehouse-transfer.routes.ts
import { Router } from "express";
import { warehouseTransferController } from "../controllers/warehouse-transfer.controller";
import { createCrudRouter } from "./crud.routes";

const router = Router();

/* ==========================================================
   WORKFLOW ROUTES
========================================================== */

router.post(
  "/:id/receiver-nsm-approve",
  warehouseTransferController.receiverNSMApprove,
);

router.post("/:id/sender-review", warehouseTransferController.senderReview);

router.post(
  "/:id/sender-nsm-approve",
  warehouseTransferController.senderNSMApprove,
);

router.post(
  "/:id/print-snapshot",
  warehouseTransferController.generatePrintSnapshot,
);

router.post("/:id/dispatch", warehouseTransferController.dispatch);
router.post("/:id/receive", warehouseTransferController.receive);

// New workflow endpoints
router.post("/:id/complete-received", warehouseTransferController.completeReceived);
router.post("/:id/reverse-remaining", warehouseTransferController.reverseRemaining);
router.post("/:id/damage-remaining", warehouseTransferController.damageRemaining);
router.post("/:id/add-more-received", warehouseTransferController.addMoreReceived);

/* ==========================================================
   CRUD ROUTES
========================================================== */

router.use("/", createCrudRouter(warehouseTransferController));

export default router;