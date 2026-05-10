import React, { useState } from 'react';
import DateInput from './DateInput';
import TimeInput from './TimeInput';
import { AppSettings, Event } from '../types';
import { parseDateKey, toDateKey, toMondayIndex } from '../utils/calendar';
import { defaultMaterializeCount, defaultSeriesId } from '../utils/events';
import { t } from '../utils/settings';

interface EventFormProps {
  event?: Event;
  settings: AppSettings;
  onSave: (event: Event) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onOpenFile?: (path: string) => void;
}

const weekdayNamesEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EventForm = ({ event, settings, onSave, onCancel, onDelete, onOpenFile }: EventFormProps) => {
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
  const [birthday, setBirthday] = useState(event?.birthday ?? false);
  const [nameDay, setNameDay] = useState(event?.nameDay ?? false);
  const [dateOfBirth, setDateOfBirth] = useState(event?.dateOfBirth || (event?.birthday ? event?.date : ''));

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
      birthday: recurringType === 'yearly' ? birthday : undefined,
      nameDay: recurringType === 'yearly' ? nameDay : undefined,
      dateOfBirth: recurringType === 'yearly' && birthday ? (dateOfBirth || date) : undefined,
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
            <p>{event?.path ? t(settings, 'Edit .md file', 'Edycja pliku .md') : t(settings, 'New .md file', 'Nowy plik .md')}</p>
            <h2>{event?.path ? event.title : t(settings, 'Add event', 'Dodaj wydarzenie')}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} title={t(settings, 'Close', 'Zamknij')}>×</button>
        </header>

        <form onSubmit={handleSubmit}>
          <label className="form-group">
            <span>{t(settings, 'Title', 'Tytuł')}</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
          </label>

          <div className="form-row">
            <label className="form-group">
              <span>{birthday && recurringType === 'yearly' ? t(settings, 'Date of birth', 'Data urodzenia') : t(settings, 'Date', 'Data')}</span>
              <DateInput
                value={birthday && recurringType === 'yearly' ? dateOfBirth || date : date}
                onChange={next => {
                  setDate(next);
                  if (birthday && recurringType === 'yearly') setDateOfBirth(next);
                }}
                required
              />
            </label>
            <label className="toggle-row minimal-check">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
              <i></i>
              <span>{t(settings, 'All day', 'Cały dzień')}</span>
            </label>
          </div>

          {!allDay && (
            <div className="form-row">
              <label className="form-group">
                <span>{t(settings, 'Start', 'Start')}</span>
                <TimeInput value={startTime} onChange={setStartTime} />
              </label>
              <label className="form-group">
                <span>{t(settings, 'End', 'Koniec')}</span>
                <TimeInput value={endTime} onChange={setEndTime} />
              </label>
            </div>
          )}

          <div className="form-row">
            <label className="form-group">
              <span>{t(settings, 'Repeat', 'Powtarzanie')}</span>
              <select value={recurringType} onChange={e => handleRecurringTypeChange(e.target.value as 'none' | NonNullable<Event['recurring']>['type'])}>
                <option value="none">{t(settings, 'None', 'Brak')}</option>
                <option value="daily">{t(settings, 'Daily', 'Codziennie')}</option>
                <option value="weekly">{t(settings, 'Weekly', 'Co tydzień')}</option>
                <option value="monthly">{t(settings, 'Monthly', 'Co miesiąc')}</option>
                <option value="yearly">{t(settings, 'Yearly', 'Co rok')}</option>
              </select>
            </label>
            {recurringType !== 'none' && (
              <label className="form-group compact-field">
                <span>{t(settings, 'Every', 'Co ile')}</span>
                <input type="number" min="1" value={recurringInterval} onChange={e => setRecurringInterval(Number(e.target.value) || 1)} />
              </label>
            )}
          </div>

          {recurringType !== 'none' && (
            <>
              {recurringType === 'weekly' && (
                <div className="form-group">
                  <span>{t(settings, 'Weekdays', 'Dni tygodnia')}</span>
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
                  <span>{t(settings, 'Monthly mode', 'Tryb miesięczny')}</span>
                  <select value={recurringMonthlyMode} onChange={e => setRecurringMonthlyMode(e.target.value as NonNullable<Event['recurring']>['monthlyMode'])}>
                    <option value="dayOfMonth">{t(settings, 'Same day of month', 'Ten sam dzień miesiąca')}</option>
                    <option value="weekdayOfMonth">{t(settings, 'Same weekday in month', 'Ten sam dzień tygodnia w miesiącu')}</option>
                  </select>
                </label>
              )}

              <div className="form-row">
                <label className="form-group">
                  <span>{t(settings, 'Repeat ends', 'Koniec powtarzania')}</span>
                  <DateInput value={recurringEnd} onChange={setRecurringEnd} />
                </label>
                <label className="form-group compact-field">
                  <span>{t(settings, 'Files ahead', 'Pliki naprzód')}</span>
                  <input type="number" min="0" max="24" value={materializeCount} onChange={e => setMaterializeCount(Number(e.target.value) || 0)} />
                </label>
              </div>
              {recurringType === 'yearly' && (
                <>
                  <label className="toggle-row minimal-check birthday-toggle">
                    <input type="checkbox" checked={birthday} onChange={e => {
                      setBirthday(e.target.checked);
                      if (e.target.checked) setNameDay(false);
                    }} />
                    <i></i>
                    <span>{t(settings, 'Birthday', 'Urodziny')}</span>
                  </label>
                  <label className="toggle-row minimal-check birthday-toggle">
                    <input type="checkbox" checked={nameDay} onChange={e => {
                      setNameDay(e.target.checked);
                      if (e.target.checked) setBirthday(false);
                    }} />
                    <i></i>
                    <span>{t(settings, 'Name day', 'Imieniny')}</span>
                  </label>
                </>
              )}
            </>
          )}

          <footer className="form-actions">
            {event?.path && onDelete && <button type="button" className="danger-btn" onClick={onDelete}>{t(settings, 'Delete', 'Usuń')}</button>}
            {event?.path && onOpenFile && <button type="button" className="secondary-btn" onClick={() => onOpenFile(event.path as string)}>{t(settings, 'Open file', 'Otwórz plik')}</button>}
            <button type="button" className="secondary-btn" onClick={onCancel}>{t(settings, 'Cancel', 'Anuluj')}</button>
            <button type="submit" className="primary-btn">{t(settings, 'Save', 'Zapisz')}</button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default EventForm;
