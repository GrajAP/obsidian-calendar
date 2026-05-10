import { useMemo } from 'react';
import { AppSettings, CalendarViewMode, Event } from '../types';
import { addDays, formatClock, formatColumnDate, formatDisplayDate, formatHeaderDate, getEventTime, pad, parseDateKey, startOfWeek, timeToMinutes, toDateKey, toMondayIndex } from '../utils/calendar';
import { expandRecurringEvents, sortEvents } from '../utils/events';
import { getMonthNames, getWeekdayLongNames, getWeekdayNames, t } from '../utils/settings';

const EventPill = ({ event, onClick, compact = false }: { event: Event; onClick: () => void; compact?: boolean }) => (
  <button className={`event-pill ${event.completed ? 'completed' : ''} ${compact ? 'compact' : ''}`} onClick={(e) => { e.stopPropagation(); onClick(); }}>
    {!event.allDay && <span>{event.startTime}</span>}
    <strong>{event.title}</strong>
  </button>
);

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
  const upcomingEvents = sortEvents(expandRecurringEvents(events, todayKey, toDateKey(addDays(new Date(), 21)))).slice(0, 6);

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
      ? `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
      : formatDisplayDate(selectedDate, settings.language);

  const renderMonth = () => (
    <div className="month-grid">
      {weekdayNames.map(day => <div className="weekday" key={day}>{day}</div>)}
      {Array.from({ length: 42 }).map((_, index) => {
        const date = addDays(gridStart, index);
        const dateKey = toDateKey(date);
        const dayEvents = sortEvents(eventsByDate[dateKey] || []);
        const isMuted = date.getMonth() !== month;
        const isSelected = dateKey === selectedDate;

        return (
          <button
            key={dateKey}
            className={`month-day ${isMuted ? 'muted' : ''} ${dateKey === todayKey ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectDate(dateKey)}
            onDoubleClick={() => onCreate(dateKey)}
          >
            <span className="day-number">{date.getDate()}</span>
            <div className="day-events">
              {dayEvents.slice(0, 3).map((event, idx) => (
                <EventPill key={`${event.path || event.title}-${idx}`} event={event} compact onClick={() => onEdit(event)} />
              ))}
              {dayEvents.length > 3 && <span className="more-events">+{dayEvents.length - 3}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );

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
                  <EventPill key={`${event.path || event.title}-${idx}`} event={event} compact onClick={() => onEdit(event)} />
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
              return (
                <div className={`time-column ${dateKey === todayKey ? 'today-column' : ''}`} key={dateKey} onDoubleClick={() => onCreate(dateKey)}>
                  {hours.map(hour => <div key={hour} className="hour-line"></div>)}
                  {dateKey === todayKey && showCurrentTime && (
                    <div className="current-time-line" style={{ top: `${currentTimeTop}%` }}>
                      <span></span>
                    </div>
                  )}
                  {timedEvents.map((event, idx) => {
                    const start = timeToMinutes(event.startTime);
                    const end = Math.max(timeToMinutes(event.endTime, start + 60), start + 30);
                    const top = ((start - timelineStart) / timelineSpan) * 100;
                    const height = ((end - start) / timelineSpan) * 100;

                    return (
                      <button
                        key={`${event.path || event.title}-${idx}`}
                        className="time-event"
                        style={{ top: `${Math.max(top, 0)}%`, height: `${Math.max(height, 7)}%` }}
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

  const renderList = () => (
    <section className="list-view">
      {visibleEvents.length === 0 && <p className="empty-state">No events matching filters.</p>}
      {Object.entries(eventsByDate).map(([dateKey, dayEvents]) => {
        const date = parseDateKey(dateKey);
        return (
          <section className="list-day-group" key={dateKey}>
            <header>
              <span>{weekdayLongNames[toMondayIndex(date)]}</span>
              <strong>{formatHeaderDate(dateKey, settings.language)}</strong>
            </header>
            {sortEvents(dayEvents).map((event, idx) => (
              <button className="list-row" key={`${event.path || event.title}-${idx}`} onClick={() => { onSelectDate(event.date); onEdit(event); }}>
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
          <button className="icon-btn" onClick={() => movePeriod(-1)} title="Poprzedni">‹</button>
          <button className="icon-btn" onClick={() => movePeriod(1)} title="Następny">›</button>
          <button className="secondary-btn" onClick={goToToday}>{t(settings, 'today', 'dzisiaj')}</button>
          <label className="jump-date" title="Przejdź do daty">
            <span>{t(settings, 'go to', 'idź do')}</span>
            <input type="date" value={selectedDate} onChange={e => goToDate(e.target.value)} />
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
            <div className="agenda-list">
              {selectedEvents.length === 0 && <p className="empty-state">{t(settings, 'No events.', 'Brak wydarzeń.')}</p>}
              {selectedEvents.map((event, idx) => (
                <button className="agenda-item" key={`${event.path || event.title}-${idx}`} onClick={() => onEdit(event)}>
                  <span>{getEventTime(event, settings)}</span>
                  <strong>{event.title}</strong>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="panel-heading">
              <span>{t(settings, 'upcoming', 'nadchodzące')}</span>
              <strong>{upcomingEvents.length}</strong>
            </div>
            <div className="agenda-list compact">
              {upcomingEvents.map((event, idx) => (
                <button className="agenda-item" key={`${event.path || event.title}-${idx}`} onClick={() => { onSelectDate(event.date); onEdit(event); }}>
                  <div className="agenda-meta">
                    <span>{event.date}</span>
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
