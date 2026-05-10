export interface Event {
  title: string;
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  completed: string | null;
  path?: string;
  timezone?: string;
  seriesId?: string;
  seriesParentId?: string;
  generatedOccurrence?: boolean;
  recurring?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
    weekdays?: number[];
    monthlyMode?: 'dayOfMonth' | 'weekdayOfMonth';
    materializeCount?: number;
  };
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';
export type AppLanguage = 'en' | 'pl';
export type TimeFormat = '24' | '12';
export type FirstDayOfWeek = 'mon' | 'sun';

export interface AppSettings {
  eventsFolder: string;
  language: AppLanguage;
  timeFormat: TimeFormat;
  firstDayOfWeek: FirstDayOfWeek;
}

export interface SourceFileState {
  path: string;
  title: string;
  content: string;
}
