const STORAGE_KEY = "cook-order-system-state-v1";
const ADMIN_PASSWORD = "Wu123456";
const EMPLOYEE_DISH_PAGE_SIZE = 18;
const MENU_ROTATE_HOUR = 15;
const API_STATE_URL = "./api/state";

const state = {
  data: null,
  viewMode: "employee",
  isAdminAuthenticated: false,
  activeCategoryId: "all",
  adminSearchTerm: "",
  employeeCategoryId: "all",
  employeeSearchTerm: "",
  employeeQuickFilter: "all",
  employeeVisibleDishLimit: EMPLOYEE_DISH_PAGE_SIZE,
  activePage: "recommendations",
  selectedDishIds: [],
  publishedMenu: null,
  quantities: {},
  dishSpice: {},
  orders: [],
  lastSaveMessage: "",
  activeEmployeeKey: "",
};

let backendEnabled = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const elements = {
  app: $("#app"),
  subtitle: $("#subtitle"),
  employeeModeButton: $("#employeeModeButton"),
  adminModeButton: $("#adminModeButton"),
  adminLoginBox: $("#adminLoginBox"),
  adminContent: $("#adminContent"),
  adminPasswordInput: $("#adminPasswordInput"),
  adminLoginButton: $("#adminLoginButton"),
  quickNav: $("#quickNav"),
  selectionStatus: $("#selectionStatus"),
  menuDate: $("#menuDate"),
  deadlineInput: $("#deadlineInput"),
  templateRow: $("#templateRow"),
  randomMenuButton: $("#randomMenuButton"),
  adminDishSearch: $("#adminDishSearch"),
  newDishCategory: $("#newDishCategory"),
  newDishName: $("#newDishName"),
  newDishPrice: $("#newDishPrice"),
  newDishDesc: $("#newDishDesc"),
  addDishButton: $("#addDishButton"),
  categoryTabs: $("#categoryTabs"),
  dishLibrary: $("#dishLibrary"),
  clearSelectionButton: $("#clearSelectionButton"),
  publishButton: $("#publishButton"),
  publishButtonTop: $("#publishButtonTop"),
  employeeName: $("#employeeName"),
  employeeDept: $("#employeeDept"),
  closedNotice: $("#closedNotice"),
  extendDeadlineButton: $("#extendDeadlineButton"),
  tableTicketTotal: $("#tableTicketTotal"),
  tableTicketList: $("#tableTicketList"),
  recommendedMenu: $("#recommendedMenu"),
  otherDishesButton: $("#otherDishesButton"),
  employeeDishSearch: $("#employeeDishSearch"),
  employeeCategoryTabs: $("#employeeCategoryTabs"),
  quickFilterTabs: $("#quickFilterTabs"),
  todayMenu: $("#todayMenu"),
  menuMoreRow: $("#menuMoreRow"),
  orderRemark: $("#orderRemark"),
  orderTotal: $("#orderTotal"),
  saveStatus: $("#saveStatus"),
  clearCurrentOrderButton: $("#clearCurrentOrderButton"),
  submitOrderButton: $("#submitOrderButton"),
  deadlineStatus: $("#deadlineStatus"),
  orderHint: $("#orderHint"),
  orderCount: $("#orderCount"),
  portionCount: $("#portionCount"),
  summaryTotal: $("#summaryTotal"),
  summaryList: $("#summaryList"),
  exportButton: $("#exportButton"),
  ordersList: $("#ordersList"),
  resetDataButton: $("#resetDataButton"),
  backToTopButton: $("#backToTopButton"),
  toast: $("#toast"),
};

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateStringFrom(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMenuCycleKey(now = new Date()) {
  const cycle = new Date(now);
  if (cycle.getHours() < MENU_ROTATE_HOUR) cycle.setDate(cycle.getDate() - 1);
  return `${dateStringFrom(cycle)}-${MENU_ROTATE_HOUR}`;
}

function money(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
}

function isPastDeadline(date, deadline) {
  return new Date() > new Date(`${date}T${deadline || "10:00"}:00`);
}

function defaultDeadline(deadline = "10:00") {
  return isPastDeadline(todayString(), deadline) ? "23:59" : deadline;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function scrollPanelTo(panel, target) {
  if (!panel || !target) return;
  if (isMobileLayout()) {
    target.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }
  const top = target.offsetTop - panel.offsetTop - 10;
  panel.scrollTo({ top: Math.max(top, 0), behavior: "auto" });
}

function setQuickNavActive(targetId) {
  let activeButton = null;
  $$(".quick-nav-button").forEach((button) => {
    const isActive = button.dataset.navTarget === targetId;
    button.classList.toggle("active", isActive);
    if (isActive) activeButton = button;
  });
  if (activeButton && elements.quickNav.offsetParent !== null) {
    activeButton.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }
}

function visiblePageClasses(pageId) {
  const map = {
    recommendations: ["recommendations-page"],
    order: ["order-page"],
    ticket: ["ticket-page"],
    publish: ["publish-page"],
    library: ["library-page"],
    addDish: ["addDish-page"],
    summary: ["summary-page"],
    records: ["records-page"],
    export: ["export-page"],
  };
  return new Set(map[pageId] || []);
}

function renderPageSections() {
  const visibleClasses = visiblePageClasses(state.activePage);
  $$(".page-section").forEach((section) => {
    const visible = Array.from(visibleClasses).some((className) => section.classList.contains(className));
    section.classList.toggle("page-hidden", !visible);
  });
}

function flattenDishes() {
  return state.data.dish_library.flatMap((category) =>
    category.dishes.map((dish) => ({
      ...dish,
      category_id: category.category_id,
      category_name: category.category_name,
    })),
  );
}

function activeDishes() {
  return flattenDishes().filter((dish) => dish.status === 1);
}

function dishById(id) {
  return flattenDishes().find((dish) => dish.dish_id === id);
}

function findDishEntry(id) {
  for (const category of state.data.dish_library) {
    const index = category.dishes.findIndex((dish) => dish.dish_id === id);
    if (index >= 0) return { category, dish: category.dishes[index], index };
  }
  return null;
}

function syncSelectedDishIds() {
  const activeIds = new Set(activeDishes().map((dish) => dish.dish_id));
  state.selectedDishIds = state.selectedDishIds.filter((id) => activeIds.has(id)).slice(0, 6);
}

function mergeDishLibrary(savedLibrary, defaultLibrary) {
  if (!savedLibrary) return defaultLibrary;
  const savedByCategory = new Map(savedLibrary.map((category) => [String(category.category_id), category]));
  const merged = defaultLibrary.map((defaultCategory) => {
    const savedCategory = savedByCategory.get(String(defaultCategory.category_id));
    if (!savedCategory) return defaultCategory;
    const savedDishes = savedCategory.dishes || [];
    const savedIds = new Set(savedDishes.map((dish) => dish.dish_id));
    return {
      ...defaultCategory,
      category_name: savedCategory.category_name || defaultCategory.category_name,
      dishes: [
        ...savedDishes,
        ...defaultCategory.dishes.filter((dish) => !savedIds.has(dish.dish_id)),
      ],
    };
  });
  const defaultCategoryIds = new Set(defaultLibrary.map((category) => String(category.category_id)));
  savedLibrary.forEach((savedCategory) => {
    if (!defaultCategoryIds.has(String(savedCategory.category_id))) merged.push(savedCategory);
  });
  return merged;
}

function snapshotState() {
  syncSelectedDishIds();
  return {
    selectedDishIds: state.selectedDishIds,
    publishedMenu: state.publishedMenu,
    orders: state.orders,
    dishLibrary: state.data?.dish_library,
    savedAt: new Date().toISOString(),
  };
}

function applySavedState(saved) {
  if (!saved || typeof saved !== "object") return;
  if (saved.dishLibrary) state.data.dish_library = mergeDishLibrary(saved.dishLibrary, state.data.dish_library);
  state.selectedDishIds = saved.selectedDishIds || state.selectedDishIds;
  state.publishedMenu = saved.publishedMenu || state.publishedMenu;
  state.orders = saved.orders || [];
  syncSelectedDishIds();
}

function persist() {
  const payload = snapshotState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  if (backendEnabled) {
    fetch(API_STATE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      backendEnabled = false;
    });
  }
}

async function restore() {
  try {
    const response = await fetch(API_STATE_URL, { cache: "no-store" });
    if (response.ok) {
      const saved = await response.json();
      backendEnabled = true;
      applySavedState(saved);
      return;
    }
  } catch {
    backendEnabled = false;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    applySavedState(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function randomMenuIds() {
  const dishes = activeDishes();
  return dishes
    .map((dish) => ({ id: dish.dish_id, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 6)
    .map((entry) => entry.id);
}

function seededRandomMenuIds(seed) {
  const dishes = activeDishes();
  let hash = 2166136261;
  String(seed).split("").forEach((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return dishes
    .map((dish, index) => {
      let value = hash ^ Math.imul(dish.dish_id + index + 1, 2654435761);
      value ^= value >>> 16;
      value = Math.imul(value, 2246822507);
      value ^= value >>> 13;
      return { id: dish.dish_id, sort: value >>> 0 };
    })
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 6)
    .map((entry) => entry.id);
}

function defaultMenu() {
  return seededRandomMenuIds(currentMenuCycleKey());
}

function ensureAutoRecommendedMenu() {
  const cycleKey = currentMenuCycleKey();
  if (state.publishedMenu?.menu_cycle_key === cycleKey && state.selectedDishIds.length) return;
  state.selectedDishIds = seededRandomMenuIds(cycleKey);
  state.publishedMenu = {
    date: todayString(),
    order_deadline: defaultDeadline(state.data.daily_menu_template.order_deadline),
    selected_dish_ids: [...state.selectedDishIds],
    menu_cycle_key: cycleKey,
    remark: "15:00 自动推荐菜单",
  };
  persist();
}

function generateRandomMenu() {
  if (!state.isAdminAuthenticated) return;
  state.selectedDishIds = randomMenuIds();
  if (state.publishedMenu) {
    state.publishedMenu.selected_dish_ids = [...state.selectedDishIds];
    state.publishedMenu.menu_cycle_key = currentMenuCycleKey();
  }
  persist();
  render();
  showToast("已随机生成 6 道参考菜，员工仍可从全部菜品里选择");
}

function isOrderClosed() {
  const menu = state.publishedMenu;
  if (!menu) return false;
  return isPastDeadline(menu.date, menu.order_deadline);
}

function selectedDishes() {
  return activeDishes();
}

function currentMenuDate() {
  return state.publishedMenu?.date || elements.menuDate.value || todayString();
}

function currentOrders() {
  const date = currentMenuDate();
  return state.orders.filter((order) => order.date === date);
}

function employeeIdentityMatches(order, name, dept) {
  return order.date === currentMenuDate() && order.employee_name === name && (order.department || "") === dept;
}

function employeeKey(name = elements.employeeName.value.trim(), dept = elements.employeeDept.value.trim()) {
  return `${currentMenuDate()}::${name}::${dept}`;
}

function resetDraftIfIdentityChanged() {
  const name = elements.employeeName.value.trim();
  const nextKey = name ? employeeKey(name, elements.employeeDept.value.trim()) : "";
  if (state.activeEmployeeKey && nextKey !== state.activeEmployeeKey) {
    state.quantities = {};
    state.dishSpice = {};
    elements.orderRemark.value = "";
    state.activeEmployeeKey = nextKey;
    renderRecommendedMenu();
    renderTodayMenu();
    renderOrderTotal();
    renderQuickFilters();
  }
}

function filteredEmployeeDishes() {
  const keyword = state.employeeSearchTerm.trim().toLowerCase();
  return selectedDishes().filter((dish) => {
    const categoryMatches = state.employeeCategoryId === "all" || String(dish.category_id) === String(state.employeeCategoryId);
    const keywordMatches = !keyword || `${dish.dish_name} ${dish.description} ${dish.category_name}`.toLowerCase().includes(keyword);
    const quickFilterMatches =
      state.employeeQuickFilter === "all" ||
      (state.employeeQuickFilter === "mine" && (state.quantities[dish.dish_id] || 0) > 0) ||
      (state.employeeQuickFilter === "popular" && dishInterestCount(dish.dish_id) > 0);
    return categoryMatches && keywordMatches && quickFilterMatches;
  });
}

function orderTotal() {
  return selectedDishes().reduce((sum, dish) => {
    return sum + Math.min(state.quantities[dish.dish_id] || 0, 1) * dish.price;
  }, 0);
}

function currentSelectionCount() {
  return selectedDishes().reduce((sum, dish) => sum + Math.min(state.quantities[dish.dish_id] || 0, 1), 0);
}

function missingSpiceCount() {
  return selectedDishes().reduce((sum, dish) => {
    const selected = Math.min(state.quantities[dish.dish_id] || 0, 1);
    return sum + (selected && !state.dishSpice[dish.dish_id] ? 1 : 0);
  }, 0);
}

function selectionKeyFromQuantities(quantities) {
  return selectionKeyFromState(quantities, state.dishSpice);
}

function selectionKeyFromState(quantities, spices) {
  return selectedDishes()
    .map((dish) => `${dish.dish_id}:${Math.min(quantities[dish.dish_id] || 0, 1)}:${spices[dish.dish_id] || ""}`)
    .join("|");
}

function selectionKeyFromOrder(order) {
  if (!order) return selectionKeyFromQuantities({});
  const quantities = {};
  const spices = {};
  order.items.forEach((item) => {
    quantities[item.dish_id] = Math.min(item.quantity || 0, 1);
    if (item.quantity > 0) spices[item.dish_id] = item.spice_level || order.spice_level || "";
  });
  return selectionKeyFromState(quantities, spices);
}

function summaryRows() {
  return selectedDishes().map((dish) => {
    const interestCount = dishInterestCount(dish.dish_id);
    const count = interestCount > 0 ? 1 : 0;
    return {
      ...dish,
      count,
      interestCount,
      amount: count * dish.price,
    };
  });
}

function dishInterestCount(dishId) {
  return currentOrders().reduce((sum, order) => {
    const item = order.items.find((entry) => entry.dish_id === dishId);
    return sum + Math.min(item?.quantity || 0, 1);
  }, 0);
}

function dishDiners(dishId) {
  return currentOrders()
    .filter((order) => order.items.some((item) => item.dish_id === dishId && item.quantity > 0))
    .map((order) => order.employee_name);
}

function dishDinerLabels(dishId) {
  return currentOrders()
    .map((order) => {
      const item = order.items.find((entry) => entry.dish_id === dishId && entry.quantity > 0);
      if (!item) return "";
      return `${order.employee_name}(${item.spice_level || order.spice_level || "未选辣度"})`;
    })
    .filter(Boolean);
}

function renderTemplates() {
  if (!elements.randomMenuButton || !elements.templateRow.contains(elements.randomMenuButton)) {
    elements.templateRow.innerHTML = "";
    const button = document.createElement("button");
    button.className = "template-button";
    button.id = "randomMenuButton";
    button.type = "button";
    button.textContent = "随机生成 6 道菜";
    button.addEventListener("click", generateRandomMenu);
    elements.templateRow.appendChild(button);
    elements.randomMenuButton = button;
  }
  elements.randomMenuButton.disabled = activeDishes().length < 6;
  elements.randomMenuButton.title = activeDishes().length >= 6 ? "从当前菜品库随机挑选 6 道参考菜" : "菜品少于 6 道，暂不能随机生成";
}

function renderCategories() {
  const categories = [{ category_id: "all", category_name: "全部" }, ...state.data.dish_library];
  elements.categoryTabs.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button ${String(state.activeCategoryId) === String(category.category_id) ? "active" : ""}`;
    button.textContent = category.category_name;
    button.addEventListener("click", () => {
      state.activeCategoryId = category.category_id;
      renderDishLibrary();
      renderCategories();
    });
    elements.categoryTabs.appendChild(button);
  });
}

function renderNewDishCategories() {
  elements.newDishCategory.innerHTML = "";
  state.data.dish_library.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.category_id;
    option.textContent = category.category_name;
    elements.newDishCategory.appendChild(option);
  });
}

function renderEmployeeCategories() {
  const categories = [{ category_id: "all", category_name: "全部" }, ...state.data.dish_library];
  elements.employeeCategoryTabs.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button ${String(state.employeeCategoryId) === String(category.category_id) ? "active" : ""}`;
    button.textContent = category.category_name;
    button.addEventListener("click", () => {
      state.employeeCategoryId = category.category_id;
      state.employeeVisibleDishLimit = EMPLOYEE_DISH_PAGE_SIZE;
      renderEmployeeCategories();
      renderTodayMenu();
    });
    elements.employeeCategoryTabs.appendChild(button);
  });
}

function renderQuickFilters() {
  const filters = [
    { id: "all", label: "全部菜" },
    { id: "mine", label: "我已选择" },
    { id: "popular", label: "大家想吃" },
  ];
  elements.quickFilterTabs.innerHTML = "";
  filters.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button ${state.employeeQuickFilter === filter.id ? "active" : ""}`;
    button.textContent = filter.label;
    button.addEventListener("click", () => {
      state.employeeQuickFilter = filter.id;
      state.employeeVisibleDishLimit = EMPLOYEE_DISH_PAGE_SIZE;
      renderQuickFilters();
      renderTodayMenu();
    });
    elements.quickFilterTabs.appendChild(button);
  });
}

function recommendedDishes() {
  const chosen = state.selectedDishIds
    .map((id) => dishById(id))
    .filter((dish) => dish && dish.status === 1)
    .slice(0, 6);
  if (chosen.length) return chosen;
  return selectedDishes().slice(0, 6);
}

function dishCardHtml(dish, quantity, closed, compact = false) {
  const interestCount = dishInterestCount(dish.dish_id);
  const diners = dishDinerLabels(dish.dish_id);
  const dinerText = diners.length ? "详情看桌台单" : "还没人想吃";
  const selectedSpice = state.dishSpice[dish.dish_id] || "";
  const spiceMissing = quantity && !selectedSpice;
  return `
    <div class="menu-card-top">
      <div>
        <div class="dish-name">${dish.dish_name}</div>
        <div class="dish-desc">${dish.description}</div>
        <span class="category-label">${compact ? "今日推荐" : dish.category_name}</span>
      </div>
      <div class="dish-price">${money(dish.price)}</div>
    </div>
    ${quantity ? `
      <div class="dish-spice-row ${spiceMissing ? "missing" : ""}">
        <span>这道菜辣度</span>
        <div class="dish-spice-options" role="group" aria-label="${dish.dish_name}辣度">
          ${["无", "微辣", "中辣"].map((spice) => `
            <button class="spice-chip ${selectedSpice === spice ? "active" : ""}" type="button" data-action="spice" data-id="${dish.dish_id}" data-spice="${spice}" ${closed ? "disabled" : ""}>${spice}</button>
          `).join("")}
        </div>
      </div>
    ` : ""}
    <div class="table-order-row">
      <div class="table-count">
        <span>想吃人数</span>
        <strong>${interestCount} 人</strong>
        <small>${dinerText}</small>
      </div>
      <button class="table-toggle ${quantity ? "selected" : ""}" type="button" data-action="toggle" data-id="${dish.dish_id}" ${closed ? "disabled" : ""}>
        ${quantity ? "取消想吃" : "我想吃"}
      </button>
    </div>
  `;
}

function renderRecommendedMenu() {
  const closed = isOrderClosed();
  const dishes = recommendedDishes();
  elements.recommendedMenu.innerHTML = "";
  if (!state.publishedMenu) {
    elements.recommendedMenu.innerHTML = '<div class="empty-state">今日推荐尚未发布，管理员发布后这里会显示 6 道推荐菜。</div>';
    return;
  }
  dishes.forEach((dish) => {
    const quantity = Math.min(state.quantities[dish.dish_id] || 0, 1);
    const card = document.createElement("article");
    card.className = `menu-card recommended-card ${quantity ? "selected" : ""}`;
    card.innerHTML = dishCardHtml(dish, quantity, closed, true);
    elements.recommendedMenu.appendChild(card);
  });
}

function renderDishLibrary() {
  const keyword = state.adminSearchTerm.trim().toLowerCase();
  const dishes = flattenDishes().filter((dish) => {
    const categoryMatches = state.activeCategoryId === "all" || String(dish.category_id) === String(state.activeCategoryId);
    const keywordMatches = !keyword || `${dish.dish_name} ${dish.description} ${dish.category_name}`.toLowerCase().includes(keyword);
    return categoryMatches && keywordMatches;
  });
  elements.dishLibrary.innerHTML = "";

  if (!dishes.length) {
    elements.dishLibrary.innerHTML = '<div class="empty-state">没有找到匹配的菜品，换个关键词试试。</div>';
    return;
  }

  dishes.forEach((dish) => {
    const row = document.createElement("div");
    row.className = "dish-row admin-editing";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.title = "加入今日 6 道参考菜";
    checkbox.checked = state.selectedDishIds.includes(dish.dish_id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked && state.selectedDishIds.length >= 6) {
        checkbox.checked = false;
        showToast("每日菜单最多选择 6 道菜");
        return;
      }
      state.selectedDishIds = checkbox.checked
        ? [...state.selectedDishIds, dish.dish_id]
        : state.selectedDishIds.filter((id) => id !== dish.dish_id);
      render();
    });

    const editor = document.createElement("div");
    editor.className = "dish-edit-grid";
    editor.innerHTML = `
      <label>
        菜名
        <input type="text" data-field="dish_name" value="${escapeHtml(dish.dish_name)}" />
      </label>
      <label>
        价格
        <input type="number" min="0" step="1" data-field="price" value="${escapeHtml(dish.price)}" />
      </label>
      <label>
        描述
        <input type="text" data-field="description" value="${escapeHtml(dish.description)}" />
      </label>
      <button class="secondary-button" type="button" data-action="save-dish" data-id="${dish.dish_id}">保存</button>
      <button class="ghost-button" type="button" data-action="delete-dish" data-id="${dish.dish_id}">删除</button>
    `;

    row.append(checkbox, editor);
    elements.dishLibrary.appendChild(row);
  });
}

function renderSelectionStatus() {
  const count = state.selectedDishIds.length;
  elements.selectionStatus.textContent = `参考 ${count} / 6`;
  elements.selectionStatus.classList.toggle("warning", count !== 6);
  elements.publishButton.disabled = count === 0;
  elements.publishButtonTop.disabled = count === 0;
  elements.publishButton.title = count ? "发布今日点餐，参考菜单不会限制员工选择" : "至少保留 1 道参考菜后再发布";
  elements.publishButtonTop.title = elements.publishButton.title;
}

function renderTodayMenu() {
  const allDishes = selectedDishes();
  const dishes = filteredEmployeeDishes();
  const closed = isOrderClosed();
  const isBrowsingAll =
    state.employeeCategoryId === "all" &&
    state.employeeQuickFilter === "all" &&
    !state.employeeSearchTerm.trim();
  const shouldLimit = isBrowsingAll && dishes.length > EMPLOYEE_DISH_PAGE_SIZE;
  const visibleDishes = shouldLimit ? dishes.slice(0, state.employeeVisibleDishLimit) : dishes;

  elements.deadlineStatus.textContent = state.publishedMenu
    ? `${closed ? "已截止" : "截止"} ${state.publishedMenu.order_deadline}`
    : "待发布";
  elements.deadlineStatus.classList.toggle("closed", closed);
  elements.closedNotice.classList.toggle("show", Boolean(state.publishedMenu && closed));
  elements.extendDeadlineButton.style.display = state.viewMode === "admin" ? "" : "none";
  elements.orderHint.textContent = state.publishedMenu
    ? `首页推荐 6 道菜；每天 15:00 自动换一组。想吃别的菜，可以一键查看全部 ${allDishes.length} 道。${closed ? "已过截止时间，员工端已锁定。" : "截止前可修改。"}`
    : "管理员发布今日菜单后，员工即可点餐。";

  elements.todayMenu.innerHTML = "";
  elements.menuMoreRow.innerHTML = "";
  if (!state.publishedMenu) {
    elements.todayMenu.innerHTML = '<div class="empty-state">今日点餐尚未发布。发布后员工可从完整菜品库中选择，随机参考菜单不会限制可选范围。</div>';
    elements.submitOrderButton.disabled = true;
    return;
  }

  if (!dishes.length) {
    elements.todayMenu.innerHTML = '<div class="empty-state">没有找到匹配的菜品，换个关键词或分类试试。</div>';
  }

  visibleDishes.forEach((dish) => {
    const card = document.createElement("article");
    const quantity = Math.min(state.quantities[dish.dish_id] || 0, 1);
    card.className = `menu-card ${quantity ? "selected" : ""}`;
    card.innerHTML = dishCardHtml(dish, quantity, closed);
    elements.todayMenu.appendChild(card);
  });

  if (shouldLimit) {
    const hasMore = state.employeeVisibleDishLimit < dishes.length;
    elements.menuMoreRow.innerHTML = hasMore
      ? `<span class="auto-load-hint">下滑自动加载更多菜（${visibleDishes.length}/${dishes.length}）</span>`
      : `<span class="auto-load-hint">已显示全部 ${dishes.length} 道菜</span>`;
  } else if (dishes.length) {
    elements.menuMoreRow.innerHTML = `<span>已显示 ${dishes.length} 道，可用搜索或分类快速找菜。</span>`;
  }

  elements.submitOrderButton.disabled = closed;
  elements.submitOrderButton.title = closed ? "已过截止时间，请先延长截止时间" : "提交点餐";
  elements.orderRemark.disabled = closed;
  elements.employeeName.disabled = closed;
  elements.employeeDept.disabled = closed;
}

function canAutoLoadEmployeeDishes() {
  if (state.viewMode !== "employee" || state.activePage !== "order") return false;
  if (state.employeeCategoryId !== "all") return false;
  if (state.employeeQuickFilter !== "all") return false;
  if (state.employeeSearchTerm.trim()) return false;
  return filteredEmployeeDishes().length > state.employeeVisibleDishLimit;
}

function maybeAutoLoadEmployeeDishes(scroller = window) {
  if (!canAutoLoadEmployeeDishes()) return;
  const threshold = 560;
  const isWindow = scroller === window;
  const distanceToBottom = isWindow
    ? document.documentElement.scrollHeight - (window.scrollY + window.innerHeight)
    : scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight);
  if (distanceToBottom > threshold) return;

  const total = filteredEmployeeDishes().length;
  state.employeeVisibleDishLimit = Math.min(state.employeeVisibleDishLimit + EMPLOYEE_DISH_PAGE_SIZE, total);
  renderTodayMenu();
}

function currentOrderScrollTop() {
  const orderPanel = $("#orderPanel");
  return Math.max(window.scrollY || 0, orderPanel?.scrollTop || 0);
}

function updateBackToTopVisibility() {
  if (!elements.backToTopButton) return;
  const shouldShow =
    state.viewMode === "employee" &&
    state.activePage === "order" &&
    currentOrderScrollTop() > 520;
  elements.backToTopButton.classList.toggle("show", shouldShow);
}

function updateMobileSearchDock() {
  const shouldDock =
    window.innerWidth <= 900 &&
    state.viewMode === "employee" &&
    state.activePage === "order" &&
    currentOrderScrollTop() > 310;
  elements.app.classList.toggle("mobile-search-docked", shouldDock);
}

function backToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  const orderPanel = $("#orderPanel");
  if (orderPanel) orderPanel.scrollTo({ top: 0, behavior: "smooth" });
  window.setTimeout(() => {
    updateBackToTopVisibility();
    updateMobileSearchDock();
  }, 260);
}

function renderOrderTotal() {
  const count = currentSelectionCount();
  elements.orderTotal.textContent = `${count} 道`;
}

function renderMode() {
  const canSeePrices = state.viewMode === "admin" && state.isAdminAuthenticated;
  elements.app.dataset.page = state.activePage;
  elements.app.classList.toggle("employee-mode", state.viewMode === "employee");
  elements.app.classList.toggle("admin-mode", state.viewMode === "admin");
  elements.app.classList.toggle("admin-locked", state.viewMode === "admin" && !state.isAdminAuthenticated);
  elements.app.classList.toggle("prices-hidden", !canSeePrices);
  elements.employeeModeButton.classList.toggle("active", state.viewMode === "employee");
  elements.adminModeButton.classList.toggle("active", state.viewMode === "admin");
  setQuickNavActive(state.activePage);
  renderPageSections();
  renderPageHeading();
  updateBackToTopVisibility();
  updateMobileSearchDock();
}

function renderPageHeading() {
  const employeeHeadings = {
    recommendations: ["今日菜单推荐", "首页推荐 6 道菜；每天 15:00 自动换一组。想吃别的菜，可以一键查看全部菜。"],
    order: ["全部菜", `从全部 ${selectedDishes().length} 道菜里搜索或按分类选择。`],
    ticket: ["今日桌台单", "这里只显示已经点了的菜品。"],
  };
  const adminHeadings = {
    publish: ["管理员发布", "设置日期、截止时间，并维护今日推荐菜单。"],
    library: ["菜品库管理", "查看、搜索、修改菜品和价格。"],
    addDish: ["新增菜品", "向菜品库添加新菜。"],
    summary: ["桌台账单", "发给饭店前核对整桌汇总。"],
    records: ["点菜记录", "查看员工提交记录。"],
    export: ["导出报单", "导出含价格和明细的 Excel 报单。"],
  };
  if (state.viewMode === "employee") {
    const [title, hint] = employeeHeadings[state.activePage] || employeeHeadings.recommendations;
    $("#orderTitle").textContent = title;
    elements.orderHint.textContent = hint;
    return;
  }
  const [title, hint] = adminHeadings[state.activePage] || adminHeadings.publish;
  const adminTitle = $("#adminTitle");
  if (adminTitle) adminTitle.textContent = title;
  const adminHint = $("#adminPublishArea p");
  if (adminHint) adminHint.textContent = hint;
  const summaryTitle = $("#summaryTitle");
  if (summaryTitle) summaryTitle.textContent = title;
  const summaryHint = $(".summary-panel .panel-heading p");
  if (summaryHint) summaryHint.textContent = hint;
}

function navigateTo(targetId) {
  const adminTargets = new Set(["publish", "library", "addDish", "export", "summary", "records"]);
  if (adminTargets.has(targetId)) {
    state.viewMode = "admin";
    state.activePage = targetId;
    render();
    if (!state.isAdminAuthenticated) {
      elements.adminPasswordInput.focus();
      showToast("请先登录管理员");
      setQuickNavActive(targetId);
      return;
    }
  } else {
    state.viewMode = "employee";
    state.activePage = targetId;
    render();
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    $$(".panel").forEach((panel) => panel.scrollTo?.({ top: 0, behavior: "auto" }));
    if (targetId === "export") elements.exportButton.focus();
    if (targetId === "addDish") elements.newDishName.focus();
    setQuickNavActive(targetId);
    updateBackToTopVisibility();
  });
}

function renderSaveStatus() {
  const name = elements.employeeName.value.trim();
  const dept = elements.employeeDept.value.trim();
  const order = state.orders.find((entry) => employeeIdentityMatches(entry, name, dept));
  const hasSelection = currentSelectionCount() > 0;
  const missingSpices = missingSpiceCount();
  const hasUnsavedChange = Boolean(name && selectionKeyFromQuantities(state.quantities) !== selectionKeyFromOrder(order));

  elements.clearCurrentOrderButton.disabled = !hasSelection;

  if (!state.publishedMenu) {
    elements.saveStatus.textContent = "等待管理员发布";
    elements.saveStatus.classList.remove("saved");
    elements.submitOrderButton.disabled = true;
    elements.clearCurrentOrderButton.disabled = true;
    return;
  }
  if (!name) {
    elements.saveStatus.textContent = state.lastSaveMessage || "填写姓名后保存";
    elements.saveStatus.classList.toggle("saved", Boolean(state.lastSaveMessage));
    elements.submitOrderButton.disabled = isOrderClosed() || !hasSelection;
    elements.submitOrderButton.title = hasSelection ? "点击后会提示需要填写姓名" : "请先选择菜品";
    if (isOrderClosed()) elements.submitOrderButton.title = "已过截止时间";
    return;
  }
  if (hasUnsavedChange) {
    elements.saveStatus.textContent = missingSpices
      ? `有 ${missingSpices} 道菜未选辣度`
      : hasSelection ? `有未保存变更：${currentSelectionCount()} 道` : "已清空，保存后取消点菜";
    elements.saveStatus.classList.remove("saved");
    elements.submitOrderButton.disabled = isOrderClosed() || (!hasSelection && !order);
    elements.submitOrderButton.title = hasSelection || order ? "保存本次修改" : "请至少选择 1 道菜";
    return;
  }
  if (order) {
    const count = order.items.reduce((sum, item) => sum + Math.min(item.quantity || 0, 1), 0);
    elements.saveStatus.textContent = `已保存：${count} 道`;
    elements.saveStatus.classList.add("saved");
    elements.submitOrderButton.disabled = isOrderClosed();
    elements.submitOrderButton.title = isOrderClosed() ? "已过截止时间" : "保存到桌台单";
    return;
  }
  if (state.lastSaveMessage) {
    elements.saveStatus.textContent = state.lastSaveMessage;
    elements.saveStatus.classList.add("saved");
    elements.submitOrderButton.disabled = true;
    elements.submitOrderButton.title = "请先选择菜品";
    return;
  }
  elements.saveStatus.textContent = "尚未保存";
  elements.saveStatus.classList.remove("saved");
  elements.submitOrderButton.disabled = true;
  elements.submitOrderButton.title = "请先选择菜品";
}

function renderTableTicket() {
  const rows = summaryRows().filter((row) => row.count > 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const canSeePrices = state.viewMode === "admin" && state.isAdminAuthenticated;
  elements.tableTicketTotal.textContent = money(totalAmount);
  elements.tableTicketList.innerHTML = "";

  if (!rows.length) {
    elements.tableTicketList.innerHTML = '<div class="ticket-empty">还没有点菜。</div>';
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "ticket-row";
    item.innerHTML = `
      <div>
        <strong>${row.dish_name} x ${row.count}</strong>
      </div>
      ${canSeePrices ? `<div class="ticket-amount">${money(row.amount)}</div>` : ""}
    `;
    elements.tableTicketList.appendChild(item);
  });
}

function renderSummary() {
  const rows = summaryRows();
  const visibleRows = rows.filter((row) => row.count > 0);
  const totalPortions = rows.reduce((sum, row) => sum + row.count, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
  const orders = currentOrders();

  elements.orderCount.textContent = orders.length;
  elements.portionCount.textContent = totalPortions;
  elements.summaryTotal.textContent = money(totalAmount);
  renderTableTicket();

  elements.summaryList.innerHTML = "";
  if (!visibleRows.length) {
    elements.summaryList.innerHTML = '<div class="empty-state">还没有员工选择想吃的菜。</div>';
  } else {
    visibleRows.forEach((row) => {
      const item = document.createElement("div");
      item.className = "summary-row";
      item.innerHTML = `
        <div>
          <strong>${row.dish_name}</strong>
          <span>${money(row.price)} / 份 · ${row.interestCount} 人想吃</span>
        </div>
        <div>
          <strong>${row.count} 份</strong>
          <span>${money(row.amount)}</span>
        </div>
      `;
      elements.summaryList.appendChild(item);
    });
  }

  elements.exportButton.disabled = !orders.length;
  elements.exportButton.title = orders.length ? "导出 Excel 报单" : "当前日期暂无订单，提交点餐后才能导出";
  renderOrdersList();
}

function renderOrdersList() {
  elements.ordersList.innerHTML = "";
  const orders = currentOrders();
  if (!orders.length) {
    elements.ordersList.innerHTML = '<div class="empty-state">当前日期暂无点菜记录。</div>';
    return;
  }

  orders.slice().reverse().forEach((order) => {
    const row = document.createElement("div");
    row.className = "order-row";
    const itemText = order.items
      .filter((item) => item.quantity > 0)
      .map((item) => `${dishById(item.dish_id)?.dish_name || item.dish_id} x${item.quantity} · ${item.spice_level || order.spice_level || "未选辣度"}`)
      .join("，");
    row.innerHTML = `
      <strong>${order.employee_name} · ${order.department || "未填部门"} · ${money(order.amount)}</strong>
      <p>${itemText || "未选择菜品"}</p>
      <p>${order.remark ? `备注：${order.remark}` : "无备注"}</p>
    `;
    elements.ordersList.appendChild(row);
  });
}

function nextDishId() {
  const max = flattenDishes().reduce((currentMax, dish) => {
    const value = Number(String(dish.dish_id).replace(/\D/g, ""));
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 0);
  return `D${String(max + 1).padStart(3, "0")}`;
}

function addDish() {
  if (!state.isAdminAuthenticated) return;
  const category = state.data.dish_library.find((entry) => String(entry.category_id) === String(elements.newDishCategory.value));
  const name = elements.newDishName.value.trim();
  const description = elements.newDishDesc.value.trim() || "管理员新增菜品";
  const price = Number(elements.newDishPrice.value);
  if (!category) {
    showToast("请选择菜品分类");
    return;
  }
  if (!name) {
    showToast("请填写菜名");
    elements.newDishName.focus();
    return;
  }
  if (!Number.isFinite(price) || price <= 0) {
    showToast("请填写有效价格");
    elements.newDishPrice.focus();
    return;
  }
  category.dishes.push({
    dish_id: nextDishId(),
    dish_name: name,
    category_id: category.category_id,
    price,
    description,
    status: 1,
  });
  elements.newDishName.value = "";
  elements.newDishPrice.value = "";
  elements.newDishDesc.value = "";
  persist();
  render();
  showToast(`已增加菜品：${name}`);
}

function saveDish(row, dishId) {
  if (!state.isAdminAuthenticated) return;
  const entry = findDishEntry(dishId);
  if (!entry) return;
  const name = row.querySelector('[data-field="dish_name"]').value.trim();
  const description = row.querySelector('[data-field="description"]').value.trim();
  const price = Number(row.querySelector('[data-field="price"]').value);
  if (!name) {
    showToast("菜名不能为空");
    return;
  }
  if (!Number.isFinite(price) || price <= 0) {
    showToast("价格必须大于 0");
    return;
  }
  entry.dish.dish_name = name;
  entry.dish.description = description || "暂无描述";
  entry.dish.price = price;
  persist();
  render();
  showToast(`已保存：${name}`);
}

function deleteDish(dishId) {
  if (!state.isAdminAuthenticated) return;
  const entry = findDishEntry(dishId);
  if (!entry) return;
  if (!window.confirm(`删除“${entry.dish.dish_name}”？员工端将不再显示这道菜。`)) return;
  entry.category.dishes.splice(entry.index, 1);
  state.selectedDishIds = state.selectedDishIds.filter((id) => id !== dishId);
  delete state.quantities[dishId];
  persist();
  render();
  showToast("菜品已删除");
}

function toggleDishChoice(button) {
  const id = button.dataset.id;
  const current = state.quantities[id] || 0;
  if (button.dataset.action === "toggle") {
    const next = current > 0 ? 0 : 1;
    state.quantities[id] = next;
    if (!next) delete state.dishSpice[id];
    if (next && !state.dishSpice[id]) state.dishSpice[id] = "";
  } else {
    state.quantities[id] = button.dataset.action === "plus" ? Math.min(1, current + 1) : Math.max(0, current - 1);
    if (!state.quantities[id]) delete state.dishSpice[id];
    if (button.dataset.action === "plus" && current >= 1) {
      showToast("每人每道菜最多点 1 份");
    }
  }
  renderRecommendedMenu();
  renderTodayMenu();
  renderOrderTotal();
  renderQuickFilters();
  renderSaveStatus();
}

function updateDishSpice(button) {
  const id = button.dataset.id;
  if (!id || !state.quantities[id]) return;
  state.dishSpice[id] = button.dataset.spice || "";
  state.lastSaveMessage = "";
  renderRecommendedMenu();
  renderTodayMenu();
  renderSaveStatus();
}

function publishMenu() {
  if (!state.isAdminAuthenticated) {
    showToast("请先登录管理员");
    state.viewMode = "admin";
    render();
    elements.adminPasswordInput.focus();
    return;
  }
  if (!state.selectedDishIds.length) {
    showToast("请至少保留 1 道参考菜后再发布");
    return;
  }
  const targetDate = elements.menuDate.value || todayString();
  const existingOrders = state.orders.filter((order) => order.date === targetDate);
  if (
    existingOrders.length &&
    state.publishedMenu?.date === targetDate &&
    !window.confirm(`当前日期已有 ${existingOrders.length} 位员工点餐。重新发布会保留这些订单，只更新参考菜单和截止时间。是否继续？`)
  ) {
    return;
  }
  state.publishedMenu = {
    date: targetDate,
    order_deadline: elements.deadlineInput.value || "10:00",
    selected_dish_ids: [...state.selectedDishIds],
    menu_cycle_key: currentMenuCycleKey(),
    remark: "今日点餐已发布，参考菜单仅作推荐",
  };
  state.quantities = {};
  state.dishSpice = {};
  persist();
  render();
  showToast("今日点餐已发布，员工可从全部菜品里选择");
}

function extendDeadline() {
  if (!state.isAdminAuthenticated) {
    showToast("请先登录管理员");
    return;
  }
  if (!state.publishedMenu) return;
  state.publishedMenu.order_deadline = "23:59";
  elements.deadlineInput.value = "23:59";
  persist();
  render();
  showToast("已延长截止时间到 23:59");
}

function loadEmployeeOrder() {
  if (!state.publishedMenu) return;
  const name = elements.employeeName.value.trim();
  if (!name) return;
  const dept = elements.employeeDept.value.trim();
  const order = state.orders.find((entry) => employeeIdentityMatches(entry, name, dept));
  if (!order) return;
  state.quantities = {};
  state.dishSpice = {};
  order.items.forEach((item) => {
    state.quantities[item.dish_id] = Math.min(item.quantity || 0, 1);
    if (item.quantity > 0) state.dishSpice[item.dish_id] = item.spice_level || order.spice_level || "";
  });
  elements.employeeDept.value = order.department || elements.employeeDept.value;
  elements.orderRemark.value = order.remark || "";
  state.activeEmployeeKey = employeeKey(order.employee_name, order.department || "");
  renderRecommendedMenu();
  renderTodayMenu();
  renderOrderTotal();
  elements.saveStatus.textContent = `已载入：${order.employee_name} · 可修改`;
  elements.saveStatus.classList.add("saved");
  showToast("已载入你的桌台点菜记录，可直接修改");
}

function submitOrder() {
  if (!state.publishedMenu) {
    showToast("今日菜单尚未发布");
    return;
  }
  if (isOrderClosed()) {
    showToast("已过点餐截止时间");
    render();
    return;
  }

  const items = selectedDishes().map((dish) => ({
    dish_id: dish.dish_id,
    quantity: Math.min(state.quantities[dish.dish_id] || 0, 1),
    price: dish.price,
    spice_level: Math.min(state.quantities[dish.dish_id] || 0, 1) ? state.dishSpice[dish.dish_id] || "" : "",
  }));
  const amount = orderTotal();
  const portions = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!elements.employeeName.value.trim()) {
    showToast("请填写姓名");
    elements.employeeName.focus();
    return;
  }
  let existingIndex = state.orders.findIndex((entry) =>
    employeeIdentityMatches(entry, elements.employeeName.value.trim(), elements.employeeDept.value.trim()),
  );
  if (!portions && existingIndex >= 0) {
    const employeeName = state.orders[existingIndex].employee_name;
    state.orders.splice(existingIndex, 1);
    state.quantities = {};
    state.dishSpice = {};
    state.activeEmployeeKey = employeeKey();
    state.lastSaveMessage = `已取消：${employeeName}`;
    persist();
    render();
    showToast("已取消你的全部点菜");
    return;
  }
  if (!portions) {
    showToast("请至少选择 1 份菜品");
    return;
  }
  const missingSpiceItem = items.find((item) => item.quantity > 0 && !item.spice_level);
  if (missingSpiceItem) {
    const dish = dishById(missingSpiceItem.dish_id);
    showToast(`请选择“${dish?.dish_name || "菜品"}”的辣度`);
    renderRecommendedMenu();
    renderTodayMenu();
    const chip = document.querySelector(`.spice-chip[data-id="${missingSpiceItem.dish_id}"]:not(:disabled)`);
    chip?.focus();
    return;
  }

  const order = {
    id: `O${Date.now()}`,
    date: state.publishedMenu.date,
    employee_name: elements.employeeName.value.trim(),
    department: elements.employeeDept.value.trim(),
    remark: elements.orderRemark.value.trim(),
    items,
    amount,
    submitted_at: new Date().toLocaleString("zh-CN", { hour12: false }),
  };

  if (existingIndex >= 0) {
    state.orders[existingIndex] = order;
  } else {
    state.orders.push(order);
  }
  state.lastSaveMessage = `已保存：${order.employee_name} · ${portions} 道`;
  state.activeEmployeeKey = employeeKey(order.employee_name, order.department);
  persist();
  render();
  showToast(existingIndex >= 0 ? "已更新你的点餐" : "点餐已提交");
}

function exportExcel() {
  if (!state.isAdminAuthenticated) {
    state.viewMode = "admin";
    render();
    elements.adminPasswordInput.focus();
    showToast("请先登录管理员");
    return;
  }

  const rows = summaryRows().filter((row) => row.count > 0);
  const orderRows = currentOrders().flatMap((order) =>
    order.items
      .filter((item) => item.quantity > 0)
      .map((item) => {
        const dish = dishById(item.dish_id);
        return {
          日期: order.date,
          员工: order.employee_name,
          部门: order.department || "",
          辣度: item.spice_level || order.spice_level || "",
          菜品: dish?.dish_name || item.dish_id,
          单价: item.price,
          份数: item.quantity,
          小计: item.price * item.quantity,
          备注: order.remark || "",
          提交时间: order.submitted_at,
        };
      }),
  );

  const summaryHtml = tableHtml(
    ["菜品", "单价", "下单份数", "想吃人数", "总金额"],
    rows.map((row) => [row.dish_name, row.price, row.count, row.interestCount, row.amount]),
  );
  const orderHtml = tableHtml(
    Object.keys(orderRows[0] || { 日期: "", 员工: "", 部门: "", 辣度: "", 菜品: "", 单价: "", 份数: "", 小计: "", 备注: "", 提交时间: "" }),
    orderRows.map((row) => Object.values(row)),
  );
  const html = `
    <html><head><meta charset="UTF-8"></head><body>
      <h2>整桌汇总报单</h2>${summaryHtml}
      <h2>点菜记录明细</h2>${orderHtml}
    </body></html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `午餐点餐汇总-${state.publishedMenu?.date || todayString()}.xls`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Excel 报单已导出");
}

function tableHtml(headers, rows) {
  const th = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const trs = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table border="1"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function resetData() {
  if (!state.isAdminAuthenticated) {
    showToast("请先登录管理员");
    state.viewMode = "admin";
    render();
    elements.adminPasswordInput.focus();
    return;
  }
  if (state.orders.length && !window.confirm("重置会清空所有点菜记录并恢复演示数据，是否继续？")) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  state.selectedDishIds = defaultMenu();
  state.publishedMenu = {
    date: todayString(),
    order_deadline: defaultDeadline(state.data.daily_menu_template.order_deadline),
    selected_dish_ids: [...state.selectedDishIds],
    menu_cycle_key: currentMenuCycleKey(),
    remark: "默认演示菜单",
  };
  state.quantities = {};
  state.dishSpice = {};
  state.orders = [];
  state.activeEmployeeKey = "";
  persist();
  render();
  showToast("已重置演示数据");
}

function bindEvents() {
  elements.employeeModeButton.addEventListener("click", () => {
    state.viewMode = "employee";
    state.activePage = "recommendations";
    render();
    setQuickNavActive("recommendations");
  });
  elements.adminModeButton.addEventListener("click", () => {
    state.viewMode = "admin";
    state.activePage = "publish";
    render();
    setQuickNavActive("publish");
    if (!state.isAdminAuthenticated) elements.adminPasswordInput.focus();
  });
  elements.quickNav.addEventListener("click", (event) => {
    const button = event.target.closest(".quick-nav-button");
    if (!button) return;
    navigateTo(button.dataset.navTarget);
  });
  elements.adminLoginButton.addEventListener("click", () => {
    if (elements.adminPasswordInput.value !== ADMIN_PASSWORD) {
      showToast("管理员密码错误");
      elements.adminPasswordInput.select();
      return;
    }
    state.isAdminAuthenticated = true;
    elements.adminPasswordInput.value = "";
    render();
    showToast("管理员登录成功");
  });
  elements.adminPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") elements.adminLoginButton.click();
  });
  elements.publishButton.addEventListener("click", publishMenu);
  elements.publishButtonTop.addEventListener("click", publishMenu);
  if (elements.randomMenuButton) elements.randomMenuButton.addEventListener("click", generateRandomMenu);
  elements.clearSelectionButton.addEventListener("click", () => {
    if (!state.isAdminAuthenticated) return;
    state.selectedDishIds = [];
    persist();
    render();
  });
  elements.addDishButton.addEventListener("click", addDish);
  elements.dishLibrary.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest(".dish-row");
    if (button.dataset.action === "save-dish") saveDish(row, button.dataset.id);
    if (button.dataset.action === "delete-dish") deleteDish(button.dataset.id);
  });
  elements.submitOrderButton.addEventListener("click", submitOrder);
  elements.clearCurrentOrderButton.addEventListener("click", () => {
    if (currentSelectionCount() > 0 && !window.confirm("清空本次选择？已有订单需要再点保存才会取消。")) {
      return;
    }
    state.quantities = {};
    state.dishSpice = {};
    renderTodayMenu();
    renderRecommendedMenu();
    renderOrderTotal();
    renderQuickFilters();
    renderSaveStatus();
  });
  elements.exportButton.addEventListener("click", exportExcel);
  elements.resetDataButton.addEventListener("click", resetData);
  elements.extendDeadlineButton.addEventListener("click", extendDeadline);
  elements.otherDishesButton.addEventListener("click", () => navigateTo("order"));
  elements.adminDishSearch.addEventListener("input", () => {
    state.adminSearchTerm = elements.adminDishSearch.value;
    renderDishLibrary();
  });
  elements.employeeName.addEventListener("blur", loadEmployeeOrder);
  elements.employeeDept.addEventListener("blur", loadEmployeeOrder);
  elements.employeeName.addEventListener("input", () => {
    state.lastSaveMessage = "";
    resetDraftIfIdentityChanged();
    renderSaveStatus();
  });
  elements.employeeDept.addEventListener("input", () => {
    state.lastSaveMessage = "";
    resetDraftIfIdentityChanged();
    renderSaveStatus();
  });
  elements.employeeDishSearch.addEventListener("input", () => {
    state.employeeSearchTerm = elements.employeeDishSearch.value;
    state.employeeVisibleDishLimit = EMPLOYEE_DISH_PAGE_SIZE;
    renderTodayMenu();
  });
  elements.recommendedMenu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "spice") {
      updateDishSpice(button);
      return;
    }
    toggleDishChoice(button);
  });
  elements.todayMenu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "spice") {
      updateDishSpice(button);
      return;
    }
    toggleDishChoice(button);
  });
  elements.menuMoreRow.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "show-more-dishes") {
      state.employeeVisibleDishLimit += EMPLOYEE_DISH_PAGE_SIZE;
    }
    if (button.dataset.action === "collapse-dishes") {
      state.employeeVisibleDishLimit = EMPLOYEE_DISH_PAGE_SIZE;
      elements.todayMenu.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    renderTodayMenu();
  });
  window.addEventListener("scroll", () => {
    maybeAutoLoadEmployeeDishes(window);
    updateBackToTopVisibility();
    updateMobileSearchDock();
  }, { passive: true });
  const orderPanel = $("#orderPanel");
  if (orderPanel) {
    orderPanel.addEventListener("scroll", () => {
      maybeAutoLoadEmployeeDishes(orderPanel);
      updateBackToTopVisibility();
      updateMobileSearchDock();
    }, { passive: true });
  }
  if (elements.backToTopButton) elements.backToTopButton.addEventListener("click", backToTop);
  elements.menuDate.addEventListener("change", () => {
    if (state.publishedMenu) state.publishedMenu.date = elements.menuDate.value;
    state.activeEmployeeKey = "";
    persist();
    renderTodayMenu();
    renderSaveStatus();
  });
  elements.deadlineInput.addEventListener("change", () => {
    if (state.publishedMenu) state.publishedMenu.order_deadline = elements.deadlineInput.value;
    persist();
    renderTodayMenu();
    renderSaveStatus();
  });
}

function render() {
  elements.menuDate.value = state.publishedMenu?.date || elements.menuDate.value || todayString();
  elements.deadlineInput.value = state.publishedMenu?.order_deadline || elements.deadlineInput.value || "10:00";
  elements.subtitle.textContent =
    state.viewMode === "admin" && state.isAdminAuthenticated
      ? `${state.data.system_type} · ${state.data.price_reference}`
      : state.data.system_type;
  renderMode();
  renderSelectionStatus();
  renderTemplates();
  renderCategories();
  renderNewDishCategories();
  renderEmployeeCategories();
  renderQuickFilters();
  renderDishLibrary();
  renderRecommendedMenu();
  renderTodayMenu();
  renderOrderTotal();
  renderSaveStatus();
  renderSummary();
  renderPageSections();
  renderPageHeading();
}

async function init() {
  try {
    if (window.location.protocol === "file:") {
      throw new Error("请通过 http://127.0.0.1:5173/ 打开系统，直接打开 HTML 无法读取菜品库。");
    }
    const response = await fetch("./cook.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`菜品库请求失败：HTTP ${response.status}`);
    }
    state.data = await response.json();
    state.selectedDishIds = defaultMenu();
    state.publishedMenu = {
      date: todayString(),
      order_deadline: defaultDeadline(state.data.daily_menu_template.order_deadline),
      selected_dish_ids: [...state.selectedDishIds],
      menu_cycle_key: currentMenuCycleKey(),
      remark: "默认演示菜单",
    };
    await restore();
    ensureAutoRecommendedMenu();
    if (backendEnabled) persist();
    if (state.publishedMenu && state.publishedMenu.remark === "默认演示菜单" && isOrderClosed() && !state.orders.length) {
      state.publishedMenu.order_deadline = defaultDeadline(state.publishedMenu.order_deadline);
      persist();
    }
    elements.menuDate.value = state.publishedMenu?.date || todayString();
    elements.deadlineInput.value = state.publishedMenu?.order_deadline || "10:00";
    bindEvents();
    render();
    window.setInterval(() => {
      const previousCycleKey = state.publishedMenu?.menu_cycle_key;
      ensureAutoRecommendedMenu();
      if (state.publishedMenu?.menu_cycle_key !== previousCycleKey) render();
    }, 60 * 1000);
  } catch (error) {
    elements.subtitle.textContent = "菜品库载入失败";
    const message = `${error.message} 本地服务启动后请访问 http://127.0.0.1:5173/`;
    elements.dishLibrary.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    elements.todayMenu.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    elements.summaryList.innerHTML = `<div class="empty-state">暂无汇总数据。</div>`;
    elements.publishButton.disabled = true;
    elements.publishButtonTop.disabled = true;
    elements.submitOrderButton.disabled = true;
    elements.exportButton.disabled = true;
    showToast(error.message);
  }
}

init();
