import { createHmac, timingSafeEqual } from "node:crypto";
import {
  listUnclaimedRingAccounts,
  loadRingTokens,
} from "@/lib/ring-token-store";

const NONCE_WINDOW_MS = 600_000;

export function validateRingTimestamp(timeParam: string): boolean {
  if (!/^\d{13}$/.test(timeParam)) {
    return false;
  }

  const timestamp = Number(timeParam);

  if (!Number.isSafeInteger(timestamp)) {
    return false;
  }

  const age = Date.now() - timestamp;

  return age >= 0 && age <= NONCE_WINDOW_MS;
}

export function computeRingNonce(
  timeParam: string,
  accountId: string
): string {
  const signingKey = process.env.RING_HMAC_SIGNING_KEY;

  if (!signingKey) {
    throw new Error("Ring signing key not configured");
  }

  return createHmac("sha256", signingKey)
    .update(`${timeParam}:${accountId}`, "utf8")
    .digest("base64url");
}

function safeNonceEqual(
  expected: string,
  received: string
): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export async function matchRingNonce(
  nonce: string,
  timeParam: string
): Promise<string | null> {
  if (
    !validateRingTimestamp(timeParam) ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce)
  ) {
    return null;
  }

  const accountIds = await listUnclaimedRingAccounts();

  if (accountIds.length > 10) {
    throw new Error("Too many unclaimed Ring accounts");
  }

  for (const accountId of accountIds) {
    const tokens = await loadRingTokens(accountId);

    if (!tokens?.access_token) {
      continue;
    }

    const expected = computeRingNonce(timeParam, accountId);

    if (safeNonceEqual(expected, nonce)) {
      return accountId;
    }
  }

  return null;
}
