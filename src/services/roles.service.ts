import Role from "../models/role.model";
import Permission from "../models/permission.model";
import mongoose from "mongoose";

export async function getEffectivePermissions(
  roleId: mongoose.Types.ObjectId | string
) {
  const visited = new Set<string>();
  const permissions = new Set<string>();

  async function dfs(rId: mongoose.Types.ObjectId | string) {
    const key = rId.toString();
    if (visited.has(key)) return;
    visited.add(key);

    const role = await Role.findById(rId).populate("permissions").lean();
    if (!role) return;

    const permNames = (role.permissions || []).map((p: any) => p.name);
    permNames.forEach((p) => permissions.add(p));

    if (permNames.includes("*") || role.isSystem) {
      permissions.add("*"); // wildcard
      return;
    }

    const parents = role.inherits || [];
    for (const p of parents) await dfs(p);
  }

  await dfs(roleId);
  return Array.from(permissions);
}
