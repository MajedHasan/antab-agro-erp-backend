// src/modules/dealer/ledger/dealer-ledger.routes.ts
import { Router } from "express";
import { dealerLedgerController } from "./dealer-ledger.controller";

const router = Router();

// Full paginated ledger with date/type filters
router.get("/:dealerId/ledger", dealerLedgerController.ledger);

// Summary only
router.get("/:dealerId/summary", dealerLedgerController.summary);

export default router;