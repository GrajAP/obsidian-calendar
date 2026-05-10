export interface PublicHoliday {
  title: string;
  date: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const calculateEasterSunday = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const holiday = (title: string, date: Date): PublicHoliday => ({
  title,
  date: toDateKey(date)
});

export const getPolishPublicHolidays = (year: number): PublicHoliday[] => {
  const easterSunday = calculateEasterSunday(year);
  return [
    holiday('Nowy Rok', new Date(year, 0, 1)),
    holiday('Święto Trzech Króli', new Date(year, 0, 6)),
    holiday('Wielkanoc', easterSunday),
    holiday('Poniedziałek Wielkanocny', addDays(easterSunday, 1)),
    holiday('Święto Pracy', new Date(year, 4, 1)),
    holiday('Święto Konstytucji 3 Maja', new Date(year, 4, 3)),
    holiday('Zielone Świątki', addDays(easterSunday, 49)),
    holiday('Boże Ciało', addDays(easterSunday, 60)),
    holiday('Wniebowzięcie Najświętszej Maryi Panny', new Date(year, 7, 15)),
    holiday('Wszystkich Świętych', new Date(year, 10, 1)),
    holiday('Narodowe Święto Niepodległości', new Date(year, 10, 11)),
    holiday('Boże Narodzenie', new Date(year, 11, 25)),
    holiday('Drugi dzień Bożego Narodzenia', new Date(year, 11, 26)),
  ];
};
