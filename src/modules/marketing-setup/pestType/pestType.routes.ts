import { Router } from "express";

import { createCrudRouter } from "../../../routes/crud.routes";
import { pestTypeController } from "./pestType.controller";

const router = Router();

router.use("/", createCrudRouter(pestTypeController));

// Pest Type → Crops
router.get("/:id/crops", pestTypeController.getCrops);

// Pest Type → Solutions
router.get("/:id/solutions", pestTypeController.getSolutions);
router.get("/:id/solutions/all", pestTypeController.getAllSolutions);

router.post("/:id/solutions", pestTypeController.assignSolution);
router.post("/:id/solutions/bulk", pestTypeController.assignSolutions);

router.delete(
  "/:id/solutions/:solutionId",
  pestTypeController.removeSolution
);

export default router;