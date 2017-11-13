"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events = require("events");
const fsp = require("../../lib/fs-promise");
const path = require("path");
const request = require("request-json");
const appveyor_1 = require("./../appveyor");
const module_1 = require("./module");
const command_1 = require("./command");
class Workspace extends events.EventEmitter {
    constructor(config) {
        super();
        this.workspace = "";
        this.sdk = "";
        this.buildPath = "";
        this._lastOutputWithLF = false;
        this.workspace = path.normalize(config.path);
        this.sdk = config.sdk;
    }
    output(std) {
        command_1.Command.parseOutput(std)
            .forEach((line) => {
            if (this._lastOutputWithLF == false && line.length > 1) {
                this._lastOutputWithLF = true;
                this.emit('stdout', '\n');
            }
            if (line.length == 1) {
                this.emit('stdout', line);
                this._lastOutputWithLF = false;
            }
            else {
                this.emit('stdout', line + '\n');
            }
        });
    }
    publish(url, type) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let buildPath = this.workspace + "/build/", // this may default to something else, check .sencha/workspace/sencha.cfg
                modules = yield this.getModules();
                yield this.sync(modules.map((module) => {
                    return () => __awaiter(this, void 0, void 0, function* () {
                        if (type != null && module.type != type)
                            return;
                        switch (module.type) {
                            case module_1.ModuleType.Application:
                                // zip first? this will always fail
                                yield new Promise((resolve, reject) => appveyor_1.default.BuildWorker.addArtifact(module.name, path.normalize(buildPath + 'production/' + module.name + '/'), module.name + ".zip", appveyor_1.default.ArtifactType.Zip, (err) => { if (err)
                                    return reject(err); resolve(); }));
                                break;
                            case module_1.ModuleType.Package:
                                if (url) {
                                    if (module.publish == false) {
                                        process.stdout.write('\u001b[36mUploading artifact \u001b[39m' + module.name + ' \u001b[36mto remote repository\u001b[39m...\u001b[33mIGNORED\u001b[39m in config\n');
                                        break;
                                    }
                                    process.stdout.write('\u001b[36mUploading artifact \u001b[39m' + module.name + ' \u001b[36mto remote repository\u001b[39m...');
                                    var req = request.createClient(url);
                                    try {
                                        let res = yield new Promise((resolve, reject) => {
                                            req.sendFile('', buildPath + module.name + '/' + module.name + ".pkg", (err, res, body) => {
                                                if (err)
                                                    return reject(err);
                                                resolve(res);
                                            });
                                        });
                                        if (res.statusCode > 299)
                                            throw new Error('Http Error ' + res.statusCode + ': ' + res.statusMessage + '; ' + JSON.stringify(res.body));
                                        process.stdout.write('\u001b[32mOK\u001b[39m\n');
                                    }
                                    catch (ex) {
                                        process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                        appveyor_1.default.BuildWorker.addException('Uploading artifact ' + module.name + ' failed', ex);
                                    }
                                }
                                else {
                                    yield new Promise((resolve, reject) => appveyor_1.default.BuildWorker.addArtifact(module.name, path.normalize(buildPath + module.name + '/' + module.name + ".pkg"), module.name + ".pkg", appveyor_1.default.ArtifactType.Auto, (err) => { if (err)
                                        return reject(err); resolve(); }));
                                }
                                break;
                        }
                    });
                }));
                this.emit('close', 0);
            }
            catch (ex) {
                this.emit('close', ex.code || -1, ex);
            }
        });
    }
    upgrade() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield new command_1.Command({ cwd: this.workspace })
                    .on('stdout', data => this.output(data))
                    .execute('framework', 'upgrade', 'ext', this.sdk || "ext");
                this.emit('close', 0, null);
            }
            catch (ex) {
                this.emit('close', ex.code || -1, ex);
                throw ex;
            }
        });
    }
    install() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield new command_1.Command({ cwd: this.workspace })
                    .on('stdout', data => this.output(data))
                    .execute('framework', 'add', 'ext', this.sdk || "ext");
                this.emit('close', 0, null);
            }
            catch (ex) {
                this.emit('close', ex.code || -1, ex);
                throw new Error('Upgrading workspace failed (' + ex.code + ': ' + ex.description + ')');
            }
        });
    }
    refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let modules = yield this.getModules();
                for (let module of modules) {
                    if (module.type == module_1.ModuleType.Application) {
                        this.emit('stdout', 'Upgrading application "\u001b[36m' + module.name + '\u001b[39m" at "' + path.dirname(module.location) + '"\n');
                        yield new command_1.Command({ cwd: path.dirname(module.location) })
                            .on('stdout', data => this.output(data))
                            .execute('framework', 'upgrade', 'ext', 'ext');
                    }
                }
                this.emit('close', 0, null);
            }
            catch (ex) {
                this.emit('close', ex.code || -1, ex);
                throw new Error('Upgrading workspace failed (' + ex.code + ': ' + ex.description + ')');
            }
        });
    }
    build(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let modules = yield this.getModules();
                for (let module of modules) {
                    this.emit('stdout', 'Found ' + (module.type == module_1.ModuleType.Package ? 'package' : 'application') + ' "\u001b[36m' + module.name + '\u001b[39m" at "' + path.dirname(module.location) + '"\n');
                    module.on('stdout', (data) => {
                        this.output(data);
                    });
                    module.on('stderr', (data) => {
                        this.output(data);
                    });
                }
                yield this.sync(modules.map((module) => {
                    return () => __awaiter(this, void 0, void 0, function* () {
                        if (options.buildOnly == null || module.type == options.buildOnly) {
                            this.emit('stdout', '\n');
                            return yield module.build(options);
                        }
                        else {
                            this.emit('stdout', '\n');
                            this.emit('Ignoring ' + module.name);
                        }
                    });
                }));
                this.emit('close', 0);
            }
            catch (ex) {
                this.emit('close', -1, ex);
                throw ex;
            }
        });
    }
    getModules(callback) {
        var execute = new Promise((resolve, reject) => {
            this.emit('stdout', 'Finding apps and packages in ' + this.workspace + '\n');
            Promise
                .all([
                fsp
                    .listFiles(this.workspace, 1)
                    .then((files) => {
                    if (files == null || files == undefined)
                        return [];
                    return files
                        .filter((file) => {
                        return path.parse(file).base == 'app.json';
                    })
                        .map((file) => {
                        return new module_1.Module({ path: file, buildPath: this.buildPath });
                    });
                }),
                fsp
                    .listFiles(path.join(this.workspace, 'packages/local'), 1)
                    .then((files) => {
                    if (files == null || files == undefined)
                        return [];
                    return files
                        .filter((file) => {
                        return path.parse(file).base == 'package.json';
                    })
                        .map((file) => {
                        return new module_1.Module({ path: file, buildPath: this.buildPath });
                    });
                })
            ])
                .then((response) => {
                var modules = [].concat.apply([], response);
                return Promise
                    .all(modules.map((module) => {
                    return module.open();
                }))
                    .then(() => {
                    resolve(modules);
                })
                    .catch((err) => {
                    throw err;
                });
            })
                .catch((err) => {
                reject(err);
            });
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
    sync(values) {
        return new Promise((resolve, reject) => {
            try {
                let results = [], iterator = values[Symbol.iterator](), iterate = (iterator) => {
                    let res = iterator.next();
                    switch (res.done) {
                        case false:
                            if (res.value) {
                                let promise;
                                if (res.value instanceof Promise)
                                    promise = res.value;
                                else if (typeof res.value == 'function' && res.value.length == 2)
                                    promise = new Promise(res.value);
                                else if (typeof res.value == 'function')
                                    promise = res.value.call(undefined);
                                else
                                    promise = Promise.resolve(res.value);
                                promise
                                    .then((result) => {
                                    results.push(result);
                                    iterate(iterator);
                                })
                                    .catch(err => {
                                    reject(err);
                                });
                            }
                            break;
                        case true:
                            resolve(results);
                            break;
                    }
                };
                iterate(iterator);
            }
            catch (err) {
                reject(err);
            }
        });
    }
}
exports.Workspace = Workspace;
//# sourceMappingURL=workspace.js.map