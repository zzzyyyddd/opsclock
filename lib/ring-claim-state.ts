import { getRedis } from "@/lib/redis";

export type RingClaimState = {
  stage: "uncertain" | "awaiting" | "patch_uncertain" | "completed";
  nonceHash: string;
  updatedAt: number;
};

function claimKey(accountId: string): string {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(accountId)) {
    throw new Error("Invalid Ring account ID");
  }

  return `opsclock:ring:claim-state:${accountId}`;
}

export async function getRingClaimState(
  accountId: string
): Promise<RingClaimState | null> {
  return getRedis().get<RingClaimState>(claimKey(accountId));
}

export async function saveRingClaimState(
  accountId: string,
  state: RingClaimState
): Promise<void> {
  await getRedis().set(claimKey(accountId), state);
}
