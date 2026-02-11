const STORAGE_KEYS = {
  cart: "supercalc-cart",
  purchases: "supercalc-purchases",
  settings: "supercalc-settings",
  theme: "supercalc-theme"
};

const state = {
  cart: readStorage(STORAGE_KEYS.cart, []),
  purchases: readStorage(STORAGE_KEYS.purchases, []),
  settings: {
    taxRate: 0,
    discountPercent: 0,
    discountFixed: 0,
    budget: 0,
    ...readStorage(STORAGE_KEYS.settings, {})
  },
  editingId: null
};

const el = {
  productForm: document.querySelector("#productForm"),
  productName: document.querySelector("#productName"),
  productQuantity: document.querySelector("#productQuantity"),
  productPrice: document.querySelector("#productPrice"),
  productSubtotal: document.querySelector("#productSubtotal"),
  addBtn: document.querySelector("#addBtn"),
  cartList: document.querySelector("#cartList"),
  subtotalValue: document.querySelector("#subtotalValue"),
  taxValue: document.querySelector("#taxValue"),
  discountValue: document.querySelector("#discountValue"),
  totalValue: document.querySelector("#totalValue"),
  savePurchase: document.querySelector("#savePurchase"),
  taxRate: document.querySelector("#taxRate"),
  discountPercent: document.querySelector("#discountPercent"),
  discountFixed: document.querySelector("#discountFixed"),
  budget: document.querySelector("#budget"),
  budgetFill: document.querySelector("#budgetFill"),
  budgetText: document.querySelector("#budgetText"),
  historyList: document.querySelector("#historyList"),
  historySearch: document.querySelector("#historySearch"),
  cartItemTemplate: document.querySelector("#cartItemTemplate"),
  historyItemTemplate: document.querySelector("#historyItemTemplate"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  themeToggle: document.querySelector("#themeToggle")
};

init();

function init() {
  applyTheme(readStorage(STORAGE_KEYS.theme, "light"));
  hydrateSettings();
  bindEvents();
  render();
}

function bindEvents() {
  el.productForm.addEventListener("submit", handleProductSubmit);
  [el.productQuantity, el.productPrice].forEach((input) => input.addEventListener("input", updateInputSubtotal));

  [el.taxRate, el.discountPercent, el.discountFixed, el.budget].forEach((input) => {
    input.addEventListener("input", () => {
      state.settings[input.id] = parseFloat(input.value) || 0;
      saveStorage(STORAGE_KEYS.settings, state.settings);
      renderTotals();
    });
  });

  el.savePurchase.addEventListener("click", saveCurrentPurchase);
  el.historySearch.addEventListener("input", renderHistory);

  el.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      el.tabButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
      el.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === target));
    });
  });

  el.themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    const mode = isDark ? "dark" : "light";
    saveStorage(STORAGE_KEYS.theme, mode);
    el.themeToggle.textContent = isDark ? "☀️ Modo claro" : "🌙 Modo oscuro";
  });
}

function handleProductSubmit(event) {
  event.preventDefault();

  const name = el.productName.value.trim();
  const quantity = parseFloat(el.productQuantity.value);
  const price = parseFloat(el.productPrice.value);

  if (!name || quantity <= 0 || price < 0) return;

  const product = {
    id: state.editingId || crypto.randomUUID(),
    name,
    quantity,
    price
  };

  if (state.editingId) {
    state.cart = state.cart.map((item) => (item.id === state.editingId ? product : item));
    state.editingId = null;
    el.addBtn.textContent = "Agregar al carrito";
  } else {
    state.cart = [...state.cart, product];
  }

  saveStorage(STORAGE_KEYS.cart, state.cart);
  resetForm();
  render();
}

function render() {
  renderCart();
  renderTotals();
  renderHistory();
  updateInputSubtotal();
}

function renderCart() {
  el.cartList.innerHTML = "";

  if (!state.cart.length) {
    el.cartList.append(emptyMessage("Aún no agregaste productos al carrito."));
    el.savePurchase.disabled = true;
    return;
  }

  state.cart.forEach((item) => {
    const fragment = el.cartItemTemplate.content.cloneNode(true);
    fragment.querySelector("[data-name]").textContent = item.name;
    fragment.querySelector("[data-details]").textContent = `${item.quantity} × ${formatCurrency(item.price)} = ${formatCurrency(item.quantity * item.price)}`;

    fragment.querySelector("[data-delete]").addEventListener("click", () => {
      state.cart = state.cart.filter((current) => current.id !== item.id);
      saveStorage(STORAGE_KEYS.cart, state.cart);
      render();
    });

    fragment.querySelector("[data-edit]").addEventListener("click", () => {
      el.productName.value = item.name;
      el.productQuantity.value = item.quantity;
      el.productPrice.value = item.price;
      state.editingId = item.id;
      el.addBtn.textContent = "Actualizar producto";
      updateInputSubtotal();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    el.cartList.append(fragment);
  });

  el.savePurchase.disabled = false;
}

function renderTotals() {
  const subtotal = getCartSubtotal();
  const taxes = subtotal * (state.settings.taxRate / 100);
  const discountFromRate = (subtotal + taxes) * (state.settings.discountPercent / 100);
  const totalDiscount = Math.min(subtotal + taxes, discountFromRate + state.settings.discountFixed);
  const total = Math.max(0, subtotal + taxes - totalDiscount);

  el.subtotalValue.textContent = formatCurrency(subtotal);
  el.taxValue.textContent = formatCurrency(taxes);
  el.discountValue.textContent = `-${formatCurrency(totalDiscount)}`;
  el.totalValue.textContent = formatCurrency(total);

  renderBudget(total);
}

function renderBudget(total) {
  const budget = state.settings.budget;

  if (!budget || budget <= 0) {
    el.budgetFill.style.width = "0%";
    el.budgetFill.style.background = "var(--mint)";
    el.budgetText.textContent = "Sin presupuesto definido";
    return;
  }

  const usage = (total / budget) * 100;
  const displayPercent = Math.min(100, usage);
  el.budgetFill.style.width = `${displayPercent}%`;

  if (usage < 80) {
    el.budgetFill.style.background = "var(--mint)";
  } else if (usage <= 100) {
    el.budgetFill.style.background = "#ffd08a";
  } else {
    el.budgetFill.style.background = "var(--danger)";
  }

  el.budgetText.textContent = `${formatCurrency(total)} / ${formatCurrency(budget)} (${usage.toFixed(1)}%)`;
}

function saveCurrentPurchase() {
  if (!state.cart.length) return;

  const subtotal = getCartSubtotal();
  const taxes = subtotal * (state.settings.taxRate / 100);
  const discountFromRate = (subtotal + taxes) * (state.settings.discountPercent / 100);
  const totalDiscount = Math.min(subtotal + taxes, discountFromRate + state.settings.discountFixed);
  const total = Math.max(0, subtotal + taxes - totalDiscount);

  const purchase = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    settingsSnapshot: { ...state.settings },
    products: state.cart,
    subtotal,
    taxes,
    totalDiscount,
    total
  };

  state.purchases = [purchase, ...state.purchases];
  state.cart = [];
  state.editingId = null;

  saveStorage(STORAGE_KEYS.purchases, state.purchases);
  saveStorage(STORAGE_KEYS.cart, state.cart);

  resetForm();
  render();
}

function renderHistory() {
  el.historyList.innerHTML = "";
  const query = el.historySearch.value.trim().toLowerCase();

  const filtered = state.purchases.filter((purchase) => {
    if (!query) return true;

    const dateText = new Date(purchase.createdAt).toLocaleString("es-ES").toLowerCase();
    const productText = purchase.products.map((p) => p.name.toLowerCase()).join(" ");
    return dateText.includes(query) || productText.includes(query);
  });

  if (!filtered.length) {
    el.historyList.append(emptyMessage("No hay compras que coincidan con la búsqueda."));
    return;
  }

  filtered.forEach((purchase) => {
    const fragment = el.historyItemTemplate.content.cloneNode(true);
    fragment.querySelector("[data-title]").textContent = new Date(purchase.createdAt).toLocaleString("es-ES", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    fragment.querySelector("[data-meta]").textContent = `${purchase.products.length} productos`;
    fragment.querySelector("[data-total]").textContent = formatCurrency(purchase.total);

    const productsWrap = fragment.querySelector("[data-products]");
    purchase.products.forEach((product) => {
      const row = document.createElement("p");
      row.textContent = `${product.name}: ${product.quantity} × ${formatCurrency(product.price)} = ${formatCurrency(product.quantity * product.price)}`;
      productsWrap.append(row);
    });

    const summary = document.createElement("p");
    summary.textContent = `Subtotal: ${formatCurrency(purchase.subtotal)} · Impuestos: ${formatCurrency(purchase.taxes)} · Descuentos: ${formatCurrency(purchase.totalDiscount)}`;
    productsWrap.append(summary);

    fragment.querySelector("[data-delete-history]").addEventListener("click", () => {
      state.purchases = state.purchases.filter((entry) => entry.id !== purchase.id);
      saveStorage(STORAGE_KEYS.purchases, state.purchases);
      renderHistory();
    });

    fragment.querySelector("[data-duplicate]").addEventListener("click", () => {
      state.cart = purchase.products.map((product) => ({ ...product, id: crypto.randomUUID() }));
      saveStorage(STORAGE_KEYS.cart, state.cart);
      render();
      switchToTab("calculator");
    });

    el.historyList.append(fragment);
  });
}

function switchToTab(tabId) {
  el.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
  el.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
}

function updateInputSubtotal() {
  const quantity = parseFloat(el.productQuantity.value) || 0;
  const price = parseFloat(el.productPrice.value) || 0;
  el.productSubtotal.textContent = `Subtotal: ${formatCurrency(quantity * price)}`;
}

function resetForm() {
  el.productForm.reset();
  el.productQuantity.value = "1";
  el.productPrice.value = "0";
  updateInputSubtotal();
}

function hydrateSettings() {
  el.taxRate.value = state.settings.taxRate;
  el.discountPercent.value = state.settings.discountPercent;
  el.discountFixed.value = state.settings.discountFixed;
  el.budget.value = state.settings.budget;
}

function getCartSubtotal() {
  return state.cart.reduce((acc, product) => acc + product.quantity * product.price, 0);
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(value || 0);
}

function emptyMessage(text) {
  const message = document.createElement("p");
  message.className = "empty";
  message.textContent = text;
  return message;
}

function applyTheme(mode) {
  const isDark = mode === "dark";
  document.body.classList.toggle("dark", isDark);
  el.themeToggle.textContent = isDark ? "☀️ Modo claro" : "🌙 Modo oscuro";
}
