"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ChatText } from "./chat-text";
import { Mustache } from "./mustache";

type Message = { id: string; role: "user" | "bot"; text: string };

const STORAGE_KEY = "mustak-chat";
const MAX_INPUT = 1000;
const WELCOME: Message[] = [
  { id: "welcome-1", role: "bot", text: "Здрасти! Аз съм асистентът на Мустак." },
  {
    id: "welcome-2",
    role: "bot",
    text: "Мога да ти кажа цените, кой бръснар кога работи и да ти запазя час. Какво ще бъде?",
  },
];
const OFFLINE = "Нямам връзка със сървъра. Провери интернета и опитай пак.";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Разговорът се пази в sessionStorage на браузъра: остава при презареждане, изчезва при затваряне на таба. */
function loadConversation(): { sessionId: string; messages: Message[] } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved.sessionId === "string" && Array.isArray(saved.messages)) return saved;
  } catch {
    // няма достъп до sessionStorage (частен режим и т.н.): започваме нов разговор
  }
  return { sessionId: newId(), messages: [] };
}

function saveConversation(sessionId: string, messages: Message[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages: messages.slice(-50) }));
  } catch {
    // не е критично
  }
}

/**
 * Чат балонче долу вдясно. Говори с AI асистента в n8n през нашия /api/public/chat
 * (същия протокол като Chat Trigger-а на n8n: action, sessionId, chatInput → output).
 */
export function ChatBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sessionId = useRef<string>("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function openChat() {
    if (messages === null) {
      const saved = loadConversation();
      sessionId.current = saved.sessionId;
      setMessages(saved.messages);
    }
    setOpen(true);
  }

  function closeChat() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  // Фокус в полето при отваряне; Escape затваря.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Последното съобщение винаги се вижда.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending || messages === null) return;

    const withUser = [...messages, { id: newId(), role: "user" as const, text }];
    setMessages(withUser);
    setInput("");
    setSending(true);

    let reply = OFFLINE;
    try {
      const response = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendMessage", sessionId: sessionId.current, chatInput: text }),
      });
      const data = (await response.json()) as { output?: unknown };
      if (typeof data.output === "string" && data.output.trim()) reply = data.output;
    } catch {
      // остава OFFLINE
    }

    const withReply = [...withUser, { id: newId(), role: "bot" as const, text: reply }];
    setMessages(withReply);
    saveConversation(sessionId.current, withReply);
    setSending(false);
    inputRef.current?.focus();
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  function startOver() {
    sessionId.current = newId();
    setMessages([]);
    saveConversation(sessionId.current, []);
    inputRef.current?.focus();
  }

  const shown = [...WELCOME, ...(messages ?? [])];
  // На страницата за записване мобилната лента с бутоните е долу: балончето стои над нея.
  const lifted = pathname === "/zapazi-chas";

  return (
    <>
      <section
        id="mustak-chat"
        role="dialog"
        aria-label="Чат с асистента на Мустак"
        hidden={!open}
        className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bottle-900 pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:right-5 sm:bottom-24 sm:h-[min(600px,calc(100dvh-8rem))] sm:w-[380px] sm:rounded-2xl sm:border sm:border-gold/25 sm:pb-0 sm:shadow-[0_24px_60px_-12px_rgb(0_0_0/0.7)]"
      >
        <header className="flex items-start gap-3 border-b border-gold/20 bg-linear-to-b from-bottle-800 to-bottle-900 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl text-cream">Асистентът на Мустак</h2>
            <p className="mt-1 text-sm text-cream-muted">Пита се за цени и свободни часове. Записва за минута.</p>
          </div>
          {messages !== null && messages.length > 0 && (
            <button
              type="button"
              onClick={startOver}
              className="grid size-9 shrink-0 place-items-center rounded-full text-cream-muted transition-colors hover:bg-bottle-700 hover:text-cream"
              aria-label="Нов разговор"
              title="Нов разговор"
            >
              <svg viewBox="0 0 24 24" className="size-[1.1rem]" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={closeChat}
            className="grid size-9 shrink-0 place-items-center rounded-full text-cream-muted transition-colors hover:bg-bottle-700 hover:text-cream"
            aria-label="Затвори чата"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5" aria-live="polite">
          {shown.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gold px-3.5 py-2.5 text-[0.95rem] whitespace-pre-wrap text-bottle-950">
                  {message.text}
                </p>
              </div>
            ) : (
              <div
                key={message.id}
                className="max-w-[88%] rounded-2xl rounded-bl-md border border-line bg-bottle-700 px-3.5 py-2.5 text-[0.95rem] leading-relaxed text-cream"
              >
                <ChatText text={message.text} />
              </div>
            ),
          )}
          {sending && (
            <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md border border-line bg-bottle-700 px-4 py-3.5" role="status">
              <span className="sr-only">Асистентът пише…</span>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-cream-muted motion-reduce:animate-none"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        <form onSubmit={send} className="flex items-end gap-2 border-t border-line bg-bottle-900 p-3">
          <label htmlFor="mustak-chat-input" className="sr-only">
            Съобщение до асистента
          </label>
          <textarea
            id="mustak-chat-input"
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onInputKeyDown}
            rows={1}
            maxLength={MAX_INPUT}
            placeholder="Напиши съобщение…"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-bottle-800 px-3.5 py-2.5 text-[0.95rem] text-cream placeholder:text-cream-faint focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold text-bottle-950 transition-colors hover:bg-gold-bright disabled:bg-bottle-700 disabled:text-cream-faint"
            aria-label="Изпрати"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
              <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39 1.17L4.2 11 13 12l-8.8 1-2.19 6.23a1 1 0 001.39 1.17z" />
            </svg>
          </button>
        </form>
      </section>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closeChat() : openChat())}
        aria-expanded={open}
        aria-controls="mustak-chat"
        aria-label={open ? "Затвори чата" : "Чат с асистента: попитай или запази час"}
        className={`fixed right-4 z-40 grid size-15 place-items-center rounded-full border border-gold-bright/40 bg-[radial-gradient(circle_at_30%_25%,var(--color-gold-bright),var(--color-gold)_45%,var(--color-gold-deep))] text-bottle-950 shadow-[0_10px_30px_-6px_rgb(0_0_0/0.7),0_0_0_4px_rgb(210_168_89/0.12)] transition-transform hover:scale-105 active:scale-95 sm:right-5 sm:bottom-5 ${
          open ? "max-sm:hidden" : ""
        } ${lifted ? "bottom-24 md:bottom-5" : "bottom-4"}`}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="relative grid place-items-center">
            <svg viewBox="0 0 24 24" className="size-8" aria-hidden fill="currentColor">
              <path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.5 3.4 6L4.5 21l4.6-2.4c.9.2 1.9.4 2.9.4 5.5 0 10-3.6 10-8s-4.5-8-10-8z" />
            </svg>
            <Mustache className="absolute top-[0.62rem] w-5 text-gold-bright" />
          </span>
        )}
      </button>
    </>
  );
}
