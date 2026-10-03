"use client";

import { Alert, Button } from "@the-perfect-catch/ui";
import { createAuthClient } from "better-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const authClient = createAuthClient();

export function GoogleSignIn({ returnTo, available }: { returnTo: string; available: boolean; })
{
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function signIn()
    {
        if (pending)
        {
            return;
        }
        setPending(true);
        setError(null);
        try
        {
            const result = await authClient.signIn.social(
                {
                    provider: "google",
                    callbackURL: `/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
                    errorCallbackURL: "/sign-in?error=oauth",
                },
            );
            if (result.error)
            {
                setError("Sign-in could not be completed. Check your connection and try again.");
                setPending(false);
            }
        }
        catch
        {
            setError("Google sign-in is unavailable. Check your connection and try again.");
            setPending(false);
        }
    }

    return (
        <div className="auth-controls">
            <Button onClick={signIn} disabled={pending || !available} aria-busy={pending}>
                <svg viewBox="0 0 24 24" aria-hidden="true" data-icon="inline-start">
                    <path
                        fill="currentColor"
                        d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4a4.7 4.7 0 0 1-2 3.1 6 6 0 1 1 .3-10l3-3A10 10 0 1 0 12 22c5.8 0 9.6-4 9.6-9.8Z"
                    />
                </svg>
                {pending ? "Connecting to Google..." : "Continue with Google"}
            </Button>
            {error ? <Alert>{error}</Alert> : null}
        </div>
    );
}

export function SignOut()
{
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(false);

    async function signOut()
    {
        setPending(true);
        setError(false);
        try
        {
            const result = await authClient.signOut();
            if (result.error)
            {
                throw new Error("Sign out failed");
            }
            router.replace("/sign-in");
            router.refresh();
        }
        catch
        {
            setError(true);
            setPending(false);
        }
    }

    return (
        <>
            <Button variant="ghost" onClick={signOut} disabled={pending} aria-busy={pending}>
                <LogOut data-icon="inline-start" />Sign out
            </Button>
            {error ? <p role="alert">Could not sign out. Try again.</p> : null}
        </>
    );
}
