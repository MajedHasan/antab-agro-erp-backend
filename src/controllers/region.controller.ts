import { createCrudController } from "./crud.controller";
import { regionService } from "../services/region.service";

export const regionController = {
  ...createCrudController(regionService),
};
