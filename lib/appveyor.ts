﻿import request = require('request-json');
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

    export interface IBuildNumber {
        Major: number;
        Minor: number;
        Revision?: number;
        Build: number;

        toString: () => string; 
    }

    export class BuildNumber implements IBuildNumber {
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

        public static addException(message: string, err: NodeJS.ErrnoException): void {
            BuildWorker.getInstance()
                .request
                .post('api/build/messages', { message: message, details: err.name + ': ' + err.message, category: 'error' });
        }

        public static addTest(name: string, filename: string, framework?: string, duration?: number, err?: NodeJS.ErrnoException): void {
            BuildWorker.getInstance()
                .request
                .post('api/tests', { testName: name, testFramework: framework, fileName: filename, outcome: err ? 'Failed' : 'Passed', durationMilliseconds: duration || 0, ErrorMessage: err ? err.message : "", ErrorStackTrace: err ? err.stack || "" : "" });

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

        public static setEnvironment(name: string, value: string): void {
            BuildWorker.getInstance()
                .request
                .post('api/build/variables', { name: name, value: value});

            // POST api/build/variables
            // {
            //    "name": "variable_name",
            //    "value": "hello, world!"
            //}
        }

        public static addArtifact(name: string, source: string, filename?: string, type?: ArtifactType, cb?: (err: any) => void): void {
            var location = path.parse(source),
                dir = path.normalize(location.dir + (location.ext ? '' : '/' + location.name));

            process.stdout.write('\u001b[36mAdding artifact\u001b[39m ' + name + '...');

            BuildWorker.getInstance()
                .request
                .post('api/artifacts', { name: name, path: dir, fileName: filename || location.base, type: (type ? ArtifactType[type] : ArtifactType[ArtifactType.Auto]) }, (err, response, uploadUrl) => {
                    if (err && response.statusCode > 299) { // api/artifacts body isn't a valid json
                        process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                        this.addException('Posting artifact ' + name + ' to appveyor failed', err);

                        return cb(err);
                    }

                    process.stdout.write('\u001b[32mOK\u001b[39m\n');

                    // we have a uploadUrl we can upload our artifact
                    switch (type) {
                        case ArtifactType.Zip:
                            
                            //console.log("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " " + dir);

                            process.stdout.write('\u001b[36mZipping source\u001b[39m...');

                            proc.exec("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " *", { cwd: dir, env: process.env }, (err, stdout, stderr) => {
                                if (err) {
                                    process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                    this.addException('Uploading artifact ' + name + ' failed', err);

                                    return cb(err);
                                }

                                process.stdout.write('\u001b[32mOK\u001b[39m\n');

                                process.stdout.write('\u001b[36mUploading artifact\u001b[39m...');
                                BuildWorker.getInstance()
                                    .request
                                    .upload(uploadUrl, path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip"), (err, res, body) => {
                                        if (err) {
                                            process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                            this.addException('Uploading artifact file "' + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + '" to "' + uploadUrl + '" failed', err);

                                            return cb(err);
                                        }

                                        process.stdout.write('\u001b[32mOK\u001b[39m\n');

                                        this.addMessage('Uploaded artifact ' + name + ' from ' + source);

                                        cb(null);
                                    })
                            })

                            break;

                        case ArtifactType.WebDeployPackage:
                            this.addMessage("Artifact " + name + " has type WebDeployPackage that isn't implemented");
                            cb(null);

                            break;

                        case ArtifactType.NuGetPackage:
                            this.addMessage("Artifact " + name + " has type of NuGetPackage that isn't implemented");
                            cb(null);

                            break;

                        case ArtifactType.Auto:
                            if (location.ext && location.base) {

                                process.stdout.write('\u001b[36mUploading artifact\u001b[39m...');

                                // we have a file
                                BuildWorker.getInstance()
                                    .request
                                    .upload(uploadUrl, source, (err, res, body) => {
                                        if (err) {
                                            process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                            this.addException('Uploading artifact file "' + path.normalize(source) + '" to "' + uploadUrl + '" failed', err);

                                            cb(err);
                                        }
                                        process.stdout.write('\u001b[32mOK\u001b[39m\n');

                                        this.addMessage('Uploaded artifact ' + name + ' from "' + source + '"');

                                        cb(null);
                                    })
                            }
                            else {
                                process.stdout.write('\u001b[36mUploading artifact\u001b[39m...\u001b[31mFAILED\u001b[39m\n');
                                this.addMessage("Artifact " + name + " has type of Auto and the provided location is not a file " + location);

                                cb(null);
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

    export function getBuildVersion(): Appveyor.IBuildNumber {
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

        return new Appveyor.BuildNumber(versionRaw);
    }
}

export default Appveyor;



