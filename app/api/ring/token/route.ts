import { NextRequest, NextResponse } from "next/server";
import {
  saveRingTokens,
  markRingAccountUnclaimed,
} from "@/lib/ring-token-store";


type RingTokens = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type RingProfile = {
  data?: {
    type?: string;
    id?: string;
  };
};

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

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "missing_authorization_code" },
        { status: 400 }
      );
    }

    const clientId = process.env.RING_CLIENT_ID;
    const clientSecret = process.env.RING_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "server_configuration_error" },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch(
      "https://oauth.ring.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!tokenResponse.ok) {
      console.error("Ring token exchange failed:", tokenResponse.status);
      return NextResponse.json(
        { error: "ring_token_exchange_failed" },
        { status: 502 }
      );
    }

    const tokens = (await tokenResponse.json()) as RingTokens;

    if (
      typeof tokens.access_token !== "string" ||
      !tokens.access_token ||
      typeof tokens.refresh_token !== "string" ||
      !tokens.refresh_token
    ) {
      return NextResponse.json(
        { error: "invalid_ring_token_response" },
        { status: 502 }
      );
    }

    const profileResponse = await fetch(
      "https://api.amazonvision.com/v1/users/me",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!profileResponse.ok) {
      console.error("Ring profile lookup failed:", profileResponse.status);
      return NextResponse.json(
        { error: "ring_profile_lookup_failed" },
        { status: 502 }
      );
    }

    const profile = (await profileResponse.json()) as RingProfile;
    const accountId = profile.data?.id;

    if (
      profile.data?.type !== "users" ||
      typeof accountId !== "string" ||
      !/^[a-zA-Z0-9._-]{1,128}$/.test(accountId)
    ) {
      return NextResponse.json(
        { error: "invalid_ring_account_id" },
        { status: 502 }
      );
    }

    await saveRingTokens(accountId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      scope: tokens.scope,
    });

    await markRingAccountUnclaimed(accountId);

    console.log("Ring tokens securely stored as unclaimed");

    return NextResponse.json({
      received: true,
      stored: true,
    });
  } catch (error) {
    console.error(
      "Ring token processing failed:",
      error instanceof Error ? error.name : "unknown"
    );

    return NextResponse.json(
      { error: "internal_server_error" },
      { status: 500 }
    );
  }
}
