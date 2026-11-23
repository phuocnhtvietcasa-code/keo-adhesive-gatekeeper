type WarehouseData = Record<string, unknown> & {
  products: unknown[];
  txns: unknown[];
};

type GitHubConfig = {
  owner: string;
  repo: string;
  branch?: string;
  mode?: string;
  dataPath?: string;
  filePath?: string;
  token?: string;
  tokenEnc?: string;
  embedConfig?: boolean;
  [key: string]: unknown;
};

type SyncStatus = "syncing" | "ok" | "error";

declare const CloudSync: {
  getConfig: () => GitHubConfig;
  saveConfig: (config: GitHubConfig) => void;
  getToken: (config?: GitHubConfig) => string;
  isGitHubConfigured: (config?: GitHubConfig) => boolean;
  canWriteGitHub: (config?: GitHubConfig) => boolean;
  updateUI: (state?: string, message?: string) => void;
  pullLatest: (options?: Record<string, unknown>) => Promise<boolean | void>;
  pushLatest: (options?: Record<string, unknown>) => Promise<boolean>;
  schedulePush: (force?: boolean) => Promise<boolean> | void;
  [key: string]: unknown;
};
declare let S: WarehouseData;
declare let DIRTY: boolean;
declare function valid(data: unknown): data is WarehouseData;
declare function persist(data: WarehouseData): boolean;
declare function utf8ToBase64(value: string): string;

type WarehouseWindow = Window & {
  closeModal?: () => void;
  rerender?: () => void;
  renderTxn?: (...args: unknown[]) => void;
  renderHistory?: (...args: unknown[]) => void;
  renderRevenue?: (...args: unknown[]) => void;
  renderProducts?: (...args: unknown[]) => void;
  renderReport?: (...args: unknown[]) => void;
  renderDashboard?: (...args: unknown[]) => void;
  renderRecent?: (...args: unknown[]) => void;
  renderRecentIn?: (...args: unknown[]) => void;
  renderRecentOut?: (...args: unknown[]) => void;
  printDoc?: (doc: string) => void;
  toast?: (message: string, type?: string) => void;
  __warehouseRemoteDataLoaded?: boolean;
};

/** This function is serialized into the untouched warehouse HTML at runtime. */
export function bootstrapWarehouseSync() {
  const frameWindow = window as WarehouseWindow;
  const originalGetConfig = CloudSync.getConfig.bind(CloudSync);
  const originalGetToken = CloudSync.getToken.bind(CloudSync);
  const originalSaveConfig = CloudSync.saveConfig.bind(CloudSync);
  const originalToast = frameWindow.toast?.bind(window);
  const originalCloseModal = frameWindow.closeModal?.bind(window);
  const originalPrintDoc = frameWindow.printDoc?.bind(window);
  const originalRenderers: Record<string, (...args: unknown[]) => void> = {};
  const rendererNames = [
    "rerender",
    "renderTxn",
    "renderHistory",
    "renderRevenue",
    "renderProducts",
    "renderReport",
    "renderDashboard",
    "renderRecent",
    "renderRecentIn",
    "renderRecentOut",
  ];
  const disabledState = new WeakMap<HTMLButtonElement | HTMLInputElement, boolean>();
  const queuedToasts: Array<{ message: string; type?: string }> = [];
  const apiRoot = "https://api.github.com";
  const requestTimeoutMs = 45_000;
  let syncStatus: SyncStatus = "syncing";
  let statusDetail = "Đang tải dữ liệu mới nhất từ GitHub";
  let remoteReady = false;
  let busy = false;
  let pullPromise: Promise<boolean> | null = null;
  let commitPromise: Promise<boolean> | null = null;
  let baseData: WarehouseData | null = null;
  let latestRemote: WarehouseData | null = null;
  let lastActionButton: HTMLButtonElement | null = null;
  let loadingButton: HTMLButtonElement | null = null;
  let loadingButtonHtml = "";
  let closeAfterCommit = false;
  let renderAfterCommit = false;
  let printAfterCommit: string | null = null;
  let retryAfterOnline = false;

  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const normalizedConfig = (config: GitHubConfig): GitHubConfig => {
    const storedConfig = { ...config };
    delete storedConfig.filePath;
    delete storedConfig.token;
    const dataPath = config.filePath || config.dataPath || "kho-data.json";
    const tokenEnc = config.tokenEnc || (config.token?.startsWith("WV_ENC3:") ? config.token : undefined);
    return {
      ...storedConfig,
      ...(tokenEnc ? { tokenEnc } : {}),
      mode: "repo",
      dataPath,
      syncHtmlToo: false,
    };
  };

  function getToken(config = getConfig()) {
    const storedToken = config.tokenEnc || (config.token?.startsWith("WV_ENC3:") ? config.token : undefined);
    if (typeof storedToken === "string" && storedToken) {
      try {
        if (storedToken.startsWith("WV_ENC3:")) {
          const binary = atob(storedToken.slice(8));
          const bytes = new Uint8Array(binary.length);
          const salt = new TextEncoder().encode("WebondVietcasa@KhoKeo2026!SecureStore");
          for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index) ^ salt[index % salt.length];
          }
          const decoded = new TextDecoder().decode(bytes);
          const parsed: unknown = JSON.parse(decoded);
          if (typeof parsed === "string") return parsed;
        }
        const parsed: unknown = JSON.parse(storedToken);
        if (typeof parsed === "string") return parsed;
      } catch {
        // Older configurations may contain a plaintext token.
      }
      if (!storedToken.startsWith("WV_ENC3:")) return storedToken;
    }
    return originalGetToken(config);
  }

  function formatSyncTimestamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hourCycle: "h23",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value || "";
    return `Cập nhật lúc ${part("hour")}:${part("minute")} ${part("day")}/${part("month")}/${part("year")}`;
  }

  function getConfig() {
    const config = normalizedConfig(originalGetConfig());
    if (!config.owner || !config.repo) {
      try {
        const parentLocation = window.parent.location;
        if (parentLocation.hostname.endsWith(".github.io")) {
          config.owner = parentLocation.hostname.replace(/\.github\.io$/i, "");
          config.repo = parentLocation.pathname.split("/").filter(Boolean)[0] || `${config.owner}.github.io`;
        }
      } catch {
        // A configured repository remains required when the parent is cross-origin.
      }
    }
    return config;
  }

  function hasWriteAccess(config = getConfig()) {
    return Boolean(config.owner && config.repo && getToken(config));
  }

  function reportToParent() {
    try {
      window.parent.postMessage(
        { type: "warehouse-github-sync", status: syncStatus, ready: remoteReady, detail: statusDetail },
        window.location.origin,
      );
    } catch {
      // The iframe can still report its status in its own header.
    }
  }

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent || event.data?.type !== "warehouse-github-sync-handshake") return;
    reportToParent();
  });

  function isSubmitControl(element: Element): element is HTMLButtonElement | HTMLInputElement {
    if (!(element instanceof HTMLButtonElement || element instanceof HTMLInputElement)) return false;
    if (element instanceof HTMLButtonElement && element.type === "submit") return true;
    if (element instanceof HTMLInputElement && !["button", "submit", "file"].includes(element.type)) return false;
    const action = element.getAttribute("onclick") || "";
    if (element.id === "restoreFile" || action.includes("restoreFile")) return true;
    return /\b(save|submit|delete|delProduct|delTxn|remove|clear|reset|apply|restore|import|pushLatest)[\w$]*\s*\(/i.test(action);
  }

  function refreshButtonLock() {
    const locked = syncStatus !== "ok";
    document.querySelectorAll("button, input[type='button'], input[type='submit'], input[type='file']").forEach((node) => {
      if (!(node instanceof HTMLButtonElement || node instanceof HTMLInputElement) || !isSubmitControl(node)) return;
      const shouldDisable = locked;
      if (shouldDisable) {
        if (!disabledState.has(node)) disabledState.set(node, node.disabled);
        node.disabled = true;
      } else if (disabledState.has(node)) {
        node.disabled = disabledState.get(node) ?? false;
        disabledState.delete(node);
      }
    });
  }

  function setStatus(status: SyncStatus, detail = "") {
    syncStatus = status;
    statusDetail = detail;
    const labels: Record<SyncStatus, string> = {
      syncing: "Đang đồng bộ...",
      ok: "Đã đồng bộ",
      error: "Lỗi đồng bộ",
    };
    const dot = document.getElementById("syncDot");
    const text = document.getElementById("syncTxt");
    const refreshButton = document.getElementById("syncNowBtn");
    if (dot) dot.className = `sync-dot ${status === "ok" ? "ok" : status === "syncing" ? "syncing" : "err"}`;
    if (text) {
      const bold = document.createElement("b");
      bold.textContent = labels[status];
      const small = document.createElement("small");
      small.textContent = detail || (status === "ok" ? "GitHub vừa xác nhận dữ liệu mới nhất" : "");
      text.replaceChildren(bold, small);
    }
    refreshButton?.classList.toggle("spin", status === "syncing");
    refreshButtonLock();
    reportToParent();
  }

  function configError() {
    const config = getConfig();
    if (!config.owner || !config.repo) return new Error("Hãy cấu hình GitHub Repository trước khi đồng bộ.");
    return null;
  }

  function assertOnline() {
    if (!navigator.onLine) throw new Error("Mất kết nối Wi-Fi.");
  }

  function repoFileUrl(config = getConfig()) {
    const path = (config.filePath || config.dataPath || "kho-data.json").replace(/^\/+/, "");
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `${apiRoot}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch || "main")}&_=${Date.now()}`;
  }

  function requestHeaders(config = getConfig()) {
    const token = getToken(config);
    return {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function fetchLatestRemote(signal?: AbortSignal) {
    assertOnline();
    const config = getConfig();
    const setupError = configError();
    if (setupError) throw setupError;
    const response = await fetch(repoFileUrl(config), {
      headers: requestHeaders(config),
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    const metadata = (await response.json()) as {
      sha?: string;
      encoding?: string;
      content?: string;
    };
    if (!metadata.sha) throw new Error("GitHub không trả về SHA của kho-data.json.");
    let encodedContent = metadata.content?.replace(/\s/g, "") || "";
    if (!encodedContent || metadata.encoding !== "base64") {
      const blobUrl = `${apiRoot}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/git/blobs/${encodeURIComponent(metadata.sha)}?_=${Date.now()}`;
      const blobResponse = await fetch(blobUrl, {
        headers: requestHeaders(config),
        cache: "no-store",
        signal,
      });
      if (!blobResponse.ok) throw new Error(`GitHub HTTP ${blobResponse.status}`);
      const blob = (await blobResponse.json()) as { content?: string; encoding?: string };
      encodedContent = blob.content?.replace(/\s/g, "") || "";
      if (!encodedContent || blob.encoding !== "base64") {
        throw new Error("GitHub không trả về nội dung kho-data.json.");
      }
    }
    const binary = atob(encodedContent);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const content = new TextDecoder("utf-8").decode(bytes);
    const data = JSON.parse(content) as WarehouseData;
    if (!valid(data)) throw new Error("kho-data.json không đúng cấu trúc dữ liệu kho.");
    return { data, sha: metadata.sha };
  }

  function objectIdMap(values: unknown[]) {
    const map = new Map<string, Record<string, unknown>>();
    for (const value of values) {
      if (!isRecord(value) || value.id === undefined || value.id === null) return null;
      const key = String(value.id);
      if (map.has(key)) return null;
      map.set(key, value);
    }
    return map;
  }

  function mergeById(base: unknown[], local: unknown[], remote: unknown[]) {
    const baseMap = objectIdMap(base);
    const localMap = objectIdMap(local);
    const remoteMap = objectIdMap(remote);
    if (!baseMap || !localMap || !remoteMap) return null;
    const result = clone(remote);
    const resultPositions = new Map<string, number>();
    result.forEach((value, index) => {
      if (isRecord(value) && value.id !== undefined) resultPositions.set(String(value.id), index);
    });

    for (const [id, baseValue] of baseMap) {
      const localValue = localMap.get(id);
      if (!localValue) {
        const position = resultPositions.get(id);
        if (position !== undefined) {
          result.splice(position, 1);
          resultPositions.clear();
          result.forEach((value, index) => {
            if (isRecord(value) && value.id !== undefined) resultPositions.set(String(value.id), index);
          });
        }
        continue;
      }
      if (equal(localValue, baseValue)) continue;
      const position = resultPositions.get(id);
      if (position === undefined) {
        result.push(clone(localValue));
        resultPositions.set(id, result.length - 1);
      } else {
        result[position] = mergeValue(baseValue, localValue, remoteMap.get(id));
      }
    }

    for (const [id, localValue] of localMap) {
      if (!baseMap.has(id) && !remoteMap.has(id)) result.push(clone(localValue));
    }
    return result;
  }

  function mergePrimitiveArray(base: unknown[], local: unknown[], remote: unknown[]) {
    if (![...base, ...local, ...remote].every((value) => !isRecord(value) && !Array.isArray(value))) return null;
    const result = clone(remote);
    const baseCounts = new Map<string, number>();
    const localCounts = new Map<string, number>();
    const count = (map: Map<string, number>, value: unknown) => {
      const key = JSON.stringify(value);
      map.set(key, (map.get(key) || 0) + 1);
    };
    base.forEach((value) => count(baseCounts, value));
    local.forEach((value) => count(localCounts, value));
    for (const [key, baseCount] of baseCounts) {
      const removed = Math.max(0, baseCount - (localCounts.get(key) || 0));
      for (let index = 0; index < removed; index += 1) {
        const valueIndex = result.findIndex((value) => JSON.stringify(value) === key);
        if (valueIndex >= 0) result.splice(valueIndex, 1);
      }
    }
    for (const [key, localCount] of localCounts) {
      const added = Math.max(0, localCount - (baseCounts.get(key) || 0));
      if (added > 0 && !result.some((value) => JSON.stringify(value) === key)) result.push(JSON.parse(key) as unknown);
    }
    return result;
  }

  function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
    if (equal(local, base)) return clone(remote);
    if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
      return mergeById(base, local, remote) ?? mergePrimitiveArray(base, local, remote) ?? clone(local);
    }
    if (isRecord(base) && isRecord(local) && isRecord(remote)) {
      const result = clone(remote);
      for (const key of Object.keys(base)) {
        if (!(key in local)) delete result[key];
      }
      for (const [key, value] of Object.entries(local)) {
        if (!(key in base)) result[key] = clone(value);
        else if (!equal(value, base[key])) result[key] = mergeValue(base[key], value, remote[key]);
      }
      return result;
    }
    return clone(local);
  }

  function mergeData(base: WarehouseData, local: WarehouseData, remote: WarehouseData) {
    return mergeValue(base, local, remote) as WarehouseData;
  }

  async function putRemote(data: WarehouseData, sha: string, signal?: AbortSignal) {
    assertOnline();
    const config = getConfig();
    const token = getToken(config);
    if (!token) throw new Error("Cần GitHub Token có quyền ghi repository để lưu dữ liệu.");
    const response = await fetch(repoFileUrl(config).split("?")[0], {
      method: "PUT",
      cache: "no-store",
      signal,
      headers: {
        ...requestHeaders(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Cập nhật dữ liệu kho (${new Date().toLocaleString("vi-VN")})`,
        content: utf8ToBase64(JSON.stringify(data)),
        sha,
        branch: config.branch || "main",
      }),
    });
    if (response.status !== 200 && response.status !== 201) {
      let message = `GitHub HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) message = `${message}: ${body.message}`;
      } catch {
        // Keep the HTTP status when the API response has no JSON body.
      }
      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return;
  }

  function installButtonLoading() {
    const candidate = document.activeElement instanceof HTMLButtonElement
      ? document.activeElement
      : lastActionButton;
    if (!candidate || !isSubmitControl(candidate)) return;
    loadingButton = candidate;
    loadingButtonHtml = candidate.innerHTML;
    candidate.innerHTML = '<span class="warehouse-saving-spinner" aria-hidden="true"></span> Đang lưu...';
  }

  function restoreButtonLoading() {
    if (loadingButton?.isConnected) loadingButton.innerHTML = loadingButtonHtml;
    loadingButton = null;
    loadingButtonHtml = "";
    lastActionButton = null;
  }

  function refreshWarehouseUi() {
    originalRenderers.rerender?.([]);
    const refreshChrome = (window as unknown as Record<string, unknown>).refreshChrome;
    const refreshSave = (window as unknown as Record<string, unknown>).refreshSave;
    if (typeof refreshChrome === "function") refreshChrome();
    if (typeof refreshSave === "function") refreshSave();
  }

  function hydrateWarehouseData(data: WarehouseData, includeLocalConfig = false) {
    latestRemote = clone(data);
    const hydrated = clone(data);
    const localConfig = getConfig();
    if (includeLocalConfig && (localConfig.owner || localConfig.repo || localConfig.tokenEnc || localConfig.token)) {
      hydrated.ghSync = { ...((hydrated.ghSync as Record<string, unknown> | undefined) || {}), ...localConfig };
    }
    S = hydrated;
    baseData = clone(data);
    remoteReady = true;
    frameWindow.__warehouseRemoteDataLoaded = true;
    persist(S);
    refreshWarehouseUi();
  }

  function runDeferredUi(success: boolean) {
    busy = false;
    restoreButtonLoading();
    if (success) {
      setStatus("ok", formatSyncTimestamp());
      const refreshChrome = (window as unknown as Record<string, unknown>).refreshChrome;
      const refreshSave = (window as unknown as Record<string, unknown>).refreshSave;
      if (typeof refreshChrome === "function") refreshChrome();
      if (typeof refreshSave === "function") refreshSave();
      if (renderAfterCommit && originalRenderers.rerender) originalRenderers.rerender([]);
      if (closeAfterCommit) originalCloseModal?.();
      if (printAfterCommit) originalPrintDoc?.(printAfterCommit);
      queuedToasts.splice(0).forEach(({ message, type }) => originalToast?.(message, type));
    } else {
      setStatus("error", statusDetail || "Lỗi đồng bộ GitHub");
      if (renderAfterCommit && originalRenderers.rerender) originalRenderers.rerender([]);
      originalCloseModal?.();
      queuedToasts.length = 0;
      originalToast?.("Mất kết nối Wi-Fi — Không thể lưu dữ liệu, vui lòng kiểm tra lại mạng!", "err");
    }
    closeAfterCommit = false;
    renderAfterCommit = false;
    printAfterCommit = null;
    if (retryAfterOnline && navigator.onLine) {
      retryAfterOnline = false;
      queueMicrotask(() => void CloudSync.pullLatest({ manual: false }));
    }
  }

  async function pullLatest(options?: Record<string, unknown>) {
    if (busy) return false;
    if (pullPromise) return pullPromise;
    setStatus("syncing", "Đang tải dữ liệu mới nhất từ GitHub");
    const signal = options?.signal as AbortSignal | undefined;
    pullPromise = (async () => {
      try {
        const { data } = await fetchLatestRemote(signal);
        assertOnline();
        hydrateWarehouseData(data, true);
        if (!hasWriteAccess()) {
          setStatus("error", "Cần GitHub Token có quyền ghi repository.");
          return false;
        }
        setStatus("ok", formatSyncTimestamp());
        return true;
      } catch (error) {
        const message = signal?.aborted
          ? `GitHub request timed out after ${Math.round(requestTimeoutMs / 1000)} seconds.`
          : error instanceof Error ? error.message : "Lỗi kết nối GitHub";
        setStatus("error", message);
        return false;
      } finally {
        pullPromise = null;
      }
    })();
    return pullPromise;
  }

  async function runInitialSync() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      if (!navigator.onLine) throw new Error("Mất kết nối Wi-Fi.");
      const config = getConfig();
      if (!config.owner || !config.repo) throw configError() || new Error("Hãy cấu hình GitHub Repository trước khi đồng bộ.");
      if (!getToken(config)) throw new Error("Cần GitHub Token có quyền ghi repository.");
      await CloudSync.pullLatest({ manual: false, signal: controller.signal });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không tải được dữ liệu mới nhất từ GitHub.";
      setStatus("error", message);
    } finally {
      window.clearTimeout(timeoutId);
      if (syncStatus === "syncing") {
        setStatus("error", "Không tải được dữ liệu mới nhất từ GitHub.");
      }
      reportToParent();
    }
  }

  async function commitLatest() {
    if (commitPromise) return commitPromise;
    if (!navigator.onLine) {
      setStatus("error", "Mất kết nối Wi-Fi.");
      return false;
    }
    if (!remoteReady || !baseData) {
      if (!(await pullLatest())) return false;
    }
    if (!hasWriteAccess()) {
      setStatus("error", "Cần GitHub Token có quyền ghi repository.");
      return false;
    }
    const baseSnapshot = clone(baseData as WarehouseData);
    const localSnapshot = clone(S);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);
    busy = true;
    installButtonLoading();
    setStatus("syncing", "Đang đồng bộ...");
    statusDetail = "Đang đồng bộ...";
    commitPromise = (async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const latest = await fetchLatestRemote(controller.signal);
          latestRemote = clone(latest.data);
          const merged = mergeData(baseSnapshot, localSnapshot, latest.data);
          try {
            await putRemote(merged, latest.sha, controller.signal);
            hydrateWarehouseData(merged, true);
            DIRTY = false;
            runDeferredUi(true);
            return true;
          } catch (error) {
            const status = (error as Error & { status?: number }).status;
            if ((status === 409 || status === 422) && attempt < 2) continue;
            throw error;
          }
        }
        throw new Error("GitHub từ chối cập nhật sau nhiều lần thử. Hãy đồng bộ lại.");
      } catch (error) {
        const message = controller.signal.aborted
          ? `GitHub request timed out after ${Math.round(requestTimeoutMs / 1000)} seconds.`
          : error instanceof Error ? error.message : "Lỗi đồng bộ GitHub";
        if (latestRemote) {
          S = clone(latestRemote);
          baseData = clone(latestRemote);
        } else if (baseData) {
          S = clone(baseData);
        }
        if (S) persist(S);
        statusDetail = message;
        runDeferredUi(false);
        return false;
      } finally {
        window.clearTimeout(timeoutId);
        commitPromise = null;
        if (retryAfterOnline && navigator.onLine) {
          retryAfterOnline = false;
          queueMicrotask(() => void CloudSync.pullLatest({ manual: false }));
        }
      }
    })();
    return commitPromise;
  }

  CloudSync.getConfig = getConfig;
  CloudSync.getToken = getToken;
  CloudSync.saveConfig = (config: GitHubConfig) => {
    originalSaveConfig(normalizedConfig(config));
    setStatus(syncStatus, statusDetail);
  };
  CloudSync.isGitHubConfigured = (config?: GitHubConfig) => {
    const value = config ? normalizedConfig(config) : getConfig();
    return Boolean(value.owner && value.repo);
  };
  CloudSync.canWriteGitHub = (config?: GitHubConfig) => hasWriteAccess(config ? normalizedConfig(config) : getConfig());
  CloudSync.updateUI = () => setStatus(syncStatus, statusDetail);
  CloudSync.pullLatest = pullLatest;
  CloudSync.pushLatest = async (options?: Record<string, unknown>) => {
    const saved = await commitLatest();
    if (saved && options?.manual) originalToast?.("Đã lưu kho-data.json lên GitHub");
    return saved;
  };
  CloudSync.schedulePush = commitLatest;
  CloudSync.createNewGist = async () => {
    throw new Error("Hãy cấu hình GitHub Repository để dùng kho-data.json làm nguồn dữ liệu.");
  };

  if (frameWindow.toast) {
    frameWindow.toast = (message: string, type?: string) => {
      if (busy && type !== "err") {
        queuedToasts.push({ message, type });
        return;
      }
      originalToast?.(message, type);
    };
  }
  if (frameWindow.closeModal && originalCloseModal) {
    frameWindow.closeModal = () => {
      if (busy) {
        closeAfterCommit = true;
        return;
      }
      originalCloseModal();
    };
  }
  if (frameWindow.printDoc && originalPrintDoc) {
    frameWindow.printDoc = (doc: string) => {
      if (busy) {
        printAfterCommit = doc;
        return;
      }
      if (syncStatus === "ok") originalPrintDoc(doc);
    };
  }
  for (const name of rendererNames) {
    const renderer = frameWindow[name as keyof WarehouseWindow];
    if (typeof renderer !== "function") continue;
    const original = renderer as (...args: unknown[]) => void;
    originalRenderers[name] = original;
    (frameWindow as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
      if (busy) {
        renderAfterCommit = true;
        return;
      }
      return original.apply(window, args);
    };
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button, input") : null;
    if (!(target instanceof HTMLButtonElement || target instanceof HTMLInputElement) || !isSubmitControl(target)) return;
    if (syncStatus !== "ok") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (target instanceof HTMLButtonElement) lastActionButton = target;
  }, true);

  new MutationObserver(refreshButtonLock).observe(document.body, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("offline", () => setStatus("error", "Mất kết nối Wi-Fi."));
  window.addEventListener("online", () => {
    if (busy) {
      retryAfterOnline = true;
      return;
    }
    void CloudSync.pullLatest({ manual: false });
  });
  window.addEventListener("focus", () => {
    if (document.visibilityState === "visible" && syncStatus !== "syncing") {
      void CloudSync.pullLatest({ manual: false });
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && syncStatus !== "syncing") {
      void CloudSync.pullLatest({ manual: false });
    }
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible" && syncStatus !== "syncing") {
      void CloudSync.pullLatest({ manual: false });
    }
  }, 25_000);

  const style = document.createElement("style");
  style.textContent = "@keyframes warehouse-save-spin{to{transform:rotate(360deg)}}.warehouse-saving-spinner{display:inline-block;width:12px;height:12px;margin-right:6px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;vertical-align:-2px;animation:warehouse-save-spin .7s linear infinite}";
  document.head.append(style);
  if (!navigator.onLine) setStatus("error", "Mất kết nối Wi-Fi.");
  else setStatus("syncing", "Đang tải dữ liệu mới nhất từ GitHub");
  refreshButtonLock();
  void runInitialSync();
}

export function wrapWarehouseHtml(source: string) {
  const startupPull = "CloudSync.pullLatest({ manual: false });";
  const startupIndex = source.lastIndexOf(startupPull);
  if (startupIndex < 0) throw new Error("Không tìm thấy điểm khởi tạo đồng bộ trong kho-app.html.");
  let wrapped = `${source.slice(0, startupIndex)}window.__warehouseStartupPullSuppressed = true;${source.slice(startupIndex + startupPull.length)}`;
  wrapped = wrapped.replace(
    "if(valid(idbData) && (idbData.updated||0) > (S.updated||0)){",
    "if(!window.__warehouseRemoteDataLoaded && valid(idbData) && (idbData.updated||0) > (S.updated||0)){",
  );
  wrapped = wrapped.replace(/<head([^>]*)>/i, '<head$1><base href="/kho-app.html">');
  const bridgeScript = `<script>(${bootstrapWarehouseSync.toString()})();</script>`;
  return wrapped.replace(/<\/body>/i, `${bridgeScript}</body>`);
}
