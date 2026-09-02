import React from "react";
import { type ReactNode } from "react";

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
      <h2 className="ui:mb-2 ui:text-lg ui:font-semibold">{title}</h2>
      <div className="ui:text-sm ui:opacity-70">{children}</div>
    </>
  );

  const className =
    "ui:group ui:block ui:rounded-lg ui:border ui:border-neutral-200 dark:ui:border-neutral-800 ui:px-5 ui:py-4 ui:transition-colors hover:ui:border-neutral-400 dark:hover:ui:border-neutral-600";

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <a
      className={className}
      href={href}
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {content}
    </a>
  );
}
