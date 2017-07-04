#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const program = require("commander");
const command_1 = require("./../lib/sencha/command");
program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .description("Sencha wrapper")
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD, default: ' + (process.env.SENCHACMD || "sencha.exe"), path.normalize, process.env.SENCHACMD || "sencha.exe")
    .parse(process.argv);
if (program.args.length == 0)
    program.help();
var SENCHACMD = process.env.SENCHACMD || "sencha.exe";
if (program['senchaCmd'])
    SENCHACMD = program['senchaCmd'];
command_1.Command.path = SENCHACMD;
command_1.Command.execute(program.args, process.stdout.write)
    .then(() => process.exit(0))
    .catch(() => process.exit(-1));
//# sourceMappingURL=sencha.js.map