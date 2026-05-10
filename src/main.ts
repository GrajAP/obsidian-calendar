import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import type { Event, ImportCalendarEventsResult } from './types';
import { formatFrontmatter } from './utils/events';
import { getPolishPublicHolidays } from './utils/holidays';

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const importMarkerPrefix = 'calendar-import';
const barcelonaScheduleUrl = 'https://www.fcbarcelona.com/en/futbol/primer-equipo/calendario';
const championsLeagueFixturesUrl = 'https://www.uefa.com/uefachampionsleague/news/029c-1e9a2f63fe2d-ebf9ad643892-1000--202526-champions-league-all-the-league-phase-fixtures/';
const polandNewsUrl = 'https://www.pzpn.pl/reprezentacje/reprezentacja-a/aktualnosci';
const polandSeedUrls = [
  'https://www.pzpn.pl/reprezentacje/reprezentacja-a/aktualnosci/2026-05-08/reprezentacja-polski-rozegra-towarzyski-mecz-z-ukraina',
  'https://www.pzpn.pl/federacja/aktualnosci/2026-04-02/reprezentacja-polski-zagra-towarzysko-z-nigeria'
];

const importKinds = ['sports', 'holiday'] as const;
type ImportKind = typeof importKinds[number];

interface ImportedCalendarEvent {
  title: string;
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  estimatedTime?: boolean;
  category: string;
  sourceKind: ImportKind;
  venue?: string;
  sourceUrl: string;
  sourceId: string;
}

interface SchemaSportsEvent {
  name: string;
  startDate: string;
  url: string;
  location?: {
    name?: string;
  };
}

const monthNumbers: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
};

const polishMonthNumbers: Record<string, number> = {
  stycznia: 1,
  lutego: 2,
  marca: 3,
  kwietnia: 4,
  maja: 5,
  czerwca: 6,
  lipca: 7,
  sierpnia: 8,
  wrzesnia: 9,
  września: 9,
  pazdziernika: 10,
  października: 10,
  listopada: 11,
  grudnia: 12
};

const pad = (value: number) => String(value).padStart(2, '0');

const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatClock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const fallbackSportsTimes = {
  barcelona: '21:00',
  poland: '20:45'
} as const;

const calendarImportMarker = (kind: ImportKind) => `${importMarkerPrefix}: ${kind}`;

const isManagedImportContent = (content: string) => (
  /^(?:sports-import:\s*true|holiday-import:\s*true|calendar-import:\s*(?:sports|holiday))\s*$/m.test(content)
);

const addMinutes = (time: string, minutesToAdd: number) => {
  const [hours, minutes] = time.split(':').map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};

const stripTags = (html: string) => html
  .replace(/<[^>]+>/g, '\n')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#039;/g, "'")
  .replace(/&ndash;/g, '–')
  .replace(/&quot;/g, '"');

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const getString = (record: Record<string, unknown>, key: string) => (
  typeof record[key] === 'string' ? record[key] : undefined
);

const getSchemaSportsEvent = (value: unknown): SchemaSportsEvent | undefined => {
  if (!isRecord(value) || getString(value, '@type') !== 'SportsEvent') return undefined;
  const name = getString(value, 'name');
  const startDate = getString(value, 'startDate');
  const url = getString(value, 'url');
  if (!name || !startDate || !url) return undefined;

  const locationRecord = isRecord(value.location) ? value.location : undefined;
  const locationName = locationRecord ? getString(locationRecord, 'name') : undefined;

  return {
    name,
    startDate,
    url,
    location: locationName ? { name: locationName } : undefined
  };
};

const getJsonLdSportsEvents = (html: string) => {
  const matches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  const events: SchemaSportsEvent[] = [];

  for (const match of matches) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      events.push(...items.map(getSchemaSportsEvent).filter((event): event is SchemaSportsEvent => Boolean(event)));
    } catch {
      // Ignore unrelated JSON-LD blocks.
    }
  }

  return events;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const decodeHtml = (value: string) => stripTags(value)
  .replace(/\s+/g, ' ')
  .trim();

const fetchText = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}`);
  }
  return response.text();
};

const getBarcelonaKickoff = (html: string, matchUrl: string) => {
  const pathname = new URL(matchUrl).pathname;
  const pattern = new RegExp(`href="${escapeRegExp(pathname)}"[\\s\\S]{0,700}?data-kickoff="(\\d+)"[\\s\\S]{0,80}?>([^<]+)<`);
  const match = html.match(pattern);
  if (!match) return undefined;

  const kickoffTimestamp = Number(match[1]);
  const label = match[2].trim();
  if (!Number.isFinite(kickoffTimestamp) || label === 'TBA') return undefined;
  const kickoff = new Date(kickoffTimestamp);
  return {
    date: toDateKey(kickoff),
    time: formatClock(kickoff)
  };
};

const fetchBarcelonaMatches = async (): Promise<ImportedCalendarEvent[]> => {
  const html = await fetchText(barcelonaScheduleUrl);
  const today = toDateKey(new Date());

  return getJsonLdSportsEvents(html)
    .filter(event => event.startDate >= today)
    .map((event): ImportedCalendarEvent => {
      const kickoff = getBarcelonaKickoff(html, event.url);
      const title = event.name.replace(/\s*\([^)]*\)\s*$/, '');
      const category = event.name.match(/\(([^)]+)\)/)?.[1] || 'FC Barcelona';

      return {
        title,
        date: kickoff?.date || event.startDate,
        allDay: false,
        startTime: kickoff?.time || fallbackSportsTimes.barcelona,
        endTime: addMinutes(kickoff?.time || fallbackSportsTimes.barcelona, 120),
        estimatedTime: !kickoff?.time,
        category,
        sourceKind: 'sports',
        venue: event.location?.name,
        sourceUrl: event.url,
        sourceId: `fcbarcelona:${event.url.split('/').filter(Boolean).at(-1) || title}`
      };
    });
};

const parseDayMonth = (line: string) => {
  const match = line.match(/(\d{1,2})\s+([A-Za-z]+)/);
  if (!match) return undefined;
  const month = monthNumbers[match[2].toLowerCase()];
  if (!month) return undefined;
  return { day: Number(match[1]), month };
};

const inferFixtureYear = (month: number, day: number) => {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  if (candidate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
    return now.getFullYear() + 1;
  }
  return now.getFullYear();
};

const fetchChampionsLeagueMatches = async (): Promise<ImportedCalendarEvent[]> => {
  const html = await fetchText(championsLeagueFixturesUrl);
  const lines = stripTags(html).split(/\n+/).map(line => line.trim()).filter(Boolean);
  const matches: ImportedCalendarEvent[] = [];

  for (let index = 0; index < lines.length - 2; index += 1) {
    const dateParts = parseDayMonth(lines[index]);
    if (!dateParts) continue;
    const titleLine = lines[index + 1];
    const timeMatch = lines[index + 2].match(/\((\d{1,2}:\d{2})\s+CET\)/);
    if (!titleLine.includes(' vs ') || !timeMatch) continue;

    const year = inferFixtureYear(dateParts.month, dateParts.day);
    const date = `${year}-${pad(dateParts.month)}-${pad(dateParts.day)}`;
    if (date < toDateKey(new Date())) continue;

    matches.push({
      title: `${titleLine} (Champions League)`,
      date,
      allDay: false,
      startTime: timeMatch[1],
      endTime: addMinutes(timeMatch[1], 120),
      category: 'UEFA Champions League',
      sourceKind: 'sports',
      venue: lines.slice(index + 3, index + 8).find(line => line.includes('takes place at'))?.replace(/^.* takes place at /, '').replace(/\.$/, ''),
      sourceUrl: championsLeagueFixturesUrl,
      sourceId: `uefa-champions-league:${date}:${titleLine}`
    });
  }

  return matches;
};

const getMetaContent = (html: string, name: string) => {
  const pattern = new RegExp(`<meta\\s+(?:name|property)=["']${escapeRegExp(name)}["']\\s+content=["']([^"']+)["']`, 'i');
  return html.match(pattern)?.[1];
};

const getPolandArticleUrls = async () => {
  const html = await fetchText(polandNewsUrl);
  const urls = new Set(polandSeedUrls);
  const matches = html.matchAll(/href=['"]([^'"]+)['"][^>]*>\s*(?:<h3>)?([^<]*(?:Polski|Polska)[^<]*)/gi);

  for (const match of matches) {
    const href = match[1];
    const label = decodeHtml(match[2]);
    if (!/mecz|zagra|rozegra|bilet/i.test(label)) continue;
    urls.add(new URL(href, polandNewsUrl).toString());
  }

  return [...urls];
};

const parsePolishDate = (text: string) => {
  const match = text.match(/(\d{1,2})\s+([A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)\s+(\d{4})/);
  if (!match) return undefined;
  const month = polishMonthNumbers[match[2].toLowerCase()];
  if (!month) return undefined;
  return `${match[3]}-${pad(month)}-${pad(Number(match[1]))}`;
};

const titleCase = (value: string) => value
  .split('-')
  .filter(Boolean)
  .map(part => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getPolandOpponentFromUrl = (url: string) => {
  const slug = url.split('/').filter(Boolean).at(-1) || '';
  const match = slug.match(/(?:z|mecz-polska)-([a-z0-9-]+)$/i);
  if (!match) return undefined;
  return titleCase(match[1].replace(/^z-/, ''));
};

const parsePolandMatchArticle = async (url: string): Promise<ImportedCalendarEvent | undefined> => {
  const html = await fetchText(url);
  const description = decodeHtml(getMetaContent(html, 'description') || '');
  if (!/reprezentacja polski|polska/i.test(description) || !/mecz|spotkanie/i.test(description)) return undefined;

  const date = parsePolishDate(description);
  if (!date || date < toDateKey(new Date())) return undefined;

  const opponent = getPolandOpponentFromUrl(url);
  if (!opponent) return undefined;

  const startTime = description.match(/godz\.?\s*(\d{1,2}:\d{2})/i)?.[1];
  const venueText = description.match(/na stadionie ([^.]+?)\./i)?.[1]
    ?.replace(/\s+w\s+([A-ZŁŚŻŹĆŃÓ][^.]+)$/u, ', $1');

  return {
    title: `Polska vs ${opponent}`,
    date,
    allDay: false,
    startTime: startTime || fallbackSportsTimes.poland,
    endTime: addMinutes(startTime || fallbackSportsTimes.poland, 120),
    estimatedTime: !startTime,
    category: 'Poland national football team',
    sourceKind: 'sports',
    venue: venueText,
    sourceUrl: url,
    sourceId: `pzpn-poland:${date}:${opponent}`
  };
};

const fetchPolandNationalTeamMatches = async (): Promise<ImportedCalendarEvent[]> => {
  const urls = await getPolandArticleUrls();
  const settled = await Promise.allSettled(urls.map(parsePolandMatchArticle));
  const matches = settled
    .flatMap(item => (item.status === 'fulfilled' && item.value ? [item.value] : []));
  const uniqueKeys = new Set<string>();

  return matches.filter(match => {
    const key = `${match.date}:${normalizeMatchText(match.title)}`;
    if (uniqueKeys.has(key)) return false;
    uniqueKeys.add(key);
    return true;
  });
};

const fetchPolishHolidays = async (): Promise<ImportedCalendarEvent[]> => {
  const year = new Date().getFullYear();
  const years = [year, year + 1];
  const today = toDateKey(new Date());

  return years.flatMap(targetYear => getPolishPublicHolidays(targetYear))
    .filter(holiday => holiday.date >= today)
    .map((holiday): ImportedCalendarEvent => ({
      title: holiday.title,
      date: holiday.date,
      allDay: true,
      category: 'Święta państwowe',
      sourceKind: 'holiday',
      sourceUrl: 'internal:polish-public-holidays',
      sourceId: `pl-holidays:${holiday.date}:${normalizeMatchText(holiday.title)}`
    }));
};

const slugifyFilePart = (value: string) => value
  .replace(/[\\/:*?"<>|]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 70) || 'Untitled';

const normalizeMatchText = (value: string) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const findSimilarImportedFile = (fileNames: string[], match: ImportedCalendarEvent) => {
  return fileNames.find(fileName => {
    if (!fileName.startsWith(match.date) || !fileName.endsWith('.md')) return false;
    const normalizedName = normalizeMatchText(fileName);
    return normalizedName.includes(normalizeMatchText(match.title));
  });
};

const getMatchKey = (match: ImportedCalendarEvent) => `${match.date}:${normalizeMatchText(match.title)}`;

const getUniqueImportedEvents = (matches: ImportedCalendarEvent[]) => {
  const seen = new Set<string>();
  return matches.filter(match => {
    const key = getMatchKey(match);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildCalendarEventMarkdown = (match: ImportedCalendarEvent) => {
  const event: Event = {
    title: match.title,
    date: match.date,
    allDay: !match.startTime,
    startTime: match.startTime,
    endTime: match.endTime,
    completed: null,
    source: match.sourceKind
  };

  const details = [
    '',
    calendarImportMarker(match.sourceKind),
    `import-source-id: ${match.sourceId}`,
    match.estimatedTime ? 'import-estimated-time: true' : undefined,
    `Category: ${match.category}`,
    match.venue ? `Venue: ${match.venue}` : undefined,
    match.estimatedTime ? 'Kickoff source status: official source still lists time as TBA; fallback hour applied.' : undefined,
    `Source: ${match.sourceUrl}`
  ].filter((line): line is string => Boolean(line));

  return `${formatFrontmatter(event)}${details.join('\n')}\n`;
};

const importCalendarEvents = async (eventsFolder: string): Promise<ImportCalendarEventsResult> => {
  await fs.promises.mkdir(eventsFolder, { recursive: true });
  const result: ImportCalendarEventsResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const existingFileNames = await fs.promises.readdir(eventsFolder);
  const sources = [
    { id: 'fc-barcelona', fetch: fetchBarcelonaMatches },
    { id: 'uefa-champions-league', fetch: fetchChampionsLeagueMatches },
    { id: 'poland-national-team', fetch: fetchPolandNationalTeamMatches },
    { id: 'polish-public-holidays', fetch: fetchPolishHolidays }
  ] as const;

  const settled = await Promise.allSettled(sources.map(source => source.fetch()));
  const importedEvents = getUniqueImportedEvents(settled.flatMap((item, index) => {
    if (item.status === 'fulfilled') return item.value;
    result.errors.push(`${sources[index].id}: ${getErrorMessage(item.reason)}`);
    return [];
  }));

  for (const match of importedEvents) {
    const fileName = `${match.date} ${slugifyFilePart(match.title)}.md`;
    const similarFileName = findSimilarImportedFile(existingFileNames, match);
    const filePath = path.join(eventsFolder, similarFileName || fileName);
    const content = buildCalendarEventMarkdown(match);

    try {
      const existing = await fs.promises.readFile(filePath, 'utf-8').catch(error => {
        if (isRecord(error) && (error as { code?: string }).code === 'ENOENT') return undefined;
        throw error;
      });

      if (existing === undefined) {
        await fs.promises.writeFile(filePath, content, 'utf-8');
        existingFileNames.push(path.basename(filePath));
        result.created += 1;
      } else if (isManagedImportContent(existing)) {
        await fs.promises.writeFile(filePath, content, 'utf-8');
        result.updated += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error: unknown) {
      result.errors.push(`${match.title}: ${getErrorMessage(error)}`);
    }
  }

  return result;
};

if (started) {
  app.quit();
}

const useSystemFrame = process.env.OBSIDIAN_CALENDAR_SYSTEM_FRAME === '1';
const ozonePlatform = process.env.OBSIDIAN_CALENDAR_OZONE_PLATFORM;

if (ozonePlatform) {
  app.commandLine.appendSwitch('ozone-platform', ozonePlatform);
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    title: 'Obsidian Calendar Editor',
    frame: useSystemFrame,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('read-directory', async (_, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
    }));
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { content };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
});

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
});

ipcMain.handle('delete-file', async (_, filePath: string) => {
  try {
    await fs.promises.unlink(filePath);
    return { success: true };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });

  return { path: result.canceled ? undefined : result.filePaths[0] };
});

ipcMain.handle('import-calendar-events', async (_, eventsFolder: string) => {
  try {
    return await importCalendarEvents(eventsFolder);
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
});
