import Link from "next/link";

export function ChampionshipNavigation(
    { regattaId, active }: { regattaId: string; active: "events" | "rowers"; },
)
{
    const items = [
        { key: "events", href: `/regattas/${encodeURIComponent(regattaId)}`, label: "Events" },
        {
            key: "rowers",
            href: `/regattas/${encodeURIComponent(regattaId)}/rowers`,
            label: "Rower records",
        },
    ] as const;
    return (
        <nav className="championship-navigation" aria-label="Championship catalogue">
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
    );
}
