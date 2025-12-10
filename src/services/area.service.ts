import AreaModel from "../models/area.model";
import Region from "../models/region.model";
import { createCrudService } from "./crud.service";

export const areaService = createCrudService(AreaModel, {
  defaultPopulate: "region",
  searchFields: ["name"],
  allowedFilterFields: ["name", "region", "zone"],
});
