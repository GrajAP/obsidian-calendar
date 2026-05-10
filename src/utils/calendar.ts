import { AppSettings, Event, FirstDayOfWeek, TimeFormat } from '../types';
import { defaultSettings, t } from './settings';

export const pad = (value: number) => String(value).padStart(2, '0');

export const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDateKey = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const startOfWeek = (date: Date, firstDay: FirstDayOfWeek = 'mon') => {
  const offset = firstDay === 'mon' ? (date.getDay() + 6) % 7 : date.getDay();
  return addDays(date, -offset);
};

export const toMondayIndex = (date: Date) => (date.getDay() + 6) % 7;

export const formatDateInput = (dateKey: string) => {
  if (!dateKey) return '';
  const date = parseDateKey(dateKey);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const parseDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
      return toDateKey(candidate);
    }
    return undefined;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
      return toDateKey(candidate);
    }
  }

  return undefined;
};

const formatDateKeyNumeric = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const formatDisplayDate = (dateKey: string) => {
  return formatDateKeyNumeric(dateKey);
};

export const formatHeaderDate = (dateKey: string) => {
  return formatDateKeyNumeric(dateKey);
};

export const formatColumnDate = (date: Date, language: AppLanguage = 'en') => (
  `${(language === 'pl' ? ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])[toMondayIndex(date)]} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
);

export const formatTimeInput = (time?: string) => {
  if (!time) return '';
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  return `${pad(Number(match[1]))}:${pad(Number(match[2]))}`;
};

export const parseTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return `${pad(hours)}:${pad(minutes)}`;
};

export const formatClock = (time: string | undefined, format: TimeFormat) => {
  if (!time || format === '24') return time || '';
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;
  return `${hour}:${pad(minutes)} ${suffix}`;
};

export const getEventTime = (event: Event, settings: AppSettings = defaultSettings) => {
  if (event.allDay) return t(settings, 'all-day', 'cały dzień');
  if (event.startTime && event.endTime) return `${formatClock(event.startTime, settings.timeFormat)} - ${formatClock(event.endTime, settings.timeFormat)}`;
  return formatClock(event.startTime, settings.timeFormat) || t(settings, 'No time', 'Bez godziny');
};

export const timeToMinutes = (time?: string, fallback = 9 * 60) => {
  if (!time) return fallback;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return hours * 60 + minutes;
};
