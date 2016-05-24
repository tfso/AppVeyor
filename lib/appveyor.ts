import request = require('request-json');

namespace Appveyor {
    export enum ArtifactType {
        NuGetPackage,
        WebDeployPackage,
        Auto,
        Zip
    }

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

    export class BuildWorker {
        private static _instance: BuildWorker

        private _request:Object = null

        constructor(api?: string) {
            if (BuildWorker._instance) {
                return BuildWorker._instance;
            }

            if (api || process.env.APPVEYOR_API_URL)
                this._request = request.createClient(api || process.env.APPVEYOR_API_URL);

            BuildWorker._instance = this;
        }

        public get request() {
            return {
                post: (path: string, content: Object) => { if (this._request != null) this._request.post(path, content, (err, response, body) => { console.log(response.statusCode + ': ' + JSON.stringify(body)); } ); }
            }
        }

        public static getInstance(): BuildWorker {
            return BuildWorker._instance ? BuildWorker._instance : new BuildWorker();
        }

        public static addMessage(message: string): void {
            BuildWorker.getInstance()
                .request
                .post('api/build/messages', { message: message, category: 'information' });

            // POST api/build/messages
            //{
            //    "message": "This is a test message",
            //    "category": "warning",
            //    "details": "Additional information for the message"
            //}
        }

        public static addTest(): void {
            // POST api/tests
            //{
            //    "testName": "Test A",
            //    "testFramework": "NUnit",
            //    "fileName": "tests.dll",
            //    "outcome": "Passed",
            //    "durationMilliseconds": "1200",
            //    "ErrorMessage": "",
            //    "ErrorStackTrace": "",
            //    "StdOut": "",
            //    "StdErr": ""
            //}            
        }

        public static addArtifact(name: string, path: string, file?: string, type?: ArtifactType): void {
            BuildWorker.getInstance()
                .request
                .post('api/artifacts', { name: name, path: path, fileName: file || name, type: (type ? ArtifactType[type] : ArtifactType[ArtifactType.Auto]) });

            // POST api/artifacts
            //{
            //    "path": "c:\projects\myproject\mypackage.nupkg",
            //    "fileName": "mypackage.nupkg",
            //    "name": null,
            //    "type": "NuGetPackage"
            //}
        }
    }

    export function getBuildVersion(): Appveyor.IBuild {
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
}

export default Appveyor;



