Param
(
    [String]
    $PublishProfileFile = $PSScriptRoot + '\PublishProfileUlvenBeta.xml',

    [String]
    $ApplicationPackagePath = '.\' + $env:ServiceFabricProjectName + '\pkg\Release',

    [Switch]
    $DeployOnly = $false,

    [Boolean]
    $UnregisterUnusedApplicationVersionsAfterUpgrade = $false,

	[Boolean]
    $X509Credential = $false,

    [String]
    [ValidateSet('None', 'ForceUpgrade', 'VetoUpgrade')]
    $OverrideUpgradeBehavior = 'None',

    [String]
    [ValidateSet('Never','Always','SameAppTypeAndVersion')]
    $OverwriteBehavior = 'Never',

    [Switch]
    $SkipPackageValidation = $false,

    [String]
    $ConnectionEndpoint = '213.179.54.42:19000',

    [String]
    $ServerCertThumbprint,

    [String]
    $FindType,

    [String]
    $FindValue,

    [String]
    $StoreLocation,

    [String]
    $StoreName
)


$xmlPath = $PSScriptRoot + "\ApplicationParametersUlvenBeta.xml"
$xml = [xml](Get-Content $xmlPath)
$xml.Application.Name = "fabric:/" + $env:ServiceFabricProjectName
$xml.Save($xmlPath)
Get-Content $xmlPath

if ($X509Credential -eq $true) {
	$connectArgs = @{ ConnectionEndpoint = $ConnectionEndpoint;  X509Credential = $X509Credential;  StoreLocation = $StoreLocation;  StoreName = $StoreName;  ServerCertThumbprint = $ServerCertThumbprint; FindType = $FindType;  FindValue = $FindValue }
}
else {
	$connectArgs = @{ ConnectionEndpoint = $ConnectionEndpoint }
}
try
{
    Connect-ServiceFabricCluster @connectArgs;
    $connection = Get-ServiceFabricClusterConnection;
    Write-Host $connection;
    $m = Get-ServiceFabricClusterManifest
    Write-Host $m;
	$global:clusterConnection = $clusterConnection # jævlig viktig
}
catch [System.Fabric.FabricObjectClosedException]
{
    Write-Warning "Service Fabric cluster may not be connected."
    throw
}
try {
    . $PSScriptRoot\Deploy-FabricApplication.ps1 -PublishProfileFile $PublishProfileFile -ApplicationPackagePath $ApplicationPackagePath -OverrideUpgradeBehavior $OverrideUpgradeBehavior -OverwriteBehavior $OverwriteBehavior -DeployOnly:$DeployOnly -UnregisterUnusedApplicationVersionsAfterUpgrade:$UnregisterUnusedApplicationVersionsAfterUpgrade -UseExistingClusterConnection:$true -SkipPackageValidation:$SkipPackageValidation
}
catch {
    Write-Warning "Upgrade failed. Trying to publish as a new service."
    $xml = [xml](Get-Content $PublishProfileFile)
    $xml.PublishProfile.UpgradeDeployment.Enabled = "false";
    $xml.Save($PublishProfileFile)
    Get-Content $PublishProfileFile
    . $PSScriptRoot\Deploy-FabricApplication.ps1 -PublishProfileFile $PublishProfileFile -ApplicationPackagePath $ApplicationPackagePath -OverrideUpgradeBehavior $OverrideUpgradeBehavior -OverwriteBehavior $OverwriteBehavior -DeployOnly:$DeployOnly -UnregisterUnusedApplicationVersionsAfterUpgrade:$UnregisterUnusedApplicationVersionsAfterUpgrade -UseExistingClusterConnection:$true -SkipPackageValidation:$SkipPackageValidation
}
