export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

/**
 * Returns 今天 / 明天 / 後天 when the date is within the next two days,
 * otherwise null. Helps shift cards feel local and immediate.
 */
export function formatRelativeDay(dateStr: string): string | null {
  const target = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000
  );

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "明天";
  if (diffDays === 2) return "後天";
  return null;
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} – ${end}`;
}

export function formatCurrency(amount: number): string {
  return `NT$ ${Math.round(amount).toLocaleString("en-US")}`;
}

/** "3 小時" / "2.5 小時" — trims trailing zeros for clean display. */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${display} 小時`;
}

/** Relative timestamp for application lists: 剛剛 / X 分鐘前 / 昨天 / 日期. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const diffMin = Math.floor((Date.now() - then) / 60_000);
  if (diffMin < 1) return "剛剛";
  if (diffMin < 60) return `${diffMin} 分鐘前`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小時前`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "昨天";
  if (diffDay < 7) return `${diffDay} 天前`;

  return new Date(iso).toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
  });
}

/** First character of a name, for avatar placeholders. */
export function getInitial(name: string): string {
  return name.trim().charAt(0) || "?";
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
