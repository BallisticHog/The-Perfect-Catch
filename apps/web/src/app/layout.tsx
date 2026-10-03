import type { Metadata } from "next";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@the-perfect-catch/ui/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
    title: { default: "The Catch", template: "%s | The Catch" },
    description: "The Catch private beta.",
    robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default function RootLayout({ children }: { children: React.ReactNode; })
{
    return (
        <html lang="en-ZA">
            <body>
                <a className="skip-link" href="#main-content">Skip to content</a>
                {children}
            </body>
        </html>
    );
}
