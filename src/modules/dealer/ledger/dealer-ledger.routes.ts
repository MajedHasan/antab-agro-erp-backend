// src/routes/dealer-ledger.routes.ts
import { Router } from "express";
import { dealerLedgerController } from "./dealer-ledger.controller";

const router = Router();

// Get full paginated ledger for a dealer (with optional date/type filters)
router.get("/:dealerId/ledger", dealerLedgerController.ledger);

// Get only summary (quick stats – opening balance, totals, closing balance)
router.get("/:dealerId/summary", dealerLedgerController.summary);

export default router;