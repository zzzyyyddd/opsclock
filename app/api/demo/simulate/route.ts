import { randomUUID } from "node:crypto";
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
    const expectedOrigin = new URL(request.url).origin;

    if (origin !== expectedOrigin) {
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
    const existing = await redis.get<OpsEvent>(key);

    if (existing && existing.acknowledgedAt === null) {
      return NextResponse.json(
        { error: "active_event_exists" },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const scenario = body?.scenario ?? "normal";

    if (!["normal", "at_risk", "breached"].includes(scenario)) {
      return NextResponse.json(
        { error: "invalid_demo_scenario" },
        { status: 400 }
      );
    }

    const simulatedWaitMinutes =
      scenario === "at_risk" ? 9 :
      scenario === "breached" ? 11 : 0;

    const event: OpsEvent = {
      id: randomUUID(),
      source: "demo",
      kind: "VEHICLE_ARRIVAL",
      arrivalAt: Date.now() - simulatedWaitMinutes * 60_000,
      acknowledgedAt: null,
    };

    await redis.set(key, event, { ex: 86400 });

    return NextResponse.json(
      { event },
      { status: 201 }
    );
  } catch {
    console.error("Failed to create demo event");

    return NextResponse.json(
      { error: "demo_event_unavailable" },
      { status: 503 }
    );
  }
}
