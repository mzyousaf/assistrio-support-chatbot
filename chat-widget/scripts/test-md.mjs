import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { prepareChatMessageBodyForDisplay } from "../src/lib/chatMessageDisplay.util.ts";

const samples = [
  "Give me 5 creative ways to say our support team is available 24/7.",
  "available 24/7",
  "Assistrio helps businesses [1] [2]/[7].",
  "Assistrio helps [2](https://example.com).",
  "Visit https://example.com for details.",
];

for (const s of samples) {
  const stripped = prepareChatMessageBodyForDisplay(s);
  const html = renderToStaticMarkup(
    React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, stripped),
  );
  console.log("---");
  console.log("in:", s);
  console.log("stripped:", stripped);
  console.log("html:", html);
  console.log("has <a>:", html.includes("<a"));
}
