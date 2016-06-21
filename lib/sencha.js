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
var request = require('request-json');
var appveyor_1 = require('./appveyor');
var patch_version_1 = require('./patch-version');
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
            this.buildPath = "";
            this._lastOutputWithLF = false;
            this.workspace = path.normalize(config.path);
            this.sdk = config.sdk;
        }
        Workspace.prototype.output = function (std) {
            var _this = this;
            getSenchaOutput(std)
                .forEach(function (line) {
                if (_this._lastOutputWithLF == false && line.length > 1) {
                    _this._lastOutputWithLF = true;
                    _this.emit('stdout', '\n');
                }
                if (line.length == 1) {
                    _this.emit('stdout', line);
                    _this._lastOutputWithLF = false;
                }
                else {
                    _this.emit('stdout', line + '\n');
                }
            });
        };
        Workspace.prototype.publish = function (url, callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                var buildPath = _this.workspace + "/build/"; // this may default to something else, check .sencha/workspace/sencha.cfg
                _this
                    .getModules()
                    .then(function (modules) {
                    var err = null;
                    async.everyLimit(modules, 1, function (module, cb) {
                        switch (module.type) {
                            case ModuleType.Application:
                                appveyor_1.default.BuildWorker.addArtifact(module.name, path.normalize(buildPath + 'production/' + module.name + '/'), module.name + ".zip", appveyor_1.default.ArtifactType.Zip, function () { cb("", true); });
                                break;
                            case ModuleType.Package:
                                if (url) {
                                    process.stdout.write('\u001b[36mUploading artifact \u001b[39m' + module.name + ' \u001b[36mto remote repository\u001b[39m...');
                                    var req = request.createClient(url);
                                    req.sendFile('', buildPath + module.name + '/' + module.name + ".pkg", function (ex, res, body) {
                                        if (ex || res.statusCode > 299) {
                                            process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                            appveyor_1.default.BuildWorker.addException('Uploading artifact ' + module.name + ' failed', ex || new Error(body));
                                            err = ex;
                                        }
                                        else {
                                            process.stdout.write('\u001b[32mOK\u001b[39m\n');
                                        }
                                        cb("", true);
                                    });
                                }
                                else {
                                    appveyor_1.default.BuildWorker.addArtifact(module.name, path.normalize(buildPath + module.name + '/' + module.name + ".pkg"), module.name + ".pkg", appveyor_1.default.ArtifactType.Auto, function () { cb("", true); });
                                }
                                break;
                        }
                    }, function (message, result) {
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
        Workspace.prototype.upgrade = function (callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                var err, cmd = proc.spawn(Sencha.cmd || 'sencha.exe', ['framework', 'upgrade', 'ext', _this.sdk || "ext"], { cwd: _this.workspace, env: process.env });
                cmd.stdout.on('data', function (data) {
                    _this.output(data); // this.emit('stdout', data.toString().replace(/\n/gi, ""));
                });
                cmd.stderr.on('data', function (data) {
                    _this.output(data); //this.emit('stderr', data.toString().replace(/\n/gi, ""));
                });
                cmd.on('error', function (ex) {
                    err = ex;
                });
                cmd.on('close', function (code) {
                    if (code != 0) {
                        _this.emit('close', code, err);
                        reject(err || new Error('Upgrading workspace failed (' + code + ')'));
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
        Workspace.prototype.build = function (options, callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                _this
                    .getModules()
                    .then(function (modules) {
                    modules.forEach(function (module) {
                        _this.emit('stdout', 'Found ' + (module.type == ModuleType.Package ? 'package' : 'application') + ' "\u001b[36m' + module.name + '\u001b[39m" at "' + path.dirname(module.location) + '"\n');
                        module.on('stdout', function (data) {
                            _this.output(data);
                        });
                        module.on('stderr', function (data) {
                            _this.output(data);
                        });
                    });
                    var err = null;
                    async.everyLimit(modules, 1, function (module, cb) {
                        _this.emit('stdout', '\n');
                        module.build(options, function (ex) {
                            if (ex) {
                                err = ex;
                                cb("", true);
                            }
                            else {
                                cb("", true);
                            }
                        });
                    }, function (message, result) {
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
                _this.emit('stdout', 'Finding apps and packages in ' + _this.workspace + '\n');
                Promise
                    .all([
                    fsp
                        .listFiles(path.join(_this.workspace, 'packages/local'), 1)
                        .then(function (files) {
                        if (files == null || files == undefined)
                            return [];
                        return files
                            .filter(function (file) {
                            return path.parse(file).base == 'package.json';
                        })
                            .map(function (file) {
                            return new Sencha.Module({ path: file, buildPath: _this.buildPath });
                        });
                    }),
                    fsp
                        .listFiles(_this.workspace, 1)
                        .then(function (files) {
                        if (files == null || files == undefined)
                            return [];
                        return files
                            .filter(function (file) {
                            return path.parse(file).base == 'app.json';
                        })
                            .map(function (file) {
                            return new Sencha.Module({ path: file, buildPath: _this.buildPath });
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
            this.location = path.normalize(config.path);
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
        Module.prototype.output = function (std) {
            var _this = this;
            getSenchaOutput(std)
                .forEach(function (line) {
                _this.emit('stdout', line + '\n');
            });
        };
        Module.prototype.build = function (options, callback) {
            var _this = this;
            var execute = new Promise(function (resolve, reject) {
                var newversion = appveyor_1.default.getBuildVersion((_this.type == ModuleType.Package && options && options.keepPackageVersion) || (_this.type == ModuleType.Application && options && options.keepAppVersion) ? _this.version : null).toString();
                _this.emit('stdout', 'Building "\u001b[36m' + _this.name + '\u001b[39m"\n');
                _this.emit('stdout', 'Patching from version ' + _this.version + ' to ' + newversion + ' based at ' + ((_this.type == ModuleType.Package && options && options.keepPackageVersion) || (_this.type == ModuleType.Application && options && options.keepAppVersion) ? _this.version : 'N/A') + '\n');
                patch_version_1.default(_this.location, newversion, null, null, function () {
                    var err, cmd = proc.spawn(Sencha.cmd || 'sencha.exe', ['config', '-prop', 'skip.slice=1', 'then', (_this.type == ModuleType.Package ? 'package' : 'app'), 'build', (_this.type == ModuleType.Application ? 'production' : '')], { cwd: path.dirname(_this.location), env: process.env });
                    cmd.stdout.on('data', function (data) {
                        _this.output(data);
                    });
                    cmd.stderr.on('data', function (data) {
                        _this.output(data);
                    });
                    cmd.on('error', function (ex) {
                        err = ex;
                    });
                    cmd.on('close', function (code) {
                        if (code != 0) {
                            _this.emit('close', code, err);
                            reject(new Error("Build failed (" + code + ")"));
                        }
                        else {
                            _this.emit('close', 0, null);
                            // validate build (see if the output is correct
                            resolve();
                        }
                    });
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
        return Module;
    }(events.EventEmitter));
    Sencha.Module = Module;
    function install(url, destination) {
        return new Promise(function (resolve, reject) {
            try {
                download(url)
                    .then(function (executable) {
                    destination = (destination ? path.normalize(destination) : path.normalize(os.tmpdir() + '/sencha-cmd/'));
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
                            appveyor_1.default.BuildWorker.addMessage('Installed Sencha Cmd at ' + destination);
                            resolve(path.normalize(destination + "/sencha.exe"));
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
    function addRepository(name, url, callback) {
        var _this = this;
        var execute = new Promise(function (resolve, reject) {
            var err, output = [], cmd = proc.spawn(Sencha.cmd || 'sencha.exe', ['repository', 'add', name, url], { cwd: _this.workspace, env: process.env });
            cmd.stdout.on('data', function (data) {
                output.push(getSenchaOutput(data));
            });
            cmd.stderr.on('data', function (data) {
                output.push(getSenchaOutput(data));
            });
            cmd.on('error', function (ex) {
                err = ex;
            });
            cmd.on('close', function (code) {
                if (code != 0) {
                    reject(err || new Error('Adding repository to workspace failed (' + code + ')'));
                }
                else {
                    resolve(output.join('\n'));
                }
            });
        });
        if (callback != null) {
            // callback
            execute.then(function (output) { callback(null, output); }).catch(function (err) { callback(err); });
        }
        else {
            // promise
            return execute;
        }
    }
    Sencha.addRepository = addRepository;
    function getSenchaOutput(std) {
        var regex = /^(?:\[([A-Z]{3})\])?\s*(.+)$/mgi, match, output = [];
        while ((match = regex.exec(std.toString())) != null) {
            switch (match[1]) {
                case "INF":
                    output.push('\u001b[32m[INF]\u001b[39m ' + match[2]);
                    break;
                case "LOG":
                    output.push('[LOG]' + ' ' + match[2]);
                    break;
                case "WARN":
                    output.push('\u001b[33m[WARN]\u001b[39m ' + match[2]);
                    break;
                case "ERR":
                    output.push('\u001b[31m[ERR]\u001b[39m ' + match[2]);
                    break;
                default:
                    output.push(match[2]);
                    break;
            }
        }
        return output;
    }
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
//# sourceMappingURL=sencha.js.map