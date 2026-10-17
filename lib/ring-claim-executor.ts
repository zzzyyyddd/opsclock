import { createHash } from "node:crypto";
import {
  getRingClaimState,
  saveRingClaimState,
} from "@/lib/ring-claim-state";
import {
  confirmRingAccountLink,
  completeRingAccountLink,
} from "@/lib/ring-app-integration";
import { getRingAccessToken } from "@/lib/ring-access-token";
import { getOperatorAccountIdentifier } from "@/lib/operator-identity";
import {
  markRingAccountClaimed,
} from "@/lib/ring-token-store";

export type RingClaimResult =
  | { linked: true; stage: "completed" }
  | {
      linked: false;
      stage: "uncertain" | "awaiting" | "patch_uncertain";
      reason: string;
    };

export async function executeRingClaim(
  accountId: string,
  nonce: string
): Promise<RingClaimResult> {
  const nonceHash = createHash("sha256")
    .update(nonce)
    .digest("hex");

  const existing = await getRingClaimState(accountId);

  if (existing?.stage === "completed") {
    return {
      linked: true,
      stage: "completed",
    };
  }

  if (existing?.nonceHash && existing.nonceHash !== nonceHash) {
    return {
      linked: false,
      stage: "uncertain",
      reason: "different_nonce_for_existing_claim",
    };
  }

  if (existing?.stage === "patch_uncertain") {
    return {
      linked: false,
      stage: "patch_uncertain",
      reason: "ring_patch_requires_review",
    };
  }

  if (existing?.stage === "uncertain") {
    return {
      linked: false,
      stage: "uncertain",
      reason: "manual_review_required",
    };
  }

  const accessToken = await getRingAccessToken(
    accountId,
    true
  );

  if (!accessToken) {
    return {
      linked: false,
      stage: existing?.stage === "awaiting"
        ? "awaiting"
        : "uncertain",
      reason: "ring_access_token_unavailable",
    };
  }

  if (existing?.stage !== "awaiting") {
    await saveRingClaimState(accountId, {
      stage: "uncertain",
      nonceHash,
      updatedAt: Date.now(),
    });

    try {
      await confirmRingAccountLink(
        accessToken,
        nonce,
        getOperatorAccountIdentifier()
      );
    } catch {
      return {
        linked: false,
        stage: "uncertain",
        reason: "ring_post_not_confirmed",
      };
    }

    await saveRingClaimState(accountId, {
      stage: "awaiting",
      nonceHash,
      updatedAt: Date.now(),
    });
  }

  await saveRingClaimState(accountId, {
    stage: "patch_uncertain",
    nonceHash,
    updatedAt: Date.now(),
  });

  try {
    await completeRingAccountLink(accessToken);
  } catch {
    return {
      linked: false,
      stage: "patch_uncertain",
      reason: "ring_patch_not_confirmed",
    };
  }

  await saveRingClaimState(accountId, {
    stage: "completed",
    nonceHash,
    updatedAt: Date.now(),
  });

  await markRingAccountClaimed(accountId);

  return {
    linked: true,
    stage: "completed",
  };
}
