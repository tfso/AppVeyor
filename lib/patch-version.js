"use strict";
var path = require('path');
var fsp = require('../lib/fs-promise');
function patchVersion(dir, file, version, log, error, exit) {
    var packagePath = path.resolve(dir, './' + file);
    return fsp
        .readFile(packagePath)
        .then(function (content) {
        content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");
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
        if (error != null) {
            error(exception);
        }
        if (exit)
            exit(-1);
    });
}
;
module.exports = patchVersion;
//# sourceMappingURL=patch-version.js.map