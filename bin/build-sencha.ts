#!/usr/bin/env node

import sencha from './../lib/sencha';
import path = require('path');

if (process.argv.length >= 2 && (process.argv[2] == "true" || process.argv[2] == "false")) {
    var skip_install = process.argv[2] === "true";
    var base_dir = process.argv[3] || process.cwd();
    var sdk_dir = process.argv[4] || "";
}
else {
    var skip_install = false;
    var base_dir = process.argv[2] || process.cwd();
    var sdk_dir = process.argv[3] || "";
}

//if (sdk_dir.length == 0) {
//    console.error("Sencha SDK is missing;" + sdk_dir);
//    process.exit(-1);
//}

if (sdk_dir.length != 0 && path.isAbsolute(sdk_dir) == false) {
    sdk_dir = path.resolve(base_dir, sdk_dir);
}

process.stdout.write('Building Sencha Project\n');
process.stdout.write('Workspace: ' + base_dir + '\n');
process.stdout.write('Sdk: ' + sdk_dir + '\n');

sencha.install(skip_install)
    .then((cmd) => {
        process.stdout.write('Sencha Command: ' + cmd + '\n');

        var workspace = new sencha.Workspace({
            path: base_dir,
            sdk: sdk_dir,
            senchaCmd: cmd
        });

        workspace.on('stdout', (data) => {
            process.stdout.write(data);
        });

        workspace.on('stderr', (data) => {
            process.stderr.write(data);
        });

        workspace.on('close', (code, err) => {
            if (code != 0) {
                //if (err)
                //    process.stderr.write('\\u001b[41m\u001b[36m' + err + '\u001b[0m\n');
            }
        });

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
                        process.exit(-1);
                    })
            })
            .catch((err) => {
                process.stdout.write("Failed; Workspace Upgrade\n");
                if (err) process.stderr.write(err);
                process.exit(-1);
            })

    })
    .catch((err) => {
        process.stdout.write("Failed; Sencha Install\n");
        if (err) process.stderr.write(err);
        process.exit(-1);
    })

