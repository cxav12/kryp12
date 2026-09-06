param(
  [int]$Port = 8080,
  [string]$Site = "",
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$BaseUrl = "http://localhost:$Port/"
$requestedSite = $Site.Trim("/")
if (-not $requestedSite -and -not $NoBrowser) {
  Write-Host ""
  Write-Host "Choose a local site:"
  Write-Host "  1. KRYP12 home"
  Write-Host "  2. Baltimore Ravens"
  Write-Host "  3. New York Yankees"
  Write-Host "  4. Palworld"
  Write-Host "  5. Wishlist"
  $choice = Read-Host "Enter 1-5"
  $requestedSite = switch ($choice) {
    "2" { "ravens" }
    "3" { "yankees" }
    "4" { "palworld" }
    "5" { "wishlist" }
    default { "" }
  }
}
$sitePath = $requestedSite
$OpenUrl = if ($sitePath) { "${BaseUrl}${sitePath}/" } else { $BaseUrl }

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".gif"  = "image/gif"
  ".ico"  = "image/x-icon"
  ".txt"  = "text/plain; charset=utf-8"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  $headers = "HTTP/1.1 $StatusCode $StatusText`r`n" +
    "Content-Type: $ContentType`r`n" +
    "Content-Length: $($Body.Length)`r`n" +
    "Cache-Control: no-store`r`n" +
    "Connection: close`r`n`r`n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Resolve-SitePath {
  param([string]$RequestPath)

  $pathOnly = ($RequestPath -split "\?")[0]
  $decoded = [Uri]::UnescapeDataString($pathOnly)
  if ([string]::IsNullOrWhiteSpace($decoded) -or $decoded -eq "/") {
    $decoded = "/index.html"
  }

  $relative = $decoded.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar
  $candidate = [IO.Path]::GetFullPath((Join-Path $Root $relative))

  if ((Test-Path -LiteralPath $candidate -PathType Container)) {
    $candidate = Join-Path $candidate "index.html"
  }

  if (-not $candidate.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  return $candidate
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)

try {
  $listener.Start()
} catch {
  Write-Host "Could not start local server on port $Port."
  Write-Host "If another preview is already running, close it or run:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\start-local-site.ps1 -Port 8081"
  throw
}

Write-Host ""
Write-Host "Serving site from: $Root"
Write-Host "Local site URL: $OpenUrl"
Write-Host "Press Ctrl+C in this window to stop the server."
Write-Host ""

if (-not $NoBrowser) {
  Start-Process $OpenUrl
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $stream.ReadTimeout = 5000
      $stream.WriteTimeout = 5000
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      while ($true) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) { break }
      }

      if ($requestLine -notmatch "^(GET|HEAD)\s+(\S+)\s+HTTP/") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Bad Request")
        Send-Response $stream 400 "Bad Request" $body
        continue
      }

      $method = $Matches[1]
      $requestPath = $Matches[2]
      $filePath = Resolve-SitePath $requestPath

      if ($null -eq $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        Send-Response $stream 404 "Not Found" $body
        continue
      }

      $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = $mimeTypes[$extension]
      if (-not $contentType) {
        $contentType = "application/octet-stream"
      }

      $bytes = if ($method -eq "HEAD") { [byte[]]::new(0) } else { [IO.File]::ReadAllBytes($filePath) }
      Send-Response $stream 200 "OK" $bytes $contentType
    } catch {
      try {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Server Error")
        Send-Response $stream 500 "Internal Server Error" $body
      } catch {
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
