import { createCrudRouter } from "./crud.routes";
import { rawMaterialStockController } from "../controllers/rawMaterialStock.controller";

export default createCrudRouter(rawMaterialStockController);
