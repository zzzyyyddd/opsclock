import assert from "node:assert/strict";
import { test } from "node:test";
import { getOpsStatus } from "../src/lib/sla";

const MINUTE = 60_000;

test("Acknowledgement within 10 minutes meets SLA", () => {
  const arrivalAt = 1_800_000_000_000;
  const acknowledgedAt = arrivalAt + 5 * MINUTE;

  assert.equal(
    getOpsStatus(arrivalAt, acknowledgedAt),
    "SLA_MET"
  );
});

test("Acknowledgement after 10 minutes breaches SLA", () => {
  const arrivalAt = 1_800_000_000_000;
  const acknowledgedAt = arrivalAt + 11 * MINUTE;

  assert.equal(
    getOpsStatus(arrivalAt, acknowledgedAt),
    "SLA_BREACHED"
  );
});

test("Unacknowledged arrival enters warning period", () => {
  const arrivalAt = 1_800_000_000_000;

  assert.equal(
    getOpsStatus(arrivalAt, null, arrivalAt + 9 * MINUTE),
    "AT_RISK"
  );
});

test("Unacknowledged arrival breaches after 10 minutes", () => {
  const arrivalAt = 1_800_000_000_000;

  assert.equal(
    getOpsStatus(arrivalAt, null, arrivalAt + 11 * MINUTE),
    "SLA_BREACHED"
  );
});
