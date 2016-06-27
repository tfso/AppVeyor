#!/usr/bin/env node

import sencha from './../lib/sencha';
import appveyor from './../lib/appveyor';

import path = require('path');
import program = require('commander');
import proc = require('child_process');

program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .description('AppVeyor command-line tool for creating artifacts in Appveyor.')

program
    .command('add')
    .description('Create an artifact from a folder')
    .option('-p, --path <source root>', 'Path to root folder in the artifact', path.normalize, process.cwd())
    .option('-n, --name <artifact>', 'Name of the artifact: eg.: <artifact>.zip', path.normalize, "artifact")
    .action((options) => {
        appveyor.BuildWorker.addArtifact(options.name, options.path, options.name + ".zip", appveyor.ArtifactType.Zip, (err) => {
            if (err){
                process.stderr.write(err); process.exit(1);
            // } else {
            //     process.exit(0);
            }
        })
    })


program.parse(process.argv);