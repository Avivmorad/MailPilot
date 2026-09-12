export function actionChangeAnnouncement(op: string | undefined): string {
  switch (op) {
    case "complete":
      return "Task marked done.";
    case "reopen":
      return "Task moved back to Open.";
    case "snooze":
      return "Task snoozed.";
    case "wait":
      return "Waiting on updated.";
    default:
      return "Task updated.";
  }
}
