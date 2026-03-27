/**
 * Intercom Fin–inspired Chat UI – reusable, prop-driven components.
 *
 * Usage:
 *   import { Chat } from "@/components/chat-ui";
 *   <Chat messages={messages} onSend={handleSend} title="Support" />
 *
 * Or compose: ChatHeader, ChatMessages, ChatBubble, ChatSources, ChatComposer.
 */

export { Chat } from "./Chat";
export { ChatHeader } from "./ChatHeader";
export { ChatMessages } from "./ChatMessages";
export { ChatBubble } from "./ChatBubble";
export { ChatSources } from "./ChatSources";
export { ChatComposer } from "./ChatComposer";
export { ChatLauncherBubble } from "./ChatLauncherBubble";
export { ChatWithLauncher } from "./ChatWithLauncher";

export type { ChatProps } from "./Chat";
export type { ChatHeaderProps } from "./ChatHeader";
export type { ChatMessagesProps } from "./ChatMessages";
export type { ChatBubbleProps } from "./ChatBubble";
export type { ChatSourcesProps } from "./ChatSources";
export type { ChatComposerProps } from "./ChatComposer";
export type { ChatLauncherBubbleProps } from "./ChatLauncherBubble";
export type { ChatWithLauncherProps } from "./ChatWithLauncher";

export type {
  ChatUIMessage,
  ChatUIMessageRole,
  ChatUIMessageStatus,
  ChatUISource,
  ChatUITheme,
  ChatUIStrings,
} from "./types";
export { mapSources } from "./types";
