#!/usr/bin/env node

import proc = require('child_process');
import path = require('path');
import program = require('commander');

import { Command } from './../lib/sencha/command';

program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .description("Sencha wrapper")
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD, default: ' + (process.env.SENCHACMD || "sencha.exe"), path.normalize, process.env.SENCHACMD)
    .parse(process.argv);

if (program.args.length == 0)
    program.help();

var SENCHACMD = process.env.SENCHACMD || program['senchaCmd'] || null;

if(SENCHACMD)
    Command.path = SENCHACMD;

new Command()
    .on('stdout', data => process.stdout.write(data))
    .execute(...program.args)
    .then(() => process.exit(0))
    .catch((err: Error) => {
        process.stdout.write('Error; ' + err.name + " - " + err.message);
        process.exit(-1);
    })