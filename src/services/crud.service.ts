// src/services/crud.service.ts
import { Model, ClientSession, FilterQuery, PipelineStage } from "mongoose";

export type SortDirection = "asc" | "desc";

export interface CrudServiceOptions {
  defaultPopulate?: string | object | (string | object)[];
  defaultSort?: string;
  searchFields?: string[]; // fields to run `q` search on
  softDeleteField?: string; // e.g. "deletedAt" or "isDeleted"
  allowedFilterFields?: string[]; // optional allowlist for filters
  defaultLimit?: number;
  lean?: boolean;
  // hooks
  beforeCreate?: (payload: any) => Promise<any> | any;
  afterCreate?: (doc: any) => Promise<any> | any;
  beforeUpdate?: (id: string, payload: any) => Promise<any> | any;
  afterUpdate?: (doc: any) => Promise<any> | any;
  beforeDelete?: (id: string, session?: ClientSession) => Promise<any>;
  afterDelete?: (doc: any, session?: ClientSession) => Promise<any>;
}

export function createCrudService(
  model: Model<any>,
  opts: CrudServiceOptions = {}
) {
  const {
    defaultPopulate,
    defaultSort = "-createdAt",
    searchFields = [],
    softDeleteField,
    allowedFilterFields,
    defaultLimit = 15,
    lean = true,
    beforeCreate,
    afterCreate,
    beforeUpdate,
    afterUpdate,
  } = opts;

  async function buildQuery(
    filter: FilterQuery<any>,
    q?: string,
    searchF?: string[]
  ) {
    const query: any = { ...filter };

    if (softDeleteField) {
      // exclude soft-deleted by default
      query[softDeleteField] = { $exists: false };
    }

    if (q) {
      const fields = searchF && searchF.length ? searchF : searchFields;
      query.$or = fields.map((f) => ({ [f]: new RegExp(escapeRegex(q), "i") }));
    }

    return query;
  }

  return {
    // list with pagination, filtering, sorting, select, populate
    async list({
      filter = {},
      page = 1,
      limit = defaultLimit,
      sort = defaultSort,
      select,
      populate,
      q,
      searchFields: sf,
    }: any = {}) {
      const skip = (page - 1) * limit;
      const queryObj = await buildQuery(filter, q, sf);

      // allowlist filter keys if provided
      if (allowedFilterFields && allowedFilterFields.length) {
        for (const key of Object.keys(queryObj)) {
          if (!allowedFilterFields.includes(key) && key !== "$or") {
            delete queryObj[key];
          }
        }
      }

      const [data, total] = await Promise.all([
        model
          .find(queryObj)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select(select || "")
          .populate(populate || defaultPopulate)
          .lean(lean),
        model.countDocuments(queryObj),
      ]);

      return { data, total, page, limit };
    },

    async getById(
      id: string,
      { populate, select }: { populate?: any; select?: string } = {}
    ) {
      let q = model.findById(id).select(select || "");
      if (populate || defaultPopulate)
        q = q.populate(populate ?? defaultPopulate);
      if (lean) q = q.lean();
      return q.exec();
    },

    async create(payload: any, { session }: { session?: ClientSession } = {}) {
      if (beforeCreate) payload = await beforeCreate(payload);
      const doc = new model(payload);
      await doc.save({ session });
      let result = doc;
      if (afterCreate) result = await afterCreate(result);
      if (lean) result = doc.toObject();
      return result;
    },

    async update(
      id: string,
      payload: any,
      { session, populate }: { session?: ClientSession; populate?: any } = {}
    ) {
      if (beforeUpdate) payload = await beforeUpdate(id, payload);
      const updated = await model
        .findByIdAndUpdate(id, payload, { new: true, session })
        .populate(populate || defaultPopulate);
      if (afterUpdate) await afterUpdate(updated);
      if (lean && updated?.toObject) return updated.toObject();
      return updated;
    },

    async upsert(
      filter: FilterQuery<any>,
      payload: any,
      { session }: { session?: ClientSession } = {}
    ) {
      const doc = await model.findOneAndUpdate(filter, payload, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        session,
      });
      if (lean && doc?.toObject) return doc.toObject();
      return doc;
    },

    async remove(
      id: string,
      {
        hard = false,
        session,
      }: { hard?: boolean; session?: ClientSession } = {}
    ) {
      if (opts.beforeDelete) await opts.beforeDelete(id, session);

      let deleted;

      if (softDeleteField && !hard) {
        // const upd: any = { [softDeleteField]: new Date() };
        // return model.findByIdAndUpdate(id, upd, { new: true, session });

        deleted = await model.findByIdAndUpdate(
          id,
          { [softDeleteField]: new Date() },
          { new: true, session }
        );
      } else {
        // return model.findByIdAndDelete(id, { session });
        deleted = await model.findByIdAndDelete(id, { session });
      }

      if (opts.afterDelete) await opts.afterDelete(deleted, session);

      return deleted;
    },

    async restore(id: string, { session }: { session?: ClientSession } = {}) {
      if (!softDeleteField) throw new Error("softDeleteField not configured");
      const upd: any = { $unset: { [softDeleteField]: "" } };
      return model.findByIdAndUpdate(id, upd, { new: true, session });
    },

    // bulk ops
    async bulkCreate(
      items: any[],
      { session }: { session?: ClientSession } = {}
    ) {
      return model.insertMany(items, { session });
    },

    async bulkUpdate(
      conditionsAndUpdates: { filter: any; update: any }[],
      { session }: { session?: ClientSession } = {}
    ) {
      const results = [];
      for (const item of conditionsAndUpdates) {
        const r = await model.updateMany(item.filter, item.update, { session });
        results.push(r);
      }
      return results;
    },

    async bulkDelete(
      filters: FilterQuery<any>[],
      {
        hard = false,
        session,
      }: { hard?: boolean; session?: ClientSession } = {}
    ) {
      if (softDeleteField && !hard) {
        const ops = [];
        for (const f of filters) {
          ops.push(
            model.updateMany(f, { [softDeleteField]: new Date() }, { session })
          );
        }
        return Promise.all(ops);
      } else {
        const ops = [];
        for (const f of filters) {
          ops.push(model.deleteMany(f, { session }));
        }
        return Promise.all(ops);
      }
    },

    // aggregation wrapper
    async aggregate(
      pipeline: PipelineStage[],
      { page, limit }: { page?: number; limit?: number } = {}
    ) {
      if (page && limit) {
        const skip = (page - 1) * limit;

        const facetStage: PipelineStage = {
          $facet: {
            data: [...pipeline, { $skip: skip }, { $limit: limit }],
            total: [{ $count: "count" }],
          },
        } as PipelineStage;

        const res = await model.aggregate([facetStage]).exec();
        const data = res[0]?.data ?? [];
        const total = res[0]?.total?.[0]?.count ?? 0;
        return { data, total, page, limit };
      }

      const data = await model.aggregate(pipeline).exec();
      return { data, total: data.length };
    },

    // transaction helper
    async withTransaction(fn: (session: ClientSession) => Promise<any>) {
      const conn = model.db;
      const session = await conn.startSession();
      try {
        let res;
        await session.withTransaction(async () => {
          res = await fn(session);
        });
        return res;
      } finally {
        session.endSession();
      }
    },

    // export data as CSV string (simple)
    async exportCSV({
      filter = {},
      fields = [],
      populate,
    }: { filter?: any; fields?: string[]; populate?: any } = {}) {
      const docs = await model
        .find(filter)
        .select(fields.join(" "))
        .populate(populate || defaultPopulate)
        .lean();
      if (!docs || !docs.length) return "";
      const header = fields.join(",");
      const rows = docs.map((d: any) =>
        fields
          .map((f) => {
            const val = f.split(".").reduce((acc, k) => (acc ? acc[k] : ""), d);
            return `"${String(val ?? "").replace(/"/g, '""')}"`;
          })
          .join(",")
      );
      return [header, ...rows].join("\n");
    },

    // find one
    async findOne(
      filter: any,
      { populate, select }: { populate?: any; select?: string } = {}
    ) {
      let q = model.findOne(filter).select(select || "");
      if (populate || defaultPopulate)
        q = q.populate(populate ?? defaultPopulate);
      if (lean) q = q.lean();
      return q.exec();
    },

    model,
  };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
