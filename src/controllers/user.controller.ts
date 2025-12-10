// src/controllers/user.controller.ts
import { createCrudController } from "./crud.controller";
import { userService } from "../services/user.service";
import { NextFunction, Request, Response } from "express";

const base = createCrudController(userService, {
  defaultPopulate: "role",
});

export const userController = {
  ...base,
  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await userService.deactivateUser(req.params.id);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
