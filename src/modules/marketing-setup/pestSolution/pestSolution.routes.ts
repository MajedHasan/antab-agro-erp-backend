import { Router } from "express";

import { createCrudRouter } from "../../../routes/crud.routes";
import { pestSolutionController } from "./pestSolution.controller";

const router = Router();

router.use("/", createCrudRouter(pestSolutionController));

export default router;