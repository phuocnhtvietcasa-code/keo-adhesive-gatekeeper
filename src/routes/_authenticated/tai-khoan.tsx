import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Unlock, KeyRound, Trash2, UserPlus, Mail } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useMe } from "@/hooks/use-me";
import { setAccountEmail, createAccount, deleteAccount, listAccounts, updateAccount } from "@/lib/accounts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/tai-khoan")({
  head: () => ({
    meta: [
      { title: "Quản lý tài khoản - Webond Vietcasa" },
      { name: "description", content: "Tạo và quản lý tài khoản người dùng hệ thống kho." },
      { property: "og:title", content: "Quản lý tài khoản - Webond Vietcasa" },
      { property: "og:description", content: "Tạo và quản lý tài khoản người dùng hệ thống kho." },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const qc = useQueryClient();
  const list = useServerFn(listAccounts);
  const create = useServerFn(createAccount);
  const update = useServerFn(updateAccount);
  const remove = useServerFn(deleteAccount);
  const setEmail = useServerFn(setAccountEmail);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => list(), enabled: !!me?.isAdmin });
  const [form, setForm] = useState({ username: "", full_name: "", password: "", role: "staff" as "admin" | "staff" });

  const refresh = () => qc.invalidateQueries({ queryKey: ["accounts"] });
  const onErr = (e: unknown) => toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra");

  const createM = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: () => {
      toast.success("Đã tạo tài khoản");
      setForm({ username: "", full_name: "", password: "", role: "staff" });
      refresh();
    },
    onError: onErr,
  });
  const run = (p: Promise<unknown>, msg: string) => p.then(() => (toast.success(msg), refresh())).catch(onErr);

  if (meLoading) return <div className="flex h-screen flex-col"><TopBar /></div>;
  if (!me?.isAdmin)
    return (
      <div className="flex h-screen flex-col">
        <TopBar />
        <p className="m-auto text-muted-foreground">Chỉ admin mới truy cập được trang này.</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-muted/40">
      <TopBar />
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-extrabold text-brand-ink">Quản lý tài khoản</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createM.mutate();
          }}
          className="grid gap-3 rounded-2xl border-t-4 border-brand-green bg-card p-4 shadow-sm sm:grid-cols-5"
        >
          <Input placeholder="Tên đăng nhập" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input placeholder="Họ tên" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input type="password" placeholder="Mật khẩu" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "staff" })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="staff">Nhân viên</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" disabled={createM.isPending}>
            <UserPlus className="h-4 w-4" /> Tạo tài khoản
          </Button>
        </form>

        <div className="overflow-x-auto rounded-2xl bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="p-3">Tên đăng nhập</th>
                <th className="p-3">Họ tên</th>
                <th className="p-3">Vai trò</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Ngày tạo</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accounts.isLoading && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Đang tải...</td></tr>
              )}
              {accounts.data?.map((a) => {
                const self = a.id === me.id;
                return (
                  <tr key={a.id} className="border-t">
                    <td className="p-3 font-semibold">{a.username}{self && <span className="ml-1 text-xs text-muted-foreground">(bạn)</span>}</td>
                    <td className="p-3">{a.full_name}<div className="text-xs text-muted-foreground">{a.email || "Chưa có email"}</div></td>
                    <td className="p-3">
                      <select
                        disabled={self}
                        value={a.role}
                        onChange={(e) => run(update({ data: { id: a.id, role: e.target.value as "admin" | "staff" } }), "Đã đổi vai trò")}
                        className="rounded-md border border-input bg-background px-2 py-1"
                      >
                        <option value="staff">Nhân viên</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="p-3">
                      {a.locked ? <Badge variant="destructive">Đã khóa</Badge> : <Badge className="bg-brand-green">Hoạt động</Badge>}
                    </td>
                    <td className="p-3">{new Date(a.created_at).toLocaleDateString("vi-VN")}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" title="Email lấy lại mật khẩu" onClick={() => {
                          const v = prompt(`Email của ${a.username} (để trống để xóa):`, a.email ?? "");
                          if (v !== null) run(setEmail({ data: { id: a.id, email: v.trim() } }), "Đã lưu email");
                        }}>
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" title="Đặt lại mật khẩu" onClick={() => {
                          const pw = prompt(`Mật khẩu mới cho ${a.username} (tối thiểu 6 ký tự):`);
                          if (pw) run(update({ data: { id: a.id, password: pw } }), "Đã đặt lại mật khẩu");
                        }}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {!self && (
                          <>
                            <Button size="sm" variant="outline" title={a.locked ? "Mở khóa" : "Khóa"}
                              onClick={() => run(update({ data: { id: a.id, locked: !a.locked } }), a.locked ? "Đã mở khóa" : "Đã khóa")}>
                              {a.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="destructive" title="Xóa" onClick={() => {
                              if (confirm(`Xóa tài khoản ${a.username}?`)) run(remove({ data: { id: a.id } }), "Đã xóa");
                            }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
