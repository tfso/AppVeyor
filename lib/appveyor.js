"use strict";
var request = require('request-json');
var os = require('os');
var path = require('path');
var proc = require('child_process');
var Appveyor;
(function (Appveyor) {
    (function (ArtifactType) {
        ArtifactType[ArtifactType["NuGetPackage"] = 0] = "NuGetPackage";
        ArtifactType[ArtifactType["WebDeployPackage"] = 1] = "WebDeployPackage";
        ArtifactType[ArtifactType["Auto"] = 2] = "Auto";
        ArtifactType[ArtifactType["Zip"] = 3] = "Zip";
    })(Appveyor.ArtifactType || (Appveyor.ArtifactType = {}));
    var ArtifactType = Appveyor.ArtifactType;
    var BuildNumber = (function () {
        function BuildNumber(version) {
            this.Major = 0;
            this.Minor = 0;
            this.Revision = 0;
            this.Build = 0;
            var match;
            match = /(\d+)\.(\d+)(?:\.(\d+))?\.(\d+)/ig.exec(version);
            if (match) {
                if (isNaN(match[1]) == false)
                    this.Major = parseInt(match[1]);
                if (isNaN(match[2]) == false)
                    this.Minor = parseInt(match[2]);
                if (isNaN(match[3]) == false)
                    this.Revision = parseInt(match[3]);
                if (isNaN(match[4]) == false)
                    this.Build = parseInt(match[4]);
            }
        }
        BuildNumber.prototype.toString = function () {
            return this.Major + "." + this.Minor + "." + this.Build;
        };
        return BuildNumber;
    }());
    Appveyor.BuildNumber = BuildNumber;
    var BuildWorker = (function () {
        function BuildWorker(api) {
            this._request = null;
            if (BuildWorker._instance) {
                return BuildWorker._instance;
            }
            if (api || process.env.APPVEYOR_API_URL)
                this._request = request.createClient(api || process.env.APPVEYOR_API_URL);
            BuildWorker._instance = this;
        }
        Object.defineProperty(BuildWorker.prototype, "request", {
            get: function () {
                var _this = this;
                return {
                    post: function (path, content, cb) { if (_this._request != null)
                        _this._request.post(path, content, cb ? cb : function () { }); },
                    upload: function (path, filename, cb) { if (_this._request != null)
                        _this._request.sendFile(path, filename, cb ? cb : function () { }); }
                };
            },
            enumerable: true,
            configurable: true
        });
        BuildWorker.getInstance = function () {
            return BuildWorker._instance ? BuildWorker._instance : new BuildWorker();
        };
        BuildWorker.addMessage = function (message) {
            BuildWorker.getInstance()
                .request
                .post('api/build/messages', { message: message, category: 'information' });
            // POST api/build/messages
            //{
            //    "message": "This is a test message",
            //    "category": "warning",
            //    "details": "Additional information for the message"
            //}
        };
        BuildWorker.addException = function (message, err) {
            BuildWorker.getInstance()
                .request
                .post('api/build/messages', { message: message, details: err.name + ': ' + err.message, category: 'error' });
        };
        BuildWorker.addTest = function (name, filename, framework, duration, err) {
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
        };
        BuildWorker.setEnvironment = function (name, value) {
            BuildWorker.getInstance()
                .request
                .post('api/build/variables', { name: name, value: value });
            // POST api/build/variables
            // {
            //    "name": "variable_name",
            //    "value": "hello, world!"
            //}
        };
        BuildWorker.addArtifact = function (name, source, filename, type) {
            var _this = this;
            var location = path.parse(source), dir = path.normalize(location.dir + (location.ext ? '' : '/' + location.name));
            BuildWorker.getInstance()
                .request
                .post('api/artifacts', { name: name, path: dir, fileName: filename || location.base, type: (type ? ArtifactType[type] : ArtifactType[ArtifactType.Auto]) }, function (err, response, uploadUrl) {
                if (err && response.statusCode > 299)
                    return _this.addException('Posting artifact ' + name + ' to appveyor failed', err);
                // we have a uploadUrl we can upload our artifact
                switch (type) {
                    case ArtifactType.Zip:
                        console.log("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " " + dir);
                        proc.exec("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " *", { cwd: dir, env: process.env }, function (err, stdout, stderr) {
                            if (err)
                                return _this.addException('Uploading artifact ' + name + ' failed', err);
                            console.log(stdout);
                            BuildWorker.getInstance()
                                .request
                                .upload(uploadUrl, path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip"), function (err, res, body) {
                                if (err)
                                    return _this.addException('Uploading artifact file "' + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + '" to "' + uploadUrl + '" failed', err);
                                _this.addMessage('Uploaded artifact ' + name + ' from ' + source);
                            });
                        });
                        break;
                    case ArtifactType.WebDeployPackage:
                        _this.addMessage("Artifact " + name + " has type WebDeployPackage that isn't implemented");
                        break;
                    case ArtifactType.NuGetPackage:
                        _this.addMessage("Artifact " + name + " has type of NuGetPackage that isn't implemented");
                        break;
                    case ArtifactType.Auto:
                        if (location.ext && location.base) {
                            // we have a file
                            BuildWorker.getInstance()
                                .request
                                .upload(uploadUrl, source, function (err, res, body) {
                                if (err)
                                    return _this.addException('Uploading artifact file "' + path.normalize(source) + '" to "' + uploadUrl + '" failed', err);
                                _this.addMessage('Uploaded artifact ' + name + ' from "' + source + '"');
                            });
                        }
                        else {
                            _this.addMessage("Artifact " + name + " has type of Auto and the provided location is not a file " + location);
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
        };
        return BuildWorker;
    }());
    Appveyor.BuildWorker = BuildWorker;
    function getBuildVersion() {
        var variables = [
            'APPVEYOR_BUILD_VERSION',
            'APPVEYOR_REPO_TAG_NAME'
        ];
        var versionRaw = variables
            .map(function (variable) {
            return process.env[variable] || "0.0.1";
        })
            .filter(function (variable) {
            return variable !== undefined && variable.length > 0;
        })[0] || '0.0.1';
        return new Appveyor.BuildNumber(versionRaw);
    }
    Appveyor.getBuildVersion = getBuildVersion;
})(Appveyor || (Appveyor = {}));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Appveyor;
//# sourceMappingURL=appveyor.js.map