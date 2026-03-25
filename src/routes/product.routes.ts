import { createCrudRouter } from "./crud.routes";
import { productController } from "../controllers/product.controller";

export default createCrudRouter(productController);
