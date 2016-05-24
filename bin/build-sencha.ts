#!/usr/bin/env node

import sencha from './../lib/sencha';
import appveyor from './../lib/appveyor';

import path = require('path');
import program = require('commander');
import proc = require('child_process');

program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .description('AppVeyor command-line tool for building Sencha (ExtJS) projects. Either provide path to sencha command with option, env:SENCHACMD')
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD, default: ' + (process.env.SENCHACMD || "sencha.exe"), path.normalize, process.env.SENCHACMD || "sencha.exe")

program
    .command('install')
    .description('The output to STDOUT is the path to sencha cmd, its executable')
    .option('-u, --url <url>', 'Url to sencha command sdk', process.env.SENCHACMD_URL || 'http://cdn.sencha.com/cmd/6.1.2/jre/SenchaCmd-6.1.2-windows-32bit.zip')
    .option('-d, --destination <path>', 'The destionation path where sencha command should be install. If left out, it is install in temp.')
    .action((options) => {
        sencha.install(options.url, options.destination)
            .then((cmd) => {
                process.stdout.write(cmd);
            })
            .catch((err) => {
                process.stderr.write(err); process.exit(1);
            })
    })
   
program
    .command('repository <name> <url>')
    .description('Add a remote repository that should be used') //, (a, b) => { b.push(a); return b; }, [])
    .action((name, url, options) => {
        sencha.cmd = options.parent.senchaCmd

        process.stdout.write('Adding repository for Sencha\n');
        process.stdout.write('Cmd: ' + options.parent.senchaCmd + '\n');
        process.stdout.write('\n');

        sencha.addRepository(name, url)
            .then((output) => {
                process.stdout.write(output + "\n");
                process.exit(0);
            })
            .catch((err) => {
                process.stderr.write(err); process.exit(1);
            })
    })

program
    .command('publish')
    .description('Publish packages to repository and making artifacts of apps')
    .option('-p, --path <workspace>', 'Path to workspace', path.normalize, process.cwd())
    .action((options) => {
        var workspace = new sencha.Workspace({
            path: options.path
        });

        workspace.publish();
    })

program
    .command('build')
    .description('Build all packages and apps in a workspace')
    .option('-p, --path <workspace>', 'Path to workspace', path.normalize, process.cwd())
    .option('-d, --destination <path>', 'Destination of build directory')
    .option('-j, --jsb <file>', 'Old style using the jsb that contains all of your project files')
    .action((options) => {
        sencha.cmd = options.parent.senchaCmd

        if (options.jsb.length > 0) {
            process.stdout.write('Building project file "\u001b[36m' + options.jsb + '\u001b[39m"\n');

            var err,
                cmd = proc.spawn(sencha.cmd || 'sencha.exe', ['build', '-p', path.normalize(options.jsb), '-d', path.normalize(options.destination)], { cwd: options.path, env: process.env });

            cmd.stdout.on('data', (data) => {
                this.output(data);
            })

            cmd.stderr.on('data', (data) => {
                this.output(data);
            })

            cmd.on('error', (ex) => {
                err = ex;
            })

            cmd.on('close', (code) => {
                process.exit(code)
            })
        }
        else {
            var workspace = new sencha.Workspace({
                path: options.path,
                buildPath: options.destination
            });

            workspace.on('stdout', (data) => {
                process.stdout.write(data);
            });

            workspace.on('stderr', (data) => {
                process.stderr.write(data);
            });

            process.stdout.write('Building Sencha Project\n');
            process.stdout.write('Workspace: ' + workspace.workspace + '\n');
            process.stdout.write('Cmd: ' + sencha.cmd + '\n');
            process.stdout.write('\n');

            workspace.upgrade()
                .then(() => {
                    workspace.build()
                        .then(() => {
                            process.stdout.write('\u001b[36mDone building\u001b[39m\n');
                            process.exit(0);
                        })
                        .catch((err) => {
                            process.stdout.write("Failed; Workspace Build\n");
                            process.exit(1);
                        })
                })
                .catch((err) => {
                    process.stdout.write("Failed; Workspace Upgrade\n");
                    process.exit(1);
                })
        }
    })

program
    .command('*')
    .action(() => {
        program.help();
    })

program.parse(process.argv);

if (program.args.length == 0)
    program.help();

