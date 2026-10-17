import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let code: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      code = body?.code ?? body?.authorization_code ?? null;
    } else {
      const body = await request.formData();
      code =
        body.get("code")?.toString() ??
        body.get("authorization_code")?.toString() ??
        null;
    }

    if (!code) {
      return NextResponse.json(
        { error: "missing_authorization_code" },
        { status: 400 }
      );
    }

    const clientId = process.env.RING_CLIENT_ID;
    const clientSecret = process.env.RING_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Ring credentials are not configured");

      return NextResponse.json(
        { error: "server_configuration_error" },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });

    const ringResponse = await fetch(
      "https://oauth.ring.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
        cache: "no-store",
      }
    );

    const tokenData = await ringResponse.json();

    if (!ringResponse.ok) {
      console.error("Ring token exchange failed", ringResponse.status);

      return NextResponse.json(
        { error: "ring_token_exchange_failed" },
        { status: 502 }
      );
    }

    // IMPORTANT:
    // Never log access_token or refresh_token.
    // Persistent secure storage will be added next.

    console.log("Ring token exchange succeeded");

    return NextResponse.json({
      received: true,
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
    });
  } catch (error) {
    console.error(
      "Ring token endpoint error",
      error instanceof Error ? error.message : "unknown"
    );

    return NextResponse.json(
      { error: "internal_server_error" },
      { status: 500 }
    );
  }
}
