import ZoneModel from "../models/zone.model";
import { createCrudService } from "./crud.service";

export const zoneService = createCrudService(ZoneModel, {
  searchFields: ["name"],
});
