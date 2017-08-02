#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const appveyor_1 = require("./../lib/appveyor");
const patch_version_1 = require("./../lib/patch-version");
const path = require("path");
const program = require("commander");
var file;
program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .arguments('<file>')
    .description('AppVeyor command-line tool for patching version to a file, defaults to package.json')
    .option('-b, --build-version [raw]', 'Version number in format 0.0.1 where it defaults to env:APPVEYOR_BUILD_VERSION', appveyor_1.default.getBuildVersion().toString())
    .action((f, options) => {
    file = path.normalize(f);
});
program.parse(process.argv);
var source = path.parse(file || "package.json");
file = !source.dir ? path.normalize(process.cwd() + '/' + source.base) : file;
patch_version_1.default(file, program.buildVersion, console.log, console.error, process.exit);
//# sourceMappingURL=patch-version.js.map