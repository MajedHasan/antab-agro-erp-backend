import { Request, Response } from "express";

/**
 * Example protected route: list classrooms
 */
export async function listClassrooms(req: Request, res: Response) {
  // In a real app we'd fetch from DB. Here return example data.
  const example = [
    { id: "c1", name: "Math 101", teacher: "teacher1@example.com" },
    { id: "c2", name: "History 201", teacher: "teacher2@example.com" },
  ];
  res.json({ classrooms: example });
}
