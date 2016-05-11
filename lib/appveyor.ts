namespace Appveyor {

    export interface IBuild {
        Major: number;
        Minor: number;
        Revision?: number;
        Build: number;

        toString: () => string; 
    }

    export class Build implements IBuild {
        Major = 0;
        Minor = 0;
        Revision = 0;
        Build = 0;

        constructor(version: string) {
            var match: Array<any>;
            
            match = /(\d+)\.(\d+)(?:\.(\d+))?\.(\d+)/ig.exec(version);
            if (match) {
                if (isNaN(match[1]) == false) this.Major = parseInt(match[1]);
                if (isNaN(match[2]) == false) this.Minor = parseInt(match[2]);
                if (isNaN(match[3]) == false) this.Revision = parseInt(match[3]);
                if (isNaN(match[4]) == false) this.Build = parseInt(match[4]);
            }
        }

        toString() {
            return this.Major + "." + this.Minor + "." + this.Build;
        }
    }
}

export function getBuildVersion() : Appveyor.IBuild {
    var variables = [
        'APPVEYOR_BUILD_VERSION',
        'APPVEYOR_REPO_TAG_NAME'
    ];

    var versionRaw = variables
        .map((variable): string => {
            return process.env[variable] || "0.0.1";
        })
        .filter((variable: string) => {
            return variable !== undefined && variable.length > 0;
        })[0] || '0.0.1';

    return new Appveyor.Build(versionRaw);
}

