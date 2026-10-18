import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  handleRingWebhook,
  type RingWebhookDependencies,
} from "../app/api/ring/webhook/route";
import type { OpsEvent } from "../lib/ops-events";

test("Signed Ring vehicle webhook creates one unique SLA event", async () => {
  const originalKey = process.env.RING_HMAC_SIGNING_KEY;
  const testKey = "opsclock-local-integration-test-key";
  process.env.RING_HMAC_SIGNING_KEY = testKey;

  const events = new Map<string, OpsEvent>();
  let createCalls = 0;
  let activityCalls = 0;

  const deps: RingWebhookDependencies = {
    getClaim: async () => ({
      stage: "completed",
      nonceHash: "test",
      updatedAt: Date.now(),
    }),

    saveActivity: async () => {
      activityCalls++;
      return "saved";
    },

    createEvent: async (event) => {
      createCalls++;

      const existing = events.get(event.id);
      if (existing) return existing;

      const record: OpsEvent = {
        ...event,
        acknowledgedAt: null,
      };

      events.set(event.id, record);
      return record;
    },
  };

  try {
    const detectedAt = Date.now();

    const payload = {
      meta: {
        version: "1.1",
        time: new Date().toISOString(),
        request_id: "integration-request-001",
        account_id: "integration-account",
      },
      data: {
        id: "integration-vehicle-001",
        type: "motion_detected",
        attributes: {
          source: "integration-camera",
          source_type: "camera",
          timestamp: detectedAt,
          sub_type: "vehicle",
        },
      },
    };

    const raw = JSON.stringify(payload);

    const signature =
      "sha256=" +
      createHmac("sha256", testKey)
        .update(raw)
        .digest("hex");

    const makeRequest = () =>
      new Request("http://localhost:3000/api/ring/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": signature,
        },
        body: raw,
      });

    const first = await handleRingWebhook(makeRequest(), deps);
    const second = await handleRingWebhook(makeRequest(), deps);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);

    assert.equal(events.size, 1);
    assert.equal(createCalls, 2);
    assert.equal(activityCalls, 2);

    const event = events.get(
      "ring:integration-account:integration-vehicle-001"
    );

    assert.ok(event);
    assert.equal(event.source, "ring");
    assert.equal(event.kind, "VEHICLE_ARRIVAL");
    assert.equal(event.accountId, "integration-account");
    assert.equal(event.arrivalAt, detectedAt);
    assert.equal(event.acknowledgedAt, null);
  } finally {
    if (originalKey === undefined) {
      delete process.env.RING_HMAC_SIGNING_KEY;
    } else {
      process.env.RING_HMAC_SIGNING_KEY = originalKey;
    }
  }
});
