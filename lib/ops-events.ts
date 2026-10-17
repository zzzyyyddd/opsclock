import { getRedis } from "@/lib/redis";
import { getOpsStatus } from "@/src/lib/sla";

export type OpsEventSource = "ring" | "demo";

export type OpsEvent = {
  id: string;
  source: OpsEventSource;
  kind: "VEHICLE_ARRIVAL" | "ACTIVITY_DETECTED";
  arrivalAt: number;
  acknowledgedAt: number | null;
};

const EVENT_KEY = "opsclock:events:latest";

export async function getLatestOpsEvent(): Promise<OpsEvent | null> {
  return getRedis().get<OpsEvent>(EVENT_KEY);
}

export async function createOpsEvent(
  event: Omit<OpsEvent, "acknowledgedAt">
): Promise<OpsEvent> {
  const record: OpsEvent = {
    ...event,
    acknowledgedAt: null,
  };

  await getRedis().set(EVENT_KEY, record);
  return record;
}

export async function acknowledgeOpsEvent(): Promise<OpsEvent | null> {
  const record = await getLatestOpsEvent();

  if (!record || record.acknowledgedAt !== null) {
    return record;
  }

  const updated: OpsEvent = {
    ...record,
    acknowledgedAt: Date.now(),
  };

  await getRedis().set(EVENT_KEY, updated);
  return updated;
}

export async function getOpsEventSummary() {
  const event = await getLatestOpsEvent();

  if (!event) return null;

  return {
    ...event,
    status: getOpsStatus(
      event.arrivalAt,
      event.acknowledgedAt
    ),
  };
}
