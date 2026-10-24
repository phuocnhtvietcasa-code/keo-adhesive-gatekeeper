import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Users, Warehouse, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function changePw() {
    if (pw.length < 6) return toast.error("Mật khẩu tối thiểu 6 ký tự");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Đã đổi mật khẩu");
    setOpen(false);
    setPw("");
  }

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b-4 border-brand-green stripe-ink px-3 text-sm text-primary-foreground">
      <span className="font-extrabold tracking-wide">WEBOND</span>
      <span className="hidden text-xs opacity-60 sm:inline">Vietcasa</span>
      <nav className="ml-4 flex gap-1">
        <Link to="/kho" className="flex items-center gap-1 rounded-md px-2 py-1 opacity-80 hover:opacity-100 [&.active]:bg-brand-green [&.active]:opacity-100">
          <Warehouse className="h-4 w-4" /> Kho
        </Link>
        {me?.isAdmin && (
          <Link to="/tai-khoan" className="flex items-center gap-1 rounded-md px-2 py-1 opacity-80 hover:opacity-100 [&.active]:bg-brand-green [&.active]:opacity-100">
            <Users className="h-4 w-4" /> Quản lý tài khoản
          </Link>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden sm:inline opacity-80">
          {me?.full_name || me?.username} {me?.isAdmin && <b className="text-brand-yellow">(Admin)</b>}
        </span>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-md px-2 py-1 opacity-80 hover:opacity-100" title="Đổi mật khẩu">
          <KeyRound className="h-4 w-4" />
        </button>
        <button onClick={signOut} className="flex items-center gap-1 rounded-md bg-brand-orange px-2 py-1 font-semibold">
          <LogOut className="h-4 w-4" /> Đăng xuất
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
          </DialogHeader>
          <Input type="password" placeholder="Mật khẩu mới" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Button onClick={changePw}>Lưu</Button>
        </DialogContent>
      </Dialog>
    </header>
  );
}
