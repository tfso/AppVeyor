Param
(
    [String]
    $PublishProfileFile = '.\' + $ServiceFabricProjectName + '\PublishProfiles\UlvenBeta.xml',

    [String]
    $ApplicationPackagePath = '.\' + $ServiceFabricProjectName + '\pkg\Release',

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

$connectArgs = @{ ConnectionEndpoint = $ConnectionEndpoint;  X509Credential = $X509Credential;  StoreLocation = $StoreLocation;  StoreName = $StoreName;  ServerCertThumbprint = $ServerCertThumbprint; FindType = $FindType;  FindValue = $FindValue }

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

. $PSScriptRoot\Deploy-FabricApplication.ps1 -PublishProfileFile $PublishProfileFile -ApplicationPackagePath $ApplicationPackagePath -OverrideUpgradeBehavior $OverrideUpgradeBehavior -OverwriteBehavior $OverwriteBehavior -DeployOnly:$DeployOnly -UnregisterUnusedApplicationVersionsAfterUpgrade:$UnregisterUnusedApplicationVersionsAfterUpgrade -UseExistingClusterConnection:$true -SkipPackageValidation:$SkipPackageValidation
