import { describe, expect, it } from "vitest";
import {
  EXCITEMENT_SAYS,
  excitementDescription,
  excitementStepLabel,
  excitementSays,
} from "./excitement";

/**
 * What a rating reads as, with no hearts and no React in sight — the drawing
 * is the component's, and the words are all this has to decide.
 */

describe("EXCITEMENT_SAYS", () => {
  it("has a word for nought as well as for the five steps", () => {
    expect(EXCITEMENT_SAYS).toHaveLength(6);
  });
});

describe("excitementSays", () => {
  it("says where a Job Application starts rather than that the control is empty", () => {
    expect(excitementSays(0)).toBe("Not rated.");
  });

  it("says the rating in words", () => {
    expect(excitementSays(1)).toBe("Not fussed.");
    expect(excitementSays(3)).toBe("Mildly keen.");
    expect(excitementSays(5)).toBe("Really want this one.");
  });
});

describe("excitementStepLabel", () => {
  it("names one heart in the singular", () => {
    expect(excitementStepLabel(1)).toBe("One heart");
  });

  it("counts the rest", () => {
    expect(excitementStepLabel(2)).toBe("2 hearts");
    expect(excitementStepLabel(5)).toBe("5 hearts");
  });
});

describe("excitementDescription", () => {
  it("says the fraction and the reading, for a mark with no room for either", () => {
    expect(excitementDescription(3)).toBe("Excitement: 3 of 5. Mildly keen.");
  });

  it("says an unrated Job Application is unrated rather than nought", () => {
    expect(excitementDescription(null)).toBe("Excitement: not rated.");
  });
});
