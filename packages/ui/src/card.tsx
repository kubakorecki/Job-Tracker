import React from "react";
import { type ReactNode } from "react";

/**
 * A panel: a titled surface a step above the page, with a sunk header over its
 * body. Radius 11, one hairline, and an eyebrow rather than a heading — a
 * panel names what is inside it without competing with the page's own title.
 */
export function Card({
  title,
  children,
  href,
  external = false,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  external?: boolean;
}) {
  const content = (
    <>
      <div className="ui:border-b ui:border-line ui:bg-paper-sunk ui:px-[18px] ui:py-[13px]">
        <h2 className="ui:text-[11px] ui:font-semibold ui:tracking-[0.09em] ui:text-ink-muted ui:uppercase">
          {title}
        </h2>
      </div>
      <div className="ui:p-[18px]">{children}</div>
    </>
  );

  const className =
    "ui:block ui:overflow-hidden ui:rounded-panel ui:border ui:border-line ui:bg-paper-raised";

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <a
      className={`${className} ui:hover:border-line-strong`}
      href={href}
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {content}
    </a>
  );
}
