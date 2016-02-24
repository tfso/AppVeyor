import path = require('path');
import fsp = require('../lib/fs-promise');

function patchVersion(dir: string, version: string, log: Function, error: Function, exit: Function): Promise<any> {
    var packagePath = path.resolve(dir, './package.json');

    return fsp
        .readFile(packagePath)
        .then((content: string) => {
            var json = JSON.parse(content);

            json.version = version;

            return JSON.stringify(json, null, 2);
        })
        .then((content: string) => {
            return fsp.writeFile(packagePath, content + '\n');
        })
        .then(() => {
            if (log != null)
                log('Patch version %s to file %s', version, packagePath);

            exit(0);
        })
        .catch((exception) => {
            if (error != null)
                error(exception.toString());

            exit(-1);
        });
};

export = patchVersion;