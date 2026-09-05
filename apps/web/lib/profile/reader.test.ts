import { describe, expect, it } from "vitest";
import { decodedText, textComesFromTheModel } from "./reader";

/**
 * The half of the reader that needs no provider. Reaching Gemini is not tested
 * here — the endpoint substitutes the whole function for that — but which
 * files it is asked to transcribe, and what a text file's own text is, are
 * decisions this module makes on its own.
 */

describe("where a document's text comes from", () => {
  it("comes from the model for a PDF, which is what avoids a parsing library", () => {
    expect(textComesFromTheModel("application/pdf")).toBe(true);
  });

  it("comes from the file itself for a text file, which already is its text", () => {
    // The model is still asked about both — the skills it proposes are not
    // something a text file has already answered.
    expect(textComesFromTheModel("text/markdown")).toBe(false);
    expect(textComesFromTheModel("text/plain")).toBe(false);
  });
});

describe("a text file's own text", () => {
  it("is the file, decoded", () => {
    expect(decodedText(bytesOf("# Jane Doe\n\nSenior Engineer"))).toBe(
      "# Jane Doe\n\nSenior Engineer",
    );
  });

  it("keeps every character a CV might carry", () => {
    expect(decodedText(bytesOf("Jäger, Kraków — €90,000"))).toBe(
      "Jäger, Kraków — €90,000",
    );
  });

  it("is trimmed, so a file of nothing but whitespace reads as empty", () => {
    expect(decodedText(bytesOf("\n \t\n"))).toBe("");
  });

  it("is empty for bytes that are not text at all", () => {
    // The endpoint turns an empty reading into the message asking for a
    // cleaner copy, which is the right answer for a file mislabelled as text.
    expect(decodedText(new Uint8Array([0xff, 0xfe, 0x00, 0x01]))).toBe("");
  });
});

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
