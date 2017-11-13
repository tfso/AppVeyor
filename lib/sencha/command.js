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
const path = require("path");
const proc = require("child_process");
const http = require("http");
const unzip = require("unzip");
const fs = require("fs");
const os = require("os");
const appveyor_1 = require("./../appveyor");
class Command extends events.EventEmitter {
    constructor(options) {
        super();
        this._lastOutputWithLF = false;
        this.options = {};
        this.options = Object.assign(this.options, {
            env: process.env,
            cwd: process.cwd()
        }, options);
    }
    output(std) {
        let out = '';
        for (let line of Command.parseOutput(std)) {
            if (this._lastOutputWithLF == false && line.length > 1) {
                this.emit('stdout', '\n');
                this._lastOutputWithLF = true;
                out += '\n';
            }
            if (line.length == 1) {
                this.emit('stdout', line);
                this._lastOutputWithLF = false;
                out += line;
            }
            else {
                this.emit('stdout', line + '\n');
                out += line + '\n';
            }
        }
        return out;
    }
    static parseOutput(std) {
        var regex = /^(?:\[([A-Z]{3})\])?[\s\t]?(.+)([\r\n]+|$)/mgi, match, output = [];
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
    static addRepository(name, url) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield new Command().addRepository(name, url);
        });
    }
    addRepository(name, url) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.execute('repository', 'add', name, url);
        });
    }
    static execute(args, cwd) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield new Command(cwd ? { cwd: cwd } : null).execute(...args);
        });
    }
    execute(...args) {
        return __awaiter(this, void 0, void 0, function* () {
            let err = null, cmd, output = '';
            yield new Promise((resolve, reject) => {
                cmd = proc.spawn(Command.path || 'sencha.exe', args, this.options);
                cmd.stdout.on('data', (data) => {
                    output += this.output(data);
                });
                cmd.stderr.on('data', (data) => {
                    output += this.output(data);
                });
                cmd.on('error', (ex) => {
                    err = ex;
                });
                cmd.on('close', (code) => {
                    if (code != 0) {
                        err = err || new Error();
                        err.code = code;
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
            return output;
        });
    }
    install(url, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Command.install(url, destination);
        });
    }
    static install(url, destination) {
        return __awaiter(this, void 0, void 0, function* () {
            destination = (destination ? path.normalize(destination) : path.normalize(os.tmpdir() + '/sencha-cmd/'));
            let executable = yield Command.download(url);
            var err, cmd = proc.spawn(executable, ['-a', '-q', '-dir', destination], {}), location = path.normalize(destination + "/sencha.exe");
            try {
                yield new Promise((resolve, reject) => {
                    let err, errMessage;
                    cmd.on('stdout', (t) => {
                        if (t) { }
                    });
                    cmd.on('stderr', (t) => {
                        errMessage = t;
                    });
                    cmd.on('error', (ex) => {
                        err = ex;
                    });
                    cmd.on('close', (code) => {
                        if (code != 0)
                            return reject(err || new Error(errMessage));
                        return resolve();
                    });
                });
                appveyor_1.default.BuildWorker.addMessage('Installed Sencha Cmd at ' + location);
            }
            catch (ex) {
                appveyor_1.default.BuildWorker.addException('Installation of Sencha Command failed', ex);
            }
            return Command.path = location;
        });
    }
    static download(url) {
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
                        }
                        else {
                            entry.autodrain();
                        }
                    })
                        .on('close', () => {
                        if (isExtracting === false)
                            reject(new Error('Not executable in zip archive at ' + url));
                    });
                }).on('error', (err) => {
                    reject(err);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
}
exports.Command = Command;
//# sourceMappingURL=command.js.map