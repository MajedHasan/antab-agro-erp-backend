// src/routes/product.routes.ts
import { createCrudRouter } from "./crud.routes";
import { productController } from "../controllers/product.controller";

const router = createCrudRouter(productController);

export default router;
