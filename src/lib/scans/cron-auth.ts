import { timingSafeEqual } from "node:crypto";

function secretsMatch(provided: string | null, secret: string): boolean {
  if (!provided || !secret) {
    return false;
  }
  const left = Buffer.from(provided);
  const right = Buffer.from(secret);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function authorizeCronRequest(headers: Headers, secret: string): boolean {
  if (!secret) {
    return false;
  }
  const authorization = headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  return secretsMatch(bearer, secret) || secretsMatch(headers.get("x-cron-secret"), secret);
}
