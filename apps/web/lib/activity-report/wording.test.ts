import { describe, expect, it } from "vitest";
import {
  dayInWords,
  DEFAULT_LANGUAGE,
  fullDayInWords,
  languageFrom,
  monthInWords,
  WORDING,
} from "./wording";

/**
 * What the document says in its own voice. The Polish is the canonical
 * wording — it is the office's own — so the cases name the exact phrases
 * rather than checking that something came back.
 */

describe("languageFrom", () => {
  it("reads back a language that was stored", () => {
    expect(languageFrom("en")).toBe("en");
    expect(languageFrom("pl")).toBe("pl");
  });

  it("falls to the default rather than failing on anything else", () => {
    expect(languageFrom(null)).toBe(DEFAULT_LANGUAGE);
    expect(languageFrom("de")).toBe(DEFAULT_LANGUAGE);
    expect(languageFrom("")).toBe(DEFAULT_LANGUAGE);
  });

  it("starts in the language of the office the report is for", () => {
    expect(DEFAULT_LANGUAGE).toBe("pl");
  });
});

describe("WORDING", () => {
  it("says what the office's form says", () => {
    expect(WORDING.pl.applied).toBe("Złożenie CV");
    expect(WORDING.pl.interviewHeld("screening")).toBe(
      "Rozmowa kwalifikacyjna — screening",
    );
    expect(WORDING.pl.withdrawn).toBe("Wycofanie kandydatury");
    expect(WORDING.pl.invited).toBe("Zaproszenie na rozmowę");
    expect(WORDING.pl.offer).toBe("Oferta pracy");
    expect(WORDING.pl.rejected).toBe("Odmowa");
    expect(WORDING.pl.nothingBack).toBe("Brak odpowiedzi");
    expect(WORDING.pl.source("LinkedIn")).toBe("Źródło: LinkedIn");
    expect(WORDING.pl.notes).toBe("Uwagi");
  });

  it("takes the user's own word for a stage into both languages untranslated", () => {
    expect(WORDING.en.interviewHeld("rozmowa z CTO")).toBe(
      "Interview — rozmowa z CTO",
    );
  });
});

describe("dayInWords", () => {
  it("declines the month after the number, which is why Intl formats it", () => {
    expect(dayInWords("2026-09-05", "pl")).toBe("5 września");
    expect(dayInWords("2026-09-05", "en")).toBe("5 September");
  });

  it("leaves the year off, because the header carries it", () => {
    expect(dayInWords("2026-01-31", "pl")).not.toContain("2026");
  });
});

describe("fullDayInWords", () => {
  it("says the whole day, for the header that has no other year on it", () => {
    expect(fullDayInWords("2026-09-18", "pl")).toBe("18 września 2026");
    expect(fullDayInWords("2026-09-18", "en")).toBe("18 September 2026");
  });
});

describe("monthInWords", () => {
  it("names the month rather than dating it", () => {
    expect(monthInWords("2026-09", "pl")).toBe("wrzesień 2026");
    expect(monthInWords("2026-09", "en")).toBe("September 2026");
  });
});
