import { createCrudController } from "./crud.controller";
import { otherProductService } from "../services/otherProduct.service";

export const otherProductController = createCrudController(otherProductService);
