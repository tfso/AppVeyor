import path = require('path');
import fsp = require('../lib/fs-promise');
import fs = require('fs');
import os = require('os');
import proc = require('child_process');
import events = require('events');
import async = require('async');

import http = require('http');
import unzip = require('unzip');

import appveyor from './appveyor';

namespace Sencha {
    
    export var cmd: string

    export enum ModuleType {
        Package,
        Application
    }

    export interface IConfiguration {
        path: string;
        buildPath?: string;
        sdk?: string
    }

    export interface IWorkspace extends NodeJS.EventEmitter {
        workspace: string
        sdk: string

        getModules(callback?: (err: Error, modules?: Array<Sencha.IModule>) => void): Promise<Array<Sencha.IModule>>

        upgrade(callback?: (err: Error) => void): Promise<any>
        build(callback?: (err: Error) => void): Promise<any>
        publish(callback?: (err: Error) => void): Promise<any>
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
        buildPath = ""
        senchaCmd = ""

        _lastOutputWithLF = false

        constructor(config: IConfiguration) {
            super();

            this.workspace = path.normalize(config.path);
            this.sdk = config.sdk;
        }

        output(std: Buffer) {
            getSenchaOutput(std)
                .forEach((line) => {
                    if (this._lastOutputWithLF == false && line.length > 1) {
                        this._lastOutputWithLF = true;
                        this.emit('stdout', '\n');
                    }

                    if (line.length == 1) {
                        this.emit('stdout', line); this._lastOutputWithLF = false;
                    } else {
                        this.emit('stdout', line + '\n');
                    }  
                })
        }

        publish(callback?: (err: Error) => void) {
            var execute = new Promise((resolve, reject) => {

                var buildPath = this.workspace + "/build/"; // this may default to something else, check .sencha/workspace/sencha.cfg

                this
                    .getModules()
                    .then((modules) => {

                        var err = null;
                        async.everyLimit<IModule>(
                            modules, 1,
                            (module, cb) => {
                                switch (module.type) {
                                    case ModuleType.Application:
                                        appveyor.BuildWorker.addArtifact(module.name, path.normalize(buildPath + 'production/' + module.name + '/'), module.name + ".zip", appveyor.ArtifactType.Zip, () => { cb("", true); });
                                        break;

                                    case ModuleType.Package:
                                        appveyor.BuildWorker.addArtifact(module.name, path.normalize(buildPath + module.name + '/' + module.name + ".pkg"), module.name + ".pkg", appveyor.ArtifactType.Auto, () => { cb("", true); });
                                        break;
                                }
                            },
                            (message, result) => {
                                if (err) {
                                    this.emit('close', -1, err); reject(err);
                                }
                                else {
                                    this.emit('close', 0); resolve();
                                }
                            });
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

        upgrade(callback?: (err: Error) => void) {
            var execute = new Promise((resolve, reject) => {
                var err,
                    cmd = proc.spawn(Sencha.cmd || 'sencha.exe', ['framework', 'upgrade', 'ext', this.sdk || "ext"], { cwd: this.workspace, env: process.env });

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
                        this.emit('close', code, err); reject(err || new Error('Upgrading workspace failed (' + code + ')'));
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
                            this.emit('stdout', 'Found ' + (module.type == ModuleType.Package ? 'package' : 'application') + ' "\u001b[36m' + module.name + '\u001b[39m" at "' + path.dirname(module.location) + '"\n');

                            module.on('stdout', (data) => {
                                this.output(data);
                            })

                            module.on('stderr', (data) => {
                                this.output(data);
                            })
                        });

                        var err = null;
                        async.everyLimit<IModule>(
                            modules, 1,
                            (module, cb) => {
                                this.emit('stdout', '\n');
                                module.build((ex) => {
                                    if (ex) {
                                        err = ex; cb("", true);
                                    } else {
                                        cb("", true);
                                    }
                                })
                            },
                            (message, result) => {
                                if (err) {
                                    this.emit('close', -1, err); reject(err);
                                }
                                else {
                                    this.emit('close', 0); resolve();
                                }
                            });
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
                                        return new Sencha.Module({ path: file, buildPath: this.buildPath });
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
                                        return new Sencha.Module({ path: file, buildPath: this.buildPath });
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

        constructor(config: IConfiguration) {
            super();

            this.location = path.normalize(config.path);
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

        output(std: Buffer) {
            getSenchaOutput(std)
                .forEach((line) => {
                    this.emit('stdout', line + '\n');
                })
        }

        build(callback?: (err: Error) => void) {
            var execute = new Promise((resolve, reject) => {
                this.emit('stdout', 'Building "\u001b[36m' + this.name + '\u001b[39m"\n');

                var err,
                    cmd = proc.spawn(Sencha.cmd || 'sencha.exe', [/*'config', '-prop', 'workspace.build.dir="${workspace.dir}\\build"', 'then',*/ (this.type == ModuleType.Package ? 'package' : 'app'), 'build'], { cwd: path.dirname(this.location), env: process.env });

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
                    if (code != 0) {
                        this.emit('close', code, err); reject(new Error("Build failed (" + code + ")"));
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

    export function install(url: string, destination?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                download(url)
                    .then((executable) => {
                        destination = (destination ? path.normalize(destination) : path.normalize(os.tmpdir() + '/sencha-cmd/'));
                        
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
                                appveyor.BuildWorker.addMessage('Installed Sencha Cmd at ' + destination);

                                resolve(path.normalize(destination + "/sencha.exe"));
                            }
                        })

                    })

            } catch (err) {
                reject(err);
            }
        });
    }

    export function addRepository(name: string, url: string, callback ?: (err: Error, output?: string) => void): Promise<string> {
        var execute = new Promise<string>((resolve, reject) => {
            var err, output = [],
                cmd = proc.spawn(Sencha.cmd || 'sencha.exe', ['repository', 'add', name, url], { cwd: this.workspace, env: process.env });


            cmd.stdout.on('data', (data) => {
                output.push(getSenchaOutput(data)); 
            })

            cmd.stderr.on('data', (data) => {
                output.push(getSenchaOutput(data)); 
            })

            cmd.on('error', (ex) => {
                err = ex;
            })

            cmd.on('close', (code) => {
                if (code != 0) {
                    reject(err || new Error('Adding repository to workspace failed (' + code + ')'));
                }
                else {
                    resolve(output.join('\n'));
                }
            })
        });

        if (callback != null) {
            // callback
            execute.then((output) => { callback(null, output); }).catch((err) => { callback(err); });
        }
        else {
            // promise
            return execute;
        }
    }

    function getSenchaOutput(std: Buffer): string[] {
        var regex = /^(?:\[([A-Z]{3})\])?\s*(.+)$/mgi,
            match, output = [];

        while ((match = regex.exec(std.toString())) != null) {

            switch (match[1]) {
                case "INF":
                    output.push('\u001b[32m[INF]\u001b[39m ' + match[2]); break;

                case "LOG":
                    output.push('[LOG]' + ' ' + match[2]); break;

                case "WARN":
                    output.push('\u001b[33m[WARN]\u001b[39m ' + match[2]); break;

                case "ERR":
                    output.push('\u001b[31m[ERR]\u001b[39m ' + match[2]); break;

                default:
                    output.push(match[2]); break;
            }
        }

        return output;
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

