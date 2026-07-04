const ORDER_WORK_SYNC_URL = "./api/state";
const ORDER_WORK_SYNC_KEY = "order-work-last-remote-saved-at";
const ORDER_WORK_SYNC_INTERVAL_MS = 5000;
const ORDER_WORK_SYNC_BANNER_ID = "orderWorkSyncBanner";
const ORDER_WORK_SYNC_STYLE_ID = "orderWorkSyncStyle";

function ensureSyncStyles() {
  if (document.getElementById(ORDER_WORK_SYNC_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ORDER_WORK_SYNC_STYLE_ID;
  style.textContent = `
    .sync-refresh-banner {
      position: fixed;
      left: 50%;
      bottom: 88px;
      z-index: 30;
      transform: translateX(-50%);
      display: none;
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      background: #1f6f45;
      color: #fff;
      box-shadow: 0 14px 32px rgba(20, 55, 38, 0.22);
      font-size: 15px;
      font-weight: 800;
    }
    .sync-refresh-banner.show {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `;
  document.head.appendChild(style);
}

function isEditingOrder() {
  const active = document.activeElement;
  const editingField = active?.matches?.("input, textarea, select");
  const hasDraftText = ["employeeName", "employeeDept", "orderRemark"].some((id) => {
    const element = document.getElementById(id);
    return element && element.value.trim();
  });
  return Boolean(editingField || hasDraftText);
}

function showSyncBanner() {
  ensureSyncStyles();
  let banner = document.getElementById(ORDER_WORK_SYNC_BANNER_ID);
  if (!banner) {
    banner = document.createElement("button");
    banner.id = ORDER_WORK_SYNC_BANNER_ID;
    banner.className = "sync-refresh-banner";
    banner.type = "button";
    banner.textContent = "桌台单已更新，点此刷新";
    banner.addEventListener("click", () => window.location.reload());
    document.body.appendChild(banner);
  }
  banner.classList.add("show");
}

async function checkSharedTableUpdates() {
  try {
    const response = await fetch(ORDER_WORK_SYNC_URL, { cache: "no-store" });
    if (!response.ok) return;
    const state = await response.json();
    const savedAt = state?.savedAt || "";
    if (!savedAt) return;

    const previous = sessionStorage.getItem(ORDER_WORK_SYNC_KEY);
    sessionStorage.setItem(ORDER_WORK_SYNC_KEY, savedAt);

    if (previous && previous !== savedAt && isEditingOrder()) {
      showSyncBanner();
      return;
    }

    if (previous && previous !== savedAt) {
      window.location.reload();
    }
  } catch {
    // Keep employee ordering usable even when the backend is temporarily unreachable.
  }
}

window.setInterval(checkSharedTableUpdates, ORDER_WORK_SYNC_INTERVAL_MS);
checkSharedTableUpdates();
