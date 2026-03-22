import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "#/i18n";
import { api } from "#/lib/api";
import {
  Send,
  Cake,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/push")({
  component: PushPage,
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type NotificationType = "manual" | "birthday" | "points_earned" | "coupon_ready";
type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "error";

interface Notification {
  id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  status: NotificationStatus;
  sent_at: string;
  created_at: string;
}

interface HistoryResponse {
  status: number;
  data: {
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
  };
}

interface BirthdayTemplate {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
}

interface BirthdayResponse {
  success: boolean;
  data: BirthdayTemplate;
}

interface AnalyticsData {
  total_sent: number;
  delivery_rate: number;
  by_type: Record<string, number>;
}

interface AnalyticsResponse {
  success: boolean;
  data: AnalyticsData;
}

interface BroadcastResult {
  sent: number;
  failed: number;
  total: number;
}

interface BroadcastResponse {
  success: boolean;
  data: BroadcastResult;
}

type Tab = "send" | "history" | "birthday" | "analytics";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const c = t.shop.push;

const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)]";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]";

const TYPE_LABELS: Record<NotificationType, string> = {
  manual: c.typeManual,
  birthday: c.typeBirthday,
  points_earned: c.typePointsEarned,
  coupon_ready: c.typeCouponReady,
};

const STATUS_CONFIG: Record<NotificationStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: { label: c.statusPending, color: "bg-amber-50 text-amber-700", icon: Clock },
  sent: { label: c.statusSent, color: "bg-blue-50 text-blue-700", icon: Send },
  delivered: { label: c.statusDelivered, color: "bg-green-50 text-green-700", icon: CheckCircle },
  failed: { label: c.statusFailed, color: "bg-red-50 text-red-600", icon: XCircle },
  error: { label: c.statusError, color: "bg-red-50 text-red-600", icon: AlertCircle },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function PushPage() {
  const [tab, setTab] = useState<Tab>("send");

  return (
    <div className="rise-in">
      <h1 className="display-title mb-6 text-2xl font-bold text-[var(--sea-ink)]">
        {c.title}
      </h1>

      {/* Tabs */}
      <div className="mb-5 inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
        {(
          [
            ["send", c.send],
            ["history", c.history],
            ["birthday", c.birthday],
            ["analytics", c.analytics],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === key
                ? "bg-[var(--lagoon-deep)] text-white shadow-sm"
                : "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "send" && <SendTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "birthday" && <BirthdayTab />}
      {tab === "analytics" && <AnalyticsTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Send Tab                                                           */
/* ------------------------------------------------------------------ */

function SendTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setConfirmOpen(false);
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<BroadcastResponse>(
        "/api/shop-admin/notifications/broadcast",
        { title, body },
      );
      setResult(res.data);
      setTitle("");
      setBody("");
    } catch {
      setError(c.sendError);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="island-shell rounded-2xl p-6">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>{c.notifTitle}</label>
            <input
              type="text"
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={c.notifTitlePlaceholder}
            />
          </div>
          <div>
            <label className={labelClass}>{c.notifBody}</label>
            <textarea
              className={`${inputClass} min-h-[120px] resize-y`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={c.notifBodyPlaceholder}
              rows={4}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {result && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm">
              <p className="font-semibold text-green-700">{c.sendSuccess}</p>
              <div className="mt-1 flex gap-4 text-xs text-green-600">
                <span>{c.sent}: {result.sent}</span>
                <span>{c.failed}: {result.failed}</span>
                <span>{c.total}: {result.total}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={sending || !title.trim() || !body.trim()}
            onClick={() => setConfirmOpen(true)}
            className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <span className="flex items-center justify-center gap-2">
              <Send size={16} />
              {sending ? c.sending : c.send}
            </span>
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-start justify-center">
        <div className="w-full max-w-[300px] rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-lg">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--lagoon)] p-1.5">
              <Send size={18} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--sea-ink)]">
                {title || c.notifTitlePlaceholder}
              </p>
              <p className="text-[10px] text-[var(--sea-ink-soft)]">Zdaj</p>
            </div>
          </div>
          <p className="text-sm text-[var(--sea-ink-soft)]">
            {body || c.notifBodyPlaceholder}
          </p>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmOpen(false);
            }}
          >
            <div className="island-shell rise-in w-full max-w-sm rounded-2xl p-6 text-center">
              <h3 className="display-title mb-2 text-lg font-bold text-[var(--sea-ink)]">
                {c.confirmTitle}
              </h3>
              <p className="mb-5 text-sm text-[var(--sea-ink-soft)]">
                {c.confirmMessage}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:-translate-y-0.5"
                >
                  {c.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  className="rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)]"
                >
                  <span className="flex items-center gap-2">
                    <Send size={14} /> {c.confirmSend}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  History Tab                                                        */
/* ------------------------------------------------------------------ */

function HistoryTab() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 25;

  useEffect(() => {
    fetchHistory();
  }, [page]);

  async function fetchHistory() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<HistoryResponse>(
        `/api/shop-admin/notifications/history?page=${page}&limit=${limit}`,
      );
      setNotifications(res.data.notifications);
      setTotal(res.data.total);
    } catch {
      setError(c.loadError);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="island-shell rounded-2xl p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton mb-3 h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
        {error}
      </p>
    );
  }

  return (
    <div className="island-shell overflow-hidden rounded-2xl">
      {notifications.length === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--sea-ink-soft)]">
          {c.noHistory}
        </p>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
              <tr className="border-b border-[var(--line)] text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                <th className="px-4 py-3">{c.type}</th>
                <th className="px-4 py-3">{c.notifTitle}</th>
                <th className="px-4 py-3">{c.status}</th>
                <th className="hidden px-4 py-3 md:table-cell">
                  {c.sentDate}
                </th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => {
                const sc = STATUS_CONFIG[n.status] ?? STATUS_CONFIG.pending;
                const Icon = sc.icon;
                return (
                  <tr
                    key={n.id}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface)]"
                  >
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--sea-ink)]">
                        {TYPE_LABELS[n.notification_type] ?? n.notification_type}
                      </span>
                    </td>
                    <td className="max-w-[250px] truncate px-4 py-3 font-medium text-[var(--sea-ink)]">
                      {n.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${sc.color}`}
                      >
                        <Icon size={12} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--sea-ink-soft)] md:table-cell">
                      {n.sent_at
                        ? new Date(n.sent_at).toLocaleDateString("sl-SI", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3">
          <p className="text-xs text-[var(--sea-ink-soft)]">
            {page} / {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--surface)] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--surface)] disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Birthday Tab                                                       */
/* ------------------------------------------------------------------ */

function BirthdayTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BirthdayResponse>("/api/shop-admin/notifications/birthday-template")
      .then((res) => {
        const d = res.data;
        setTitle(d.title || "");
        setBody(d.body || "");
        setIsActive(d.is_active);
      })
      .catch(() => setError(c.loadError))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      await api.post("/api/shop-admin/notifications/birthday-template", {
        title,
        body,
        is_active: isActive,
      });
      setFeedback(c.saveSuccess);
    } catch {
      setError(c.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="island-shell max-w-xl rounded-2xl p-6">
        <div className="space-y-4">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="skeleton h-24 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="island-shell max-w-xl rounded-2xl p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <Cake size={20} className="text-[var(--lagoon)]" />
        <h2 className="text-sm font-bold text-[var(--sea-ink)]">
          {c.birthday}
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>{c.birthdayTitle}</label>
          <input
            type="text"
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>{c.birthdayBody}</label>
          <textarea
            className={`${inputClass} min-h-[100px] resize-y`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--line)] accent-[var(--lagoon)]"
          />
          <span className="text-sm font-medium text-[var(--sea-ink)]">
            {c.activeToggle}
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {feedback && (
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {feedback}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {saving ? c.saving : c.save}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Analytics Tab                                                      */
/* ------------------------------------------------------------------ */

function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AnalyticsResponse>("/api/shop-admin/notifications/analytics")
      .then((res) => setData(res.data))
      .catch(() => setError(c.loadError))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="island-shell rounded-2xl p-5">
            <div className="skeleton mb-2 h-3 w-20" />
            <div className="skeleton h-7 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="island-shell rounded-2xl p-5">
          <div className="mb-2 flex items-center gap-2 text-[var(--sea-ink-soft)]">
            <Send size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {c.totalSent}
            </span>
          </div>
          <p className="text-2xl font-bold text-[var(--sea-ink)]">
            {data.total_sent.toLocaleString("sl-SI")}
          </p>
        </div>

        <div className="island-shell rounded-2xl p-5">
          <div className="mb-2 flex items-center gap-2 text-[var(--sea-ink-soft)]">
            <CheckCircle size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {c.deliveryRate}
            </span>
          </div>
          <p className="text-2xl font-bold text-[var(--sea-ink)]">
            {data.delivery_rate.toFixed(1)}%
          </p>
        </div>

        <div className="island-shell rounded-2xl p-5 sm:col-span-2 lg:col-span-1">
          <div className="mb-3 flex items-center gap-2 text-[var(--sea-ink-soft)]">
            <BarChart3 size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">
              {c.byType}
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(data.by_type).map(([type, count]) => {
              const pct =
                data.total_sent > 0 ? (count / data.total_sent) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--sea-ink)]">
                      {TYPE_LABELS[type as NotificationType] ?? type}
                    </span>
                    <span className="text-[var(--sea-ink-soft)]">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
                    <div
                      className="h-full rounded-full bg-[var(--lagoon)]"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
