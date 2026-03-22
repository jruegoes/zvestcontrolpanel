import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "#/store/auth";
import { t } from "#/i18n";
import ThemeToggle from "#/components/ThemeToggle";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Prijava — Zvest" }],
  }),
});

function LoginPage() {
  const { signIn, user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await signIn(email, password);

    setSubmitting(false);

    if (error) {
      setError(error);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--line)] p-6 sm:p-8">
          <div className="skeleton mb-4 h-7 w-32" />
          <div className="skeleton mb-6 h-4 w-56" />
          <div className="flex flex-col gap-4">
            <div>
              <div className="skeleton mb-2 h-3 w-16" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
            <div>
              <div className="skeleton mb-2 h-3 w-12" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
            <div className="skeleton h-10 w-full rounded-full" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="island-shell rise-in w-full max-w-md rounded-2xl p-6 sm:p-8">
        <h1 className="display-title mb-2 text-xl font-bold text-[var(--sea-ink)] sm:text-2xl">
          {t.login.title}
        </h1>
        <p className="mb-5 text-sm text-[var(--sea-ink-soft)] sm:mb-6">
          {t.login.subtitle}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]"
            >
              {t.login.email}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)]"
              placeholder="vi@primer.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)]"
            >
              {t.login.password}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none transition focus:border-[var(--lagoon)]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--lagoon)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {submitting ? t.login.loading : t.login.signIn}
          </button>
        </form>


      </div>
      <div className="fixed bottom-4 right-4 z-50">
        <ThemeToggle />
      </div>
    </main>
  );
}
