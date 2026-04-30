import { Router } from "express";
import { createCrudRouter } from "../../routes/crud.routes";
import { tadaEntryController } from "./tadaEntry.controller";
import { tadaMonthlySheetController } from "./tadaMonthlySheet.controller";
import { tadaRateController } from "./tadaRate.controller";

const router = Router();

/* =====================================================
   ENTRY ROUTES
===================================================== */
const entryRouter = Router();

entryRouter.post("/submit", tadaEntryController.submitDailyEntry);
entryRouter.get("/my", tadaEntryController.getMyEntries);
entryRouter.put("/:id/edit", tadaEntryController.editEntry);
entryRouter.use("/", createCrudRouter(tadaEntryController));

/* =====================================================
   SHEET ROUTES
===================================================== */
const sheetRouter = Router();

sheetRouter.get("/overview", tadaMonthlySheetController.getMyMonthlyOverview);
sheetRouter.get("/team", tadaMonthlySheetController.getTeamSheets);
sheetRouter.get("/:id/full", tadaMonthlySheetController.getSheetWithEntries);
sheetRouter.post("/:id/submit", tadaMonthlySheetController.submitSheet);
sheetRouter.post("/:id/check", tadaMonthlySheetController.checkSheet);
sheetRouter.post("/:id/approve", tadaMonthlySheetController.approveSheet);
sheetRouter.post("/:id/reject", tadaMonthlySheetController.rejectSheet);
sheetRouter.use("/", createCrudRouter(tadaMonthlySheetController));

/* =====================================================
   RATE ROUTES
===================================================== */
const rateRouter = Router();
rateRouter.use("/", createCrudRouter(tadaRateController));

/* =====================================================
   MOUNT ALL
===================================================== */
router.use("/entries", entryRouter);
router.use("/sheets", sheetRouter);
router.use("/rates", rateRouter);

export default router;
