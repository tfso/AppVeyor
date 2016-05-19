"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var path = require('path');
var fsp = require('../lib/fs-promise');
var fs = require('fs');
var os = require('os');
var proc = require('child_process');
var events = require('events');
var async = require('async');
var http = require('http');
var unzip = require('unzip');
var Sencha;
(function (Sencha) {
    (function (ModuleType) {
        ModuleType[ModuleType["Package"] = 0] = "Package";
        ModuleType[ModuleType["Application"] = 1] = "Application";
    })(Sencha.ModuleType || (Sencha.ModuleType = {}));
    var ModuleType = Sencha.ModuleType;
    var Workspace = (function (_super) {
        __extends(Workspace, _super);
        function Workspace(config) {
            _super.call(this);
            this.workspace = "";
            this.sdk = "";
            this.senchaCmd = "";
            this.workspace = path.normalize(config.path);
            this.sdk = path.normalize(config.sdk);
            this.senchaCmd = config.senchaCmd;
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
        Workspace.prototype.upgrade = function (callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                var err, cmd = proc.spawn(_this.senchaCmd || 'sencha.exe', ['framework', 'upgrade', 'ext', _this.sdk || "ext"], { cwd: _this.workspace, env: process.env });
                cmd.stdout.on('data', function (data) {
                    _this.emit('stdout', data.toString().replace(/\n/gi, ""));
                });
                cmd.stderr.on('data', function (data) {
                    _this.emit('stderr', data.toString().replace(/\n/gi, ""));
                });
                cmd.on('error', function (ex) {
                    err = ex;
                });
                cmd.on('close', function (code) {
                    if (code != 0) {
                        _this.emit('close', code, err);
                        reject(err);
                    }
                    else {
                        _this.emit('close', 0, null);
                        resolve();
                    }
                });
            });
            if (callback != null) {
                // callback
                execute.then(function () { callback(null); }).catch(function (err) { callback(err); });
            }
            else {
                // promise
                return execute;
            }
        };
        Workspace.prototype.build = function (callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                //console.log('fetching modules');
                _this
                    .getModules()
                    .then(function (modules) {
                    modules.forEach(function (module) {
                        _this.emit('stdout', 'Found ' + (module.type == ModuleType.Package ? 'package' : 'application') + ' "' + module.name + '" at "' + path.dirname(module.location) + '"');
                        module.on('stdout', function (data) {
                            _this.emit('stdout', data);
                        });
                        module.on('stderr', function (data) {
                            _this.emit('stderr', data);
                        });
                    });
                    async.series(modules.map(function (module) {
                        return function (cb) {
                            _this.emit('stdout', '\n');
                            module.build(cb);
                        };
                    }), function (err, res) {
                        if (err) {
                            _this.emit('close', -1, err);
                            reject(err);
                        }
                        else {
                            _this.emit('close', 0);
                            resolve();
                        }
                    });
                })
                    .catch(function (err) {
                    _this.emit('close', -1, err);
                    reject(err);
                });
            });
            if (callback != null) {
                // callback
                execute.then(function () { callback(null); }).catch(function (err) { callback(err); });
            }
            else {
                // promise
                return execute;
            }
        };
        Workspace.prototype.getModules = function (callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                _this.emit('stdout', 'Finding apps and packages in ' + _this.workspace);
                Promise
                    .all([
                    fsp
                        .listFiles(path.join(_this.workspace, 'packages/local'), 1)
                        .then(function (files) {
                        return files
                            .filter(function (file) {
                            return path.parse(file).base == 'package.json';
                        })
                            .map(function (file) {
                            return new Sencha.Module({ path: file });
                        });
                    }),
                    fsp
                        .listFiles(_this.workspace, 1)
                        .then(function (files) {
                        return files
                            .filter(function (file) {
                            return path.parse(file).base == 'app.json';
                        })
                            .map(function (file) {
                            return new Sencha.Module({ path: file });
                        });
                    })
                ])
                    .then(function (response) {
                    var modules = [].concat.apply([], response);
                    return Promise
                        .all(modules.map(function (module) {
                        return module.open();
                    }))
                        .then(function () {
                        resolve(modules);
                    })
                        .catch(function (err) {
                        throw err;
                    });
                })
                    .catch(function (err) {
                    reject(err);
                });
            });
            if (callback != null) {
                // callback
                execute.then(function (modules) { callback(null, modules); }).catch(function (err) { callback(err); });
            }
            else {
                // promise
                return execute;
            }
        };
        return Workspace;
    }(events.EventEmitter));
    Sencha.Workspace = Workspace;
    var Module = (function (_super) {
        __extends(Module, _super);
        function Module(config) {
            _super.call(this);
            this.name = "";
            this.location = null;
            this.version = null;
            this.senchaCmd = "";
            this.location = path.normalize(config.path);
            this.senchaCmd = config.senchaCmd;
        }
        Object.defineProperty(Module.prototype, "type", {
            get: function () {
                switch (path.parse(this.location).base) {
                    case "package.json":
                        return ModuleType.Package;
                    case "app.json":
                        return ModuleType.Application;
                    default:
                        return null;
                }
            },
            enumerable: true,
            configurable: true
        });
        Module.prototype.open = function (callback) {
            var _this = this;
            var readProperties = new Promise(function (resolve, reject) {
                var c;
                fsp
                    .readFile(_this.location)
                    .then(function (content) {
                    content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n|\r\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");
                    var json = JSON.parse(content);
                    _this.name = json.name;
                    _this.version = json.version;
                })
                    .then(function () {
                    resolve();
                })
                    .catch(function (exception) {
                    reject(exception);
                });
            });
            if (callback != null) {
                // callback
                readProperties.then(function () { callback(null); }).catch(function (err) { callback(err); });
            }
            else {
                // promise
                return readProperties;
            }
        };
        Module.prototype.build = function (callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                _this.emit('stdout', 'Building "' + _this.name + '"');
                var err, cmd = proc.spawn(_this.senchaCmd || 'sencha.exe', [(_this.type == ModuleType.Package ? 'package' : 'app'), 'build'], { cwd: path.dirname(_this.location), env: process.env });
                cmd.stdout.on('data', function (data) {
                    _this.emit('stdout', data.toString().replace(/\n/gi, ""));
                });
                cmd.stderr.on('data', function (data) {
                    _this.emit('stderr', data.toString().replace(/\n/gi, ""));
                });
                cmd.on('error', function (ex) {
                    err = ex;
                });
                cmd.on('close', function (code) {
                    if (code != 0) {
                        _this.emit('close', code, err);
                        reject(err);
                    }
                    else {
                        _this.emit('close', 0, null);
                        // validate build (see if the output is correct
                        resolve();
                    }
                });
            });
            if (arguments.length > 0 && typeof arguments[0] == 'function') {
                // callback
                execute.then(function () { callback(null); }).catch(function (err) { callback(err); });
            }
            else {
                // promise
                return execute;
            }
        };
        return Module;
    }(events.EventEmitter));
    Sencha.Module = Module;
    function install(skip) {
        return new Promise(function (resolve, reject) {
            try {
                if (skip)
                    return resolve("sencha.exe");
                download(process.env.SENCHACMD_URL || "http://cdn.sencha.com/cmd/6.1.0/jre/SenchaCmd-6.1.0-windows-32bit.zip")
                    .then(function (executable) {
                    var destination = path.normalize(os.tmpdir() + '/sencha-cmd/');
                    var err, cmd = proc.spawn(executable, ['-a', '-q', '-dir', destination], {});
                    cmd.on('stdout', function (t) {
                        console.log(t);
                    });
                    cmd.on('stderr', function (t) {
                        console.log(t);
                    });
                    cmd.on('error', function (ex) {
                        console.error(ex);
                        err = ex;
                    });
                    cmd.on('close', function (code) {
                        if (code != 0) {
                            reject(err);
                        }
                        else {
                            fsp.listFiles(destination)
                                .then(function (files) {
                                files.forEach(function (file) {
                                    console.log(file);
                                });
                            });
                            resolve(destination + "sencha.exe");
                        }
                    });
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    Sencha.install = install;
})(Sencha || (Sencha = {}));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Sencha;
function download(url) {
    return new Promise(function (resolve, reject) {
        try {
            var request = http.get(url, function (response) {
                var isExtracting = false;
                response.pipe(unzip.Parse())
                    .on('entry', function (entry) {
                    var fileName = entry.path;
                    if (fileName.slice(-3) === "exe") {
                        isExtracting = true;
                        var destination = path.normalize(os.tmpdir() + "/" + fileName);
                        entry.pipe(fs.createWriteStream(destination))
                            .on('close', function () {
                            resolve(destination);
                        });
                    }
                    else {
                        entry.autodrain();
                    }
                })
                    .on('close', function () {
                    if (isExtracting === false)
                        reject(new Error('Not executable in zip archive at ' + url));
                });
            }).on('error', function (err) {
                reject(err);
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
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
//# sourceMappingURL=sencha.js.map