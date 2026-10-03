<#
.SYNOPSIS
Runs an audited deployment over an existing, verified Tailscale SSH connection.
.EXAMPLE
./scripts/operations/Invoke-ProductionDeploy.ps1 -TailnetHost 100.100.100.100 -UserName deploy -CommitSha <40-character-sha>
.NOTES
Requires OpenSSH, Tailscale, a trusted SSH host key and an already prepared clean VM checkout.
No secret or backup files pass through this script. Host backups retain 7 daily,
4 weekly and 12 monthly sets plus pre-release recovery points and image digests.
#>
[CmdletBinding()]
param
(
    [Parameter(Mandatory)]
    [ValidatePattern('^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])$')]
    [string]$TailnetHost,

    [Parameter(Mandatory)]
    [ValidatePattern('^[a-z_][a-z0-9_-]{0,31}$')]
    [string]$UserName,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$CommitSha
)

$ErrorActionPreference = 'Stop'
Get-Command tailscale, ssh -ErrorAction Stop | Out-Null
& tailscale ping --c 1 --timeout 10s $TailnetHost
if ($LASTEXITCODE -ne 0)
{
    throw 'The production VM did not respond through Tailscale.'
}

$remoteCommand = "sudo --preserve-env=SSH_CONNECTION bash /opt/the-perfect-catch/scripts/operations/deploy.sh $CommitSha"
& ssh -t -o StrictHostKeyChecking=yes -o ConnectTimeout=15 "$UserName@$TailnetHost" $remoteCommand
if ($LASTEXITCODE -ne 0)
{
    throw "Production deployment failed with exit code $LASTEXITCODE. Review the VM audit log."
}
