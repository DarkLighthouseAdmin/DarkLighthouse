Write-Host "=== GitHub login for DarkLighthouseAdmin ===" -ForegroundColor Cyan
Write-Host "1) Copy the one-time CODE when it appears (do not clear the window)"
Write-Host "2) Browser will open - sign in as DarkLighthouseAdmin (use Incognito if mhillORA is logged in)"
Write-Host "3) Paste the code on the GitHub page"
Write-Host ""
gh auth login --hostname github.com --git-protocol https --web
Write-Host ""
Write-Host "=== Result ===" -ForegroundColor Cyan
gh auth status
Write-Host ""
Write-Host "If DarkLighthouseAdmin is listed but not active, run: gh auth switch"
Write-Host "Press Enter to close..."
Read-Host
