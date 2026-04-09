// src/routes/workorder.routes.ts

import { Router } from "express";
import { workOrderController } from "../controllers/workorder.controller";
import { createCrudRouter } from "./crud.routes";
import WorkOrderModel from "../models/workorder.model";
// import { requireAuth } from "../middlewares/auth.middleware"; // ✅ enable if needed

const router = Router();

/* =====================================================
   GENERATE WORK ORDER NO
===================================================== */
router.get("/generate-no", async (req, res, next) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const prefix = `WO-${year}${month}-`;
    const regex = new RegExp(`^${prefix}(\\d+)$`);

    const existing = await WorkOrderModel.find({ workOrderNo: regex })
      .sort({ workOrderNo: -1 })
      .limit(1)
      .lean();

    let nextNumber = 1;

    if (existing.length) {
      const match = existing[0].workOrderNo?.match(regex);
      if (match?.[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    res.json({
      success: true,
      data: `${prefix}${String(nextNumber).padStart(4, "0")}`,
    });
  } catch (error) {
    next(error);
  }
});

/* =====================================================
   WORKFLOW / STATUS ROUTES
   (Order matters: keep BEFORE CRUD router)
===================================================== */

// router.use(requireAuth); // 🔐 recommended

router.post("/:id/processing", workOrderController.moveToProcessing);

router.post("/:id/review", workOrderController.moveToUnderReview);

router.post("/:id/approve", workOrderController.approve);

router.post("/:id/complete", workOrderController.markCompleted);

router.post("/:id/cancel", workOrderController.cancel);

/* =====================================================
   OPTIONAL FLEXIBLE STATUS (ADMIN USE)
===================================================== */
router.post("/:id/status", workOrderController.setStatus);

/* =====================================================
   CRUD ROUTES
===================================================== */
router.use("/", createCrudRouter(workOrderController));

export default router;
