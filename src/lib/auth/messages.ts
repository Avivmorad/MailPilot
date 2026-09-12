const AUTH_ERROR_MESSAGES: Array<{ match: RegExp; message: string }> = [
  { match: /invalid login credentials/i, message: "Email or password is incorrect." },
  {
    match: /email not confirmed/i,
    message: "Check your email to confirm your account, then sign in.",
  },
  {
    match: /user already registered|already been registered/i,
    message: "An account with that email already exists. Sign in or reset your password.",
  },
  { match: /password should be at least/i, message: "Password must be at least 6 characters." },
  { match: /same password/i, message: "Choose a password you have not used before." },
  {
    match: /rate limit|too many requests|over_request_rate_limit/i,
    message: "Too many attempts. Wait a minute and try again.",
  },
  {
    match: /invalid.*(token|otp|link)|otp_expired|flow_state/i,
    message: "This link is invalid or has expired. Request a new one.",
  },
  {
    match: /supabase configured|Invalid or missing public/i,
    message: "Something went wrong. Is Supabase configured in .env.local?",
  },
];

export function authUserMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  for (const { match, message } of AUTH_ERROR_MESSAGES) {
    if (match.test(raw)) {
      return message;
    }
  }
  return "Something went wrong. Try again in a moment.";
}
