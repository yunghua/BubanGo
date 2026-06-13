export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} – ${end}`;
}

export function formatCurrency(amount: number): string {
  return `NT$ ${amount}`;
}

export function getShiftStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "招募中",
    matched: "已媒合",
    filled: "已滿員",
    completed: "已完成",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

export function calculateHours(start: string, end: string): number {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  return (endH * 60 + endM - (startH * 60 + startM)) / 60;
}

export function getApplicationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "審核中",
    accepted: "已錄取",
    rejected: "未錄取",
  };
  return labels[status] ?? status;
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
