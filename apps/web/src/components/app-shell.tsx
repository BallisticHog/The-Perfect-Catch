import { BrandMark, schoolThemeProperties, type SchoolThemeTokens } from "@the-perfect-catch/ui";
import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { SignOut } from "./auth-controls";

export async function AppShell(
    { children, active, name, theme }: {
        children: React.ReactNode;
        active:
            | "home"
            | "regattas"
            | "live"
            | "schools"
            | "course-watch"
            | "my-rowing"
            | "programme"
            | "data-sources";
        name: string;
        theme?: SchoolThemeTokens | undefined;
    },
)
{
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("")
        .toUpperCase();
    const items = [
        { href: "/", label: "Home", key: "home" },
        {
            href: "/regattas",
            label: "Results",
            key: "regattas",
        },
        { href: "/live", label: "Live", key: "live" },
        {
            href: "/schools",
            label: "Schools",
            key: "schools",
        },
        { href: "/course-watch", label: "Course Watch", key: "course-watch" },
    ];
    return (
        <div
            className={theme ? "app-frame school-app-frame" : "app-frame"}
            style={theme ? schoolThemeProperties(theme) as CSSProperties : undefined}
        >
            <header className="app-header">
                <Link className="wordmark" href="/" aria-label="The Catch home">
                    <BrandMark />
                    <span>THE CATCH</span>
                </Link>
                <span className="brand-descriptor">SOUTH AFRICAN SCHOOL ROWING</span>
                <nav className="desktop-navigation" aria-label="Main navigation">
                    {items.map((item) => (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={active === item.key ? "page" : undefined}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <details className="account-menu">
                    <summary>
                        <span className="account-initials">{initials || "TC"}</span>
                        <span className="account-name">{name}</span>
                        <ChevronDown aria-hidden="true" />
                    </summary>
                    <div className="account-content">
                        <p>{name}</p>
                        <Link href="/my-rowing">My Rowing</Link>
                        <Link href="/programme">School Programme</Link>
                        <Link href="/data-sources">Data sources</Link>
                        <SignOut />
                        <Link href="/corrections-and-removals">Corrections and removal</Link>
                    </div>
                </details>
                <details className="mobile-navigation">
                    <summary aria-label="Open navigation">
                        <Menu aria-hidden="true" />
                    </summary>
                    <nav aria-label="Mobile navigation">
                        {items.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                aria-current={active === item.key ? "page" : undefined}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </details>
            </header>
            {children}
            <footer className="app-footer">
                <span>The Catch private development beta</span>
                <Link href="/corrections-and-removals">Corrections and removal</Link>
                <span>Independent of schools and regatta organisers.</span>
            </footer>
        </div>
    );
}
