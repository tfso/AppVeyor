#!/usr/bin/env node
"use strict";
var sencha_1 = require('./../lib/sencha');
var path = require('path');
var program = require('commander');
program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .description('AppVeyor command-line tool for building Sencha (ExtJS) projects. Either provide path to sencha command with option, env:SENCHACMD')
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD, default: ' + (process.env.SENCHACMD || "sencha.exe"), path.normalize, process.env.SENCHACMD || "sencha.exe");
program
    .command('install')
    .description('The output to STDOUT is the path to sencha cmd, its executable')
    .option('-u, --url <url>', 'Url to sencha command sdk', process.env.SENCHACMD_URL || 'http://cdn.sencha.com/cmd/6.1.2/jre/SenchaCmd-6.1.2-windows-32bit.zip')
    .option('-d, --destination <path>', 'The destionation path where sencha command should be install. If left out, it is install in temp.')
    .action(function (options) {
    sencha_1.default.install(options.url, options.destination)
        .then(function (cmd) {
        process.stdout.write(cmd);
    })
        .catch(function (err) {
        process.stderr.write(err);
        process.exit(1);
    });
});
program
    .command('repository <name> <url>')
    .description('Add a remote repository that should be used') //, (a, b) => { b.push(a); return b; }, [])
    .action(function (name, url, options) {
    sencha_1.default.cmd = options.parent.senchaCmd;
    process.stdout.write('Adding repository for Sencha\n');
    process.stdout.write('Cmd: ' + options.parent.senchaCmd + '\n');
    process.stdout.write('\n');
    sencha_1.default.addRepository(name, url)
        .then(function (output) {
        process.stdout.write(output + "\n");
        process.exit(0);
    })
        .catch(function (err) {
        process.stderr.write(err);
        process.exit(1);
    });
});
program
    .command('publish')
    .description('Publish packages to repository and making artifacts of apps')
    .option('-p, --path <workspace>', 'Path to workspace', path.normalize, process.cwd())
    .action(function (options) {
    var workspace = new sencha_1.default.Workspace({
        path: options.path
    });
    workspace.publish();
});
program
    .command('build')
    .description('Build all packages and apps in a workspace')
    .option('-p, --path <workspace>', 'Path to workspace', path.normalize, process.cwd())
    .action(function (options) {
    sencha_1.default.cmd = options.parent.senchaCmd;
    var workspace = new sencha_1.default.Workspace({
        path: options.path
    });
    workspace.on('stdout', function (data) {
        process.stdout.write(data);
    });
    workspace.on('stderr', function (data) {
        process.stderr.write(data);
    });
    process.stdout.write('Building Sencha Project\n');
    process.stdout.write('Workspace: ' + workspace.workspace + '\n');
    process.stdout.write('Cmd: ' + sencha_1.default.cmd + '\n');
    process.stdout.write('\n');
    workspace.upgrade()
        .then(function () {
        workspace.build()
            .then(function () {
            process.stdout.write('\u001b[36mDone building\u001b[39m\n');
            process.exit(0);
        })
            .catch(function (err) {
            process.stdout.write("Failed; Workspace Build\n");
            process.exit(1);
        });
    })
        .catch(function (err) {
        process.stdout.write("Failed; Workspace Upgrade\n");
        process.exit(1);
    });
});
program
    .command('*')
    .action(function () {
    program.help();
});
program.parse(process.argv);
if (program.args.length == 0)
    program.help();
//# sourceMappingURL=build-sencha.js.map