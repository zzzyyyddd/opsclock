import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  demoEventKey,
  demoSessionKey,
  getDemoSessionId,
} from "@/lib/demo-session";
import type { OpsEvent } from "@/lib/ops-events";
import { getOpsStatus } from "@/src/lib/sla";

export async function GET() {
  try {
    const sessionId = await getDemoSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { error: "demo_session_required" },
        { status: 401 }
      );
    }

    const redis = getRedis();

    const active = await redis.exists(demoSessionKey(sessionId));

    if (!active) {
      return NextResponse.json(
        { error: "demo_session_expired" },
        { status: 401 }
      );
    }

    const event = await redis.get<OpsEvent>(
      demoEventKey(sessionId)
    );

    return NextResponse.json(
      {
        event: event
          ? {
              ...event,
              status: getOpsStatus(
                event.arrivalAt,
                event.acknowledgedAt
              ),
            }
          : null,
        serverTime: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    console.error("Failed to load demo status");

    return NextResponse.json(
      { error: "demo_status_unavailable" },
      { status: 503 }
    );
  }
}
