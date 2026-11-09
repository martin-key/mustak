import { Fragment } from "react";
import { parseChatMarkdown, type Inline } from "@/lib/chat-markdown";

/** Отговор на асистента: малък markdown, нарисуван с React (без HTML от модела). */
export function ChatText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parseChatMarkdown(text).map((block, i) =>
        block.type === "paragraph" ? (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <InlineText parts={line} />
              </Fragment>
            ))}
          </p>
        ) : block.ordered ? (
          <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-gold">
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineText parts={item} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-gold">
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineText parts={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function InlineText({ parts }: { parts: Inline[] }) {
  return parts.map((part, i) => {
    if (part.type === "bold") return <strong key={i} className="font-semibold text-cream">{part.text}</strong>;
    if (part.type === "link") {
      const external = !part.href.startsWith("/");
      return (
        <a
          key={i}
          href={part.href}
          className="break-words text-gold-bright underline underline-offset-2 hover:text-cream"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {part.text}
        </a>
      );
    }
    return <Fragment key={i}>{part.text}</Fragment>;
  });
}
