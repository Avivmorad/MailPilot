/**
 * Deterministic notice classification (product overlay: OTP ≠ open task).
 */

function haystack(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n")
    .toLowerCase();
}

const EPHEMERAL_AUTH = [
  /קוד האימות/,
  /קוד אימות/,
  /הזן את הקוד/,
  /הזינו את הקוד/,
  /לאמת את כתובת/,
  /אימות כתובת/,
  /אימות כתובת מייל/,
  /verification code/,
  /one[- ]time (code|password|passcode)/,
  /\botp\b/,
  /magic link/,
  /verify (your )?email/,
  /confirm (your )?email/,
  /confirm your email address/,
  /enter (the )?(code|passcode)/,
  /passcode/,
];

const LOGIN_FYI = [
  /פעילות החשבון/,
  /התחברות מוכרת/,
  /כניסה מוכרת/,
  /כניסה חדשה/,
  /אין צורך לעשות דבר/,
  /נתת לאפליקציה/,
  /מסרת לאפליקציה/,
  /מפתח גישה חדש/,
  /new sign[- ]?in/,
  /new login/,
  /unrecognized (device|login|sign)/,
  /review (your )?account activity/,
  /login from (a )?new/,
  /if this was(n't| not) you/,
  /sign[- ]in (from|on)/,
  /oauth application (approval|authorized)/,
  /passkey/,
  /חסמנו ניסיון כניסה/,
  /we blocked .{0,40}(sign[- ]?in|login)/,
  /התראת אבטחה קריטית/,
];

const DISMISS_IF_YOU = [
  /אין צורך לעשות דבר/,
  /if this was you.{0,80}no (further )?action/,
  /if this was you.{0,40}(do nothing|ignore)/,
  /אם הכניסה בוצעה על ידך/,
];

const SECURE_NOW_CTA = [
  /secure (your )?account now/,
  /אבטח את (ה)?חשבון עכשיו/,
  /tap .{0,30}secure/,
];

const REAL_SECURITY_ACTION = [
  /password reset/,
  /reset your password/,
  /account (is )?locked/,
  /account disabled/,
  /compromised/,
  /unauthorized (charge|transaction)/,
  /איפוס סיסמה/,
  /החשבון נחסם/,
];

export function isEphemeralAuthNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text) {
    return false;
  }
  if (REAL_SECURITY_ACTION.some((pattern) => pattern.test(text))) {
    return false;
  }
  return EPHEMERAL_AUTH.some((pattern) => pattern.test(text));
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function isLoginFyiNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || matchesAny(text, REAL_SECURITY_ACTION)) {
    return false;
  }
  if (matchesAny(text, SECURE_NOW_CTA) && !matchesAny(text, DISMISS_IF_YOU)) {
    return false;
  }
  return matchesAny(text, LOGIN_FYI);
}

export function isNonTaskNotice(parts: Array<string | null | undefined>): boolean {
  return isEphemeralAuthNotice(parts) || isLoginFyiNotice(parts);
}
