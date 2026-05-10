import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import DateInput from './DateInput';
import { AppSettings, CalendarViewMode, Event } from '../types';
import { addDays, formatClock, formatColumnDate, formatDisplayDate, formatHeaderDate, getEventTime, pad, parseDateKey, startOfWeek, timeToMinutes, toDateKey, toMondayIndex } from '../utils/calendar';
import { expandRecurringEvents, sortEvents } from '../utils/events';
import { getMonthNames, getWeekdayLongNames, getWeekdayNames, t } from '../utils/settings';

interface EventPillProps {
  event: Event;
  settings: AppSettings;
  onClick: () => void;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

const EventPill = ({ event, settings, onClick, compact = false, className = '', style }: EventPillProps) => {
  const birthdayLabel = getBirthdayLabel(event);
  const nameDayLabel = event.nameDay ? (settings.language === 'pl' ? 'imieniny' : 'name day') : undefined;
  const specialLabel = birthdayLabel || nameDayLabel;

  return (
    <button className={`event-pill ${event.completed ? 'completed' : ''} ${compact ? 'compact' : ''} ${event.nameDay ? 'nameday-event' : event.birthday ? 'birthday-event' : event.source ? `${event.source}-event` : ''} ${className}`.trim()} style={style} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {!event.allDay && <span>{event.startTime}</span>}
      <strong>{event.title}{specialLabel ? ` (${specialLabel})` : ''}</strong>
    </button>
  );
};

interface TimedEventLayout {
  event: Event;
  column: number;
  columns: number;
}

const upcomingEventsLimit = 13;

const formatOrdinal = (value: number) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1: return `${value}st`;
    case 2: return `${value}nd`;
    case 3: return `${value}rd`;
    default: return `${value}th`;
  }
};

const getBirthdayLabel = (event: Event) => {
  if (!event.birthday || !event.dateOfBirth) return undefined;
  const birthYear = parseDateKey(event.dateOfBirth).getFullYear();
  const age = parseDateKey(event.date).getFullYear() - birthYear;
  if (!Number.isFinite(age) || age <= 0) return undefined;
  return `${formatOrdinal(age)} birthday`;
};

const layoutTimedEvents = (events: Event[]): TimedEventLayout[] => {
  const sorted = sortEvents(events).map((event, index) => {
    const start = timeToMinutes(event.startTime);
    const end = Math.max(timeToMinutes(event.endTime, start + 60), start + 30);
    return { event, index, start, end };
  });
  const groups: typeof sorted[] = [];
  let currentGroup: typeof sorted = [];
  let currentGroupEnd = -1;

  sorted.forEach(item => {
    if (currentGroup.length === 0 || item.start < currentGroupEnd) {
      currentGroup.push(item);
      currentGroupEnd = Math.max(currentGroupEnd, item.end);
      return;
    }

    groups.push(currentGroup);
    currentGroup = [item];
    currentGroupEnd = item.end;
  });

  if (currentGroup.length) groups.push(currentGroup);

  return groups.flatMap(group => {
    const columnEnds: number[] = [];
    const placements = group.map(item => {
      const availableColumn = columnEnds.findIndex(end => end <= item.start);
      const column = availableColumn >= 0 ? availableColumn : columnEnds.length;
      columnEnds[column] = item.end;
      return { ...item, column };
    });
    const columns = columnEnds.length || 1;

    return placements.map(({ event, column }) => ({ event, column, columns }));
  });
};

interface CalendarViewProps {
  events: Event[];
  selectedDate: string;
  viewDate: Date;
  viewMode: CalendarViewMode;
  query: string;
  settings: AppSettings;
  onSelectDate: (date: string) => void;
  onSetViewDate: (date: Date) => void;
  onSetViewMode: (mode: CalendarViewMode) => void;
  onCreate: (date: string) => void;
  onEdit: (event: Event) => void;
  onQuery: (query: string) => void;
  onOpenSettings: () => void;
}

const CalendarView = ({
  events,
  selectedDate,
  viewDate,
  viewMode,
  query,
  settings,
  onSelectDate,
  onSetViewDate,
  onSetViewMode,
  onCreate,
  onEdit,
  onQuery,
  onOpenSettings
}: CalendarViewProps) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthNames = getMonthNames(settings.language);
  const weekdayNames = getWeekdayNames(settings.language, settings.firstDayOfWeek);
  const weekdayLongNames = getWeekdayLongNames(settings.language);
  const todayKey = toDateKey(new Date());
  const monthStart = new Date(year, month, 1);
  const gridStart = startOfWeek(monthStart, settings.firstDayOfWeek);
  const monthEnd = new Date(year, month + 1, 0);
  const gridEnd = addDays(startOfWeek(monthEnd, settings.firstDayOfWeek), 6);
  const weekStart = startOfWeek(parseDateKey(selectedDate), settings.firstDayOfWeek);
  const weekEnd = addDays(weekStart, 6);

  const visibleRange = viewMode === 'month'
    ? { from: toDateKey(gridStart), to: toDateKey(gridEnd) }
    : viewMode === 'week'
      ? { from: toDateKey(weekStart), to: toDateKey(weekEnd) }
      : viewMode === 'day'
        ? { from: selectedDate, to: selectedDate }
        : { from: todayKey, to: toDateKey(addDays(new Date(), 365)) };

  const visibleEvents = useMemo(() => {
    const expanded = expandRecurringEvents(events, visibleRange.from, visibleRange.to);
    const needle = query.trim().toLowerCase();
    if (!needle) return expanded;
    return expanded.filter(event => event.title.toLowerCase().includes(needle) || event.date.includes(needle));
  }, [events, visibleRange.from, visibleRange.to, query]);

  const eventsByDate = useMemo(() => visibleEvents.reduce<Record<string, Event[]>>((acc, event) => {
    acc[event.date] = [...(acc[event.date] || []), event];
    return acc;
  }, {}), [visibleEvents]);

  const selectedEvents = sortEvents(eventsByDate[selectedDate] || []);
  const upcomingEvents = sortEvents(expandRecurringEvents(events, todayKey, toDateKey(addDays(new Date(), 21)))).slice(0, upcomingEventsLimit);

  const movePeriod = (direction: -1 | 1) => {
    if (viewMode === 'month' || viewMode === 'list') onSetViewDate(new Date(year, month + direction, 1));
    if (viewMode === 'week') {
      const next = addDays(weekStart, direction * 7);
      onSetViewDate(next);
      onSelectDate(toDateKey(next));
    }
    if (viewMode === 'day') {
      const next = addDays(parseDateKey(selectedDate), direction);
      onSetViewDate(next);
      onSelectDate(toDateKey(next));
    }
  };

  const goToToday = () => {
    const now = new Date();
    onSetViewDate(now);
    onSelectDate(toDateKey(now));
  };

  const goToDate = (dateKey: string) => {
    if (!dateKey) return;
    onSelectDate(dateKey);
    onSetViewDate(parseDateKey(dateKey));
  };

  const title = viewMode === 'month' || viewMode === 'list'
    ? `${monthNames[month]} ${year}`
    : viewMode === 'week'
      ? `${formatDisplayDate(toDateKey(weekStart), settings.language)} – ${formatDisplayDate(toDateKey(weekEnd), settings.language)}`
      : formatDisplayDate(selectedDate, settings.language);

  const renderMonth = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentTimeTop = (currentMinutes / (24 * 60)) * 100;

    return (
      <div className="month-grid">
        {weekdayNames.map(day => <div className="weekday" key={day}>{day}</div>)}
        {Array.from({ length: 42 }).map((_, index) => {
          const date = addDays(gridStart, index);
          const dateKey = toDateKey(date);
          const dayEvents = sortEvents(eventsByDate[dateKey] || []);
          const monthEvents = dayEvents.slice(0, 4);
          const renderedMonthEvents = monthEvents.length;
          const isMuted = date.getMonth() !== month;
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === todayKey;

          return (
            <button
              key={dateKey}
              className={`month-day ${isMuted ? 'muted' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectDate(dateKey)}
              onDoubleClick={() => onCreate(dateKey)}
            >
              <div className="month-day-header">
                <span className="day-number">{date.getDate()}</span>
              </div>
              <div className="day-events">
                <div className="month-events-stack">
                  {monthEvents.map((event, idx) => (
                    <EventPill key={`${event.path || event.title}-${idx}`} event={event} settings={settings} compact onClick={() => onEdit(event)} />
                  ))}
                </div>
                {dayEvents.length > renderedMonthEvents && <span className="more-events month-more-events">+{dayEvents.length - renderedMonthEvents}</span>}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderTimeGrid = (dates: Date[]) => {
    const now = new Date();
    const hours = Array.from({ length: 24 }, (_, index) => index);
    const timelineStart = 0;
    const timelineEnd = 24 * 60;
    const timelineSpan = timelineEnd - timelineStart;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentTimeTop = ((currentMinutes - timelineStart) / timelineSpan) * 100;
    const showCurrentTime = currentMinutes >= timelineStart && currentMinutes <= timelineEnd;

    return (
      <div className={`time-grid ${dates.length === 1 ? 'single-day' : ''}`}>
        <div className="time-grid-header">
          <div className="time-axis-spacer"></div>
          {dates.map(date => {
            const dateKey = toDateKey(date);
            return (
              <button key={dateKey} className={`time-day-header ${dateKey === selectedDate ? 'selected' : ''}`} onClick={() => onSelectDate(dateKey)}>
                {formatColumnDate(date, settings.language)}
              </button>
            );
          })}
        </div>

        <div className="all-day-row">
          <div className="time-axis-label">{t(settings, 'all-day', 'cały dzień')}</div>
          {dates.map(date => {
            const dateKey = toDateKey(date);
            const allDayEvents = sortEvents(eventsByDate[dateKey] || []).filter(event => event.allDay);
            return (
              <div className="all-day-cell" key={dateKey}>
                {allDayEvents.map((event, idx) => (
                  <EventPill key={`${event.path || event.title}-${idx}`} event={event} settings={settings} compact onClick={() => onEdit(event)} />
                ))}
              </div>
            );
          })}
        </div>

        <div className="time-grid-body">
          <div className="time-axis">
            {hours.map(hour => <div key={hour} className="hour-label">{pad(hour)}:00</div>)}
          </div>
          <div className="time-columns">
            {dates.map(date => {
              const dateKey = toDateKey(date);
              const timedEvents = sortEvents(eventsByDate[dateKey] || []).filter(event => !event.allDay);
              const timedEventLayouts = layoutTimedEvents(timedEvents);
              return (
                <div className={`time-column ${dateKey === todayKey ? 'today-column' : ''}`} key={dateKey} onDoubleClick={() => onCreate(dateKey)}>
                  {hours.map(hour => <div key={hour} className="hour-line"></div>)}
                  {dateKey === todayKey && showCurrentTime && (
                    <div className="current-time-line" style={{ top: `${currentTimeTop}%` }}>
                      <span></span>
                    </div>
                  )}
                  {timedEventLayouts.map(({ event, column, columns }, idx) => {
                    const start = timeToMinutes(event.startTime);
                    const end = Math.max(timeToMinutes(event.endTime, start + 60), start + 30);
                    const top = ((start - timelineStart) / timelineSpan) * 100;
                    const height = ((end - start) / timelineSpan) * 100;
                    const width = 100 / columns;
                    const eventGap = columns > 1 ? 3 : 0;

                    return (
                      <button
                        key={`${event.path || event.title}-${idx}`}
                        className={`time-event ${event.nameDay ? 'nameday-event' : event.birthday ? 'birthday-event' : event.source ? `${event.source}-event` : ''}`}
                        style={{
                          top: `${Math.max(top, 0)}%`,
                          height: `${Math.max(height, 7)}%`,
                          left: `calc(${column * width}% + 4px)`,
                          right: `calc(${100 - ((column + 1) * width)}% + 4px)`,
                          marginRight: `${eventGap}px`
                        }}
                        onClick={() => onEdit(event)}
                      >
                        <span>{formatClock(event.startTime, settings.timeFormat)} - {formatClock(event.endTime, settings.timeFormat)}</span>
                        <strong>{event.title}</strong>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderWeek = () => renderTimeGrid(Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index)));
  const renderDay = () => renderTimeGrid([parseDateKey(selectedDate)]);

  const renderSelectedDayMini = () => {
    const now = new Date();
    const allDayEvents = selectedEvents.filter(event => event.allDay);
    const timedEvents = selectedEvents.filter(event => !event.allDay);
    const timedEventLayouts = layoutTimedEvents(timedEvents);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const firstTimedStart = Math.min(
      ...timedEvents.map(event => timeToMinutes(event.startTime)),
      selectedDate === todayKey ? currentMinutes : 24 * 60
    );
    const timelineStartHour = Math.floor(firstTimedStart / 60);
    const timelineStart = timelineStartHour * 60;
    const timelineEnd = 24 * 60;
    const timelineSpan = timelineEnd - timelineStart;
    const hours = Array.from({ length: 24 - timelineStartHour }, (_, index) => timelineStartHour + index);
    const showCurrentTime = selectedDate === todayKey && currentMinutes >= timelineStart;

    return (
      <div className="mini-day-view">
        {allDayEvents.length > 0 && (
          <div className="mini-all-day-row">
            <span>{t(settings, 'all-day', 'cały dzień')}</span>
            <div>
              {allDayEvents.map((event, idx) => (
                <EventPill key={`${event.path || event.title}-${idx}`} event={event} settings={settings} compact onClick={() => onEdit(event)} />
              ))}
            </div>
          </div>
        )}

        {(timedEvents.length > 0 || showCurrentTime) && (
          <div className="mini-day-body">
            <div className="mini-time-axis" style={{ gridTemplateRows: `repeat(${hours.length}, 34px)` }}>
              {hours.map(hour => <div key={hour} className="mini-hour-label">{pad(hour)}</div>)}
            </div>
            <div
              className={`mini-time-column ${selectedDate === todayKey ? 'today-column' : ''}`}
              style={{ height: `${hours.length * 34}px` }}
              onDoubleClick={() => onCreate(selectedDate)}
            >
              {hours.map(hour => <div key={hour} className="mini-hour-line"></div>)}
              {showCurrentTime && (
                <div className="mini-current-time" style={{ top: `${((currentMinutes - timelineStart) / timelineSpan) * 100}%` }}>
                  <span></span>
                </div>
              )}
              {timedEventLayouts.map(({ event, column, columns }, idx) => {
                const start = timeToMinutes(event.startTime);
                const end = Math.max(timeToMinutes(event.endTime, start + 60), start + 30);
                const top = ((start - timelineStart) / timelineSpan) * 100;
                const height = ((end - start) / timelineSpan) * 100;
                const width = 100 / columns;
                const eventGap = columns > 1 ? 2 : 0;

                return (
                  <button
                    key={`${event.path || event.title}-${idx}`}
                    className={`mini-time-event ${event.nameDay ? 'nameday-event' : event.birthday ? 'birthday-event' : event.source ? `${event.source}-event` : ''}`}
                    style={{
                      top: `${Math.max(top, 0)}%`,
                      height: `${Math.max(height, 3.6)}%`,
                      left: `calc(${column * width}% + 5px)`,
                      right: `calc(${100 - ((column + 1) * width)}% + 6px)`,
                      marginRight: `${eventGap}px`
                    }}
                    onClick={() => onEdit(event)}
                  >
                    <span>{formatClock(event.startTime, settings.timeFormat)}</span>
                    <strong>{event.title}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderList = () => (
    <section className="list-view">
      {visibleEvents.length === 0 && <p className="empty-state">{t(settings, 'No events matching filters.', 'Brak wydarzeń pasujących do filtrów.')}</p>}
      {Object.entries(eventsByDate).map(([dateKey, dayEvents]) => {
        const date = parseDateKey(dateKey);
        return (
          <section className="list-day-group" key={dateKey}>
            <header>
              <span>{weekdayLongNames[toMondayIndex(date)]}</span>
              <strong>{formatHeaderDate(dateKey, settings.language)}</strong>
            </header>
            {sortEvents(dayEvents).map((event, idx) => (
              <button className={`list-row ${event.nameDay ? 'nameday-event' : event.birthday ? 'birthday-event' : event.source ? `${event.source}-event` : ''}`} key={`${event.path || event.title}-${idx}`} onClick={() => { onSelectDate(event.date); onEdit(event); }}>
                <span>{getEventTime(event, settings)}</span>
                <i></i>
                <strong>{event.title}</strong>
              </button>
            ))}
          </section>
        );
      })}
    </section>
  );

  return (
    <div className="calendar-shell">
      <header className="toolbar">
        <div className="nav-cluster">
          <button className="icon-btn" onClick={() => movePeriod(-1)} title={t(settings, 'Previous', 'Poprzedni')}>‹</button>
          <button className="icon-btn" onClick={() => movePeriod(1)} title={t(settings, 'Next', 'Następny')}>›</button>
          <button className="secondary-btn" onClick={goToToday}>{t(settings, 'today', 'dzisiaj')}</button>
          <label className="jump-date" title={t(settings, 'Go to date', 'Przejdź do daty')}>
            <span>{t(settings, 'go to', 'idź do')}</span>
            <DateInput value={selectedDate} onChange={goToDate} className="jump-date-input" />
          </label>
        </div>

        <h1>{title}</h1>

        <div className="view-switcher">
          {(['month', 'week', 'day', 'list'] as CalendarViewMode[]).map(mode => (
            <button key={mode} className={viewMode === mode ? 'active' : ''} onClick={() => onSetViewMode(mode)}>
              {mode}
            </button>
          ))}
        </div>
      </header>

      <div className="utility-bar">
        <input value={query} onChange={e => onQuery(e.target.value)} placeholder={t(settings, 'Search title or date', 'Szukaj tytułu lub daty')} />
        <button className="primary-btn" onClick={() => onCreate(selectedDate)}>{t(settings, 'new event', 'nowy wpis')}</button>
      </div>

      <main className={`workspace ${viewMode === 'month' ? 'month-workspace' : ''}`}>
        <section className="calendar-panel">
          {viewMode === 'month' && renderMonth()}
          {viewMode === 'week' && renderWeek()}
          {viewMode === 'day' && renderDay()}
          {viewMode === 'list' && renderList()}
        </section>

        <aside className="agenda-panel">
          <section>
            <div className="panel-heading">
              <span>{t(settings, 'selected day', 'wybrany dzień')}</span>
              <strong>{formatDisplayDate(selectedDate, settings.language)}</strong>
            </div>
            <div className="agenda-list selected-day-agenda">
              {selectedEvents.length === 0 && <p className="empty-state">{t(settings, 'No events.', 'Brak wydarzeń.')}</p>}
              {selectedEvents.length > 0 && renderSelectedDayMini()}
            </div>
          </section>

          <section>
            <div className="panel-heading">
              <span>{t(settings, 'upcoming', 'nadchodzące')}</span>
              <strong>{upcomingEvents.length}</strong>
            </div>
            <div className="agenda-list compact">
              {upcomingEvents.map((event, idx) => (
                <button className={`agenda-item ${event.nameDay ? 'nameday-event' : event.birthday ? 'birthday-event' : event.source ? `${event.source}-event` : ''}`} key={`${event.path || event.title}-${idx}`} onClick={() => { onSelectDate(event.date); onEdit(event); }}>
                  <div className="agenda-meta">
                    <span>{formatDisplayDate(event.date, settings.language)}</span>
                    <span className="agenda-time">{getEventTime(event, settings)}</span>
                  </div>
                  <strong>{event.title}</strong>
                </button>
              ))}
            </div>
          </section>

          <div className="stats-row">
            <span>{events.length}<small>{t(settings, 'events', 'wpisów')}</small></span>
            <button className="settings-btn" onClick={onOpenSettings} title={t(settings, 'Settings', 'Ustawienia')}>⚙</button>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default CalendarView;
