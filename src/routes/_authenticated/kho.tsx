import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { wrapWarehouseHtml } from "@/lib/warehouse-sync-bridge";

const OFFLINE_BANNER_MESSAGE = "Mất kết nối Wi-Fi — Không thể lưu dữ liệu, vui lòng kiểm tra lại mạng!";

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
  const [frameError, setFrameError] = useState("");
  const [githubError, setGithubError] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/kho-app.html", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((source) => {
        if (active) {
          setFrameError("");
          setFrameHtml(wrapWarehouseHtml(source));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFrameError(error instanceof Error ? error.message : "Không thể tải ứng dụng kho.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
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
        setGithubError("");
      } else if (event.data.status === "error" && event.data.apiFailure === true && navigator.onLine) {
        setGithubError(typeof event.data.detail === "string" && event.data.detail
          ? event.data.detail
          : "Lỗi yêu cầu GitHub.");
      }
    };
    window.addEventListener("message", onMessage);
    requestBridgeStatus();
    return () => window.removeEventListener("message", onMessage);
  }, [frameHtml]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      {(!isOnline || githubError) && (
        <div
          role="alert"
          className="z-20 shrink-0 bg-red-700 px-4 py-3 text-center text-sm font-bold text-white shadow-md sm:text-base"
        >
          {!isOnline ? OFFLINE_BANNER_MESSAGE : githubError}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <iframe
          ref={iframeRef}
          srcDoc={frameHtml ?? ""}
          title="Quản lý kho"
          className="h-full w-full border-0"
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: "warehouse-github-sync-handshake" },
              window.location.origin,
            );
          }}
        />
        {!frameHtml && frameError && (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            {frameError}
          </div>
        )}
      </div>
    </div>
  );
}
