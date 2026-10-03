import { Router } from "express";

import cropRoutes from "./crop/crop.routes";
import pestTypeRoutes from "./pestType/pestType.routes";
import solutionRoutes from "./solution/solution.routes";
import solutionDoseRoutes from "./solutionDose/solutionDose.routes";
import cropPestTypeRoutes from "./cropPestType/cropPestType.routes";
import pestSolutionRoutes from "./pestSolution/pestSolution.routes";

const router = Router();

router.use("/crops", cropRoutes);
router.use("/pest-types", pestTypeRoutes);
router.use("/solutions", solutionRoutes);
router.use("/solution-doses", solutionDoseRoutes);

router.use("/crop-pest-types", cropPestTypeRoutes);
router.use("/pest-solutions", pestSolutionRoutes);

export default router;