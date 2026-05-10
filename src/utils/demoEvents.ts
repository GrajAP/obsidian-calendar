import { Event } from '../types';
import { addDays, toDateKey, toMondayIndex } from './calendar';

const today = new Date();
const nextWeek = addDays(today, 7);
const todayKey = toDateKey(today);
const tomorrowKey = toDateKey(addDays(today, 1));
const nextWeekKey = toDateKey(nextWeek);

export const demoEvents: Event[] = [
  {
    title: 'All-day planning note',
    date: todayKey,
    allDay: true,
    completed: null
  },
  {
    title: 'Review calendar layout',
    date: todayKey,
    allDay: false,
    startTime: '09:30',
    endTime: '10:45',
    completed: null
  },
  {
    title: 'Write Obsidian notes',
    date: todayKey,
    allDay: false,
    startTime: '13:00',
    endTime: '14:30',
    completed: null
  },
  {
    title: 'Small evening task',
    date: todayKey,
    allDay: false,
    startTime: '18:15',
    endTime: '19:00',
    completed: null
  },
  {
    title: 'Tomorrow reminder',
    date: tomorrowKey,
    allDay: false,
    startTime: '11:00',
    endTime: '12:00',
    completed: null
  },
  {
    title: 'Weekly recurring sample',
    date: nextWeekKey,
    allDay: false,
    startTime: '15:00',
    endTime: '16:00',
    completed: null,
    recurring: {
      type: 'weekly',
      interval: 1,
      weekdays: [toMondayIndex(nextWeek)],
      materializeCount: 4
    }
  }
];
