import type { Metadata, Viewport } from "next";
import "@fontsource/fira-sans-extra-condensed/700-italic.css";
import "@fontsource/fira-sans-extra-condensed/800-italic.css";
import "@fontsource/fira-sans-extra-condensed/900-italic.css";
import "@fontsource-variable/golos-text/wght.css";
import "./globals.css";
import "./game.css";
import "./editor.css";

export const metadata: Metadata = {
  title: "Dash — the quiz race",
  description: "Build a quiz, share a code, and race your friends. Fastest right answer wins.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1E40C8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
