import RegionModel from "../models/region.model";
import { createCrudService } from "./crud.service";

export const regionService = createCrudService(RegionModel, {
  defaultPopulate: "zone",
  searchFields: ["name"],
  allowedFilterFields: ["zone"], // dynamic filtering
});
