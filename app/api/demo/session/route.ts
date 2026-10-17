import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  DEMO_COOKIE,
  demoSessionKey,
  getDemoSessionId,
} from "@/lib/demo-session";

const SESSION_TTL_SECONDS = 60 * 60 * 24;

export async function POST() {
  try {
    const existingId = await getDemoSessionId();

    if (existingId) {
      const active = await getRedis().exists(demoSessionKey(existingId));

      if (active) {
        return NextResponse.json({ ready: true });
      }
    }

    const sessionId = randomUUID();

    await getRedis().set(
      demoSessionKey(sessionId),
      "active",
      { ex: SESSION_TTL_SECONDS }
    );

    const response = NextResponse.json({ ready: true });

    response.cookies.set(DEMO_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  } catch {
    console.error("Failed to create demo session");

    return NextResponse.json(
      { error: "demo_session_unavailable" },
      { status: 503 }
    );
  }
}
