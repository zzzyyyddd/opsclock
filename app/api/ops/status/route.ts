import { NextResponse } from "next/server";
import { getOpsEventSummary } from "@/lib/ops-events";

export async function GET() {
  try {
    const event = await getOpsEventSummary();

    return NextResponse.json(
      {
        service: "OpsClock",
        event,
        serverTime: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    console.error("Failed to retrieve OpsClock event");

    return NextResponse.json(
      { error: "event_storage_unavailable" },
      { status: 503 }
    );
  }
}
