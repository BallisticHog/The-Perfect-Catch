import { SignOut } from "@/components/auth-controls";
import Link from "next/link";

export default function Forbidden()
{
    return (
        <main className="boundary-page" id="main-content">
            <h1>Access is not available</h1>
            <p>Your account cannot access this private beta. Sign out to use your invited Google account.</p>
            <SignOut />
            <Link href="/sign-in">Return to sign in</Link>
        </main>
    );
}
