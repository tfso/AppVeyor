import path = require('path');
import fsp = require('../lib/fs-promise');
import proc = require('child_process');
import events = require('events');
import async = require('async');

namespace Sencha {

    export enum ModuleType {
        Package,
        Application
    }

    export interface IWorkspace extends NodeJS.EventEmitter {
        basedir: string
        sdkdir: string

        getModules(callback?: (err: Error, modules?: Array<Sencha.IModule>) => void): Promise<Array<Sencha.IModule>>

        upgrade(callback?: (err: Error) => void): Promise<any>
        build(callback?: (err: Error) => void): Promise<any>
    }

    export interface IModule extends NodeJS.EventEmitter {
        location: string
        name: string
        version: string
        type: ModuleType

        open(callback?: (err: Error) => void): Promise<any>
        build(callback?: (err: Error) => void): Promise<any>
    }

    export class Workspace extends events.EventEmitter implements IWorkspace {
        basedir = ""
        sdkdir = ""

        constructor(base_directory: string, sdk_directory: string) {
            super();

            this.basedir = path.normalize(base_directory);
            this.sdkdir = path.normalize(sdk_directory);
        }

        //output(std: Buffer) {

        //    var regex = /^(?:\[([A-Z]{3})\])?(.*)$/gmi,
        //        match;

        //    while ( (match = regex.exec( std.toString() )) != null) {
        //        switch (match[1]) {
        //            case "INF":
        //            case "LOG":
        //            case "WARN":
        //                this.emit('stdout', match[2]); break;

        //            case "ERR":
        //                this.emit('stderr', match[2]); break;

        //            default:
        //                this.emit('stdout', match[2]); break;
        //        }
        //    }
        //}

        upgrade(callback?: (err: Error) => void) {
            var execute = new Promise((resolve, reject) => {
                var err,
                    cmd = proc.spawn('sencha.exe', ['framework', 'upgrade', 'ext', this.sdkdir || "ext"], { cwd: this.basedir, env: [] });

                cmd.stdout.on('data', (data) => {
                    this.emit('stdout', data.toString().replace(/\n/gi, ""));
                })

                cmd.stderr.on('data', (data) => {
                    this.emit('stderr', data.toString().replace(/\n/gi, ""));
                })

                cmd.on('error', (ex) => {
                    err = ex;
                })

                cmd.on('close', (code) => {
                    if (code != 0) {
                        this.emit('close', code, err); reject(err);
                    }
                    else {
                        this.emit('close', 0, null); resolve();
                    }
                })
            });

            if (callback != null) {
                // callback
                execute.then(() => { callback(null); }).catch((err) => { callback(err); });
            }
            else {
                // promise
                return execute;
            }
        }

        build(callback?: (err: Error) => void) {

            var execute = new Promise((resolve, reject) => {

                //console.log('fetching modules');

                this
                    .getModules()
                    .then((modules) => {

                        modules.forEach((module) => {
                            this.emit('stdout', 'Found ' + (module.type == ModuleType.Package ? 'package' : 'application') + ' "' + module.name + '" at "' + path.dirname(module.location) + '"');

                            module.on('stdout', (data) => {
                                this.emit('stdout', data);
                            })

                            module.on('stderr', (data) => {
                                this.emit('stderr', data);
                            })
                        });

                        async.series(
                            modules.map((module) => {
                                return (cb) => {
                                    this.emit('stdout', '\n');
                                    module.build(cb);
                                };
                            }),
                            (err, res) => {
                                if (err) {
                                    this.emit('close', -1, err); reject(err);
                                }
                                else {
                                    this.emit('close', 0); resolve();
                                }
                            }
                        )
                    })
                    .catch((err) => {
                        this.emit('close', -1, err); reject(err);
                    })
            });

            if (callback != null) {
                // callback
                execute.then(() => { callback(null); }).catch((err) => { callback(err); });
            }
            else {
                // promise
                return execute;
            }
        }

        getModules(callback?: (err: Error, modules?: Array<Sencha.IModule>) => void) {

            var execute: Promise<Array<Sencha.IModule>> = new Promise((resolve, reject) => {
                this.emit('stdout', 'Finding apps and packages in ' + this.basedir);

                Promise
                    .all([
                        fsp
                            .listFiles(path.join(this.basedir, 'packages/local'), 1)
                            .then((files) => {
                                return files
                                    .filter((file) => {
                                        return path.parse(file).base == 'package.json';
                                    })
                                    .map((file) => {
                                        return new Sencha.Module(file);
                                    });
                            }),
                        fsp
                            .listFiles(this.basedir, 1)
                            .then((files) => {
                                return files
                                    .filter((file) => {
                                        return path.parse(file).base == 'app.json';
                                    })
                                    .map((file) => {
                                        return new Sencha.Module(file);
                                    });
                            })
                    ]
                    )
                    .then((response) => {

                        var modules = [].concat.apply([], response);

                        return Promise
                            .all(
                                modules.map((module) => {
                                    return module.open();
                                })
                            )
                            .then(() => {
                                resolve(modules);
                            })
                            .catch((err) => {
                                throw err;
                            });
                    })
                    .catch((err) => {
                        reject(err);
                    })
            });

            if (callback != null) {
                // callback
                execute.then((modules) => { callback(null, modules); }).catch((err) => { callback(err); });
            }
            else {
                // promise
                return execute;
            }
        }
    }

    export class Module extends events.EventEmitter implements IModule {
        name = ""
        location = null
        version = null     

        constructor(location: string) {
            super();

            this.location = path.normalize(location);
        }

        get type() {
            switch (path.parse(this.location).base) {
                case "package.json":
                    return ModuleType.Package;

                case "app.json":
                    return ModuleType.Application;

                default:
                    return null;
            }
        }

        open(callback?: (err: Error) => void) {
            var readProperties = new Promise((resolve, reject) => {
                var c;
                fsp
                    .readFile(this.location)
                    .then((content: string) => {
                        content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");

                        var json = JSON.parse(content);

                        this.name = json.name;
                        this.version = json.version;
                    })
                    .then(() => {
                        resolve();
                    })
                    .catch((exception) => {
                        reject(exception);
                    });
            });


            if (callback != null) {
                // callback
                readProperties.then(() => { callback(null); }).catch((err) => { callback(err); });
            }
            else {
                // promise
                return readProperties;
            }
        }

        build(callback?: (err: Error) => void) {
            var execute = new Promise((resolve, reject) => {


                this.emit('stdout', 'Building "' + this.name + '"');

                var err,
                    cmd = proc.spawn('sencha.exe', [/*'config', '-prop', 'workspace.build.dir="${workspace.dir}\\build"', 'then',*/ (this.type == ModuleType.Package ? 'package' : 'app'), 'build'], { cwd: path.dirname(this.location), env: [] });

                cmd.stdout.on('data', (data) => {
                    this.emit('stdout', data.toString().replace(/\n/gi, ""));
                })

                cmd.stderr.on('data', (data) => {
                    this.emit('stderr', data.toString().replace(/\n/gi, ""));
                })

                cmd.on('error', (ex) => {
                    err = ex;
                })

                cmd.on('close', (code) => {
                    if (code != 0) {
                        this.emit('close', code, err); reject(err);
                    }
                    else {
                        this.emit('close', 0, null);

                        // validate build (see if the output is correct

                        resolve();
                    }
                })
            });

            if (arguments.length > 0 && typeof arguments[0] == 'function') {
                // callback
                execute.then(() => { callback(null); }).catch((err) => { callback(err); });
            }
            else {
                // promise
                return execute;
            }
        }
    }
}

export default Sencha;

//export function getModules(location: string): Promise<Array<Sencha.IModule>> {
    
//    location = path.resolve(location);
//    return new Promise((resolve, reject) => {

//        console.log(location);

//        Promise
//            .all([
//                fsp
//                    .listFiles(path.join(location, 'packages/local'), 1)
//                    .then((files) => {
//                        return files
//                            .filter((file) => {
//                                return path.parse(file).base == 'package.json';
//                            })
//                            .map((file) => {
//                                return new Sencha.Module(file);
//                            });
//                    }),
//                fsp
//                    .listFiles(location, 1)
//                    .then((files) => {
//                        return files
//                            .filter((file) => {
//                                return path.parse(file).base == 'app.json';
//                            })
//                            .map((file) => {
//                                return new Sencha.Module(file);
//                            });
//                    })                
//            ]
//            )
//            .then((response) => {
//                resolve([].concat.apply([], response));
//            })
//            .catch((err) => {
//                reject(err);
//            })

//        return;
//    })
//}

