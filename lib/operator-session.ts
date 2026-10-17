import { randomBytes, createHash } from "node:crypto";
import { getRedis } from "@/lib/redis";

export const OPERATOR_COOKIE = "opsclock_operator_session";

const SESSION_TTL_SECONDS = 60 * 60 * 8;

function sessionKey(token: string): string {
  const hash = createHash("sha256")
    .update(token)
    .digest("hex");

  return `opsclock:operator:session:${hash}`;
}

export async function createOperatorSession(): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await getRedis().set(
    sessionKey(token),
    { authenticated: true },
    { ex: SESSION_TTL_SECONDS }
  );

  return token;
}

export async function verifyOperatorSession(
  token: string | undefined
): Promise<boolean> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return false;
  }

  const session = await getRedis().get<{
    authenticated: boolean;
  }>(sessionKey(token));

  return session?.authenticated === true;
}

export async function deleteOperatorSession(
  token: string | undefined
): Promise<void> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return;
  }

  await getRedis().del(sessionKey(token));
}

export const OPERATOR_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
