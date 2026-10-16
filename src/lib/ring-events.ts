export type RingHistoryEvent = {
  id?: string;
  type?: string;
  attributes?: {
    event_type?: string;
    sub_type?: string;
    start?: number;
    end?: number;
  };
};

export type NormalizedArrivalEvent = {
  id: string;
  source: "ring";
  kind: "VEHICLE_ARRIVAL";
  occurredAt: number;
  rawEventType: string;
  rawSubType?: string;
};

export function normalizeRingEvent(
  event: RingHistoryEvent
): NormalizedArrivalEvent | null {
  const attributes = event.attributes ?? {};

  const eventType = attributes.event_type?.toLowerCase();
  const subType = attributes.sub_type?.toLowerCase();

  const isVehicle =
    eventType === "motion.vehicle" ||
    (eventType === "motion" && subType === "vehicle");

  if (!isVehicle || !attributes.start) {
    return null;
  }

  return {
    id: event.id ?? `ring-${attributes.start}`,
    source: "ring",
    kind: "VEHICLE_ARRIVAL",
    occurredAt: attributes.start,
    rawEventType: eventType ?? "unknown",
    rawSubType: subType,
  };
}
