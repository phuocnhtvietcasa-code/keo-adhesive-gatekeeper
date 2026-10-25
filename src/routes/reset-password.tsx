import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpg.asset.json";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Đặt mật khẩu mới - Keo Webond" },
      { name: "description", content: "Đặt lại mật khẩu tài khoản quản lý kho Webond Vietcasa." },
      { property: "og:title", content: "Đặt mật khẩu mới - Keo Webond" },
      { property: "og:description", content: "Đặt lại mật khẩu tài khoản quản lý kho Webond Vietcasa." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((ev, session) => {
      if (ev === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) return setErr("Mật khẩu tối thiểu 6 ký tự");
    if (pw !== pw2) return setErr("Hai mật khẩu không khớp");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return setErr(/pwned|leak|weak/i.test(error.message) ? "Mật khẩu này đã bị lộ trên mạng, hãy chọn mật khẩu khác" : error.message);
    navigate({ to: "/kho", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 font-sans">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border-t-8 border-brand-green bg-card shadow-card">
        <div className="px-8 pb-8 pt-6">
          <img src={logo.url} alt="Webond" className="mx-auto -my-6 h-40 object-cover" />
          <h1 className="mt-2 text-center text-2xl font-extrabold text-brand-ink">Đặt mật khẩu mới</h1>
          {!ready ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">Đang xác thực link... Nếu không tiếp tục được, link có thể đã hết hạn — hãy yêu cầu lại từ trang đăng nhập.</p>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {[{ v: pw, s: setPw, p: "Mật khẩu mới" }, { v: pw2, s: setPw2, p: "Nhập lại mật khẩu" }].map((f) => (
                <label key={f.p} className="flex h-12 items-center gap-3 rounded-xl border-2 border-border px-4 focus-within:border-brand-green">
                  <Lock className="h-5 w-5 text-brand-green" />
                  <input type="password" value={f.v} onChange={(e) => f.s(e.target.value)} placeholder={f.p} autoComplete="new-password" className="flex-1 bg-transparent outline-none" />
                </label>
              ))}
              {err && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
              <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cta font-bold text-primary-foreground shadow-cta disabled:opacity-70">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Lưu mật khẩu
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
