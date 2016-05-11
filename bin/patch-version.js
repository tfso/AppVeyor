#!/usr/bin/env node
"use strict";
var patchVersion = require('./../lib/patch-version');
var properties = require('./../lib/appveyor-properties');
var dir = process.argv[2] || process.cwd();
var version = properties.getBuildVersion();
patchVersion(dir, 'package.json', version.toString(), console.log, console.error, process.exit);
//# sourceMappingURL=patch-version.js.map