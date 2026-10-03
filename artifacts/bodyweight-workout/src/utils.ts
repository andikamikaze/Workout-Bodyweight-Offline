export function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function formatShortDate(value: string, locale = 'id-ID') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
}