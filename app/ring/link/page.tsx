"use client";

import { useEffect, useState } from "react";

export default function RingLinkPage() {
  const [nonce, setNonce] = useState("");
  const [time, setTime] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [linked, setLinked] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setNonce(params.get("nonce") ?? "");
    setTime(params.get("time") ?? "");
  }, []);

  async function handleClaim() {
    if (!nonce || !time || claiming) return;

    setClaiming(true);
    setClaimMessage("");

    try {
      const response = await fetch("/api/ring/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ nonce, time }),
      });

      const result = await response.json();

      if (response.ok && result.linked === true) {
        setLinked(true);
        setClaimMessage("Ring account successfully linked.");
      } else {
        setClaimMessage(
          result.reason ??
          result.error ??
          "Ring linking could not be completed."
        );
      }
    } catch {
      setClaimMessage("Connection failed. Please try again later.");
    } finally {
      setClaiming(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/operator/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many attempts. Please try again later."
            : "Login failed. Check your password."
        );
        return;
      }

      setPassword("");
      setAuthenticated(true);
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <div className="mb-6 text-sm font-semibold tracking-widest text-cyan-400">
          OPSCLOCK
        </div>

        <h1 className="text-2xl font-bold">
          Connect your Ring account
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          Sign in to OpsClock to continue linking your Ring account.
        </p>

        {!nonce || !time ? (
          <p className="mt-6 rounded-lg border border-amber-700 bg-amber-950 p-4 text-sm text-amber-200">
            Missing Ring linking parameters. Start account linking
            from the Ring app.
          </p>
        ) : authenticated ? (
          <div className="mt-6 rounded-lg border border-cyan-800 bg-cyan-950 p-4">
            <p className="font-semibold text-cyan-200">
              Operator login successful
            </p>
            {linked ? (
              <p className="mt-2 text-sm text-cyan-200">
                Ring confirmed integration status: completed.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-300">
                  Authentication successful. Complete the Ring
                  verification to finish account linking.
                </p>

                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  className="mt-5 w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                >
                  {claiming
                    ? "Connecting Ring..."
                    : "Complete Ring Linking"}
                </button>
              </>
            )}

            {claimMessage && (
              <p role="status" className="mt-4 text-sm text-slate-300">
                {claimMessage}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-sm text-slate-300"
              >
                Operator password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in to OpsClock"}
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-slate-500">
          Secure Ring account linking · OpsClock
        </p>
      </div>
    </main>
  );
}
