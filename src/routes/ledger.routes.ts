import { Router } from "express";
import { ledgerController } from "../controllers/ledger.controller";

const router = Router();

// GET /api/ledger/accounts
router.get("/accounts", ledgerController.listAccounts);

// GET /api/ledger/:accountId/transactions
// Query params: from, to, type, status, search, sortBy, sortDir, limit, skip
router.get("/:accountId/transactions", ledgerController.transactions);

// GET /api/ledger/:accountId/summary
// Query params: from, to
router.get("/:accountId/summary", ledgerController.summary);

export default router;
