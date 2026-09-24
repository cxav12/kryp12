param(
    [Parameter(Mandatory=$true)]
    [string]$Search,

    [string]$Category = '',
    [string]$Class = '',
    [string]$FileName = '',
    [string]$Destination = '',
    [int]$Limit = 25
)

$LibraryRoot = 'C:\Gaming\Diablo IV Exports\Organized Assets'
$ManifestPath = Join-Path $LibraryRoot 'asset-manifest.csv'
$SiteRoot = 'C:\Users\cxav1\Desktop\cxav12.github.io\diablo'

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    Write-Error "Asset manifest not found: $ManifestPath"
    exit 1
}

$assets = Import-Csv -LiteralPath $ManifestPath

$matches = $assets | Where-Object {

    $searchMatch =
        $_.searchText -like "*$($Search.ToLowerInvariant())*" -or
        $_.internalName -like "*$Search*" -or
        $_.fileName -like "*$Search*" -or
        $_.atlas -like "*$Search*"

    $categoryMatch =
        [string]::IsNullOrWhiteSpace($Category) -or
        $_.category -eq $Category

    $classMatch =
        [string]::IsNullOrWhiteSpace($Class) -or
        $_.class -eq $Class

    $fileMatch =
        [string]::IsNullOrWhiteSpace($FileName) -or
        $_.fileName -eq $FileName

    $searchMatch -and $categoryMatch -and $classMatch -and $fileMatch
}

$matches = @($matches)

if ($matches.Count -eq 0) {
    Write-Host ''
    Write-Host 'No matching Diablo assets found.'
    exit 0
}

if (-not [string]::IsNullOrWhiteSpace($Destination)) {

    if ($matches.Count -ne 1) {
        Write-Host ''
        Write-Host "Found $($matches.Count) matches."
        Write-Host 'Narrow the search or use -FileName so exactly one asset matches.'
        Write-Host ''

        $matches |
            Select-Object -First $Limit category,class,internalName,atlas,fileName,relativePath |
            Format-Table -AutoSize

        exit 1
    }

    $asset = $matches[0]

    $sourceFile = Join-Path $LibraryRoot $asset.relativePath
    $destFile = Join-Path $SiteRoot $Destination
    $destFolder = Split-Path $destFile -Parent

    if (-not (Test-Path -LiteralPath $sourceFile)) {
        Write-Error "Source asset not found: $sourceFile"
        exit 1
    }

    New-Item -ItemType Directory -Path $destFolder -Force | Out-Null

    Copy-Item `
        -LiteralPath $sourceFile `
        -Destination $destFile `
        -Force

    Write-Host ''
    Write-Host 'Asset imported successfully.'
    Write-Host ''
    Write-Host "Website:"
    Write-Host $destFile
    Write-Host ''
    Write-Host "Internal name: $($asset.internalName)"
    Write-Host "Atlas:         $($asset.atlas)"
    Write-Host "SNO:           $($asset.sno)"
    Write-Host "Frame:         $($asset.frameIndex)"

    exit 0
}

Write-Host ''
Write-Host "Found $($matches.Count) matching asset(s):"
Write-Host ''

$matches |
    Select-Object -First $Limit `
        category,
        class,
        internalName,
        atlas,
        sno,
        frameIndex,
        fileName |
    Format-Table -AutoSize
