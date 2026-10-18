import { NextRequest, NextResponse } from "next/server";
import { acknowledgeOpsEvent } from "@/lib/ops-events";
import {
  OPERATOR_COOKIE,
  verifyOperatorSession,
} from "@/lib/operator-session";

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 }
      );
    }

    const token = request.cookies.get(OPERATOR_COOKIE)?.value;

    if (!(await verifyOperatorSession(token))) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      !("eventId" in body) ||
      typeof body.eventId !== "string" ||
      body.eventId.length < 1 ||
      body.eventId.length > 256
    ) {
      return NextResponse.json(
        { error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const event = await acknowledgeOpsEvent(body.eventId);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { acknowledged: true, event },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    console.error("Operator acknowledgement failed");

    return NextResponse.json(
      { error: "Acknowledgement unavailable" },
      { status: 503 }
    );
  }
}
