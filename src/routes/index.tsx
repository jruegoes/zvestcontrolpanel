import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "#/store/auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      navigate({ to: user ? "/dashboard" : "/login", replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-[var(--sea-ink-soft)]">Loading...</p>
    </main>
  );
}
