import { useState } from 'react';
import { AppLanguage, AppSettings, FirstDayOfWeek, TimeFormat } from '../types';
import { t } from '../utils/settings';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onCancel: () => void;
  onImportCalendarEvents: () => void;
  importingCalendarEvents: boolean;
}

const SettingsModal = ({ settings, onSave, onCancel, onImportCalendarEvents, importingCalendarEvents }: SettingsModalProps) => {
  const [draft, setDraft] = useState(settings);

  const chooseFolder = async () => {
    const result = await window.electron?.selectDirectory();
    if (result?.path) setDraft(current => ({ ...current, eventsFolder: result.path as string }));
  };

  const updateDraft = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  return (
    <div className="modal-scrim" onClick={onCancel}>
      <section className="settings-modal" onClick={event => event.stopPropagation()}>
        <header className="form-header">
          <div>
            <p>{t(draft, 'Application', 'Aplikacja')}</p>
            <h2>{t(draft, 'Settings', 'Ustawienia')}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} title={t(draft, 'Close', 'Zamknij')}>×</button>
        </header>

        <div className="settings-grid">
          <label className="form-group">
            <span>{t(draft, 'Events folder', 'Folder wydarzeń')}</span>
            <div className="folder-picker">
              <input type="text" value={draft.eventsFolder} onChange={event => updateDraft('eventsFolder', event.target.value)} />
              <button type="button" className="secondary-btn" onClick={chooseFolder}>{t(draft, 'Browse', 'Wybierz')}</button>
            </div>
          </label>

          <label className="form-group">
            <span>{t(draft, 'Language', 'Język')}</span>
            <select value={draft.language} onChange={event => updateDraft('language', event.target.value as AppLanguage)}>
              <option value="en">English</option>
              <option value="pl">Polski</option>
            </select>
          </label>

          <label className="form-group">
            <span>{t(draft, 'Time format', 'Format czasu')}</span>
            <select value={draft.timeFormat} onChange={event => updateDraft('timeFormat', event.target.value as TimeFormat)}>
              <option value="24">24 h</option>
              <option value="12">12 h</option>
            </select>
          </label>

          <label className="form-group">
            <span>{t(draft, 'First day of week', 'Pierwszy dzień tygodnia')}</span>
            <select value={draft.firstDayOfWeek} onChange={event => updateDraft('firstDayOfWeek', event.target.value as FirstDayOfWeek)}>
              <option value="mon">{t(draft, 'Monday', 'Poniedziałek')}</option>
              <option value="sun">{t(draft, 'Sunday', 'Niedziela')}</option>
            </select>
          </label>

          <section className="settings-action-panel">
            <div>
              <span>{t(draft, 'Calendar import', 'Import kalendarza')}</span>
              <p>{t(draft, 'Fetch future FC Barcelona, Champions League, Poland national team matches, and Polish public holidays into .md files.', 'Pobierz przyszłe mecze FC Barcelony, Ligi Mistrzów, reprezentacji Polski oraz święta państwowe do plików .md.')}</p>
            </div>
            <button type="button" className="secondary-btn" onClick={onImportCalendarEvents} disabled={importingCalendarEvents}>
              {importingCalendarEvents ? t(draft, 'Fetching...', 'Pobieranie...') : t(draft, 'Fetch events', 'Pobierz wydarzenia')}
            </button>
          </section>
        </div>

        <footer className="form-actions">
          <button type="button" className="secondary-btn" onClick={onCancel}>{t(draft, 'Cancel', 'Anuluj')}</button>
          <button type="button" className="primary-btn" onClick={() => onSave(draft)}>{t(draft, 'Save', 'Zapisz')}</button>
        </footer>
      </section>
    </div>
  );
};

export default SettingsModal;
