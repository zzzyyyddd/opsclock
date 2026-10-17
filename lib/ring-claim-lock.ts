import { randomUUID } from "node:crypto";
import { getRedis } from "@/lib/redis";

const LOCK_TTL_SECONDS = 60;

function lockKey(accountId: string): string {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(accountId)) {
    throw new Error("Invalid Ring account ID");
  }

  return `opsclock:ring:claim-lock:${accountId}`;
}

export async function acquireRingClaimLock(
  accountId: string
): Promise<string | null> {
  const token = randomUUID();

  const result = await getRedis().set(
    lockKey(accountId),
    token,
    { nx: true, ex: LOCK_TTL_SECONDS }
  );

  return result === "OK" ? token : null;
}

export async function releaseRingClaimLock(
  accountId: string,
  token: string
): Promise<void> {
  const redis = getRedis();
  const key = lockKey(accountId);

  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    end
    return 0
  `;

  await redis.eval(script, [key], [token]);
}
