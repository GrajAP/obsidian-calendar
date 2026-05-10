import { Event } from '../types';
import { addDays, parseDateKey, toDateKey, toMondayIndex } from './calendar';
import { weekdayCodes } from './settings';

export const defaultSeriesId = () => `series-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const defaultMaterializeCount = (type?: Event['recurring']['type']) => {
  if (type === 'yearly') return 3;
  if (type === 'monthly') return 12;
  if (type === 'weekly') return 12;
  if (type === 'daily') return 14;
  return 3;
};

export const sortEvents = (events: Event[]) => [...events].sort((a, b) => {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
});

const slugifyFilePart = (value: string) => value
  .replace(/[\\/:*?"<>|]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 70) || 'Untitled';

export const getEventFilePath = (event: Event, eventsFolder: string) => `${eventsFolder}/${event.date} ${slugifyFilePart(event.title)}.md`;

const parseFrontmatterValue = (frontmatter: string, key: string) => {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return match?.[1]?.trim();
};

const parseBooleanValue = (value?: string) => value === 'true';

const parseWeekdays = (value?: string) => {
  if (!value) return undefined;
  const days = value
    .split(',')
    .map(day => weekdayCodes.indexOf(day.trim().toUpperCase()))
    .filter(day => day >= 0);
  return days.length ? days : undefined;
};

const formatWeekdays = (days: number[]) => days
  .sort((a, b) => a - b)
  .map(day => weekdayCodes[day])
  .join(',');

export const parseFrontmatter = (content: string): Event | null => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const title = parseFrontmatterValue(frontmatter, 'title');
  const date = parseFrontmatterValue(frontmatter, 'date');
  if (!title || !date) return null;

  const allDay = parseFrontmatterValue(frontmatter, 'allDay') !== 'false';
  const completed = parseFrontmatterValue(frontmatter, 'completed');
  const recurringType = parseFrontmatterValue(frontmatter, 'recurringType') as Event['recurring']['type'] | undefined;
  const recurringInterval = Number(parseFrontmatterValue(frontmatter, 'recurringInterval') || 1);
  const recurringEnd = parseFrontmatterValue(frontmatter, 'recurringEnd');
  const materializeCountValue = parseFrontmatterValue(frontmatter, 'recurringMaterializeCount');
  const materializeCount = materializeCountValue === undefined
    ? defaultMaterializeCount(recurringType)
    : Number(materializeCountValue);

  return {
    title,
    date,
    allDay,
    startTime: parseFrontmatterValue(frontmatter, 'startTime'),
    endTime: parseFrontmatterValue(frontmatter, 'endTime'),
    completed: completed && completed !== 'null' ? completed : null,
    timezone: parseFrontmatterValue(frontmatter, 'timezone'),
    seriesId: parseFrontmatterValue(frontmatter, 'seriesId'),
    seriesParentId: parseFrontmatterValue(frontmatter, 'seriesParentId'),
    generatedOccurrence: parseBooleanValue(parseFrontmatterValue(frontmatter, 'generatedOccurrence')),
    recurring: recurringType ? {
      type: recurringType,
      interval: Number.isFinite(recurringInterval) ? recurringInterval : 1,
      endDate: recurringEnd,
      weekdays: parseWeekdays(parseFrontmatterValue(frontmatter, 'recurringWeekdays')),
      monthlyMode: parseFrontmatterValue(frontmatter, 'recurringMonthlyMode') as Event['recurring']['monthlyMode'] | undefined,
      materializeCount: Number.isFinite(materializeCount) ? materializeCount : defaultMaterializeCount(recurringType)
    } : undefined
  };
};

export const formatFrontmatter = (event: Event): string => {
  const lines = ['---', `title: ${event.title}`, `allDay: ${event.allDay}`];

  if (!event.allDay) {
    lines.push(`startTime: ${event.startTime || '09:00'}`);
    lines.push(`endTime: ${event.endTime || event.startTime || '10:00'}`);
  }

  lines.push(`date: ${event.date}`);
  lines.push(`completed: ${event.completed || 'null'}`);
  if (event.timezone) lines.push(`timezone: ${event.timezone}`);
  if (event.seriesId) lines.push(`seriesId: ${event.seriesId}`);
  if (event.seriesParentId) lines.push(`seriesParentId: ${event.seriesParentId}`);
  if (event.generatedOccurrence) lines.push('generatedOccurrence: true');

  if (event.recurring) {
    lines.push(`recurringType: ${event.recurring.type}`);
    lines.push(`recurringInterval: ${event.recurring.interval}`);
    if (event.recurring.endDate) lines.push(`recurringEnd: ${event.recurring.endDate}`);
    if (event.recurring.weekdays?.length) lines.push(`recurringWeekdays: ${formatWeekdays(event.recurring.weekdays)}`);
    if (event.recurring.monthlyMode) lines.push(`recurringMonthlyMode: ${event.recurring.monthlyMode}`);
    lines.push(`recurringMaterializeCount: ${event.recurring.materializeCount ?? defaultMaterializeCount(event.recurring.type)}`);
  }

  lines.push('---', '#event', '');
  return lines.join('\n');
};

const getSeriesKey = (event: Event) => event.seriesParentId || event.seriesId || `${event.date}:${event.title}`;
const getNthWeekdayInMonth = (date: Date) => Math.floor((date.getDate() - 1) / 7) + 1;

const matchesRecurringRule = (event: Event, cursor: Date) => {
  if (!event.recurring) return false;

  const start = parseDateKey(event.date);
  const diffDays = Math.floor((cursor.getTime() - start.getTime()) / 86400000);
  if (diffDays < 0) return false;

  const interval = Math.max(event.recurring.interval, 1);

  if (event.recurring.type === 'daily') return diffDays % interval === 0;

  if (event.recurring.type === 'weekly') {
    const weekDiff = Math.floor(diffDays / 7);
    const weekdays = event.recurring.weekdays?.length ? event.recurring.weekdays : [toMondayIndex(start)];
    return weekDiff % interval === 0 && weekdays.includes(toMondayIndex(cursor));
  }

  if (event.recurring.type === 'monthly') {
    const monthDiff = (cursor.getFullYear() - start.getFullYear()) * 12 + cursor.getMonth() - start.getMonth();
    if (monthDiff < 0 || monthDiff % interval !== 0) return false;

    if (event.recurring.monthlyMode === 'weekdayOfMonth') {
      return toMondayIndex(cursor) === toMondayIndex(start)
        && getNthWeekdayInMonth(cursor) === getNthWeekdayInMonth(start);
    }

    return cursor.getDate() === start.getDate();
  }

  const yearDiff = cursor.getFullYear() - start.getFullYear();
  return cursor.getMonth() === start.getMonth()
    && cursor.getDate() === start.getDate()
    && yearDiff >= 0
    && yearDiff % interval === 0;
};

export const getRecurringOccurrences = (event: Event, from: string, to: string, includeStart = true) => {
  if (!event.recurring) return [];

  const fromDate = parseDateKey(from);
  const toDate = parseDateKey(to);
  const start = parseDateKey(event.date);
  const end = event.recurring.endDate ? parseDateKey(event.recurring.endDate) : toDate;
  const occurrences: Event[] = [];

  for (let cursor = new Date(Math.max(start.getTime(), fromDate.getTime())); cursor <= toDate && cursor <= end; cursor = addDays(cursor, 1)) {
    const dateKey = toDateKey(cursor);
    if (!includeStart && dateKey === event.date) continue;
    if (matchesRecurringRule(event, cursor)) occurrences.push({ ...event, date: dateKey });
  }

  return occurrences;
};

export const buildMaterializedOccurrences = (event: Event) => {
  if (!event.recurring) return [];

  const count = Math.max(event.recurring.materializeCount ?? defaultMaterializeCount(event.recurring.type), 0);
  if (count === 0) return [];

  const seriesId = event.seriesId || defaultSeriesId();
  const from = toDateKey(addDays(parseDateKey(event.date), 1));
  const interval = Math.max(event.recurring.interval, 1);
  const horizonDays = event.recurring.type === 'yearly'
    ? 370 * (count + 1) * interval
    : event.recurring.type === 'monthly'
      ? 34 * (count + 1) * interval
      : event.recurring.type === 'weekly'
        ? 8 * (count + 1) * interval
        : count * interval + 14;
  const fallbackTo = toDateKey(addDays(parseDateKey(event.date), horizonDays));
  const to = event.recurring.endDate || fallbackTo;

  return getRecurringOccurrences({ ...event, seriesId }, from, to, false)
    .slice(0, count)
    .map(occurrence => ({
      ...occurrence,
      recurring: undefined,
      seriesId: undefined,
      seriesParentId: seriesId,
      generatedOccurrence: true,
      completed: null
    }));
};

export const expandRecurringEvents = (events: Event[], from: string, to: string) => {
  const occurrences: Event[] = [];
  const generatedKeys = new Set(
    events
      .filter(event => event.generatedOccurrence && event.seriesParentId)
      .map(event => `${event.seriesParentId}:${event.date}`)
  );

  for (const event of events) {
    if (!event.recurring) {
      if (event.date >= from && event.date <= to) occurrences.push(event);
      continue;
    }

    const seriesKey = getSeriesKey(event);
    occurrences.push(
      ...getRecurringOccurrences(event, from, to).filter(occurrence => (
        occurrence.date === event.date || !generatedKeys.has(`${seriesKey}:${occurrence.date}`)
      ))
    );
  }

  return sortEvents(occurrences);
};
