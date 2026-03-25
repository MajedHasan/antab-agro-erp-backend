import { Router } from "express";
import { statementOfProfitLossController } from "../controllers/statement-of-profit-loss.controller";

const router = Router();

router.get("/statement-of-profit-loss", statementOfProfitLossController.view);

export default router;
