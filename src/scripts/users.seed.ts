import bcrypt from "bcrypt";
import mongoose from "mongoose";

import UserModel from "../models/user.model";
import RoleModel from "../models/role.model";

type SeedUser = {
  name: string;
  email: string;
  passwordEnv: string;
  roleName: string;
  department: string;
};

const users: SeedUser[] = [
  {
    name: "Super Admin",
    email: process.env.SEED_SUPER_ADMIN_EMAIL || "admin@antabagro.com",
    passwordEnv: "SEED_SUPER_ADMIN_PASSWORD",
    roleName: "Super Admin",
    department: "Administration",
  },
  {
    name: "Developer",
    email: process.env.SEED_DEVELOPER_EMAIL || "developer@antabagro.com",
    passwordEnv: "SEED_DEVELOPER_PASSWORD",
    roleName: "Developer",
    department: "IT",
  },
];

/**
 * Find a role by its exact name.
 *
 * We intentionally DO NOT create or modify roles here.
 * RBAC remains completely untouched.
 */
async function findRole(roleName: string, session: mongoose.ClientSession) {
  const role = await RoleModel.findOne({
    name: roleName,
  }).session(session);

  if (!role) {
    throw new Error(
      `Required role "${roleName}" was not found. ` +
        `Please seed/create this role before running the user seed.`,
    );
  }

  return role;
}

/**
 * Seed application users.
 *
 * Behavior:
 * - Creates missing users.
 * - Existing users are preserved.
 * - Existing passwords are NOT overwritten.
 * - Existing roles are NOT changed.
 * - Existing departments are NOT changed.
 * - Roles/RBAC are NOT modified.
 */
export async function seedUsers() {
  console.log("\n===========================================");
  console.log("             USERS SEED");
  console.log("===========================================\n");

  const session = await mongoose.startSession();

  let createdCount = 0;
  let existingCount = 0;

  try {
    session.startTransaction();

    for (const item of users) {
      const email = item.email.trim().toLowerCase();

      /**
       * --------------------------------------------------------
       * Validate password environment variable
       * --------------------------------------------------------
       */

      const plainPassword = process.env[item.passwordEnv];

      if (!plainPassword) {
        throw new Error(
          `${item.passwordEnv} is not defined in environment variables.`,
        );
      }

      /**
       * --------------------------------------------------------
       * Find role
       * --------------------------------------------------------
       */

      const role = await findRole(item.roleName, session);

      /**
       * --------------------------------------------------------
       * Find existing user
       * --------------------------------------------------------
       */

      const existingUser = await UserModel.findOne({
        email,
      }).session(session);

      if (existingUser) {
        existingCount++;

        console.log(
          `= User exists: ${email} → role: ${item.roleName}`,
        );

        continue;
      }

      /**
       * --------------------------------------------------------
       * Hash password
       * --------------------------------------------------------
       *
       * Same bcrypt approach used by auth.service.ts
       */

      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      /**
       * --------------------------------------------------------
       * Create user
       * --------------------------------------------------------
       */

      await UserModel.create(
        [
          {
            name: item.name,
            email,
            password: hashedPassword,
            role: role._id,
            department: item.department,
            restricted: false,
          },
        ],
        { session },
      );

      createdCount++;

      console.log(
        `+ User created: ${email} → role: ${item.roleName}`,
      );
    }

    await session.commitTransaction();

    console.log("\n===========================================");
    console.log("             USERS SEED DONE");
    console.log("===========================================");

    console.log(`Created : ${createdCount}`);
    console.log(`Existing: ${existingCount}`);
    console.log(`Total   : ${users.length}`);

    console.log("===========================================\n");

    return {
      success: true,
      created: createdCount,
      existing: existingCount,
      total: users.length,
    };
  } catch (error) {
    await session.abortTransaction();

    console.error("\n❌ Users seed failed.");
    console.error(error);

    throw error;
  } finally {
    await session.endSession();
  }
}

export default seedUsers;