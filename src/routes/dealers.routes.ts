import { Router } from "express";
import { dealerController } from "../controllers/dealer.controller";
import { createCrudRouter } from "./crud.routes";

const router = Router();

/* =====================================================
   1️⃣ Generate Dealer Code
===================================================== */
router.get("/generate-code", dealerController.generateCode);

/* =====================================================
   2️⃣ Auto Create Account for Dealer
===================================================== */
router.post("/:id/auto-account", dealerController.autoAccount);

/* =====================================================
   3️⃣ Sync Dealer Name → Account Name
===================================================== */
router.post("/:id/sync-account-name", dealerController.syncAccountName);

/* =====================================================
   4️⃣ Credit Management
===================================================== */
router.get("/:id/credit-summary", dealerController.getCreditSummary);

router.get("/:id/credit-validate", dealerController.validateCredit);

/* =====================================================
   5️⃣ Signature Management
===================================================== */
router.get("/:id/signature", dealerController.getSignatureTemplate);

router.post("/:id/signature", dealerController.updateSignatureTemplate);

/* =====================================================
   6️⃣ Status Check
===================================================== */
router.get("/:id/status-check", dealerController.checkStatus);

/* =====================================================
   7️⃣ Standard CRUD Routes
===================================================== */
const crudRouter = createCrudRouter(dealerController);
router.use("/", crudRouter);

export default router;
