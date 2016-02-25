#!/usr/bin/env node
var patchVersion = require('./../lib/patch-version');
function getServiceTag() {
    var variables = [
        'APPVEYOR_BUILD_VERSION',
        'APPVEYOR_REPO_TAG_NAME'
    ];
    return variables
        .map(function (variable) {
        return process.env[variable] || "0.0.1";
    })
        .filter(function (variable) {
        return variable !== undefined && variable.length > 0;
    })[0] || 'INVALID';
}
;
var dir = process.argv[2] || process.cwd();
var version = getServiceTag();
console.log('Trying to patch version %', version);
patchVersion(dir, version, console.log, console.error, process.exit);
//# sourceMappingURL=patch-version.js.map