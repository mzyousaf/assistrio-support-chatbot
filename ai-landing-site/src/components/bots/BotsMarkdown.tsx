"use client";

import ReactMarkdown from "react-markdown";

type BotsMarkdownProps = {
  content: string;
  className?: string;
};

export function BotsMarkdown({ content, className = "" }: BotsMarkdownProps) {
  return (
    <div className={`bots-md text-neutral-700 ${className}`}>
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-8 border-b border-neutral-200 pb-2 text-xl font-semibold tracking-tight text-neutral-900 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 text-base font-semibold text-neutral-900">{children}</h3>
          ),
          p: ({ children }) => <p className="mt-3 leading-relaxed first:mt-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-brand">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-3 list-decimal space-y-2 pl-5 marker:font-medium marker:text-neutral-500">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-neutral-900">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noreferrer noopener" : undefined}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
