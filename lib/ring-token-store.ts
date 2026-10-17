import { getRedis } from "@/lib/redis";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

export type RingTokenRecord = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type StoredRingToken = {
  encrypted: string;
  savedAt: number;
};

function tokenKey(accountId: string): string {
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(accountId)) {
    throw new Error("Invalid account ID");
  }

  return `opsclock:ring:tokens:${accountId}`;
}

export async function saveRingTokens(
  accountId: string,
  tokens: RingTokenRecord
): Promise<void> {
  const encrypted = encryptSecret(JSON.stringify(tokens));

  const record: StoredRingToken = {
    encrypted,
    savedAt: Date.now(),
  };

  await getRedis().set(tokenKey(accountId), record);
}

export async function loadRingTokens(
  accountId: string
): Promise<RingTokenRecord | null> {
  const record = await getRedis().get<StoredRingToken>(
    tokenKey(accountId)
  );

  if (!record) return null;

  return JSON.parse(
    decryptSecret(record.encrypted)
  ) as RingTokenRecord;
}

const UNCLAIMED_RING_ACCOUNTS =
  "opsclock:ring:unclaimed-accounts";

export async function markRingAccountUnclaimed(
  accountId: string
): Promise<void> {
  tokenKey(accountId);

  await getRedis().sadd(
    UNCLAIMED_RING_ACCOUNTS,
    accountId
  );
}

export async function listUnclaimedRingAccounts(): Promise<string[]> {
  return getRedis().smembers(UNCLAIMED_RING_ACCOUNTS);
}

export async function markRingAccountClaimed(
  accountId: string
): Promise<void> {
  tokenKey(accountId);

  await getRedis().srem(
    UNCLAIMED_RING_ACCOUNTS,
    accountId
  );
}

export async function isRingAccountUnclaimed(
  accountId: string
): Promise<boolean> {
  tokenKey(accountId);

  const result = await getRedis().sismember(
    "opsclock:ring:unclaimed-accounts",
    accountId
  );

  return result === 1;
}
