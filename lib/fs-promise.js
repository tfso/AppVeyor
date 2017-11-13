"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
function readFile(location) {
    return new Promise((resolve, reject) => {
        fs.readFile(location, 'utf-8', (error, content) => {
            return error ? reject(error) : resolve(content);
        });
    });
}
exports.readFile = readFile;
;
function writeFile(location, content) {
    return new Promise(function writeFilePromise(resolve, reject) {
        fs.writeFile(location, content, 'utf-8', (error) => {
            return error ? reject(error) : resolve();
        });
    });
}
exports.writeFile = writeFile;
;
function listDirectories(location) {
    return new Promise(function readDirectoryPromise(resolve, reject) {
        fs.readdir(location, (error, files) => {
            if (error)
                return reject(error);
            if (files != null)
                resolve(files.filter(function (file) {
                    return fs.statSync(path.join(location, file)).isDirectory();
                }));
            else
                resolve([]);
        });
    });
}
exports.listDirectories = listDirectories;
function listFiles(location, depth) {
    return new Promise((resolve, reject) => {
        try {
            fs.readdir(location, (error, files) => {
                var result = [], currentDepth = 0;
                // get files
                if (files != null)
                    result = result.concat(files.filter(function (file) {
                        return fs.statSync(path.join(location, file)).isFile();
                    }).map(function (file) {
                        return path.join(location, file);
                    }));
                // get recursive files
                if (currentDepth++ < depth) {
                    var promises = [];
                    if (files != null)
                        files.filter(function (file) {
                            return fs.statSync(path.join(location, file)).isDirectory();
                        }).forEach(function (dir) {
                            promises.push(listFiles(path.join(location, dir), depth - currentDepth));
                        });
                    Promise
                        .all(promises)
                        .then((response) => {
                        resolve(result.concat.apply([], response)); // flatten multidimensional array
                    })
                        .catch((error) => {
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
        fs.stat(location, (error, stats) => {
            return error ? reject(error) : resolve(stats);
        });
    });
}
exports.stat = stat;
//# sourceMappingURL=fs-promise.js.map