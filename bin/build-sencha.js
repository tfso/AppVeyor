#!/usr/bin/env node
"use strict";
var sencha_1 = require('./../lib/sencha');
var path = require('path');
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
console.log('\u001b[31mWorkspace: ' + base_dir + '\u001b[39m');
console.log('\u001b[37mSdk: ' + sdk_dir + '\u001b[39m');
console.log('');
sencha_1.default.install(skip_install)
    .then(function (cmd) {
    console.log('Sencha Command: ' + cmd);
    var workspace = new sencha_1.default.Workspace({
        path: base_dir,
        sdk: sdk_dir,
        senchaCmd: cmd
    });
    workspace.on('stdout', function (data) {
        process.stdout.write(data);
    });
    workspace.on('stderr', function (data) {
        process.stderr.write(data);
    });
    workspace.on('close', function (code, err) {
        if (code != 0) {
            process.stderr.write('Exit Code: ' + code);
            if (err)
                process.stderr.write(err + '\n');
            process.exit(code);
        }
    });
    workspace.upgrade()
        .then(function () {
        return workspace.build()
            .then(function () {
            console.log('done building');
            process.exit(0);
        })
            .catch(function (err) {
            //console.error(err);
        });
        //console.log(stdout);
    });
    //})
    //.catch((err) => {
    //    console.error(err);
    //})
});
//})
//.catch((err) => {
//    console.error(err);
//})
//# sourceMappingURL=build-sencha.js.map