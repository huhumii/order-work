const ORDER_WORK_SYNC_URL = "./api/state";
const ORDER_WORK_SYNC_KEY = "order-work-last-remote-saved-at";
const ORDER_WORK_SYNC_INTERVAL_MS = 5000;

function patchEmployeeUxText() {
  document.querySelectorAll("button").forEach((button) => {
    const text = button.textContent.trim();
    if (text === "我想吃") button.textContent = "加入桌台单";
    if (text === "取消想吃") button.textContent = "从桌台单移除";
  });

  const orderLabel = document.querySelector(".order-submit-row .muted");
  if (orderLabel && orderLabel.textContent.trim() === "我已表达想吃") {
    orderLabel.textContent = "我的桌台单";
  }

  const orderTotal = document.getElementById("orderTotal");
  if (orderTotal && orderTotal.textContent.trim() === "¥0") {
    orderTotal.textContent = "0 道";
  }

  const ticketTotal = document.getElementById("tableTicketTotal");
  if (ticketTotal && ticketTotal.textContent.trim() === "¥0") {
    const rows = document.querySelectorAll("#tableTicketList .ticket-row").length;
    ticketTotal.textContent = `已点 ${rows} 道`;
  }
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

    if (previous && previous !== savedAt) {
      if (typeof window.orderWorkSyncFromBackend === "function") {
        await window.orderWorkSyncFromBackend();
      } else {
        window.location.reload();
      }
    }
  } catch {
    // Keep employee ordering usable even when the backend is temporarily unreachable.
  }
}

window.setInterval(checkSharedTableUpdates, ORDER_WORK_SYNC_INTERVAL_MS);
window.setInterval(patchEmployeeUxText, 400);
checkSharedTableUpdates();
patchEmployeeUxText();
