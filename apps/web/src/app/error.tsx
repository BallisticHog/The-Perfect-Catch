"use client";

import { Button } from "@the-perfect-catch/ui";
import Link from "next/link";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string; }; reset: () => void; })
{
    return (
        <main className="boundary-page" id="main-content">
            <h1>The archive could not be loaded</h1>
            <p>Your last published results have not been changed. Check your connection and try again.</p>
            <Button onClick={reset}>Try again</Button>
            <Link href="/regattas">Return to regattas</Link>
        </main>
    );
}
