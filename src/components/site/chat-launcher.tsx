import { connection } from "next/server";
import { chatEnabled } from "@/server/chat";
import { ChatBubble } from "./chat-bubble";

/** Показва балончето само ако чатът е настроен (N8N_CHAT_WEBHOOK_URL). Чете средата при заявка, не при build. */
export async function ChatLauncher() {
  await connection();
  if (!chatEnabled()) return null;
  return <ChatBubble />;
}
