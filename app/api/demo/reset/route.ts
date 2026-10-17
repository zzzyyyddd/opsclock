import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  demoEventKey,
  demoSessionKey,
  getDemoSessionId,
} from "@/lib/demo-session";
import type { OpsEvent } from "@/lib/ops-events";

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

    if (event && event.source !== "demo") {
      return NextResponse.json(
        { error: "cannot_reset_ring_event" },
        { status: 403 }
      );
    }

    await redis.del(key);

    return NextResponse.json({
      reset: true,
      event: null,
    });
  } catch {
    console.error("Failed to reset demo event");

    return NextResponse.json(
      { error: "demo_reset_unavailable" },
      { status: 503 }
    );
  }
}
