import { Router } from "express";
import { moDashboardReportController } from "./moDashboardReport.controller";

const router = Router();

router.get(
  "/mo/dashboard-report/:userId",
  moDashboardReportController.getMoDashboardReport,
);

export default router;
