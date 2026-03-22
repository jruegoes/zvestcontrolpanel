import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { t } from "#/i18n";
import { api } from "#/lib/api";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Boxes,
  Search,
  Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/products")({
  component: ProductsPage,
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Product {
  product_id: string;
  name: string;
  pos_article_id?: string;
  category?: string | null;
  units_sold: number;
  total_revenue: number;
  avg_price: number;
  performance: string;
  last_sold: string | null;
  rank: number;
  transaction_count: number;
  days_since_last_sale: number | null;
}

interface Summary {
  total_products: number;
  products_sold_in_period: number;
  total_units_sold: number;
  total_revenue: number;
  avg_basket_size: number;
  best_seller_threshold: number;
}

interface ProductsResponseData {
  summary: Summary;
  products: Product[];
  performance_breakdown: Record<string, number>;
  frequently_bought_together: { product_1: string; product_2: string; frequency: number }[];
}

interface ProductsResponse {
  status: number;
  data: ProductsResponseData;
}

type Period = "7d" | "30d" | "90d" | "all";
type SortBy = "most_sold" | "highest_revenue" | "recently_sold";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const c = t.shop.products;

const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)]";

const PERF_COLORS: Record<string, string> = {
  best_seller: "bg-green-50 text-green-700",
  good: "bg-blue-50 text-blue-700",
  average: "bg-gray-100 text-gray-600",
  slow_mover: "bg-amber-50 text-amber-700",
  dead_stock: "bg-red-50 text-red-600",
};

const PERF_LABELS: Record<string, string> = {
  best_seller: c.bestSeller,
  good: c.good,
  average: c.average,
  slow_mover: c.slowMover,
  dead_stock: c.deadStockLabel,
};

function fmt(n: number) {
  return n.toLocaleString("sl-SI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("sl-SI");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [perfBreakdown, setPerfBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>("30d");
  const [sortBy, setSortBy] = useState<SortBy>("most_sold");
  const [search, setSearch] = useState("");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        period,
        sort_by: sortBy,
        limit: "200",
      });
      const res = await api.get<ProductsResponse>(
        `/api/shop-admin/analytics/products?${params}`,
      );
      const d = res.data;
      setProducts(d.products ?? []);
      setSummary(d.summary ?? null);
      setPerfBreakdown(d.performance_breakdown ?? {});
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [period, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filtered = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.pos_article_id ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : products;

  function exportCsv() {
    const header = "Ime,POS ID,Kategorija,Kosov,Prihodek,Povp. cena,Uspesnost,Zadnja prodaja";
    const rows = filtered.map((p) =>
      [
        p.name,
        p.pos_article_id ?? "",
        p.category ?? "",
        p.units_sold,
        p.total_revenue,
        p.avg_price,
        p.performance,
        p.last_sold ?? "",
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `produkti-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rise-in">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">
          {c.title}
        </h1>
        <div className="flex items-center gap-3">
          {/* Period */}
          <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
            {(["7d", "30d", "90d", "all"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  period === p
                    ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                    : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                }`}
              >
                {c[`period${p.charAt(0).toUpperCase() + p.slice(1)}` as keyof typeof c] ?? p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--sea-ink-soft)] transition hover:-translate-y-0.5 hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Download size={14} /> {c.exportCsv}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={Package}
            label={c.totalProducts}
            value={Number(summary.total_products || 0).toLocaleString("sl-SI")}
          />
          <StatCard
            icon={ShoppingCart}
            label={c.productsSold}
            value={Number(summary.products_sold_in_period || 0).toLocaleString("sl-SI")}
          />
          <StatCard
            icon={TrendingUp}
            label={c.totalRevenue}
            value={fmt(Number(summary.total_revenue || 0))}
          />
          <StatCard
            icon={Boxes}
            label={c.unitsSold}
            value={Number(summary.total_units_sold || 0).toLocaleString("sl-SI")}
          />
          <StatCard
            icon={ShoppingCart}
            label={c.avgBasket}
            value={fmt(Number(summary.avg_basket_size || 0))}
          />
          <StatCard
            icon={Package}
            label={c.deadStock}
            value={Number(perfBreakdown.dead_stock || 0).toLocaleString("sl-SI")}
          />
        </div>
      )}

      {/* Search + Sort */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
          />
          <input
            type="text"
            className={`${inputClass} pl-9`}
            placeholder={c.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="ml-auto inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
          {(
            [
              ["most_sold", c.sortMostSold],
              ["highest_revenue", c.sortRevenue],
              ["recently_sold", c.sortRecent],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key as SortBy)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                sortBy === key
                  ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                  : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="island-shell rounded-2xl p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton mb-3 h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="island-shell overflow-hidden rounded-2xl">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--sea-ink-soft)]">
              {c.noProducts}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
                  <tr className="border-b border-[var(--line)] text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                    <th className="px-4 py-3">{c.product}</th>
                    <th className="hidden px-4 py-3 md:table-cell">
                      {c.category}
                    </th>
                    <th className="px-4 py-3">{c.units}</th>
                    <th className="px-4 py-3">{c.revenue}</th>
                    <th className="hidden px-4 py-3 lg:table-cell">
                      {c.avgPrice}
                    </th>
                    <th className="hidden px-4 py-3 sm:table-cell">
                      {c.performance}
                    </th>
                    <th className="hidden px-4 py-3 md:table-cell">
                      {c.lastSold}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr
                      key={p.product_id}
                      className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface)]"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-[var(--sea-ink)]">
                            {i < 3 && sortBy === "most_sold" && (
                              <span className="mr-1.5">
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                              </span>
                            )}
                            {p.name}
                          </p>
                          {p.pos_article_id && (
                            <p className="font-mono text-[10px] text-[var(--sea-ink-soft)]">
                              {p.pos_article_id}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--sea-ink-soft)] md:table-cell">
                        {p.category || "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--sea-ink)]">
                        {Number(p.units_sold || 0).toLocaleString("sl-SI")}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--sea-ink)]">
                        {fmt(Number(p.total_revenue || 0))}
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--sea-ink-soft)] lg:table-cell">
                        {fmt(Number(p.avg_price || 0))}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            PERF_COLORS[p.performance] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {PERF_LABELS[p.performance] ?? p.performance}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--sea-ink-soft)] md:table-cell">
                        {formatDate(p.last_sold ?? undefined)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatCard                                                           */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="island-shell rounded-2xl p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[var(--sea-ink-soft)]">
        <Icon size={14} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-lg font-bold text-[var(--sea-ink)]">{value}</p>
    </div>
  );
}
