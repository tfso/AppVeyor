#!/usr/bin/env node

import patchVersion = require('./../lib/patch-version');

function getServiceTag() {
    var variables  = [
        'APPVEYOR_BUILD_VERSION',
        'APPVEYOR_REPO_TAG_NAME'
    ];

    return variables
        .map((variable) : string => {
            return process.env[variable] || "0.0.1";
        })
        .filter((variable : string) => {
            return variable !== undefined && variable.length > 0;
        })[0] || 'INVALID';
};

var dir = process.argv[2] || process.cwd();
var version = getServiceTag(); 

console.log('Trying to patch version %', version);

patchVersion(dir, version, console.log, console.error, process.exit);