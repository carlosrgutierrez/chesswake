export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function nextOccurrence(time: string, now = new Date()): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export function isDue(time: string, now: Date, lastFiredDate: string | null): boolean {
  const [hours, minutes] = time.split(':').map(Number);
  return now.getHours() === hours && now.getMinutes() === minutes && lastFiredDate !== localDateKey(now);
}

export function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(part => String(part).padStart(2, '0')).join(':');
}

export function canEmergencyStop(startedAt: string, now = Date.now()): boolean {
  return now - new Date(startedAt).getTime() >= 120000;
}
