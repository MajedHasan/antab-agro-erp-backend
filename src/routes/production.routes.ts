import { Router } from "express";
import { productionController } from "../controllers/production.controller";

const router = Router();

/**
 * ==========================================================
 * 1️⃣ START NEW PRODUCTION (Create WIP)
 * ==========================================================
 * Deduct raw/packaging immediately
 */
router.post("/start", productionController.startProduction);

/**
 * ==========================================================
 * 2️⃣ COMPLETE PRODUCTION (Partial Allowed)
 * ==========================================================
 * Increase finishedProduced
 */
router.post("/complete", productionController.completeProduction);

/**
 * ==========================================================
 * 3️⃣ MANUAL CLOSE WIP
 * ==========================================================
 */
router.post("/close", productionController.closeProduction);

/**
 * ==========================================================
 * 4️⃣ TRANSFER FINISHED FACTORY → WAREHOUSE
 * ==========================================================
 */
router.post("/transfer", productionController.transferToWarehouse);

/**
 * ==========================================================
 * 5️⃣ VIEW MATERIALS CURRENTLY IN WIP (Factory)
 * ==========================================================
 */
router.get(
  "/factory/:factoryId/materials",
  productionController.getMaterialsInWip,
);

/**
 * ==========================================================
 * 6️⃣ VIEW FINISHED GOODS INSIDE FACTORY
 * ==========================================================
 */
router.get(
  "/factory/:factoryId/finished",
  productionController.getFinishedInFactory,
);

/**
 * ==========================================================
 * 7️⃣ LIST ALL WIP (For WIP Page)
 * ==========================================================
 */
router.get("/wip", productionController.listWip);

export default router;
