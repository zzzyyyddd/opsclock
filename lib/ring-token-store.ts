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
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(accountId)) {
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
