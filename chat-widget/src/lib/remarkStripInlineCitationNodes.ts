import type { Link, Parent, Root } from "mdast";
import { visit } from "unist-util-visit";

function linkLabel(node: Link): string {
  return node.children
    .map((c) => ("value" in c && typeof c.value === "string" ? c.value : ""))
    .join("")
    .trim();
}

function isHttpUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

/**
 * Remove numeric citation links / inline-code chips from markdown AST before render.
 * Complements {@link stripInlineCitationMarkers} on raw text.
 */
export function remarkStripInlineCitationNodes() {
  return (tree: Root) => {
    visit(tree, "link", (node: Link, index, parent: Parent | undefined) => {
      if (index == null || !parent) return;
      const label = linkLabel(node);
      if (!/^\d+$/.test(label)) return;
      if (isHttpUrl(node.url)) return;
      parent.children.splice(index, 1, { type: "text", value: label });
    });

    visit(tree, "inlineCode", (node, index, parent: Parent | undefined) => {
      if (index == null || !parent) return;
      const value = typeof node.value === "string" ? node.value.trim() : "";
      if (!/^\d+$/.test(value)) return;
      parent.children.splice(index, 1, { type: "text", value });
    });

    // GFM footnotes (disabled in UI — sources panel only)
    visit(tree, ["footnoteReference", "footnoteDefinition"] as const, (_node, index, parent: Parent | undefined) => {
      if (index == null || !parent) return;
      parent.children.splice(index, 1);
    });
  };
}
