import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const hex = process.env.OPSCLOCK_ENCRYPTION_KEY;

  if (!hex || !/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error("Invalid OpsClock encryption key");
  }

  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);

  const cipher = createCipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted payload");
  }

  const [, ivText, tagText, ciphertext] = parts;

  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid encryption metadata");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(ciphertext, "base64url")
    ),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
