#!/usr/bin/env node
"use strict";
var appveyor_1 = require('./../lib/appveyor');
var path = require('path');
var program = require('commander');
program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .description('AppVeyor command-line tool for creating artifacts in Appveyor.');
program
    .command('add')
    .description('Create an artifact from a folder')
    .option('-p, --path <source root>', 'Path to root folder in the artifact', path.normalize, process.cwd())
    .option('-n, --name <artifact>', 'Name of the artifact: eg.: <artifact>.zip', path.normalize, "artifact")
    .action(function (options) {
    appveyor_1.default.BuildWorker.addArtifact(options.name, options.path, options.name + ".zip", appveyor_1.default.ArtifactType.Zip, function (err) {
        if (err) {
            process.stderr.write('\u001b[31m' + err.toString() + '\u001b[39m\n');
            process.exit(1);
        }
    });
});
program.parse(process.argv);
//# sourceMappingURL=artifact.js.map