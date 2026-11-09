import { Suspense } from "react";
import { ChatLauncher } from "@/components/site/chat-launcher";
import { SiteFooter } from "@/components/site/footer";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <SiteFooter />
      <Suspense fallback={null}>
        <ChatLauncher />
      </Suspense>
    </>
  );
}
