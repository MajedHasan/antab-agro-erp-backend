// src/routes/statement-of-changes-in-equity.routes.ts
import { Router } from "express";
import { statementOfChangesInEquityController } from "../controllers/statement-of-changes-in-equity.controller";

const router = Router();

// GET /api/reports/statement-of-changes-in-equity?year=2025
router.get(
  "/statement-of-changes-in-equity",
  statementOfChangesInEquityController.view,
);

export default router;
