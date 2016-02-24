var fs = require('fs');
function readFile(filePath) {
    return new Promise(function (resolve, reject) {
        fs.readFile(filePath, 'utf-8', function (error, content) {
            return error ? reject(error) : resolve(content);
        });
    });
}
exports.readFile = readFile;
;
function writeFile(filePath, content) {
    return new Promise(function writeFilePromise(resolve, reject) {
        fs.writeFile(filePath, content, 'utf-8', function (error) {
            return error ? reject(error) : resolve();
        });
    });
}
exports.writeFile = writeFile;
;
//# sourceMappingURL=fs-promise.js.map