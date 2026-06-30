// src/routes/materialWip.report.routes.ts
import { Router } from "express";
import { materialWipReportController } from "./wip-report.controller";

const router = Router();

router.get("/list", materialWipReportController.list);
router.get("/summary", materialWipReportController.summary);
router.get("/trend", materialWipReportController.trend);
router.get("/raw-material-wise", materialWipReportController.rawMaterialWise);
router.get("/product-wise", materialWipReportController.productWise);
router.get("/packaging-wise", materialWipReportController.packagingWise);
router.get("/:id", materialWipReportController.detail);

export default router;