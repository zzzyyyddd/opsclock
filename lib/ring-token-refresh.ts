import { loadRingTokens, saveRingTokens } from "@/lib/ring-token-store";

type RefreshedTokens = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

export async function refreshRingAccessToken(
  accountId: string
): Promise<boolean> {
  const tokens = await loadRingTokens(accountId);

  if (!tokens?.refresh_token) {
    return false;
  }

  const clientId = process.env.RING_CLIENT_ID;
  const clientSecret = process.env.RING_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Ring credentials not configured");
  }

  const response = await fetch(
    "https://oauth.ring.com/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    console.error("Ring token refresh failed:", response.status);
    return false;
  }

  const refreshed = (await response.json()) as RefreshedTokens;

  if (
    typeof refreshed.access_token !== "string" ||
    !refreshed.access_token
  ) {
    return false;
  }

  await saveRingTokens(accountId, {
    access_token: refreshed.access_token,
    refresh_token:
      refreshed.refresh_token || tokens.refresh_token,
    token_type: refreshed.token_type || tokens.token_type,
    expires_in: refreshed.expires_in || tokens.expires_in,
    scope: refreshed.scope || tokens.scope,
  });

  return true;
}
