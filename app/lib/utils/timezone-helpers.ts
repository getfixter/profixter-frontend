/**
 * Timezone Helpers для America/New_York
 * Утиліти для роботи з датами в EST/EDT timezone
 */

import { formatInTimeZone } from 'date-fns-tz';
import { parseISO, format } from 'date-fns';

const NY_TIMEZONE = 'America/New_York';

/**
 * Конвертує дату в формат YYYY-MM-DD в NY timezone
 */
export function toYMDNY(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, NY_TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Форматує дату і час для відображення в NY timezone
 */
export function formatDateTimeNY(date: Date | string, formatStr = 'PPpp'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, NY_TIMEZONE, formatStr);
}

/**
 * Форматує тільки час в NY timezone
 */
export function formatTimeNY(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, NY_TIMEZONE, 'h:mm a');
}

/**
 * Форматує тільки дату в NY timezone
 */
export function formatDateNY(date: Date | string, formatStr = 'MMMM d, yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, NY_TIMEZONE, formatStr);
}

/**
 * Перевіряє чи дата є сьогодні в NY timezone
 */
export function isTodayNY(date: Date | string): boolean {
  const today = toYMDNY(new Date());
  const checkDate = toYMDNY(typeof date === 'string' ? parseISO(date) : date);
  return today === checkDate;
}

/**
 * Отримує поточну дату в NY timezone (YYYY-MM-DD)
 */
export function getTodayNY(): string {
  return toYMDNY(new Date());
}

/**
 * Форматує повну адресу
 */
export function formatAddress(
  address?: string,
  city?: string,
  state?: string,
  zip?: string
): string {
  const parts = [address, city, state, zip].filter(Boolean);
  return parts.join(', ').trim();
}

/**
 * Санітайз телефонного номера для tel: протоколу
 */
export function sanitizeTel(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}
