"use client";

import { Button } from "@the-perfect-catch/ui";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function RowerDirectoryFilters(
    { values, schools, boatClasses }: {
        values: { q: string; school: string; boatClass: string; };
        schools: Array<{ id: string; name: string; }>;
        boatClasses: string[];
    },
)
{
    const router = useRouter();
    const [query, setQuery] = useState(values.q);
    const input = useRef<HTMLInputElement>(null);

    function submit(form: FormData)
    {
        const params = new URLSearchParams();
        for (const key of ["q", "school", "boatClass"])
        {
            const value = form.get(key)?.toString().trim();
            if (value)
            {
                params.set(key, value);
            }
        }
        router.push(`?${params.toString()}`);
    }

    function clearSearch()
    {
        setQuery("");
        const params = new URLSearchParams(window.location.search);
        params.delete("q");
        params.delete("page");
        router.push(`?${params.toString()}`);
        input.current?.focus();
    }

    return (
        <form className="catalog-filters rower-directory-filters" action={submit} noValidate>
            <div className="filter-field search-field">
                <label htmlFor="rower-search">Find a rower</label>
                <div className="search-control">
                    <Search aria-hidden="true" />
                    <input
                        ref={input}
                        id="rower-search"
                        name="q"
                        type="search"
                        placeholder="Name or school"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) =>
                        {
                            if (event.key === "Enter" && event.nativeEvent.isComposing)
                            {
                                event.preventDefault();
                            }
                        }}
                    />
                    {query
                        ? (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={clearSearch}
                                aria-label="Clear search"
                            >
                                <X aria-hidden="true" />
                            </Button>
                        )
                        : null}
                </div>
            </div>
            <div className="filter-field">
                <label htmlFor="rower-school">School</label>
                <select id="rower-school" name="school" defaultValue={values.school}>
                    <option value="">All schools</option>
                    {schools.map((school) => <option key={school.id} value={school.id}>{school.name}
                    </option>)}
                </select>
            </div>
            <div className="filter-field">
                <label htmlFor="rower-boat">Boat</label>
                <select id="rower-boat" name="boatClass" defaultValue={values.boatClass}>
                    <option value="">All boats</option>
                    {boatClasses.map((boatClass) => <option key={boatClass}>{boatClass}</option>)}
                </select>
            </div>
            <Button type="submit">Apply filters</Button>
        </form>
    );
}
