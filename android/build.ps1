# Builds water-reminder.apk with a plain JDK + Android build-tools (no Gradle).
# Tools are unpacked under _ma_build; every step fails loudly.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$proj = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $proj
$tools = Join-Path $root '_ma_build'

$bt = Join-Path $tools 'bt\android-14'
$aapt2 = Join-Path $bt 'aapt2.exe'
$d8 = Join-Path $bt 'd8.bat'
$zipalign = Join-Path $bt 'zipalign.exe'
$apksigner = Join-Path $bt 'apksigner.bat'
$androidJar = Join-Path $tools 'platform\android-12\android.jar'

foreach ($tool in @($aapt2, $d8, $zipalign, $apksigner, $androidJar)) {
  if (-not (Test-Path $tool)) { throw "missing tool: $tool" }
}

$build = Join-Path $proj 'build'
$classes = Join-Path $build 'classes'
$dexOut = Join-Path $build 'dex'
$resZip = Join-Path $build 'resources.zip'
$unsigned = Join-Path $build 'app-unsigned.apk'
$aligned = Join-Path $build 'app-aligned.apk'
$keystore = Join-Path $proj 'water-reminder.jks'
$apk = Join-Path $proj 'water-reminder.apk'

Remove-Item -Recurse -Force $build -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $classes, $dexOut | Out-Null

Write-Host '== 1/7 javac'
$sources = Get-ChildItem (Join-Path $proj 'src') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
& javac -encoding UTF-8 --release 11 -cp $androidJar -nowarn -d $classes $sources
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

Write-Host '== 2/7 d8'
$classFiles = Get-ChildItem $classes -Recurse -Filter '*.class' | ForEach-Object { $_.FullName }
& $d8 --release --min-api 24 --lib $androidJar --output $dexOut $classFiles
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }
$dex = Join-Path $dexOut 'classes.dex'
if (-not (Test-Path $dex)) { throw "missing $dex" }

Write-Host '== 3/7 aapt2 compile'
& $aapt2 compile --dir (Join-Path $proj 'res') -o $resZip
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }

Write-Host '== 4/7 aapt2 link'
& $aapt2 link -o $unsigned -I $androidJar --manifest (Join-Path $proj 'AndroidManifest.xml') `
  --min-sdk-version 24 --target-sdk-version 32 --version-code 2 --version-name 1.1 $resZip
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

Write-Host '== 5/7 add classes.dex'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($unsigned, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $entry = $archive.CreateEntry('classes.dex', [System.IO.Compression.CompressionLevel]::Optimal)
  $stream = $entry.Open()
  try {
    $bytes = [System.IO.File]::ReadAllBytes($dex)
    $stream.Write($bytes, 0, $bytes.Length)
  } finally {
    $stream.Dispose()
  }
} finally {
  $archive.Dispose()
}

Write-Host '== 6/7 zipalign'
Remove-Item -Force $aligned -ErrorAction SilentlyContinue
& $zipalign -f 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

Write-Host '== 7/7 sign'
if (-not (Test-Path $keystore)) {
  & keytool -genkeypair -keystore $keystore -alias water -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass waterreminder -keypass waterreminder `
    -dname 'CN=Water Reminder, O=Local, C=CN'
  if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
}
Remove-Item -Force $apk -ErrorAction SilentlyContinue
& $apksigner sign --ks $keystore --ks-key-alias water --ks-pass pass:waterreminder --key-pass pass:waterreminder --out $apk $aligned
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }
Remove-Item -Force ($apk + '.idsig') -ErrorAction SilentlyContinue

& $apksigner verify --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'apk verify failed' }

Write-Host ''
Write-Host ('APK: ' + $apk)
Write-Host ('size: ' + [math]::Round((Get-Item $apk).Length / 1024, 1) + ' KiB')
