"use strict";
var path = require('path');
var fsp = require('../lib/fs-promise');
function patchVersion(file, version, log, error, exit) {
    var packagePath = path.normalize(file), fileContent;
    return fsp
        .readFile(packagePath)
        .then(function (content) {
        fileContent = content;
        content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n|\r\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");
        var json = JSON.parse(content);
        json.version = version;
        return JSON.stringify(json, null, 2);
    })
        .then(function (content) {
        return fsp.writeFile(packagePath, content + '\n');
    })
        .then(function () {
        if (log)
            log('Patched version %s to file %s', version, packagePath);
        if (exit)
            exit(0);
    })
        .catch(function (exception) {
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = patchVersion;
;
//# sourceMappingURL=patch-version.js.map