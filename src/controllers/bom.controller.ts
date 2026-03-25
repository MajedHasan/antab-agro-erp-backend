import { createCrudController } from "./crud.controller";
import { bomService } from "../services/bom.service";

export const bomController = createCrudController(bomService);
