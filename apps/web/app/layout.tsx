import "@repo/ui/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Instrument_Serif } from "next/font/google";

/**
 * The display face, and the only new one. Public Sans is what the design was
 * drawn in, but it is metric-compatible enough with the Geist already here
 * that Geist carries the UI and this ships alone — one webfont for the
 * headlines and the tally, rather than two for a difference nobody reads.
 *
 * It has a single weight on purpose. Nothing in the app asks for bold on it;
 * a browser told to embolden a one-weight face synthesises the extra weight
 * and the whole point of the face goes with it.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "ghosted.boo",
  description:
    "Every job you are chasing, how well you fit it, and how long it has been since anyone replied.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      className={`${GeistSans.variable} ${instrumentSerif.variable}`}
      lang="en"
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
