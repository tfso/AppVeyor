import request = require('request-json');
import os = require('os');
import path = require('path');
import proc = require('child_process');

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
                post: (path: string, content: Object, cb?: (err: any, response: any, body: any) => void) => { if (this._request != null) this._request.post(path, content, cb ? cb : () => { }); },
                upload: (path: string, filename: string, cb?: (err: any, response: any, body: any) => void) => { if (this._request != null) this._request.sendFile(path, filename, cb ? cb : () => { }); }
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

        public static addException(message: string, err: Error): void {
            BuildWorker.getInstance()
                .request
                .post('api/build/messages', { message: message, details: err.name + ': ' + err.message, category: 'error' });
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

        public static addArtifact(name: string, source: string, filename?: string, type?: ArtifactType): void {
            var location = path.parse(source),
                dir = path.normalize(location.dir + (location.ext ? '' : '/' + location.name));

            BuildWorker.getInstance()
                .request
                .post('api/artifacts', { name: name, path: dir, fileName: filename || location.base, type: (type ? ArtifactType[type] : ArtifactType[ArtifactType.Auto]) }, (err, response, uploadUrl) => {
                    if (err && response.statusCode > 299) // api/artifacts body isn't a valid json
                        return this.addException('Posting artifact ' + name + ' to appveyor failed', err);

                    // we have a uploadUrl we can upload our artifact
                    switch (type) {
                        case ArtifactType.Zip:
                            
                            console.log("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " " + dir);
                            proc.exec("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " *", { cwd: dir, env: process.env }, (err, stdout, stderr) => {
                                if (err)
                                    return this.addException('Uploading artifact ' + name + ' failed', err);

                                console.log(stdout);

                                BuildWorker.getInstance()
                                    .request
                                    .upload(uploadUrl, path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip"), (err, res, body) => {
                                        if (err)
                                            return this.addException('Uploading artifact file "' + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + '" to "' + uploadUrl + '" failed', err);

                                        this.addMessage('Uploaded artifact ' + name + ' from ' + source);
                                    })
                            })

                            break;

                        case ArtifactType.WebDeployPackage:
                            this.addMessage("Artifact " + name + " has type WebDeployPackage that isn't implemented");
                            break;

                        case ArtifactType.NuGetPackage:
                            this.addMessage("Artifact " + name + " has type of NuGetPackage that isn't implemented");
                            break;

                        case ArtifactType.Auto:
                            if (location.ext && location.base) {
                                // we have a file
                                BuildWorker.getInstance()
                                    .request
                                    .upload(uploadUrl, source, (err, res, body) => {
                                        if (err)
                                            return this.addException('Uploading artifact file "' + path.normalize(source) + '" to "' + uploadUrl + '" failed', err);

                                        this.addMessage('Uploaded artifact ' + name + ' from "' + source + '"');
                                    })
                            }
                            else {
                                this.addMessage("Artifact " + name + " has type of Auto and the provided location is not a file " + location);
                            }
                    }
                });

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



