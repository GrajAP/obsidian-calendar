import { useEffect, useState } from 'react';
import CalendarView from './components/CalendarView';
import EventForm from './components/EventForm';
import SettingsModal from './components/SettingsModal';
import SourceFileModal from './components/SourceFileModal';
import { AppSettings, Event, FileEntry, SourceFileState } from './types';
import { parseDateKey, toDateKey } from './utils/calendar';
import { buildMaterializedOccurrences, defaultSeriesId, formatFrontmatter, getEventFilePath, parseFrontmatter, sortEvents } from './utils/events';
import { loadSettings, saveSettings } from './utils/settings';

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

  const reloadEvents = async () => {
    setLoading(true);
    setError(null);

    const files = await window.electron?.readDirectory(settings.eventsFolder);
    if (!files || 'error' in files) {
      setError(files?.error || 'Nie udało się odczytać katalogu z plikami.');
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
      await window.electron?.deleteFile(generated.path as string);
    }

    await window.electron?.writeFile(filePath, formatFrontmatter(sourceEvent));
    if (event.path && event.path !== filePath && !oldGeneratedPaths.has(event.path)) await window.electron?.deleteFile(event.path);

    if (sourceEvent.recurring && sourceEvent.seriesId) {
      const generatedOccurrences = buildMaterializedOccurrences(sourceEvent);

      for (const occurrence of generatedOccurrences) {
        const occurrencePath = getEventFilePath(occurrence, settings.eventsFolder);
        const conflict = events.find(existing => (
          existing.path === occurrencePath && existing.path !== event.path && !oldGeneratedPaths.has(existing.path)
        ));

        if (!conflict) await window.electron?.writeFile(occurrencePath, formatFrontmatter(occurrence));
      }
    }

    setSelectedDate(sourceEvent.date);
    setViewDate(parseDateKey(sourceEvent.date));
    setShowForm(false);
    setEditingEvent(undefined);
    reloadEvents();
  };

  const handleDelete = async () => {
    if (!editingEvent?.path) return;
    if (editingEvent.seriesId) {
      const generated = events.filter(event => event.seriesParentId === editingEvent.seriesId && event.path);
      for (const event of generated) {
        await window.electron?.deleteFile(event.path as string);
      }
    }
    await window.electron?.deleteFile(editingEvent.path);
    setShowForm(false);
    setEditingEvent(undefined);
    reloadEvents();
  };

  const handleOpenFile = async (filePath: string) => {
    const result = await window.electron?.readFile(filePath);
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
    await window.electron?.writeFile(sourceFile.path, sourceFile.content);
    setSourceFileSaving(false);
    setSourceFile(null);
    setShowForm(false);
    setEditingEvent(undefined);
    reloadEvents();
  };

  const handleReloadSourceFile = async () => {
    if (!sourceFile) return;
    const result = await window.electron?.readFile(sourceFile.path);
    if (!result?.content) return;
    setSourceFile(current => current ? { ...current, content: result.content as string } : current);
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

  return (
    <div id="app">
      <div className="main-content">
        {loading && <div className="state-screen">Ładowanie plików .md...</div>}
        {error && (
          <div className="state-screen error-state">
            <strong>Nie mogę otworzyć kalendarza</strong>
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
          onSave={(nextSettings) => {
            setSettings(nextSettings);
            saveSettings(nextSettings);
            setShowSettings(false);
          }}
        />
      )}

      {sourceFile && (
        <SourceFileModal
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
    </div>
  );
};

export default App;
