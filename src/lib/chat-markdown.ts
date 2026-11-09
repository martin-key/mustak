/**
 * Малък markdown за отговорите на чат асистента: абзаци, списъци, **удебелено**, [линк](адрес)
 * и голи адреси. Връща дърво от данни, а не HTML: компонентът го рисува с React, така че
 * текстът от модела никога не става HTML. Линковете са само https://, http:// или към нашия сайт (/...).
 */
export type Inline = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "link"; text: string; href: string };
export type Block = { type: "paragraph"; lines: Inline[][] } | { type: "list"; ordered: boolean; items: Inline[][] };

const INLINE_RE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?„“"'])/g;
const LIST_RE = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/;

export function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) result.push({ type: "text", text: text.slice(last, index) });
    const [whole, bold, linkText, linkHref, bareUrl] = match;
    if (bold !== undefined) {
      result.push({ type: "bold", text: bold });
    } else if (linkText !== undefined) {
      const href = safeHref(linkHref);
      result.push(href ? { type: "link", text: linkText, href } : { type: "text", text: linkText });
    } else if (bareUrl !== undefined) {
      const href = safeHref(bareUrl);
      result.push(href ? { type: "link", text: bareUrl, href } : { type: "text", text: whole });
    }
    last = index + whole.length;
  }
  if (last < text.length) result.push({ type: "text", text: text.slice(last) });
  return result;
}

export function parseChatMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[][] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph });
    if (list) blocks.push({ type: "list", ...list });
    paragraph = [];
    list = null;
  };

  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const item = LIST_RE.exec(line);
    if (item) {
      const ordered = item[2] !== undefined;
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(parseInline(item[3]));
      continue;
    }
    if (list) flush();
    // Заглавия (#) показваме като обикновен удебелен ред.
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    paragraph.push(heading ? [{ type: "bold", text: heading[1] }] : parseInline(line));
  }
  flush();
  return blocks;
}
