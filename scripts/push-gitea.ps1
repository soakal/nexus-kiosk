# Push master to Gitea on the LAN (requires VPN/office network).
# First-time: Windows may prompt for Gitea username/password — use your Gitea login.
# Repo: http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk (org vrsi-pc-build, repo nexus-kiosk)
# IP equivalent: http://10.10.10.68:3000/vrsi-pc-build/nexus-kiosk.git
# Migrated from http://10.10.10.68:3000/briank/nexus-kiosk.git

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$giteaUrl = "http://vrsi-git:3000/vrsi-pc-build/nexus-kiosk.git"
git remote set-url gitea $giteaUrl
Write-Host "Remote gitea -> $giteaUrl"
Write-Host "Pushing master..."
git push gitea master
Write-Host "Done. Verify: git ls-remote gitea master"
