import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export async function GET() {
  try {
    const result = await getRedis().ping();

    return NextResponse.json({
      service: "OpsClock",
      database: "Upstash Redis",
      status: result === "PONG" ? "connected" : "unexpected_response",
    });
  } catch {
    return NextResponse.json(
      {
        service: "OpsClock",
        database: "Upstash Redis",
        status: "connection_failed",
      },
      { status: 503 }
    );
  }
}
