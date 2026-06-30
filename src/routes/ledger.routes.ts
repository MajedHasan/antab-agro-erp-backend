// src/routes/ledger.routes.ts
import { Router } from "express";
import { ledgerController } from "../controllers/ledger.controller";

const router = Router();

router.get("/accounts", ledgerController.listAccounts);

router.get("/:accountId/transactions", ledgerController.transactions);

router.get("/:accountId/summary", ledgerController.summary);

export default router;