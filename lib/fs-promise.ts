var fs = require('fs');

export function readFile(filePath: string) : Promise<string> {
    return new Promise(
        (resolve, reject) => {
            fs.readFile(filePath, 'utf-8',
                (error, content) => {
                    return error ? reject(error) : resolve(content);
                }
            );
    });
};


export function writeFile(filePath: string, content: string|Buffer) : Promise<any> {
    return new Promise(function writeFilePromise(resolve, reject) {
        fs.writeFile(filePath, content, 'utf-8',
            (error) => {
                return error ? reject(error) : resolve();
            }
        );
    });
};
