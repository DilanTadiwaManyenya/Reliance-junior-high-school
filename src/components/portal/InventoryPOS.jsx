import { canonicalizeClassLevel } from '../../data/classOptions'
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OperationsExports from './OperationsExports';
import { useReceiptPrint } from '../../hooks/useReceiptPrint';
import { downloadCsv, reportSheets } from '../../lib/operationsExport';
import { salePaid, saleBalance, saleCollections } from '../../lib/posPayments';
import {
  Package,
  ShoppingCart,
  LayoutDashboard,
  ReceiptText,
  ChartNoAxesCombined,
  ScrollText,
  Settings,
  CircleHelp,
  Search,
  Plus,
  Minus,
  RefreshCw,
  Printer,
  Bell,
  ShieldCheck,
  Store,
  SlidersHorizontal,
  Activity,
  TrendingUp,
  Boxes,
  Wifi,
  WifiOff,
} from "lucide-react";
import "./inventory.css";
import { useModalFocus } from "../../hooks/useModalFocus";
import { logActivity } from "../../lib/logActivity";
import PasswordInput from "../ui/PasswordInput";
import ProductImage from "./ProductImage";
import ProductPhotoEditor from "./ProductPhotoEditor";
import ProductVariants from "./ProductVariants";
import { catalogStockItems } from "../../lib/shopCatalog";
import { validateProductImage, uploadProductImage, removeProductImage, copyProductImageForCampus } from "../../lib/productImages";
import { FINANCE_CURRENCIES, formatMoney } from "../../lib/currency";

const money = (value, currency = "USD") => formatMoney(value, currency);
const blank = {
  name: "",
  image_url: null,
  sku: "",
  category: "Uniforms",
  campus: "",
  selling_price: "",
  cost_price: "",
  currency: "USD",
  quantity_on_hand: "0",
  reorder_level: "5",
};
const methods = {
  cash: "Cash",
  ecocash: "EcoCash",
  swipe: "Card / swipe",
  transfer: "Bank transfer",
};
const tabs = [
  ["overview", "Overview", LayoutDashboard],
  ["pos", "Point of sale", ShoppingCart],
  ["products", "Products", Package],
  ["sales", "Sales & receipts", ReceiptText],
  ["analytics", "Profit & loss", ChartNoAxesCombined],
  ["logs", "Audit log", ScrollText],
  ["settings", "Settings", Settings],
  ["help", "Help", CircleHelp],
];
const helpTopics = [
  {
    id: "ERR_STOCK_LOW",
    category: "checkout",
    title: "Insufficient stock during checkout",
    solution: "The quantity in the cart is higher than the live stock count.",
    steps: [
      "Check the available quantity shown on the product card.",
      "Reduce the cart quantity, or ask an administrator to receive stock under Products.",
      "Retry checkout only after the cart matches available stock.",
    ],
  },
  {
    id: "ERR_PAYMENT_AMOUNT",
    category: "checkout",
    title: "Amount received is below the total",
    solution: "Partial payment needs a selected learner so the remaining balance stays on the original receipt.",
    steps: [
      "Confirm the payment method and total payable.",
      "Enter the amount actually received.",
      "Select the learner before completing a partly paid sale. Items are issued now.",
      "Use Sales & receipts to record later payments on the same receipt; do not create another sale.",
    ],
  },
  {
    id: "ERR_PRODUCT_UNAVAILABLE",
    category: "inventory",
    title: "A product is unavailable or was changed",
    solution: "Another staff member may have archived an item or changed its stock while this screen was open.",
    steps: [
      "Clear the affected item from the cart.",
      "Use Refresh to load the current catalogue.",
      "Add the product again only if it is active and in stock.",
    ],
  },
  {
    id: "ERR_PENDING_CHECKOUT",
    category: "checkout",
    title: "Checkout confirmation is pending",
    solution: "A connection was interrupted after a checkout was submitted.",
    steps: [
      "Use Retry pending sale on the same checkout screen.",
      "Do not create a replacement sale while it is pending.",
      "The system uses the same request ID, so a successful retry cannot deduct stock twice.",
    ],
  },
  {
    id: "ERR_RECEIPT_EXPORT",
    category: "reports",
    title: "A receipt will not print or save as PDF",
    solution: "Printing is handled by the browser after the receipt opens.",
    steps: [
      "Open the receipt from Sales & receipts.",
      "Choose Print / Save PDF.",
      "Allow the browser print dialog, then select Save as PDF if a paper printer is unavailable.",
    ],
  },
  {
    id: "ERR_ACCESS_DENIED",
    category: "auth",
    title: "Access denied or a section is missing",
    solution: "Shop features depend on the active Reliance role.",
    steps: [
      "The Main Admin manages products, stock, settings and audit records.",
      "Accountants process sales in their own campus. Only administrators manage products, photos and stock.",
      "Sign out and back in if your assigned role was recently changed.",
    ],
  },
];
const errorMessage = (e) =>
  ["42P01", "42703", "PGRST202", "PGRST205", "PGRST204"].includes(e.code)
    ? "The shop database needs its latest migrations. Contact your administrator before processing sales."
    : e.message || "Request failed. Please try again.";
const readSession = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
function Stat({ label, value, tone = "" }) {
  return (
    <article className={`shop-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
export default function InventoryPOS(props) {
  const role = props.profile?.active_role ?? props.profile?.role;
  const main = role === "admin" && props.profile?.campus === "all";
  const assignedCampus = ["junior", "senior"].includes(props.profile?.campus) ? props.profile.campus : null;
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [tab, setTab] = useState(role === "accountant" ? "pos" : main ? "overview" : "products");
  const checkoutCampus = main ? selectedCampus : assignedCampus;
  return <ShopWorkspace {...props} key={`${props.user.id}:${role}:${checkoutCampus || 'unselected'}`}
    checkoutCampus={checkoutCampus} setCheckoutCampus={setSelectedCampus} tab={tab} setTab={setTab} />;
}

function ShopWorkspace({ supabase, user, profile, checkoutCampus, setCheckoutCampus, tab, setTab }) {
  const role = profile?.active_role ?? profile?.role;
  const admin = role === "admin" && profile?.campus === "all";
  const campus = ["junior", "senior"].includes(profile?.campus) ? profile.campus : null;
  const campusAdmin = role === "admin" && Boolean(campus);
  const canManageProducts = admin || campusAdmin;
  const access = canManageProducts || (role === "accountant" && Boolean(campus));
  const [campusView, setCampusView] = useState("all");
  const storageKey = `reliance-shop:v2:${user.id}:${role}:${checkoutCampus || "unselected"}`;
  const legacyKey = `reliance-shop:${user.id}`;
  const [legacyPending, setLegacyPending] = useState(() => readSession(legacyKey)?.pending || null);
  const [products, setProducts] = useState([]);
  const [stockBatches, setStockBatches] = useState(null);
  const [stockReceipts, setStockReceipts] = useState(null);
  const [sales, setSales] = useState([]);
  const [learners, setLearners] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({
    store_name: "Reliance Learning Centre",
    receipt_header: "School shop",
    low_stock_alerts_enabled: true,
    alert_phone: "",
  });
  const [settingsSection, setSettingsSection] = useState("store");
  const [cart, setCart] = useState(() => readSession(storageKey)?.cart || []);
  const [held, setHeld] = useState(() => readSession(storageKey)?.held || []);
  const [customer, setCustomer] = useState(
    () => readSession(storageKey)?.customer || "",
  );
  const [learnerClass, setLearnerClass] = useState(
    () => readSession(storageKey)?.learnerClass || "",
  );
  const [learnerId, setLearnerId] = useState(
    () => readSession(storageKey)?.learnerId || "",
  );
  const [payment, setPayment] = useState(
    () => readSession(storageKey)?.payment || "cash",
  );
  const [paid, setPaid] = useState(() => readSession(storageKey)?.paid || "");
  const [pending, setPending] = useState(
    () => readSession(storageKey)?.pending || null,
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [logStatus, setLogStatus] = useState("all");
  const [helpCategory, setHelpCategory] = useState("all");
  const [helpQuery, setHelpQuery] = useState("");
  const [openHelp, setOpenHelp] = useState("ERR_STOCK_LOW");
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [list, setList] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportCurrency, setReportCurrency] = useState("USD");
  const [form, setForm] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [variantBusy, setVariantBusy] = useState(false);
  const [adjust, setAdjust] = useState({ product: "", change: "", reason: "" });
  const [receiptDraft, setReceiptDraft] = useState({
    supplier_name: "",
    supplier_reference: "",
    notes: "",
    items: [{ product_id: "", variant_id: "", quantity: "", unit_cost: "" }],
  });
  const [productReceiptDraft, setProductReceiptDraft] = useState({
    supplier_name: "",
    supplier_reference: "",
    notes: "",
    variant_id: "",
    quantity: "",
    unit_cost: "",
  });
  const [receiptRequest, setReceiptRequest] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [reversalReason, setReversalReason] = useState('');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceMethod, setBalanceMethod] = useState('cash');
  const [balanceReference, setBalanceReference] = useState('');
  const [receiptFilter, setReceiptFilter] = useState('all');
  const paymentStorageKey = `${storageKey}:receipt-payment`;
  const [pendingBalance, setPendingBalance] = useState(() => {
    const request = readSession(paymentStorageKey);
    return request?.id && request.saleId && Number.isFinite(request.tendered) && request.tendered > 0 && methods[request.method] ? request : null;
  });
  useReceiptPrint(receipt?.receipt_number);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const modalOpen = !!form || !!receipt;
  const dialogRef = useRef(null);
  useModalFocus(modalOpen, dialogRef, () => {
    if (!busy && !imageBusy && !variantBusy) { setForm(null); setReceipt(null); }
  });
  const load = useCallback(async () => {
    if (!access) return;
    setLoading(true);
    try {
      const fetchAll = async (table) => {
        const rows = [];
        for (let start = 0; ; start += 500) {
          let request = supabase
            .from(table)
            .select(table === "pos_sales" ? "*,pos_sale_items(*),pos_payments(*)" : table === "inventory_products" ? "*,product_variants(*)" : "*")
            .order("id")
            .range(start, start + 499);
          if (["inventory_products", "pos_sales"].includes(table) && !admin && campus) request = request.eq("campus", campus);
          const result = await request;
          if (result.error) throw result.error;
          rows.push(...result.data);
          if (result.data.length < 500) return rows;
        }
      };
      const [stock, history, prefs, audit, learnerRows] = await Promise.all([
        fetchAll("inventory_products"),
        fetchAll("pos_sales"),
        campusAdmin ? Promise.resolve({ data: { store_name: "Reliance Learning Centre", receipt_header: "School shop", low_stock_alerts_enabled: true } }) : supabase.from("shop_settings").select("*").single(),
        admin
          ? supabase
              .from("shop_audit")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [] }),
        checkoutCampus ? supabase
          .from("students")
          .select("id,full_name,admission_number,class_level,class_stream,status")
          .eq("status", "active").eq("campus", checkoutCampus)
          .order("full_name") : Promise.resolve({ data: [] }),
      ]);
      if (prefs.error) throw prefs.error;
      if (audit.error) throw audit.error;
      if (learnerRows.error) throw learnerRows.error;
      let batchRows = null;
      try {
        batchRows = await fetchAll("shop_stock_batches");
      } catch (batchError) {
        if (!["42P01", "PGRST205"].includes(batchError.code)) throw batchError;
      }
      let receiptRows = null;
      if (admin) {
        const receiptResult = await supabase.from("shop_stock_receipts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (receiptResult.error) {
          if (!["42P01", "PGRST205"].includes(receiptResult.error.code)) throw receiptResult.error;
        } else receiptRows = receiptResult.data || [];
      }
      setProducts(stock);
      setStockBatches(batchRows);
      setStockReceipts(receiptRows);
      setSales(
        history.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
      setSettings(prefs.data);
      setLogs(audit.data);
      setLearners(learnerRows.data || []);
      setReady(true);
      setLastUpdated(new Date());
    } catch (e) {
      setError(errorMessage(e));
      setReady(false);
    } finally {
      setLoading(false);
    }
  }, [access, admin, campus, campusAdmin, checkoutCampus, supabase]);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!access || typeof supabase.channel !== "function") return undefined;
    const channel = supabase
      .channel(`reliance-shop-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_products" },
        load,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pos_sales" },
        load,
      )
      .subscribe((status) => {
        setLiveStatus(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" ? "offline" : "connecting");
      });
    return () => { supabase.removeChannel?.(channel); };
  }, [access, load, supabase, user.id]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ cart, held, customer, learnerClass, learnerId, payment, paid, pending }),
      );
    } catch {
      /* Checkout also verifies persistence before sending. */
    }
  }, [storageKey, cart, held, customer, learnerClass, learnerId, payment, paid, pending]);
  const run = async (action) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const scopedProducts = products.filter(product => !admin || campusView === "all" || (campusView === "unassigned" ? !product.campus : product.campus === campusView));
  const active = scopedProducts.filter((p) => p.active);
  const learnerClassOptions = useMemo(() => {
    const classes = new Map();
    learners.forEach((learner) => {
      const level = learner.class_level ? canonicalizeClassLevel(learner.class_level) : "Unassigned";
      const stream = learner.class_stream || "";
      const key = `${level}::${stream.trim().toLowerCase()}`;
      classes.set(key, { key, label: `${level} ${stream}`.trim() });
    });
    return [...classes.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [learners]);
  const visibleLearners = learnerClass
    ? learners.filter((learner) => `${learner.class_level ? canonicalizeClassLevel(learner.class_level) : "Unassigned"}::${(learner.class_stream || "").trim().toLowerCase()}` === learnerClass)
    : learners;
  const selectLearner = (id) => {
    setLearnerId(id);
    const learner = learners.find((row) => row.id === id);
    if (learner) setCustomer(learner.full_name);
  };
  const saleProducts = catalogStockItems(products.filter(product => checkoutCampus && product.campus === checkoutCampus));
  const catalogue = tab === "pos" ? saleProducts.filter(p => p.active) : tab === "products" && status === "archived" ? scopedProducts.filter((p) => !p.active) : active;
  const filtered = catalogue.filter(
    (p) =>
      `${p.name} ${p.sku || ""} ${p.category || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" || status === "archived" ||
        (status === "low"
          ? p.quantity_on_hand <= p.reorder_level
          : p.quantity_on_hand === 0)),
  );
  const lines = cart.map((line) => ({
    ...line,
    product: saleProducts.find((p) => p.id === line.id),
  }));
  const total =
    lines.reduce(
      (sum, l) =>
        sum +
        Math.round(Number(l.product?.selling_price || 0) * 100) * l.quantity,
      0,
    ) / 100;
  const invalid = lines.some(
    (l) => !l.product?.active || l.quantity > l.product.quantity_on_hand,
  ) || new Set(lines.map(line => line.product?.currency || "USD")).size > 1;
  const frozen = busy || !!pending || !!legacyPending;
  const add = (p) => {
    if (frozen) return;
    if (lines.length && (lines[0].product?.currency || "USD") !== (p.currency || "USD")) {
      setError(`This basket uses ${lines[0].product?.currency || "USD"}. Clear it before adding a ${p.currency || "USD"} item.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((l) => l.id === p.id);
      return existing
        ? current.map((l) =>
            l.id === p.id
              ? { ...l, quantity: Math.min(l.quantity + 1, p.quantity_on_hand) }
              : l,
          )
        : [...current, { id: p.id, product_id: p.product_id || p.id, variant_id: p.variant_id || null, quantity: 1 }];
    });
  };
  const activeSales = sales.filter(sale => sale.status !== 'reversed');
  const receiptPeriod = sales.filter(
    (s) => (!month || s.created_at.slice(0, 7) === month) && (s.currency || "USD") === reportCurrency,
  );
  const period = receiptPeriod.filter(sale => sale.status !== 'reversed');
  const revenue = period.reduce((sum, s) => sum + Number(s.total), 0);
  const costKnown = period.every((s) =>
    s.pos_sale_items.every((l) => l.cost_total != null || l.unit_cost != null),
  );
  const cost = period.reduce(
    (sum, s) =>
      sum +
      s.pos_sale_items.reduce(
        (n, l) => n + (l.cost_total != null ? Number(l.cost_total) : Number(l.unit_cost || 0) * l.quantity),
        0,
      ),
    0,
  );
  const exportCSV = (rows, filename) => downloadCsv([
    ['School', 'Reliance Learning Centre'], ['Currency', filename.includes('stock') ? 'Per product row (USD or ZWG)' : reportCurrency],
    ['Campus access', profile?.campus || 'authorised'],
    ['Catalog campus filter', campusView], ['Stock filter', status],
    ['Month (sales/P&L)', month || 'all time'], ['Search', query],
    ['Generated at', new Date().toISOString()], [], ...rows,
  ], filename);
  const salesVisible = receiptPeriod.filter(s => receiptFilter === 'all' || (receiptFilter === 'balance' ? saleBalance(s) > 0 : s.status === 'reversed')).filter((s) =>
    `${s.receipt_number} ${s.customer_name || ""} ${methods[s.payment_method]}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const unitsSold = period.reduce(
    (sum, sale) =>
      sum + sale.pos_sale_items.reduce((lineSum, line) => lineSum + Number(line.quantity || 0), 0),
    0,
  );
  const grossProfit = costKnown ? revenue - cost : null;
  const grossMargin = grossProfit !== null && revenue ? (grossProfit / revenue) * 100 : null;
  const collections = saleCollections(sales).filter(p => (!month || (p.paid_on || p.created_at).slice(0,7) === month) && (p.currency || 'USD') === reportCurrency);
  const collectedTotal = collections.reduce((sum,p) => sum + Number(p.amount),0);
  const paymentSummary = Object.entries(methods)
    .map(([id, label]) => {
      const matching = collections.filter((sale) => sale.payment_method === id);
      return {
        id,
        label,
        count: matching.length,
        total: matching.reduce((sum, sale) => sum + Number(sale.amount || 0), 0),
      };
    })
    .filter((method) => method.count);
  const productProfitability = [...period
    .reduce((totals, sale) => {
      sale.pos_sale_items.forEach((line) => {
        const current = totals.get(line.product_name) || {
          name: line.product_name,
          units: 0,
          revenue: 0,
          cost: 0,
          costKnown: true,
        };
        current.units += Number(line.quantity || 0);
        current.revenue += Number(line.line_total || 0);
        if (line.cost_total != null) current.cost += Number(line.cost_total);
        else if (line.unit_cost == null) current.costKnown = false;
        else current.cost += Number(line.unit_cost || 0) * Number(line.quantity || 0);
        totals.set(line.product_name, current);
      });
      return totals;
    }, new Map())
    .values()]
    .map((product) => ({
      ...product,
      profit: product.costKnown ? product.revenue - product.cost : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const visibleLogs = useMemo(
    () =>
      logs.filter((entry) => {
        const matchesQuery = `${entry.action} ${entry.actor || ""} ${JSON.stringify(entry.details)}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesQuery && (logStatus === "all" || logStatus === "success");
      }),
    [logs, query, logStatus],
  );
  const visibleHelp = useMemo(
    () =>
      helpTopics.filter((topic) => {
        const text = `${topic.id} ${topic.title} ${topic.solution} ${topic.steps.join(" ")}`.toLowerCase();
        return (helpCategory === "all" || topic.category === helpCategory) && text.includes(helpQuery.toLowerCase());
      }),
    [helpCategory, helpQuery],
  );
  const currencyProducts = active.filter(product => (product.currency || "USD") === reportCurrency);
  const legacyInventoryCost = currencyProducts.reduce(
    (sum, product) => sum + Number(product.cost_price || 0) * Number(product.quantity_on_hand || 0),
    0,
  );
  let inventoryCost = legacyInventoryCost;
  let inventoryCostKnown = true;
  if (stockBatches !== null) {
    inventoryCost = 0;
    for (const product of currencyProducts) {
      const expectedStocks = product.has_variants
        ? (product.product_variants || []).filter(variant => variant.active).map(variant => ({ id: variant.id, quantity: Number(variant.quantity_on_hand || 0) }))
        : [{ id: null, quantity: Number(product.quantity_on_hand || 0) }];
      for (const expected of expectedStocks) {
        const batches = stockBatches.filter(batch => batch.product_id === product.id && batch.variant_id === expected.id && Number(batch.quantity_remaining) > 0);
        const remaining = batches.reduce((sum, batch) => sum + Number(batch.quantity_remaining || 0), 0);
        if (remaining !== expected.quantity || batches.some(batch => batch.currency !== product.currency || batch.campus !== product.campus)) {
          inventoryCostKnown = false;
        }
        inventoryCost += batches.reduce((sum, batch) => sum + Number(batch.quantity_remaining || 0) * Number(batch.unit_cost || 0), 0);
      }
    }
  }
  const inventoryRetail = currencyProducts.reduce(
    (sum, product) => sum + Number(product.selling_price || 0) * Number(product.quantity_on_hand || 0),
    0,
  );
  const topProducts = useMemo(() => {
    const totals = new Map();
    sales.filter(sale => sale.status !== 'reversed' && (sale.currency || "USD") === reportCurrency).forEach((sale) => sale.pos_sale_items.forEach((item) => {
      const current = totals.get(item.product_name) || { name: item.product_name, units: 0, revenue: 0 };
      current.units += Number(item.quantity || 0);
      current.revenue += Number(item.line_total || 0);
      totals.set(item.product_name, current);
    }));
    return [...totals.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 5);
  }, [sales, reportCurrency]);
  const salesTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return {
        key,
        label: date.toLocaleString("en", { month: "short" }),
        revenue: sales.filter((sale) => sale.status !== 'reversed' && sale.created_at.slice(0, 7) === key && (sale.currency || "USD") === reportCurrency).reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      };
    });
  }, [sales, reportCurrency]);
  const maxTrendRevenue = Math.max(1, ...salesTrend.map((point) => point.revenue));
  const checkout = () =>
    run(async () => {
      if (!checkoutCampus || legacyPending) throw new Error("Choose the sale campus and resolve any earlier checkout first.");
      if (pendingBalance) throw new Error('Recover the pending receipt payment before starting another checkout.');
      if (pending && pending.campus !== checkoutCampus) throw new Error("Recover this pending sale in its original campus.");
      const request = pending || {
        id: crypto.randomUUID(),
        campus: checkoutCampus,
        items: cart.map((l) => ({ product_id: l.product_id || l.id, variant_id: l.variant_id || null, quantity: l.quantity })),
        customer,
        payment,
        paid: Number(paid),
        studentId: learnerId || null,
      };
      if (
        !pending &&
        (!cart.length ||
          invalid ||
          !Number.isFinite(Number(paid)) ||
          Number(paid) <= 0 || (Number(paid) < total && !learnerId))
      )
        throw new Error("Check stock, enter a positive payment and select a learner for an unpaid balance.");
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          cart,
          held,
          customer,
          payment,
          paid,
          pending: request,
        }),
      );
      setPending(request);
      const result = await supabase.rpc("complete_pos_sale", {
        p_items: request.items,
        p_payment_method: request.payment,
        p_customer_name: request.customer,
        p_request_id: request.id,
        p_amount_paid: request.paid,
        p_campus: request.campus,
        p_student_id: request.studentId || null,
      });
      if (result.error) {
        // Server validation errors roll back the whole transaction; uncertain network failures retain the same request.
        if (
          ["P0001", "23514", "22P02", "22003", "42501", "PGRST202"].includes(
            result.error.code,
          )
        )
          setPending(null);
        throw result.error;
      }
      setPending(null);
      setCart([]);
      setCustomer("");
      setLearnerClass("");
      setLearnerId("");
      setPaid("");
      setNotice(`Sale ${result.data.receipt_number} completed.`);
      logActivity(supabase, user, profile, { actionType: "create", description: `Completed shop sale ${result.data.receipt_number}`, targetTable: "pos_sales", targetId: result.data.id });
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          cart: [],
          held,
          customer: "",
          learnerClass: "",
          learnerId: "",
          payment,
          paid: "",
          pending: null,
        }),
      );
      await load();
      const detail = await supabase
        .from("pos_sales")
        .select("*,pos_sale_items(*),pos_payments(*)")
        .eq("id", result.data.id)
        .single();
      if (detail.error) throw detail.error;
      setReceipt(detail.data);
    });
  const payReceiptBalance = () => run(async () => {
    const request = pendingBalance || { id: crypto.randomUUID(), saleId: receipt?.id, tendered: Number(balanceAmount), method: balanceMethod, reference: balanceReference.trim() };
    if (!request.saleId || !Number.isFinite(request.tendered) || request.tendered <= 0) throw new Error('Enter a positive amount received.');
    sessionStorage.setItem(paymentStorageKey, JSON.stringify(request)); setPendingBalance(request);
    const result = await supabase.rpc('record_pos_payment', { p_sale_id: request.saleId, p_tendered: request.tendered, p_payment_method: request.method, p_request_id: request.id, p_reference: request.reference || null });
    if (result.error) {
      if (['P0001','23514','22P02','22003','42501'].includes(result.error.code)) { sessionStorage.removeItem(paymentStorageKey); setPendingBalance(null); }
      throw result.error;
    }
    sessionStorage.removeItem(paymentStorageKey); setPendingBalance(null); setBalanceAmount(''); setBalanceReference(''); setReceipt(null);
    setNotice('Payment recorded against the original receipt. Stock is unchanged.');
    await load();
    const detail = await supabase.from('pos_sales').select('*,pos_sale_items(*),pos_payments(*)').eq('id',request.saleId).single();
    if (detail.error) throw new Error('Payment recorded. Refresh and reopen the receipt to see the latest balance.');
    setReceipt(detail.data);
  });
  const recoverLegacyCheckout = () => run(async () => {
    if (!checkoutCampus || !legacyPending || pending) throw new Error("Choose the original checkout campus before recovery.");
    const result = await supabase.rpc("complete_pos_sale", {
      p_items: legacyPending.items, p_payment_method: legacyPending.payment,
      p_customer_name: legacyPending.customer, p_request_id: legacyPending.id,
      p_amount_paid: legacyPending.paid, p_campus: checkoutCampus,
    });
    if (result.error) {
      if (result.error.code === "P0001" && result.error.message?.startsWith("This test checkout was cleared by Main Admin.")) {
        const legacy = readSession(legacyKey) || {};
        sessionStorage.setItem(legacyKey, JSON.stringify({ ...legacy, pending: null, cart: [] }));
        setLegacyPending(null);
      }
      throw result.error;
    }
    const legacy = readSession(legacyKey) || {};
    sessionStorage.setItem(legacyKey, JSON.stringify({ ...legacy, pending: null }));
    setLegacyPending(null);
    setNotice(`Earlier sale ${result.data.receipt_number} confirmed using its original request ID.`);
    await load();
    const detail = await supabase.from("pos_sales").select("*,pos_sale_items(*),pos_payments(*)").eq("id", result.data.id).single();
    if (detail.error) throw detail.error;
    setReceipt(detail.data);
  });
  const selectProductImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      validateProductImage(file);
      setForm(current => current ? { ...current, imageEditorSource: file } : null);
    } catch (error) { setError(error.message); }
  };
  const editProductImage = async () => {
    setError(""); setImageBusy(true);
    try {
      let source = form.imageBlob;
      if (!source) {
        const response = await fetch(form.image_url, { credentials: "omit" });
        if (!response.ok) throw new Error("Unable to load this photo. Choose the original image to edit it.");
        source = await response.blob();
      }
      validateProductImage(source);
      setForm(current => current ? { ...current, imageEditorSource: source } : null);
    } catch (error) { setError(error.message || "Unable to load this photo. Choose the original image to edit it."); }
    finally { setImageBusy(false); }
  };
  const applyProductImage = async (blob) => {
    setImageBusy(true);
    try {
      const preview = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to preview this image."));
        reader.readAsDataURL(blob);
      });
      setForm(current => current ? { ...current, imageBlob: blob, imagePreview: preview, imageEditorSource: null } : null);
    } catch (error) { setError(error.message); }
    finally { setImageBusy(false); }
  };
  const changeProductVisibility = () => {
    if (!canManageProducts || !form?.id) return;
    const savedProduct = products.find(product => product.id === form.id);
    if (!savedProduct) return;
    const active = !savedProduct.active;
    run(async () => {
      const result = await supabase.from("inventory_products")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", savedProduct.id).select("id").single();
      if (result.error) throw result.error;
      await load();
      setForm(current => current?.id === savedProduct.id ? {
        ...current, active,
        visibilityNotice: active ? "Product shown. Other edits remain unsaved." : "Product hidden. Order history is preserved. Other edits remain unsaved.",
      } : current);
      logActivity(supabase, user, profile, { actionType: "update", description: active ? "Show product" : "Hide product", targetTable: "inventory_products", targetId: savedProduct.id });
    });
  };
  const deleteProduct = () => {
    if (!admin || !form?.id || !window.confirm("Permanently delete this product? Products with any order history cannot be deleted. Use Hide to keep the catalog record.")) return;
    run(async () => {
      const oldImage = products.find(product => product.id === form.id)?.image_url;
      const result = await supabase.from("inventory_products").delete().eq("id", form.id).select("id").single();
      if (result.error) throw result.error;
      let cleanupFailed = false;
      try { await removeProductImage(supabase, oldImage); } catch { cleanupFailed = true; }
      setForm(null);
      await load();
      setNotice(cleanupFailed ? "Product deleted. Its unused photo could not be removed from storage." : "Unused product deleted.");
    });
  };
  const saveProduct = (event) => {
    event.preventDefault();
    if (!canManageProducts || imageBusy || variantBusy || form?.imageEditorSource) return;
    run(async () => {
      const savedProduct = products.find(product => product.id === form.id);
      const needsCampus = !form.id || !savedProduct?.campus;
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim(),
        currency: form.currency || "USD",
        image_url: form.image_url || null,
        selling_price: Number(form.selling_price),
        cost_price: Number(form.cost_price),
        reorder_level: Number(form.reorder_level),
        ...(form.id ? { active: Boolean(form.active) } : {}),
        ...(needsCampus ? { campus: form.campus } : {}),
      };
      if (!payload.name) throw new Error("Enter a product name.");
      if (!["junior", "senior"].includes(form.campus)) {
        throw new Error("Choose the campus that will own this stock.");
      }
      if (![payload.selling_price, payload.cost_price, payload.reorder_level].every(value => Number.isFinite(value) && value >= 0)
          || !Number.isInteger(payload.reorder_level)
          ) {
        throw new Error("Prices must be non-negative numbers; stock and thresholds must be whole numbers.");
      }
      const oldImage = savedProduct?.image_url;
      const allocationQuantity = Number(form.allocationQuantity ?? savedProduct?.quantity_on_hand);
      const allocating = Boolean(form.id && needsCampus && (savedProduct?.quantity_on_hand > 0 || savedProduct?.has_variants));
      if (allocating && (!Number.isInteger(allocationQuantity) || allocationQuantity < (savedProduct.quantity_on_hand > 0 ? 1 : 0) || allocationQuantity > savedProduct.quantity_on_hand)) throw new Error("Choose a whole allocation quantity within the available stock.");
      const partialAllocation = allocating && allocationQuantity < savedProduct.quantity_on_hand;
      if (partialAllocation && savedProduct.has_variants) throw new Error("Allocate sized products as a whole.");
      if (form.imageBlob) payload.image_url = await uploadProductImage(supabase, form.imageBlob, form.campus);
      else if (allocating) payload.image_url = await copyProductImageForCampus(supabase, payload.image_url, form.campus, partialAllocation);
      const result = allocating
        ? await supabase.rpc("split_unassigned_shop_product", { p_product: form.id, p_campus: form.campus, p_quantity: allocationQuantity, p_details: payload })
        : form.id
        ? await supabase
            .from("inventory_products")
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", form.id).select("id").single()
        : await supabase
            .from("inventory_products")
            .insert({
              ...payload,
              quantity_on_hand: 0,
              created_by: user.id,
            }).select("id").single();
      if (result.error) throw result.error;
      const savedProductId = typeof result.data === "string" ? result.data : form.id;
      logActivity(supabase, user, profile, { actionType: form.id ? "update" : "create", description: `${form.id ? "Updated" : "Created"} product ${payload.name}`, targetTable: "inventory_products", targetId: savedProductId });
      let cleanupFailed = false;
      if (!partialAllocation && oldImage && oldImage !== payload.image_url) {
        try { await removeProductImage(supabase, oldImage); } catch { cleanupFailed = true; }
      }
      setForm(null);
      await load();
      setNotice(cleanupFailed ? "Product saved. Its previous photo could not be removed from storage." : allocating ? (partialAllocation ? "Stock allocated. The remaining quantity stays in Unassigned." : "All stock allocated to the selected campus.") : "Product saved.");
    });
  };
  const receiveProductStock = () => {
    const product = products.find((row) => row.id === form?.id);
    if (!admin || !product || !product.campus) return;
    run(async () => {
      const supplierName = productReceiptDraft.supplier_name.trim();
      const reference = productReceiptDraft.supplier_reference.trim();
      const notes = productReceiptDraft.notes.trim();
      const quantity = Number(productReceiptDraft.quantity);
      const costText = productReceiptDraft.unit_cost.trim();
      if (!supplierName || supplierName.length > 200) {
        throw new Error("Enter a supplier name of 1 to 200 characters.");
      }
      if (reference.length > 120 || notes.length > 1000) {
        throw new Error("Check the supplier reference and notes lengths.");
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999999) {
        throw new Error("Enter a whole stock quantity from 1 to 9,999,999.");
      }
      if (!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$/.test(costText)) {
        throw new Error("Enter the supplier unit cost with no more than two decimal places.");
      }
      if (product.has_variants && !productReceiptDraft.variant_id) {
        throw new Error("Choose the size receiving this delivery.");
      }
      const payload = {
        supplier_name: supplierName,
        supplier_reference: reference || null,
        notes: notes || null,
        items: [{
          product_id: product.id,
          variant_id: product.has_variants ? productReceiptDraft.variant_id : null,
          quantity,
          unit_cost: Number(costText),
        }],
      };
      const payloadText = JSON.stringify(payload);
      const requestId = receiptRequest?.payload === payloadText ? receiptRequest.id : crypto.randomUUID();
      setReceiptRequest({ id: requestId, payload: payloadText });
      const result = await supabase.rpc("receive_shop_stock", {
        p_request_id: requestId,
        p_supplier_name: payload.supplier_name,
        p_supplier_reference: payload.supplier_reference,
        p_notes: payload.notes,
        p_items: payload.items,
      });
      if (result.error) throw result.error;
      setReceiptRequest(null);
      setForm(null);
      setProductReceiptDraft({ supplier_name: "", supplier_reference: "", notes: "", variant_id: "", quantity: "", unit_cost: "" });
      logActivity(supabase, user, profile, { actionType: "create", description: `Received stock for ${product.name}`, targetTable: "shop_stock_receipts", targetId: result.data });
      await load();
      setNotice(`Stock received for ${product.name}. This delivery’s supplier cost is recorded separately.`);
    });
  };
  const changeMyPassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = securityForm;
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error("Enter your current password, new password and confirmation.");
    }
    if (newPassword.length < 8) {
      throw new Error("Choose a new password with at least 8 characters.");
    }
    if (newPassword !== confirmPassword) {
      throw new Error("Your new password and confirmation do not match.");
    }
    if (!user?.email) {
      throw new Error("Your login email is unavailable. Use Staff to reset this account.");
    }
    const verification = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verification.error) {
      throw new Error("Your current password is incorrect.");
    }
    const update = await supabase.auth.updateUser({ password: newPassword });
    if (update.error) throw update.error;
    logActivity(supabase, user, profile, { actionType: "update", description: "Changed own password", targetTable: "profiles", targetId: user.id });
    setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setNotice("Your password has been changed. Use the new password the next time you sign in.");
  };
  if (!access)
    return (
      <p>Shop access requires an assigned Junior or Senior campus, or Main Admin access.</p>
    );
  return (
    <section className="shop-app">
      <header className="shop-hero">
        <div>
          <span className="shop-eyebrow">RELIANCE / SCHOOL SHOP</span>
          <h1>{role === "accountant" ? `${campus === "junior" ? "Junior" : "Senior"} school POS` : campusAdmin ? `${campus === "junior" ? "Junior" : "Senior"} school inventory` : "Inventory & point of sale"}</h1>
          <p>Every item accounted for. Every sale in one place.</p>
          <div className={`shop-live-status ${liveStatus}`}>
            {liveStatus === "live" ? <Wifi size={14} /> : <WifiOff size={14} />}
            {liveStatus === "live" ? "Live updates on" : liveStatus === "offline" ? "Live updates unavailable" : "Connecting live updates"}
            {lastUpdated && <span>· refreshed {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <button onClick={load} disabled={loading || busy}>
          <RefreshCw size={16} /> {loading ? "Loading…" : "Refresh"}
        </button>
      </header>
      <OperationsExports supabase={supabase} profile={profile} kinds={canManageProducts ? ['stock','sales',...(admin ? ['orders'] : [])] : ['sales','orders']} />
      {tab !== "pos" && <label className="shop-currency-filter">View currency<select aria-label="POS report currency" value={reportCurrency} onChange={event => setReportCurrency(event.target.value)}>{FINANCE_CURRENCIES.map(code => <option key={code}>{code}</option>)}</select><small>Totals and reports stay separate by currency.</small></label>}
      <nav className="shop-tabs" aria-label="Shop sections">
        {tabs
          .filter(([id]) =>
            campusAdmin ? ["products", "pos", "sales", "help"].includes(id) : admin
              ? true
              : ["pos", "sales"].includes(id),
          )
          .map(([id, label, Icon]) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "selected" : ""}
              onClick={() => {
                setTab(id);
                setQuery("");
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
      </nav>
      {pendingBalance && <div className="shop-message" role="status"><p>A receipt payment is awaiting confirmation. Retry the same request; do not collect the money again.</p><button type="button" disabled={busy} onClick={payReceiptBalance}>Recover pending receipt payment</button></div>}
      {admin && tab !== "pos" && <div className="shop-campus-controls">
        <label>Catalog campus<select aria-label="Catalog campus" value={campusView} onChange={event => setCampusView(event.target.value)}>
          <option value="all">Both campuses</option><option value="junior">Junior School</option><option value="senior">Senior School</option><option value="unassigned">Unassigned</option>
        </select></label>
        <p>{products.filter(product => !product.campus).length} products need campus allocation. Choose Unassigned to review their stock.</p>
      </div>}
      {tab === "pos" && admin && <label className="shop-pos-campus">Checkout campus
        <select aria-label="Checkout campus" value={checkoutCampus || ""} disabled={busy || !!pending} onChange={event => setCheckoutCampus(event.target.value || null)}>
          <option value="">Choose Junior or Senior</option><option value="junior">Junior School</option><option value="senior">Senior School</option>
        </select>
      </label>}
      {tab === "pos" && !checkoutCampus && <p className="shop-message">Select a checkout campus to load its sale items and basket.</p>}
      {legacyPending && <div className="shop-message" role="status">
        <p>An earlier checkout needs confirmation. It has not been moved into a new campus basket. Select its original campus and recover it before starting another sale.</p>
        <button disabled={busy || !!pending || !checkoutCampus} onClick={recoverLegacyCheckout}>Recover earlier checkout</button>
      </div>}
      {error && (
        <div role="alert" className="shop-message error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="shop-message">
          {notice}
        </div>
      )}
      {tab === "overview" && (
        <>
          <div className="shop-stats">
            <Stat label="Active products" value={active.length} />
            <Stat
              label="Units in stock"
              value={active.reduce((n, p) => n + p.quantity_on_hand, 0)}
            />
            <Stat
              label="All-time sales"
              value={money(activeSales.filter(s => (s.currency || "USD") === reportCurrency).reduce((n, s) => n + Number(s.total), 0), reportCurrency)}
            />
            <Stat
              label="Low / empty stock"
              value={
                active.filter((p) => p.quantity_on_hand <= p.reorder_level)
                  .length
              }
            />
          </div>
          <section className="shop-operational-grid">
            <article className="shop-panel">
              <h2><Activity size={18} /> Live shop pulse</h2>
              <div className="shop-value-grid">
                <div><span>Stock at cost ({reportCurrency})</span><strong>{inventoryCostKnown ? money(inventoryCost, reportCurrency) : "Reconcile batches"}</strong></div>
                <div><span>Potential retail value ({reportCurrency})</span><strong>{money(inventoryRetail, reportCurrency)}</strong></div>
                <div><span>Estimated stock margin ({reportCurrency})</span><strong>{inventoryCostKnown ? money(inventoryRetail - inventoryCost, reportCurrency) : "Unavailable"}</strong></div>
              </div>
              <div className="shop-health"><span>Inventory health</span><div><i style={{ width: `${active.length ? Math.round((active.filter((p) => p.quantity_on_hand > p.reorder_level).length / active.length) * 100) : 0}%` }} /></div><strong>{active.length ? `${active.filter((p) => p.quantity_on_hand > p.reorder_level).length}/${active.length} products above their reorder level` : "No active products"}</strong></div>
            </article>
            <article className="shop-panel">
              <h2><TrendingUp size={18} /> Sales momentum</h2>
              <div className="shop-trend" aria-label="Six-month sales trend">
                {salesTrend.map((point) => <div key={point.key}><span title={`${point.label}: ${money(point.revenue)}`} style={{ height: `${Math.max(4, Math.round((point.revenue / maxTrendRevenue) * 100))}%` }} /><small>{point.label}</small></div>)}
              </div>
              <p>{sales.length ? "Revenue trend from completed shop sales." : "Complete your first sale to start the live trend."}</p>
            </article>
          </section>
          <div className="shop-columns shop-overview-columns">
            <article className="shop-panel">
              <h2><ShoppingCart size={18} /> Sales oversight</h2>
              <p>
                {admin
                  ? "Review receipts and sales performance. Choose Point of sale to sell within an authorized campus."
                  : "Browse the catalogue, collect payment and issue a receipt. Inventory updates automatically when a sale completes."}
              </p>
              {admin ? (
                <button className="primary" onClick={() => setTab("sales")}>
                  <ReceiptText size={18} /> Review sales & receipts
                </button>
              ) : (
                <button className="primary" onClick={() => setTab("pos")}>
                  <ShoppingCart size={18} /> Open point of sale
                </button>
              )}
              <h3>Recent transactions</h3>
              {sales.slice(0, 5).map((s) => (
                <button
                  className="shop-row"
                  key={s.id}
                  onClick={() => setReceipt(s)}
                >
                  <span>
                    {s.customer_name || "Walk-in customer"}
                    <small>{s.receipt_number}{s.status === 'reversed' ? ' · REVERSED' : ''}</small>
                  </span>
                  <strong>{money(s.total, s.currency || "USD")}</strong>
                </button>
              ))}
              {!sales.length && <p>No sales recorded yet.</p>}
            </article>
            <article className="shop-panel">
              <h2><Boxes size={18} /> Stock watch</h2>
              {active
                .filter((p) => p.quantity_on_hand <= p.reorder_level)
      .map((p) => (
                  <div className="shop-row" key={p.id}>
                    <span>{p.name}</span>
                    <span className="shop-badge warning">
                      {p.quantity_on_hand} left
                    </span>
                  </div>
                ))}
              {!active.some((p) => p.quantity_on_hand <= p.reorder_level) && (
                <p>No stock alerts.</p>
              )}
              <h3>Top performing items</h3>
              {topProducts.map((product, index) => <div className="shop-row" key={product.name}><span><small>#{index + 1} · {product.units} units sold</small>{product.name}</span><strong>{money(product.revenue)}</strong></div>)}
              {!topProducts.length && <p>No completed sales yet.</p>}
            </article>
          </div>
        </>
      )}
      {["pos", "products"].includes(tab) && (
        <>
          <div className="shop-toolbar">
            <label className="shop-search">
              <Search size={17} />
              <input
                placeholder="Search name, SKU or category"
                aria-label="Search products"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Stock filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All stock</option>
              <option value="low">Low stock</option>
              <option value="empty">Out of stock</option>
              {tab === "products" && <option value="archived">Hidden products</option>}
            </select>
            <button onClick={() => setList(!list)}>
              {list ? "Grid view" : "List view"}
            </button>
            {tab === "products" && (
              <button
                onClick={() =>
                  exportCSV(
                    reportSheets('stock', filtered)[0].rows,
                    "reliance-stock.csv",
                  )
                }
              >
                Export stock CSV
              </button>
            )}
            {canManageProducts && tab === "products" && (
              <button className="primary" onClick={() => { setProductReceiptDraft({ supplier_name: "", supplier_reference: "", notes: "", variant_id: "", quantity: "", unit_cost: "" }); setForm({ ...blank, campus: campusAdmin ? campus : ["junior", "senior"].includes(campusView) ? campusView : "" }); }}>
                <Plus size={16} /> Add product
              </button>
            )}
          </div>
          <div className={tab === "pos" ? "shop-checkout-layout" : ""}>
            <div>
              <div className={`shop-catalog ${list ? "list" : ""}`}>
                {filtered.map((p) => (
                  <button
                    className="shop-product"
                    key={p.id}
                    disabled={
                      tab === "pos"
                        ? frozen || !ready || !p.quantity_on_hand
                        : !canManageProducts
                    }
                    onClick={() =>
                      tab === "pos"
                        ? add(p)
                        : (() => {
                            setProductReceiptDraft({ supplier_name: "", supplier_reference: "", notes: "", variant_id: "", quantity: "", unit_cost: "" });
                            setForm({
                              ...p,
                              allocationQuantity: p.quantity_on_hand,
                              sku: p.sku || "",
                              category: p.category || "",
                            });
                          })()
                    }
                  >
                    <ProductImage url={p.image_url} name={p.name} className="shop-product-icon" />
                    <small>
                      {p.category || "General"} · {p.sku || "No SKU"}
                    </small>
                    <strong>{p.name}</strong>
                    {tab === "products" && <small>{p.campus === "junior" ? "Junior School" : p.campus === "senior" ? "Senior School" : "Unassigned campus"}</small>}
                    <span
                      className={
                        p.quantity_on_hand <= p.reorder_level ? "shop-low" : ""
                      }
                    >
                      {p.active ? `${p.quantity_on_hand} units available` : "Hidden"}
                    </span>
                    <b>{money(p.selling_price, p.currency || "USD")}</b>
                    {tab === "products" && <span className="shop-edit-label">{admin ? "Edit product · receive stock" : "Edit product"}</span>}
                  </button>
                ))}
              </div>
              {!filtered.length && (
                <div className="shop-panel shop-empty">
                  {loading ? "Loading inventory…" : "No products found."}
                </div>
              )}
              {tab === "products" && canManageProducts && (
                <>
                {admin && <form
                  className="shop-panel shop-receive-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    run(async () => {
                      const payload = {
                        supplier_name: receiptDraft.supplier_name.trim(),
                        supplier_reference: receiptDraft.supplier_reference.trim() || null,
                        notes: receiptDraft.notes.trim() || null,
                        items: receiptDraft.items.map((line) => ({
                          product_id: line.product_id,
                          variant_id: line.variant_id || null,
                          quantity: line.quantity,
                          unit_cost: line.unit_cost,
                        })),
                      };
                      if (!payload.supplier_name) throw new Error("Enter the supplier name.");
                      if (payload.items.some((line) => !line.product_id || !line.quantity || line.unit_cost === "")) {
                        throw new Error("Choose a product and enter its quantity and supplier unit cost for every line.");
                      }
                      const requestId = receiptRequest?.payload === JSON.stringify(payload)
                        ? receiptRequest.id
                        : crypto.randomUUID();
                      setReceiptRequest({ id: requestId, payload: JSON.stringify(payload) });
                      const result = await supabase.rpc("receive_shop_stock", {
                        p_request_id: requestId,
                        p_supplier_name: payload.supplier_name,
                        p_supplier_reference: payload.supplier_reference,
                        p_notes: payload.notes,
                        p_items: payload.items,
                      });
                      if (result.error) throw result.error;
                      const receiptId = result.data;
                      setReceiptRequest(null);
                      setReceiptDraft({
                        supplier_name: "",
                        supplier_reference: "",
                        notes: "",
                        items: [{ product_id: "", variant_id: "", quantity: "", unit_cost: "" }],
                      });
                      setNotice(`Stock receipt recorded${receiptId ? ` (${receiptId})` : ""}.`);
                      await load();
                      logActivity(supabase, user, profile, { actionType: "create", description: "Received supplier stock", targetTable: "shop_stock_receipts", targetId: receiptId });
                    });
                  }}
                >
                  <h2>Receive supplier stock</h2>
                  <p>Record each delivery separately. Enter its supplier cost; the product’s selling price stays unchanged. For one product, open its card and choose Receive stock. Use this form to record a delivery with multiple products.</p>
                  <div className="shop-form-grid">
                    <label>
                      Supplier
                      <input required maxLength={200} value={receiptDraft.supplier_name} onChange={(event) => setReceiptDraft({ ...receiptDraft, supplier_name: event.target.value })} placeholder="Supplier name" />
                    </label>
                    <label>
                      Supplier reference <span className="shop-optional">Optional</span>
                      <input maxLength={120} value={receiptDraft.supplier_reference} onChange={(event) => setReceiptDraft({ ...receiptDraft, supplier_reference: event.target.value })} placeholder="Invoice or delivery note" />
                    </label>
                  </div>
                  <div className="shop-receipt-lines">
                    {receiptDraft.items.map((line, index) => {
                      const selectedProduct = products.find((product) => product.id === line.product_id);
                      const variants = selectedProduct?.product_variants?.filter((variant) => variant.active) || [];
                      const lineCost = Number(line.quantity) * Number(line.unit_cost);
                      return <div className="shop-receipt-line" key={index}>
                        <label>
                          Product
                          <select required value={line.product_id} onChange={(event) => setReceiptDraft((current) => ({ ...current, items: current.items.map((item, row) => row === index ? { ...item, product_id: event.target.value, variant_id: "" } : item) }))}>
                            <option value="">Choose product</option>
                            {active.filter((product) => ["junior", "senior"].includes(product.campus)).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.campus === "junior" ? "Junior" : "Senior"} · {product.currency || "USD"}</option>)}
                          </select>
                        </label>
                        {selectedProduct?.has_variants && <label>
                          Size
                          <select required value={line.variant_id} onChange={(event) => setReceiptDraft((current) => ({ ...current, items: current.items.map((item, row) => row === index ? { ...item, variant_id: event.target.value } : item) }))}>
                            <option value="">Choose size</option>
                            {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.size} · {variant.quantity_on_hand} available</option>)}
                          </select>
                        </label>}
                        <label>
                          Quantity
                          <input required type="number" min="1" max="9999999" step="1" inputMode="numeric" value={line.quantity} onChange={(event) => setReceiptDraft((current) => ({ ...current, items: current.items.map((item, row) => row === index ? { ...item, quantity: event.target.value } : item) }))} />
                        </label>
                        <label>
                          Unit cost {selectedProduct ? `(${selectedProduct.currency || "USD"})` : ""}
                          <input required type="number" min="0" max="9999999999" step="0.01" inputMode="decimal" value={line.unit_cost} onChange={(event) => setReceiptDraft((current) => ({ ...current, items: current.items.map((item, row) => row === index ? { ...item, unit_cost: event.target.value } : item) }))} placeholder="0.00" />
                        </label>
                        <div className="shop-receipt-line-total"><span>Line cost</span><strong>{money(Number.isFinite(lineCost) ? lineCost : 0, selectedProduct?.currency || "USD")}</strong></div>
                        {receiptDraft.items.length > 1 && <button type="button" className="shop-receipt-remove" onClick={() => setReceiptDraft((current) => ({ ...current, items: current.items.filter((_, row) => row !== index) }))}>Remove line</button>}
                      </div>;
                    })}
                  </div>
                  <button type="button" onClick={() => setReceiptDraft((current) => ({ ...current, items: [...current.items, { product_id: "", variant_id: "", quantity: "", unit_cost: "" }] }))} disabled={busy || receiptDraft.items.length >= 100}><Plus size={16} /> Add another product</button>
                  <label className="shop-receipt-notes">
                    Notes <span className="shop-optional">Optional</span>
                    <textarea maxLength={1000} rows={2} value={receiptDraft.notes} onChange={(event) => setReceiptDraft({ ...receiptDraft, notes: event.target.value })} placeholder="Delivery details or internal notes" />
                  </label>
                  <p className="shop-form-note">Each product’s stock is updated in its assigned campus and currency. POS uses the oldest available cost batches first.</p>
                  <button className="primary" disabled={busy || !ready || !receiptDraft.items.length}>{busy ? "Recording receipt…" : "Record stock receipt"}</button>
                </form>}
                {admin && <section className="shop-panel shop-stock-ledger">
                  <h2>Recent stock receipts</h2>
                  <p>Delivery costs stay attached to their own stock batches, even when the same product is later received at a different price.</p>
                  {stockReceipts === null
                    ? <p className="shop-empty">Stock receipt history is available after the stock receipt migrations are applied.</p>
                    : stockReceipts.length === 0
                      ? <p className="shop-empty">No stock receipts have been recorded yet.</p>
                      : <div className="shop-stock-ledger-list">{stockReceipts.map((stockReceipt) => {
                        const batches = (stockBatches || []).filter((batch) => batch.receipt_id === stockReceipt.id);
                        const kindLabels = { supplier: "Supplier delivery", opening: "Opening stock", adjustment: "Stock correction", allocation: "Campus allocation", return: "Sale return" };
                        return <details className="shop-stock-ledger-entry" key={stockReceipt.id}>
                          <summary>
                            <span><strong>{stockReceipt.supplier_name}</strong><small>{stockReceipt.supplier_reference || kindLabels[stockReceipt.receipt_kind] || "Stock receipt"}</small></span>
                            <span className="shop-stock-ledger-meta"><b>{kindLabels[stockReceipt.receipt_kind] || "Supplier delivery"}</b><small>{new Date(stockReceipt.created_at).toLocaleString("en-ZW")}</small></span>
                          </summary>
                          {stockReceipt.notes && <p className="shop-stock-ledger-notes">{stockReceipt.notes}</p>}
                          {batches.length
                            ? <div className="shop-table shop-stock-ledger-table"><table>
                              <thead><tr><th>Product / size</th><th>Campus</th><th>Received</th><th>Remaining</th><th>Unit cost</th><th>Receipt cost</th></tr></thead>
                              <tbody>{batches.map((batch) => {
                                const product = products.find((row) => row.id === batch.product_id);
                                const variant = product?.product_variants?.find((row) => row.id === batch.variant_id);
                                return <tr key={batch.id}>
                                  <td><strong>{product?.name || "Product"}</strong>{variant && <small>{variant.size}</small>}</td>
                                  <td>{batch.campus === "junior" ? "Junior" : "Senior"}</td>
                                  <td>{batch.quantity_received}</td>
                                  <td>{batch.quantity_remaining}</td>
                                  <td>{money(batch.unit_cost, batch.currency)}</td>
                                  <td>{money(Number(batch.unit_cost) * Number(batch.quantity_received), batch.currency)}</td>
                                </tr>;
                              })}</tbody>
                            </table></div>
                            : <p className="shop-empty">This record has no remaining batch detail available.</p>}
                        </details>;
                      })}</div>}
                  <p className="shop-form-note">Showing the 50 most recent receipt records.</p>
                </section>}
                <form
                  className="shop-panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      const r = await supabase.rpc("adjust_shop_stock", {
                        p_product: adjust.product,
                        p_change: Number(adjust.change),
                        p_reason: adjust.reason,
                      });
                      if (r.error) throw r.error;
                      logActivity(supabase, user, profile, { actionType: "update", description: "Adjusted shop stock", targetTable: "inventory_products", targetId: adjust.product });
                      setAdjust({ product: "", change: "", reason: "" });
                      setNotice("Stock adjusted.");
                      await load();
                    });
                  }}
                >
                  <h2>Manual stock adjustment</h2>
                  {admin && <p>Use this for corrections only. Supplier deliveries should be entered in Receive supplier stock so their costs remain attached.</p>}
                  <div className="shop-form-grid">
                    <label>
                      Product
                      <select
                        required
                        value={adjust.product}
                        onChange={(e) =>
                          setAdjust({ ...adjust, product: e.target.value })
                        }
                      >
                        <option value="">Choose product</option>
                        {active.filter(p => !p.has_variants).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantity change
                      <input
                        required
                        type="number"
                        step="1"
                        placeholder="10 to receive, -2 to remove"
                        value={adjust.change}
                        onChange={(e) =>
                          setAdjust({ ...adjust, change: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Reason
                      <input
                        required
                        value={adjust.reason}
                        onChange={(e) =>
                          setAdjust({ ...adjust, reason: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <button className="primary" disabled={busy || !ready}>
                    Save adjustment
                  </button>
                </form>
                </>
              )}
            </div>
            {tab === "pos" && (
              <aside className="shop-panel shop-cart">
                <h2>
                  Checkout summary <ShoppingCart size={20} />
                </h2>
                <p>{cart.length} product lines</p>
                {lines.map((l) => (
                  <div className="shop-cart-line" key={l.id}>
                    <div>
                      <strong>
                        {l.product?.name || "Unavailable product"}
                      </strong>
                      <small>{money(l.product?.selling_price, l.product?.currency || "USD")} each</small>
                    </div>
                    <div className="shop-quantity">
                      <button
                        disabled={frozen}
                        aria-label={`Remove one ${l.product?.name}`}
                        onClick={() =>
                          setCart(
                            cart.flatMap((c) =>
                              c.id !== l.id
                                ? [c]
                                : c.quantity > 1
                                  ? [{ ...c, quantity: c.quantity - 1 }]
                                  : [],
                            ),
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <b>{l.quantity}</b>
                      <button
                        disabled={
                          frozen ||
                          l.quantity >= (l.product?.quantity_on_hand || 0)
                        }
                        aria-label={`Add one ${l.product?.name}`}
                        onClick={() => add(l.product)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {!cart.length && (
                  <p className="shop-empty">Select products to begin a sale.</p>
                )}
                <fieldset disabled={frozen}>
                  <div className="shop-learner-picker">
                    <span>Attach a learner <em>Required for an unpaid balance</em></span>
                    <div>
                      <label>
                        Class
                        <select
                          value={learnerClass}
                          onChange={(e) => {
                            setLearnerClass(e.target.value);
                            setLearnerId("");
                          }}
                        >
                          <option value="">All classes</option>
                          {learnerClassOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                        </select>
                      </label>
                      <label>
                        Learner
                        <select aria-label="Learner for sale" value={learnerId} onChange={(e) => selectLearner(e.target.value)}>
                          <option value="">Select a learner</option>
                          {visibleLearners.map((learner) => <option key={learner.id} value={learner.id}>{learner.full_name} · {learner.admission_number}</option>)}
                        </select>
                      </label>
                    </div>
                    <small>Selecting a learner links their receipt to the family portal. Walk-in sales must be fully paid.</small>
                  </div>
                  <label>
                    Student / customer name
                    <input
                      value={customer}
                      onChange={(e) => {
                        setCustomer(e.target.value);
                        setLearnerId("");
                      }}
                      placeholder="Walk-in customer"
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Payment method
                    <select
                      value={payment}
                      onChange={(e) => setPayment(e.target.value)}
                    >
                      {Object.entries(methods).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="shop-total">
                    <span>Total payable</span>
                    <strong>{money(total, lines[0]?.product?.currency || "USD")}</strong>
                  </div>
                  <label>
                    Amount received ({lines[0]?.product?.currency || "USD"})
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paid}
                      onChange={(e) => setPaid(e.target.value)}
                    />
                  </label>
                  <div className="shop-row">
                    <span>Change due</span>
                    <strong>{money(Math.max(0, Number(paid) - total), lines[0]?.product?.currency || "USD")}</strong>
                  </div>
                  <div className="shop-row"><span>Balance due</span><strong>{money(Math.max(0,total-Number(paid || 0)),lines[0]?.product?.currency || 'USD')}</strong></div>
                  {Number(paid)<total && <p>Select a learner for an unpaid balance. Completing checkout issues the items now; the balance remains on this receipt.</p>}
                  <div className="shop-actions">
                    <button
                      onClick={() => {
                        setCart([]);
                        setCustomer("");
                        setLearnerClass("");
                        setLearnerId("");
                        setPaid("");
                      }}
                    >
                      Clear
                    </button>
                    <button
                      disabled={!cart.length}
                      onClick={() => {
                        setHeld([
                          ...held,
                          { id: crypto.randomUUID(), cart, customer, learnerClass, learnerId, payment },
                        ]);
                        setCart([]);
                        setCustomer("");
                        setLearnerClass("");
                        setLearnerId("");
                        setPaid("");
                      }}
                    >
                      Hold cart
                    </button>
                  </div>
                </fieldset>
                {invalid && (
                  <p role="alert" className="shop-low">
                    Some items exceed available stock. Adjust the cart.
                  </p>
                )}
                <button
                  className="primary shop-full"
                  disabled={
                    busy ||
                    !ready || !checkoutCampus || !!legacyPending || !!pendingBalance ||
                    (!pending &&
                      (!cart.length ||
                        invalid ||
                        paid === "" ||
                        Number(paid) <= 0 || (Number(paid) < total && !learnerId)))
                  }
                  onClick={checkout}
                >
                  {busy
                    ? "Processing…"
                    : pending
                      ? "Retry pending sale"
                      : "Complete checkout"}
                </button>
                {pending && (
                  <p>
                    A confirmation is pending. Retry to retrieve this same sale
                    without charging it twice.
                  </p>
                )}
                <small>Record payment only after it has been received.</small>
                <h3>Held carts ({held.length})</h3>
                {held.map((h) => (
                  <div className="shop-row" key={h.id}>
                    <span>
                      {h.customer || "Walk-in"}
                      <small>{h.cart.length} product lines</small>
                    </span>
                    <button
                      disabled={frozen || !!cart.length}
                      onClick={() => {
                        setCart(h.cart);
                        setCustomer(h.customer);
                        setLearnerClass(h.learnerClass || "");
                        setLearnerId(h.learnerId || "");
                        setPayment(h.payment);
                        setPaid("");
                        setHeld(held.filter((x) => x.id !== h.id));
                      }}
                    >
                      Resume
                    </button>
                    <button
                      disabled={frozen}
                      aria-label="Delete held cart"
                      onClick={() => setHeld(held.filter((x) => x.id !== h.id))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <small>
                  Held carts stay in this browser tab and do not reserve stock.
                </small>
              </aside>
            )}
          </div>
        </>
      )}
      {tab === "sales" && (
        <>
          <div className="shop-toolbar">
            <label>
              Receipt month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <button onClick={() => setMonth("")}>All time</button>
            <label>Receipt status<select value={receiptFilter} onChange={event => { setReceiptFilter(event.target.value); if(event.target.value === 'balance') setMonth(''); }}><option value="all">All receipts</option><option value="balance">Outstanding balances</option><option value="reversed">Reversed receipts</option></select></label>
            <label className="shop-search">
              <Search size={17} />
              <input
                aria-label="Search receipts"
                placeholder="Receipt, customer or payment"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              onClick={() =>
                exportCSV(
                  reportSheets('sales', salesVisible).flatMap(sheet => [[sheet.name], ...sheet.rows, []]),
                  "reliance-receipt-ledger.csv",
                )
              }
            >
              Export receipt ledger
            </button>
          </div>
          <div className="shop-stats">
            <Stat label="Completed sales" value={period.length} />
            <Stat label="Collected" value={money(collectedTotal,reportCurrency)} tone="positive" />
            <Stat label="Outstanding balance" value={money(period.reduce((sum,s)=>sum+saleBalance(s),0),reportCurrency)} />
            <Stat label="Items sold" value={unitsSold} />
            <Stat label="Average sale" value={money(period.length ? revenue / period.length : 0)} />
          </div>
          <div className="shop-receipts-layout">
            <div className="shop-panel shop-table">
              <h2>Receipt ledger</h2>
              <p>Original receipts remain visible after reversal. Reversed sales are excluded from active totals. A reversal does not refund money; settlement must be reviewed separately.</p>
              <table>
                <thead><tr><th>Receipt / buyer</th><th>Date & time</th><th>Payment</th><th>Total</th><th>Receipt</th></tr></thead>
                <tbody>
                  {salesVisible.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.receipt_number}</strong><small>{s.customer_name || "Walk-in customer"}</small><small>{s.campus === "junior" ? "Junior School" : s.campus === "senior" ? "Senior School" : "Legacy school shop"}</small><small>{s.status === 'reversed' ? 'REVERSED · settlement review required' : 'Completed'}</small></td>
                      <td>{new Date(s.created_at).toLocaleString()}</td>
                      <td><span className="shop-payment-badge">{methods[s.payment_method]}</span></td>
                      <td className="shop-receipt-amount">{money(s.total, s.currency || "USD")}<small>Paid {money(salePaid(s),s.currency || 'USD')}</small><small>Balance {money(saleBalance(s),s.currency || 'USD')}</small></td>
                      <td><button onClick={() => { setReceipt(s); setReversalReason(''); setBalanceAmount(''); setBalanceReference(''); }}>Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!salesVisible.length && <p className="shop-empty">No receipts match this period.</p>}
            </div>
            <aside className="shop-panel shop-payment-panel">
              <h2>Payment collection</h2>
              <p>How completed payments were received in this period.</p>
              <div className="shop-payment-list">
                {paymentSummary.map((method) => (
                  <div key={method.id}><span>{method.label}<small>{method.count} payment{method.count === 1 ? "" : "s"}</small></span><strong>{money(method.total, reportCurrency)}</strong></div>
                ))}
                {!paymentSummary.length && <p className="shop-empty">No payments recorded.</p>}
              </div>
            </aside>
          </div>
        </>
      )}
      {tab === "analytics" && (
        <>
          <div className="shop-toolbar">
            <label>Profit & loss month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
            <button onClick={() => setMonth("")}>All time</button>
            <span>Currency: {reportCurrency}</span>
            <button onClick={() => exportCSV([["Currency", reportCurrency], ["Product", "Units sold", "Revenue", "Cost of goods", "Gross profit", "Margin"], ...productProfitability.map((product) => [product.name, product.units, product.revenue, product.costKnown ? product.cost : "Unknown", product.profit ?? "Unknown", product.profit !== null && product.revenue ? `${((product.profit / product.revenue) * 100).toFixed(1)}%` : "Unknown"])], "reliance-profit-and-loss.csv")}>Export P&L</button>
          </div>
          <div className="shop-stats shop-stats-five">
            <Stat label="Completed sales" value={period.length} />
            <Stat label="Gross revenue" value={money(revenue)} tone="revenue" />
            <Stat label="Cost of goods" value={costKnown ? money(cost) : "Unknown"} tone="cost" />
            <Stat label="Gross profit" value={grossProfit === null ? "Unavailable" : money(grossProfit)} tone="positive" />
            <Stat label="Gross margin" value={grossMargin === null ? "Unknown" : `${grossMargin.toFixed(1)}%`} />
          </div>
          <div className="shop-profit-layout">
            <div className="shop-panel shop-table">
              <h2>Product profitability</h2>
              <p>Cost of goods follows the supplier batches used at checkout. Opening stock uses its recorded product cost; historical supplier costs are unavailable. Gross profit excludes operating expenses.</p>
              <table>
                <thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Cost</th><th>Gross profit</th><th>Margin</th></tr></thead>
                <tbody>{productProfitability.map((product) => <tr key={product.name}><td><strong>{product.name}</strong></td><td>{product.units}</td><td>{money(product.revenue)}</td><td>{product.costKnown ? money(product.cost) : "Unknown"}</td><td className="shop-profit-value">{product.profit === null ? "Unknown" : money(product.profit)}</td><td>{product.profit !== null && product.revenue ? `${((product.profit / product.revenue) * 100).toFixed(1)}%` : "Unknown"}</td></tr>)}</tbody>
              </table>
              {!productProfitability.length && <p className="shop-empty">No completed sales in this period.</p>}
            </div>
            <aside className="shop-panel shop-insight-panel">
              <h2>Report health</h2>
              <div className="shop-insight"><span>Cost snapshots</span><strong className={costKnown ? "shop-good" : "shop-warning"}>{costKnown ? "Complete" : "Needs review"}</strong><p>{costKnown ? "Sales use the costs of the batches issued. Opening stock uses the cost recorded at cutover." : "Some older sale lines have no cost snapshot, so their profit remains unknown."}</p></div>
              <div className="shop-insight"><span>Collection methods</span><strong>{paymentSummary.length}</strong><p>{paymentSummary.map((method) => method.label).join(", ") || "No payments recorded"}</p></div>
              <div className="shop-insight"><span>Scope</span><strong>{month || "All time"}</strong><p>{unitsSold} item{unitsSold === 1 ? "" : "s"} sold across {period.length} completed sale{period.length === 1 ? "" : "s"}.</p></div>
            </aside>
          </div>
        </>
      )}
      {tab === "logs" && admin && (
        <div className="shop-panel shop-table">
          <h2>Real-time shop audit log</h2>
          <p>Latest 200 stock, product, checkout and preference events. The log records committed changes only.</p>
          <div className="shop-toolbar">
            <label className="shop-search">
              <Search size={17} />
              <input
                aria-label="Search audit log"
                placeholder="Search action or staff ID"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select aria-label="Audit status" value={logStatus} onChange={(e) => setLogStatus(e.target.value)}>
              <option value="all">All completed events</option>
              <option value="success">Completed only</option>
            </select>
            <button onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh feed</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Staff ID</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((l) => (
                <tr key={l.id}>
                  <td><span className="shop-badge success">Completed</span><small>{l.action}</small></td>
                  <td>{l.actor || "System"}</td>
                  <td>
                    <details>
                      <summary>View change</summary>
                      <pre>{JSON.stringify(l.details, null, 2)}</pre>
                    </details>
                  </td>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleLogs.length && <p className="shop-empty">No audit events match this filter.</p>}
        </div>
      )}
      {tab === "settings" && admin && (
        <form
          className="shop-panel"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (settingsSection === "security") {
                await changeMyPassword();
                return;
              }
              const r = await supabase
                .from("shop_settings")
                .update({
                  store_name: settings.store_name.trim(),
                  receipt_header: settings.receipt_header.trim(),
                  low_stock_alerts_enabled: Boolean(settings.low_stock_alerts_enabled),
                  alert_phone: settings.alert_phone.trim() || null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", true);
              if (r.error) throw r.error;
              logActivity(supabase, user, profile, { actionType: "update", description: "Updated shop preferences", targetTable: "shop_settings" });
              setNotice("Preferences saved.");
              await load();
            });
          }}
        >
          <h2>System preferences & settings</h2>
          <p>Configure shop details, stock monitoring, notification details and access guidance.</p>
          <div className="shop-settings-tabs" role="tablist" aria-label="Shop settings">
            {[["store", "Store details", Store], ["inventory", "Inventory rules", SlidersHorizontal], ["alerts", "WhatsApp alerts", Bell], ["security", "Security & access", ShieldCheck]].map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={settingsSection === id} className={settingsSection === id ? "selected" : ""} onClick={() => setSettingsSection(id)}><Icon size={16} /> {label}</button>
            ))}
          </div>
          {settingsSection === "store" && <div className="shop-form-grid">
            <label>
              Store name
              <input
                required
                value={settings.store_name}
                onChange={(e) =>
                  setSettings({ ...settings, store_name: e.target.value })
                }
              />
            </label>
            <label>
              Receipt header
              <input
                required
                value={settings.receipt_header}
                onChange={(e) =>
                  setSettings({ ...settings, receipt_header: e.target.value })
                }
              />
            </label>
          </div>}
          {settingsSection === "inventory" && <div className="shop-settings-copy"><h3>Per-product stock rules</h3><p>Each product has its own low-stock threshold. Change it from Products → select product → Low stock threshold. Low or empty items appear on the overview and can be filtered in the catalogue.</p><button type="button" onClick={() => setTab("products")}>Manage products</button></div>}
          {settingsSection === "alerts" && <div className="shop-form-grid"><label className="shop-checkbox"><input type="checkbox" checked={Boolean(settings.low_stock_alerts_enabled)} onChange={(e) => setSettings({ ...settings, low_stock_alerts_enabled: e.target.checked })} /> Show low-stock alert reminders</label><label>WhatsApp recipient number<input inputMode="tel" placeholder="+263…" value={settings.alert_phone || ""} onChange={(e) => setSettings({ ...settings, alert_phone: e.target.value })} /></label><p className="shop-form-note">Reliance saves this recipient and shows stock reminders in the shop. Automatic WhatsApp sending needs a connected WhatsApp provider before messages can be delivered.</p></div>}
          {settingsSection === "security" && <div className="shop-settings-copy"><h3>Change my password</h3><p>Confirm your current password before choosing a new one. This changes only your own Reliance account.</p><div className="shop-form-grid"><PasswordInput id="current-password" label="Current password" required minLength={0} autoComplete="current-password" value={securityForm.currentPassword} onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })} /><PasswordInput id="new-password" label="New password" required minLength={8} autoComplete="new-password" value={securityForm.newPassword} onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })} /><PasswordInput id="confirm-new-password" label="Confirm new password" required minLength={8} autoComplete="new-password" value={securityForm.confirmPassword} onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })} /></div><h3>Staff account resets</h3><p>To reset another staff member’s password, open the Staff workspace, choose their record, and use Reset credentials. That protected route updates only the selected account and records the change.</p></div>}
          <button className="primary" disabled={busy || !ready}>
            {settingsSection === "security" ? "Update my password" : "Save preferences"}
          </button>
        </form>
      )}
      {tab === "help" && (
        <>
          <section className="shop-help-hero"><span>QUICK ACTIONS & WORKFLOW GUIDE</span><h2>Inventory & POS help</h2><label className="shop-search"><Search size={18} /><input aria-label="Search help" placeholder="Search an error code, keyword, or problem" value={helpQuery} onChange={(e) => setHelpQuery(e.target.value)} /></label></section>
          <nav className="shop-help-filters" aria-label="Help topics">{[["all", "All topics"], ["checkout", "Checkout & sales"], ["inventory", "Stock & products"], ["reports", "Receipts & reports"], ["auth", "Access & permissions"]].map(([id, label]) => <button key={id} className={helpCategory === id ? "selected" : ""} onClick={() => setHelpCategory(id)}>{label}</button>)}</nav>
          <div className="shop-panel"><h2>Troubleshooting & error resolutions</h2>{visibleHelp.map((topic) => <article className="shop-help" key={topic.id}><button className="shop-help-trigger" aria-expanded={openHelp === topic.id} onClick={() => setOpenHelp(openHelp === topic.id ? "" : topic.id)}><span><code>{topic.id}</code>{topic.title}</span><span>{openHelp === topic.id ? "−" : "+"}</span></button>{openHelp === topic.id && <div className="shop-help-answer"><p>{topic.solution}</p><ol>{topic.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>}</article>)}{!visibleHelp.length && <p className="shop-empty">No help topics match “{helpQuery}”.</p>}</div>
        </>
      )}
      {form && (
        <div className="shop-overlay">
          <form
            ref={dialogRef} tabIndex={-1} className="shop-dialog shop-product-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Product editor"
            onSubmit={saveProduct}
          >
            <h2>{form.id ? "Edit product" : "Add product"}</h2>
            {error && (
              <p role="alert" className="shop-message error">
                {error}
              </p>
            )}
            {admin && form.id && form.campus && products.find(product => product.id === form.id)?.campus && <details className="shop-product-stock-receive">
              <summary>Receive stock for this product</summary>
              <p>Record this delivery’s supplier cost as a separate stock batch. It does not change the saved selling price or default correction cost.</p>
              <p className="shop-product-stock-current">Current stock: <strong>{form.quantity_on_hand || 0} units</strong>. Save any product detail changes before recording a delivery.</p>
              <div className="shop-product-stock-fields">
                <label>
                  Supplier
                  <input maxLength={200} value={productReceiptDraft.supplier_name} onKeyDown={event => { if (event.key === "Enter" && event.target.matches("input")) event.preventDefault(); }} onChange={event => setProductReceiptDraft(current => ({ ...current, supplier_name: event.target.value }))} placeholder="Supplier name" />
                </label>
                <label>
                  Supplier reference <span className="shop-optional">Optional</span>
                  <input maxLength={120} value={productReceiptDraft.supplier_reference} onKeyDown={event => { if (event.key === "Enter" && event.target.matches("input")) event.preventDefault(); }} onChange={event => setProductReceiptDraft(current => ({ ...current, supplier_reference: event.target.value }))} placeholder="Invoice or delivery note" />
                </label>
                {form.has_variants && <label>
                  Size
                  <select aria-label="Size for received stock" value={productReceiptDraft.variant_id} onChange={event => setProductReceiptDraft(current => ({ ...current, variant_id: event.target.value }))}>
                    <option value="">Choose size</option>
                    {(form.product_variants || []).filter(variant => variant.active).map(variant => <option key={variant.id} value={variant.id}>{variant.size} · {variant.quantity_on_hand} available</option>)}
                  </select>
                </label>}
                <label>
                  Quantity to receive
                  <input type="number" min="1" max="9999999" step="1" inputMode="numeric" value={productReceiptDraft.quantity} onKeyDown={event => { if (event.key === "Enter" && event.target.matches("input")) event.preventDefault(); }} onChange={event => setProductReceiptDraft(current => ({ ...current, quantity: event.target.value }))} />
                </label>
                <label>
                  Supplier unit cost ({form.currency || "USD"})
                  <input type="number" min="0" max="9999999999" step="0.01" inputMode="decimal" value={productReceiptDraft.unit_cost} onKeyDown={event => { if (event.key === "Enter" && event.target.matches("input")) event.preventDefault(); }} onChange={event => setProductReceiptDraft(current => ({ ...current, unit_cost: event.target.value }))} placeholder="0.00" />
                </label>
              </div>
              <label className="shop-product-stock-notes">
                Delivery notes <span className="shop-optional">Optional</span>
                <textarea maxLength={1000} rows={2} value={productReceiptDraft.notes} onChange={event => setProductReceiptDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Delivery details" />
              </label>
              <p className="shop-product-stock-total">Delivery total <strong>{money(Number(productReceiptDraft.quantity || 0) * Number(productReceiptDraft.unit_cost || 0), form.currency || "USD")}</strong></p>
              <button type="button" className="primary" disabled={busy || !ready} onClick={receiveProductStock}>{busy ? "Recording delivery…" : "Record this delivery"}</button>
            </details>}
            <fieldset className="shop-product-fields" disabled={busy || imageBusy || variantBusy}>
            <div className="shop-form-grid">
              <label>Currency<select required disabled={Boolean(form.id && !products.find(product => product.id === form.id)?.campus)} value={form.currency || "USD"} onChange={event => setForm({ ...form, currency: event.target.value })}>{FINANCE_CURRENCIES.map(code => <option key={code}>{code}</option>)}</select><small>Changing this affects future sales only; old receipts keep their saved currency.</small></label>
              {[
                ["name", "Product name", "text"],
                ["sku", "SKU (optional)", "text"],
                ["category", "Category", "text"],
                ["selling_price", `Selling price (${form.currency || "USD"})`, "number"],
                ["cost_price", `Default correction cost (${form.currency || "USD"})`, "number"],
                ["reorder_level", "Low stock threshold", "number"],
              ].map(([key, label, type]) => (
                <label key={key}>
                  {label}
                  <input
                    required={key !== "sku" && key !== "category"}
                    type={type}
                    inputMode={type === "number" ? (["selling_price", "cost_price"].includes(key) ? "decimal" : "numeric") : undefined}
                    min={type === "number" ? 0 : undefined}
                    step={
                      ["selling_price", "cost_price"].includes(key)
                        ? "0.01"
                        : type === "number"
                          ? "1"
                          : undefined
                    }
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Campus
                <select
                  aria-label="Campus"
                  required
                  disabled={campusAdmin || Boolean(form.id && products.find(product => product.id === form.id)?.campus)}
                  value={form.campus || ""}
                  onChange={(e) => setForm({ ...form, campus: e.target.value })}
                >
                  <option value="">Choose campus</option>
                  <option value="junior">Junior School</option>
                  <option value="senior">Senior School</option>
                </select>
                {form.id && <small>{products.find(product => product.id === form.id)?.campus ? "Campus is locked after assignment." : "Choose the campus and stock quantity to allocate."}</small>}
              </label>
              {admin && form.id && !products.find(product => product.id === form.id)?.campus && <label>
                Allocation quantity
                <input type="number" inputMode="numeric" required min={form.quantity_on_hand > 0 ? 1 : 0} max={form.quantity_on_hand} step="1" disabled={form.has_variants} value={form.allocationQuantity ?? form.quantity_on_hand} onChange={event => setForm({ ...form, allocationQuantity: event.target.value })} />
                <small>Allocating all {form.quantity_on_hand} assigns this product. A smaller quantity creates a separate campus product and leaves the remainder unassigned. Sized products are allocated as a whole.</small>
              </label>}
              {form.id && (
                <label className="shop-checkbox">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  Show in shop (uncheck to hide)
                </label>
              )}
            </div>
            {!form.id && <p className="shop-form-note">New products start with zero stock. Add stock under Receive supplier stock so each delivery’s cost is recorded.</p>}
            {form.imageEditorSource ? <ProductPhotoEditor source={form.imageEditorSource} onApply={applyProductImage} onCancel={() => setForm(current => ({ ...current, imageEditorSource: null }))} /> : <>
            <label className="shop-image-field">
              Product photo (JPG, PNG or WebP, up to 5 MB)
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectProductImage} />
            </label>
            {imageBusy && <p role="status">Preparing image…</p>}
            <ProductImage url={form.imageBlob ? form.imagePreview : form.image_url} name={form.name || "New product"} className="shop-image-preview" />
            {(form.imageBlob || form.image_url) && <div className="shop-photo-actions"><button type="button" onClick={editProductImage}>Edit photo</button><button type="button" onClick={() => setForm(current => ({ ...current, imageBlob: null, imagePreview: null, image_url: null }))}>Remove photo</button></div>}
            </>}
            {form.id && form.campus && products.find(product => product.id === form.id)?.campus ? <ProductVariants key={form.id} product={form} supabase={supabase} onBusy={setVariantBusy} onSaved={async (updated) => {
              setForm(current => ({ ...current, product_variants: updated.product_variants, has_variants: updated.has_variants, quantity_on_hand: updated.quantity_on_hand }));
              await load();
            }} /> : <p className="shop-form-note">Save the product with its campus first to manage sizes. For new sized products, start with zero opening stock.</p>}
            {form.id && <p className="shop-form-note">Hide or show applies immediately without allocating stock; other edits stay unsaved. Only Main Admin can permanently delete a product, and only when it has no remaining parent order or POS sale history.</p>}
            {form.visibilityNotice && <p role="status" className="shop-message">{form.visibilityNotice}</p>}
            <div className="shop-product-secondary-actions">
              {form.id && <button type="button" onClick={changeProductVisibility}>{products.find(product => product.id === form.id)?.active ? "Hide product" : "Show product"}</button>}
              {admin && form.id && <button type="button" className="shop-product-delete" onClick={deleteProduct}>Delete unused product</button>}
            </div>
            <div className="shop-actions shop-product-save-actions">
              <button
                type="button"
                disabled={busy || imageBusy || variantBusy}
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy || imageBusy || variantBusy || !!form.imageEditorSource || !ready}>
                {busy ? "Saving…" : "Save product"}
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      )}
      {receipt && (
        <div className="shop-overlay">
          <article
            ref={dialogRef} tabIndex={-1} className="shop-dialog shop-receipt"
            role="dialog"
            aria-modal="true"
            aria-label="Sale receipt"
          >
            <div className="shop-receipt-heading"><h2>{settings.store_name}</h2><button className="no-print" type="button" aria-label="Close receipt" disabled={busy} onClick={()=>setReceipt(null)}>×</button></div>
            <p>{settings.receipt_header}</p>
            <strong>{receipt.receipt_number}</strong>
            {receipt.status === 'reversed' && <div className="shop-message error" role="status"><strong>REVERSED — excluded from active sales</strong><p>{receipt.reversal_reason}</p><p>{new Date(receipt.reversed_at).toLocaleString('en-ZW')} · Reversed by {receipt.reversed_by}</p><p>Stock restored. Money has not been automatically refunded; review settlement separately.</p></div>}
            <p>{receipt.campus === "junior" ? "Junior School" : receipt.campus === "senior" ? "Senior School" : "Legacy school shop"}</p>
            <p>Currency: {receipt.currency || "USD"}</p>
            {receipt.status !== 'reversed' && <p>Payment status: {saleBalance(receipt)>0 ? 'Partly paid' : 'Paid'}</p>}
            <p>
              {new Date(receipt.created_at).toLocaleString()}
              <br />
              {receipt.customer_name || "Walk-in customer"} ·{" "}
              {methods[receipt.payment_method]}
            </p>
            {receipt.pos_sale_items.map((l) => (
              <div className="shop-row" key={l.id}>
                <span>
                  {l.quantity} × {l.product_name}{l.size_label ? ` · ${l.size_label}` : ""}
                  <small>{money(l.unit_price, receipt.currency || "USD")} each</small>
                </span>
                <strong>{money(l.line_total, receipt.currency || "USD")}</strong>
              </div>
            ))}
            <div className="shop-total">
              <span>Total</span>
              <strong>{money(receipt.total, receipt.currency || "USD")}</strong>
            </div>
            <div className="shop-row">
              <span>Paid to date</span>
              <strong>{money(salePaid(receipt), receipt.currency || "USD")}</strong>
            </div>
            <div className="shop-row">
              <span>Initial change</span>
              <strong>
                {money(
                  Math.max(0,Number(receipt.amount_paid ?? receipt.total) - Number(receipt.total)),
                  receipt.currency || "USD",
                )}
              </strong>
            </div>
            <div className="shop-total"><span>Balance due</span><strong>{money(saleBalance(receipt),receipt.currency || 'USD')}</strong></div>
            {receipt.issued_at && <p>Items issued: {new Date(receipt.issued_at).toLocaleString('en-ZW')}</p>}
            {receipt.payment_tracking && <section aria-label="Receipt payments"><h3>Payment history</h3>{(receipt.pos_payments || []).map(p=><div key={p.id} className="shop-row"><span>{new Date(p.created_at).toLocaleString('en-ZW')} · {methods[p.payment_method]}<small>Payment {p.id}</small><small>Tendered {money(p.tendered,receipt.currency)} · Change {money(p.change_due,receipt.currency)}</small></span><strong>{money(p.amount,receipt.currency)}</strong></div>)}</section>}
            {receipt.payment_tracking && saleBalance(receipt)>0 && <form className="shop-reversal-form no-print" onSubmit={event=>{event.preventDefault();payReceiptBalance()}}><h3>Record balance payment</h3>{error && <p role="alert">{error}</p>}<fieldset disabled={busy || Boolean(pendingBalance)}><label>Amount received ({receipt.currency})<input type="number" required min="0.01" step="0.01" value={balanceAmount} onChange={event=>setBalanceAmount(event.target.value)} /></label><label>Payment method<select value={balanceMethod} onChange={event=>setBalanceMethod(event.target.value)}>{Object.entries(methods).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Payment reference (optional)<input maxLength={200} value={balanceReference} onChange={event=>setBalanceReference(event.target.value)} /></label></fieldset><p>Record money already received in {receipt.currency}. This updates this receipt only; stock will not move again.</p><button type="submit" disabled={busy || Boolean(pendingBalance)}>Save balance payment</button></form>}
            <div className="shop-actions no-print">
              <button disabled={busy} onClick={() => setReceipt(null)}>Close</button>
              <button className="primary" onClick={() => window.print()}>
                <Printer size={16} /> Print / Save PDF
              </button>
            </div>
            {admin && receipt.status !== 'reversed' && <form className="shop-reversal-form no-print" onSubmit={event => {
              event.preventDefault();
              if (!window.confirm(`Reverse ${receipt.receipt_number}? Stock will be restored once. The original receipt and audit remain. This does not refund money.`)) return;
              run(async () => {
                const result = await supabase.rpc('reverse_pos_sale', { p_sale_id: receipt.id, p_reason: reversalReason.trim() });
                if (result.error) throw result.error;
                setReceipt(current => current?.id === result.data.id ? { ...current, ...result.data } : current); setReversalReason('');
                setNotice('Sale reversed. Stock restored; review any refund or settlement separately.');
                await load();
              });
            }}><h3>Main Admin reversal</h3>{error && <p role="alert" className="shop-message error">{error}</p>}<label>Reason for reversal<textarea required minLength={5} maxLength={1000} value={reversalReason} onChange={event => setReversalReason(event.target.value)} disabled={busy} /></label><p>For an erroneous sale only. Review any money received separately; no refund is issued by this action.</p><button type="submit" disabled={busy || reversalReason.trim().length < 5}>Reverse sale and restore stock</button></form>}
          </article>
        </div>
      )}
    </section>
  );
}
