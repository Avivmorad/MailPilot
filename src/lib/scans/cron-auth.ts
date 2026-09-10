export function authorizeCronRequest(headers: Headers, secret: string): boolean {
  const authorization = headers.get("authorization");
  if (authorization === `Bearer ${secret}`) {
    return true;
  }
  return headers.get("x-cron-secret") === secret;
}
