import type { Components } from "react-markdown";
import React from "react";

import { cx } from "./utils";

function childText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
    .join("")
    .trim();
}

/**
 * Markdown element overrides for assistant chat bubbles.
 * Citations are stripped in raw text + remark plugins; only real http(s) links stay clickable.
 */
export const chatMarkdownComponents: Components = {
  p: ({ children }) => <p className="chat-md-p">{children}</p>,
  strong: ({ children }) => <strong className="chat-md-strong">{children}</strong>,
  em: ({ children }) => <em className="chat-md-em">{children}</em>,
  ul: ({ children }) => <ul className="chat-md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="chat-md-ol">{children}</ol>,
  li: ({ children }) => <li className="chat-md-li">{children}</li>,
  blockquote: ({ children }) => <blockquote className="chat-md-blockquote">{children}</blockquote>,
  hr: () => <hr className="chat-md-hr" />,
  h1: ({ children }) => <h1 className="chat-md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="chat-md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="chat-md-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="chat-md-h4">{children}</h4>,
  pre: ({ children }) => <pre className="chat-md-pre">{children}</pre>,
  table: ({ children }) => (
    <div className="chat-md-table-wrap">
      <table className="chat-md-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="chat-md-thead">{children}</thead>,
  tbody: ({ children }) => <tbody className="chat-md-tbody">{children}</tbody>,
  tr: ({ children }) => <tr className="chat-md-tr">{children}</tr>,
  th: ({ children }) => <th className="chat-md-th">{children}</th>,
  td: ({ children }) => <td className="chat-md-td">{children}</td>,
  a: ({ href, children }) => {
    const label = childText(children);
    if (/^\d+$/.test(label)) return <span>{children}</span>;
    if (href && /^https?:\/\//i.test(href)) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-md-link"
        >
          {children}
        </a>
      );
    }
    return <span>{children}</span>;
  },
  code: ({ className, children }) => {
    if (className?.includes("language-")) {
      return <code className={cx("chat-md-code-block", className)}>{children}</code>;
    }
    return <code className="chat-md-inline-code">{children}</code>;
  },
  sup: ({ children }) => <>{children}</>,
  section: ({ className, children, ...rest }) => {
    if (typeof className === "string" && className.includes("footnotes")) return null;
    return (
      <section className={className} {...rest}>
        {children}
      </section>
    );
  },
};
