import { createCrudController } from "./crud.controller";
import { territoryService } from "../services/territory.service";

export const territoryController = {
  ...createCrudController(territoryService),
};
