// src/routes/dealer.routes.ts
import { Router } from "express";
import { dealerController } from "../controllers/dealer.controller";
import { dealerService } from "../services/dealer.service";
import { createCrudRouter } from "./crud.routes";

const router = Router();

/* =====================================================
   1️⃣ Generate Dealer Code
===================================================== */
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

/* =====================================================
   2️⃣ Auto Create Account for Dealer
===================================================== */
router.post("/:id/auto-account", dealerController.autoAccount);

/* =====================================================
   3️⃣ Sync Dealer Name → Account Name
===================================================== */
router.post("/:id/sync-account-name", dealerController.syncAccountName);

/* =====================================================
   4️⃣ Standard CRUD Routes
===================================================== */

const crudRouter = createCrudRouter(dealerController);
router.use("/", crudRouter);

export default router;
