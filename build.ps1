param(
    [string]$AppVersion = "1.0.2",
    [string]$JavaHome = "C:\Users\User\.jdks\ms-21.0.7"
)

function Invoke-Step {
    param(
        [string]$Message,
        [scriptblock]$Action
    )
    Write-Host "[+] $Message"
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Message"
    }
}

$originalPath = $env:Path

Invoke-Step "Stopping running Java processes" { Stop-Process -Name java -ErrorAction SilentlyContinue }
Invoke-Step "Cleaning previous dist output" { Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue }

if (-not (Test-Path $JavaHome)) {
    throw "Configured JavaHome '$JavaHome' does not exist."
}

Invoke-Step "Setting JAVA_HOME to $JavaHome" {
    $env:JAVA_HOME = $JavaHome
    $env:Path = "${JavaHome}\bin;$originalPath"
}

Invoke-Step "Running ant clean dist" { ant clean dist }

$packageScript = Join-Path -Path $PSScriptRoot -ChildPath 'packaging/windows/package.ps1'
if (-not (Test-Path $packageScript)) {
    throw "Packaging script not found at $packageScript"
}

Invoke-Step "Running Windows packaging script" {
    & powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $packageScript -AppVersion $AppVersion -JavaHome $env:JAVA_HOME
}

Write-Host "Build + Installer completed. Check packaging/windows/output/" -ForegroundColor Green
