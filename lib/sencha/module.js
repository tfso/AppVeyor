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
const appveyor_1 = require("./../appveyor");
const command_1 = require("./command");
var ModuleType;
(function (ModuleType) {
    ModuleType[ModuleType["Package"] = 0] = "Package";
    ModuleType[ModuleType["Application"] = 1] = "Application";
})(ModuleType = exports.ModuleType || (exports.ModuleType = {}));
class Module extends events.EventEmitter {
    constructor(config) {
        super();
        this.name = "";
        this.location = null;
        this.version = null;
        this.publish = true;
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
    static open(config) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield new Module(config).open();
        });
    }
    open() {
        return __awaiter(this, void 0, void 0, function* () {
            let content = yield fsp.readFile(this.location);
            content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n|\r\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");
            var json = JSON.parse(content);
            this.name = json.name;
            this.version = json.sencha ? json.sencha.version : json.version;
            this.publish = typeof json.publish == 'boolean' ? json.publish : true;
            return this;
        });
    }
    output(std) {
        command_1.Command.parseOutput(std)
            .forEach((line) => {
            this.emit('stdout', line + '\n');
        });
    }
    build(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let newversion = appveyor_1.default.getBuildVersion((this.type == ModuleType.Package && options && options.keepPackageVersion) || (this.type == ModuleType.Application && options && options.keepAppVersion) ? this.version : null).toString();
                this.emit('stdout', 'Building "\u001b[36m' + this.name + '\u001b[39m"\n');
                this.emit('stdout', 'Patching from version ' + this.version + ' to ' + newversion + ' based at ' + ((this.type == ModuleType.Package && options && options.keepPackageVersion) || (this.type == ModuleType.Application && options && options.keepAppVersion) ? this.version : 'N/A') + '\n');
                yield this.patchVersion(this.location, newversion);
                yield command_1.Command.execute(['config', '-prop', 'skip.slice=1', /*'-prop', 'skip.sass=1',*/ 'then', (this.type == ModuleType.Package ? 'package' : 'app'), 'build', (this.type == ModuleType.Application ? 'production' : '')], this.output.bind(this), path.dirname(this.location));
                this.emit('close', 0, null);
            }
            catch (ex) {
                this.emit('close', ex.code || -1, ex);
                throw ex;
            }
        });
    }
    patchVersion(file, version) {
        return __awaiter(this, void 0, void 0, function* () {
            let packagePath = path.normalize(file), content = yield fsp.readFile(packagePath);
            content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n|\r\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");
            var json = JSON.parse(content);
            if (json.sencha && json.sencha.version)
                json.sencha.version = version;
            else
                json.version = version;
            yield fsp.writeFile(packagePath, JSON.stringify(json, null, 2) + '\n');
        });
    }
    ;
}
exports.Module = Module;
//# sourceMappingURL=module.js.map