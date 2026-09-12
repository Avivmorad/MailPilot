/**
 * Deterministic notice classification (product overlay: OTP ≠ open task).
 * Placement follows remaining action + who owns it.
 */

import type { ActionType } from "@/lib/ai/schemas";

function haystack(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("\n")
    .toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
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
  /link verification code/,
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
  /new device/,
  /security alert/,
  /google .{0,20}security/,
  /התראת אבטחה/,
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
  /expired (api )?key/,
  /api key .{0,60}expir/,
  /personal access token/,
  /access token .{0,40}expir/,
  /token .{0,20}expir/,
];

const DOCUMENT_SHARE_FYI = [
  /shared (a |an )?(document|file|folder|item|spreadsheet|presentation) with you/,
  /has shared .+ with you/,
  /invited you to (view|edit|comment)/,
  /you('ve| have) been given access/,
  /added you as (a |an )?(viewer|commenter|editor)/,
  /שית(ף|פה|פו) איתך (מסמך|קובץ|תיקייה)/,
  /שות(ף|פה) איתך/,
  /קיבלת גישה (למסמך|לקובץ|לתיקייה)/,
];

const APPLICATION_FOLLOW_UP = [
  /interview (invitation|availability|schedule|scheduling)/,
  /schedule (an |your )?interview/,
  /(complete|take|start) (the |your )?.{0,40}(assessment|coding (test|challenge)|homework)/,
  /assessment (is )?(ready|required|due|waiting)/,
  /missing (documents?|information|paperwork)/,
  /please (upload|send|attach|provide) .{0,40}(resume|cv|documents?|diploma|transcript)/,
  /complete your application/,
  /זימון לראיון/,
  /מסמכים חסרים/,
];

const APPLICATION_RECEIPT = [
  /thank you for (your )?(job )?application/,
  /thanks for applying/,
  /we (have )?received your application/,
  /application (has been |was )?(received|submitted)( successfully)?/,
  /תודה על (ה)?גשת המועמדות/,
  /קיבלנו את המועמדות/,
];

const DELIVERY_ACTION = [
  /(collect|pick up|pickup) (your )?(parcel|package|item|order)/,
  /awaiting collection/,
  /held at (the )?(depot|post office|pickup|locker)/,
  /(incorrect|wrong|update|correct) (delivery )?address/,
  /address (is )?(incorrect|wrong|incomplete)/,
  /customs (information|documents?|declaration|duty|fees?)/,
  /provide .{0,40}customs/,
  /failed delivery/,
  /arrange (a )?redeliver/,
  /איסוף (ה)?חבילה/,
  /לאסוף את (ה)?חבילה/,
  /כתובת שגויה/,
  /מידע למכס/,
];

const ROUTINE_TRACKING = [
  /out for delivery/,
  /in transit/,
  /tracking (number|update|info)/,
  /package (is )?(on the way|shipped|delivered)/,
  /(your )?(order|shipment|parcel|package) (has been |was )?(shipped|delivered)/,
  /estimated delivery/,
  /shipment .{0,20}(out for delivery|delivered)/,
];

const AUTOMATED_ACTION_REQUEST = [
  /please (review and )?sign(?! up)/,
  /signature requested/,
  /awaiting your signature/,
  /needs? your signature/,
  /please approve/,
  /approval requested/,
  /needs? your approval/,
  /left a comment.{0,80}(please|can you|requested)/,
  /commented.{0,80}(please|can you|action)/,
  /please (review|respond to) .{0,40}comment/,
  /requested access/,
  /wants access/,
  /grant (me |them )?access/,
  /בקשת גישה/,
  /בקשת חתימה/,
  /אנא (חתום|אשר|הגב|בדוק)/,
];

const MASS_CALENDAR = [/webinar/, /mass (calendar )?invite/, /optional (session|webinar)/];

const MEETING_TIME_CHOICE = [
  /please (choose|pick|select|confirm|propose) (a |the )?(new )?time/,
  /are you available/,
  /send .{0,20}availability/,
  /please (accept|decline)/,
  /\brsvp\b/,
  /find a (new )?time/,
];

const CONFIRMED_MEETING_CHANGE = [
  /(meeting|event|appointment) (has been |was )?(rescheduled|moved) to/,
  /this (meeting|event|appointment) (has been |was )?(cancelled|canceled|rescheduled)/,
  /(has been |was )(cancelled|canceled) the (meeting|event|appointment)/,
];

const WAITING_ACK = [
  /out of (the )?office/,
  /automatic reply/,
  /i am (currently )?(away|out of office)/,
  /limited access to (e-?mail)/,
  /we (have )?received your (request|ticket|inquiry|message|email)/,
  /ticket .{0,30}(created|opened|received|logged)/,
  /your (request|ticket) has been (received|created|logged|opened)/,
  /מחוץ למשרד/,
  /מענה אוטומטי/,
  /הקריאה (נפתחה|התקבלה)/,
];

const ASSIGNED_TO_OTHER = [
  /assigned to (?!you\b)\w+/,
  /this is (now )?for \w+ to /,
  /please have \w+ /,
  /can \w+ (handle|take this|review|complete)/,
  /no action (needed|required) from you/,
  /just (an )?fyi/,
  /fyi only/,
  /cc'?ing you for (visibility|awareness|fyi)/,
  /looping you in for (visibility|awareness|fyi)/,
];

const EXPLICIT_USER_ACTION = [
  /please (review|sign|approve|pay|reply|complete|submit|confirm payment)/,
  /action required/,
  /required (next )?step/,
  /unpaid/,
  /failed (payment|charge)/,
  /remaining balance/,
  /update (your )?(payment|card)/,
  /can you /,
  /could you /,
  /חשבונית.{0,40}לתשלום/,
  /יתרה לתשלום/,
  /אנא שלם/,
];

const MARKETING_OR_JOB = [
  /unsubscribe/,
  /\d+%\s*off/,
  /limited[- ]time/,
  /newsletter/,
  /job alert/,
  /jobs? (for you|matching)/,
  /recommended jobs/,
  /new jobs/,
  /webinar/,
  /you('re| are) invited to (a )?webinar/,
];

const RECEIPT_OR_ROUTINE = [
  /payment (was |is |has been )?(received|successful|posted|confirmed)/,
  /order confirmation/,
  /thanks for your (order|purchase|payment)/,
  /refund (issued|processed)/,
  /התשלום התקבל/,
  /התשלום עבר בהצלחה/,
  /אישור תשלום/,
  /קבלה על תשלום/,
  /boarding pass/,
  /itinerary/,
  /appointment (is )?confirmed/,
];

export function isEphemeralAuthNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text) {
    return false;
  }
  if (matchesAny(text, REAL_SECURITY_ACTION)) {
    return false;
  }
  return matchesAny(text, EPHEMERAL_AUTH);
}

export function isDocumentShareNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isUserOwnedActionNotice(parts)) {
    return false;
  }
  return matchesAny(text, DOCUMENT_SHARE_FYI);
}

export function isApplicationFollowUpNotice(parts: Array<string | null | undefined>): boolean {
  return matchesAny(haystack(parts), APPLICATION_FOLLOW_UP);
}

export function isApplicationReceiptNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isApplicationFollowUpNotice(parts)) {
    return false;
  }
  return matchesAny(text, APPLICATION_RECEIPT);
}

export function isDeliveryActionNotice(parts: Array<string | null | undefined>): boolean {
  return matchesAny(haystack(parts), DELIVERY_ACTION);
}

export function isRoutineTrackingNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isDeliveryActionNotice(parts)) {
    return false;
  }
  return matchesAny(text, ROUTINE_TRACKING);
}

export function isAutomatedActionRequestNotice(parts: Array<string | null | undefined>): boolean {
  return matchesAny(haystack(parts), AUTOMATED_ACTION_REQUEST);
}

export function isMeetingTimeChoiceNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || matchesAny(text, MASS_CALENDAR)) {
    return false;
  }
  return matchesAny(text, MEETING_TIME_CHOICE);
}

export function isConfirmedMeetingChangeNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isMeetingTimeChoiceNotice(parts)) {
    return false;
  }
  return matchesAny(text, CONFIRMED_MEETING_CHANGE);
}

export function isWaitingAcknowledgmentNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isUserOwnedActionNotice(parts)) {
    return false;
  }
  return matchesAny(text, WAITING_ACK);
}

export function isAssignedToSomeoneElseNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isUserOwnedActionNotice(parts)) {
    return false;
  }
  return matchesAny(text, ASSIGNED_TO_OTHER);
}

export function isUserOwnedActionNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isEphemeralAuthNotice(parts)) {
    return false;
  }
  return (
    isApplicationFollowUpNotice(parts) ||
    isDeliveryActionNotice(parts) ||
    isAutomatedActionRequestNotice(parts) ||
    isMeetingTimeChoiceNotice(parts)
  );
}

export function ownedActionType(parts: Array<string | null | undefined>): ActionType {
  const text = haystack(parts);
  if (/sign|חתום/.test(text)) {
    return "sign";
  }
  if (/approv|אשר/.test(text)) {
    return "approve";
  }
  if (/interview|schedule|available|rsvp|accept|decline|ראיון/.test(text)) {
    return "schedule";
  }
  if (/assessment|missing|upload|customs|submit|מסמך/.test(text)) {
    return "submit";
  }
  if (/comment|reply|הגב/.test(text)) {
    return "reply";
  }
  if (/collect|pickup|pick up|address|parcel|package|איסוף/.test(text)) {
    return "follow_up";
  }
  return "follow_up";
}

export function isAutomatedNoiseNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isUserOwnedActionNotice(parts) || matchesAny(text, EXPLICIT_USER_ACTION)) {
    return false;
  }
  return matchesAny(text, MARKETING_OR_JOB);
}

export function isReceiptOrRoutineNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isUserOwnedActionNotice(parts) || matchesAny(text, EXPLICIT_USER_ACTION)) {
    return false;
  }
  return matchesAny(text, RECEIPT_OR_ROUTINE) || isRoutineTrackingNotice(parts);
}

export function isSecurityEventNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isEphemeralAuthNotice(parts)) {
    return false;
  }
  if (matchesAny(text, SECURE_NOW_CTA) && !matchesAny(text, DISMISS_IF_YOU)) {
    return true;
  }
  return matchesAny(text, REAL_SECURITY_ACTION) || matchesAny(text, LOGIN_FYI);
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

const PAID_RECEIPT = [
  /payment (was |is |has been )?(received|successful|posted|confirmed)/,
  /order confirmation/,
  /thanks for your (order|purchase|payment)/,
  /refund (issued|processed)/,
  /התשלום התקבל/,
  /התשלום עבר בהצלחה/,
  /אישור תשלום/,
  /קבלה על תשלום/,
];

export function isPaidReceiptNotice(parts: Array<string | null | undefined>): boolean {
  const text = haystack(parts);
  if (!text || isUserOwnedActionNotice(parts) || matchesAny(text, EXPLICIT_USER_ACTION)) {
    return false;
  }
  return matchesAny(text, PAID_RECEIPT);
}

export function isIgnoreFamilyNotice(parts: Array<string | null | undefined>): boolean {
  return (
    isEphemeralAuthNotice(parts) ||
    isAutomatedNoiseNotice(parts) ||
    isApplicationReceiptNotice(parts) ||
    isPaidReceiptNotice(parts)
  );
}

export function isInformationalNotice(parts: Array<string | null | undefined>): boolean {
  return (
    isDocumentShareNotice(parts) ||
    isRoutineTrackingNotice(parts) ||
    isConfirmedMeetingChangeNotice(parts) ||
    isAssignedToSomeoneElseNotice(parts) ||
    (isReceiptOrRoutineNotice(parts) && !isPaidReceiptNotice(parts))
  );
}

export function isNonTaskNotice(parts: Array<string | null | undefined>): boolean {
  return isIgnoreFamilyNotice(parts);
}
