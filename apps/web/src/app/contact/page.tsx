import { publicContactEmail } from "@/lib/contact";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Contact and privacy" };

export default function ContactPage()
{
    const email = publicContactEmail();
    return (
        <main id="main-content" className="catalog-page prose-page">
            <div className="page-heading">
                <h1>Contact and privacy</h1>
                <p>
                    The Catch is an independent private beta. It is not affiliated with schools, regatta
                    organisers, or a results publisher.
                </p>
            </div>
            <section>
                <h2>Access and account information</h2>
                <p>
                    Google sign-in is used to verify invited accounts. The Catch uses a session cookie to keep
                    you signed in. Your current invitation controls access to the archive.
                </p>
                <p>
                    Archive content is restricted to invited accounts. You can ask for displayed content or
                    account information to be reviewed, corrected, or removed.
                </p>
                {email
                    ? <a href={`mailto:${email}`}>Contact The Catch</a>
                    : <p>Contact the person who invited you to the beta to request help or a review.</p>}
            </section>
            <Link href="/sign-in">Return to sign in</Link>
        </main>
    );
}
