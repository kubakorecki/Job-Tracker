import { describe, expect, it } from "vitest";
import { tokensReported, tokensSpentBy, UnreadableAnswer } from "./metered";

/**
 * What a call cost, read off what the provider said it cost. The only thing
 * worth proving here is the part that is easy to get quietly wrong: thinking
 * is billed, so a reading that left it out would under-report every call the
 * model thought about (ADR-0009).
 */

describe("the tokens a call reports", () => {
  it("counts the prompt, the answer and the thinking together", () => {
    expect(
      tokensReported({
        promptTokenCount: 12_000,
        candidatesTokenCount: 800,
        thoughtsTokenCount: 2_400,
      }),
    ).toBe(15_200);
  });

  it("counts a figure the provider left out as nothing spent", () => {
    expect(tokensReported({ promptTokenCount: 100 })).toBe(100);
  });

  it("counts a call the provider said nothing about as nothing spent", () => {
    // A call that failed before the provider answered records no usage and
    // still spends its Model Call, which is the daily count's business
    // (ADR-0009).
    expect(tokensReported(undefined)).toBe(0);
  });
});

describe("the tokens a failed call spent", () => {
  it("counts what a provider that answered unreadably was paid", () => {
    // The reply was billed: the model spent its prompt and its thinking before
    // producing something that could not be read (ADR-0009).
    expect(tokensSpentBy(new UnreadableAnswer(15_200, "not JSON"))).toBe(
      15_200,
    );
  });

  it("counts a provider that could not be reached as nothing spent", () => {
    expect(tokensSpentBy(new Error("503"))).toBe(0);
  });

  it("counts anything else thrown as nothing spent", () => {
    expect(tokensSpentBy("a string nobody expected")).toBe(0);
    expect(tokensSpentBy(undefined)).toBe(0);
  });
});
