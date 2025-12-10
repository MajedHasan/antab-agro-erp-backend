import { createCrudController } from "./crud.controller";
import { zoneService } from "../services/zone.service";

export const zoneController = {
  ...createCrudController(zoneService),
};
