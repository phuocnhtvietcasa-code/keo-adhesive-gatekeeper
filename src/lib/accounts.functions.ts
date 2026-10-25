import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail } from "./username";

const DEFAULT_ADMIN = { username: "admin", password: "Admin@123", full_name: "Quản trị viên" };
const BAN = "876000h";

// Public + idempotent: creates the default admin only when no admin exists yet.
export const ensureDefaultAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if ((count ?? 0) > 0) return { created: false };
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: usernameToEmail(DEFAULT_ADMIN.username),
    password: DEFAULT_ADMIN.password,
    email_confirm: true,
  });
  if (error || !data.user) return { created: false };
  await supabaseAdmin.from("profiles").insert({
    id: data.user.id,
    username: DEFAULT_ADMIN.username,
    full_name: DEFAULT_ADMIN.full_name,
  });
  await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
  return { created: true };
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Chỉ admin mới có quyền này");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, full_name, email, locked, created_at")
      .order("created_at");
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    return (profiles ?? []).map((p) => ({
      ...p,
      role: roles?.some((r) => r.user_id === p.id && r.role === "admin") ? "admin" : "staff",
    }));
  });

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Tên đăng nhập 3-32 ký tự: chữ thường, số, . _ -");

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        username: usernameSchema,
        full_name: z.string().trim().max(100),
        password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự").max(72),
        role: z.enum(["admin", "staff"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: exists } = await admin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (exists) throw new Error("Tên đăng nhập đã tồn tại");
    const { data: created, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(data.username),
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Không tạo được tài khoản");
    await admin
      .from("profiles")
      .insert({ id: created.user.id, username: data.username, full_name: data.full_name });
    await admin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    return { ok: true };
  });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        password: z.string().min(6).max(72).optional(),
        locked: z.boolean().optional(),
        role: z.enum(["admin", "staff"]).optional(),
        full_name: z.string().trim().max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const self = data.id === context.userId;
    if (self && (data.locked || data.role === "staff"))
      throw new Error("Không thể khóa hoặc hạ quyền chính mình");
    if (data.password || data.locked !== undefined) {
      const { error } = await admin.auth.admin.updateUserById(data.id, {
        ...(data.password ? { password: data.password } : {}),
        ...(data.locked !== undefined ? { ban_duration: data.locked ? BAN : "none" } : {}),
      });
      if (error) throw new Error(error.message);
    }
    const patch: { locked?: boolean; full_name?: string } = {};
    if (data.locked !== undefined) patch.locked = data.locked;
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (Object.keys(patch).length) await admin.from("profiles").update(patch).eq("id", data.id);
    if (data.role) {
      await admin.from("user_roles").delete().eq("user_id", data.id);
      await admin.from("user_roles").insert({ user_id: data.id, role: data.role });
    }
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.id === context.userId) throw new Error("Không thể xóa chính mình");
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const emailSchema = z.string().trim().toLowerCase().email("Email không hợp lệ").max(254);

async function applyEmail(admin: any, id: string, email: string | null) {
  const { data: prof } = await admin.from("profiles").select("username").eq("id", id).single();
  if (!prof) throw new Error("Không tìm thấy tài khoản");
  if (email) {
    const { data: dup } = await admin.from("profiles").select("id").ilike("email", email).neq("id", id).maybeSingle();
    if (dup) throw new Error("Email đã được dùng cho tài khoản khác");
  }
  const { error } = await admin.auth.admin.updateUserById(id, {
    email: email ?? usernameToEmail(prof.username),
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  await admin.from("profiles").update({ email }).eq("id", id);
}

// Admin sets any account's recovery email; anyone may set their own.
export const setAccountEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid().optional(), email: z.union([emailSchema, z.literal("")]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const id = data.id ?? context.userId;
    const admin =
      id === context.userId
        ? (await import("@/integrations/supabase/client.server")).supabaseAdmin
        : await assertAdmin(context);
    await applyEmail(admin, id, data.email || null);
    return { ok: true };
  });

// Public: resolves username -> auth email server-side and signs in; email never reaches the browser.
export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ username: z.string().trim().toLowerCase().min(1).max(64), password: z.string().min(1).max(72) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");
    const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("username", data.username).maybeSingle();
    const email = prof?.email || usernameToEmail(data.username);
    const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: res, error } = await sb.auth.signInWithPassword({ email, password: data.password });
    if (error || !res.session) return { ok: false as const, banned: /banned/i.test(error?.message ?? "") };
    return {
      ok: true as const,
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
    };
  });
