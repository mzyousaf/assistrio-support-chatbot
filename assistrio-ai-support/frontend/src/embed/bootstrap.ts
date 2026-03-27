import { createRoot, type Root } from "react-dom/client";
import React from "react";

import type { EmbedChatConfig } from "./types";
import { AssistrioSnippetRoot } from "./snippet-root";

type MountInstance = {
  root: Root;
  mountEl: HTMLDivElement;
};

let instance: MountInstance | null = null;

const MOUNT_ID = "assistrio-embed-snippet-root";

/**
 * Mount the embed snippet once into `document.body`.
 *
 * **Singleton behaviour (safer default):** if a widget is already mounted, this is a
 * no-op. Call {@link unmountEmbedWidget} first, then mount again with a new config.
 * This avoids duplicate React roots and double network init on the host page.
 */
export function mountEmbedWidget(rawConfig: Partial<EmbedChatConfig>): void {
  if (typeof document === "undefined") return;
  if (instance) return;

  const mountEl = document.createElement("div");
  mountEl.id = MOUNT_ID;
  document.body.appendChild(mountEl);

  const root = createRoot(mountEl);
  root.render(React.createElement(AssistrioSnippetRoot, { rawConfig }));
  instance = { root, mountEl };
}

/** Unmount and remove the widget container. */
export function unmountEmbedWidget(): void {
  if (!instance) return;
  instance.root.unmount();
  instance.mountEl.remove();
  instance = null;
}

/** Whether the widget is currently mounted. */
export function getMountedEmbedWidget(): boolean {
  return instance !== null;
}
