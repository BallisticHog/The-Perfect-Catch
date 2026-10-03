import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export * from "./school-theme";

export function cn(...values: (string | undefined | null | false)[]): string
{
    return values.filter(Boolean).join(" ");
}

export function Button(
    { className, variant = "primary", type = "button", onClick, disabled, ...props }:
        & ButtonHTMLAttributes<HTMLButtonElement>
        & { variant?: "primary" | "outline" | "ghost"; },
)
{
    const actionless = type === "button" && !onClick;
    return (
        <button
            className={cn("button", `button-${variant}`, className)}
            type={type}
            onClick={onClick}
            disabled={disabled || actionless}
            {...props}
        />
    );
}

export function Badge({ children }: { children: ReactNode; })
{
    return <span className="badge">{children}</span>;
}

export function Alert({ children, className, ...props }: HTMLAttributes<HTMLDivElement>)
{
    return <div role="alert" className={cn("alert", className)} {...props}>{children}</div>;
}

export function Empty({ title, children }: { title: string; children: ReactNode; })
{
    return (
        <section className="empty-state">
            <h2>{title}</h2>
            <div>{children}</div>
        </section>
    );
}

export function BrandMark()
{
    return (
        <svg className="brand-mark" viewBox="0 0 44 32" aria-hidden="true">
            <path fill="var(--color-cyan)" d="M11 1h8L9 31H1z" />
            <path fill="var(--color-red)" d="M24 1h8L22 31h-8z" />
            <path fill="var(--color-primary)" d="M37 1h7L34 31h-8z" />
        </svg>
    );
}

export function BoatMark({ className }: { className?: string; })
{
    return (
        <svg
            className={cn("boat-mark", className)}
            viewBox="0 0 108 34"
            aria-hidden="true"
            fill="currentColor"
        >
            <path d="M1 18c22-5 81-5 106 0-26 5-84 5-106 0Z" />
            <circle cx="57" cy="5" r="3" />
            <path d="m55 8 6 8-4 8-4-2 4-6-5-5zM55 10l-7 18 3 4 4-8zM57 15l-8-7-2 2 9 9z" />
        </svg>
    );
}

export function SchoolMonogram({ name, abbreviation }: { name: string; abbreviation: string; })
{
    return <span className="school-monogram" aria-label={`${name} monogram`}>{abbreviation.slice(0, 3)}
    </span>;
}
