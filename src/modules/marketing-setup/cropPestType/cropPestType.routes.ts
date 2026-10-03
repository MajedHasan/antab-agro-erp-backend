import { Router } from "express";

import { createCrudRouter } from "../../../routes/crud.routes";
import { cropPestTypeController } from "./cropPestType.controller";

const router = Router();

router.use("/", createCrudRouter(cropPestTypeController));

export default router;