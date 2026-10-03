import { createCrudController } from "../../../controllers/crud.controller";

import {
  pestSolutionService,
} from "./pestSolution.service";

export const pestSolutionController =
  createCrudController(
    pestSolutionService
  );