import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { t } from "#/i18n";
import { supabase } from "#/supabase";
import { useAuthStore } from "#/store/auth";
import {
  Users,
  UserPlus,
  RefreshCw,
  Heart,
  TrendingUp,
  AlertTriangle,
  UserX,
  Coins,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/customers")({
  component: CustomersPage,
  head: () => ({
    meta: [{ title: "Stranke — Zvest" }],
  }),
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CustomerSummary {
  total_customers: number;
  new_this_month: number;
  retention_rate: number;
  active: number;
  at_risk: number;
  lost: number;
  avg_lifetime_value: number;
  avg_visits: number;
  total_points_in_circulation: number;
}

interface Customer {
  id: string;
  app_user_id: string;
  first_initial: string | null;
  last_initial: string | null;
  total_spent: number;
  visits: number;
  avg_order: number;
  points_balance: number;
  total_points_earned: number;
  total_points_redeemed: number;
  last_visit_at: string | null;
  member_since: string;
  status: "active" | "at_risk" | "lost";
}

interface ShopCustomersData {
  summary: CustomerSummary;
  customers: Customer[];
}

type Tab = "overview" | "topCustomers";
type SortKey = "total_spent" | "visits" | "points_balance";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const c = t.shop.customers;

function customerName(first: string | null, last: string | null) {
  const f = first ?? "";
  const l = last ?? "";
  if (f && l) return `${f}. ${l}.`;
  if (f) return `${f}.`;
  return "?";
}

function customerInitials(first: string | null, last: string | null) {
  return (first ?? "") + (last ?? "") || "?";
}

function fmt(n: number) {
  return n.toLocaleString("sl-SI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("sl-SI");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function CustomersPage() {
  const { shopId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [sortBy, setSortBy] = useState<SortKey>("total_spent");

  useEffect(() => {
    if (shopId) fetchData();
  }, [shopId]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_shop_customers",
        { p_shop_id: shopId },
      );
      if (rpcError) throw rpcError;
      const result = data as ShopCustomersData;
      setSummary(result.summary);
      setCustomers(result.customers);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }

  const sorted = [...customers].sort((a, b) => b[sortBy] - a[sortBy]);

  const activeCustomers = customers.filter((c) => c.status === "active");
  const atRiskCustomers = customers.filter((c) => c.status === "at_risk");
  const lostCustomers = customers.filter((c) => c.status === "lost");

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="rise-in space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="island-shell rounded-2xl p-5"
            >
              <div className="skeleton mb-2 h-3 w-20" />
              <div className="skeleton h-7 w-24" />
            </div>
          ))}
        </div>
        <div className="island-shell rounded-2xl p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton mb-3 h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rise-in">
      <h1 className="display-title mb-6 text-2xl font-bold text-[var(--sea-ink)]">
        {c.title}
      </h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {summary && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={Users}
              label={c.totalCustomers}
              value={summary.total_customers.toString()}
              sub={`${summary.active} ${c.overview.toLowerCase()}`}
            />
            <SummaryCard
              icon={UserPlus}
              label={c.newCustomers}
              value={summary.new_this_month.toString()}
              sub={c.newDesc}
            />
            <SummaryCard
              icon={RefreshCw}
              label={c.retentionRate}
              value={`${summary.retention_rate.toFixed(1)}%`}
              sub={`${c.avgLifetimeValue}: ${fmt(summary.avg_lifetime_value)}`}
            />
            <SummaryCard
              icon={Coins}
              label={c.points}
              value={summary.total_points_in_circulation.toLocaleString("sl-SI")}
              sub={`${c.purchaseFrequency}: ${summary.avg_visits.toFixed(1)}`}
            />
          </div>

          {/* Tabs */}
          <div className="mb-5 inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
            <TabButton
              active={tab === "overview"}
              onClick={() => setTab("overview")}
            >
              {c.overview}
            </TabButton>
            <TabButton
              active={tab === "topCustomers"}
              onClick={() => setTab("topCustomers")}
            >
              {c.topCustomers}
            </TabButton>
          </div>

          {/* Overview tab */}
          {tab === "overview" && (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Segments */}
              <div className="island-shell rounded-2xl p-5">
                <h2 className="island-kicker mb-4">{c.segments}</h2>
                <div className="space-y-3">
                  <SegmentRow
                    icon={Heart}
                    label={c.vip}
                    desc={c.vipDesc}
                    count={activeCustomers.length}
                    total={summary.total_customers}
                    color="text-purple-600"
                  />
                  <SegmentRow
                    icon={TrendingUp}
                    label={c.regular}
                    desc={c.regularDesc}
                    count={summary.active}
                    total={summary.total_customers}
                    color="text-green-600"
                  />
                  <SegmentRow
                    icon={AlertTriangle}
                    label={c.atRisk}
                    desc={c.atRiskDesc}
                    count={summary.at_risk}
                    total={summary.total_customers}
                    color="text-amber-600"
                  />
                  <SegmentRow
                    icon={UserX}
                    label={c.lost}
                    desc=""
                    count={summary.lost}
                    total={summary.total_customers}
                    color="text-red-500"
                  />
                </div>
              </div>

              {/* At risk list */}
              <div className="island-shell rounded-2xl p-5">
                {/* At risk */}
                <h2 className="island-kicker mb-1">{c.atRisk}</h2>
                <p className="mb-3 text-xs text-[var(--sea-ink-soft)]">{c.lastVisit}</p>
                {atRiskCustomers.length === 0 ? (
                  <p className="text-sm text-[var(--sea-ink-soft)]">
                    {c.noSegmentData}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {atRiskCustomers.slice(0, 15).map((cust) => (
                      <div
                        key={cust.id}
                        className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
                          {customerInitials(cust.first_initial, cust.last_initial)}
                        </div>
                        <span className="text-xs font-medium text-[var(--sea-ink)]">
                          {customerName(cust.first_initial, cust.last_initial)}
                        </span>
                        <span className="text-[10px] text-[var(--sea-ink-soft)]">
                          {formatDate(cust.last_visit_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Lost */}
                {lostCustomers.length > 0 && (
                  <>
                    <h3 className="island-kicker mb-1 mt-5">{c.lost}</h3>
                    <p className="mb-3 text-xs text-[var(--sea-ink-soft)]">{c.lastVisit}</p>
                    <div className="flex flex-wrap gap-2">
                      {lostCustomers.slice(0, 10).map((cust) => (
                        <div
                          key={cust.id}
                          className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-1.5 opacity-50"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">
                            {customerInitials(cust.first_initial, cust.last_initial)}
                          </div>
                          <span className="text-xs font-medium text-[var(--sea-ink-soft)]">
                            {customerName(cust.first_initial, cust.last_initial)}
                          </span>
                          <span className="text-[10px] text-[var(--sea-ink-soft)]">
                            {formatDate(cust.last_visit_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Send notification — coming soon */}
                <div className="mt-5 border-t border-[var(--line)] pt-4">
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white opacity-50"
                  >
                    {c.sendNotification}
                  </button>
                  <p className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                    {c.comingSoon}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top Customers tab */}
          {tab === "topCustomers" && (
            <div className="island-shell overflow-hidden rounded-2xl">
              {/* Sort controls */}
              <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                  {c.sortBy}:
                </span>
                {(
                  [
                    ["total_spent", c.sortSpent],
                    ["visits", c.sortVisits],
                    ["points_balance", c.sortPoints],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSortBy(key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      sortBy === key
                        ? "bg-[var(--lagoon-deep)] text-white"
                        : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {sorted.length === 0 ? (
                <p className="p-8 text-center text-sm text-[var(--sea-ink-soft)]">
                  {c.noCustomers}
                </p>
              ) : (
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
                      <tr className="border-b border-[var(--line)] text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                        <th className="px-4 py-3">{c.customer}</th>
                        <th className="px-4 py-3">{c.totalSpent}</th>
                        <th className="hidden px-4 py-3 md:table-cell">
                          {c.visits}
                        </th>
                        <th className="hidden px-4 py-3 lg:table-cell">
                          {c.avgOrder}
                        </th>
                        <th className="px-4 py-3">{c.points}</th>
                        <th className="hidden px-4 py-3 md:table-cell">
                          {c.lastVisit}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((cust) => (
                        <tr
                          key={cust.id}
                          className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface)]"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  cust.status === "active"
                                    ? "bg-green-100 text-green-700"
                                    : cust.status === "at_risk"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-red-100 text-red-600"
                                }`}
                              >
                                {customerInitials(cust.first_initial, cust.last_initial)}
                              </div>
                              <span className="font-medium text-[var(--sea-ink)]">
                                {customerName(cust.first_initial, cust.last_initial)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-[var(--sea-ink)]">
                            {fmt(cust.total_spent)}
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            {cust.visits}
                          </td>
                          <td className="hidden px-4 py-3 lg:table-cell">
                            {fmt(cust.avg_order)}
                          </td>
                          <td className="px-4 py-3">
                            {cust.points_balance.toLocaleString("sl-SI")}
                          </td>
                          <td className="hidden px-4 py-3 text-[var(--sea-ink-soft)] md:table-cell">
                            {formatDate(cust.last_visit_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
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
      <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">{sub}</p>
    </div>
  );
}

function SegmentRow({
  icon: Icon,
  label,
  desc,
  count,
  total,
  color,
}: {
  icon: typeof Heart;
  label: string;
  desc: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className={`shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-[var(--sea-ink)]">{label}</p>
          <p className="text-sm font-bold text-[var(--sea-ink)]">{count}</p>
        </div>
        {desc && (
          <p className="text-xs text-[var(--sea-ink-soft)]">{desc}</p>
        )}
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-[var(--lagoon)]"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
          : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
      }`}
    >
      {children}
    </button>
  );
}
