import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = { uid: null, products: [], sales: [] };

const authView = document.getElementById("auth-view");
const panelView = document.getElementById("panel-view");
const authError = document.getElementById("auth-error");
const profileBadge = document.getElementById("profile-badge");
const tabTitle = document.getElementById("tab-title");

const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const themeBtn = document.getElementById("theme-btn");
const seedDemoBtn = document.getElementById("seed-demo-btn");
const productForm = document.getElementById("product-form");
const saleForm = document.getElementById("sale-form");

const kpiGrid = document.getElementById("kpi-grid");
const financialMetrics = document.getElementById("financial-metrics");
const recentActivity = document.getElementById("recent-activity");
const categoryDistribution = document.getElementById("category-distribution");
const topProducts = document.getElementById("top-products");
const productsList = document.getElementById("products-list");
const salesList = document.getElementById("sales-list");
const alertsList = document.getElementById("alerts-list");

const scanBtn = document.getElementById("scan-btn");
const scannerEl = document.getElementById("scanner");

function mxn(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));
}

function daysUntil(dateISO) {
  const today = new Date();
  const target = new Date(dateISO + "T00:00:00");
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function safe(v) {
  return String(v ?? "").replace(/[<>]/g, "");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    authError.textContent = "Error de acceso: " + err.message;
  }
});

logoutBtn.addEventListener("click", async () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    state.uid = null;
    authView.classList.remove("hidden");
    panelView.classList.add("hidden");
    return;
  }

  state.uid = user.uid;
  profileBadge.textContent = `${safe(user.email)} · acceso total`;

  authView.classList.add("hidden");
  panelView.classList.remove("hidden");

  startRealtimeData();
});

function startRealtimeData() {
  onSnapshot(collection(db, "products"), (snap) => {
    state.products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  const salesQ = query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(200));
  onSnapshot(salesQ, (snap) => {
    state.sales = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    name: document.getElementById("product-name").value.trim(),
    barcode: document.getElementById("product-barcode").value.trim(),
    category: document.getElementById("product-category").value.trim(),
    stock: Number(document.getElementById("product-stock").value),
    cost: Number(document.getElementById("product-cost").value),
    price: Number(document.getElementById("product-price").value),
    expiryDate: document.getElementById("product-expiry").value,
    type: document.getElementById("product-type").value,
    active: true,
    createdAt: serverTimestamp(),
  };

  const existing = await getDocs(query(collection(db, "products"), where("barcode", "==", data.barcode), limit(1)));
  if (!existing.empty) {
    alert("Ya existe un producto con ese código de barras.");
    return;
  }

  await addDoc(collection(db, "products"), data);
  await addDoc(collection(db, "activities"), {
    type: "producto",
    message: `Producto agregado: ${data.name}`,
    createdAt: serverTimestamp(),
    by: state.uid,
  });
  productForm.reset();
});

saleForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const barcode = document.getElementById("sale-barcode").value.trim();
  const qty = Number(document.getElementById("sale-qty").value);
  const price = Number(document.getElementById("sale-price").value);

  const pSnap = await getDocs(query(collection(db, "products"), where("barcode", "==", barcode), limit(1)));
  if (pSnap.empty) {
    alert("No se encontró producto con ese código.");
    return;
  }

  const productDoc = pSnap.docs[0];
  const p = { id: productDoc.id, ...productDoc.data() };
  const revenue = qty * price;
  const profit = revenue - qty * Number(p.cost || 0);

  await addDoc(collection(db, "sales"), {
    productId: p.id,
    productName: p.name,
    barcode,
    qty,
    unitPrice: price,
    revenue,
    profit,
    category: p.category,
    createdAt: serverTimestamp(),
    by: state.uid,
  });

  await updateDoc(doc(db, "products", p.id), { stock: p.stock - qty });
  await addDoc(collection(db, "activities"), {
    type: "venta",
    message: `Venta registrada: ${p.name} x${qty}`,
    createdAt: serverTimestamp(),
    by: state.uid,
  });

  saleForm.reset();
});

const storedTheme = localStorage.getItem("db_theme") || "light";
if (storedTheme === "dark") {
  document.body.classList.add("dark");
  themeBtn.textContent = "Modo claro";
}
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  localStorage.setItem("db_theme", dark ? "dark" : "light");
  themeBtn.textContent = dark ? "Modo claro" : "Modo oscuro";
});

seedDemoBtn.addEventListener("click", seedDemoData);

function datePlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

async function seedDemoData() {
  const ok = confirm("Se reemplazarán productos, ventas y actividades por datos demo. ¿Continuar?");
  if (!ok) return;
  seedDemoBtn.disabled = true;
  seedDemoBtn.textContent = "Cargando...";

  try {
    await clearCollection("sales");
    await clearCollection("products");
    await clearCollection("activities");

    const demoProducts = [
      { name: "Resina Nanohíbrida A2", barcode: "7501000000011", category: "Restauración", stock: 42, cost: 240, price: 420, expiryDate: datePlusDays(18), type: "dental", active: true },
      { name: "Adhesivo Universal 5ml", barcode: "7501000000012", category: "Restauración", stock: 35, cost: 300, price: 520, expiryDate: datePlusDays(90), type: "dental", active: true },
      { name: "Guantes Nitrilo M", barcode: "7501000000013", category: "Consumibles", stock: 120, cost: 85, price: 150, expiryDate: datePlusDays(210), type: "dental", active: true },
      { name: "Anestesia Lidocaína 2%", barcode: "7501000000014", category: "Anestesia", stock: 28, cost: 390, price: 620, expiryDate: datePlusDays(12), type: "dental", active: true },
      { name: "Alginato Impresión 450g", barcode: "7501000000015", category: "Impresión", stock: 17, cost: 130, price: 240, expiryDate: datePlusDays(25), type: "dental", active: true },
      { name: 'Snacks Paciente "Sin Azúcar"', barcode: "7501000000016", category: "Recepción", stock: 55, cost: 16, price: 32, expiryDate: datePlusDays(8), type: "alimentario", active: true },
      { name: "Cepillo Post-Procedimiento", barcode: "7501000000017", category: "Higiene", stock: 76, cost: 22, price: 55, expiryDate: datePlusDays(365), type: "dental", active: true },
      { name: "Enjuague Bucal 250ml", barcode: "7501000000018", category: "Higiene", stock: 64, cost: 48, price: 110, expiryDate: datePlusDays(5), type: "alimentario", active: true },
    ];

    const productDocs = [];
    for (const p of demoProducts) {
      const ref = await addDoc(collection(db, "products"), { ...p, createdAt: serverTimestamp() });
      productDocs.push({ id: ref.id, ...p });
    }

    const salesPlan = [
      { barcode: "7501000000011", qty: 2, unitPrice: 420, daysAgo: 31 },
      { barcode: "7501000000013", qty: 8, unitPrice: 150, daysAgo: 28 },
      { barcode: "7501000000014", qty: 2, unitPrice: 620, daysAgo: 24 },
      { barcode: "7501000000015", qty: 3, unitPrice: 240, daysAgo: 19 },
      { barcode: "7501000000016", qty: 10, unitPrice: 32, daysAgo: 14 },
      { barcode: "7501000000011", qty: 3, unitPrice: 420, daysAgo: 12 },
      { barcode: "7501000000012", qty: 2, unitPrice: 520, daysAgo: 9 },
      { barcode: "7501000000018", qty: 6, unitPrice: 110, daysAgo: 6 },
      { barcode: "7501000000017", qty: 5, unitPrice: 55, daysAgo: 4 },
      { barcode: "7501000000013", qty: 12, unitPrice: 150, daysAgo: 2 },
      { barcode: "7501000000014", qty: 3, unitPrice: 620, daysAgo: 1 },
    ];

    for (const s of salesPlan) {
      const p = productDocs.find((x) => x.barcode === s.barcode);
      if (!p) continue;
      const revenue = s.qty * s.unitPrice;
      const profit = revenue - s.qty * Number(p.cost || 0);
      const when = new Date();
      when.setDate(when.getDate() - s.daysAgo);

      await addDoc(collection(db, "sales"), {
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        qty: s.qty,
        unitPrice: s.unitPrice,
        revenue,
        profit,
        category: p.category,
        createdAt: Timestamp.fromDate(when),
        by: state.uid,
      });

      await updateDoc(doc(db, "products", p.id), { stock: Number(p.stock) - Number(s.qty) });
    }

    const activities = [
      "Inventario inicial cargado para demo.",
      "Venta mostrador registrada en restauración.",
      "Ajuste de precio promocional en higiene.",
      "Alerta de caducidad detectada en recepción.",
      "Cierre de corte diario validado.",
    ];
    for (let i = 0; i < activities.length; i += 1) {
      const when = new Date();
      when.setHours(when.getHours() - i * 6);
      await addDoc(collection(db, "activities"), {
        type: "sistema",
        message: activities[i],
        createdAt: Timestamp.fromDate(when),
        by: state.uid,
      });
    }

    alert("Demo cargada con éxito.");
  } catch (err) {
    alert("No se pudo cargar demo: " + err.message);
  } finally {
    seedDemoBtn.disabled = false;
    seedDemoBtn.textContent = "Cargar demo";
  }
}

function renderAll() {
  renderKpis();
  renderFinancialMetrics();
  renderProducts();
  renderSales();
  renderAlerts();
  renderTopProducts();
  renderCategories();
  renderActivity();
}

function renderKpis() {
  const totalRevenue = state.sales.reduce((a, s) => a + Number(s.revenue || 0), 0);
  const totalProfit = state.sales.reduce((a, s) => a + Number(s.profit || 0), 0);
  const soldUnits = state.sales.reduce((a, s) => a + Number(s.qty || 0), 0);
  const activeProducts = state.products.filter((p) => p.active !== false).length;
  const avgTicket = state.sales.length ? totalRevenue / state.sales.length : 0;

  const kpis = [
    ["Ventas", mxn(totalRevenue)],
    ["Ganancias", mxn(totalProfit)],
    ["Productos vendidos", soldUnits],
    ["Productos activos", activeProducts],
    ["Ticket promedio", mxn(avgTicket)],
  ];

  kpiGrid.innerHTML = kpis.map(([label, value]) => `<div class="kpi"><h4>${label}</h4><strong>${value}</strong></div>`).join("");
}

function renderFinancialMetrics() {
  const invValue = state.products.reduce((a, p) => a + Number(p.stock || 0) * Number(p.cost || 0), 0);
  const cogs = state.sales.reduce((a, s) => {
    const p = state.products.find((x) => x.id === s.productId);
    return a + Number(s.qty || 0) * Number((p && p.cost) || 0);
  }, 0);
  const rotation = invValue > 0 ? cogs / invValue : 0;
  const totalRevenue = state.sales.reduce((a, s) => a + Number(s.revenue || 0), 0);
  const totalProfit = state.sales.reduce((a, s) => a + Number(s.profit || 0), 0);
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  financialMetrics.innerHTML = [
    `Rotación de inventario: ${rotation.toFixed(2)}x`,
    `Margen promedio: ${margin.toFixed(1)}%`,
    `Tendencia de ventas: ${trendText(totalRevenue)}`,
    `Evaluación de ventas: ${state.sales.length >= 10 ? "Alta actividad" : "Actividad inicial"}`,
  ].map((t) => `<li>${t}</li>`).join("");
}

function trendText(current) {
  const now = Date.now();
  const mid = now - 15 * 24 * 60 * 60 * 1000;
  const recent = state.sales.filter((s) => s.createdAt?.toMillis?.() >= mid).reduce((a, s) => a + Number(s.revenue || 0), 0);
  const old = state.sales.filter((s) => s.createdAt?.toMillis?.() < mid).reduce((a, s) => a + Number(s.revenue || 0), 0);
  if (!old && !recent) return "Sin datos";
  if (recent > old) return "Al alza";
  if (recent < old) return "A la baja";
  return current ? "Estable" : "Sin datos";
}

function renderProducts() {
  const rows = state.products
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map((p) => `<li>${safe(p.name)} · ${safe(p.category)} · Stock: ${p.stock} · ${mxn(p.price)} · ${safe(p.type || "dental")}</li>`);
  productsList.innerHTML = rows.length ? rows.join("") : "<li>Sin productos.</li>";
}

function renderSales() {
  const rows = state.sales
    .slice(0, 20)
    .map((s) => `<li>${safe(s.productName)} x${s.qty} · Venta: ${mxn(s.revenue)} · Ganancia: ${mxn(s.profit)}</li>`);
  salesList.innerHTML = rows.length ? rows.join("") : "<li>Sin ventas.</li>";
}

function renderAlerts() {
  const alerts = state.products
    .filter((p) => p.expiryDate)
    .map((p) => ({ ...p, d: daysUntil(p.expiryDate) }))
    .filter((p) => p.d <= 30)
    .sort((a, b) => a.d - b.d)
    .map((p) => `<li>${safe(p.name)} · caduca en ${p.d} día(s) (${safe(p.expiryDate)})</li>`);

  alertsList.innerHTML = alerts.length ? alerts.join("") : "<li>Sin alertas críticas.</li>";
}

function renderTopProducts() {
  const map = new Map();
  for (const s of state.sales) map.set(s.productName, (map.get(s.productName) || 0) + Number(s.qty || 0));
  const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  topProducts.innerHTML = top.length ? top.map(([n, q]) => `<li>${safe(n)} · ${q} uds.</li>`).join("") : "<li>Sin datos.</li>";
}

function renderCategories() {
  const map = new Map();
  for (const s of state.sales) map.set(s.category || "Sin categoría", (map.get(s.category || "Sin categoría") || 0) + Number(s.revenue || 0));
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  categoryDistribution.innerHTML = rows.length ? rows.map(([c, v]) => `<li>${safe(c)} · ${mxn(v)}</li>`).join("") : "<li>Sin datos.</li>";
}

async function renderActivity() {
  const actQ = query(collection(db, "activities"), orderBy("createdAt", "desc"), limit(8));
  const snap = await getDocs(actQ);
  const rows = snap.docs.map((d) => d.data()).map((a) => `<li>${safe(a.message || "Actividad")}</li>`);
  recentActivity.innerHTML = rows.length ? rows.join("") : "<li>Sin actividad.</li>";
}

for (const btn of document.querySelectorAll(".tab-btn")) {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById(tab).classList.add("active");
    tabTitle.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
  });
}

scanBtn.addEventListener("click", async () => {
  scannerEl.classList.toggle("hidden");
  if (scannerEl.classList.contains("hidden")) return;

  if (!window.Html5Qrcode) {
    alert("No se pudo cargar el escáner. Verifica conexión.");
    scannerEl.classList.add("hidden");
    return;
  }

  const scanner = new window.Html5Qrcode("scanner");
  try {
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      async (decodedText) => {
        document.getElementById("sale-barcode").value = decodedText;
        await scanner.stop();
        scannerEl.classList.add("hidden");
      }
    );
  } catch (e) {
    alert("No se pudo iniciar cámara: " + e.message);
    scannerEl.classList.add("hidden");
  }
});
