import { createCrudRouter } from "../../routes/crud.routes";
import { stockTransactionController } from "./stockTransaction.controller";
import { Router } from "express";

const router = Router();

// Custom endpoint – must be before the CRUD router
router.get(
  "/latest-unit-cost",
  stockTransactionController.getLatestUnitCost,
);

router.get(
  "/available-batches",
  stockTransactionController.getAvailableBatches,
);
router.get(
  "/batch-history/:batchId",
  stockTransactionController.getBatchHistory,
);

// CRUD router last (so /latest-unit-cost won't be caught as :id)
router.use("/", createCrudRouter(stockTransactionController));

export default router;