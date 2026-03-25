import { createCrudController } from "./crud.controller";
import { packagingService } from "../services/packaging.service";

export const packagingController = createCrudController(packagingService);
