const ORDER_WORK_SYNC_URL = "./api/state";
const ORDER_WORK_SYNC_KEY = "order-work-last-remote-saved-at";
const ORDER_WORK_SYNC_INTERVAL_MS = 5000;

async function checkSharedTableUpdates() {
  try {
    const response = await fetch(ORDER_WORK_SYNC_URL, { cache: "no-store" });
    if (!response.ok) return;
    const state = await response.json();
    const savedAt = state?.savedAt || "";
    if (!savedAt) return;

    const previous = sessionStorage.getItem(ORDER_WORK_SYNC_KEY);
    sessionStorage.setItem(ORDER_WORK_SYNC_KEY, savedAt);

    if (previous && previous !== savedAt) {
      window.location.reload();
    }
  } catch {
    // Keep employee ordering usable even when the backend is temporarily unreachable.
  }
}

window.setInterval(checkSharedTableUpdates, ORDER_WORK_SYNC_INTERVAL_MS);
checkSharedTableUpdates();
