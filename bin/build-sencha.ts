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
console.log('Workspace: ' + base_dir);
console.log('Sdk: ' + sdk_dir);

sencha.install(skip_install)
    .then((cmd) => {
        console.log('Sencha Command: ' + cmd);

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
                process.stderr.write('Exit Code: ' + code);

                if (err)
                    process.stderr.write(err + '\n');

                process.exit(code);
            }
        });

        workspace.upgrade()
            .then(() => {
                return workspace.build()
                    .then(() => {
                        console.log('done building');

                        process.exit(0);
                    })
                    .catch((err) => {
                        console.error(err);
                    })

                //console.log(stdout);
            })
            .catch((err) => {
                console.error(err);
            })

    })
    .catch((err) => {
        console.error(err);
    })

