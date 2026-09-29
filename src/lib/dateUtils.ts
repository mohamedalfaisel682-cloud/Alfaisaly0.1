/**
 * Date and Time utilities for Al-Faisali Maintenance System.
 * Ensures consistent timezone handling, prevents local vs UTC shifts,
 * and standardizes execution times for tasks and reminders.
 */

/**
 * Converts any Date object, ISO string, or timestamp into the local `YYYY-MM-DDTHH:mm` format
 * required by HTML5 `<input type="datetime-local">`.
 * Uses the client's actual local timezone, NOT UTC.
 */
export function formatToDateTimeLocal(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Parses a value from `<input type="datetime-local">` (or ISO string) into a standard ISO 8601 UTC string.
 * Accurately interprets input as local device time, preventing timezone offset bugs.
 */
export function parseDateTimeLocalToISO(val: string | null | undefined): string | null {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();

  // If it's already an ISO string with Z or timezone offset
  if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // If it's YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss (from datetime-local)
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, y, m, d, h, min, s] = match;
    const localDate = new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      parseInt(h, 10),
      parseInt(min, 10),
      s ? parseInt(s, 10) : 0
    );
    return isNaN(localDate.getTime()) ? null : localDate.toISOString();
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Calculates the default execution time: 6 hours after the task's creation date/time.
 */
export function getDefaultExecutionTime(createdAt?: string | Date | null): string {
  const baseDate = createdAt ? new Date(createdAt) : new Date();
  const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  // Exactly 6 hours later (6 * 60 * 60 * 1000 ms)
  const targetDate = new Date(validBase.getTime() + 6 * 60 * 60 * 1000);
  return targetDate.toISOString();
}

/**
 * Safely parses any stored executionTime to a Date object, handling both ISO with Z and local strings.
 */
export function parseExecutionTimeToDate(executionTime: string | null | undefined): Date | null {
  if (!executionTime || !executionTime.trim()) return null;
  const trimmed = executionTime.trim();

  // If it's YYYY-MM-DDTHH:mm without timezone info, treat as local time
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, y, m, d, h, min, s] = match;
    const localDate = new Date(
      parseInt(y, 10),
      parseInt(m, 10) - 1,
      parseInt(d, 10),
      parseInt(h, 10),
      parseInt(min, 10),
      s ? parseInt(s, 10) : 0
    );
    return isNaN(localDate.getTime()) ? null : localDate;
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats date/time in clear Arabic format for task views, modals, and notifications.
 */
export function formatExecutionTimeArabic(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'غير محدد';
  const d = parseExecutionTimeToDate(typeof dateInput === 'string' ? dateInput : dateInput.toISOString());
  if (!d) return 'غير محدد';

  try {
    const timeStr = d.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
    const dateStr = d.toLocaleDateString('ar-YE', { day: 'numeric', month: 'numeric', year: 'numeric' });
    return `${timeStr} (${dateStr})`;
  } catch {
    return d.toLocaleString('ar-SA');
  }
}
