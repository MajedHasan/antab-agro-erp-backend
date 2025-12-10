import { createCrudController } from "./crud.controller";
import { mediaService } from "../services/media.service";

export const mediaController = {
  ...createCrudController(mediaService),
};
