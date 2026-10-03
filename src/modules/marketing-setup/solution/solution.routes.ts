import { Router } from "express";

import { createCrudRouter } from "../../../routes/crud.routes";
import { solutionController } from "./solution.controller";

const router = Router();

router.use("/", createCrudRouter(solutionController));

// Solution → Pest Types
router.get("/:id/pest-types", solutionController.getPestTypes);

router.post("/:id/pest-types", solutionController.assignPestType);

router.delete(
  "/:id/pest-types/:pestTypeId",
  solutionController.removePestType
);

// Solution → Doses
router.get("/:id/doses", solutionController.getDoses);
router.get("/:id/doses/all", solutionController.getAllDoses);

router.post("/:id/doses", solutionController.createDose);

router.patch(
  "/:id/doses/:doseId",
  solutionController.updateDose
);

router.delete(
  "/:id/doses/:doseId",
  solutionController.removeDose
);

// Complete Solution details
router.get("/:id/details", solutionController.getDetails);

export default router;