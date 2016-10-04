import path = require('path');
import fsp = require('../lib/fs-promise');

export default function patchVersion(file: string, version: string, log?: Function, error?: Function, exit?: Function): Promise<any> {
    var packagePath = path.normalize(file),
        fileContent;

    return fsp
        .readFile(packagePath)
        .then((content: string) => {
            fileContent = content;

            content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n|\r\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");
            var json = JSON.parse(content);

            json.version = version;

            return JSON.stringify(json, null, 2);
        })
        .then((content: string) => {
            return fsp.writeFile(packagePath, content + '\n');
        })
        .then(() => {
            if (log)
                log('Patched version %s to file %s', version, packagePath);

            if(exit)
                exit(0);
        })
        .catch((exception) => {
            if (exception.name == "SyntaxError") {
                if (log) {
                    log("File content;")
                    log(fileContent);
                }
            }
            
            if (error != null) {
                error(exception);
            }

            if (exit)
                exit(-1);
        });
};