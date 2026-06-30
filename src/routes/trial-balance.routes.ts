import { Router } from "express";
import { trialBalanceController } from "../controllers/trial-balance.controller";

const router = Router();

router.get("/", trialBalanceController.view);

export default router;