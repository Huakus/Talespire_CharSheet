param()

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$distRoot = Join-Path $repoRoot 'dist-v2'
$releaseRoot = Join-Path $repoRoot 'release'
$packageRoot = Join-Path $releaseRoot 'Talespire_CharSheet'
$sourceManifestPath = Join-Path $repoRoot 'manifest.json'
$sourceHtmlPath = Join-Path $distRoot 'v2.html'

Set-Location -LiteralPath $repoRoot

Write-Host 'Building the production Symbiote...'
& npm.cmd run build:v2 -- --emptyOutDir=false
if ($LASTEXITCODE -ne 0) {
  throw "The production build failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path -LiteralPath $sourceManifestPath -PathType Leaf)) {
  throw 'manifest.json was not found.'
}
if (-not (Test-Path -LiteralPath $sourceHtmlPath -PathType Leaf)) {
  throw 'dist-v2/v2.html was not generated.'
}

$manifest = Get-Content -LiteralPath $sourceManifestPath -Raw | ConvertFrom-Json
$html = Get-Content -LiteralPath $sourceHtmlPath -Raw
$scriptMatch = [regex]::Match($html, '(?<path>\./assets/[^"''?]+\.js)')
$styleMatch = [regex]::Match($html, '(?<path>\./assets/[^"''?]+\.css)')

if (-not $scriptMatch.Success -or -not $styleMatch.Success) {
  throw 'Could not locate the generated JavaScript and CSS references in dist-v2/v2.html.'
}

function Resolve-DistAsset([string]$relativePath) {
  $relativePlatformPath = $relativePath.Substring(2).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
  $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $distRoot $relativePlatformPath))
  $distPrefix = $distRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

  if (-not $resolvedPath.StartsWith($distPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Generated asset points outside dist-v2: $relativePath"
  }
  if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
    throw "Generated asset does not exist: $relativePath"
  }

  return $resolvedPath
}

$sourceScriptPath = Resolve-DistAsset $scriptMatch.Groups['path'].Value
$sourceStylePath = Resolve-DistAsset $styleMatch.Groups['path'].Value

$expectedPackageRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'release\Talespire_CharSheet'))
if (-not $packageRoot.Equals($expectedPackageRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean unexpected package directory: $packageRoot"
}

if (Test-Path -LiteralPath $packageRoot) {
  Remove-Item -LiteralPath $packageRoot -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'assets') -Force | Out-Null

$html = $html.Replace($scriptMatch.Groups['path'].Value, './script.js')
$html = $html.Replace($styleMatch.Groups['path'].Value, './style.css')
$html | Set-Content -LiteralPath (Join-Path $packageRoot 'index.html') -Encoding utf8

Copy-Item -LiteralPath $sourceScriptPath -Destination (Join-Path $packageRoot 'script.js')
Copy-Item -LiteralPath $sourceStylePath -Destination (Join-Path $packageRoot 'style.css')
Copy-Item -LiteralPath (Join-Path $repoRoot 'README.md') -Destination (Join-Path $packageRoot 'README.md')

$manifest.entryPoint = '/index.html'
$manifest.descriptionFilePath = '/README.md'
if ([string]::IsNullOrWhiteSpace([string]$manifest.about.website)) {
  $manifest.about.website = 'https://github.com/Huakus/Talespire_CharSheet'
}
$manifest | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Encoding utf8

'Reserved for future packaged image, font, or media assets.' |
  Set-Content -LiteralPath (Join-Path $packageRoot 'assets\README.txt') -Encoding utf8

$packagedManifest = Get-Content -LiteralPath (Join-Path $packageRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($packagedManifest.manifestVersion -ne 1) {
  throw "Unsupported manifestVersion: $($packagedManifest.manifestVersion)"
}
if ($packagedManifest.entryPoint -ne '/index.html') {
  throw "Unexpected packaged entryPoint: $($packagedManifest.entryPoint)"
}
if ($packagedManifest.api.interop.id -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') {
  throw 'The interop id is not a valid UUID v4.'
}

$textFiles = Get-ChildItem -LiteralPath $packageRoot -Recurse -File |
  Where-Object { $_.Extension -in '.json', '.html', '.js', '.css', '.md', '.txt' }
foreach ($file in $textFiles) {
  $contents = Get-Content -LiteralPath $file.FullName -Raw
  if ($contents -match 'sb_secret_[A-Za-z0-9_-]+' -or $contents -match 'SUPABASE_DB_PASSWORD') {
    throw "A server-side Supabase secret was found in the package: $($file.Name)"
  }
}

$safeVersion = ([string]$packagedManifest.version) -replace '[^0-9A-Za-z._-]', '-'
$zipPath = Join-Path $releaseRoot "Talespire_CharSheet-$safeVersion-modio.zip"
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

$packageItems = Get-ChildItem -LiteralPath $packageRoot -Force | Select-Object -ExpandProperty FullName
Compress-Archive -Path $packageItems -DestinationPath $zipPath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
  foreach ($requiredEntry in @('manifest.json', 'index.html', 'script.js', 'style.css', 'README.md')) {
    if ($entries -notcontains $requiredEntry) {
      throw "ZIP validation failed: $requiredEntry is missing from the archive root."
    }
  }
  if ($entries | Where-Object { $_ -match '^Talespire_CharSheet/' }) {
    throw 'ZIP validation failed: the archive contains an extra wrapper directory.'
  }
}
finally {
  $archive.Dispose()
}

$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
Write-Host ''
Write-Host 'mod.io package created successfully:'
Write-Host "  Folder: $packageRoot"
Write-Host "  ZIP:    $zipPath"
Write-Host "  SHA256: $hash"
