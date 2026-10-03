import {
  Request,
  Response,
  NextFunction,
} from "express";

import { createCrudController } from "../../../controllers/crud.controller";

import {
  cropPestTypeService,
} from "./cropPestType.service";

export const cropPestTypeController =
  createCrudController(
    cropPestTypeService
  );