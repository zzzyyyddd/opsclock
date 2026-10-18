import { NextRequest, NextResponse } from "next/server";
import { getOpsEventSummary } from "@/lib/ops-events";
import {
  OPERATOR_COOKIE,
  verifyOperatorSession,
} from "@/lib/operator-session";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(OPERATOR_COOKIE)?.value;

    const authenticated = await verifyOperatorSession(token);

    if (!authenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

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
