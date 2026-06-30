// src/routes/materialWip.routes.ts
import { Router } from "express";
import { materialWipController } from "../controllers/materialWip.controller";

const router = Router();

router.post("/start", materialWipController.start);
router.get("/products/:rawMaterialId", materialWipController.getProducts);

router.post("/request-conversion", materialWipController.requestConversion);
router.patch("/:id/pending-conversion", materialWipController.updatePendingConversion);

router.post("/:id/approve", materialWipController.approveConversion);
router.post("/:id/reject", materialWipController.rejectPendingConversion);

router.get("/", materialWipController.list);
router.get("/:id", materialWipController.get);

export default router;