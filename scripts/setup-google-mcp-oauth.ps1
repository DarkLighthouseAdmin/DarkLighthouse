# Dark Lighthouse - Google MCP OAuth setup (Windows PowerShell)

$ErrorActionPreference = "Stop"

$ClientJson = "C:\Users\shue1\Downloads\client_secret_100153251402-p0ev117sl903r9cfqrm6m9jlr7sdd6sf.apps.googleusercontent.com.json"
$InstallDir = "C:\Users\shue1\Projects\dark-lighthouse-store\tools\google-mcp"

if (-not (Test-Path $ClientJson)) {
  throw "Client secret JSON not found: $ClientJson"
}

$raw = Get-Content $ClientJson -Raw | ConvertFrom-Json
$installed = $raw.installed
if (-not $installed) {
  throw "Expected installed Desktop app credentials in JSON."
}

$env:GOOGLE_CLIENT_ID = [string]$installed.client_id
$env:GOOGLE_CLIENT_SECRET = [string]$installed.client_secret

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Set-Location $InstallDir

if (-not (Test-Path ".\node_modules\@chieflatif\google-mcp\scripts\setup-oauth.js")) {
  Write-Host "Installing @chieflatif/google-mcp locally..."
  npm init -y | Out-Null
  npm install @chieflatif/google-mcp@0.2.1
}

$setupJs = Join-Path $InstallDir "node_modules\@chieflatif\google-mcp\scripts\setup-oauth.js"

$scopes = @(
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive"
) -join " "

$authUrl = "https://accounts.google.com/o/oauth2/v2/auth" +
  "?access_type=offline" +
  "&response_type=code" +
  "&client_id=$([uri]::EscapeDataString($env:GOOGLE_CLIENT_ID))" +
  "&redirect_uri=$([uri]::EscapeDataString('http://localhost:3333/callback'))" +
  "&scope=$([uri]::EscapeDataString($scopes))"

Write-Host "Client ID: $($env:GOOGLE_CLIENT_ID)"
Write-Host "Opening browser. Sign in with Workspace and click Allow."
Write-Host "Leave this window open until you see Success."
Write-Host ""
Write-Host "If Google shows redirect_uri_mismatch, add this URI on the OAuth client:"
Write-Host "  http://localhost:3333/callback"
Write-Host ""

Start-Process $authUrl
node $setupJs

$tokens = Join-Path $env:USERPROFILE ".mcp-google\tokens.json"
if (-not (Test-Path $tokens)) {
  throw "OAuth finished but tokens not found at $tokens"
}

Write-Host ""
Write-Host "SUCCESS. Tokens saved to $tokens"
Write-Host "Reply done in chat so the agent can wire mcp.json."
