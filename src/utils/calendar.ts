import { AppLanguage, AppSettings, Event, FirstDayOfWeek, TimeFormat } from '../types';
import { defaultSettings, getMonthNames, t } from './settings';

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

export const formatDisplayDate = (dateKey: string, language: AppLanguage = 'en') => {
  const date = parseDateKey(dateKey);
  return `${date.getDate()} ${getMonthNames(language)[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatHeaderDate = (dateKey: string, language: AppLanguage = 'en') => {
  const date = parseDateKey(dateKey);
  return language === 'pl'
    ? `${date.getDate()} ${getMonthNames(language)[date.getMonth()]} ${date.getFullYear()}`
    : `${getMonthNames(language)[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

export const formatColumnDate = (date: Date, language: AppLanguage = 'en') => (
  `${(language === 'pl' ? ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])[toMondayIndex(date)]} ${date.getMonth() + 1}/${date.getDate()}`
);

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
