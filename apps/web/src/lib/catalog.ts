import "server-only";
import { CatalogRepository } from "@the-perfect-catch/db";
import { requireCatalogAccess } from "./authorization";
import { getDatabase } from "./database";
import { localReviewCatalog, localReviewCatalogFor, localReviewSchools } from "./local-review-catalog";
import { isLocalReviewAccess } from "./local-review-mode";

export async function loadCatalog(returnTo = "/regattas", includeSchoolPresentations = false)
{
    const access = await requireCatalogAccess(returnTo);
    if (isLocalReviewAccess(access))
    {
        const schools = includeSchoolPresentations ? localReviewSchools : [];
        return {
            access,
            catalog: localReviewCatalogFor(access.localReviewState ?? "ready"),
            schoolPresentations: Object.fromEntries(schools.map((school) => [school.id, school])),
        };
    }
    const repository = new CatalogRepository(getDatabase());
    const [catalog, schools] = await Promise.all([
        repository.getPublishedCatalog(),
        includeSchoolPresentations ? repository.listSchoolPresentations() : Promise.resolve([]),
    ]);
    return {
        access,
        catalog,
        schoolPresentations: Object.fromEntries(schools.map((school) => [school.id, school])),
    };
}

export async function loadSchools()
{
    const access = await requireCatalogAccess("/schools");
    if (isLocalReviewAccess(access))
    {
        return { access, schools: localReviewSchools };
    }
    const schools = await new CatalogRepository(getDatabase()).listSchoolPresentations();
    return { access, schools };
}

export async function loadSchool(id: string)
{
    const access = await requireCatalogAccess(`/schools/${encodeURIComponent(id)}`);
    if (isLocalReviewAccess(access))
    {
        return {
            access,
            school: localReviewSchools.find((school) => school.id === id) ?? null,
            races: localReviewCatalog.races.filter((race) =>
                race.results.some((result) => result.schoolKey === id)
            ),
        };
    }
    const repository = new CatalogRepository(getDatabase());
    const [school, races] = await Promise.all([
        repository.getSchoolPresentation(id),
        repository.listRaces({ schoolId: id }),
    ]);
    return { access, school, races };
}
