import { createCrudController } from "./crud.controller";
import { productService } from "../services/product.service";

export const productController = createCrudController(productService);
