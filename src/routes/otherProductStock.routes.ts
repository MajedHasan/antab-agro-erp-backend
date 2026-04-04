import { createCrudRouter } from "./crud.routes";
import { otherProductStockController } from "../controllers/otherProductStock.controller";

export default createCrudRouter(otherProductStockController);
