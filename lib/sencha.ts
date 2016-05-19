import path = require('path');
import fsp = require('../lib/fs-promise');
import fs = require('fs');
import os = require('os');
import proc = require('child_process');
import events = require('events');
import async = require('async');

import http = require('http');
import unzip = require('unzip');

namespace Sencha {

    export enum ModuleType {
        Package,
        Application
    }

    export interface IConfiguration {
        path: string;
        sdk?: string;

        senchaCmd?: string
    }

    export interface IWorkspace extends NodeJS.EventEmitter {
        workspace: string
        sdk: string

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
        workspace = ""
        sdk = ""
        senchaCmd = ""

        _lastOutputWithLF = false

        constructor(config: IConfiguration) {
            super();

            this.workspace = path.normalize(config.path);

            this.sdk = config.sdk ? path.normalize(config.sdk) : "";
            this.senchaCmd = config.senchaCmd ? config.senchaCmd : "";
        }

        output(std: Buffer) {

            var regex = /^(?:\[([A-Z]{3})\])?\s*(.+)$/mgi,
                match;

            while ((match = regex.exec(std.toString())) != null) {

                if (this._lastOutputWithLF == false && (match[2].length > 1)) {
                    this._lastOutputWithLF = true;
                    this.emit('stdout', '\n');
                }

                switch (match[1]) {
                    case "INF":
                        this.emit('stdout', '\u001b[32m[INF]\u001b[39m ' + match[2] + '\n'); break;

                    case "LOG":
                        this.emit('stdout', '[LOG]' + ' ' + match[2] + '\n'); break;

                    case "WARN":
                        this.emit('stdout', '\u001b[33m[WARN]\u001b[39m ' + match[2] + '\n'); break;

                    case "ERR":
                        this.emit('stderr', '\u001b[31m[ERR]\u001b[39m ' + match[2] + '\n'); break;

                    default:
                        if (match[2].length == 1) {
                            this.emit('stdout', match[2]); this._lastOutputWithLF = false; break;
                        } else {
                            this.emit('stdout', match[2] + '\n'); break;
                        }                       
                }
            }
        }

        upgrade(callback?: (err: Error) => void) {
            var execute = new Promise((resolve, reject) => {
                var err,
                    cmd = proc.spawn(this.senchaCmd || 'sencha.exe', ['framework', 'upgrade', 'ext', this.sdk || "ext"], { cwd: this.workspace, env: process.env });

                cmd.stdout.on('data', (data) => {
                    this.output(data); // this.emit('stdout', data.toString().replace(/\n/gi, ""));
                })

                cmd.stderr.on('data', (data) => {
                    this.output(data); //this.emit('stderr', data.toString().replace(/\n/gi, ""));
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
                            this.emit('stdout', 'Found ' + (module.type == ModuleType.Package ? 'package' : 'application') + ' "' + module.name + '" at "' + path.dirname(module.location) + '"\n');

                            module.on('stdout', (data) => {
                                this.output(data);
                            })

                            module.on('stderr', (data) => {
                                this.output(data);
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
                this.emit('stdout', 'Finding apps and packages in ' + this.workspace + '\n');

                Promise
                    .all([
                        fsp
                            .listFiles(path.join(this.workspace, 'packages/local'), 1)
                            .then((files) => {
                                return files
                                    .filter((file) => {
                                        return path.parse(file).base == 'package.json';
                                    })
                                    .map((file) => {
                                        return new Sencha.Module({ path: file, senchaCmd: this.senchaCmd });
                                    });
                            }),
                        fsp
                            .listFiles(this.workspace, 1)
                            .then((files) => {
                                return files
                                    .filter((file) => {
                                        return path.parse(file).base == 'app.json';
                                    })
                                    .map((file) => {
                                        return new Sencha.Module({ path: file, senchaCmd: this.senchaCmd });
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
        senchaCmd = ""  

        constructor(config: IConfiguration) {
            super();

            this.location = path.normalize(config.path);
            this.senchaCmd = config.senchaCmd;
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
                        content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n|\r\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");

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


                this.emit('stdout', 'Building "' + this.name + '"\n');

                var err,
                    cmd = proc.spawn(this.senchaCmd || 'sencha.exe', [/*'config', '-prop', 'workspace.build.dir="${workspace.dir}\\build"', 'then',*/ (this.type == ModuleType.Package ? 'package' : 'app'), 'build'], { cwd: path.dirname(this.location), env: process.env });

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

    export function install(skip: boolean): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                if (skip)
                    return resolve("sencha.exe")

                download(process.env.SENCHACMD_URL || "http://cdn.sencha.com/cmd/6.1.0/jre/SenchaCmd-6.1.0-windows-32bit.zip")
                    .then((executable) => {
                        var destination = path.normalize(os.tmpdir() + '/sencha-cmd/');

                        var err, 
                            cmd = proc.spawn(executable, ['-a', '-q', '-dir', destination], { });

                        cmd.on('stdout', (t) => {
                            console.log(t);
                        })

                        cmd.on('stderr', (t) => {
                            console.log(t);
                        })

                        cmd.on('error', (ex) => {
                            console.error(ex);

                            err = ex;
                        })

                        cmd.on('close', (code) => {
                            if (code != 0) {
                                reject(err);
                            }
                            else {
                                resolve(destination + "sencha.exe");    
                            }
                        })

                    })

            } catch (err) {
                reject(err);
            }
        });
    }
}

export default Sencha;

function download(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            var request = http.get(url, function (response) {
                var isExtracting = false;
                
                response.pipe(unzip.Parse())
                    .on('entry', (entry) => {
                        var fileName = entry.path;
                        if (fileName.slice(-3) === "exe") {
                            isExtracting = true;

                            var destination = path.normalize(os.tmpdir() + "/" + fileName);
                            entry.pipe(fs.createWriteStream(destination))
                                .on('close', () => {
                                    resolve(destination);
                                });
                        } else {
                            entry.autodrain();
                        }
                    })
                    .on('close', () => {
                        if (isExtracting === false)
                            reject(new Error('Not executable in zip archive at ' + url));
                    })

            }).on('error', (err) => {
                reject(err);
            });

        } catch (err) {
            reject(err);
        }
    });
}

