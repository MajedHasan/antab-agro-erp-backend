// src/routes/workorder.routes.ts

import { Router } from "express";
import { workOrderController } from "../controllers/workorder.controller";
import { createCrudRouter } from "./crud.routes";

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

    const WorkOrder =
      workOrderController.model || require("../models/workorder.model").default;

    const existing = await WorkOrder.find({ workOrderNo: regex })
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
  } catch (err) {
    next(err);
  }
});

/* =====================================================
   NEW LIFECYCLE ROUTES
===================================================== */

router.post("/:id/approve", workOrderController.approve);
router.post("/:id/cancel", workOrderController.cancel);

/* =====================================================
   CRUD
===================================================== */

router.use("/", createCrudRouter(workOrderController));

export default router;
