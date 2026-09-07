import type { ReactNode } from "react";

/**
 * A titled surface a step above the page: radius 11, one hairline, and a sunk
 * header over a `paper-raised` body.
 *
 * The title is an eyebrow rather than a heading, so a page can be made of six
 * of these without six things competing with its own headline. It is still a
 * real heading in the document, because a panel is a landmark a reader
 * navigates by.
 *
 * `aside` is whatever the panel's own header offers — a control that acts on
 * what is inside it, and belongs on the same line as its name.
 */
export function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-panel border border-line bg-paper-raised">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-paper-sunk px-[18px] py-[13px]">
        <h2 className="text-[11px] leading-none font-semibold tracking-[0.09em] text-ink-muted uppercase">
          {title}
        </h2>
        {aside}
      </div>
      <div className="p-[18px]">{children}</div>
    </section>
  );
}
