import { validateContract } from "./input-contract";
import { createServerFn } from "@tanstack/react-start";
import { consumeLoginAttempt } from "./login-limit.server";
import {
  currentUser,
  hashPassword,
  issueSession,
  revokeCurrentSession,
  verifyPassword,
} from "./auth.server";
import { permissionMiddleware } from "./auth.middleware";

export const getAuthStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getPool } = await import("./db.server");
  const db = getPool();
  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM system_users WHERE password_hash IS NOT NULL",
  );
  const user = await currentUser();
  let emailSetupRequired = false;
  if (user) {
    const [mailboxes] = await db.execute(
      `SELECT COUNT(*) AS total
         FROM mailboxes m
         JOIN mailbox_access ma ON ma.mailbox_id = m.id AND ma.user_id = ?
        WHERE m.created_by = ? AND ma.can_send = TRUE
          AND (m.provider <> 'smtp' OR m.last_status LIKE 'Sending (SMTP) works%')`,
      [user.id, user.id],
    );
    emailSetupRequired = Number((mailboxes as Array<{ total: number }>)[0]?.total || 0) === 0;
  }
  return {
    user,
    bootstrapRequired: Number((rows as Array<{ total: number }>)[0]?.total || 0) === 0,
    emailSetupRequired,
  };
});

export const login = createServerFn({ method: "POST" })
  .validator((data: { email: string; password: string }) => validateContract(data, "login"))
  .handler(async ({ data }) => {
    if (
      typeof data?.email !== "string" ||
      typeof data?.password !== "string" ||
      data.email.length > 254 ||
      data.password.length > 200
    )
      throw new Error("Invalid email or password.");
    await consumeLoginAttempt(data.email);
    const { getPool } = await import("./db.server");
    const [rows] = await getPool().execute(
      "SELECT id, password_hash, status FROM system_users WHERE email = ? LIMIT 1",
      [data.email.trim().toLowerCase()],
    );
    const user = (rows as Array<{ id: string; password_hash: string | null; status: string }>)[0];
    const valid = await verifyPassword(user?.password_hash, data.password);
    if (!user || !valid || user.status !== "active") throw new Error("Invalid email or password.");
    await issueSession(user.id);
    await getPool().execute(
      "UPDATE system_users SET last_login_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
      [user.id],
    );
    return { ok: true };
  });

export const bootstrapAdministrator = createServerFn({ method: "POST" })
  .validator((data: { fullName: string; email: string; password: string }) =>
    validateContract(data, "bootstrapAdministrator"),
  )
  .handler(async ({ data }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const { randomUUID } = await import("node:crypto");
    const id = randomUUID();
    const fullName = data.fullName.trim();
    const email = data.email.trim().toLowerCase();
    if (!fullName || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))
      throw new Error("Enter a valid name and email address.");
    const passwordHash = await hashPassword(data.password);
    const connection = await db.getConnection();
    let locked = false;
    try {
      const [lockRows] = await connection.query(
        "SELECT GET_LOCK('gwero:bootstrap-administrator', 10) acquired",
      );
      locked = Number((lockRows as Array<{ acquired: number }>)[0]?.acquired) === 1;
      if (!locked) throw new Error("Administrator setup is busy. Try again.");
      await connection.beginTransaction();
      const [existingUsers] = await connection.query(
        "SELECT id FROM system_users WHERE password_hash IS NOT NULL LIMIT 1 FOR UPDATE",
      );
      if ((existingUsers as Array<{ id: string }>).length > 0)
        throw new Error("Administrator setup has already been completed.");
      const [roles] = await connection.execute(
        "SELECT id FROM roles WHERE name = 'Administrator' LIMIT 1",
      );
      const roleId = (roles as Array<{ id: string }>)[0]?.id;
      if (!roleId)
        throw new Error("Administrator role is unavailable. Run the database migration.");
      await connection.execute(
        `INSERT INTO system_users (id, full_name, email, role_id, status, password_hash)
         VALUES (?, ?, ?, ?, 'active', ?)`,
        [id, fullName, email, roleId, passwordHash],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      if (locked) await connection.query("SELECT RELEASE_LOCK('gwero:bootstrap-administrator')");
      connection.release();
    }
    await issueSession(id);
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await revokeCurrentSession();
  return { ok: true };
});

export const saveSystemUser = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("users.manage")])
  .validator(
    (data: {
      id?: string;
      fullName: string;
      email: string;
      roleId: string | null;
      status: string;
      password?: string;
    }) => validateContract(data, "saveSystemUser"),
  )
  .handler(async ({ data, context }) => {
    const { getPool } = await import("./db.server");
    const db = getPool();
    const administrator = context.user.roleName === "Administrator";
    let requestedRole: { id: string; name: string } | undefined;
    if (data.roleId) {
      const [requestedRoleRows] = await db.execute(
        "SELECT id, name FROM roles WHERE id = ? LIMIT 1",
        [data.roleId],
      );
      requestedRole = (requestedRoleRows as Array<{ id: string; name: string }>)[0];
    }
    if (data.roleId && !requestedRole) throw new Error("The selected role does not exist.");
    if (!administrator && requestedRole?.name === "Administrator")
      throw new Error("Only an administrator can assign the Administrator role.");
    if (!administrator && data.roleId) {
      const [rolePermissionRows] = await db.execute(
        `SELECT p.permission_key FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
        [data.roleId],
      );
      const exceedsCaller = (rolePermissionRows as Array<{ permission_key: string }>).some(
        (row) => !context.user.permissions.includes(row.permission_key),
      );
      if (exceedsCaller) throw new Error("You cannot assign permissions you do not have.");
    }
    let existingRoleName: string | null = null;
    if (data.id) {
      const [targetRows] = await db.execute(
        `SELECT u.status, u.role_id, r.name AS role_name FROM system_users u
         LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`,
        [data.id],
      );
      const target = (
        targetRows as Array<{ role_name: string | null; role_id: string | null; status: string }>
      )[0];
      if (!target) throw new Error("User not found.");
      existingRoleName = target.role_name;
      if (!administrator && existingRoleName === "Administrator")
        throw new Error("Only an administrator can manage an administrator account.");
      if (!administrator && target.role_id) {
        const [targetPermissionRows] = await db.execute(
          `SELECT p.permission_key FROM role_permissions rp
           JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=?`,
          [target.role_id],
        );
        if (
          (targetPermissionRows as Array<{ permission_key: string }>).some(
            (row) => !context.user.permissions.includes(row.permission_key),
          )
        )
          throw new Error("You cannot manage a user with permissions you do not have.");
      }
      const removingLastAdministrator =
        existingRoleName === "Administrator" &&
        target.status === "active" &&
        (data.status !== "active" || requestedRole?.name !== "Administrator");
      if (removingLastAdministrator) {
        const [adminRows] = await db.execute(
          `SELECT COUNT(*) AS total FROM system_users u JOIN roles r ON r.id=u.role_id
           WHERE r.name='Administrator' AND u.status='active'`,
        );
        if (Number((adminRows as Array<{ total: number }>)[0]?.total || 0) <= 1)
          throw new Error("The last active administrator cannot be suspended or demoted.");
      }
    }
    const values: Array<string | null> = [
      data.fullName.trim(),
      data.email.trim().toLowerCase(),
      data.roleId,
      data.status,
    ];
    const passwordSql = data.password ? ", password_hash = ?" : "";
    if (data.password) values.push(await hashPassword(data.password));
    if (data.id) {
      if (data.id === context.user.id && data.status !== "active")
        throw new Error("You cannot suspend your own account.");
      if (data.id === context.user.id && data.roleId !== context.user.roleId)
        throw new Error("You cannot change your own role while signed in.");
      values.push(data.id);
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          `UPDATE system_users SET full_name=?, email=?, role_id=?, status=?${passwordSql} WHERE id=?`,
          values,
        );
        if (data.password || data.status !== "active")
          await connection.execute("DELETE FROM auth_sessions WHERE user_id=?", [data.id]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      if (!data.password) throw new Error("Set an initial password for the new user.");
      const { randomUUID } = await import("node:crypto");
      await db.execute(
        "INSERT INTO system_users (id, full_name, email, role_id, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
        [
          randomUUID(),
          data.fullName.trim(),
          data.email.trim().toLowerCase(),
          data.roleId,
          data.status,
          await hashPassword(data.password),
        ],
      );
    }
    return { ok: true };
  });

export const deleteSystemUser = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("users.manage")])
  .validator((data: { id: string }) => validateContract(data, "deleteSystemUser"))
  .handler(async ({ data, context }) => {
    if (data.id === context.user.id) throw new Error("You cannot delete your own account.");
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [targetRows] = await db.execute(
      `SELECT u.status, u.role_id, r.name AS role_name FROM system_users u
       LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=? LIMIT 1`,
      [data.id],
    );
    const target = (
      targetRows as Array<{ role_name: string | null; role_id: string | null; status: string }>
    )[0];
    if (!target) throw new Error("User not found.");
    if (context.user.roleName !== "Administrator" && target.role_id) {
      const [targetPermissionRows] = await db.execute(
        `SELECT p.permission_key FROM role_permissions rp
         JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=?`,
        [target.role_id],
      );
      if (
        (targetPermissionRows as Array<{ permission_key: string }>).some(
          (row) => !context.user.permissions.includes(row.permission_key),
        )
      )
        throw new Error("You cannot delete a user with permissions you do not have.");
    }
    if (target.role_name === "Administrator") {
      if (context.user.roleName !== "Administrator")
        throw new Error("Only an administrator can delete an administrator account.");
      const [adminRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM system_users u JOIN roles r ON r.id=u.role_id
         WHERE r.name='Administrator' AND u.status='active'`,
      );
      if (
        target.status === "active" &&
        Number((adminRows as Array<{ total: number }>)[0]?.total || 0) <= 1
      )
        throw new Error("The last active administrator cannot be deleted.");
    }
    await db.execute("DELETE FROM system_users WHERE id = ?", [data.id]);
    return { ok: true };
  });

export const createRole = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("users.manage")])
  .validator((data: { name: string; description: string }) => validateContract(data, "createRole"))
  .handler(async ({ data }) => {
    const { randomUUID } = await import("node:crypto");
    const { getPool } = await import("./db.server");
    await getPool().execute(
      "INSERT INTO roles (id, name, description, is_system) VALUES (?, ?, ?, FALSE)",
      [randomUUID(), data.name.trim(), data.description.trim() || null],
    );
    return { ok: true };
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([permissionMiddleware("users.manage")])
  .validator((data: { roleId: string; permissionId: string; enabled: boolean }) =>
    validateContract(data, "setRolePermission"),
  )
  .handler(async ({ data, context }) => {
    if (context.user.roleName !== "Administrator")
      throw new Error("Only an administrator can change role permissions.");
    const { getPool } = await import("./db.server");
    const db = getPool();
    const [roleRows] = await db.execute("SELECT is_system FROM roles WHERE id=? LIMIT 1", [
      data.roleId,
    ]);
    const role = (roleRows as Array<{ is_system: number }>)[0];
    if (!role) throw new Error("Role not found.");
    if (role.is_system) throw new Error("System role permissions cannot be changed.");
    if (data.enabled) {
      const { randomUUID } = await import("node:crypto");
      await db.execute(
        "INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES (?, ?, ?)",
        [randomUUID(), data.roleId, data.permissionId],
      );
    } else {
      await db.execute("DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?", [
        data.roleId,
        data.permissionId,
      ]);
    }
    return { ok: true };
  });
