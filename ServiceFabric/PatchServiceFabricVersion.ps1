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
$paramApi = $xml.ApplicationManifest.Parameters.Parameter.Clone()
$paramWorker = $xml.ApplicationManifest.Parameters.Parameter.Clone()
$paramworker.Name = "ServiceFabricWorker_InstanceCount"
$paramApi.Name = "ServiceFabricApi_InvoiceCount"
$xml.ApplicationManifest.Parameters.AppendChild($paramApi)
$xml.ApplicationManifest.Parameters.AppendChild($paramWorker)
$xml.ApplicationManifest.Parameters.RemoveChild($xml.ApplicationManifest.Parameters.Parameter[0])
$xml.Save($xmlPath)
Get-Content $xmlPath
