param(
    [string]$JavaHome = "C:\Users\User\.jdks\ms-21.0.7",
    [string]$AppVersion = "1.0.2"
)

$ErrorActionPreference = 'Stop'
$originalPath = $env:Path

function Invoke-Step {
    param(
        [string]$Message,
        [scriptblock]$Action
    )
    Write-Host "[+] $Message"
    & $Action
}

Invoke-Step "Stopping running Java processes" {
    Stop-Process -Name java -ErrorAction SilentlyContinue
}

Invoke-Step "Removing previous dist output" {
    if (Test-Path dist) {
        Remove-Item -Recurse -Force dist
    }
}

if (-not (Test-Path $JavaHome)) {
    throw "JAVA_HOME path '$JavaHome' does not exist. Update the JavaHome parameter."
}

Invoke-Step "Configuring JAVA_HOME" {
    $env:JAVA_HOME = $JavaHome
    $env:Path = "$JavaHome\bin;$originalPath"
}

Invoke-Step "Running ant clean dist" {
    ant clean dist
}

$outputDir = "packaging/windows/output"
if (Test-Path $outputDir) {
    Remove-Item -Recurse -Force $outputDir
}
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$packageScript = Join-Path $PSScriptRoot 'packaging/windows/package.ps1'
if (-not (Test-Path $packageScript)) {
    throw "Unable to locate packaging script at $packageScript"
}

Invoke-Step "Building Windows MSI via jpackage" {
    & $packageScript -AppVersion $AppVersion -JavaHome $JavaHome
}

$expectedMsi = Join-Path $outputDir "Casbah POS-$AppVersion.msi"
if (Test-Path $expectedMsi) {
    Write-Host "Success! Installer created at $expectedMsi" -ForegroundColor Green
} else {
    throw "Packaging finished but expected installer was not found at $expectedMsi"
}
