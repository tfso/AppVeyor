#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sencha = require("./../lib/sencha");
const path = require("path");
const program = require("commander");
const proc = require("child_process");
program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .description('AppVeyor command-line tool for building Sencha (ExtJS) projects. Either provide path to sencha command with option, env:SENCHACMD')
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD, default: ' + (process.env.SENCHACMD || "sencha.exe"), path.normalize, process.env.SENCHACMD || null);
program
    .command('install')
    .description('The output to STDOUT is the path to sencha cmd, its executable')
    .option('-u, --url <url>', 'Url to sencha command sdk', process.env.SENCHACMD_URL || 'http://cdn.sencha.com/cmd/6.1.2/jre/SenchaCmd-6.1.2-windows-32bit.zip')
    .option('-d, --destination <path>', 'The destionation path where sencha command should be install. If left out, it is install in temp.')
    .action((options) => {
    sencha.Command.install(options.url, options.destination)
        .then((cmd) => {
        process.stdout.write(cmd + '\n');
    })
        .catch((err) => {
        process.stderr.write(err);
        process.exit(1);
    });
});
program
    .command('repository <name> <url>')
    .description('Add a remote repository that should be used') //, (a, b) => { b.push(a); return b; }, [])
    .action((name, url, options) => {
    if (options.parent.senchaCmd)
        sencha.Command.path = options.parent.senchaCmd;
    process.stdout.write('Adding repository for Sencha\n');
    process.stdout.write('Cmd: ' + options.parent.senchaCmd + '\n');
    process.stdout.write('\n');
    sencha.Command.addRepository(name, url)
        .then((output) => {
        process.stdout.write(output + "\n");
        process.exit(0);
    })
        .catch((err) => {
        process.stderr.write(err);
        process.exit(1);
    });
});
program
    .command('publish [url]')
    .description('Publishing artifacts of apps and packages to appveyor, but if url is defined will packages be posted to repository instead')
    .option('-p, --path <workspace>', 'Path to workspace', path.normalize, process.cwd())
    .option('-t, --typeOnly <type>', 'Publish either package or app', /^(app|package)$/i, 'all')
    .action((url, options) => {
    var typeOnly = null;
    if (options.typeOnly == 'app')
        typeOnly = sencha.ModuleType.Application;
    if (options.typeOnly == 'package')
        typeOnly = sencha.ModuleType.Package;
    var workspace = new sencha.Workspace({
        path: options.path
    });
    workspace.publish(url, typeOnly)
        .then(() => { process.exit(0); })
        .catch((err) => { process.exit(1); });
});
program
    .command('build')
    .description('Build all packages and apps in a workspace')
    .option('-p, --path <workspace>', 'Path to workspace', path.normalize, process.cwd())
    .option('-d, --destination <path>', 'Destination of build directory', path.normalize, path.normalize(process.cwd() + '/build'))
    .option('-b, --buildOnly <type>', 'Build either package or app', /^(app|package)$/i, 'all')
    .option('-z, --keepPackageVersion', 'Flag to keep package version instead of replacing it with appveyor version')
    .option('-x, --keepAppVersion', 'Flag to keep app version instead of replacing it with appveyor version')
    .option('-j, --jsb <file>', 'Old style using the jsb that contains all of your project files')
    .option('-s, --sdk <path>', 'Path or Package name to Sencha framework')
    .action((options) => __awaiter(this, void 0, void 0, function* () {
    if (options.parent.senchaCmd)
        sencha.Command.path = options.parent.senchaCmd;
    if (options.jsb && options.jsb.length > 0) {
        process.stdout.write('Building project file "\u001b[36m' + options.jsb + '\u001b[39m"\n');
        process.stdout.write('Destination: ' + options.destination + '\n');
        var err, cmd = proc.spawn(sencha.Command.path || 'sencha.exe', ['build', '-p', path.normalize(options.jsb), '-d', path.normalize(options.destination)], { cwd: options.path, env: process.env });
        cmd.stdout.on('data', (data) => {
            process.stdout.write(data);
        });
        cmd.stderr.on('data', (data) => {
            process.stdout.write(data);
        });
        cmd.on('error', (ex) => {
            err = ex;
        });
        cmd.on('close', (code) => {
            process.exit(code);
        });
    }
    else {
        var workspace = new sencha.Workspace({
            path: options.path,
            buildPath: options.destination,
            sdk: options.sdk
        });
        workspace.on('stdout', (data) => {
            process.stdout.write(data);
        });
        workspace.on('stderr', (data) => {
            process.stderr.write(data);
        });
        process.stdout.write('Building Sencha Project\n');
        process.stdout.write('Workspace: ' + workspace.workspace + '\n');
        process.stdout.write('Cmd: ' + sencha.Command.path + '\n');
        process.stdout.write('\n');
        var buildType = null;
        if (options.buildOnly == 'app')
            buildType = sencha.ModuleType.Application;
        if (options.buildOnly == 'package')
            buildType = sencha.ModuleType.Package;
        try {
            yield workspace.refresh();
            yield workspace.build({ buildOnly: buildType, keepPackageVersion: (options.keepPackageVersion !== undefined ? options.keepPackageVersion === true : false), keepAppVersion: (options.keepAppVersion !== undefined ? options.keepAppVersion === true : false) });
            process.stdout.write('\u001b[36mDone building\u001b[39m\n');
            process.exit(0);
        }
        catch (err) {
            process.stdout.write("Failed; Workspace Build\n");
            process.exit(1);
        }
    }
}));
program
    .command('*')
    .action(() => {
    program.help();
});
program.parse(process.argv);
if (program.args.length == 0)
    program.help();
//# sourceMappingURL=build-sencha.js.map