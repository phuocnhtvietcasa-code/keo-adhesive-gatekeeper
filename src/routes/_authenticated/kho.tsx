import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/TopBar";

export const Route = createFileRoute("/_authenticated/kho")({
  head: () => ({
    meta: [
      { title: "Quản Lý Kho Xuất Nhập Tồn - Vietcasa" },
      { name: "description", content: "Quản lý kho xuất nhập tồn Webond Vietcasa." },
      { property: "og:title", content: "Quản Lý Kho Xuất Nhập Tồn - Vietcasa" },
      { property: "og:description", content: "Quản lý kho xuất nhập tồn Webond Vietcasa." },
    ],
  }),
  component: KhoPage,
});

function KhoPage() {
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <iframe src="/kho-app.html" title="Quản lý kho" className="w-full flex-1 border-0" />
    </div>
  );
}
