import { getRedis } from "@/lib/redis";
import { getOpsStatus } from "@/src/lib/sla";

export type OpsEventSource = "ring" | "demo";

export type OpsEvent = {
  id: string;
  source: OpsEventSource;
  accountId?: string;
  kind: "VEHICLE_ARRIVAL" | "ACTIVITY_DETECTED";
  arrivalAt: number;
  acknowledgedAt: number | null;
};

const EVENT_KEY = "opsclock:events:latest";
const EVENTS_INDEX = "opsclock:events:index";

function eventKey(id: string): string {
  return `opsclock:events:item:${encodeURIComponent(id)}`;
}

export async function getOpsEvent(
  id: string
): Promise<OpsEvent | null> {
  return getRedis().get<OpsEvent>(eventKey(id));
}

export async function getLatestOpsEvent(): Promise<OpsEvent | null> {
  return getRedis().get<OpsEvent>(EVENT_KEY);
}

export async function listOpsEvents(
  limit = 100
): Promise<OpsEvent[]> {
  const redis = getRedis();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  const ids = await redis.zrange<string[]>(
    EVENTS_INDEX,
    0,
    safeLimit - 1,
    { rev: true }
  );

  if (ids.length === 0) return [];

  const events = await Promise.all(
    ids.map((id) => getOpsEvent(id))
  );

  return events.filter(
    (event): event is OpsEvent => event !== null
  );
}

export async function createOpsEvent(
  event: Omit<OpsEvent, "acknowledgedAt">
): Promise<OpsEvent> {
  const redis = getRedis();

  const record: OpsEvent = {
    ...event,
    acknowledgedAt: null,
  };

  const script = `
    if redis.call('EXISTS', KEYS[1]) == 1 then
      return 0
    end

    redis.call('SET', KEYS[1], ARGV[1])
    redis.call('ZADD', KEYS[2], ARGV[2], ARGV[3])

    local latest = redis.call('GET', KEYS[3])
    if not latest then
      redis.call('SET', KEYS[3], ARGV[1])
    else
      local decoded = cjson.decode(latest)
      if tonumber(ARGV[2]) >= tonumber(decoded.arrivalAt) then
        redis.call('SET', KEYS[3], ARGV[1])
      end
    end

    return 1
  `;

  const created = await redis.eval(
    script,
    [eventKey(event.id), EVENTS_INDEX, EVENT_KEY],
    [JSON.stringify(record), event.arrivalAt, event.id]
  );

  if (created === 0) {
    const existing = await getOpsEvent(event.id);
    if (existing) return existing;

    throw new Error("Existing event could not be retrieved");
  }

  return record;
}

export async function acknowledgeOpsEvent(
  id?: string
): Promise<OpsEvent | null> {
  const redis = getRedis();

  const targetId = id ?? (await getLatestOpsEvent())?.id;
  if (!targetId) return null;

  const script = `
    local raw = redis.call('GET', KEYS[1])
    if not raw then
      return nil
    end

    local event = cjson.decode(raw)

    if event.acknowledgedAt == cjson.null then
      event.acknowledgedAt = tonumber(ARGV[1])
      local updated = cjson.encode(event)

      redis.call('SET', KEYS[1], updated)

      local latest = redis.call('GET', KEYS[2])
      if latest then
        local latestEvent = cjson.decode(latest)
        if latestEvent.id == event.id then
          redis.call('SET', KEYS[2], updated)
        end
      end

      return updated
    end

    return raw
  `;

  const result = await redis.eval(
    script,
    [eventKey(targetId), EVENT_KEY],
    [Date.now()]
  );

  if (result === null) return null;

  const parsed: unknown =
    typeof result === "string" ? JSON.parse(result) : result;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("id" in parsed) ||
    typeof parsed.id !== "string" ||
    !("acknowledgedAt" in parsed) ||
    typeof parsed.acknowledgedAt !== "number"
  ) {
    throw new Error("Unexpected acknowledge response");
  }

  return parsed as OpsEvent;
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
