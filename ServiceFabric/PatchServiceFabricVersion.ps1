$xmlPath = $env:APPVEYOR_BUILD_FOLDER + "\" + $env:CodeProjectName + "\PackageRoot\ServiceManifest.xml"
$xml = [xml](Get-Content $xmlPath)
$xml.ServiceManifest.Version=$env:APPVEYOR_BUILD_VERSION
$xml.ServiceManifest.CodePackage.Version=$env:APPVEYOR_BUILD_VERSION
$xml.ServiceManifest.ConfigPackage.Version=$env:APPVEYOR_BUILD_VERSION
$xml.Save($xmlPath)
Get-Content $xmlPath

$xmlPath = $env:APPVEYOR_BUILD_FOLDER + "\" + $env:ServiceFabricProjectName + "\ApplicationPackageRoot\ApplicationManifest.xml"
$xml = [xml](Get-Content $xmlPath)
$xml.ApplicationManifest.ApplicationTypeVersion=$env:APPVEYOR_BUILD_VERSION
$xml.ApplicationManifest.ServiceManifestImport.ServiceManifestRef.ServiceManifestVersion=$env:APPVEYOR_BUILD_VERSION
$xml.Save($xmlPath)
Get-Content $xmlPath
