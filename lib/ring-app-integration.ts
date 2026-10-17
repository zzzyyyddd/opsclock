const RING_INTEGRATION_URL =
  "https://api.amazonvision.com/v1/accounts/me/app-integrations";

type IntegrationResponse = {
  data?: {
    type?: string;
    attributes?: {
      status?: string;
    };
  };
};

export class RingIntegrationError extends Error {
  constructor(
    public readonly operation: "POST" | "PATCH",
    public readonly status: number
  ) {
    super(`Ring ${operation} failed with HTTP ${status}`);
    this.name = "RingIntegrationError";
  }
}

async function callRingIntegration(
  method: "POST" | "PATCH",
  accessToken: string,
  body: Record<string, string>,
  expectedStatus: "awaiting" | "completed"
): Promise<void> {
  const response = await fetch(RING_INTEGRATION_URL, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new RingIntegrationError(method, response.status);
  }

  const result =
    (await response.json()) as IntegrationResponse;

  if (
    result.data?.type !== "app-integrations" ||
    result.data.attributes?.status !== expectedStatus
  ) {
    throw new Error(
      `Unexpected Ring ${method} integration response`
    );
  }
}

export async function confirmRingAccountLink(
  accessToken: string,
  nonce: string,
  accountIdentifier: string
): Promise<void> {
  await callRingIntegration(
    "POST",
    accessToken,
    {
      account_identifier: accountIdentifier,
      nonce,
    },
    "awaiting"
  );
}

export async function completeRingAccountLink(
  accessToken: string
): Promise<void> {
  await callRingIntegration(
    "PATCH",
    accessToken,
    { status: "completed" },
    "completed"
  );
}
