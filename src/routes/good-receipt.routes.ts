// src/routes/gr.routes.ts

import { Router } from "express";
import { grController } from "../controllers/good-receipt.controller";
import { createCrudRouter } from "./crud.routes";

const router = Router();

/* =====================================================
   GENERATE GR NUMBER
===================================================== */

router.get("/generate-no", async (req, res, next) => {
  try {
    const GR =
      grController.model || require("../models/good-receipt.model").default;

    const prefix = "GR-";
    const regex = new RegExp(`^${prefix}(\\d+)$`);

    const existing = await GR.find({ grNo: regex })
      .sort({ grNo: -1 })
      .limit(1)
      .lean();

    let nextNumber = 1;

    if (existing.length) {
      const match = existing[0].grNo?.match(regex);
      if (match?.[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    res.json({
      success: true,
      data: `${prefix}${String(nextNumber).padStart(5, "0")}`,
    });
  } catch (err) {
    next(err);
  }
});

/* =====================================================
   LIFECYCLE ROUTES
===================================================== */

// Approve GR
router.post("/:id/approve", grController.approve);

// Reject GR (requires reason in body)
router.post("/:id/reject", grController.reject);

// Add payment (partial / full)
router.post("/:id/pay", grController.addPayment);

// Attach file (expects { fileId })
router.post("/:id/attach-file", grController.attachFile);

/* =====================================================
   STANDARD CRUD ROUTES
===================================================== */

router.use("/", createCrudRouter(grController));

export default router;
