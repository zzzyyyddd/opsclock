export function getOperatorAccountIdentifier(): string {
  const email = process.env.OPSCLOCK_OPERATOR_EMAIL;

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Operator email is not configured");
  }

  const [local, domain] = email.split("@");

  if (!local || !domain) {
    throw new Error("Invalid operator email");
  }

  const maskedLocal =
    local.length === 1
      ? `${local[0]}***`
      : `${local[0]}***${local[local.length - 1]}`;

  return `${maskedLocal}@${domain}`;
}
