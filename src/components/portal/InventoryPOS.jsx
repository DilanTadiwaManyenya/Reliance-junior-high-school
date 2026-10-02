import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { logActivity } from "../../lib/logActivity";

const money = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value || 0),
  );
const blank = {
  name: "",
  sku: "",
  category: "Uniforms",
  selling_price: "",
  cost_price: "",
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
    solution: "A sale can only be completed when the recorded payment covers the basket total.",
    steps: [
      "Confirm the payment method and total payable.",
      "Enter the amount actually received.",
      "Record a separate sale if the customer pays later; do not force a partial checkout.",
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
      "Administrators manage products, stock, settings and audit records.",
      "Accountants process sales and view reports.",
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
function exportCSV(rows, filename) {
  const text = rows
    .map((row) =>
      row
        .map(
          (value) =>
            `"${String(value ?? "")
              .replace(/^[=+@-]/, "'$&")
              .replaceAll('"', '""')}"`,
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function InventoryPOS({ supabase, user, profile }) {
  const role = profile?.active_role ?? profile?.role;
  const admin = role === "admin";
  const access = admin || role === "accountant";
  const storageKey = `reliance-shop:${user.id}`;
  const [tab, setTab] = useState("overview");
  const [products, setProducts] = useState([]);
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
  const [form, setForm] = useState(null);
  const [adjust, setAdjust] = useState({ product: "", change: "", reason: "" });
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const modalOpen = !!form || !!receipt;
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement;
    const dialog = document.querySelector(".shop-dialog");
    const controls = () => [
      ...dialog.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
      ),
    ];
    controls()[0]?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) {
        setForm(null);
        setReceipt(null);
      }
      if (event.key !== "Tab") return;
      const elements = controls();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", onKey);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [modalOpen, busy]);
  const load = useCallback(async () => {
    if (!access) return;
    setLoading(true);
    try {
      const fetchAll = async (table) => {
        const rows = [];
        for (let start = 0; ; start += 500) {
          const result = await supabase
            .from(table)
            .select(table === "pos_sales" ? "*,pos_sale_items(*)" : "*")
            .order("id")
            .range(start, start + 499);
          if (result.error) throw result.error;
          rows.push(...result.data);
          if (result.data.length < 500) return rows;
        }
      };
      const [stock, history, prefs, audit, learnerRows] = await Promise.all([
        fetchAll("inventory_products"),
        fetchAll("pos_sales"),
        supabase.from("shop_settings").select("*").single(),
        admin
          ? supabase
              .from("shop_audit")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [] }),
        supabase
          .from("students")
          .select("id,full_name,admission_number,class_level,class_stream,status")
          .eq("status", "active")
          .order("full_name"),
      ]);
      if (prefs.error) throw prefs.error;
      if (audit.error) throw audit.error;
      if (learnerRows.error) throw learnerRows.error;
      setProducts(stock);
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
  }, [access, admin, supabase]);
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
  const active = products.filter((p) => p.active);
  const learnerClassOptions = useMemo(() => {
    const classes = new Map();
    learners.forEach((learner) => {
      const level = learner.class_level || "Unassigned";
      const stream = learner.class_stream || "";
      const key = `${level}::${stream}`;
      classes.set(key, { key, label: `${level} ${stream}`.trim() });
    });
    return [...classes.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [learners]);
  const visibleLearners = learnerClass
    ? learners.filter((learner) => `${learner.class_level || "Unassigned"}::${learner.class_stream || ""}` === learnerClass)
    : learners;
  const selectLearner = (id) => {
    setLearnerId(id);
    const learner = learners.find((row) => row.id === id);
    if (learner) setCustomer(learner.full_name);
  };
  const catalogue = tab === "products" && status === "archived" ? products.filter((p) => !p.active) : active;
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
    product: products.find((p) => p.id === line.id),
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
  );
  const frozen = busy || !!pending;
  const add = (p) => {
    if (frozen) return;
    setCart((current) => {
      const existing = current.find((l) => l.id === p.id);
      return existing
        ? current.map((l) =>
            l.id === p.id
              ? { ...l, quantity: Math.min(l.quantity + 1, p.quantity_on_hand) }
              : l,
          )
        : [...current, { id: p.id, quantity: 1 }];
    });
  };
  const period = sales.filter(
    (s) => !month || s.created_at.slice(0, 7) === month,
  );
  const revenue = period.reduce((sum, s) => sum + Number(s.total), 0);
  const costKnown = period.every((s) =>
    s.pos_sale_items.every((l) => l.unit_cost !== null),
  );
  const cost = period.reduce(
    (sum, s) =>
      sum +
      s.pos_sale_items.reduce(
        (n, l) => n + Number(l.unit_cost || 0) * l.quantity,
        0,
      ),
    0,
  );
  const salesVisible = period.filter((s) =>
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
  const paymentSummary = Object.entries(methods)
    .map(([id, label]) => {
      const matching = period.filter((sale) => sale.payment_method === id);
      return {
        id,
        label,
        count: matching.length,
        total: matching.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
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
        if (line.unit_cost === null) current.costKnown = false;
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
  const inventoryCost = active.reduce(
    (sum, product) => sum + Number(product.cost_price || 0) * Number(product.quantity_on_hand || 0),
    0,
  );
  const inventoryRetail = active.reduce(
    (sum, product) => sum + Number(product.selling_price || 0) * Number(product.quantity_on_hand || 0),
    0,
  );
  const topProducts = useMemo(() => {
    const totals = new Map();
    sales.forEach((sale) => sale.pos_sale_items.forEach((item) => {
      const current = totals.get(item.product_name) || { name: item.product_name, units: 0, revenue: 0 };
      current.units += Number(item.quantity || 0);
      current.revenue += Number(item.line_total || 0);
      totals.set(item.product_name, current);
    }));
    return [...totals.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 5);
  }, [sales]);
  const salesTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, offset) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return {
        key,
        label: date.toLocaleString("en", { month: "short" }),
        revenue: sales.filter((sale) => sale.created_at.slice(0, 7) === key).reduce((sum, sale) => sum + Number(sale.total || 0), 0),
      };
    });
  }, [sales]);
  const maxTrendRevenue = Math.max(1, ...salesTrend.map((point) => point.revenue));
  const checkout = () =>
    run(async () => {
      const request = pending || {
        id: crypto.randomUUID(),
        items: cart.map((l) => ({ product_id: l.id, quantity: l.quantity })),
        customer,
        payment,
        paid: Number(paid),
      };
      if (
        !pending &&
        (!cart.length ||
          invalid ||
          !Number.isFinite(Number(paid)) ||
          Number(paid) < total)
      )
        throw new Error("Check stock and enter sufficient payment.");
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
        .select("*,pos_sale_items(*)")
        .eq("id", result.data.id)
        .single();
      if (detail.error) throw detail.error;
      setReceipt(detail.data);
    });
  const saveProduct = (event) => {
    event.preventDefault();
    run(async () => {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim(),
        selling_price: Number(form.selling_price),
        cost_price: Number(form.cost_price),
        reorder_level: Number(form.reorder_level),
        ...(form.id ? { active: Boolean(form.active) } : {}),
      };
      if (!payload.name) throw new Error("Enter a product name.");
      const result = form.id
        ? await supabase
            .from("inventory_products")
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq("id", form.id)
        : await supabase
            .from("inventory_products")
            .insert({
              ...payload,
              quantity_on_hand: Number(form.quantity_on_hand),
              created_by: user.id,
            });
      if (result.error) throw result.error;
      logActivity(supabase, user, profile, { actionType: form.id ? "update" : "create", description: `${form.id ? "Updated" : "Created"} product ${payload.name}`, targetTable: "inventory_products", targetId: form.id });
      setForm(null);
      setNotice("Product saved.");
      await load();
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
      <p>Inventory access is available to administrators and accountants.</p>
    );
  return (
    <section className="shop-app">
      <header className="shop-hero">
        <div>
          <span className="shop-eyebrow">RELIANCE / SCHOOL SHOP</span>
          <h1>Inventory & point of sale</h1>
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
      <nav className="shop-tabs" aria-label="Shop sections">
        {tabs
          .filter(([id]) => admin || !["logs", "settings"].includes(id))
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
              value={money(sales.reduce((n, s) => n + Number(s.total), 0))}
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
                <div><span>Stock at cost</span><strong>{money(inventoryCost)}</strong></div>
                <div><span>Potential retail value</span><strong>{money(inventoryRetail)}</strong></div>
                <div><span>Estimated stock margin</span><strong>{money(inventoryRetail - inventoryCost)}</strong></div>
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
              <h2><ShoppingCart size={18} /> Ready for the next sale</h2>
              <p>
                Browse the catalogue, collect payment and issue a receipt.
                Inventory updates automatically when a sale completes.
              </p>
              <button className="primary" onClick={() => setTab("pos")}>
                <ShoppingCart size={18} /> Open point of sale
              </button>
              <h3>Recent transactions</h3>
              {sales.slice(0, 5).map((s) => (
                <button
                  className="shop-row"
                  key={s.id}
                  onClick={() => setReceipt(s)}
                >
                  <span>
                    {s.customer_name || "Walk-in customer"}
                    <small>{s.receipt_number}</small>
                  </span>
                  <strong>{money(s.total)}</strong>
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
              {tab === "products" && <option value="archived">Archived products</option>}
            </select>
            <button onClick={() => setList(!list)}>
              {list ? "Grid view" : "List view"}
            </button>
            {tab === "products" && (
              <button
                onClick={() =>
                  exportCSV(
                    [
                      [
                        "Product",
                        "SKU",
                        "Category",
                        "Quantity",
                        "Unit price",
                        "Unit cost",
                        "Reorder level",
                      ],
                      ...filtered.map((p) => [
                        p.name,
                        p.sku,
                        p.category,
                        p.quantity_on_hand,
                        p.selling_price,
                        p.cost_price,
                        p.reorder_level,
                      ]),
                    ],
                    "reliance-stock.csv",
                  )
                }
              >
                Export stock CSV
              </button>
            )}
            {admin && tab === "products" && (
              <button className="primary" onClick={() => setForm({ ...blank })}>
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
                        : !admin
                    }
                    onClick={() =>
                      tab === "pos"
                        ? add(p)
                        : setForm({
                            ...p,
                            sku: p.sku || "",
                            category: p.category || "",
                          })
                    }
                  >
                    <span className="shop-product-icon">
                      <Package size={28} />
                    </span>
                    <small>
                      {p.category || "General"} · {p.sku || "No SKU"}
                    </small>
                    <strong>{p.name}</strong>
                    <span
                      className={
                        p.quantity_on_hand <= p.reorder_level ? "shop-low" : ""
                      }
                    >
                      {p.active ? `${p.quantity_on_hand} units available` : "Archived"}
                    </span>
                    <b>{money(p.selling_price)}</b>
                  </button>
                ))}
              </div>
              {!filtered.length && (
                <div className="shop-panel shop-empty">
                  {loading ? "Loading inventory…" : "No products found."}
                </div>
              )}
              {tab === "products" && admin && (
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
                  <h2>Receive or adjust stock</h2>
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
                        {active.map((p) => (
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
                      <small>{money(l.product?.selling_price)} each</small>
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
                    <span>Attach a learner <em>Optional</em></span>
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
                        <select value={learnerId} onChange={(e) => selectLearner(e.target.value)}>
                          <option value="">Select a learner</option>
                          {visibleLearners.map((learner) => <option key={learner.id} value={learner.id}>{learner.full_name} · {learner.admission_number}</option>)}
                        </select>
                      </label>
                    </div>
                    <small>Selecting a learner fills their name below. You can also type any customer name manually.</small>
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
                    <strong>{money(total)}</strong>
                  </div>
                  <label>
                    Amount received (USD)
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
                    <strong>{money(Math.max(0, Number(paid) - total))}</strong>
                  </div>
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
                    !ready ||
                    (!pending &&
                      (!cart.length ||
                        invalid ||
                        paid === "" ||
                        Number(paid) < total))
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
                  [
                    [
                      "Receipt",
                      "Date",
                      "Customer",
                      "Payment",
                      "Total",
                    ],
                    ...salesVisible.map((s) => [
                        s.receipt_number,
                        s.created_at,
                        s.customer_name,
                        methods[s.payment_method],
                        s.total,
                      ]),
                  ],
                  "reliance-receipt-ledger.csv",
                )
              }
            >
              Export receipt ledger
            </button>
          </div>
          <div className="shop-stats">
            <Stat label="Completed sales" value={period.length} />
            <Stat label="Collected" value={money(revenue)} tone="positive" />
            <Stat label="Items sold" value={unitsSold} />
            <Stat label="Average sale" value={money(period.length ? revenue / period.length : 0)} />
          </div>
          <div className="shop-receipts-layout">
            <div className="shop-panel shop-table">
              <h2>Receipt ledger</h2>
              <p>Every completed sale for the selected period. Open a receipt to print or save it as a PDF.</p>
              <table>
                <thead><tr><th>Receipt / buyer</th><th>Date & time</th><th>Payment</th><th>Total</th><th>Receipt</th></tr></thead>
                <tbody>
                  {salesVisible.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.receipt_number}</strong><small>{s.customer_name || "Walk-in customer"}</small></td>
                      <td>{new Date(s.created_at).toLocaleString()}</td>
                      <td><span className="shop-payment-badge">{methods[s.payment_method]}</span></td>
                      <td className="shop-receipt-amount">{money(s.total)}</td>
                      <td><button onClick={() => setReceipt(s)}>Open</button></td>
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
                  <div key={method.id}><span>{method.label}<small>{method.count} sale{method.count === 1 ? "" : "s"}</small></span><strong>{money(method.total)}</strong></div>
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
            <button onClick={() => exportCSV([["Product", "Units sold", "Revenue", "Cost of goods", "Gross profit", "Margin"], ...productProfitability.map((product) => [product.name, product.units, product.revenue, product.costKnown ? product.cost : "Unknown", product.profit ?? "Unknown", product.profit !== null && product.revenue ? `${((product.profit / product.revenue) * 100).toFixed(1)}%` : "Unknown"])], "reliance-profit-and-loss.csv")}>Export P&L</button>
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
              <p>Gross profit is revenue less the recorded item cost. It excludes rent, salaries and other operating expenses.</p>
              <table>
                <thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Cost</th><th>Gross profit</th><th>Margin</th></tr></thead>
                <tbody>{productProfitability.map((product) => <tr key={product.name}><td><strong>{product.name}</strong></td><td>{product.units}</td><td>{money(product.revenue)}</td><td>{product.costKnown ? money(product.cost) : "Unknown"}</td><td className="shop-profit-value">{product.profit === null ? "Unknown" : money(product.profit)}</td><td>{product.profit !== null && product.revenue ? `${((product.profit / product.revenue) * 100).toFixed(1)}%` : "Unknown"}</td></tr>)}</tbody>
              </table>
              {!productProfitability.length && <p className="shop-empty">No completed sales in this period.</p>}
            </div>
            <aside className="shop-panel shop-insight-panel">
              <h2>Report health</h2>
              <div className="shop-insight"><span>Cost snapshots</span><strong className={costKnown ? "shop-good" : "shop-warning"}>{costKnown ? "Complete" : "Needs review"}</strong><p>{costKnown ? "Every sale has a recorded item cost." : "Some older sale lines have no cost snapshot, so their profit remains unknown."}</p></div>
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
          {settingsSection === "security" && <div className="shop-settings-copy"><h3>Change my password</h3><p>Confirm your current password before choosing a new one. This changes only your own Reliance account.</p><div className="shop-form-grid"><label>Current password<input required type="password" autoComplete="current-password" value={securityForm.currentPassword} onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })} /></label><label>New password<input required type="password" minLength="8" autoComplete="new-password" value={securityForm.newPassword} onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })} /></label><label>Confirm new password<input required type="password" minLength="8" autoComplete="new-password" value={securityForm.confirmPassword} onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })} /></label></div><h3>Staff account resets</h3><p>To reset another staff member’s password, open the Staff workspace, choose their record, and use Reset credentials. That protected route updates only the selected account and records the change.</p></div>}
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
            className="shop-dialog"
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
            <div className="shop-form-grid">
              {[
                ["name", "Product name", "text"],
                ["sku", "SKU (optional)", "text"],
                ["category", "Category", "text"],
                ["selling_price", "Selling price (USD)", "number"],
                ["cost_price", "Unit cost (USD)", "number"],
                ...(!form.id
                  ? [["quantity_on_hand", "Opening stock", "number"]]
                  : []),
                ["reorder_level", "Low stock threshold", "number"],
              ].map(([key, label, type]) => (
                <label key={key}>
                  {label}
                  <input
                    autoFocus={key === "name"}
                    required={key !== "sku" && key !== "category"}
                    type={type}
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
              {form.id && (
                <label className="shop-checkbox">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  Available for sale
                </label>
              )}
            </div>
            <div className="shop-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy || !ready}>
                Save product
              </button>
            </div>
          </form>
        </div>
      )}
      {receipt && (
        <div className="shop-overlay">
          <article
            className="shop-dialog shop-receipt"
            role="dialog"
            aria-modal="true"
            aria-label="Sale receipt"
          >
            <h2>{settings.store_name}</h2>
            <p>{settings.receipt_header}</p>
            <strong>{receipt.receipt_number}</strong>
            <p>
              {new Date(receipt.created_at).toLocaleString()}
              <br />
              {receipt.customer_name || "Walk-in customer"} ·{" "}
              {methods[receipt.payment_method]}
            </p>
            {receipt.pos_sale_items.map((l) => (
              <div className="shop-row" key={l.id}>
                <span>
                  {l.quantity} × {l.product_name}
                  <small>{money(l.unit_price)} each</small>
                </span>
                <strong>{money(l.line_total)}</strong>
              </div>
            ))}
            <div className="shop-total">
              <span>Total</span>
              <strong>{money(receipt.total)}</strong>
            </div>
            <div className="shop-row">
              <span>Received</span>
              <strong>{money(receipt.amount_paid ?? receipt.total)}</strong>
            </div>
            <div className="shop-row">
              <span>Change</span>
              <strong>
                {money(
                  Number(receipt.amount_paid ?? receipt.total) -
                    Number(receipt.total),
                )}
              </strong>
            </div>
            <div className="shop-actions no-print">
              <button onClick={() => setReceipt(null)}>Close</button>
              <button className="primary" onClick={() => window.print()}>
                <Printer size={16} /> Print / Save PDF
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
