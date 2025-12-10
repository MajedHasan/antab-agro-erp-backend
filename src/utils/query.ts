// ✅ FIXED version of src/utils/query.ts
import { Request } from "express";

export interface ParsedQuery {
  filter: Record<string, any>;
  page: number;
  limit: number;
  sort?: string;
  select?: string;
  populate?: string | string[];
  q?: string;
  searchFields?: string[];
  skip?: number;
  raw?: Record<string, any>;
}

export function parseListQuery(
  req: Request,
  defaults = { page: 1, limit: 15 }
): ParsedQuery {
  const raw = { ...req.query } as Record<string, any>;
  const page = Math.max(1, parseInt(req.query.page as string) || defaults.page);
  const limit = Math.max(
    1,
    parseInt(req.query.limit as string) || defaults.limit
  );
  const skip = (page - 1) * limit;

  const sort = (req.query.sort as string) || undefined;
  const select = (req.query.select as string) || undefined;

  // ✅ fix: properly normalize populate
  let populate: string | string[] | undefined;
  const rawPopulate = req.query.populate;

  if (typeof rawPopulate === "string") {
    populate = rawPopulate.includes(",")
      ? rawPopulate.split(",").map((s) => s.trim())
      : rawPopulate;
  } else if (Array.isArray(rawPopulate)) {
    populate = rawPopulate.map((p) => String(p));
  }

  const q = (req.query.q as string) || undefined;
  const searchFields =
    typeof req.query.searchFields === "string"
      ? req.query.searchFields.split(",").map((s) => s.trim())
      : undefined;

  const filter: Record<string, any> = {};

  if (req.query.filter && typeof req.query.filter === "object") {
    Object.assign(filter, req.query.filter as Record<string, any>);
  }

  const reserved = new Set([
    "page",
    "limit",
    "sort",
    "select",
    "populate",
    "q",
    "searchFields",
    "filter",
  ]);

  for (const k of Object.keys(req.query)) {
    if (!reserved.has(k)) filter[k] = req.query[k];
  }

  return {
    filter,
    page,
    limit,
    sort,
    select,
    populate,
    q,
    searchFields,
    skip,
    raw,
  };
}
