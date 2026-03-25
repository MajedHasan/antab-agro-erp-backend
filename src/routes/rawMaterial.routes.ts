import { createCrudRouter } from "./crud.routes";
import { rawMaterialController } from "../controllers/rawMaterial.controller";

const router = createCrudRouter(rawMaterialController);

// ➕ Extended routes
router.patch("/:id/average-price", rawMaterialController.updateAveragePrice);

export default router;
