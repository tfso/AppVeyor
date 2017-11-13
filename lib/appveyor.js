"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("request-json");
const os = require("os");
const path = require("path");
const proc = require("child_process");
const fs = require("fs");
var Appveyor;
(function (Appveyor) {
    var ArtifactType;
    (function (ArtifactType) {
        ArtifactType[ArtifactType["NuGetPackage"] = 0] = "NuGetPackage";
        ArtifactType[ArtifactType["WebDeployPackage"] = 1] = "WebDeployPackage";
        ArtifactType[ArtifactType["Auto"] = 2] = "Auto";
        ArtifactType[ArtifactType["Zip"] = 3] = "Zip";
    })(ArtifactType = Appveyor.ArtifactType || (Appveyor.ArtifactType = {}));
    class BuildVersion {
        constructor(version) {
            this._major = 0;
            this._minor = 0;
            this._revision = null;
            this._build = null;
            var match;
            match = /(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/ig.exec(version);
            if (match) {
                if (isNaN(match[1]) == false)
                    this._major = parseInt(match[1]);
                if (isNaN(match[2]) == false)
                    this._minor = parseInt(match[2]);
                if (isNaN(match[3]) == false)
                    this._revision = parseInt(match[3]);
                if (isNaN(match[4]) == false)
                    this._build = parseInt(match[4]);
            }
        }
        get Major() {
            return this._major;
        }
        get Minor() {
            return this._minor;
        }
        get Revision() {
            return this._revision || 0;
        }
        set Revision(value) {
            this._revision = value;
        }
        get Build() {
            return this._build || 0;
        }
        set Build(value) {
            this._build = value;
        }
        get length() {
            if (this._revision == null)
                return 2;
            if (this._build == null)
                return 3;
            return 4;
        }
        hasRevision() {
            return (this._revision != null);
        }
        hasBuild() {
            return (this._build != null);
        }
        toString() {
            return this.Major + "." + this.Minor + (this.hasRevision() == true ? "." + this.Revision : "") + (this.hasBuild() == true ? "." + this.Build : "");
        }
    }
    Appveyor.BuildVersion = BuildVersion;
    class BuildWorker {
        constructor(api) {
            this._request = null;
            if (BuildWorker._instance) {
                return BuildWorker._instance;
            }
            if (api || process.env.APPVEYOR_API_URL)
                this._request = request.createClient(api || process.env.APPVEYOR_API_URL);
            BuildWorker._instance = this;
        }
        get request() {
            return {
                post: (path, content, cb) => { if (this._request != null)
                    this._request.post(path, content, cb ? cb : () => { }); },
                upload: (path, filename, cb) => { if (this._request != null)
                    this._request.sendFile(path, filename, cb ? cb : () => { }); }
            };
        }
        static getInstance() {
            return BuildWorker._instance ? BuildWorker._instance : new BuildWorker();
        }
        static addMessage(message) {
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
        static addException(message, err) {
            BuildWorker.getInstance()
                .request
                .post('api/build/messages', { message: message, details: err.name + ': ' + err.message, category: 'error' });
        }
        static addTest(name, filename, framework, duration, err) {
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
        static setEnvironment(name, value) {
            BuildWorker.getInstance()
                .request
                .post('api/build/variables', { name: name, value: value });
            // POST api/build/variables
            // {
            //    "name": "variable_name",
            //    "value": "hello, world!"
            //}
        }
        static addArtifact(name, source, filename, type, cb) {
            var location = path.parse(source), dir = path.normalize(location.dir + (location.ext ? '' : '/' + location.name));
            process.stdout.write('\u001b[36mAdding artifact\u001b[39m ' + name + '...');
            BuildWorker.getInstance()
                .request
                .post('api/artifacts', { name: name, path: dir, fileName: filename || location.base, type: (type ? ArtifactType[type] : ArtifactType[ArtifactType.Auto]) }, (err, response, options) => {
                if (err || response.statusCode > 299) {
                    if (!err)
                        err = new Error(`Http post to /api/artifacts failed with status ${response.statusCode}; \n\n${JSON.stringify(options, null, ' ')}`);
                    process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                    process.stdout.write(JSON.stringify({ url: '/api/artifacts', statusCode: response.statusCode, body: options, artifact: { name: name, path: dir, fileName: filename || location.base, type: (type ? ArtifactType[type] : ArtifactType[ArtifactType.Auto]) } }, null, ' ') + '\n\n');
                    this.addException('Posting artifact ' + name + ' to appveyor failed', err);
                    return cb(err);
                }
                var uploadUrl = options.UploadUrl;
                BuildWorker.addMessage('[' + name + '] Posting of artifact ' + name + ' to API was successful from ' + dir);
                /*BuildWorker.addMessage('Directory: ' + dir);
                BuildWorker.addMessage('Filename: ' + filename || location.base);
                BuildWorker.addMessage('Upload Uri: ' + JSON.stringify(uploadUrl));*/
                process.stdout.write('\u001b[32mOK\u001b[39m\n');
                // we have a uploadUrl we can upload our artifact
                switch (type) {
                    case ArtifactType.Zip:
                        BuildWorker.addMessage('[' + name + '] Zipping with cmd: 7z a ' + path.normalize(os.tmpdir() + '/sencha-build/' + name + '.zip') + ' ' + dir);
                        process.stdout.write('\u001b[36mZipping source\u001b[39m...');
                        proc.exec("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " *", { cwd: dir, env: process.env }, (err, stdout, stderr) => {
                            if (err) {
                                process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                BuildWorker.addException('[' + name + '] Uploading artifact ' + name + ' failed', err);
                                return cb(err);
                            }
                            var stat = fs.statSync(os.tmpdir() + '/sencha-build/' + name + ".zip");
                            BuildWorker.addMessage('[' + name + '] Artifact size: ' + stat.size);
                            process.stdout.write('\u001b[32mOK\u001b[39m\n');
                            process.stdout.write('\u001b[36mUploading artifact\u001b[39m...');
                            BuildWorker.getInstance()
                                .request
                                .upload(uploadUrl, path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip"), (err, res, body) => {
                                if (err) {
                                    process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                    BuildWorker.addException('[' + name + '] Uploading artifact file "' + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + '" to "' + uploadUrl + '" failed', err);
                                    return cb(err);
                                }
                                process.stdout.write('\u001b[32mOK\u001b[39m\n');
                                BuildWorker.addMessage('[' + name + '] Uploaded artifact ' + name + ' from ' + dir);
                                cb(null);
                            });
                        });
                        break;
                    case ArtifactType.WebDeployPackage:
                        BuildWorker.addMessage('[' + name + '] Artifact ' + name + ' has type WebDeployPackage that isn\'t implemented');
                        cb(null);
                        break;
                    case ArtifactType.NuGetPackage:
                        BuildWorker.addMessage('[' + name + '] Artifact ' + name + ' has type of NuGetPackage that isn\'t implemented');
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
                                    BuildWorker.addException('[' + name + '] Uploading artifact file "' + path.normalize(source) + '" to "' + uploadUrl + '" failed', err);
                                    cb(err);
                                }
                                process.stdout.write('\u001b[32mOK\u001b[39m\n');
                                BuildWorker.addMessage('[' + name + '] Uploaded artifact ' + name + ' from "' + source + '"');
                                cb(null);
                            });
                        }
                        else {
                            process.stdout.write('\u001b[36mUploading artifact\u001b[39m...\u001b[31mFAILED\u001b[39m\n');
                            BuildWorker.addMessage('[' + name + '] Artifact ' + name + ' has type of Auto and the provided location is not a file ' + location);
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
    Appveyor.BuildWorker = BuildWorker;
    function getBuildVersion(rawversion) {
        var buildVersion, variables = [
            'APPVEYOR_BUILD_VERSION',
            'APPVEYOR_REPO_TAG_NAME'
        ];
        if (rawversion == null) {
            buildVersion = new Appveyor.BuildVersion(variables
                .map((variable) => {
                return process.env[variable] || "0.0.1";
            })
                .filter((variable) => {
                return variable !== undefined && variable.length > 0;
            })[0] || '0.0.1');
        }
        else {
            buildVersion = new Appveyor.BuildVersion(rawversion);
            buildVersion.Build = parseInt(process.env['APPVEYOR_BUILD_NUMBER']) || 0;
        }
        return buildVersion;
    }
    Appveyor.getBuildVersion = getBuildVersion;
})(Appveyor || (Appveyor = {}));
exports.default = Appveyor;
//# sourceMappingURL=appveyor.js.map