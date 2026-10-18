import { NextResponse } from "next/server";
import { verifyRingWebhookSignature } from "@/lib/ring-webhook-security";
import { saveRingActivity } from "@/lib/ring-activity";
import { getRingClaimState } from "@/lib/ring-claim-state";
import { createOpsEvent } from "@/lib/ops-events";

type RingWebhookPayload = {
  meta: {
    version: string;
    time: string;
    request_id: string;
    account_id: string;
  };
  data: {
    id: string;
    type: string;
    attributes: {
      source: string;
      source_type: string;
      timestamp: number | string;
      sub_type?: string;
    };
  };
};

function isRingWebhookPayload(
  value: unknown
): value is RingWebhookPayload {
  if (!value || typeof value !== "object") return false;

  const body = value as Record<string, unknown>;
  const meta = body.meta as Record<string, unknown> | undefined;
  const data = body.data as Record<string, unknown> | undefined;
  const attributes = data?.attributes as
    | Record<string, unknown>
    | undefined;

  return (
    !!meta &&
    typeof meta.version === "string" &&
    typeof meta.time === "string" &&
    typeof meta.request_id === "string" &&
    typeof meta.account_id === "string" &&
    /^[A-Za-z0-9._-]{1,128}$/.test(meta.account_id) &&
    !!data &&
    typeof data.id === "string" &&
    typeof data.type === "string" &&
    !!attributes &&
    typeof attributes.source === "string" &&
    typeof attributes.source_type === "string" &&
    (typeof attributes.timestamp === "string" ||
      typeof attributes.timestamp === "number") &&
    (attributes.sub_type === undefined ||
      typeof attributes.sub_type === "string")
  );
}

export type RingWebhookDependencies = {
  getClaim: typeof getRingClaimState;
  saveActivity: typeof saveRingActivity;
  createEvent: typeof createOpsEvent;
};

export async function handleRingWebhook(
  request: Request,
  deps: RingWebhookDependencies = {
    getClaim: getRingClaimState,
    saveActivity: saveRingActivity,
    createEvent: createOpsEvent,
  }
) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());

    if (
      !verifyRingWebhookSignature(
        rawBody,
        request.headers.get("x-signature")
      )
    ) {
      return NextResponse.json(
        { error: "invalid_signature" },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return NextResponse.json(
        { error: "invalid_json" },
        { status: 400 }
      );
    }

    if (!isRingWebhookPayload(body)) {
      return NextResponse.json(
        { error: "invalid_payload" },
        { status: 400 }
      );
    }

    const eventType = body.data.type;

    if (
      eventType !== "motion_detected" &&
      eventType !== "person_detected"
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason: "unsupported_event_type",
      });
    }

    const rawTimestamp = body.data.attributes.timestamp;
    const detectedAt =
      typeof rawTimestamp === "number"
        ? rawTimestamp
        : Date.parse(rawTimestamp);

    const now = Date.now();
    const maxPastAge = 24 * 60 * 60 * 1000;
    const maxFutureSkew = 5 * 60 * 1000;

    if (
      !Number.isFinite(detectedAt) ||
      detectedAt < now - maxPastAge ||
      detectedAt > now + maxFutureSkew
    ) {
      return NextResponse.json(
        { error: "invalid_timestamp" },
        { status: 400 }
      );
    }

    const claim = await deps.getClaim(body.meta.account_id);

    if (claim?.stage !== "completed") {
      return NextResponse.json(
        { error: "ring_account_not_linked" },
        { status: 403 }
      );
    }

    const isVehicle =
      eventType === "motion_detected" &&
      body.data.attributes.sub_type?.toLowerCase() === "vehicle";

    if (isVehicle) {
      await deps.createEvent({
        id: `ring:${body.meta.account_id}:${body.data.id}`,
        source: "ring",
        accountId: body.meta.account_id,
        kind: "VEHICLE_ARRIVAL",
        arrivalAt: detectedAt,
      });
    }

    const result = await deps.saveActivity({
      id: body.data.id,
      requestId: body.meta.request_id,
      eventType,
      subType: body.data.attributes.sub_type ?? null,
      deviceId: body.data.attributes.source,
      detectedAt,
      receivedAt: Date.now(),
    });

    return NextResponse.json({
      received: true,
      result,
      event_id: body.data.id,
      event_type: eventType,
    });
  } catch {
    console.error("Ring webhook processing failed");

    return NextResponse.json(
      { error: "webhook_unavailable" },
      { status: 503 }
    );
  }
}


export async function POST(request: Request) {
  return handleRingWebhook(request);
}
