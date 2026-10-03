import { Router } from "express";

import { createCrudRouter } from "../../../routes/crud.routes";
import { cropController } from "./crop.controller";

const router = Router();

router.use("/", createCrudRouter(cropController));

// Crop → Pest Types
router.get("/:id/pest-types", cropController.getPestTypes);
router.get("/:id/pest-types/all", cropController.getAllPestTypes);

router.post("/:id/pest-types", cropController.assignPestType);
router.post("/:id/pest-types/bulk", cropController.assignPestTypes);

router.delete(
  "/:id/pest-types/:pestTypeId",
  cropController.removePestType
);

// Complete Crop hierarchy
router.get("/:id/hierarchy", cropController.getHierarchy);

export default router;