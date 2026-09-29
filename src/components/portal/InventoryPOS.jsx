import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import "./inventory.css";

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
function Stat({ label, value }) {
  return (
    <article className="shop-stat">
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
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({
    store_name: "Reliance Learning Centre",
    receipt_header: "School shop",
  });
  const [cart, setCart] = useState(() => readSession(storageKey)?.cart || []);
  const [held, setHeld] = useState(() => readSession(storageKey)?.held || []);
  const [customer, setCustomer] = useState(
    () => readSession(storageKey)?.customer || "",
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
      const [stock, history, prefs, audit] = await Promise.all([
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
      ]);
      if (prefs.error) throw prefs.error;
      if (audit.error) throw audit.error;
      setProducts(stock);
      setSales(
        history.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      );
      setSettings(prefs.data);
      setLogs(audit.data);
      setReady(true);
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
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ cart, held, customer, payment, paid, pending }),
      );
    } catch {
      /* Checkout also verifies persistence before sending. */
    }
  }, [storageKey, cart, held, customer, payment, paid, pending]);
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
  const filtered = active.filter(
    (p) =>
      `${p.name} ${p.sku || ""} ${p.category || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" ||
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
      setPaid("");
      setNotice(`Sale ${result.data.receipt_number} completed.`);
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          cart: [],
          held,
          customer: "",
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
      setForm(null);
      setNotice("Product saved.");
      await load();
    });
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
          <div className="shop-columns">
            <article className="shop-panel">
              <h2>Ready for the next sale</h2>
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
              <h2>Stock watch</h2>
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
              <h3>Inventory value at cost</h3>
              <strong className="shop-big">
                {money(
                  active.reduce(
                    (n, p) => n + Number(p.cost_price) * p.quantity_on_hand,
                    0,
                  ),
                )}
              </strong>
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
                      {p.quantity_on_hand} units available
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
                  <label>
                    Student / customer name
                    <input
                      value={customer}
                      onChange={(e) => setCustomer(e.target.value)}
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
                          { id: crypto.randomUUID(), cart, customer, payment },
                        ]);
                        setCart([]);
                        setCustomer("");
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
      {["sales", "analytics"].includes(tab) && (
        <>
          <div className="shop-toolbar">
            <label>
              Reporting month
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
                aria-label="Search sales"
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
                      "Revenue",
                      "Cost",
                      "Profit",
                    ],
                    ...salesVisible.map((s) => {
                      const known = s.pos_sale_items.every(
                        (l) => l.unit_cost !== null,
                      );
                      const c = s.pos_sale_items.reduce(
                        (n, l) => n + Number(l.unit_cost) * l.quantity,
                        0,
                      );
                      return [
                        s.receipt_number,
                        s.created_at,
                        s.customer_name,
                        methods[s.payment_method],
                        s.total,
                        known ? c : "Unknown",
                        known ? Number(s.total) - c : "Unknown",
                      ];
                    }),
                  ],
                  "reliance-sales.csv",
                )
              }
            >
              Export CSV
            </button>
          </div>
          <div className="shop-stats">
            <Stat label="Transactions" value={period.length} />
            <Stat label="Revenue" value={money(revenue)} />
            <Stat
              label="Cost of goods"
              value={costKnown ? money(cost) : "Unknown legacy costs"}
            />
            <Stat
              label="Gross profit"
              value={costKnown ? money(revenue - cost) : "Unavailable"}
            />
          </div>
          <div className="shop-panel shop-table">
            <h2>
              {tab === "sales"
                ? "Sales & receipt history"
                : "Itemized profitability"}
            </h2>
            <p>
              Gross profit excludes operating expenses. Historical sales without
              cost snapshots show unknown profit.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Receipt / customer</th>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Revenue</th>
                  <th>Gross profit</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {salesVisible.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.receipt_number}</strong>
                      <small>{s.customer_name || "Walk-in"}</small>
                    </td>
                    <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td>{methods[s.payment_method]}</td>
                    <td>{money(s.total)}</td>
                    <td>
                      {s.pos_sale_items.every((l) => l.unit_cost !== null)
                        ? money(
                            Number(s.total) -
                              s.pos_sale_items.reduce(
                                (n, l) => n + Number(l.unit_cost) * l.quantity,
                                0,
                              ),
                          )
                        : "Unknown"}
                    </td>
                    <td>
                      <button onClick={() => setReceipt(s)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!salesVisible.length && (
              <p className="shop-empty">No sales match this period.</p>
            )}
          </div>
        </>
      )}
      {tab === "logs" && admin && (
        <div className="shop-panel shop-table">
          <h2>Shop audit trail</h2>
          <p>Latest 200 product, stock, checkout and settings events.</p>
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
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.action}</td>
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
          {!logs.length && <p>No events yet.</p>}
        </div>
      )}
      {tab === "settings" && admin && (
        <form
          className="shop-panel"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await supabase
                .from("shop_settings")
                .update({
                  store_name: settings.store_name.trim(),
                  receipt_header: settings.receipt_header.trim(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", true);
              if (r.error) throw r.error;
              setNotice("Preferences saved.");
              await load();
            });
          }}
        >
          <h2>Business & receipt information</h2>
          <div className="shop-form-grid">
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
          </div>
          <p>
            Currency: USD. Access uses Reliance staff accounts. Product reorder
            levels are managed under Products.
          </p>
          <button className="primary" disabled={busy || !ready}>
            Save preferences
          </button>
        </form>
      )}
      {tab === "help" && (
        <div className="shop-panel">
          <h2>Shop workflow guide</h2>
          {[
            [
              "Complete a sale",
              "Select products, enter the customer name and payment method, record the amount received, then complete checkout. Stock and receipt creation happen together.",
            ],
            [
              "Insufficient stock",
              "Refresh inventory and reduce the requested quantity. Administrators can receive stock under Products with a recorded reason.",
            ],
            [
              "Pending checkout",
              "If the connection drops, use Retry pending sale. It reuses the same request ID so the sale cannot be recorded twice. Do not start a replacement transaction.",
            ],
            [
              "Held carts",
              "Hold pauses a basket in this browser tab. Clear or complete the current basket before resuming another. Stock is checked again at checkout.",
            ],
            [
              "Receipts and reports",
              "Open Sales & receipts to search transactions and print receipts or save them as PDF through the print dialog. Export CSV for reporting.",
            ],
            [
              "Roles and settings",
              "Administrators manage products, stock and preferences. Accountants sell products and review reports. Both use their existing Reliance login.",
            ],
          ].map(([title, text]) => (
            <details className="shop-help" key={title}>
              <summary>{title}</summary>
              <p>{text}</p>
            </details>
          ))}
        </div>
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
