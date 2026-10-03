import { AppShell } from "@/components/app-shell";
import { requireCatalogAccess } from "@/lib/authorization";
import { publicContactEmail } from "@/lib/contact";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Corrections and removal" };

export default async function CorrectionsPage()
{
    const access = await requireCatalogAccess("/corrections-and-removals");
    const email = publicContactEmail();
    return (
        <AppShell name={access.name} active="data-sources">
            <main className="catalog-page prose-page" id="main-content">
                <div className="page-heading">
                    <h1>Corrections and removal</h1>
                    <p>
                        The Catch is an independent archive. It is not affiliated with or endorsed by the
                        schools, regatta organisers, or results publisher.
                    </p>
                </div>
                <section>
                    <h2>Tell us about a result</h2>
                    <p>
                        You can request a correction to a school name, result, crew appearance, or source
                        link, or ask for displayed content to be reviewed or removed.
                    </p>
                    <p>
                        Include the race page link and a short description of what needs attention. Please
                        avoid sending personal information that is not needed to understand the request.
                    </p>
                    {email
                        ? <a className="button button-primary" href={`mailto:${email}`}>Contact The Catch</a>
                        : (
                            <p>
                                The beta contact address has not been configured. Contact the person who
                                invited you to request a review.
                            </p>
                        )}
                </section>
                <section>
                    <h2>Source records</h2>
                    <p>
                        A change to the original sporting result may need to be raised with its publisher or
                        organiser. The original result link appears below each race.
                    </p>
                </section>
            </main>
        </AppShell>
    );
}
