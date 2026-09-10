import { describe, expect, it } from "vitest";

import { isEphemeralAuthNotice, isLoginFyiNotice, isNonTaskNotice } from "@/lib/ai/notices";

describe("isEphemeralAuthNotice", () => {
  it("treats OTP and email-verify mail as non-tasks", () => {
    expect(isEphemeralAuthNotice(["הזן את קוד האימות 5827 באתר ג'ובנט"])).toBe(true);
    expect(isEphemeralAuthNotice(["לחץ על הקישור במייל כדי לאמת את כתובת הדוא\"ל שלך"])).toBe(true);
    expect(isEphemeralAuthNotice(["Enter the verification code 5827"])).toBe(true);
  });

  it("does not treat a real work request as ephemeral", () => {
    expect(isEphemeralAuthNotice(["Please approve the budget by Friday"])).toBe(false);
  });
});

describe("isLoginFyiNotice", () => {
  it("groups new-sign-in reviews as FYI security", () => {
    expect(isLoginFyiNotice(["בדוק את פעילות החשבון שלך ב-Linear כדי לוודא שההתחברות מוכרת"])).toBe(
      true,
    );
    expect(isLoginFyiNotice(["Review your account activity on Vercel"])).toBe(true);
  });

  it("treats Hebrew Google new-sign-in and OAuth grants as FYI", () => {
    expect(
      isLoginFyiNotice([
        "כניסה חדשה ב-Mac OS. אם הכניסה בוצעה על ידך, אין צורך לעשות דבר.",
      ]),
    ).toBe(true);
    expect(isLoginFyiNotice(["נתת לאפליקציה Cursor גישה לחלק מהנתונים בחשבון שלך ב-Google"])).toBe(
      true,
    );
    expect(isLoginFyiNotice(["מסרת לאפליקציה Linear נתונים מסוימים מהחשבון שלך ב-Google"])).toBe(
      true,
    );
  });

  it("treats a provider-blocked login as FYI", () => {
    expect(
      isLoginFyiNotice(["התראת אבטחה קריטית: חסמנו ניסיון כניסה לחשבון שלך. כדאי לבדוק מה קרה."]),
    ).toBe(true);
  });

  it("keeps secure-now mail as a task when there is no dismiss-if-you path", () => {
    expect(isLoginFyiNotice(["Unusual sign-in detected. Secure your account now."])).toBe(false);
  });
});

describe("isNonTaskNotice", () => {
  it("covers both OTP and login FYI", () => {
    expect(isNonTaskNotice(["verification code 1234"])).toBe(true);
    expect(isNonTaskNotice(["new sign-in from Chrome"])).toBe(true);
  });
});
