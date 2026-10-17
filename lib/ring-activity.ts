import { getRedis } from "@/lib/redis";

export type RingActivity = {
  id: string;
  requestId: string;
  eventType: "motion_detected" | "person_detected";
  subType: string | null;
  deviceId: string;
  detectedAt: number;
  receivedAt: number;
};

const LATEST_KEY = "opsclock:ring:activity:latest";

export async function saveRingActivity(
  activity: RingActivity
): Promise<"saved" | "duplicate"> {
  const redis = getRedis();

  const dedupeKey =
    `opsclock:ring:processed:${activity.requestId}`;

  const first = await redis.set(
    dedupeKey,
    "1",
    { nx: true, ex: 86400 }
  );

  if (first !== "OK") {
    return "duplicate";
  }

  try {
    await redis.set(LATEST_KEY, activity);
    return "saved";
  } catch (error) {
    await redis.del(dedupeKey);
    throw error;
  }
}

export async function getLatestRingActivity():
  Promise<RingActivity | null> {
  return getRedis().get<RingActivity>(LATEST_KEY);
}
