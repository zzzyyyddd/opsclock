import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRingWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | null
): boolean {
  const signingKey = process.env.RING_HMAC_SIGNING_KEY;

  if (!signingKey || !signatureHeader) {
    return false;
  }

  if (!/^sha256=[a-fA-F0-9]{64}$/.test(signatureHeader)) {
    return false;
  }

  const expected = createHmac("sha256", signingKey)
    .update(rawBody)
    .digest();

  const received = Buffer.from(
    signatureHeader.slice("sha256=".length),
    "hex"
  );

  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}
