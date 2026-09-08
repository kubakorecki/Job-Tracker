import { describe, expect, it } from "vitest";
import type { FitFraction } from "./compare";
import {
  BASIS_LABELS,
  fitColour,
  fitDescription,
  fitLabel,
  fitRatio,
  fitTally,
  GOOD_FIT_RATIO,
  PARTIAL_FIT_RATIO,
  RING_BASIS,
} from "./fit-ring";

/**
 * What a fit fraction reads as and what colour it runs at, with no ring and no
 * React in sight — the drawing is the component's, and these three answers are
 * the whole of what it has to decide.
 */

const fraction = (covered: number, required: number): FitFraction => ({
  covered,
  required,
});

describe("fitLabel", () => {
  it("reads as the two numbers, in words", () => {
    expect(fitLabel(fraction(6, 8))).toBe("6 of 8");
  });

  it("says a half where a partial Requirement made one", () => {
    expect(fitLabel(fraction(5.5, 8))).toBe("5.5 of 8");
  });

  it("says nothing covered rather than rounding it away", () => {
    expect(fitLabel(fraction(0, 3))).toBe("0 of 3");
  });
});

describe("fitRatio", () => {
  it("is how much of what was insisted on is covered", () => {
    expect(fitRatio(fraction(6, 8))).toBe(0.75);
  });

  it("is nothing where nothing is covered, and everything where it all is", () => {
    expect(fitRatio(fraction(0, 4))).toBe(0);
    expect(fitRatio(fraction(4, 4))).toBe(1);
  });
});

describe("fitTally", () => {
  it("is the two numbers with nothing between them but the stroke", () => {
    expect(fitTally(fraction(6, 8))).toBe("6/8");
    expect(fitTally(fraction(5.5, 8))).toBe("5.5/8");
  });
});

describe("fitColour", () => {
  it("answers with a token rather than a colour, so both themes are one table", () => {
    expect(fitColour(1)).toBe("var(--vital)");
    expect(fitColour(0.6)).toBe("var(--ember)");
    expect(fitColour(0)).toBe("var(--rose)");
  });

  it("turns at the thresholds themselves, not a hair past them", () => {
    expect(fitColour(GOOD_FIT_RATIO)).toBe("var(--vital)");
    expect(fitColour(GOOD_FIT_RATIO - 0.01)).toBe("var(--ember)");
    expect(fitColour(PARTIAL_FIT_RATIO)).toBe("var(--ember)");
    expect(fitColour(PARTIAL_FIT_RATIO - 0.01)).toBe("var(--rose)");
  });
});

describe("fitDescription", () => {
  it("says what the fraction is of, and which CV it was measured against", () => {
    expect(fitDescription(fraction(6, 8), "profile")).toBe(
      "Fit against your Profile: 6 of 8 required Requirements covered.",
    );
  });

  it("says so of the other Basis in the same breath", () => {
    expect(fitDescription(fraction(3, 3), "tailored-cv")).toBe(
      "Fit against your Tailored CV: 3 of 3 required Requirements covered.",
    );
  });

  it("does not call one Requirement several", () => {
    expect(fitDescription(fraction(1, 1), "profile")).toBe(
      "Fit against your Profile: 1 of 1 required Requirement covered.",
    );
  });
});

describe("RING_BASIS", () => {
  it("is the Profile, which is the only Basis anything is read against yet", () => {
    expect(RING_BASIS).toBe("profile");
    expect(BASIS_LABELS[RING_BASIS]).toBe("Profile");
  });
});
