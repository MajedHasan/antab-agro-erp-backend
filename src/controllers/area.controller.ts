import { createCrudController } from "./crud.controller";
import { areaService } from "../services/area.service";

export const areaController = {
  ...createCrudController(areaService),
};
