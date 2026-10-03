import Link from "next/link";

export default function NotFound()
{
    return (
        <main className="boundary-page" id="main-content">
            <h1>Page not found</h1>
            <p>This page is unavailable or has moved.</p>
            <Link href="/regattas">Return to regattas</Link>
        </main>
    );
}
