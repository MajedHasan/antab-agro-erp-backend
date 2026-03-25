import { createCrudRouter } from "./crud.routes";
import { productStockController } from "../controllers/productStock.controller";

export default createCrudRouter(productStockController);
