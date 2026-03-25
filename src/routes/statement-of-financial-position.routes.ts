import { Router } from "express";
import { statementOfFinancialPositionController } from "../controllers/statement-of-financial-position.controller";

const router = Router();

router.get(
  "/statement-of-financial-position",
  statementOfFinancialPositionController.view,
);

export default router;
