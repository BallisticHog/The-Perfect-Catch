"use client";

import { Button } from "@the-perfect-catch/ui";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export interface CatalogFilterValues
{
    q: string;
    gender: string;
    ageGroup: string;
    boatClass: string;
    round: string;
    day: string;
}

interface CatalogFilterOptions
{
    ageGroups: string[];
    boatClasses: string[];
    days: string[];
}

function dayLabel(day: string): string
{
    return new Intl.DateTimeFormat("en-ZA", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "Africa/Johannesburg",
    }).format(new Date(`${day}T12:00:00+02:00`));
}

export function CatalogFilters(
    { values, options }: { values: CatalogFilterValues; options: CatalogFilterOptions; },
)
{
    const router = useRouter();
    const [query, setQuery] = useState(values.q);
    const input = useRef<HTMLInputElement>(null);

    function submit(form: FormData)
    {
        const params = new URLSearchParams();
        for (const key of ["q", "gender", "ageGroup", "boatClass", "round", "day"])
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
        <form className="catalog-filters" action={submit} noValidate>
            <div className="filter-field search-field">
                <label htmlFor="catalog-search">Find an event or school</label>
                <div className="search-control">
                    <Search aria-hidden="true" />
                    <input
                        ref={input}
                        id="catalog-search"
                        name="q"
                        type="search"
                        placeholder="Event 24, JM19 2-, or a school"
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
                                variant="ghost"
                                type="button"
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
                <label htmlFor="gender">Category</label>
                <select id="gender" name="gender" defaultValue={values.gender}>
                    <option value="">All categories</option>
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                    <option value="mixed">Mixed</option>
                </select>
            </div>
            <div className="filter-field">
                <label htmlFor="age-group">Age</label>
                <select id="age-group" name="ageGroup" defaultValue={values.ageGroup}>
                    <option value="">All ages</option>
                    {options.ageGroups.map((age) => <option key={age}>{age}</option>)}
                </select>
            </div>
            <div className="filter-field">
                <label htmlFor="boat-class">Boat</label>
                <select id="boat-class" name="boatClass" defaultValue={values.boatClass}>
                    <option value="">All boats</option>
                    {options.boatClasses.map((boat) => <option key={boat}>{boat}</option>)}
                </select>
            </div>
            <div className="filter-field">
                <label htmlFor="round">Round</label>
                <select id="round" name="round" defaultValue={values.round}>
                    <option value="">All rounds</option>
                    <option value="heat">Heat</option>
                    <option value="semifinal">Semi final</option>
                    <option value="repechage">Repechage</option>
                    <option value="final-a">Final A</option>
                    <option value="final-b">Final B</option>
                    <option value="final-c">Final C</option>
                </select>
            </div>
            <div className="filter-field">
                <label htmlFor="day">Day</label>
                <select id="day" name="day" defaultValue={values.day}>
                    <option value="">All days</option>
                    {options.days.map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
                </select>
            </div>
            <Button type="submit">Apply filters</Button>
        </form>
    );
}
