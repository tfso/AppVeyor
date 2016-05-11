#!/usr/bin/env node

import patchVersion = require('./../lib/patch-version');
import properties = require('./../lib/appveyor-properties');

var dir = process.argv[2] || process.cwd();
var version = properties.getBuildVersion();

patchVersion(dir, 'package.json', version.toString(), console.log, console.error, process.exit);