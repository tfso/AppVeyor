#!/usr/bin/env node
"use strict";
var sencha_1 = require('./../lib/sencha');
var path = require('path');
var program = require('commander');
program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD', path.normalize, process.env.SENCHACMD || "sencha.exe");
program
    .command('install')
    .option('-u, --url <url>', 'Url to sencha command sdk', process.env.SENCHACMD_URL || 'http://cdn.sencha.com/cmd/6.1.2/jre/SenchaCmd-6.1.2-windows-32bit.zip')
    .action(function (options) {
    process.stdout.write('Installing Sencha Cmd\n');
    process.stdout.write('Url: ' + options.url + '\n');
    sencha_1.default.install(options.url)
        .then(function (cmd) {
        process.stdout.write('Sencha command installed at "' + cmd + '"\n');
        process.env.SENCHACMD = cmd;
        process.exit(0);
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
    sencha_1.default.cmd = options.senchaCmd;
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
    .command('build')
    .description('Build all packages and apps in a workspace')
    .option('-p, --path <workspace>', 'Path to workspace', path.normalize, process.cwd())
    .action(function (options) {
    sencha_1.default.cmd = options.senchaCmd;
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
    process.stdout.write('Workspace: ' + options.path + '\n');
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
            if (err)
                process.stderr.write(err);
            process.exit(1);
        });
    })
        .catch(function (err) {
        process.stdout.write("Failed; Workspace Upgrade\n");
        if (err)
            process.stderr.write(err);
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