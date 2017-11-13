"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fsp = require("../lib/fs-promise");
function patchVersion(file, version, log, error, exit) {
    var packagePath = path.normalize(file), fileContent;
    return fsp
        .readFile(packagePath)
        .then((content) => {
        fileContent = content;
        content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n|\r\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");
        var json = JSON.parse(content);
        json.version = version;
        return JSON.stringify(json, null, 2);
    })
        .then((content) => {
        return fsp.writeFile(packagePath, content + '\n');
    })
        .then(() => {
        if (log)
            log('Patched version %s to file %s', version, packagePath);
        if (exit)
            exit(0);
    })
        .catch((exception) => {
        if (exception.name == "SyntaxError") {
            if (log) {
                log("File content;");
                log(fileContent);
            }
        }
        if (error != null) {
            error(exception);
        }
        if (exit)
            exit(-1);
    });
}
exports.default = patchVersion;
;
//# sourceMappingURL=patch-version.js.map