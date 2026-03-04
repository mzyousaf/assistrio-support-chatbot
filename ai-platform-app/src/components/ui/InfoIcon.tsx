"use client";

import React from "react";

export default function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-gray-400 hover:text-brand-600 transition"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="8" r="1.1" fill="currentColor" />
      <path d="M12 11v6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
    </svg>
  );
}
