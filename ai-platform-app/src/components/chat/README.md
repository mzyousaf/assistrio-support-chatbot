# Chat adapters

This folder contains **adapters** that use the single chat UI component: **`@/components/chat-ui/Chat.tsx`**.

- **AdminLiveChatAdapter** – Used on the Super Admin bot edit page (EditBotWorkspaceLayout). Calls `/api/super-admin/bots/:id/chat` and renders chat-ui `Chat`.
- **BotChatPage** – Used on demo and trial bot pages. Calls `/api/demo/chat` or `/api/trial/chat` and renders chat-ui `Chat` with bot config (chatUI, avatar, suggested questions).

All chat UI in the app should use `@/components/chat-ui/Chat.tsx` only.
