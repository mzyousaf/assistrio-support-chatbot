import { createRoot, type Root } from "react-dom/client";
import React from "react";

import type { EmbedChatConfig } from "./types";
import { EmbedWidgetRoot } from "./widget-root";

type MountInstance = {
  root: Root;
  mountEl: HTMLDivElement;
};

let instance: MountInstance | null = null;

const MOUNT_ID = "assistrio-embed-widget-root";

/**
 * Singleton: one React root. If already mounted, re-renders {@link EmbedWidgetRoot} with the new
 * `rawConfig` (e.g. preview overrides changed) instead of ignoring the call.
 */
export function mountEmbedWidget(rawConfig: Partial<EmbedChatConfig>): void {
  if (typeof document === "undefined") return;
  if (instance) {
    instance.root.render(React.createElement(EmbedWidgetRoot, { rawConfig }));
    return;
  }

  const mountEl = document.createElement("div");
  mountEl.id = MOUNT_ID;
  document.body.appendChild(mountEl);

  const root = createRoot(mountEl);
  root.render(React.createElement(EmbedWidgetRoot, { rawConfig }));
  instance = { root, mountEl };
}

export function unmountEmbedWidget(): void {
  if (!instance) return;
  instance.root.unmount();
  instance.mountEl.remove();
  instance = null;
}

export function getMountedEmbedWidget(): boolean {
  return instance !== null;
}
