import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  demoEventKey,
  demoSessionKey,
  getDemoSessionId,
} from "@/lib/demo-session";
import type { OpsEvent } from "@/lib/ops-events";
import { getOpsStatus } from "@/src/lib/sla";

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");

    if (origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "invalid_origin" },
        { status: 403 }
      );
    }

    const sessionId = await getDemoSessionId();

    if (!sessionId) {
      return NextResponse.json(
        { error: "demo_session_required" },
        { status: 401 }
      );
    }

    const redis = getRedis();

    if (!(await redis.exists(demoSessionKey(sessionId)))) {
      return NextResponse.json(
        { error: "demo_session_expired" },
        { status: 401 }
      );
    }

    const key = demoEventKey(sessionId);
    const event = await redis.get<OpsEvent>(key);

    if (!event) {
      return NextResponse.json(
        { error: "no_active_event" },
        { status: 404 }
      );
    }

    if (event.acknowledgedAt !== null) {
      return NextResponse.json(
        { error: "already_acknowledged" },
        { status: 409 }
      );
    }

    const updated: OpsEvent = {
      ...event,
      acknowledgedAt: Date.now(),
    };

    await redis.set(key, updated, { ex: 86400 });

    return NextResponse.json({
      event: {
        ...updated,
        status: getOpsStatus(
          updated.arrivalAt,
          updated.acknowledgedAt
        ),
      },
    });
  } catch {
    console.error("Failed to acknowledge demo event");

    return NextResponse.json(
      { error: "demo_acknowledge_unavailable" },
      { status: 503 }
    );
  }
}
