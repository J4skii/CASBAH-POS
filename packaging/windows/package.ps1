param(
    [string]$AppVersion = "1.0.2",
    [string]$JavaHome = $env:JAVA_HOME
)

if (-not $JavaHome) {
    throw "JAVA_HOME is not set. Point it to a JDK 21 install before running this script."
}

$jpackageExe = Join-Path -Path $JavaHome -ChildPath 'bin/jpackage.exe'
$jlinkExe = Join-Path -Path $JavaHome -ChildPath 'bin/jlink.exe'

if (-not (Test-Path $jpackageExe)) {
    throw "jpackage.exe was not found under $JavaHome. Install a full JDK 21 (not just a JRE)."
}
if (-not (Test-Path $jlinkExe)) {
    throw "jlink.exe was not found under $JavaHome. Install a full JDK 21 (not just a JRE)."
}

$wixCandle = Get-Command candle.exe -ErrorAction SilentlyContinue
$wixLight = Get-Command light.exe -ErrorAction SilentlyContinue
if (-not $wixCandle -or -not $wixLight) {
    throw "WiX Toolset (candle.exe/light.exe) not found in PATH. Install WiX 3.0+ from https://wixtoolset.org and restart the shell."
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path -Path $scriptRoot -ChildPath '..\..')
$distDir = Join-Path -Path $repoRoot -ChildPath 'dist/casbahpos'
$mainJar = Join-Path -Path $distDir -ChildPath 'casbahpos.jar'

if (-not (Test-Path $mainJar)) {
    throw "dist/casbahpos/casbahpos.jar not found. Run 'ant clean dist' first."
}

$workDir = Join-Path -Path $scriptRoot -ChildPath '.work'
$stagingDir = Join-Path $workDir 'staging'
$runtimeDir = Join-Path $workDir 'runtime'
$appImageDir = Join-Path $workDir 'app-image'
$outputDir = Join-Path -Path $scriptRoot -ChildPath 'output'

Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item $stagingDir -ItemType Directory -Force | Out-Null
New-Item $outputDir -ItemType Directory -Force | Out-Null

Write-Host "Copying dist/casbahpos into staging..."
Copy-Item -Path (Join-Path $distDir '*') -Destination $stagingDir -Recurse -Force

if (Test-Path $runtimeDir) {
    Remove-Item $runtimeDir -Recurse -Force
}

Write-Host "Building trimmed runtime image via jlink..."
$jlinkArgs = @(
    '--module-path', (Join-Path $JavaHome 'jmods'),
    '--add-modules', 'java.desktop,java.sql,java.naming,java.management,java.xml,jdk.unsupported',
    '--strip-debug',
    '--no-header-files',
    '--no-man-pages',
    '--output', $runtimeDir
)
& $jlinkExe $jlinkArgs
if ($LASTEXITCODE -ne 0) {
    throw "jlink failed with exit code $LASTEXITCODE"
}

$launcherProps = Join-Path -Path $scriptRoot -ChildPath 'derby-launcher.properties'
if (-not (Test-Path $launcherProps)) {
    throw "Missing launcher properties file: $launcherProps"
}

Remove-Item $appImageDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item $appImageDir -ItemType Directory -Force | Out-Null

Write-Host "Creating jpackage app-image..."
$appImageArgs = @(
    '--type','app-image',
    '--name','Casbah POS',
    '--app-version',$AppVersion,
    '--input',$stagingDir,
    '--main-jar','casbahpos.jar',
    '--main-class','com.floreantpos.main.Main',
    '--runtime-image',$runtimeDir,
    '--dest',$appImageDir,
    '--add-launcher',"DerbyServer=$launcherProps"
)
& $jpackageExe $appImageArgs
if ($LASTEXITCODE -ne 0) {
    throw "jpackage app-image build failed with exit code $LASTEXITCODE"
}

$appImagePath = Join-Path $appImageDir 'Casbah POS'
$cfgPath = Join-Path $appImagePath 'app/Casbah POS.cfg'
if (-not (Test-Path $cfgPath)) {
    throw "Unable to locate generated launcher config: $cfgPath"
}

# Ensure the launcher always resolves the bundled runtime.
if (-not (Select-String -Path $cfgPath -Pattern '^app\.runtime=' -Quiet)) {
    Add-Content -Path $cfgPath -Value 'app.runtime=$APPDIR\..\runtime'
}

Write-Host "Invoking jpackage to build Windows MSI installer..."
$jpackageArgs = @(
    '--type','msi',
    '--name','Casbah POS',
    '--app-version',$AppVersion,
    '--app-image',$appImagePath,
    '--dest',$outputDir,
    '--win-menu',
    '--win-shortcut',
    '--win-dir-chooser',
    '--win-menu-group','Casbah POS'
)
& $jpackageExe $jpackageArgs
if ($LASTEXITCODE -ne 0) {
    throw "jpackage MSI build failed with exit code $LASTEXITCODE"
}

Write-Host "Success! MSI installer available in $outputDir" -ForegroundColor Green
