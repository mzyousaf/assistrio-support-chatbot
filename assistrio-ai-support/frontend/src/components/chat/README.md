# Chat adapters

This folder contains **adapters** that use the single chat UI component: **`@/components/chat-ui/Chat.tsx`**.

- **AdminLiveChatAdapter** - Used on the Super Admin bot edit page (EditBotWorkspaceLayout). Calls `/api/super-admin/bots/:id/chat?debug=true` and renders chat-ui `Chat`.
- **BotChatPage** - Used on demo and trial bot pages. Calls `/api/demo/chat` or `/api/trial/chat` and renders chat-ui `Chat` with bot config (chatUI, avatar, suggested questions).

Chat in this project uses a single Unified backend pipeline (unified retrieval + evidence-first prompting). Any debug payload returned from the super-admin endpoint follows the Unified debug shape.

All chat UI in the app should use `@/components/chat-ui/Chat.tsx` only.
