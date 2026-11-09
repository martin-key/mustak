"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

/**
 * Проверката „Не съм робот“ на Cloudflare Turnstile (явно рендиране).
 * Токенът е за еднократна употреба: за нов опит родителят сменя `key`, а при демонтиране widget-ът се маха.
 */

type WidgetId = string;
interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): WidgetId;
  remove(widgetId: WidgetId): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  siteKey,
  action,
  onToken,
}: {
  siteKey: string;
  action: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<WidgetId | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  const render = useCallback(() => {
    if (!container.current || widgetId.current !== null || !window.turnstile) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      theme: "dark",
      language: "bg",
      size: "flexible",
      callback: (token: string) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(""),
      "error-callback": () => onTokenRef.current(""),
    });
  }, [siteKey, action]);

  useEffect(() => {
    // Ако скриптът вече е зареден (връщане към стъпката), рендираме веднага.
    render();
    return () => {
      if (widgetId.current !== null) {
        window.turnstile?.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [render]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={render}
      />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
