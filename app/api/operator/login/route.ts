import { NextRequest, NextResponse } from "next/server";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { getRedis } from "@/lib/redis";
import {
  OPERATOR_COOKIE,
  OPERATOR_SESSION_MAX_AGE,
  createOperatorSession,
} from "@/lib/operator-session";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

function verifyPassword(password: string): boolean {
  const stored = process.env.OPSCLOCK_OPERATOR_PASSWORD_HASH;

  if (!stored) return false;

  const [saltHex, hashHex] = stored.split(":");

  if (
    !/^[0-9a-f]{32}$/i.test(saltHex ?? "") ||
    !/^[0-9a-f]{128}$/i.test(hashHex ?? "")
  ) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length
  );

  return timingSafeEqual(actual, expected);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "Invalid origin" },
      { status: 403 }
    );
  }

  const ip = request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const key = `opsclock:operator:login-attempts:${ip}`;

  try {
    const redis = getRedis();
    const attempts = await redis.get<number>(key);

    if ((attempts ?? 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const password = body?.password;

    if (
      typeof password !== "string" ||
      password.length > 256 ||
      !verifyPassword(password)
    ) {
      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }

      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createOperatorSession();
    await redis.del(key);

    const response = NextResponse.json({ authenticated: true });

    response.cookies.set(OPERATOR_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OPERATOR_SESSION_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Login unavailable" },
      { status: 503 }
    );
  }
}
