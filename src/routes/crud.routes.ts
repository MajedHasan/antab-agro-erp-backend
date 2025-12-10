// src/routes/crud.routes.ts
import { Router } from "express";
import { createCrudController } from "../controllers/crud.controller";

export function createCrudRouter(
  controller: ReturnType<typeof createCrudController>
) {
  const router = Router();

  router.get("/", controller.list);
  router.get("/export", controller.exportCSV);
  router.get("/:id", controller.get);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.delete);

  router.post("/bulk", controller.bulkCreate);
  router.post("/bulk-delete", controller.bulkDelete);

  return router;
}
