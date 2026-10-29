$ErrorActionPreference = 'Stop'
$releasePrivate = 'C:\Users\91730\Downloads\AE-Release-Private'
$repoDirectory = Split-Path -Parent $PSScriptRoot
$signingProperties = Join-Path $repoDirectory 'android\upload-signing.properties'
if ((Test-Path $releasePrivate) -or (Test-Path $signingProperties)) {
    throw 'Signing material already exists. Do not replace it; inspect and reuse the existing key.'
}
New-Item -ItemType Directory -Path $releasePrivate | Out-Null
$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $releasePrivate /inheritance:r /grant:r "${currentIdentity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Unable to protect signing directory.' }
$passwordBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
$env:AE_UPLOAD_KEY_PASSWORD = [Convert]::ToHexString($passwordBytes)
$keyFile = Join-Path $releasePrivate 'ae-upload.jks'
try {
    & keytool -genkeypair -keystore $keyFile -storetype JKS -alias ae-upload -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=AE Upload, O=Affiliate Innovations, C=IN' -storepass:env AE_UPLOAD_KEY_PASSWORD -keypass:env AE_UPLOAD_KEY_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Upload key creation failed.' }
    $generatedProperties = "storeFile=$($keyFile.Replace('\','/'))`nstorePassword=$env:AE_UPLOAD_KEY_PASSWORD`nkeyAlias=ae-upload`nkeyPassword=$env:AE_UPLOAD_KEY_PASSWORD`n"
    [IO.File]::WriteAllText($signingProperties, $generatedProperties)
    & icacls $signingProperties /inheritance:r /grant:r "${currentIdentity}:F" 'SYSTEM:F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to protect signing properties.' }
    [IO.File]::WriteAllText((Join-Path $releasePrivate 'upload-signing.properties'), $generatedProperties)
    & keytool -exportcert -rfc -keystore $keyFile -alias ae-upload -storepass:env AE_UPLOAD_KEY_PASSWORD -file (Join-Path $releasePrivate 'ae-upload-certificate.pem')
    if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed.' }
    Write-Output 'Created protected upload key and local signing configuration. No password is printed.'
} finally {
    Remove-Item Env:\AE_UPLOAD_KEY_PASSWORD -ErrorAction SilentlyContinue
}
