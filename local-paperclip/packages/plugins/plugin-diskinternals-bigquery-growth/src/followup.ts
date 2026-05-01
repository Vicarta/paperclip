export function followupWindows(changeDate: string, now = new Date()) {
  const changed = new Date(`${changeDate}T00:00:00.000Z`);
  const elapsedDays = Math.floor((now.getTime() - changed.getTime()) / 86_400_000);
  return [7, 14, 28].map((days) => ({
    days,
    due: elapsedDays >= days,
  }));
}
