import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { wrapWarehouseHtml } from "@/lib/warehouse-sync-bridge";

const INITIAL_SYNC_TIMEOUT_MS = 60_000;

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
  const initialLoadingRef = useRef(true);
  const [frameHtml, setFrameHtml] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"syncing" | "ok" | "error">("syncing");
  const [syncError, setSyncError] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);

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
      .catch((error: unknown) => {
        if (active) {
          initialLoadingRef.current = false;
          setInitialLoading(false);
          setSyncStatus("error");
          setSyncError(error instanceof Error ? error.message : "Không thể tải ứng dụng kho.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!initialLoadingRef.current) return;
      initialLoadingRef.current = false;
      setInitialLoading(false);
      setSyncStatus("error");
      setSyncError("Không nhận được phản hồi đồng bộ từ GitHub.");
    }, INITIAL_SYNC_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const requestBridgeStatus = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "warehouse-github-sync-handshake" },
        window.location.origin,
      );
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data || event.data.type !== "warehouse-github-sync") return;
      if (event.data.status === "ok") {
        initialLoadingRef.current = false;
        setInitialLoading(false);
        setSyncStatus("ok");
        setSyncError("");
      } else if (event.data.status === "error") {
        initialLoadingRef.current = false;
        setInitialLoading(false);
        setSyncStatus("error");
        setSyncError(typeof event.data.detail === "string" && event.data.detail
          ? event.data.detail
          : "Không tải được dữ liệu mới nhất từ GitHub.");
      } else if (event.data.status === "syncing") {
        setSyncStatus((current) => current === "error" ? "error" : "syncing");
      }
    };
    window.addEventListener("message", onMessage);
    requestBridgeStatus();
    return () => window.removeEventListener("message", onMessage);
  }, [frameHtml]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      {syncStatus === "error" && (
        <div
          role="alert"
          className="z-20 shrink-0 bg-red-700 px-4 py-3 text-center text-sm font-bold text-white shadow-md sm:text-base"
        >
          {syncError || "Không tải được dữ liệu mới nhất từ GitHub."}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {frameHtml && (
          <iframe
            ref={iframeRef}
            srcDoc={frameHtml}
            title="Quản lý kho"
            className="h-full w-full border-0"
            onLoad={() => {
              iframeRef.current?.contentWindow?.postMessage(
                { type: "warehouse-github-sync-handshake" },
                window.location.origin,
              );
            }}
          />
        )}
        {frameHtml && initialLoading && (
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
