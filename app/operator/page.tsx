"use client";

import { useCallback, useEffect, useState } from "react";

type OpsEvent = {
  id: string;
  source: "ring" | "demo";
  accountId?: string;
  kind: string;
  arrivalAt: number;
  acknowledgedAt: number | null;
  status: string;
};

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export default function OperatorPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [event, setEvent] = useState<OpsEvent | null>(null);
  const [serverTime, setServerTime] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ops/status", {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (response.status === 401) {
        setAuthenticated(false);
        setEvent(null);
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load operator status");
      }

      const data = await response.json();
      setAuthenticated(true);
      setEvent(data.event ?? null);
      setServerTime(data.serverTime ?? Date.now());
      setError("");
    } catch {
      setError("Unable to load live status. Retrying...");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    setServerTime(Date.now());

    const interval = setInterval(() => {
      setServerTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/operator/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error("Login failed. Check your password.");
      }

      setPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge() {
    if (!event || event.acknowledgedAt !== null) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/ops/acknowledge", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });

      if (!response.ok) {
        throw new Error("Acknowledgement failed");
      }

      await refresh();
    } catch {
      setError("Could not acknowledge event. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  const elapsed = event
    ? formatDuration(
        (event.acknowledgedAt ?? serverTime) - event.arrivalAt
      )
    : null;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <a href="/" className="text-sm text-sky-400">
            ← Back to OpsClock
          </a>
          <h1 className="text-4xl font-bold">Operator Console</h1>
          <p className="text-slate-400">
            Ring vehicle arrivals · Response SLA · Live operations
          </p>
        </header>

        {error && (
          <div role="alert" className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        )}

        {authenticated === null && (
          <p className="text-slate-400">Checking operator session...</p>
        )}

        {authenticated === false && (
          <form
            onSubmit={login}
            className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-7"
          >
            <h2 className="text-xl font-semibold">Operator Login</h2>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white"
              />
            </label>
            <button
              disabled={busy}
              className="rounded-lg bg-sky-500 px-6 py-3 font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}

        {authenticated === true && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Latest Arrival</h2>
                <span className="text-xs text-slate-400">
                  Refreshes every 5 seconds
                </span>
              </div>

              {!event ? (
                <div className="mt-8 space-y-2">
                  <p className="text-2xl font-semibold">No arrivals yet</p>
                  <p className="text-slate-400">
                    Waiting for a verified Ring vehicle event.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="flex flex-wrap gap-3">
                    <span className="rounded-full bg-sky-950 px-3 py-1 text-sm text-sky-300">
                      {event.source === "ring" ? "RING EVENT" : "DEMO EVENT"}
                    </span>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-sm">
                      {event.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">Response time</p>
                    <p className="text-5xl font-bold tabular-nums">
                      {elapsed}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      Warning at 8m · SLA deadline at 10m
                    </p>
                  </div>

                  <dl className="grid gap-4 border-t border-slate-700 pt-5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">Detected</dt>
                      <dd>{formatTime(event.arrivalAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Acknowledged</dt>
                      <dd>
                        {event.acknowledgedAt
                          ? formatTime(event.acknowledgedAt)
                          : "Awaiting response"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Ring account</dt>
                      <dd className="break-all">
                        {event.accountId ?? "Not available"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Event ID</dt>
                      <dd className="break-all">{event.id}</dd>
                    </div>
                  </dl>

                  {event.acknowledgedAt === null && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={acknowledge}
                      className="w-full rounded-xl bg-emerald-400 px-6 py-4 text-lg font-bold text-slate-950 disabled:opacity-50"
                    >
                      {busy ? "Processing..." : "Acknowledge Arrival"}
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="text-sm text-slate-400">
              Live Ring arrivals require a linked account and a compatible
              device. The public simulation is available separately.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
