import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { wrapWarehouseHtml } from "@/lib/warehouse-sync-bridge";

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameHtml, setFrameHtml] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"syncing" | "ok" | "error">("syncing");
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/kho-app.html", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((source) => {
        if (active) setFrameHtml(wrapWarehouseHtml(source));
      })
      .catch(() => {
        if (active) setSyncStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || event.data.type !== "warehouse-github-sync") return;
      if (event.data.status === "ok" || event.data.status === "syncing" || event.data.status === "error") {
        setSyncStatus(event.data.status);
      }
      if (typeof event.data.ready === "boolean") setRemoteReady(event.data.ready);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      {syncStatus === "error" && (
        <div
          role="alert"
          className="z-20 shrink-0 bg-red-700 px-4 py-3 text-center text-sm font-bold text-white shadow-md sm:text-base"
        >
          Mất kết nối Wi-Fi — Không thể lưu dữ liệu, vui lòng kiểm tra lại mạng!
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {frameHtml && (
          <iframe
            ref={iframeRef}
            srcDoc={frameHtml}
            title="Quản lý kho"
            className="h-full w-full border-0"
          />
        )}
        {frameHtml && !remoteReady && syncStatus !== "error" && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/90 text-sm font-semibold text-foreground">
            Đang tải dữ liệu kho mới nhất từ GitHub...
          </div>
        )}
        {!frameHtml && syncStatus === "error" && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Không thể tải ứng dụng kho.
          </div>
        )}
      </div>
    </div>
  );
}
