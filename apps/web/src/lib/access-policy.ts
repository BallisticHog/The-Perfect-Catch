import { normalizeGrantedEmail } from "@the-perfect-catch/domain";

export type AccessIdentity = {
    userId: string;
    email: string;
    emailVerified: boolean;
    googleSubject: string;
};

export type AccessGrant = {
    emailNormalized: string;
    googleSubject: string | null;
    userId: string | null;
    status: "active" | "revoked";
    role: "admin" | "viewer";
};

export function normalizeEmail(email: string): string
{
    return normalizeGrantedEmail(email);
}

export function acceptsIdentity(
    identity: AccessIdentity,
    grant: AccessGrant | null,
    allowFirstBinding = false,
): boolean
{
    if (
        !grant || !identity.emailVerified || !identity.googleSubject || grant.status !== "active"
        || grant.emailNormalized !== normalizeEmail(identity.email)
    )
    {
        return false;
    }
    if (grant.googleSubject === null || grant.userId === null)
    {
        return allowFirstBinding
            && (grant.googleSubject === null || grant.googleSubject === identity.googleSubject)
            && (grant.userId === null || grant.userId === identity.userId);
    }
    return grant.googleSubject === identity.googleSubject && grant.userId === identity.userId;
}
