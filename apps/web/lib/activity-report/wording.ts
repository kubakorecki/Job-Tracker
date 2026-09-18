import { z } from "zod";
import type { Month } from "./month";

/**
 * Everything the Activity Report says in its own voice, in both languages, and
 * the two date formats that go with them.
 *
 * The line it draws is the one the spec draws: the headings, the generator's
 * own wording and the dates translate; anything the user typed does not. So
 * every phrase the generator can produce is in this table and nowhere else,
 * and a row the user edited is carried across a language change untouched —
 * translating their words would be this app rewriting their report for them.
 *
 * The Polish is the canonical wording, because the office the report is handed
 * to is a Polish one and the phrases are the ones its forms use. The English
 * is there for the user's own reading and for an office that asks in English.
 */

export const Language = z.enum(["pl", "en"]);
export type Language = z.infer<typeof Language>;

/** The languages a report can be generated in, in the order they are offered. */
export const LANGUAGES = Language.options;

export const REPORT_LANGUAGE_KEY = "job-tracker:report-language";

/**
 * Where a user with no remembered choice starts. Polish, because the document
 * exists for a Polish labour office; English is the one they switch to.
 */
export const DEFAULT_LANGUAGE: Language = "pl";

/**
 * A stored value as a language. Anything that is not one of the two is the
 * default rather than an error the user has to clear their storage to escape —
 * the same reading `periodFrom` and `viewFrom` make of browser storage.
 */
export function languageFrom(stored: string | null): Language {
  const language = Language.safeParse(stored);
  return language.success ? language.data : DEFAULT_LANGUAGE;
}

/** What the app calls each language in its own toolbar. */
export const LANGUAGE_LABELS: Record<Language, string> = {
  pl: "Polski",
  en: "English",
};

/** Every phrase the generator can put on the page. */
export type Wording = {
  /** The document's own title, over the header. */
  title: string;
  /** What the header calls the month, the name and the day it was drawn up. */
  month: string;
  name: string;
  preparedOn: string;
  /**
   * What stands in the name box before the user has typed one. It invites
   * rather than repeating the label beside it, and it is the one word of the
   * document that is addressed to the user rather than to the office.
   */
  namePlaceholder: string;
  /** The three columns of the office's form. */
  columns: [employer: string, did: string, back: string];
  /** Column 1's last line, where the Job Application records where it came from. */
  source: (source: string) => string;
  /** Column 2: what the user did. */
  applied: string;
  interviewHeld: (stage: string) => string;
  withdrawn: string;
  /** Column 3: what came back. */
  invited: string;
  offer: string;
  rejected: string;
  nothingBack: string;
  /** The free block under the table. */
  notes: string;
};

const PL: Wording = {
  title: "Raport z aktywności w poszukiwaniu pracy",
  month: "Miesiąc",
  name: "Imię i nazwisko",
  preparedOn: "Sporządzono dnia",
  namePlaceholder: "twoje imię i nazwisko",
  columns: [
    "Pracodawca i stanowisko",
    "Podjęte działania",
    "Odpowiedź pracodawcy",
  ],
  source: (source) => `Źródło: ${source}`,
  applied: "Złożenie CV",
  interviewHeld: (stage) => `Rozmowa kwalifikacyjna — ${stage}`,
  withdrawn: "Wycofanie kandydatury",
  invited: "Zaproszenie na rozmowę",
  offer: "Oferta pracy",
  rejected: "Odmowa",
  nothingBack: "Brak odpowiedzi",
  notes: "Uwagi",
};

const EN: Wording = {
  title: "Job search activity report",
  month: "Month",
  name: "Name",
  preparedOn: "Prepared on",
  namePlaceholder: "your name",
  columns: ["Employer and role", "What you did", "What came back"],
  source: (source) => `Source: ${source}`,
  applied: "CV sent",
  interviewHeld: (stage) => `Interview — ${stage}`,
  withdrawn: "Application withdrawn",
  invited: "Invitation to interview",
  offer: "Job offer",
  rejected: "Rejection",
  nothingBack: "No reply",
  notes: "Notes",
};

export const WORDING: Record<Language, Wording> = { pl: PL, en: EN };

/**
 * The locale each language's dates are written in. Polish declines a month
 * name after a number — "5 września", not "5 wrzesień" — which is exactly the
 * kind of thing `Intl` knows and a table of month names in this file would get
 * wrong.
 *
 * These are the one set of date formatters outside `../day`, whose own comment
 * says that a second fixed-locale formatter elsewhere is how two of them come
 * to disagree. The exception is the document rather than the app: everything
 * `day.ts` formats is the app talking to its user in its own language, and
 * everything here is the report talking to an office in the language the user
 * chose for it. Nothing formatted here is ever shown beside something
 * formatted there, which is the disagreement that rule exists to prevent.
 */
const LOCALES: Record<Language, string> = { pl: "pl-PL", en: "en-GB" };

/**
 * A day inside the report's own month, as a cell says it: "5 września",
 * "5 September". No year, because the year is in the header and every entry in
 * the table is a day of the one month the header names.
 *
 * Formatted in UTC from a `YYYY-MM-DD` that was already resolved in the user's
 * zone — the day is settled by then, and reading it back in a zone would be a
 * second chance to move it.
 */
export function dayInWords(day: string, language: Language): string {
  return formatter(`day:${language}`, language, {
    day: "numeric",
    month: "long",
  }).format(startOf(day));
}

/** A whole day, as the header says it: "18 września 2026", "18 September 2026". */
export function fullDayInWords(day: string, language: Language): string {
  return formatter(`full:${language}`, language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(startOf(day));
}

/**
 * A month as the header and the selector say it: "wrzesień 2026",
 * "September 2026". The nominative in Polish, because it is the name of the
 * month rather than a date inside it.
 */
export function monthInWords(month: Month, language: Language): string {
  return formatter(`month:${language}`, language, {
    month: "long",
    year: "numeric",
  }).format(startOf(`${month}-01`));
}

/** One formatter per language and shape; building one costs more than using it. */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(
  key: string,
  language: Language,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const held = FORMATTERS.get(key);
  if (held !== undefined) return held;

  const made = new Intl.DateTimeFormat(LOCALES[language], {
    ...options,
    timeZone: "UTC",
  });

  FORMATTERS.set(key, made);
  return made;
}

/**
 * A calendar day as the instant the formatters above take, read in the zone
 * they format in so that the day cannot move on its way to being printed. The
 * day was settled in the reader's own zone long before it got here (ADR-0012),
 * and reading it back in a zone would be a second chance to move it.
 */
function startOf(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
