import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	BarChart3,
	Cake,
	Calendar,
	CalendarClock,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Clock,
	Plus,
	Send,
	Trash2,
	Users,
	X,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { t } from "#/i18n";
import { ApiError, api } from "#/lib/api";

export const Route = createFileRoute("/_authenticated/dashboard/push")({
	component: PushPage,
	head: () => ({
		meta: [{ title: "Push obvestila — Zvest" }],
	}),
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Category = "manual" | "daily_meal" | "specials";
type NotificationType =
	| Category
	| "birthday"
	| "points_earned"
	| "coupon_ready";
type NotificationStatus =
	| "pending"
	| "sent"
	| "delivered"
	| "failed"
	| "error"
	| "dry_run"
	| "scheduled"
	| "cancelled";

interface Notification {
	id: string;
	notification_type: NotificationType;
	title: string;
	body: string;
	status: NotificationStatus;
	sent_at: string | null;
	created_at: string;
}

interface Envelope<T> {
	status: number;
	message?: string;
	data: T;
}

interface HistoryData {
	notifications: Notification[];
	total: number;
	page: number;
	limit: number;
}

interface BroadcastResult {
	scheduled: boolean;
	scheduled_id: string | null;
	audience_size: number;
	sent?: number;
	failed?: number;
	dry_run?: number;
	daily_quota_remaining: number;
}

interface AudiencePreview {
	category: Category;
	subscribed_count: number;
	total_with_loyalty: number;
	total_subscribers: number;
}

interface QuotaInfo {
	daily_limit: number;
	daily_remaining: number;
	hourly_limit: number;
	can_send_now: boolean;
	retry_after_seconds: number;
}

interface ScheduledNotification {
	id: string;
	notification_type: NotificationType;
	title: string;
	body: string;
	scheduled_for: string;
	status: NotificationStatus;
	recipient_count: number | null;
	sent_at: string | null;
	created_at: string;
}

interface CouponSummary {
	id: string;
	name: string | null;
	type: "percentage" | "fixed" | string;
	is_birthday_only: boolean;
}

interface BirthdayTemplate {
	id: string;
	title: string;
	body: string;
	is_active: boolean;
	coupon_id: string | null;
	coupon: CouponSummary | null;
}

interface AnalyticsData {
	total_sent: number;
	total_delivered: number;
	total_failed: number;
	total_dry_run: number;
	delivery_rate: number;
	by_type: Record<string, number>;
	delivery_rate_by_type: Record<string, number>;
	subscriber_count: number;
	subscriber_count_by_category: Record<string, number>;
}

interface NotificationPlan {
	id: string;
	name: string;
	is_active: boolean;
	timezone: string;
	created_at: string;
	updated_at: string;
}

interface PlanEntry {
	id?: string;
	day_of_week: number; // 0 = Sun, 6 = Sat (server convention)
	send_time_local: string; // HH:MM or HH:MM:SS
	notification_type: Category;
	title: string;
	body: string;
	data?: Record<string, unknown>;
	is_active: boolean;
}

interface CouponListItem {
	id: string;
	name?: string | null;
	code?: string;
	type: "percentage" | "fixed";
	is_birthday_only?: boolean;
	expires_at?: string;
}

type Tab = "send" | "plan" | "birthday" | "history" | "analytics" | "test";

interface TestSendTicket {
	token: string;
	status: string;
	error: string | null;
}

interface TestSendResult {
	attempted: number;
	sent: number;
	failed: number;
	dry_run: number;
	tickets: TestSendTicket[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const c = t.shop.push;

const inputClass =
	"w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)]";

const labelClass =
	"mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]";

const btnPrimary =
	"rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0";

const btnOutline =
	"rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--sea-ink-soft)] transition hover:-translate-y-0.5 hover:border-[var(--lagoon)] hover:text-[var(--sea-ink)]";

const CATEGORIES: ReadonlyArray<{
	value: Category;
	label: string;
	hint: string;
	hasQuota: boolean;
}> = [
	{
		value: "manual",
		label: c.catManual,
		hint: c.catManualHint,
		hasQuota: true,
	},
	{
		value: "daily_meal",
		label: c.catDailyMeal,
		hint: c.catDailyMealHint,
		hasQuota: false,
	},
	{
		value: "specials",
		label: c.catSpecials,
		hint: c.catSpecialsHint,
		hasQuota: false,
	},
];

const TYPE_LABELS: Record<NotificationType, string> = {
	manual: c.typeManual,
	birthday: c.typeBirthday,
	points_earned: c.typePointsEarned,
	coupon_ready: c.typeCouponReady,
	daily_meal: c.typeDailyMeal,
	specials: c.typeSpecials,
};

const STATUS_CONFIG: Record<
	NotificationStatus,
	{ label: string; color: string; icon: typeof CheckCircle }
> = {
	pending: {
		label: c.statusPending,
		color: "bg-amber-50 text-amber-700",
		icon: Clock,
	},
	sent: { label: c.statusSent, color: "bg-blue-50 text-blue-700", icon: Send },
	delivered: {
		label: c.statusDelivered,
		color: "bg-green-50 text-green-700",
		icon: CheckCircle,
	},
	failed: {
		label: c.statusFailed,
		color: "bg-red-50 text-red-600",
		icon: XCircle,
	},
	error: {
		label: c.statusError,
		color: "bg-red-50 text-red-600",
		icon: AlertCircle,
	},
	dry_run: {
		label: c.statusDryRun,
		color: "bg-yellow-50 text-yellow-700",
		icon: AlertTriangle,
	},
	scheduled: {
		label: c.statusScheduled,
		color: "bg-indigo-50 text-indigo-700",
		icon: CalendarClock,
	},
	cancelled: {
		label: c.statusCancelled,
		color: "bg-gray-100 text-gray-600",
		icon: X,
	},
};

// Display order Mon → Sun, mapped to backend day_of_week (0=Sun..6=Sat)
const DAY_ORDER: ReadonlyArray<{ dow: number; short: string; long: string }> = [
	{ dow: 1, short: c.mon, long: c.monLong },
	{ dow: 2, short: c.tue, long: c.tueLong },
	{ dow: 3, short: c.wed, long: c.wedLong },
	{ dow: 4, short: c.thu, long: c.thuLong },
	{ dow: 5, short: c.fri, long: c.friLong },
	{ dow: 6, short: c.sat, long: c.satLong },
	{ dow: 0, short: c.sun, long: c.sunLong },
];

const TIMEZONES = [
	"Europe/Ljubljana",
	"Europe/Zagreb",
	"Europe/Vienna",
	"Europe/Berlin",
	"Europe/Rome",
	"Europe/Belgrade",
	"Europe/Budapest",
];

const DRY_RUN_KEY = "zvest:push:dry-run-seen";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number): string {
	if (seconds <= 0) return "0 s";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
	if (m > 0) return s > 0 ? `${m} min` : `${m} min`;
	return `${s} s`;
}

function formatDateTime(iso: string | null): string {
	if (!iso) return "—";
	return new Date(iso).toLocaleString("sl-SI", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function nowLocalDatetimeInput(): string {
	// value for <input type="datetime-local"> = "YYYY-MM-DDTHH:MM"
	const d = new Date();
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
	return d.toISOString().slice(0, 16);
}

function trimTimeForInput(time: string): string {
	// backend may return "HH:MM:SS"; <input type="time"> wants "HH:MM"
	return time.length >= 5 ? time.slice(0, 5) : time;
}

function padTime(time: string): string {
	// ensure HH:MM:SS for backend
	return time.length === 5 ? `${time}:00` : time;
}

/** Get current weekday (0=Sun..6=Sat) and HH:MM in a given IANA timezone. */
function nowInTz(tz: string): { dow: number; hm: string; date: Date } {
	const date = new Date();
	const wfmt = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		weekday: "short",
	});
	const wd = wfmt.format(date);
	const map: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6,
	};
	const dow = map[wd] ?? 0;
	const tfmt = new Intl.DateTimeFormat("en-GB", {
		timeZone: tz,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const hm = tfmt.format(date);
	return { dow, hm, date };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function PushPage() {
	const [tab, setTab] = useState<Tab>("send");
	const [dryRunSeen, setDryRunSeen] = useState<boolean>(() => {
		if (typeof window === "undefined") return false;
		return sessionStorage.getItem(DRY_RUN_KEY) === "1";
	});

	const noteDryRun = useCallback(() => {
		setDryRunSeen(true);
		if (typeof window !== "undefined") sessionStorage.setItem(DRY_RUN_KEY, "1");
	}, []);

	return (
		<div className="rise-in">
			<h1 className="display-title mb-6 text-2xl font-bold text-[var(--sea-ink)]">
				{c.title}
			</h1>

			{dryRunSeen && <DryRunBanner />}

			{/* Tabs */}
			<div className="mb-5 inline-flex flex-wrap rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
				{(
					[
						["send", c.send],
						["plan", c.plan],
						["birthday", c.birthday],
						["history", c.history],
						["analytics", c.analytics],
						["test", c.testTab],
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

			{tab === "send" && <SendTab onDryRun={noteDryRun} />}
			{tab === "plan" && <PlanTab />}
			{tab === "birthday" && <BirthdayTab />}
			{tab === "history" && <HistoryTab />}
			{tab === "analytics" && <AnalyticsTab />}
			{tab === "test" && <TestTab />}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Shared: Dry-run banner                                             */
/* ------------------------------------------------------------------ */

function DryRunBanner() {
	return (
		<div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
			<AlertTriangle size={18} className="mt-0.5 shrink-0" />
			<div>
				<p className="font-semibold">{c.dryRunTitle}</p>
				<p className="mt-0.5 text-xs">{c.dryRunBody}</p>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Shared: Audience preview                                           */
/* ------------------------------------------------------------------ */

function useAudiencePreview(category: Category) {
	const [data, setData] = useState<AudiencePreview | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		api
			.get<Envelope<AudiencePreview>>(
				`/api/shop-admin/notifications/audience-preview?category=${category}`,
			)
			.then((res) => {
				if (!cancelled) setData(res.data);
			})
			.catch(() => {
				if (!cancelled) setData(null);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [category]);

	return { data, loading };
}

function AudienceChip({ category }: { category: Category }) {
	const { data, loading } = useAudiencePreview(category);
	const catLabel =
		CATEGORIES.find((cat) => cat.value === category)?.label ?? category;

	if (loading || !data) {
		return (
			<div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
				<div className="skeleton h-3 w-48 rounded" />
			</div>
		);
	}

	if (data.subscribed_count === 0) {
		return (
			<div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
				<Users size={16} className="mt-0.5 shrink-0" />
				<div>
					<p className="font-semibold">{c.audienceEmpty}</p>
					<p className="mt-0.5 text-xs">{c.audienceEmptyHint}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
			<div className="flex items-center gap-2 font-semibold text-[var(--sea-ink)]">
				<Users size={14} className="text-[var(--lagoon)]" />
				<span>{c.audienceLabel}</span>
			</div>
			<p className="mt-1 text-[var(--sea-ink)]">
				{c.audienceReach
					.replace("{count}", data.subscribed_count.toLocaleString("sl-SI"))
					.replace("{cat}", catLabel)}
			</p>
			<p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
				{c.audienceContext
					.replace(
						"{followers}",
						data.total_subscribers.toLocaleString("sl-SI"),
					)
					.replace(
						"{loyalty}",
						data.total_with_loyalty.toLocaleString("sl-SI"),
					)}
			</p>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Send Tab                                                           */
/* ------------------------------------------------------------------ */

function SendTab({ onDryRun }: { onDryRun: () => void }) {
	const [category, setCategory] = useState<Category>("manual");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
	const [scheduledFor, setScheduledFor] = useState<string>(() => {
		const d = new Date();
		d.setHours(d.getHours() + 1);
		d.setMinutes(0, 0, 0);
		d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
		return d.toISOString().slice(0, 16);
	});

	const [sending, setSending] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [resultBanner, setResultBanner] = useState<
		| { kind: "send"; sent: number; failed: number }
		| { kind: "schedule"; when: string }
		| { kind: "dry_run"; count: number }
		| null
	>(null);
	const [error, setError] = useState<string | null>(null);

	const [quota, setQuota] = useState<QuotaInfo | null>(null);
	const [quotaLoading, setQuotaLoading] = useState(false);

	const fetchQuota = useCallback(async () => {
		setQuotaLoading(true);
		try {
			const res = await api.get<Envelope<QuotaInfo>>(
				"/api/shop-admin/notifications/quota",
			);
			setQuota(res.data);
		} catch {
			/* non-fatal */
		} finally {
			setQuotaLoading(false);
		}
	}, []);

	useEffect(() => {
		if (category === "manual") fetchQuota();
	}, [category, fetchQuota]);

	const minScheduleValue = nowLocalDatetimeInput();
	const isQuotaBlocked =
		category === "manual" && quota ? !quota.can_send_now : false;

	async function handleSubmit() {
		setConfirmOpen(false);
		setError(null);
		setResultBanner(null);

		// local validation for schedule
		let scheduledISO: string | undefined;
		if (scheduleMode === "later") {
			const when = new Date(scheduledFor);
			if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
				setError(c.schedulePast);
				return;
			}
			scheduledISO = when.toISOString();
		}

		setSending(true);
		try {
			const payload: Record<string, unknown> = { category, title, body };
			if (scheduledISO) payload.scheduled_for = scheduledISO;
			const res = await api.post<Envelope<BroadcastResult>>(
				"/api/shop-admin/notifications/broadcast",
				payload,
			);
			const data = res.data;
			if (data.scheduled) {
				setResultBanner({
					kind: "schedule",
					when: formatDateTime(scheduledISO ?? null),
				});
			} else if ((data.dry_run ?? 0) > 0) {
				onDryRun();
				setResultBanner({ kind: "dry_run", count: data.dry_run ?? 0 });
			} else {
				setResultBanner({
					kind: "send",
					sent: data.sent ?? 0,
					failed: data.failed ?? 0,
				});
			}
			setTitle("");
			setBody("");
			// refresh quota for manual
			if (category === "manual") fetchQuota();
		} catch (err) {
			if (err instanceof ApiError && err.status === 429) {
				const body = err.body as
					| { data?: { retry_after_seconds?: number } }
					| undefined;
				const retry = body?.data?.retry_after_seconds ?? 0;
				setError(c.quotaReached.replace("{time}", formatDuration(retry)));
				if (category === "manual") fetchQuota();
			} else {
				setError(c.sendError);
			}
		} finally {
			setSending(false);
		}
	}

	return (
		<div className="space-y-6">
			<div className="grid gap-6 lg:grid-cols-2">
				<div className="island-shell rounded-2xl p-6">
					<div className="space-y-4">
						{/* Category */}
						<div>
							<label className={labelClass}>{c.category}</label>
							<select
								className={inputClass}
								value={category}
								onChange={(e) => {
									setCategory(e.target.value as Category);
									setResultBanner(null);
									setError(null);
								}}
							>
								{CATEGORIES.map((cat) => (
									<option key={cat.value} value={cat.value}>
										{cat.label}
									</option>
								))}
							</select>
							<p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
								{CATEGORIES.find((cat) => cat.value === category)?.hint}
							</p>
						</div>

						{/* Audience */}
						<AudienceChip category={category} />

						{/* Title */}
						<div>
							<label className={labelClass}>{c.notifTitle}</label>
							<input
								type="text"
								className={inputClass}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder={c.notifTitlePlaceholder}
								maxLength={100}
							/>
						</div>

						{/* Body */}
						<div>
							<label className={labelClass}>{c.notifBody}</label>
							<textarea
								className={`${inputClass} min-h-[120px] resize-y`}
								value={body}
								onChange={(e) => setBody(e.target.value)}
								placeholder={c.notifBodyPlaceholder}
								rows={4}
								maxLength={500}
							/>
						</div>

						{/* Schedule */}
						<div>
							<label className={labelClass}>{c.schedule}</label>
							<div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
								<button
									type="button"
									onClick={() => setScheduleMode("now")}
									className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
										scheduleMode === "now"
											? "bg-[var(--lagoon-deep)] text-white shadow-sm"
											: "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
									}`}
								>
									{c.sendNow}
								</button>
								<button
									type="button"
									onClick={() => setScheduleMode("later")}
									className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
										scheduleMode === "later"
											? "bg-[var(--lagoon-deep)] text-white shadow-sm"
											: "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
									}`}
								>
									{c.scheduleLater}
								</button>
							</div>
							{scheduleMode === "later" && (
								<div className="mt-3">
									<label className={labelClass}>{c.scheduledFor}</label>
									<input
										type="datetime-local"
										className={inputClass}
										value={scheduledFor}
										min={minScheduleValue}
										onChange={(e) => setScheduledFor(e.target.value)}
									/>
									<p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
										{c.scheduleTimezoneNote}
									</p>
								</div>
							)}
						</div>

						{/* Quota */}
						{category === "manual" && quota && (
							<div
								className={`rounded-lg border px-3 py-2 text-xs ${
									quota.can_send_now
										? "border-[var(--line)] bg-[var(--surface)] text-[var(--sea-ink-soft)]"
										: "border-red-200 bg-red-50 text-red-600"
								}`}
							>
								{quota.can_send_now
									? c.quotaUsed
											.replace(
												"{used}",
												String(quota.daily_limit - quota.daily_remaining),
											)
											.replace("{limit}", String(quota.daily_limit))
									: c.quotaReached.replace(
											"{time}",
											formatDuration(quota.retry_after_seconds),
										)}
							</div>
						)}

						{/* Errors / banners */}
						{error && (
							<p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
								{error}
							</p>
						)}

						{resultBanner?.kind === "send" && (
							<div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm">
								<p className="font-semibold text-green-700">{c.sendSuccess}</p>
								<div className="mt-1 flex gap-4 text-xs text-green-600">
									<span>
										{c.sent}: {resultBanner.sent}
									</span>
									<span>
										{c.failed}: {resultBanner.failed}
									</span>
								</div>
							</div>
						)}
						{resultBanner?.kind === "schedule" && (
							<div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
								{c.scheduleSuccess.replace("{time}", resultBanner.when)}
							</div>
						)}
						{resultBanner?.kind === "dry_run" && (
							<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
								{c.dryRunSendResult.replace(
									"{count}",
									String(resultBanner.count),
								)}
							</div>
						)}

						<button
							type="button"
							disabled={
								sending ||
								quotaLoading ||
								isQuotaBlocked ||
								!title.trim() ||
								!body.trim()
							}
							onClick={() => setConfirmOpen(true)}
							className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0"
						>
							<span className="flex items-center justify-center gap-2">
								<Send size={16} />
								{sending
									? c.sending
									: scheduleMode === "later"
										? c.scheduleLater
										: c.send}
							</span>
						</button>
					</div>
				</div>

				{/* Mobile preview */}
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
								<p className="text-[10px] text-[var(--sea-ink-soft)]">
									{scheduleMode === "later" && scheduledFor
										? formatDateTime(new Date(scheduledFor).toISOString())
										: "Zdaj"}
								</p>
							</div>
						</div>
						<p className="text-sm text-[var(--sea-ink-soft)]">
							{body || c.notifBodyPlaceholder}
						</p>
					</div>
				</div>
			</div>

			<ScheduledQueue />

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
									onClick={handleSubmit}
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
/*  Scheduled queue (rendered inside Send tab)                         */
/* ------------------------------------------------------------------ */

function ScheduledQueue() {
	const [items, setItems] = useState<ScheduledNotification[]>([]);
	const [loading, setLoading] = useState(true);
	const [cancelling, setCancelling] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await api.get<
				Envelope<{ scheduled: ScheduledNotification[] }>
			>("/api/shop-admin/notifications/scheduled?status=scheduled");
			setItems(res.data.scheduled || []);
		} catch {
			setError(c.loadError);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	async function handleCancel(id: string) {
		setCancelling(id);
		try {
			await api.delete(`/api/shop-admin/notifications/scheduled/${id}`);
			await refresh();
		} catch {
			setError(c.cancelError);
		} finally {
			setCancelling(null);
		}
	}

	return (
		<div className="island-shell rounded-2xl p-6">
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<CalendarClock size={18} className="text-[var(--lagoon)]" />
					<h2 className="text-sm font-bold text-[var(--sea-ink)]">
						{c.scheduledQueue}
					</h2>
				</div>
				{items.length > 0 && (
					<span className="text-xs text-[var(--sea-ink-soft)]">
						{items.length}
					</span>
				)}
			</div>

			{loading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="skeleton h-12 w-full rounded-lg" />
					))}
				</div>
			) : error ? (
				<p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
					{error}
				</p>
			) : items.length === 0 ? (
				<p className="py-4 text-center text-sm text-[var(--sea-ink-soft)]">
					{c.scheduledEmpty}
				</p>
			) : (
				<ul className="divide-y divide-[var(--line)]">
					{items.map((item) => (
						<li key={item.id} className="flex items-center gap-3 py-3 text-sm">
							<div className="flex shrink-0 flex-col items-start gap-1">
								<span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--sea-ink)]">
									{TYPE_LABELS[item.notification_type] ??
										item.notification_type}
								</span>
								<span className="text-xs text-[var(--sea-ink-soft)]">
									{formatDateTime(item.scheduled_for)}
								</span>
							</div>
							<p className="flex-1 truncate font-medium text-[var(--sea-ink)]">
								{item.title}
							</p>
							<button
								type="button"
								disabled={cancelling === item.id}
								onClick={() => handleCancel(item.id)}
								className="shrink-0 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50 disabled:opacity-50"
							>
								{c.cancelScheduled}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Plan Tab                                                           */
/* ------------------------------------------------------------------ */

function PlanTab() {
	const [plans, setPlans] = useState<NotificationPlan[]>([]);
	const [loadingPlans, setLoadingPlans] = useState(true);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const refresh = useCallback(async () => {
		setLoadingPlans(true);
		setError(null);
		try {
			const res = await api.get<
				Envelope<{ plans: NotificationPlan[] } | NotificationPlan[]>
			>("/api/shop-admin/notifications/plans");
			// Accept either { plans: [...] } or [...] envelope shapes.
			const list = Array.isArray(res.data)
				? res.data
				: (res.data as { plans: NotificationPlan[] }).plans || [];
			setPlans(list);
			if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
			if (list.length === 0) setSelectedId(null);
		} catch {
			setError(c.loadError);
		} finally {
			setLoadingPlans(false);
		}
	}, [selectedId]);

	useEffect(() => {
		refresh();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function handleCreate() {
		setCreating(true);
		setError(null);
		try {
			const res = await api.post<Envelope<NotificationPlan>>(
				"/api/shop-admin/notifications/plans",
				{ name: c.planNamePlaceholder, timezone: "Europe/Ljubljana" },
			);
			setPlans((prev) => [...prev, res.data]);
			setSelectedId(res.data.id);
		} catch {
			setError(c.saveError);
		} finally {
			setCreating(false);
		}
	}

	if (loadingPlans) {
		return (
			<div className="island-shell rounded-2xl p-6">
				<div className="skeleton mb-3 h-6 w-48 rounded" />
				<div className="skeleton h-32 w-full rounded-lg" />
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

	if (plans.length === 0) {
		return (
			<div className="island-shell rounded-2xl p-10 text-center">
				<Calendar
					size={36}
					className="mx-auto mb-3 text-[var(--sea-ink-soft)]"
					strokeWidth={1.5}
				/>
				<h2 className="display-title mb-1 text-lg font-bold text-[var(--sea-ink)]">
					{c.planTitle}
				</h2>
				<p className="mb-5 text-sm text-[var(--sea-ink-soft)]">
					{c.planSubtitle}
				</p>
				<button
					type="button"
					onClick={handleCreate}
					disabled={creating}
					className={btnPrimary}
				>
					<span className="flex items-center gap-2">
						<Plus size={16} />
						{c.planCreate}
					</span>
				</button>
			</div>
		);
	}

	const current = plans.find((p) => p.id === selectedId);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-3">
				{plans.length > 1 && (
					<select
						className={`${inputClass} max-w-[260px]`}
						value={selectedId ?? ""}
						onChange={(e) => setSelectedId(e.target.value)}
					>
						{plans.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
				)}
				<button
					type="button"
					onClick={handleCreate}
					disabled={creating}
					className={btnOutline}
				>
					<span className="flex items-center gap-1.5">
						<Plus size={14} />
						{c.planCreate}
					</span>
				</button>
			</div>

			{current && (
				<PlanEditor
					key={current.id}
					plan={current}
					onUpdated={(updated) =>
						setPlans((prev) =>
							prev.map((p) => (p.id === updated.id ? updated : p)),
						)
					}
					onDeleted={() => {
						setPlans((prev) => prev.filter((p) => p.id !== current.id));
						setSelectedId(null);
						refresh();
					}}
				/>
			)}
		</div>
	);
}

function PlanEditor({
	plan,
	onUpdated,
	onDeleted,
}: {
	plan: NotificationPlan;
	onUpdated: (p: NotificationPlan) => void;
	onDeleted: () => void;
}) {
	const [name, setName] = useState(plan.name);
	const [timezone, setTimezone] = useState(plan.timezone);
	const [isActive, setIsActive] = useState(plan.is_active);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// entries
	const [entries, setEntries] = useState<PlanEntry[]>([]);
	const [savedEntries, setSavedEntries] = useState<PlanEntry[]>([]);
	const [entriesLoading, setEntriesLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [feedback, setFeedback] = useState<{
		kind: "ok" | "err";
		msg: string;
	} | null>(null);

	const loadEntries = useCallback(async () => {
		setEntriesLoading(true);
		try {
			const res = await api.get<Envelope<{ entries: PlanEntry[] }>>(
				`/api/shop-admin/notifications/plans/${plan.id}/entries`,
			);
			const list = res.data.entries || [];
			setEntries(list);
			setSavedEntries(list);
		} catch {
			setFeedback({ kind: "err", msg: c.loadError });
		} finally {
			setEntriesLoading(false);
		}
	}, [plan.id]);

	useEffect(() => {
		loadEntries();
	}, [loadEntries]);

	async function patchPlan(
		partial: Partial<{ name: string; timezone: string; is_active: boolean }>,
	) {
		try {
			const res = await api.patch<Envelope<NotificationPlan>>(
				`/api/shop-admin/notifications/plans/${plan.id}`,
				partial,
			);
			onUpdated(res.data);
		} catch {
			setFeedback({ kind: "err", msg: c.saveError });
		}
	}

	function updateEntry(dow: number, patch: Partial<PlanEntry>) {
		setEntries((prev) => {
			const idx = prev.findIndex((e) => e.day_of_week === dow);
			if (idx === -1) {
				return [
					...prev,
					{
						day_of_week: dow,
						send_time_local: "11:30",
						notification_type: "daily_meal",
						title: "",
						body: "",
						is_active: true,
						...patch,
					},
				];
			}
			const next = [...prev];
			next[idx] = { ...next[idx], ...patch };
			return next;
		});
	}

	function removeEntry(dow: number) {
		setEntries((prev) => prev.filter((e) => e.day_of_week !== dow));
	}

	const dirty = useMemo(
		() => JSON.stringify(entries) !== JSON.stringify(savedEntries),
		[entries, savedEntries],
	);

	// duplicate dow check (defensive — UI normally prevents this)
	const hasDuplicateDow = useMemo(() => {
		const seen = new Set<number>();
		for (const e of entries) {
			if (seen.has(e.day_of_week)) return true;
			seen.add(e.day_of_week);
		}
		return false;
	}, [entries]);

	async function handleSave() {
		if (hasDuplicateDow) {
			setFeedback({ kind: "err", msg: c.planDuplicateDay });
			return;
		}
		setSaving(true);
		setFeedback(null);
		try {
			const payload = {
				entries: entries
					.filter((e) => e.is_active)
					.map((e) => ({
						day_of_week: e.day_of_week,
						send_time_local: padTime(e.send_time_local),
						notification_type: e.notification_type,
						title: e.title,
						body: e.body,
						is_active: e.is_active,
					})),
			};
			await api.put(
				`/api/shop-admin/notifications/plans/${plan.id}/entries`,
				payload,
			);
			setSavedEntries(entries);
			setFeedback({ kind: "ok", msg: c.planSaved });
		} catch (err) {
			if (err instanceof ApiError && err.status === 400) {
				setFeedback({ kind: "err", msg: c.planDuplicateDay });
			} else {
				setFeedback({ kind: "err", msg: c.planSaveError });
			}
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete() {
		setDeleting(true);
		try {
			await api.delete(`/api/shop-admin/notifications/plans/${plan.id}`);
			setConfirmDelete(false);
			onDeleted();
		} catch {
			setFeedback({ kind: "err", msg: c.saveError });
		} finally {
			setDeleting(false);
		}
	}

	return (
		<div className="space-y-5">
			{/* Plan header */}
			<div className="island-shell rounded-2xl p-6">
				<div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto]">
					<div>
						<label className={labelClass}>{c.planName}</label>
						<input
							type="text"
							className={inputClass}
							value={name}
							onChange={(e) => setName(e.target.value)}
							onBlur={() => {
								if (name !== plan.name && name.trim().length > 0)
									patchPlan({ name: name.trim() });
							}}
						/>
					</div>
					<div>
						<label className={labelClass}>{c.planTimezone}</label>
						<select
							className={inputClass}
							value={timezone}
							onChange={(e) => {
								const tz = e.target.value;
								setTimezone(tz);
								patchPlan({ timezone: tz });
							}}
						>
							{TIMEZONES.includes(timezone) ? null : (
								<option value={timezone}>{timezone}</option>
							)}
							{TIMEZONES.map((tz) => (
								<option key={tz} value={tz}>
									{tz}
								</option>
							))}
						</select>
					</div>
					<div className="flex items-end gap-3">
						<label className="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								checked={isActive}
								onChange={(e) => {
									setIsActive(e.target.checked);
									patchPlan({ is_active: e.target.checked });
								}}
								className="h-4 w-4 rounded border-[var(--line)] accent-[var(--lagoon)]"
							/>
							<span className="text-sm font-medium text-[var(--sea-ink)]">
								{c.planActive}
							</span>
						</label>
						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:-translate-y-0.5 hover:bg-red-50"
							title={c.planDelete}
						>
							<Trash2 size={14} />
						</button>
					</div>
				</div>
				{!isActive && (
					<p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
						{c.planPaused}
					</p>
				)}
			</div>

			{/* Day grid */}
			<div className="island-shell rounded-2xl p-6">
				{entriesLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 7 }).map((_, i) => (
							<div key={i} className="skeleton h-12 w-full rounded-lg" />
						))}
					</div>
				) : (
					<div className="space-y-3">
						{DAY_ORDER.map((d) => {
							const entry = entries.find((e) => e.day_of_week === d.dow);
							const enabled = !!entry && entry.is_active;
							return (
								<DayRow
									key={d.dow}
									dow={d.dow}
									shortLabel={d.short}
									longLabel={d.long}
									entry={entry ?? null}
									enabled={enabled}
									onToggle={(on) => {
										if (on) {
											updateEntry(d.dow, { is_active: true });
										} else if (entry) {
											// entry exists; either disable or remove. Removing keeps payload clean.
											removeEntry(d.dow);
										}
									}}
									onChange={(patch) => updateEntry(d.dow, patch)}
								/>
							);
						})}
					</div>
				)}

				{/* footer: save + status */}
				<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
					<div className="text-xs text-[var(--sea-ink-soft)]">
						{dirty ? (
							<span className="font-semibold text-amber-700">
								{c.planUnsaved}
							</span>
						) : (
							<span>{c.planNoChanges}</span>
						)}
						{hasDuplicateDow && (
							<span className="ml-2 font-semibold text-red-600">
								{c.planDuplicateDay}
							</span>
						)}
					</div>
					<div className="flex items-center gap-3">
						{feedback && (
							<span
								className={`text-xs font-semibold ${
									feedback.kind === "ok" ? "text-green-700" : "text-red-600"
								}`}
							>
								{feedback.msg}
							</span>
						)}
						<button
							type="button"
							onClick={handleSave}
							disabled={saving || !dirty || hasDuplicateDow}
							className="rounded-full bg-[var(--lagoon-deep)] px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0"
						>
							{saving ? c.saving : c.save}
						</button>
					</div>
				</div>

				<p className="mt-3 text-xs text-[var(--sea-ink-soft)]">
					{c.planMultiDayNote}
				</p>
			</div>

			{/* Next 7 sends preview */}
			<Next7Preview
				plan={plan}
				entries={entries}
				timezone={timezone}
				active={isActive}
			/>

			{/* Confirm delete dialog */}
			{confirmDelete &&
				createPortal(
					<div
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
						onClick={(e) => {
							if (e.target === e.currentTarget) setConfirmDelete(false);
						}}
					>
						<div className="island-shell rise-in w-full max-w-sm rounded-2xl p-6 text-center">
							<h3 className="display-title mb-2 text-lg font-bold text-[var(--sea-ink)]">
								{c.planDelete}
							</h3>
							<p className="mb-5 text-sm text-[var(--sea-ink-soft)]">
								{c.planDeleteConfirm}
							</p>
							<div className="flex justify-center gap-3">
								<button
									type="button"
									onClick={() => setConfirmDelete(false)}
									className={btnOutline}
								>
									{c.cancel}
								</button>
								<button
									type="button"
									disabled={deleting}
									onClick={handleDelete}
									className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-red-700 disabled:opacity-50"
								>
									{deleting ? c.planDeleting : c.planDelete}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
}

function DayRow({
	dow,
	shortLabel,
	longLabel,
	entry,
	enabled,
	onToggle,
	onChange,
}: {
	dow: number;
	shortLabel: string;
	longLabel: string;
	entry: PlanEntry | null;
	enabled: boolean;
	onToggle: (on: boolean) => void;
	onChange: (patch: Partial<PlanEntry>) => void;
}) {
	void dow; // dow is captured by parent
	const cat = entry?.notification_type ?? "daily_meal";
	return (
		<div
			className={`rounded-xl border px-3 py-3 transition ${
				enabled
					? "border-[var(--line)] bg-[var(--surface)]"
					: "border-dashed border-[var(--line)] bg-transparent opacity-70"
			}`}
		>
			<div className="grid items-center gap-2 md:grid-cols-[80px_92px_180px_1fr] md:gap-3">
				{/* Day toggle */}
				<label className="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						checked={enabled}
						onChange={(e) => onToggle(e.target.checked)}
						className="h-4 w-4 rounded border-[var(--line)] accent-[var(--lagoon)]"
					/>
					<span
						className="text-sm font-semibold text-[var(--sea-ink)]"
						title={longLabel}
					>
						{shortLabel}
					</span>
				</label>
				{/* Time */}
				<input
					type="time"
					step={300}
					disabled={!enabled}
					className={inputClass}
					value={entry ? trimTimeForInput(entry.send_time_local) : "11:30"}
					onChange={(e) => onChange({ send_time_local: e.target.value })}
					title={c.planTimeTooltip}
				/>
				{/* Category */}
				<select
					disabled={!enabled}
					className={inputClass}
					value={cat}
					onChange={(e) =>
						onChange({ notification_type: e.target.value as Category })
					}
				>
					{CATEGORIES.map((cat) => (
						<option key={cat.value} value={cat.value}>
							{cat.label}
						</option>
					))}
				</select>
				{/* Title (body below) */}
				<input
					type="text"
					disabled={!enabled}
					className={inputClass}
					placeholder={c.notifTitlePlaceholder}
					maxLength={100}
					value={entry?.title ?? ""}
					onChange={(e) => onChange({ title: e.target.value })}
				/>
			</div>
			{enabled && (
				<div className="mt-2 grid items-start gap-2 md:grid-cols-[80px_92px_180px_1fr] md:gap-3">
					<div />
					<div />
					<AudienceMiniChip category={cat} />
					<textarea
						className={`${inputClass} min-h-[56px] resize-y`}
						placeholder={c.notifBodyPlaceholder}
						maxLength={500}
						rows={2}
						value={entry?.body ?? ""}
						onChange={(e) => onChange({ body: e.target.value })}
					/>
				</div>
			)}
		</div>
	);
}

function AudienceMiniChip({ category }: { category: Category }) {
	const { data, loading } = useAudiencePreview(category);
	if (loading || !data) {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-2.5 py-1 text-[10px] font-semibold text-[var(--sea-ink-soft)]">
				<Users size={10} /> …
			</span>
		);
	}
	const empty = data.subscribed_count === 0;
	return (
		<span
			className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[10px] font-semibold ${
				empty
					? "border border-amber-200 bg-amber-50 text-amber-700"
					: "border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)]"
			}`}
			title={empty ? c.audienceEmptyHint : undefined}
		>
			<Users size={10} />
			{data.subscribed_count.toLocaleString("sl-SI")}
		</span>
	);
}

function Next7Preview({
	plan,
	entries,
	timezone,
	active,
}: {
	plan: NotificationPlan;
	entries: PlanEntry[];
	timezone: string;
	active: boolean;
}) {
	void plan;
	const upcoming = useMemo(() => {
		if (!active) return [] as Array<{ when: Date; entry: PlanEntry }>;
		const enabled = entries.filter((e) => e.is_active && e.title.trim());
		if (enabled.length === 0) return [];
		const now = nowInTz(timezone);
		const out: Array<{ when: Date; entry: PlanEntry }> = [];
		for (let offset = 0; offset < 7; offset++) {
			const dow = (now.dow + offset) % 7;
			const match = enabled.find((e) => e.day_of_week === dow);
			if (!match) continue;
			const time = trimTimeForInput(match.send_time_local);
			if (offset === 0 && time <= now.hm) continue; // past-due today
			// construct a Date for display only; exact UTC point is approximated for display purposes
			const display = new Date(now.date.getTime() + offset * 86400000);
			// store the display date with the planned local time for rendering only
			const [hh, mm] = time.split(":").map(Number);
			display.setHours(hh, mm, 0, 0);
			out.push({ when: display, entry: match });
		}
		return out;
	}, [entries, timezone, active]);

	return (
		<div className="island-shell rounded-2xl p-6">
			<h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--sea-ink)]">
				<CalendarClock size={16} className="text-[var(--lagoon)]" />
				{c.planNext7}
			</h3>
			{upcoming.length === 0 ? (
				<p className="text-sm text-[var(--sea-ink-soft)]">{c.planNext7Empty}</p>
			) : (
				<ul className="divide-y divide-[var(--line)]">
					{upcoming.map((u, i) => {
						const day = new Intl.DateTimeFormat("sl-SI", {
							timeZone: timezone,
							weekday: "short",
							day: "2-digit",
							month: "2-digit",
						}).format(u.when);
						const time = trimTimeForInput(u.entry.send_time_local);
						return (
							<li
								key={`${u.entry.day_of_week}-${i}`}
								className="flex items-center gap-3 py-2 text-sm"
							>
								<span className="w-32 shrink-0 text-xs font-semibold text-[var(--sea-ink)]">
									{day} {time}
								</span>
								<span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sea-ink-soft)]">
									{TYPE_LABELS[u.entry.notification_type]}
								</span>
								<span className="flex-1 truncate text-[var(--sea-ink)]">
									{u.entry.title}
								</span>
							</li>
						);
					})}
				</ul>
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
	const [attach, setAttach] = useState(false);
	const [couponId, setCouponId] = useState<string | null>(null);
	const [coupon, setCoupon] = useState<CouponSummary | null>(null);

	const [coupons, setCoupons] = useState<CouponListItem[]>([]);
	const [couponsLoading, setCouponsLoading] = useState(true);

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [makingBirthdayOnly, setMakingBirthdayOnly] = useState(false);

	useEffect(() => {
		api
			.get<Envelope<BirthdayTemplate>>(
				"/api/shop-admin/notifications/birthday-template",
			)
			.then((res) => {
				const d = res.data;
				setTitle(d.title || "");
				setBody(d.body || "");
				setIsActive(d.is_active);
				setCouponId(d.coupon_id ?? null);
				setCoupon(d.coupon ?? null);
				setAttach(!!d.coupon_id);
			})
			.catch(() => setError(c.loadError))
			.finally(() => setLoading(false));

		api
			.get<{ success: boolean; data: CouponListItem[] }>(
				"/api/shop-admin/coupons",
			)
			.then((res) => setCoupons(res.data))
			.catch(() => setCoupons([]))
			.finally(() => setCouponsLoading(false));
	}, []);

	// sort coupons: birthday-only first
	const sortedCoupons = useMemo(() => {
		return [...coupons].sort((a, b) => {
			const ab = a.is_birthday_only ? 1 : 0;
			const bb = b.is_birthday_only ? 1 : 0;
			return bb - ab;
		});
	}, [coupons]);

	const selectedCoupon = useMemo(() => {
		return coupons.find((co) => co.id === couponId) ?? coupon;
	}, [coupons, couponId, coupon]);

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setFeedback(null);
		setError(null);
		try {
			const payload: Record<string, unknown> = {
				title,
				body,
				is_active: isActive,
				coupon_id: attach ? couponId : null,
			};
			const res = await api.post<Envelope<BirthdayTemplate>>(
				"/api/shop-admin/notifications/birthday-template",
				payload,
			);
			setCoupon(res.data.coupon ?? null);
			setFeedback(c.saveSuccess);
		} catch {
			setError(c.saveError);
		} finally {
			setSaving(false);
		}
	}

	async function handleMakeBirthdayOnly() {
		if (!selectedCoupon) return;
		setMakingBirthdayOnly(true);
		try {
			await api.put(`/api/shop-admin/coupons/${selectedCoupon.id}`, {
				is_birthday_only: true,
			});
			// refresh local list
			setCoupons((prev) =>
				prev.map((co) =>
					co.id === selectedCoupon.id ? { ...co, is_birthday_only: true } : co,
				),
			);
			setCoupon((prev) =>
				prev && prev.id === selectedCoupon.id
					? { ...prev, is_birthday_only: true }
					: prev,
			);
		} catch {
			setError(c.saveError);
		} finally {
			setMakingBirthdayOnly(false);
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

	const couponTypeLabel =
		selectedCoupon?.type === "fixed"
			? t.shop.coupons.fixed
			: t.shop.coupons.percentage;

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
			<form onSubmit={handleSave} className="island-shell rounded-2xl p-6">
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
							maxLength={100}
						/>
					</div>
					<div>
						<label className={labelClass}>{c.birthdayBody}</label>
						<textarea
							className={`${inputClass} min-h-[100px] resize-y`}
							value={body}
							onChange={(e) => setBody(e.target.value)}
							rows={4}
							maxLength={500}
						/>
					</div>

					{/* Coupon attachment */}
					<div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
						<label className="flex cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								checked={attach}
								onChange={(e) => {
									setAttach(e.target.checked);
									if (!e.target.checked) setCouponId(null);
								}}
								className="h-4 w-4 rounded border-[var(--line)] accent-[var(--lagoon)]"
							/>
							<span className="text-sm font-medium text-[var(--sea-ink)]">
								{c.attachCoupon}
							</span>
						</label>

						{attach && (
							<div className="mt-3 space-y-2">
								{couponsLoading ? (
									<div className="skeleton h-10 w-full rounded-lg" />
								) : coupons.length === 0 ? (
									<p className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 text-xs text-[var(--sea-ink-soft)]">
										{c.noCoupons}
									</p>
								) : (
									<select
										className={inputClass}
										value={couponId ?? ""}
										onChange={(e) => setCouponId(e.target.value || null)}
										required={attach}
									>
										<option value="">{c.pickCoupon}</option>
										{sortedCoupons.map((co) => (
											<option key={co.id} value={co.id}>
												{co.is_birthday_only ? "🎂 " : ""}
												{co.name || co.code}
												{co.is_birthday_only
													? ` — ${c.couponBirthdayOnlyLabel}`
													: ""}
											</option>
										))}
									</select>
								)}

								{selectedCoupon && (
									<p className="text-xs text-[var(--sea-ink-soft)]">
										{c.couponSummary
											.replace(
												"{name}",
												selectedCoupon.name || selectedCoupon.id,
											)
											.replace("{type}", couponTypeLabel)
											.replace(
												"{birthday}",
												selectedCoupon.is_birthday_only
													? ` · ${t.shop.coupons.birthdayOnlyPill}`
													: "",
											)}
									</p>
								)}

								{selectedCoupon && !selectedCoupon.is_birthday_only && (
									<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
										<p>{c.couponNotBirthdayOnlyWarn}</p>
										<button
											type="button"
											disabled={makingBirthdayOnly}
											onClick={handleMakeBirthdayOnly}
											className="mt-1 font-semibold text-amber-900 underline-offset-2 hover:underline"
										>
											{makingBirthdayOnly ? "..." : c.makeBirthdayOnly}
										</button>
									</div>
								)}
							</div>
						)}
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

					<button type="submit" disabled={saving} className={btnPrimary}>
						{saving ? c.saving : c.save}
					</button>
				</div>
			</form>

			{/* Right side info + preview */}
			<div className="space-y-4">
				<div className="island-shell rounded-2xl p-5 text-xs text-[var(--sea-ink-soft)]">
					<p>{c.birthdayInfoLine1}</p>
					<p className="mt-1">{c.birthdayInfoLine2}</p>
					<p className="mt-1">{c.birthdayInfoLine3}</p>
					<p className="mt-3 rounded-lg bg-[var(--surface)] px-3 py-2 text-[var(--sea-ink)]">
						{c.birthdayProTip}
					</p>
				</div>

				{/* Mobile preview */}
				<div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 shadow-lg">
					<div className="mb-2 flex items-center gap-2">
						<div className="h-8 w-8 rounded-lg bg-[var(--lagoon)] p-1.5">
							<Cake size={18} className="text-white" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-bold text-[var(--sea-ink)]">
								{title || c.notifTitlePlaceholder}
							</p>
							<p className="text-[10px] text-[var(--sea-ink-soft)]">9:00</p>
						</div>
					</div>
					<p className="text-sm text-[var(--sea-ink-soft)]">
						{body || c.notifBodyPlaceholder}
					</p>
					{attach && selectedCoupon && (
						<p className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--sea-ink)]">
							{c.couponPreviewLine.replace(
								"{label}",
								selectedCoupon.name || couponTypeLabel,
							)}
						</p>
					)}
				</div>
			</div>
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
	const [typeFilter, setTypeFilter] = useState<NotificationType | "">("");
	const [statusFilter, setStatusFilter] = useState<NotificationStatus | "">("");
	const limit = 25;

	const fetchHistory = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams();
			params.set("page", String(page));
			params.set("limit", String(limit));
			if (typeFilter) params.set("type", typeFilter);
			if (statusFilter) params.set("status", statusFilter);
			const res = await api.get<Envelope<HistoryData>>(
				`/api/shop-admin/notifications/history?${params}`,
			);
			setNotifications(res.data.notifications);
			setTotal(res.data.total);
		} catch {
			setError(c.loadError);
		} finally {
			setLoading(false);
		}
	}, [page, typeFilter, statusFilter]);

	useEffect(() => {
		fetchHistory();
	}, [fetchHistory]);

	const totalPages = Math.ceil(total / limit);

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<select
					className={`${inputClass} max-w-[200px]`}
					value={typeFilter}
					onChange={(e) => {
						setTypeFilter(e.target.value as NotificationType | "");
						setPage(1);
					}}
				>
					<option value="">{c.filterAllTypes}</option>
					<option value="manual">{c.typeManual}</option>
					<option value="daily_meal">{c.typeDailyMeal}</option>
					<option value="specials">{c.typeSpecials}</option>
					<option value="birthday">{c.typeBirthday}</option>
					<option value="points_earned">{c.typePointsEarned}</option>
					<option value="coupon_ready">{c.typeCouponReady}</option>
				</select>
				<select
					className={`${inputClass} max-w-[200px]`}
					value={statusFilter}
					onChange={(e) => {
						setStatusFilter(e.target.value as NotificationStatus | "");
						setPage(1);
					}}
				>
					<option value="">{c.filterAllStatuses}</option>
					<option value="pending">{c.statusPending}</option>
					<option value="sent">{c.statusSent}</option>
					<option value="delivered">{c.statusDelivered}</option>
					<option value="failed">{c.statusFailed}</option>
					<option value="error">{c.statusError}</option>
					<option value="dry_run">{c.statusDryRun}</option>
				</select>
			</div>

			<div className="island-shell overflow-hidden rounded-2xl">
				{loading ? (
					<div className="p-6">
						{Array.from({ length: 5 }).map((_, i) => (
							<div key={i} className="skeleton mb-3 h-12 w-full rounded-lg" />
						))}
					</div>
				) : error ? (
					<p className="m-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
						{error}
					</p>
				) : notifications.length === 0 ? (
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
													{TYPE_LABELS[n.notification_type] ??
														n.notification_type}
												</span>
											</td>
											<td className="max-w-[250px] truncate px-4 py-3 font-medium text-[var(--sea-ink)]">
												{n.title}
											</td>
											<td className="px-4 py-3">
												<span
													className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${sc.color}`}
													title={
														n.status === "dry_run"
															? c.dryRunBadgeTooltip
															: undefined
													}
												>
													<Icon size={12} />
													{sc.label}
												</span>
											</td>
											<td className="hidden px-4 py-3 text-[var(--sea-ink-soft)] md:table-cell">
												{formatDateTime(n.sent_at ?? n.created_at)}
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
		</div>
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
			.get<Envelope<AnalyticsData>>("/api/shop-admin/notifications/analytics")
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

	const subscribers = data.subscriber_count_by_category || {};
	const subscriberRows: Array<{ key: string; label: string; count: number }> = [
		{
			key: "daily_meal",
			label: c.typeDailyMeal,
			count: subscribers.daily_meal ?? 0,
		},
		{
			key: "specials",
			label: c.typeSpecials,
			count: subscribers.specials ?? 0,
		},
		{
			key: "birthday",
			label: c.typeBirthday,
			count: subscribers.birthday ?? 0,
		},
		{ key: "manual", label: c.typeManual, count: subscribers.manual ?? 0 },
	];
	const maxSub = Math.max(1, ...subscriberRows.map((r) => r.count));

	const sortedTypes = Object.entries(data.by_type).sort((a, b) => b[1] - a[1]);

	return (
		<div className="space-y-6">
			{/* Subscribers card */}
			<div className="island-shell rounded-2xl p-5">
				<div className="mb-4 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 text-[var(--sea-ink-soft)]">
						<Users size={16} />
						<span className="text-xs font-semibold uppercase tracking-wider">
							{c.subscribersTitle}
						</span>
					</div>
					<p className="text-2xl font-bold text-[var(--sea-ink)]">
						{data.subscriber_count.toLocaleString("sl-SI")}
					</p>
				</div>
				<p className="mb-3 text-xs text-[var(--sea-ink-soft)]">
					{c.subscribersTotal.replace(
						"{count}",
						data.subscriber_count.toLocaleString("sl-SI"),
					)}
				</p>
				<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
					{c.subscribersByCategory}
				</p>
				<div className="space-y-2">
					{subscriberRows.map((row) => {
						const pct = (row.count / maxSub) * 100;
						return (
							<div key={row.key}>
								<div className="flex items-center justify-between text-xs">
									<span className="font-medium text-[var(--sea-ink)]">
										{row.label}
									</span>
									<span className="text-[var(--sea-ink-soft)]">
										{row.count.toLocaleString("sl-SI")}
									</span>
								</div>
								<div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
									<div
										className="h-full rounded-full bg-[var(--lagoon)]"
										style={{ width: `${pct}%` }}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</div>

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
						{sortedTypes.map(([type, count]) => {
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

			{/* Per-category delivery rate table */}
			<div className="island-shell rounded-2xl p-5">
				<h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--sea-ink)]">
					<BarChart3 size={16} className="text-[var(--lagoon)]" />
					{c.perCategoryRate}
				</h3>
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b border-[var(--line)] text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
							<th className="py-2">{c.type}</th>
							<th className="py-2 text-right">{c.totalSent}</th>
							<th className="py-2 text-right">{c.deliveryRate}</th>
						</tr>
					</thead>
					<tbody>
						{sortedTypes.map(([type, count]) => {
							const rate = data.delivery_rate_by_type[type];
							return (
								<tr
									key={type}
									className="border-b border-[var(--line)] last:border-0"
								>
									<td className="py-2 text-[var(--sea-ink)]">
										{TYPE_LABELS[type as NotificationType] ?? type}
									</td>
									<td className="py-2 text-right text-[var(--sea-ink)]">
										{count.toLocaleString("sl-SI")}
									</td>
									<td className="py-2 text-right text-[var(--sea-ink)]">
										{rate != null ? `${rate.toFixed(1)}%` : "—"}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{data.total_dry_run > 0 && (
				<p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
					{c.analyticsDryRunNotice.replace(
						"{count}",
						data.total_dry_run.toLocaleString("sl-SI"),
					)}
				</p>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Test tab — direct send to a single token or user                  */
/* ------------------------------------------------------------------ */

function TestTab() {
	const [targetType, setTargetType] = useState<"token" | "email">("token");
	const [identifier, setIdentifier] = useState("");
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<TestSendResult | null>(null);

	const canSubmit =
		!sending &&
		identifier.trim().length > 0 &&
		title.trim().length > 0 &&
		body.trim().length > 0;

	const handleSubmit = async () => {
		setError(null);
		setResult(null);
		if (!identifier.trim()) {
			setError(c.testNeedIdentifier);
			return;
		}
		setSending(true);
		try {
			const payload: Record<string, unknown> = {
				title: title.trim(),
				body: body.trim(),
			};
			if (targetType === "token") {
				payload.expo_push_token = identifier.trim();
			} else {
				payload.email = identifier.trim();
			}
			const res = await api.post<Envelope<TestSendResult>>(
				"/api/shop-admin/notifications/test-send",
				payload,
			);
			setResult(res.data);
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.status === 404) {
					setError(
						targetType === "email" ? c.testUserNotFound : c.testNoTokens,
					);
				} else {
					const msg = (err.body as { message?: string } | undefined)?.message;
					setError(msg || c.sendError);
				}
			} else {
				setError(c.sendError);
			}
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="space-y-5">
			<div>
				<h2 className="text-lg font-semibold text-[var(--sea-ink)]">
					{c.testTitle}
				</h2>
				<p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
					{c.testSubtitle}
				</p>
			</div>

			<div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-4">
				<div>
					<label className={labelClass}>{c.testTargetType}</label>
					<div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] p-0.5">
						{(
							[
								["token", c.testTargetToken],
								["email", c.testTargetEmail],
							] as const
						).map(([key, label]) => (
							<button
								key={key}
								type="button"
								onClick={() => {
									setTargetType(key);
									setIdentifier("");
									setError(null);
									setResult(null);
								}}
								className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
									targetType === key
										? "bg-[var(--lagoon-deep)] text-white shadow-sm"
										: "text-[var(--sea-ink-soft)] hover:text-[var(--sea-ink)]"
								}`}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				<div>
					<label className={labelClass}>{c.testIdentifierLabel}</label>
					<input
						type="text"
						value={identifier}
						onChange={(e) => setIdentifier(e.target.value)}
						placeholder={
							targetType === "token"
								? c.testTokenPlaceholder
								: c.testEmailPlaceholder
						}
						className={inputClass}
						autoComplete="off"
						spellCheck={false}
					/>
				</div>

				<div>
					<label className={labelClass}>{c.notifTitle}</label>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder={c.notifTitlePlaceholder}
						maxLength={100}
						className={inputClass}
					/>
				</div>

				<div>
					<label className={labelClass}>{c.notifBody}</label>
					<textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						placeholder={c.notifBodyPlaceholder}
						maxLength={500}
						rows={3}
						className={`${inputClass} resize-none`}
					/>
				</div>

				{error && (
					<div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						<AlertCircle size={16} className="mt-0.5 shrink-0" />
						<span>{error}</span>
					</div>
				)}

				<div className="flex justify-end">
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!canSubmit}
						className={btnPrimary}
					>
						{sending ? c.testSendingBtn : c.testSendBtn}
					</button>
				</div>
			</div>

			{result && (
				<div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
					<h3 className="text-sm font-semibold text-[var(--sea-ink)]">
						{c.testResultHeader}
					</h3>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<Stat label={c.testAttempted} value={result.attempted} />
						<Stat label={c.sent} value={result.sent} tone="ok" />
						<Stat label={c.failed} value={result.failed} tone="err" />
						<Stat label={c.dryRunBadge} value={result.dry_run} tone="warn" />
					</div>

					{result.tickets.length > 0 && (
						<div>
							<p className={labelClass}>{c.testTicketsHeader}</p>
							<ul className="space-y-1.5 text-xs">
								{result.tickets.map((ticket, i) => (
									<li
										key={`${ticket.token}-${i}`}
										className="flex items-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2 font-mono"
									>
										<TicketStatusIcon status={ticket.status} />
										<div className="min-w-0 flex-1">
											<p className="truncate text-[var(--sea-ink-soft)]">
												{ticket.token}
											</p>
											{ticket.error && (
												<p className="mt-0.5 text-red-600">{ticket.error}</p>
											)}
										</div>
										<span className="shrink-0 text-[var(--sea-ink-soft)]">
											{ticket.status}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function Stat({
	label,
	value,
	tone,
}: {
	label: string;
	value: number;
	tone?: "ok" | "err" | "warn";
}) {
	const colorClass =
		tone === "ok"
			? "text-green-700"
			: tone === "err"
				? "text-red-600"
				: tone === "warn"
					? "text-amber-700"
					: "text-[var(--sea-ink)]";
	return (
		<div className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-3 py-2">
			<p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]">
				{label}
			</p>
			<p className={`mt-0.5 text-lg font-bold ${colorClass}`}>{value}</p>
		</div>
	);
}

function TicketStatusIcon({ status }: { status: string }) {
	if (status === "sent") {
		return <CheckCircle size={14} className="mt-0.5 shrink-0 text-green-600" />;
	}
	if (status === "dry_run") {
		return (
			<AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
		);
	}
	return <XCircle size={14} className="mt-0.5 shrink-0 text-red-600" />;
}
