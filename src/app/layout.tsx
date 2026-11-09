import type { Metadata, Viewport } from "next";
import { Golos_Text, Prata } from "next/font/google";
import { business } from "@/config/business";
import "./globals.css";

// Шрифтовете се свалят веднъж при build и се сервират от нашия сървър.
const prata = Prata({
  variable: "--font-prata",
  weight: "400",
  subsets: ["latin", "cyrillic"],
});

const golos = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: {
    default: `${business.legalName} | Онлайн записване`,
    template: `%s | ${business.name}`,
  },
  description: business.description,
};

export const viewport: Viewport = {
  themeColor: "#10201a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bg" className={`${prata.variable} ${golos.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
