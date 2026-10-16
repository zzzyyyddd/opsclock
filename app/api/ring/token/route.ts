import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    service: "OpsClock",
    endpoint: "token-exchange",
    status: "ready",
  });
}
