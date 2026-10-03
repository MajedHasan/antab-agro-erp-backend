import { Router } from "express";

import { createCrudRouter } from "../../../routes/crud.routes";
import { solutionDoseController } from "./solutionDose.controller";

const router = Router();

router.use("/", createCrudRouter(solutionDoseController));

router.get(
  "/solution/:solutionId",
  solutionDoseController.getBySolution
);

router.post(
  "/solution/:solutionId",
  solutionDoseController.createForSolution
);

router.patch(
  "/:id/status",
  solutionDoseController.setStatus
);

export default router;