import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/ring/webhook/route";

test("Rejects Ring webhook without a valid signature", async () => {
  const payload = {
    meta: {
      version: "1.1",
      time: new Date().toISOString(),
      request_id: "test-invalid-signature",
      account_id: "test-account",
    },
    data: {
      id: "test-event",
      type: "motion_detected",
      attributes: {
        source: "test-device",
        source_type: "camera",
        timestamp: Date.now(),
        sub_type: "vehicle",
      },
    },
  };

  const request = new Request(
    "http://localhost:3000/api/ring/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": "sha256=" + "0".repeat(64),
      },
      body: JSON.stringify(payload),
    }
  );

  const response = await POST(request);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "invalid_signature",
  });
});
