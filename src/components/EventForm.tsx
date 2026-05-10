import React, { useState } from 'react';
import { Event } from '../types';
import { parseDateKey, toDateKey, toMondayIndex } from '../utils/calendar';
import { defaultMaterializeCount, defaultSeriesId } from '../utils/events';

interface EventFormProps {
  event?: Event;
  onSave: (event: Event) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onOpenFile?: (path: string) => void;
}

const weekdayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EventForm = ({ event, onSave, onCancel, onDelete, onOpenFile }: EventFormProps) => {
  const [title, setTitle] = useState(event?.title || '');
  const [date, setDate] = useState(event?.date || toDateKey(new Date()));
  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [startTime, setStartTime] = useState(event?.startTime || '09:00');
  const [endTime, setEndTime] = useState(event?.endTime || '10:00');
  const [recurringType, setRecurringType] = useState<'none' | NonNullable<Event['recurring']>['type']>(event?.recurring?.type || 'none');
  const [recurringInterval, setRecurringInterval] = useState(event?.recurring?.interval || 1);
  const [recurringEnd, setRecurringEnd] = useState(event?.recurring?.endDate || '');
  const [recurringWeekdays, setRecurringWeekdays] = useState(event?.recurring?.weekdays || [toMondayIndex(parseDateKey(event?.date || toDateKey(new Date())))]);
  const [recurringMonthlyMode, setRecurringMonthlyMode] = useState<NonNullable<Event['recurring']>['monthlyMode']>(event?.recurring?.monthlyMode || 'dayOfMonth');
  const [materializeCount, setMaterializeCount] = useState(event?.recurring?.materializeCount ?? defaultMaterializeCount(event?.recurring?.type));

  const toggleWeekday = (day: number) => {
    setRecurringWeekdays(current => (
      current.includes(day) ? current.filter(item => item !== day) : [...current, day].sort((a, b) => a - b)
    ));
  };

  const handleRecurringTypeChange = (type: 'none' | NonNullable<Event['recurring']>['type']) => {
    const previousDefault = defaultMaterializeCount(recurringType === 'none' ? undefined : recurringType);
    setRecurringType(type);
    if (type !== 'none' && (!event?.recurring || materializeCount === previousDefault)) {
      setMaterializeCount(defaultMaterializeCount(type));
    }
  };

  const handleSubmit = (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    onSave({
      ...event,
      title: title.trim(),
      date,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      completed: event?.completed || null,
      seriesId: recurringType !== 'none' ? (event?.seriesId || event?.seriesParentId || defaultSeriesId()) : undefined,
      seriesParentId: event?.seriesParentId,
      generatedOccurrence: event?.generatedOccurrence,
      recurring: recurringType !== 'none' ? {
        type: recurringType,
        interval: Math.max(recurringInterval, 1),
        endDate: recurringEnd || undefined,
        weekdays: recurringType === 'weekly' ? (recurringWeekdays.length ? recurringWeekdays : [toMondayIndex(parseDateKey(date))]) : undefined,
        monthlyMode: recurringType === 'monthly' ? recurringMonthlyMode : undefined,
        materializeCount: Math.max(materializeCount, 0)
      } : undefined
    });
  };

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <section className="event-form" onClick={e => e.stopPropagation()}>
        <header className="form-header">
          <div>
            <p>{event?.path ? 'Edycja pliku .md' : 'Nowy plik .md'}</p>
            <h2>{event?.path ? event.title : 'Dodaj wydarzenie'}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} title="Zamknij">×</button>
        </header>

        <form onSubmit={handleSubmit}>
          <label className="form-group">
            <span>Tytuł</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
          </label>

          <div className="form-row">
            <label className="form-group">
              <span>Data</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </label>
            <label className="toggle-row minimal-check">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
              <i></i>
              <span>Cały dzień</span>
            </label>
          </div>

          {!allDay && (
            <div className="form-row">
              <label className="form-group">
                <span>Start</span>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </label>
              <label className="form-group">
                <span>Koniec</span>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </label>
            </div>
          )}

          <div className="form-row">
            <label className="form-group">
              <span>Powtarzanie</span>
              <select value={recurringType} onChange={e => handleRecurringTypeChange(e.target.value as 'none' | NonNullable<Event['recurring']>['type'])}>
                <option value="none">Brak</option>
                <option value="daily">Codziennie</option>
                <option value="weekly">Co tydzień</option>
                <option value="monthly">Co miesiąc</option>
                <option value="yearly">Co rok</option>
              </select>
            </label>
            {recurringType !== 'none' && (
              <label className="form-group compact-field">
                <span>Co ile</span>
                <input type="number" min="1" value={recurringInterval} onChange={e => setRecurringInterval(Number(e.target.value) || 1)} />
              </label>
            )}
          </div>

          {recurringType !== 'none' && (
            <>
              {recurringType === 'weekly' && (
                <div className="form-group">
                  <span>Dni tygodnia</span>
                  <div className="weekday-picker">
                    {weekdayNamesEn.map((day, index) => (
                      <button key={day} type="button" className={recurringWeekdays.includes(index) ? 'active' : ''} onClick={() => toggleWeekday(index)}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurringType === 'monthly' && (
                <label className="form-group">
                  <span>Tryb miesięczny</span>
                  <select value={recurringMonthlyMode} onChange={e => setRecurringMonthlyMode(e.target.value as NonNullable<Event['recurring']>['monthlyMode'])}>
                    <option value="dayOfMonth">Ten sam dzień miesiąca</option>
                    <option value="weekdayOfMonth">Ten sam dzień tygodnia w miesiącu</option>
                  </select>
                </label>
              )}

              <div className="form-row">
                <label className="form-group">
                  <span>Koniec powtarzania</span>
                  <input type="date" value={recurringEnd} onChange={e => setRecurringEnd(e.target.value)} />
                </label>
                <label className="form-group compact-field">
                  <span>Pliki naprzód</span>
                  <input type="number" min="0" max="24" value={materializeCount} onChange={e => setMaterializeCount(Number(e.target.value) || 0)} />
                </label>
              </div>
            </>
          )}

          <footer className="form-actions">
            {event?.path && onDelete && <button type="button" className="danger-btn" onClick={onDelete}>Usuń</button>}
            {event?.path && onOpenFile && <button type="button" className="secondary-btn" onClick={() => onOpenFile(event.path as string)}>Otwórz plik</button>}
            <button type="button" className="secondary-btn" onClick={onCancel}>Anuluj</button>
            <button type="submit" className="primary-btn">Zapisz</button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default EventForm;
