import { createCrudRouter } from "./crud.routes";
import { promotionController } from "../controllers/product-promotion.controller";
import { Router } from "express";

const router = Router();

// 1️⃣ Custom routes first
router.get("/active", promotionController.active);
router.get("/calculate-bonus", promotionController.calculateBonus);

// 2️⃣ Then attach standard CRUD routes
const crudRouter = createCrudRouter(promotionController);
router.use("/", crudRouter);

export default router;
