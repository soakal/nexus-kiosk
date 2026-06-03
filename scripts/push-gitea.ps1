# Push master to Gitea on the LAN (requires VPN/office network).
# First-time: Windows may prompt for Gitea username/password — use your Gitea login.
# If "vrsi-git" does not resolve, this script uses the IP directly.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$giteaUrl = "http://10.10.10.68:3000/briank/nexus-kiosk.git"
git remote set-url gitea $giteaUrl
Write-Host "Remote gitea -> $giteaUrl"
Write-Host "Pushing master..."
git push gitea master
Write-Host "Done. Verify: git ls-remote gitea master"
