import { AppLanguage, AppSettings, FirstDayOfWeek } from '../types';

export const defaultSettings: AppSettings = {
  eventsFolder: '/home/grajpap/other/Obsidian Vault/obsidian/Events',
  language: 'en',
  timeFormat: '24',
  firstDayOfWeek: 'mon'
};

export const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem('obsidian-calendar-settings');
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem('obsidian-calendar-settings', JSON.stringify(settings));
};

const monthNamesEn = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const monthNamesPl = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

const weekdayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const weekdayNamesPl = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
const weekdayLongNamesEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weekdayLongNamesPl = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

export const weekdayCodes = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export const getMonthNames = (language: AppLanguage) => language === 'pl' ? monthNamesPl : monthNamesEn;

export const getWeekdayNames = (language: AppLanguage, firstDay: FirstDayOfWeek) => {
  const names = language === 'pl' ? weekdayNamesPl : weekdayNamesEn;
  return firstDay === 'sun' ? [names[6], ...names.slice(0, 6)] : names;
};

export const getWeekdayLongNames = (language: AppLanguage) => language === 'pl' ? weekdayLongNamesPl : weekdayLongNamesEn;

export const t = (settings: AppSettings, en: string, pl: string) => settings.language === 'pl' ? pl : en;
