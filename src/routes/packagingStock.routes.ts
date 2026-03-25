import { createCrudRouter } from "./crud.routes";
import { packagingStockController } from "../controllers/packagingStock.controller";

export default createCrudRouter(packagingStockController);
