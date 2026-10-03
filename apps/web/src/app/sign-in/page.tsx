import { GoogleSignIn } from "@/components/auth-controls";
import { safeReturnPath } from "@/lib/return-path";
import { Alert, BrandMark } from "@the-perfect-catch/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(
    { searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>>; },
)
{
    const params = await searchParams;
    const available = Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.BETTER_AUTH_SECRET
            && process.env.DATABASE_URL,
    );
    return (
        <main className="sign-in-page" id="main-content">
            <div className="sign-in-brand">
                <BrandMark />
                <span>THE CATCH</span>
            </div>
            <section className="sign-in-panel">
                <h1>A clearer view of the finish.</h1>
                <p>South African school rowing, in one place.</p>
                <div className="sign-in-rule" />
                <h2>Sign in to the private beta</h2>
                <p>Use the Google account that was invited to The Catch.</p>
                {params.error
                    ? (
                        <Alert>
                            Sign-in could not be completed. Try again with your invited Google account.
                        </Alert>
                    )
                    : null}
                {!available ? <Alert>Sign-in is not available yet. Please try again later.</Alert> : null}
                <GoogleSignIn returnTo={safeReturnPath(params.returnTo)} available={available} />
                <p className="muted small">Access is limited to invited accounts.</p>
            </section>
            <footer>
                Independent rowing results archive. <Link href="/contact">Contact and privacy</Link>
            </footer>
        </main>
    );
}
