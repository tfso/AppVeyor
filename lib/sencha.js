"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var path = require('path');
var fsp = require('../lib/fs-promise');
var proc = require('child_process');
var events = require('events');
var async = require('async');
var Sencha;
(function (Sencha) {
    (function (ModuleType) {
        ModuleType[ModuleType["Package"] = 0] = "Package";
        ModuleType[ModuleType["Application"] = 1] = "Application";
    })(Sencha.ModuleType || (Sencha.ModuleType = {}));
    var ModuleType = Sencha.ModuleType;
    var Workspace = (function (_super) {
        __extends(Workspace, _super);
        function Workspace(base_directory, sdk_directory) {
            _super.call(this);
            this.basedir = "";
            this.sdkdir = "";
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
        Workspace.prototype.upgrade = function (callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                var err, cmd = proc.spawn('sencha.exe', ['framework', 'upgrade', 'ext', _this.sdkdir || "ext"], { cwd: _this.basedir, env: [] });
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
                _this.emit('stdout', 'Finding apps and packages in ' + _this.basedir);
                Promise
                    .all([
                    fsp
                        .listFiles(path.join(_this.basedir, 'packages/local'), 1)
                        .then(function (files) {
                        return files
                            .filter(function (file) {
                            return path.parse(file).base == 'package.json';
                        })
                            .map(function (file) {
                            return new Sencha.Module(file);
                        });
                    }),
                    fsp
                        .listFiles(_this.basedir, 1)
                        .then(function (files) {
                        return files
                            .filter(function (file) {
                            return path.parse(file).base == 'app.json';
                        })
                            .map(function (file) {
                            return new Sencha.Module(file);
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
        function Module(location) {
            _super.call(this);
            this.name = "";
            this.location = null;
            this.version = null;
            this.location = path.normalize(location);
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
                    content = content.replace(/\/\*(.|\r\n|\n)*?\*\//gi, "");
                    content = content.replace(/\/\/.*$/mgi, "");
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
                var err, cmd = proc.spawn('sencha.exe', [(_this.type == ModuleType.Package ? 'package' : 'app'), 'build'], { cwd: path.dirname(_this.location), env: [] });
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
})(Sencha || (Sencha = {}));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Sencha;
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