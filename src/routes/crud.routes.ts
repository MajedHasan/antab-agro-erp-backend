// src/routes/crud.routes.ts
import { Router } from "express";
import { createCrudController } from "../controllers/crud.controller";

export function createCrudRouter(
  controller: ReturnType<typeof createCrudController>
) {
  const router = Router();

  router.get("/", controller.list);
  router.get("/export", controller.exportCSV);

  router.post("/", controller.create);
  router.post("/bulk", controller.bulkCreate);
  router.post("/bulk-delete", controller.bulkDelete);
  
  router.get("/:id", controller.get);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.delete);


  return router;
}
