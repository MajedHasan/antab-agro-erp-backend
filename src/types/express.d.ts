// src/types/express.d.ts
import "express";

declare global {
  namespace Express {
    interface User {
      _id: string;
      role?: string;
    }

    interface Request {
      user?: User;
      file?: Express.Multer.File;
      files?:
        | Express.Multer.File[]
        | { [field: string]: Express.Multer.File[] };
    }
  }
}

export {};
