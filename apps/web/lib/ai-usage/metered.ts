import type { GenerateContentResponseUsageMetadata } from "@google/genai";

/**
 * What a call to the model cost, and how a provider answers with it.
 *
 * Every provider in the product answers with `Metered` rather than recording
 * usage itself: a provider knows what a call cost and has never heard of a
 * user, and the endpoint above it knows the user and has never heard of a
 * token count. Keeping the meter in the endpoint is also what keeps the
 * providers substitutable with no database at all.
 *
 * `Metered` is provider-neutral; `tokensReported` below is not, and is not
 * pretending to be — it reads Gemini's own usage block, because those three
 * field names are Gemini's vocabulary. A second provider brings its own reader
 * and answers with the same `Metered`.
 */

/** A provider's answer, and what it cost to get it. */
export type Metered<Answer> = { answer: Answer; tokens: number };

/**
 * What one call spent, read off what the provider reported.
 *
 * All three figures, because all three are billed: a model's own thinking is
 * charged at the output rate, and a meter that left it out would under-report
 * exactly the calls that cost the most (ADR-0009). The provider's own
 * `totalTokenCount` is deliberately not used — it also carries tool-use
 * tokens, which nothing here can spend, and naming the three we mean makes a
 * fourth appearing a decision rather than a surprise.
 *
 * A figure the provider left out is nothing spent, and so is a reply that
 * carried no usage at all.
 */
export function tokensReported(
  usage: GenerateContentResponseUsageMetadata | undefined,
): number {
  return (
    (usage?.promptTokenCount ?? 0) +
    (usage?.candidatesTokenCount ?? 0) +
    (usage?.thoughtsTokenCount ?? 0)
  );
}

/**
 * A call the provider answered, and billed for, whose answer could not be
 * read: a reply that was not the JSON it promised, or one carrying no content
 * at all.
 *
 * It carries what the call cost because the cost is real. ADR-0009 excuses
 * only the call that fails *before* the provider answers; a malformed reply is
 * the opposite case, and the expensive one — the model has already spent its
 * thinking on it. Rejecting with a bare error would lose exactly the tokens
 * most worth counting.
 */
export class UnreadableAnswer extends Error {
  constructor(
    readonly tokens: number,
    message: string,
  ) {
    super(message);
    this.name = "UnreadableAnswer";
  }
}

/**
 * What a failed call spent. Nought for every way of not reaching the provider,
 * and the reported tokens for a provider that answered with something
 * unreadable.
 *
 * Every endpoint's catch runs this over whatever it caught, so that "the
 * provider could not be understood" and "the provider could not be reached"
 * stay one answer to the user while remaining two different facts to the
 * meter.
 */
export function tokensSpentBy(error: unknown): number {
  return error instanceof UnreadableAnswer ? error.tokens : 0;
}
