#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const program = require("commander");
const command_1 = require("./../lib/sencha/command");
program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .description("Sencha wrapper")
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD, default: ' + (process.env.SENCHACMD || "sencha.exe"), path.normalize, process.env.SENCHACMD)
    .parse(process.argv);
if (program.args.length == 0)
    program.help();
var SENCHACMD = process.env.SENCHACMD || program['senchaCmd'] || null;
if (SENCHACMD)
    command_1.Command.path = SENCHACMD;
new command_1.Command()
    .on('stdout', data => process.stdout.write(data))
    .execute(...program.args)
    .then(() => process.exit(0))
    .catch((err) => {
    process.stdout.write('Error; ' + err.name + " - " + err.message);
    process.exit(-1);
});
//# sourceMappingURL=sencha.js.map