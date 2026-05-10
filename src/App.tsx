import { useEffect, useRef, useState } from 'react';
import CalendarView from './components/CalendarView';
import EventForm from './components/EventForm';
import SettingsModal from './components/SettingsModal';
import SourceFileModal from './components/SourceFileModal';
import { AppSettings, Event, FileEntry, ImportCalendarEventsResult, SourceFileState, Toast } from './types';
import { parseDateKey, toDateKey } from './utils/calendar';
import { demoEvents } from './utils/demoEvents';
import { buildMaterializedOccurrences, defaultSeriesId, formatFrontmatter, getEventFilePath, parseFrontmatter, sortEvents } from './utils/events';
import { loadSettings, saveSettings, t } from './utils/settings';

const App = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>();
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [sourceFile, setSourceFile] = useState<SourceFileState | null>(null);
  const [sourceFileSaving, setSourceFileSaving] = useState(false);
  const [calendarImporting, setCalendarImporting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const autoImportFolderRef = useRef<string | null>(null);

  const pushToast = (tone: Toast['tone'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(current => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts(current => current.filter(toast => toast.id !== id));
    }, 2800);
  };

  const reloadEvents = async () => {
    setLoading(true);
    setError(null);

    if (!window.electron) {
      setEvents(sortEvents(demoEvents));
      setLoading(false);
      return;
    }

    const files = await window.electron?.readDirectory(settings.eventsFolder);
    if (!files || 'error' in files) {
      setError(files?.error || t(settings, 'Could not read events folder.', 'Nie udało się odczytać katalogu z plikami.'));
      setLoading(false);
      return;
    }

    const loadedEvents: Event[] = [];
    const mdFiles = files.filter((file: FileEntry) => !file.isDirectory && file.name.endsWith('.md'));

    for (const file of mdFiles) {
      const result = await window.electron?.readFile(file.path);
      if (result?.content) {
        const event = parseFrontmatter(result.content);
        if (event) loadedEvents.push({ ...event, path: file.path });
      }
    }

    setEvents(sortEvents(loadedEvents));
    setLoading(false);
  };

  useEffect(() => {
    reloadEvents();
  }, [settings.eventsFolder]);

  const handleCreate = (date = selectedDate) => {
    setEditingEvent({ title: '', date, allDay: true, completed: null });
    setShowForm(true);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setShowForm(true);
  };

  const handleSave = async (event: Event) => {
    const sourceEvent: Event = event.recurring ? {
      ...event,
      seriesId: event.seriesId || defaultSeriesId(),
      seriesParentId: undefined,
      generatedOccurrence: undefined
    } : event;
    const filePath = getEventFilePath(sourceEvent, settings.eventsFolder);
    const oldGenerated = sourceEvent.recurring && sourceEvent.seriesId
      ? events.filter(existing => existing.seriesParentId === sourceEvent.seriesId && existing.path)
      : [];
    const oldGeneratedPaths = new Set(oldGenerated.map(generated => generated.path));

    for (const generated of oldGenerated) {
      const deleteResult = await window.electron?.deleteFile(generated.path as string);
      if (deleteResult?.error) {
        pushToast('error', deleteResult.error);
        return;
      }
    }

    const writeResult = await window.electron?.writeFile(filePath, formatFrontmatter(sourceEvent));
    if (writeResult?.error) {
      pushToast('error', writeResult.error);
      return;
    }

    if (event.path && event.path !== filePath && !oldGeneratedPaths.has(event.path)) {
      const deleteResult = await window.electron?.deleteFile(event.path);
      if (deleteResult?.error) {
        pushToast('error', deleteResult.error);
        return;
      }
    }

    if (sourceEvent.recurring && sourceEvent.seriesId) {
      const generatedOccurrences = buildMaterializedOccurrences(sourceEvent);

      for (const occurrence of generatedOccurrences) {
        const occurrencePath = getEventFilePath(occurrence, settings.eventsFolder);
        const conflict = events.find(existing => (
          existing.path === occurrencePath && existing.path !== event.path && !oldGeneratedPaths.has(existing.path)
        ));

        if (!conflict) {
          const occurrenceResult = await window.electron?.writeFile(occurrencePath, formatFrontmatter(occurrence));
          if (occurrenceResult?.error) {
            pushToast('error', occurrenceResult.error);
            return;
          }
        }
      }
    }

    setSelectedDate(sourceEvent.date);
    setViewDate(parseDateKey(sourceEvent.date));
    setShowForm(false);
    setEditingEvent(undefined);
    pushToast('success', t(settings, 'Event saved.', 'Wydarzenie zapisane.'));
    reloadEvents();
  };

  const handleDelete = async () => {
    if (!editingEvent?.path) return;
    if (editingEvent.seriesId) {
      const generated = events.filter(event => event.seriesParentId === editingEvent.seriesId && event.path);
      for (const event of generated) {
        const deleteResult = await window.electron?.deleteFile(event.path as string);
        if (deleteResult?.error) {
          pushToast('error', deleteResult.error);
          return;
        }
      }
    }
    const deleteResult = await window.electron?.deleteFile(editingEvent.path);
    if (deleteResult?.error) {
      pushToast('error', deleteResult.error);
      return;
    }
    setShowForm(false);
    setEditingEvent(undefined);
    pushToast('success', t(settings, 'Event deleted.', 'Wydarzenie usunięte.'));
    reloadEvents();
  };

  const handleOpenFile = async (filePath: string) => {
    const result = await window.electron?.readFile(filePath);
    if (result?.error) {
      pushToast('error', result.error);
      return;
    }
    if (!result?.content) return;
    setSourceFile({
      path: filePath,
      title: filePath.split('/').pop() || filePath,
      content: result.content
    });
  };

  const handleSaveSourceFile = async () => {
    if (!sourceFile) return;
    setSourceFileSaving(true);
    const writeResult = await window.electron?.writeFile(sourceFile.path, sourceFile.content);
    setSourceFileSaving(false);
    if (writeResult?.error) {
      pushToast('error', writeResult.error);
      return;
    }
    setSourceFile(null);
    setShowForm(false);
    setEditingEvent(undefined);
    pushToast('success', t(settings, 'File saved.', 'Plik zapisany.'));
    reloadEvents();
  };

  const handleReloadSourceFile = async () => {
    if (!sourceFile) return;
    const result = await window.electron?.readFile(sourceFile.path);
    if (result?.error) {
      pushToast('error', result.error);
      return;
    }
    if (!result?.content) return;
    setSourceFile(current => current ? { ...current, content: result.content as string } : current);
    pushToast('success', t(settings, 'Reloaded from disk.', 'Przywrócono z dysku.'));
  };

  const handleFormatSourceYaml = () => {
    if (!sourceFile) return;
    const match = sourceFile.content.match(/^---\r?\n([\s\S]*?)\r?\n---([\s\S]*)$/);
    if (!match) return;

    const yamlBlock = match[1];
    const rest = match[2];
    const lines = yamlBlock
      .split(/\r?\n/)
      .map(line => line.trimEnd())
      .filter(line => line.trim().length > 0);

    const parsed = lines.map(line => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex < 0) return { key: line, value: '' };
      return {
        key: line.slice(0, separatorIndex).trim(),
        value: line.slice(separatorIndex + 1).trim()
      };
    });

    parsed.sort((a, b) => a.key.localeCompare(b.key));

    const formattedYaml = parsed
      .map(({ key, value }) => (value ? `${key}: ${value}` : key))
      .join('\n');

    setSourceFile(current => current ? {
      ...current,
      content: `---\n${formattedYaml}\n---${rest.startsWith('\n') ? rest : `\n${rest}`}`
    } : current);
  };

  const isImportCalendarEventsResult = (value: unknown): value is ImportCalendarEventsResult => (
    typeof value === 'object'
    && value !== null
    && 'created' in value
    && 'updated' in value
    && 'skipped' in value
    && 'errors' in value
  );

  const importCalendarEvents = async ({ silent }: { silent: boolean }) => {
    if (!window.electron?.importCalendarEvents) {
      if (!silent) {
        pushToast('error', t(settings, 'Calendar import is only available in the Electron app.', 'Import kalendarza jest dostępny tylko w aplikacji Electron.'));
      }
      return;
    }

    setCalendarImporting(true);
    const result = await window.electron.importCalendarEvents(settings.eventsFolder);
    setCalendarImporting(false);

    if ('error' in result) {
      pushToast('error', result.error);
      return;
    }

    if (!isImportCalendarEventsResult(result)) {
      pushToast('error', t(settings, 'Could not import calendar events.', 'Nie udało się zaimportować wydarzeń.'));
      return;
    }

    if (result.created > 0 || result.updated > 0) {
      await reloadEvents();
    }

    const summary = t(
      settings,
      `Calendar import: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`,
      `Import kalendarza: ${result.created} dodano, ${result.updated} zaktualizowano, ${result.skipped} pominięto.`
    );

    if (result.errors.length) {
      pushToast('error', `${summary} ${result.errors[0]}`);
      return;
    }

    if (!silent && (result.created > 0 || result.updated > 0 || result.skipped > 0)) {
      pushToast('success', summary);
    }
  };

  const handleImportCalendarEvents = async () => {
    await importCalendarEvents({ silent: false });
  };

  useEffect(() => {
    if (!window.electron?.importCalendarEvents) return;
    if (autoImportFolderRef.current === settings.eventsFolder) return;

    autoImportFolderRef.current = settings.eventsFolder;
    void importCalendarEvents({ silent: true });
  }, [settings.eventsFolder]);

  return (
    <div id="app">
      <div className="main-content">
        {loading && <div className="state-screen">{t(settings, 'Loading .md files...', 'Ładowanie plików .md...')}</div>}
        {error && (
          <div className="state-screen error-state">
            <strong>{t(settings, 'Cannot open calendar', 'Nie mogę otworzyć kalendarza')}</strong>
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && (
          <CalendarView
            events={events}
            selectedDate={selectedDate}
            viewDate={viewDate}
            viewMode={viewMode}
            query={query}
            settings={settings}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setViewDate(parseDateKey(date));
            }}
            onSetViewDate={setViewDate}
            onSetViewMode={setViewMode}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onQuery={setQuery}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </div>

      {showForm && (
        <EventForm
          event={editingEvent}
          settings={settings}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingEvent(undefined); }}
          onDelete={editingEvent?.path ? handleDelete : undefined}
          onOpenFile={editingEvent?.path ? handleOpenFile : undefined}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onCancel={() => setShowSettings(false)}
          onImportCalendarEvents={handleImportCalendarEvents}
          importingCalendarEvents={calendarImporting}
          onSave={(nextSettings) => {
            setSettings(nextSettings);
            saveSettings(nextSettings);
            setShowSettings(false);
          }}
        />
      )}

      {sourceFile && (
        <SourceFileModal
          settings={settings}
          path={sourceFile.path}
          title={sourceFile.title}
          content={sourceFile.content}
          saving={sourceFileSaving}
          onChange={(content) => setSourceFile(current => current ? { ...current, content } : current)}
          onSave={handleSaveSourceFile}
          onReload={handleReloadSourceFile}
          onFormatYaml={handleFormatSourceYaml}
          onClose={() => setSourceFile(null)}
        />
      )}

      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.tone}`}>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
