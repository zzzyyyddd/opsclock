export const SLA_LIMIT_MINUTES = 10;
export const SLA_WARNING_MINUTES = 8;

export type OpsStatus =
  | "IDLE"
  | "AWAITING_RESPONSE"
  | "AT_RISK"
  | "SLA_MET"
  | "SLA_BREACHED";

export function getOpsStatus(
  arrivalAt: number | null,
  acknowledgedAt: number | null,
  now = Date.now()
): OpsStatus {
  if (!arrivalAt) return "IDLE";

  const elapsedMs = (acknowledgedAt ?? now) - arrivalAt;
  const elapsedMinutes = elapsedMs / 60_000;

  if (acknowledgedAt) {
    return elapsedMinutes <= SLA_LIMIT_MINUTES
      ? "SLA_MET"
      : "SLA_BREACHED";
  }

  if (elapsedMinutes >= SLA_LIMIT_MINUTES) return "SLA_BREACHED";
  if (elapsedMinutes >= SLA_WARNING_MINUTES) return "AT_RISK";

  return "AWAITING_RESPONSE";
}

export function getElapsedSeconds(
  arrivalAt: number,
  endAt = Date.now()
) {
  return Math.max(0, Math.floor((endAt - arrivalAt) / 1000));
}
