import TerritoryModel from "../models/territory.model";
import { createCrudService } from "./crud.service";

export const territoryService = createCrudService(TerritoryModel, {
  defaultPopulate: "area",
  searchFields: ["name"],
  allowedFilterFields: ["area"],
});
