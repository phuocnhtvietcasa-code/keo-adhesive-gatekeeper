import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDefaultAdmin, signInWithUsername } from "@/lib/accounts.functions";
import logo from "@/assets/logo.jpg.asset.json";
import baoXanh from "@/assets/bao-xanh.jpg.asset.json";
import baoVang from "@/assets/bao-vang.jpg.asset.json";
import baoDo from "@/assets/bao-do.jpg.asset.json";
import tuyp from "@/assets/tuyp-keo.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Đăng nhập - Quản Lý Kho Webond Vietcasa" },
      { name: "description", content: "Đăng nhập hệ thống quản lý kho - doanh số Webond Vietcasa." },
      { property: "og:title", content: "Đăng nhập - Quản Lý Kho Webond Vietcasa" },
      { property: "og:description", content: "Đăng nhập hệ thống quản lý kho - doanh số Webond Vietcasa." },
    ],
  }),
  component: LoginPage,
});

const SLIDES = [
  { src: baoXanh.url, name: "Webond Pro", tag: "Bao xanh · Gạch khổ lớn", tone: "bg-brand-green" },
  { src: baoVang.url, name: "Webond Standard", tag: "Bao vàng · Nội thất", tone: "bg-brand-yellow" },
  { src: baoDo.url, name: "Webond Max", tag: "Bao đỏ · Ngoại thất, hồ bơi", tone: "bg-brand-orange" },
  { src: tuyp.url, name: "Webond Epoxy", tag: "Tuýp keo chít mạch 2 thành phần", tone: "bg-brand-ink" },
];

const REMEMBER_KEY = "vc-remember";

function LoginPage() {
  const navigate = useNavigate();
  const ensureAdmin = useServerFn(ensureDefaultAdmin);
  const signIn = useServerFn(signInWithUsername);
  const [forgot, setForgot] = useState(false);
  const [fEmail, setFEmail] = useState("");
  const [fMsg, setFMsg] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    ensureAdmin().catch(() => {});
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/kho", replace: true });
    });
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null");
      if (saved) {
        setUsername(saved.u || "");
        setPassword(saved.p || "");
        setRemember(true);
      }
    } catch {}
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 3500);
    return () => clearInterval(t);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) return setError("Vui lòng nhập tên đăng nhập và mật khẩu");
    setLoading(true);
    try {
      const r = await signIn({ data: { username, password } });
      if (!r.ok) {
        setLoading(false);
        setError(r.banned ? "Tài khoản đã bị khóa. Liên hệ admin." : "Sai tên đăng nhập hoặc mật khẩu");
        return;
      }
      await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    } catch {
      setLoading(false);
      setError("Không kết nối được, thử lại sau");
      return;
    }
    setLoading(false);
    if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ u: username, p: password }));
    else localStorage.removeItem(REMEMBER_KEY);
    navigate({ to: "/kho", replace: true });
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setFMsg("Đang gửi...");
    await supabase.auth.resetPasswordForEmail(fEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setFMsg("Nếu email có trong hệ thống, thư chứa link đặt lại mật khẩu đã được gửi. Hãy kiểm tra hộp thư (cả mục Spam).");
  }

  const cur = SLIDES[slide]!;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-sans">
      {/* diagonal brand stripes */}
      <div className="pointer-events-none absolute -left-20 -top-40 h-64 w-[160%] -rotate-[12deg]">
        <div className="h-40 stripe-ink" />
        <div className="h-4 bg-brand-orange" />
      </div>
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-64 w-[160%] -rotate-[12deg]">
        <div className="h-4 bg-brand-yellow" />
        <div className="h-48 bg-brand-green" />
      </div>
      <div className="pointer-events-none absolute -left-24 top-24 h-96 w-96 rounded-full bg-brand-orange/20 blur-2xl animate-drift" />
      <div className="pointer-events-none absolute -right-20 bottom-40 h-72 w-72 rounded-full bg-brand-green/20 blur-2xl animate-drift" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-24 lg:grid-cols-2">
        {/* product showcase */}
        <div className="hidden lg:block animate-slide-in">
          <div className="relative h-[460px]">
            {SLIDES.map((s, i) => (
              <img
                key={s.name}
                src={s.src}
                alt={s.name}
                className={`absolute inset-0 m-auto h-full w-full rounded-3xl bg-card object-contain p-4 shadow-card transition-all duration-700 ${
                  i === slide ? "opacity-100 scale-100" : "opacity-0 scale-90"
                } ${i % 2 ? "animate-float-b" : "animate-float-a"}`}
              />
            ))}
          </div>
          <div className="mt-6 flex items-center gap-4">
            <span className={`h-3 w-3 rounded-full ${cur.tone}`} />
            <div>
              <p className="text-lg font-extrabold text-brand-ink">{cur.name}</p>
              <p className="text-sm text-muted-foreground">{cur.tag}</p>
            </div>
            <div className="ml-auto flex gap-2">
              {SLIDES.map((s, i) => (
                <button
                  key={s.name}
                  aria-label={s.name}
                  onClick={() => setSlide(i)}
                  className={`h-2 rounded-full transition-all ${i === slide ? `w-8 ${s.tone}` : "w-2 bg-border"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* login card */}
        <div className="mx-auto w-full max-w-md animate-slide-in [animation-delay:.15s]">
          <div className="overflow-hidden rounded-3xl border-t-8 border-brand-green bg-card shadow-card">
            <div className="px-8 pb-8 pt-6">
              <img src={logo.url} alt="Webond - Bền vững theo thời gian" className="mx-auto -my-6 h-40 object-cover" />
              <h1 className="mt-2 text-center text-2xl font-extrabold text-brand-ink">Quản Lý Kho - Doanh Số</h1>
              <p className="text-center text-sm text-muted-foreground">Đăng nhập để tiếp tục</p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <label className="flex h-12 items-center gap-3 rounded-xl border-2 border-border px-4 transition focus-within:border-brand-green">
                  <User className="h-5 w-5 text-brand-green" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Tên đăng nhập"
                    autoComplete="username"
                    className="flex-1 bg-transparent outline-none"
                  />
                </label>
                <label className="flex h-12 items-center gap-3 rounded-xl border-2 border-border px-4 transition focus-within:border-brand-green">
                  <Lock className="h-5 w-5 text-brand-green" />
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mật khẩu"
                    autoComplete="current-password"
                    className="flex-1 bg-transparent outline-none"
                  />
                  <button type="button" onClick={() => setShow(!show)} aria-label="Hiện mật khẩu" className="text-muted-foreground">
                    {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--brand-green)]" />
                  Ghi nhớ tài khoản và mật khẩu
                  <button type="button" onClick={() => { setForgot(true); setFMsg(""); }} className="ml-auto font-semibold text-brand-green hover:underline">
                    Quên mật khẩu?
                  </button>
                </label>
                {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cta font-bold text-primary-foreground shadow-cta transition hover:brightness-105 active:scale-[.99] disabled:opacity-70"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Đăng nhập
                </button>
              </form>
              {forgot && (
                <form onSubmit={sendReset} className="mt-4 space-y-3 rounded-xl border-2 border-brand-yellow bg-brand-yellow/10 p-4">
                  <p className="text-sm font-semibold text-brand-ink">Lấy lại mật khẩu bằng email</p>
                  <input type="email" required value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="Email đã đăng ký"
                    className="h-11 w-full rounded-lg border-2 border-border bg-card px-3 outline-none focus:border-brand-green" />
                  {fMsg && <p className="text-sm text-brand-ink">{fMsg}</p>}
                  <div className="flex gap-2">
                    <button type="submit" className="h-10 flex-1 rounded-lg bg-brand-green font-bold text-primary-foreground">Gửi link đặt lại</button>
                    <button type="button" onClick={() => setForgot(false)} className="h-10 rounded-lg border px-3 text-sm">Đóng</button>
                  </div>
                  <p className="text-xs text-muted-foreground">Tài khoản chưa có email? Liên hệ admin để đặt lại mật khẩu.</p>
                </form>
              )}
              <p className="mt-6 text-center text-xs text-muted-foreground">© Công ty TNHH Gạch Nhà Việt VIETCASA</p>
            </div>
            <div className="flex h-2">
              <div className="flex-1 stripe-ink" />
              <div className="flex-1 bg-brand-orange" />
              <div className="flex-1 bg-brand-yellow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
