import { BoatMark } from "@the-perfect-catch/ui";

export function FinishGap(
    { gap, maximum, labels = false }: { gap: number | null; maximum: number; labels?: boolean; },
)
{
    const position = gap === null ? 0 : 100 - Math.min(100, gap / maximum * 100);
    return (
        <div className="finish-gap" aria-hidden="true">
            {labels
                ? (
                    <div className="gap-labels">
                        {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
                            <span key={fraction}>
                                {fraction === 0 ? "Finish" : `${(maximum * fraction).toFixed(1)}s`}
                            </span>
                        ))}
                    </div>
                )
                : null}
            <div className="gap-track">
                <span className="gap-ticks" />
                <span className="finish-line" />
                {gap !== null
                    ? (
                        <span className="gap-boat" style={{ left: `${position}%` }}>
                            <BoatMark />
                        </span>
                    )
                    : null}
            </div>
        </div>
    );
}
