#!/usr/bin/env node

import sencha from './../lib/sencha';
import path = require('path');

var base_dir = process.argv[2] || process.cwd();
var sdk_dir = process.argv[3] || "";

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
console.log('');

var workspace = new sencha.Workspace(base_dir, sdk_dir);

workspace.on('stdout', (data) => {
    process.stdout.write(data + '\n');
});

workspace.on('stderr', (data) => {
    process.stderr.write(data + '\n');
});

workspace.on('close', (code, err) => {
    if (code != 0) {
        process.stderr.write(err + '\n');
        process.exit(code);
    }
});

workspace.upgrade()
    .then(() => {
        return workspace.build()
            .then(() => {
                console.log('done building');
                
            })
            .catch((err) => { 
                //console.error(err);
            })

        //console.log(stdout);
    })

//sencha
//    .getModules(base_dir)
//    .then((modules) => {

//        Promise
//            .all(
//                modules.map((module) => {
//                    return module.open();
//                })
//            )
//            .then(() => {

//                // all modules is parsed
//                return Promise.all(
//                    modules.map((module) => {
//                        return module.build()
//                    })
//                );
//            })
//            .then((stdouts) => {

//                console.log([].concat.apply([], stdouts));

//                modules.forEach((module) => {
//                    console.log(module.name + ": " + module.version);
//                    console.log('directory: ' + path.dirname(module.location));
//                })

//            })
//            .catch((err) => {
//                console.error(err);
//                process.exit(-1);
//            })
//    })



//proc.exec('sencha.exe build', (err, stdout, stderr) => {
//    if (err) {
//        console.error(err);
        
//    }
//    console.log('STDOUT');
//    console.log(stdout);
//    console.log('STDERR');
//    console.warn(stderr);
//});