#!/usr/bin/env node

import patchVersion = require('./../lib/patch-version');
import appveyor = require('./../lib/appveyor');

var dir = process.argv[2] || process.cwd();
var version = appveyor.getBuildVersion();

patchVersion(dir, 'package.json', version.toString(), console.log, console.error, process.exit);