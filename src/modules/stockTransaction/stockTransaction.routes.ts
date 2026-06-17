import { createCrudRouter } from "../../routes/crud.routes";
import { stockTransactionController } from "./stockTransaction.controller";
import { Router } from "express";

const router = createCrudRouter(stockTransactionController);

// Extra endpoints
router.get(
  "/available-batches",
  stockTransactionController.getAvailableBatches,
);
router.get(
  "/batch-history/:batchId",
  stockTransactionController.getBatchHistory,
);

export default router;
