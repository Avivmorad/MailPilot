import { describe, expect, it } from "vitest";

import {
  isApplicationFollowUpNotice,
  isApplicationReceiptNotice,
  isAssignedToSomeoneElseNotice,
  isAutomatedActionRequestNotice,
  isAutomatedNoiseNotice,
  isConfirmedMeetingChangeNotice,
  isDeliveryActionNotice,
  isDocumentShareNotice,
  isEphemeralAuthNotice,
  isLoginFyiNotice,
  isMeetingTimeChoiceNotice,
  isNonTaskNotice,
  isReceiptOrRoutineNotice,
  isRoutineTrackingNotice,
  isSecurityEventNotice,
  isUserOwnedActionNotice,
  isWaitingAcknowledgmentNotice,
} from "@/lib/ai/notices";

describe("isEphemeralAuthNotice", () => {
  it("treats OTP and email-verify mail as ignore", () => {
    expect(isEphemeralAuthNotice(["הזן את קוד האימות 5827 באתר ג'ובנט"])).toBe(true);
    expect(isEphemeralAuthNotice(["אימות כתובת מייל לאתר ג'ובנט"])).toBe(true);
    expect(isEphemeralAuthNotice(["Your Link verification code: 866 465"])).toBe(true);
    expect(isEphemeralAuthNotice(["Enter the verification code 5827"])).toBe(true);
  });

  it("does not treat a real work request as ephemeral", () => {
    expect(isEphemeralAuthNotice(["Please approve the budget by Friday"])).toBe(false);
  });
});

describe("isLoginFyiNotice", () => {
  it("recognizes new-sign-in and blocked-login copy", () => {
    expect(isLoginFyiNotice(["בדוק את פעילות החשבון שלך ב-Linear כדי לוודא שההתחברות מוכרת"])).toBe(
      true,
    );
    expect(isLoginFyiNotice(["Review your account activity on Vercel"])).toBe(true);
    expect(
      isLoginFyiNotice(["התראת אבטחה קריטית: חסמנו ניסיון כניסה לחשבון שלך. כדאי לבדוק מה קרה."]),
    ).toBe(true);
  });

  it("does not treat secure-now mail as dismissible FYI", () => {
    expect(isLoginFyiNotice(["Unusual sign-in detected. Secure your account now."])).toBe(false);
    expect(isSecurityEventNotice(["Unusual sign-in detected. Secure your account now."])).toBe(
      true,
    );
  });
});

describe("isSecurityEventNotice", () => {
  it("treats new-device and Google security alerts as Open", () => {
    expect(
      isSecurityEventNotice(["New sign-in on Windows. If this wasn't you, review activity."]),
    ).toBe(true);
    expect(isSecurityEventNotice(["Google security alert: new device login"])).toBe(true);
    expect(isSecurityEventNotice(["כניסה חדשה ב-Mac OS"])).toBe(true);
  });

  it("treats expired credentials as Open", () => {
    expect(isSecurityEventNotice(["Your Groq API key has expired"])).toBe(true);
    expect(isSecurityEventNotice(["GitHub personal access token expired"])).toBe(true);
  });

  it("does not treat OTP as a security task", () => {
    expect(isSecurityEventNotice(["Your Link verification code: 866 465"])).toBe(false);
  });
});

describe("isAutomatedNoiseNotice", () => {
  it("treats marketing and job alerts as ignore", () => {
    expect(isAutomatedNoiseNotice(["20% off this weekend. Unsubscribe below."])).toBe(true);
    expect(isAutomatedNoiseNotice(["New jobs matching your profile"])).toBe(true);
  });
});

describe("isReceiptOrRoutineNotice", () => {
  it("treats paid receipts as ignore-family and unpaid invoices as tasks", () => {
    expect(isReceiptOrRoutineNotice(["Your payment was successful. Receipt attached."])).toBe(true);
    expect(isReceiptOrRoutineNotice(["Invoice unpaid. Please pay the remaining balance."])).toBe(
      false,
    );
    expect(isReceiptOrRoutineNotice(["התשלום התקבל. קבלה על תשלום מצורפת."])).toBe(true);
  });
});

describe("isDocumentShareNotice", () => {
  it("treats Drive share-with-you mail as FYI", () => {
    expect(isDocumentShareNotice(["Ada shared a document with you. Open in Drive."])).toBe(true);
    expect(isDocumentShareNotice(["דני שיתף איתך מסמך"])).toBe(true);
  });

  it("keeps access requests and review asks as tasks", () => {
    expect(isDocumentShareNotice(["Ada requested access to Invoice Q3"])).toBe(false);
    expect(isDocumentShareNotice(["Ada shared a document with you. Please review and sign."])).toBe(
      false,
    );
  });
});

describe("isNonTaskNotice", () => {
  it("covers OTP and paid receipts but not security events", () => {
    expect(isNonTaskNotice(["verification code 1234"])).toBe(true);
    expect(isNonTaskNotice(["Your payment was successful. Receipt attached."])).toBe(true);
    expect(isNonTaskNotice(["Google security alert: new device login"])).toBe(false);
  });
});

describe("application follow-up vs receipt", () => {
  it("treats interview, assessment, and missing documents as user-owned actions", () => {
    expect(isApplicationFollowUpNotice(["Please send interview availability for Tuesday"])).toBe(
      true,
    );
    expect(isApplicationFollowUpNotice(["Complete the HackerRank assessment to continue"])).toBe(
      true,
    );
    expect(isApplicationFollowUpNotice(["Your application is missing documents"])).toBe(true);
    expect(isUserOwnedActionNotice(["Please complete the assessment"])).toBe(true);
    expect(isApplicationReceiptNotice(["Please complete the assessment after applying"])).toBe(
      false,
    );
  });

  it("treats receipt-only application acknowledgments as non-actions", () => {
    expect(isApplicationReceiptNotice(["Thank you for your application. We received it."])).toBe(
      true,
    );
    expect(isApplicationFollowUpNotice(["Thank you for your application. We received it."])).toBe(
      false,
    );
  });
});

describe("delivery action vs routine tracking", () => {
  it("treats collection, address correction, and customs as actions", () => {
    expect(isDeliveryActionNotice(["Collect your parcel from the depot"])).toBe(true);
    expect(isDeliveryActionNotice(["Delivery address is incorrect. Please update it."])).toBe(true);
    expect(isDeliveryActionNotice(["Provide customs information for this shipment"])).toBe(true);
    expect(isRoutineTrackingNotice(["Collect your parcel from the locker"])).toBe(false);
  });

  it("treats routine tracking as informational", () => {
    expect(isRoutineTrackingNotice(["Your package is out for delivery. Tracking update."])).toBe(
      true,
    );
    expect(isDeliveryActionNotice(["Your package is out for delivery. Tracking update."])).toBe(
      false,
    );
  });
});

describe("automated requests vs access granted", () => {
  it("treats signature, approval, and comment-to-act mail as actions", () => {
    expect(isAutomatedActionRequestNotice(["DocuSign: signature requested on the NDA"])).toBe(true);
    expect(isAutomatedActionRequestNotice(["Approval requested: Q3 budget"])).toBe(true);
    expect(isAutomatedActionRequestNotice(["Ada commented on Spec: please update section 2"])).toBe(
      true,
    );
  });

  it("keeps access-granted shares as FYI", () => {
    expect(isDocumentShareNotice(["Ada shared a document with you. Open in Drive."])).toBe(true);
    expect(isAutomatedActionRequestNotice(["Ada shared a document with you. Open in Drive."])).toBe(
      false,
    );
  });
});

describe("meeting changes", () => {
  it("treats a request to choose or confirm a new time as an action", () => {
    expect(isMeetingTimeChoiceNotice(["The 2pm slot fell through. Please pick a new time."])).toBe(
      true,
    );
    expect(isConfirmedMeetingChangeNotice(["Please pick a new time after the cancellation"])).toBe(
      false,
    );
  });

  it("treats a confirmed reschedule or cancellation as informational", () => {
    expect(
      isConfirmedMeetingChangeNotice(["This meeting has been rescheduled to Tuesday 15:00"]),
    ).toBe(true);
    expect(isConfirmedMeetingChangeNotice(["This event has been cancelled"])).toBe(true);
    expect(isMeetingTimeChoiceNotice(["This meeting has been rescheduled to Tuesday 15:00"])).toBe(
      false,
    );
  });
});

describe("waiting acknowledgments and assigned-to-others", () => {
  it("treats out-of-office and ticket receipts as acknowledgments, not resolution", () => {
    expect(
      isWaitingAcknowledgmentNotice(["Automatic reply: I am out of the office until Monday"]),
    ).toBe(true);
    expect(
      isWaitingAcknowledgmentNotice(["Ticket 1842 has been created. We received your request."]),
    ).toBe(true);
  });

  it("does not treat a ticket that asks the user to act as a waiting ack", () => {
    expect(
      isWaitingAcknowledgmentNotice(["We received your ticket. Please approve the proposed fix."]),
    ).toBe(false);
  });

  it("treats work assigned only to someone else as FYI", () => {
    expect(isAssignedToSomeoneElseNotice(["Assigned to Jordan to complete the checklist"])).toBe(
      true,
    );
    expect(
      isAssignedToSomeoneElseNotice(["Looping you in for visibility. No action needed from you."]),
    ).toBe(true);
    expect(isAssignedToSomeoneElseNotice(["Assigned to you. Please approve the budget."])).toBe(
      false,
    );
  });
});
