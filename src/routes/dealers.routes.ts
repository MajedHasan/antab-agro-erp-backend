// src/routes/dealer.routes.ts
import { Router } from "express";
import { dealerController } from "../controllers/dealer.controller";
import { dealerService } from "../services/dealer.service";

// Create a plain router instead of calling createCrudRouter immediately
const router = Router();

// 1️⃣ Define generate-code route first
router.get("/generate-code", async (req, res, next) => {
  try {
    const { zone, region, area, territory } = req.query;
    const code = await dealerService.generateCode({
      zone: zone as string | undefined,
      region: region as string | undefined,
      area: area as string | undefined,
      territory: territory as string | undefined,
    });
    res.json({ success: true, data: code });
  } catch (err) {
    next(err);
  }
});

// 2️⃣ Attach the standard CRUD routes **after** generate-code
import { createCrudRouter } from "./crud.routes";
const crudRouter = createCrudRouter(dealerController);
router.use("/", crudRouter);

export default router;
