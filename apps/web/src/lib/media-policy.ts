export type MediaPolicyAsset = {
    visibility: "private_beta" | "public_approved" | "removed";
    rightsStatus: string;
    removedAt: Date | null;
};
export type MediaPolicyRelease = {
    mode: "private_beta" | "public";
    privacyApprovedAt: Date | null;
    privacyApprovedByUserId: string | null;
    privacyApprovalScope: string | null;
    privacyApprovalEvidence: Record<string, unknown> | null;
    crestRightsApprovedAt: Date | null;
    crestRightsApprovedByUserId: string | null;
    crestRightsApprovalScope: string | null;
    crestRightsApprovalEvidence: Record<string, unknown> | null;
    publicReleasedAt: Date | null;
    publicReleasedByUserId: string | null;
};

export function canServeMedia(
    asset: MediaPolicyAsset,
    release: MediaPolicyRelease | null,
    publicReleaseEnabled: boolean,
): boolean
{
    if (
        asset.removedAt !== null || asset.visibility === "removed" || asset.rightsStatus === "removed"
        || !release
    )
    {
        return false;
    }
    if (release.mode === "private_beta")
    {
        return asset.visibility === "private_beta" || asset.visibility === "public_approved";
    }
    return asset.visibility === "public_approved" && asset.rightsStatus === "licensed" && publicReleaseEnabled
        && Boolean(
            release.privacyApprovedAt && release.privacyApprovedByUserId && release.crestRightsApprovedAt
                && release.crestRightsApprovedByUserId && release.privacyApprovalScope
                && release.privacyApprovalEvidence && release.crestRightsApprovalScope
                && release.crestRightsApprovalEvidence && release.publicReleasedAt
                && release.publicReleasedByUserId,
        );
}
