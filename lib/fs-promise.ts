import path = require('path');
import fs = require('fs');

export function readFile(location: string) : Promise<string> {
    return new Promise(
        (resolve, reject) => {
            fs.readFile(location, 'utf-8',
                (error, content) => {
                    return error ? reject(error) : resolve(content);
                }
            );
    });
};


export function writeFile(location: string, content: string|Buffer) : Promise<any> {
    return new Promise(function writeFilePromise(resolve, reject) {
        fs.writeFile(location, content, 'utf-8',
            (error) => {
                return error ? reject(error) : resolve();
            }
        );
    });
};

export function listDirectories(location: string): Promise<Array<string>> {
    return new Promise(function readDirectoryPromise(resolve, reject) {
        fs.readdir(location,
            (error, files) => {
                if (error)
                    return reject(error)

                resolve(files.filter(function (file) {
                    return fs.statSync(path.join(location, file)).isDirectory();
                }))
            }
        )
    })
}

export function listFiles(location: string, depth?: number): Promise<Array<string>> {    
    return new Promise((resolve, reject) => {
        try {
            fs.readdir(location,
                (error, files) => {
                    var result = [],
                        currentDepth = 0;

                    // get files
                    result = result.concat(
                        files.filter(function (file) {
                            return fs.statSync(path.join(location, file)).isFile()
                        }).map(function (file) {
                            return path.join(location, file);
                        })
                    );

                    // get recursive files
                    if (currentDepth++ < depth) {
                        var promises = [];

                        files.filter(function (file) {
                            return fs.statSync(path.join(location, file)).isDirectory()
                        }).forEach(function (dir) {
                            promises.push(
                                listFiles(path.join(location, dir), depth - currentDepth)
                            )
                        })

                        Promise
                            .all(promises)
                            .then((response) => {
                                resolve(result.concat.apply([], response)); // flatten multidimensional array
                            })
                            .catch((error) => {
                                reject(error)
                            })

                    } else {
                        resolve(result);
                    }
                }
            );
        } catch (ex) {
            reject(ex);
        }
    })
}

export function stat(location: string): Promise<any> {
    return new Promise(function readDirectoryPromise(resolve, reject) {
        fs.stat(location,
            (error, stats) => {
                return error ? reject(error) : resolve(stats);
            }
        )
    })
}
