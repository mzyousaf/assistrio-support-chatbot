import React from "react";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

function cx(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({ title, className, children }: CardProps) {
  return (
    <div className={cx("bg-white border border-gray-200 rounded-2xl shadow-card p-4 md:p-6 dark:bg-gray-900/80 dark:border-gray-800", className)}>
      {title ? <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">{title}</h2> : null}
      {children}
    </div>
  );
}
