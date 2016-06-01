#!/usr/bin/env node

import appveyor from './../lib/appveyor';
import patchVersion from './../lib/patch-version';

import path = require('path');
import program = require('commander');

var file;

program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .arguments('<file>')
    .description('AppVeyor command-line tool for patching version to a file, defaults to package.json')
    .option('-b, --build-version [raw]', 'Version number in format 0.0.1 where it defaults to env:APPVEYOR_BUILD_VERSION', appveyor.getBuildVersion().toString())
    .action((f, options) => {
        file = path.normalize(f);
    })

program.parse(process.argv);

var source = path.parse( file || "package.json" );
file = !source.dir ? path.normalize(process.cwd() + '/' + source.base) : file;


patchVersion(file, program.buildVersion, console.log, console.error, process.exit);