import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const DEMO_COOKIE = "opsclock_demo_session";

export async function getDemoSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(DEMO_COOKIE)?.value;

  if (!value) return null;

  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export function demoEventKey(sessionId: string): string {
  return `opsclock:demo:${sessionId}:latest`;
}

export function demoSessionKey(sessionId: string): string {
  return `opsclock:demo:${sessionId}:active`;
}
