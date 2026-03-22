import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { t } from "#/i18n";
import { api } from "#/lib/api";
import { supabase } from "#/supabase";
import { useAuthStore } from "#/store/auth";
import {
  Receipt,
  TrendingUp,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

export const Route = createFileRoute(
  "/_authenticated/dashboard/transactions",
)({
  component: TransactionsPage,
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Transaction {
  id: string;
  pos_invoice_id: string;
  total_amount: number;
  tax_amount: number;
  status: string;
  loyalty_points_awarded: number;
  created_at: string;
  app_users: {
    first_name?: string | null;
    last_name?: string | null;
    phone_number?: string | null;
  } | null;
}

interface TransactionsResponse {
  success: boolean;
  data: Transaction[];
  meta: { total: number; limit: number; offset: number };
}

interface DashboardData {
  revenue: {
    all_time: number;
    today: number;
    last_7d: number;
    last_30d: number;
  };
  transactions: {
    all_time: number;
    today: number;
    last_7d: number;
    last_30d: number;
  };
  qr_scans: {
    scanned_all_time: number;
    scanned_today: number;
    scanned_7d: number;
    scanned_30d: number;
    unscanned_all_time: number;
    unscanned_today: number;
    unscanned_7d: number;
    unscanned_30d: number;
  };
  [key: string]: unknown;
}

type StatusFilter = "" | "completed" | "pending" | "failed" | "refunded";
type Period = "today" | "7d" | "30d" | "all";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const c = t.shop.transactions;

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-600",
  refunded: "bg-blue-50 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  completed: c.statusCompleted,
  pending: c.statusPending,
  failed: c.statusFailed,
  refunded: c.statusRefunded,
};

const PERIOD_LABELS: Record<Period, string> = {
  today: c.periodToday,
  "7d": c.period7d,
  "30d": c.period30d,
  all: c.periodAll,
};

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

function fmt(n: number) {
  return n.toLocaleString("sl-SI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function customerDisplay(tx: Transaction) {
  const u = tx.app_users;
  if (!u) return "—";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return name || u.phone_number || "—";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function TransactionsPage() {
  const { shopId } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>("30d");
  const [status, setStatus] = useState<StatusFilter>("");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Fetch dashboard stats via RPC
  useEffect(() => {
    if (!shopId) return;
    supabase
      .rpc("get_shop_dashboard", { p_shop_id: shopId })
      .then(({ data }) => {
        if (data) setDashData(data as DashboardData);
      });
  }, [shopId]);

  // Fetch transactions via REST
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      if (status) params.set("status", status);

      const res = await api.get<TransactionsResponse>(
        `/api/shop-admin/transactions?${params}`,
      );
      setTransactions(res.data);
      setTotal(res.meta.total);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }, [status, limit, offset]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Pick stats based on selected period
  function byPeriod(vals: { all_time: number; today: number; last_7d: number; last_30d: number }) {
    if (period === "today") return vals.today;
    if (period === "7d") return vals.last_7d;
    if (period === "30d") return vals.last_30d;
    return vals.all_time;
  }

  function scanByPeriod(prefix: "scanned" | "unscanned") {
    if (!dashData) return 0;
    const s = dashData.qr_scans;
    if (period === "today") return s[`${prefix}_today`];
    if (period === "7d") return s[`${prefix}_7d`];
    if (period === "30d") return s[`${prefix}_30d`];
    return s[`${prefix}_all_time`];
  }

  const periodRevenue = dashData ? byPeriod(dashData.revenue) : 0;
  const periodTransactions = dashData ? byPeriod(dashData.transactions) : 0;
  const periodScanned = scanByPeriod("scanned");
  const periodUnscanned = scanByPeriod("unscanned");

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  function goToPage(page: number) {
    setOffset((page - 1) * limit);
  }

  function exportCsv() {
    const header =
      "ID,Invoice ID,Datum,Znesek,Davek,Status,Tocke,Stranka,Telefon";
    const rows = transactions.map((tx) => {
      const u = tx.app_users;
      return [
        tx.id,
        tx.pos_invoice_id,
        tx.created_at,
        tx.total_amount,
        tx.tax_amount,
        tx.status,
        tx.loyalty_points_awarded,
        u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : "",
        u?.phone_number ?? "",
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transakcije-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="rise-in">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="display-title text-2xl font-bold text-[var(--sea-ink)]">
          {c.title}
        </h1>
        <div className="flex items-center gap-3">
          {/* Period filter for stats */}
          <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
            {(["today", "7d", "30d", "all"] as const).map((p) => (
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
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--sea-ink-soft)] transition hover:-translate-y-0.5 hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Download size={14} /> {c.exportCsv}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {dashData && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Receipt}
            label={c.totalTransactions}
            value={periodTransactions.toLocaleString("sl-SI")}
          />
          <StatCard
            icon={TrendingUp}
            label={c.totalRevenue}
            value={fmt(periodRevenue)}
          />
          <StatCard
            icon={CheckCircle}
            label={c.completed}
            value={periodScanned.toLocaleString("sl-SI")}
          />
          <StatCard
            icon={Clock}
            label={c.pending}
            value={periodUnscanned.toLocaleString("sl-SI")}
          />
        </div>
      )}

      {/* Status filter + per page */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
          {(
            [
              ["", c.statusAll],
              ["completed", c.statusCompleted],
              ["pending", c.statusPending],
              ["failed", c.statusFailed],
              ["refunded", c.statusRefunded],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setStatus(val as StatusFilter);
                setOffset(0);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                status === val
                  ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                  : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--sea-ink-soft)]">
            {c.perPage}:
          </span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setOffset(0);
            }}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-2 py-1 text-xs text-[var(--sea-ink)] outline-none"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="island-shell rounded-2xl p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton mb-3 h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="island-shell overflow-hidden rounded-2xl">
          {transactions.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--sea-ink-soft)]">
              {c.noTransactions}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
                  <tr className="border-b border-[var(--line)] text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                    <th className="px-4 py-3">{c.transactionId}</th>
                    <th className="px-4 py-3">{c.date}</th>
                    <th className="hidden px-4 py-3 md:table-cell">
                      {c.customer}
                    </th>
                    <th className="px-4 py-3">{c.amount}</th>
                    <th className="hidden px-4 py-3 sm:table-cell">
                      {c.pointsAwarded}
                    </th>
                    <th className="px-4 py-3">{c.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface)]"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--sea-ink-soft)]">
                        {tx.pos_invoice_id || tx.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-[var(--sea-ink)]">
                        {formatDate(tx.created_at)}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-[var(--sea-ink)]">
                          {customerDisplay(tx)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--sea-ink)]">
                        {fmt(tx.total_amount)}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {tx.loyalty_points_awarded > 0 && (
                          <span className="rounded-full bg-[var(--lagoon)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--lagoon-deep)]">
                            +{tx.loyalty_points_awarded}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_COLORS[tx.status] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {STATUS_LABELS[tx.status] ?? tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3">
              <p className="text-xs text-[var(--sea-ink-soft)]">
                {c.showing} {offset + 1}–{Math.min(offset + limit, total)}{" "}
                {c.of} {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => goToPage(currentPage - 1)}
                  className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--surface)] disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                {pageNumbers(currentPage, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span
                      key={`dot-${i}`}
                      className="px-1 text-xs text-[var(--sea-ink-soft)]"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p as number)}
                      className={`min-w-[28px] rounded-lg px-2 py-1 text-xs font-semibold transition ${
                        p === currentPage
                          ? "bg-[var(--lagoon-deep)] text-white"
                          : "text-[var(--sea-ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--sea-ink)]"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                  className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--surface)] disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function pageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
}) {
  return (
    <div className="island-shell rounded-2xl p-5">
      <div className="mb-2 flex items-center gap-2 text-[var(--sea-ink-soft)]">
        <Icon size={16} />
        <span className="text-xs font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-[var(--sea-ink)]">{value}</p>
    </div>
  );
}
