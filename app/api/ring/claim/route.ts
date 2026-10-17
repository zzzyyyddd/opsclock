import { NextRequest, NextResponse } from "next/server";
import {
  OPERATOR_COOKIE,
  verifyOperatorSession,
} from "@/lib/operator-session";
import {
  validateRingTimestamp,
  matchRingNonce,
} from "@/lib/ring-nonce";

import { isRingAccountUnclaimed } from "@/lib/ring-token-store";
import {
  acquireRingClaimLock,
  releaseRingClaimLock,
} from "@/lib/ring-claim-lock";
import { getRingClaimState } from "@/lib/ring-claim-state";

import { executeRingClaim } from "@/lib/ring-claim-executor";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "invalid_origin" },
      { status: 403 }
    );
  }

  try {
    const token = request.cookies.get(OPERATOR_COOKIE)?.value;

    if (!(await verifyOperatorSession(token))) {
      return NextResponse.json(
        { error: "operator_authentication_required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const nonce = body?.nonce;
    const time = body?.time;

    if (
      typeof nonce !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
      typeof time !== "string" ||
      !validateRingTimestamp(time)
    ) {
      return NextResponse.json(
        { error: "invalid_or_expired_ring_nonce" },
        { status: 400 }
      );
    }

    const accountId = await matchRingNonce(nonce, time);

    if (!accountId) {
      return NextResponse.json(
        { error: "ring_nonce_not_matched" },
        { status: 404 }
      );
    }

    const lockToken = await acquireRingClaimLock(accountId);

    if (!lockToken) {
      return NextResponse.json(
        { error: "ring_claim_in_progress" },
        { status: 409 }
      );
    }

    try {
      if (!(await isRingAccountUnclaimed(accountId))) {
        return NextResponse.json(
          { error: "ring_account_not_unclaimed" },
          { status: 409 }
        );
      }

      const state = await getRingClaimState(accountId);

      if (
        state?.stage === "uncertain" ||
        state?.stage === "patch_uncertain"
      ) {
        return NextResponse.json(
          { error: "ring_claim_requires_review" },
          { status: 409 }
        );
      }

      const result = await executeRingClaim(
        accountId,
        nonce
      );

      if (!result.linked) {
        return NextResponse.json(
          {
            linked: false,
            stage: result.stage,
            reason: result.reason,
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        linked: true,
        stage: "completed",
      });
    } finally {
      await releaseRingClaimLock(accountId, lockToken);
    }
  } catch {
    return NextResponse.json(
      { error: "claim_request_failed" },
      { status: 500 }
    );
  }
}
