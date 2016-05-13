"use strict";
var path = require('path');
var fs = require('fs');
function readFile(location) {
    return new Promise(function (resolve, reject) {
        fs.readFile(location, 'utf-8', function (error, content) {
            return error ? reject(error) : resolve(content);
        });
    });
}
exports.readFile = readFile;
;
function writeFile(location, content) {
    return new Promise(function writeFilePromise(resolve, reject) {
        fs.writeFile(location, content, 'utf-8', function (error) {
            return error ? reject(error) : resolve();
        });
    });
}
exports.writeFile = writeFile;
;
function listDirectories(location) {
    return new Promise(function readDirectoryPromise(resolve, reject) {
        fs.readdir(location, function (error, files) {
            if (error)
                return reject(error);
            resolve(files.filter(function (file) {
                return fs.statSync(path.join(location, file)).isDirectory();
            }));
        });
    });
}
exports.listDirectories = listDirectories;
function listFiles(location, depth) {
    return new Promise(function (resolve, reject) {
        try {
            fs.readdir(location, function (error, files) {
                var result = [], currentDepth = 0;
                // get files
                result = result.concat(files.filter(function (file) {
                    return fs.statSync(path.join(location, file)).isFile();
                }).map(function (file) {
                    return path.join(location, file);
                }));
                // get recursive files
                if (currentDepth++ < depth) {
                    var promises = [];
                    files.filter(function (file) {
                        return fs.statSync(path.join(location, file)).isDirectory();
                    }).forEach(function (dir) {
                        promises.push(listFiles(path.join(location, dir), depth - currentDepth));
                    });
                    Promise
                        .all(promises)
                        .then(function (response) {
                        resolve(result.concat.apply([], response)); // flatten multidimensional array
                    })
                        .catch(function (error) {
                        reject(error);
                    });
                }
                else {
                    resolve(result);
                }
            });
        }
        catch (ex) {
            reject(ex);
        }
    });
}
exports.listFiles = listFiles;
function stat(location) {
    return new Promise(function readDirectoryPromise(resolve, reject) {
        fs.stat(location, function (error, stats) {
            return error ? reject(error) : resolve(stats);
        });
    });
}
exports.stat = stat;
//# sourceMappingURL=fs-promise.js.map