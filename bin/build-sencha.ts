#!/usr/bin/env node

import sencha from './../lib/sencha';
import path = require('path');
import program = require('commander');

program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD', path.normalize, process.env.SENCHACMD || "sencha.exe")

program
    .command('install')
    .option('-u, --url <url>', 'Url to sencha command sdk', process.env.SENCHACMD_URL || 'http://cdn.sencha.com/cmd/6.1.2/jre/SenchaCmd-6.1.2-windows-32bit.zip')
    .action((options) => {
        process.stdout.write('Installing Sencha Cmd\n');
        process.stdout.write('Url: ' + options.url + '\n');

        sencha.install(options.url)
            .then((cmd) => {
                process.stdout.write('Sencha command installed at "' + cmd + '"');

                process.env.SENCHACMD = cmd;
                process.exit(0);
            })
            .catch((err) => {
                process.stderr.write(err); process.exit(1);
            })
    })
   
program
    .command('repository <name> <url>')
    .description('Add a remote repository that should be used') //, (a, b) => { b.push(a); return b; }, [])
    .action((name, url, options) => {
        sencha.cmd = options.senchaCmd

        sencha.addRepository(name, url)
            .then((output) => {
                process.stdout.write(output);
                process.exit(0);
            })
            .catch((err) => {
                process.stderr.write(err); process.exit(1);
            })
    })

program
    .command('build')
    .description('Build all packages and apps in a workspace')
    .option('-p, --path <workspace>', 'Path to workspace', path.normalize, process.cwd())
    .action((options) => {
        sencha.cmd = options.senchaCmd

        var workspace = new sencha.Workspace({
            path: options.path
        });

        workspace.on('stdout', (data) => {
            process.stdout.write(data);
        });

        workspace.on('stderr', (data) => {
            process.stderr.write(data);
        });

        process.stdout.write('Building Sencha Project\n');
        process.stdout.write('Workspace: ' + options.path + '\n');
        process.stdout.write('\n');

        workspace.upgrade()
            .then(() => {
                workspace.build()
                    .then(() => {
                        process.stdout.write('\u001b[36mDone building\u001b[39m');
                        process.exit(0);
                    })
                    .catch((err) => {
                        process.stdout.write("Failed; Workspace Build\n");
                        if (err) process.stderr.write(err);
                        process.exit(1);  
                    })
            })
            .catch((err) => {
                process.stdout.write("Failed; Workspace Upgrade\n");
                if (err) process.stderr.write(err);
                process.exit(1);
            })
    })

program
    .command('*')
    .action(() => {
        program.help();
    })

program.parse(process.argv);

if (program.args.length == 0)
    program.help();

