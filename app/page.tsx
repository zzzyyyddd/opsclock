"use client";

import { useEffect, useState } from "react";
import {
  getElapsedSeconds,
  getOpsStatus,
  SLA_LIMIT_MINUTES,
} from "@/src/lib/sla";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function Home() {
  const [arrivalAt, setArrivalAt] = useState<number | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const status = getOpsStatus(arrivalAt, acknowledgedAt, now);

  const elapsed =
    arrivalAt !== null
      ? getElapsedSeconds(arrivalAt, acknowledgedAt ?? now)
      : 0;

  function simulateVehicleArrival() {
    setArrivalAt(Date.now());
    setAcknowledgedAt(null);
  }

  function acknowledgeDelivery() {
    if (!arrivalAt || acknowledgedAt) return;
    setAcknowledgedAt(Date.now());
  }

  function resetDock() {
    setArrivalAt(null);
    setAcknowledgedAt(null);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-12 flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">OpsClock</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Physical operations observability powered by Ring
            </p>
          </div>

          <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
            RING CONNECTED
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <div className="mb-10 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                  Loading Dock
                </p>
                <h2 className="mt-2 text-3xl font-semibold">Dock A</h2>
              </div>

              <div className="rounded-lg border border-zinc-700 px-4 py-2 text-sm">
                {status.replaceAll("_", " ")}
              </div>
            </div>

            <div className="py-8 text-center">
              <p className="mb-3 text-sm text-zinc-500">Response time</p>
              <div className="font-mono text-7xl font-semibold tracking-tight">
                {formatDuration(elapsed)}
              </div>
              <p className="mt-4 text-sm text-zinc-500">
                Target SLA: acknowledge within {SLA_LIMIT_MINUTES} minutes
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <button
                onClick={acknowledgeDelivery}
                disabled={!arrivalAt || acknowledgedAt !== null}
                className="rounded-xl bg-white px-5 py-4 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Acknowledge Delivery
              </button>

              <button
                onClick={resetDock}
                className="rounded-xl border border-zinc-700 px-5 py-4 font-medium transition hover:bg-zinc-800"
              >
                Reset Dock
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Live Event
              </p>

              <div className="mt-6">
                {arrivalAt ? (
                  <>
                    <p className="font-medium">Vehicle arrival detected</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Source: Ring · {new Date(arrivalAt).toLocaleTimeString()}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Waiting for Ring activity...
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Development Harness
              </p>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Inject a vehicle event while the Ring integration is being connected.
              </p>

              <button
                onClick={simulateVehicleArrival}
                className="mt-5 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-medium transition hover:bg-zinc-800"
              >
                Simulate Ring Vehicle
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
