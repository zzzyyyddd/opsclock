import { loadRingTokens } from "@/lib/ring-token-store";
import { refreshRingAccessToken } from "@/lib/ring-token-refresh";

export async function getRingAccessToken(
  accountId: string,
  forceRefresh = false
): Promise<string | null> {
  let tokens = await loadRingTokens(accountId);

  if (!tokens) {
    return null;
  }

  if (forceRefresh) {
    const refreshed = await refreshRingAccessToken(accountId);

    if (!refreshed) {
      return null;
    }

    tokens = await loadRingTokens(accountId);
  }

  return tokens?.access_token || null;
}
