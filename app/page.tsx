"use client";

import { useEffect, useState } from "react";
import {
  getElapsedSeconds,
  getOpsStatus,
  SLA_LIMIT_MINUTES,
} from "@/src/lib/sla";

type StoredOpsEvent = {
  id: string;
  source: "ring" | "demo";
  kind: "VEHICLE_ARRIVAL" | "ACTIVITY_DETECTED";
  arrivalAt: number;
  acknowledgedAt: number | null;
};

async function fetchLatestEvent(): Promise<StoredOpsEvent | null> {
  let response = await fetch("/api/demo/status", {
    cache: "no-store",
  });

  if (response.status === 401) {
    const session = await fetch("/api/demo/session", {
      method: "POST",
    });

    if (!session.ok) {
      throw new Error("Failed to initialize demo session");
    }

    response = await fetch("/api/demo/status", {
      cache: "no-store",
    });
  }

  if (!response.ok) {
    throw new Error("Failed to load demo status");
  }

  const result = await response.json();
  return result.event;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function Home() {
  const [arrivalAt, setArrivalAt] = useState<number | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [storedEvent, setStoredEvent] = useState<StoredOpsEvent | null>(null);
  const [storageState, setStorageState] = useState<
    "loading" | "connected" | "error"
  >("loading");

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const event = await fetchLatestEvent();

        if (active) {
          setStoredEvent(event);
          setStorageState("connected");
        }
      } catch {
        if (active) setStorageState("error");
      }
    }

    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeArrivalAt = storedEvent?.arrivalAt ?? arrivalAt;
  const activeAcknowledgedAt =
    storedEvent?.acknowledgedAt ?? acknowledgedAt;

  const status = getOpsStatus(
    activeArrivalAt,
    activeAcknowledgedAt,
    now
  );

  const elapsed =
    activeArrivalAt !== null
      ? getElapsedSeconds(
          activeArrivalAt,
          activeAcknowledgedAt ?? now
        )
      : 0;

  async function simulateVehicleArrival(
    scenario: "normal" | "at_risk" | "breached" = "normal"
  ) {
    try {
      const response = await fetch("/api/demo/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scenario }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Simulation failed");
      }

      const result = await response.json();
      setStoredEvent(result.event);
      setStorageState("connected");
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Simulation failed"
      );
    }
  }

  async function acknowledgeDelivery() {
    if (!storedEvent || storedEvent.acknowledgedAt !== null) return;

    try {
      const response = await fetch("/api/demo/acknowledge", {
        method: "POST",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Acknowledge failed");
      }

      const result = await response.json();
      setStoredEvent(result.event);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Acknowledge failed"
      );
    }
  }

  async function resetDock() {
    try {
      const response = await fetch("/api/demo/reset", {
        method: "POST",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Reset failed");
      }

      setStoredEvent(null);
      setArrivalAt(null);
      setAcknowledgedAt(null);
      setStorageState("connected");
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Reset failed"
      );
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-12 flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">OpsClock</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Software teams measure API latency. OpsClock measures physical latency.
            </p>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Track how quickly loading dock teams respond to vehicle arrivals,
              measure acknowledgment times, and identify SLA breaches.
            </p>
          </div>

          <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
            RING ACCOUNT LINKED · DEVICE NOT CONNECTED
          </div>
        </header>

        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-sm">
          <p className="font-medium">Persistent Operations Feed</p>
          <p className="mt-2 text-zinc-400">
            Storage: {storageState.toUpperCase()}
          </p>
          <p className="mt-1 text-zinc-400">
            {storageState === "error"
              ? "Unable to retrieve persistent event data"
              : storageState === "loading"
                ? "Loading events..."
                : storedEvent
                  ? `${storedEvent.source.toUpperCase()} EVENT · ${storedEvent.kind.replaceAll("_", " ")} · ${getOpsStatus(storedEvent.arrivalAt, storedEvent.acknowledgedAt, now).replaceAll("_", " ")}`
                  : "No persistent event recorded"}
          </p>
        </div>

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
                disabled={!storedEvent || storedEvent.acknowledgedAt !== null}
                className="rounded-xl bg-white px-5 py-4 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Acknowledge Delivery
              </button>

              <button
                onClick={resetDock}
                className="rounded-xl border border-zinc-700 px-5 py-4 font-medium transition hover:bg-zinc-800"
              >
                Reset Demo
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Live Event
              </p>

              <div className="mt-6">
                {storedEvent ? (
                  <>
                    <p className="font-medium">
                      {storedEvent.kind === "VEHICLE_ARRIVAL"
                        ? "Vehicle arrival recorded"
                        : "Activity detected"}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Source: {storedEvent.source === "demo"
                        ? "Demo simulation"
                        : "Ring event"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {new Date(storedEvent.arrivalAt).toLocaleString()}
                    </p>
                  </>
                ) : arrivalAt ? (
                  <>
                    <p className="font-medium">Local demo vehicle arrival</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Source: Local simulation
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">
                    No activity recorded
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
                Interactive Demo
              </p>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Test the full arrival-to-acknowledgment SLA workflow without Ring hardware.
              </p>

              <div className="mt-5 grid gap-3">
                <button
                  onClick={() => void simulateVehicleArrival("normal")}
                  className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-medium transition hover:bg-zinc-800"
                >
                  Normal Arrival · 0 min
                </button>

                <button
                  onClick={() => void simulateVehicleArrival("at_risk")}
                  className="rounded-xl border border-amber-700 px-4 py-3 text-sm font-medium text-amber-300 transition hover:bg-amber-950"
                >
                  At Risk · 9 min waiting
                </button>

                <button
                  onClick={() => void simulateVehicleArrival("breached")}
                  className="rounded-xl border border-red-800 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-950"
                >
                  SLA Breached · 11 min waiting
                </button>
              </div>

              <p className="mt-4 text-xs leading-5 text-zinc-500">
                Simulated timestamps for demonstration only.
                SLA calculations use the same 10-minute threshold.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
