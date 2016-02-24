var path = require('path');
var fsp = require('../lib/fs-promise');
function patchVersion(dir, version, log, error, exit) {
    var packagePath = path.resolve(dir, './package.json');
    return fsp
        .readFile(packagePath)
        .then(function (content) {
        var json = JSON.parse(content);
        json.version = version;
        return JSON.stringify(json, null, 2);
    })
        .then(function (content) {
        return fsp.writeFile(packagePath, content + '\n');
    })
        .then(function () {
        if (log != null)
            log('Patch version %s to file %s', version, packagePath);
        exit(0);
    })
        .catch(function (exception) {
        if (error != null)
            error(exception.toString());
        exit(-1);
    });
}
;
module.exports = patchVersion;
//# sourceMappingURL=patch-version.js.map