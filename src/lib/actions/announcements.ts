export function actionChangeAnnouncement(op: string | undefined): string {
  switch (op) {
    case "complete":
      return "Task marked closed.";
    case "reopen":
      return "Task moved back to Actions.";
    case "snooze":
      return "Task snoozed.";
    case "wait":
      return "Pending on updated.";
    default:
      return "Task updated.";
  }
}
