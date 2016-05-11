#!/usr/bin/env node
"use strict";
var patchVersion = require('./../lib/patch-version');
var appveyor = require('./../lib/appveyor');
var dir = process.argv[2] || process.cwd();
var version = appveyor.getBuildVersion();
patchVersion(dir, 'package.json', version.toString(), console.log, console.error, process.exit);
//# sourceMappingURL=patch-version.js.map