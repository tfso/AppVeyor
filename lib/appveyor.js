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
    var Build = (function () {
        function Build(version) {
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
        Build.prototype.toString = function () {
            return this.Major + "." + this.Minor + "." + this.Build;
        };
        return Build;
    }());
    Appveyor.Build = Build;
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
        BuildWorker.addTest = function () {
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
        BuildWorker.addArtifact = function (name, source, filename, type) {
            var _this = this;
            var location = path.parse(source);
            BuildWorker.getInstance()
                .request
                .post('api/artifacts', { name: name, path: path.normalize(location.dir + (location.ext ? '/' + location.name : '')), fileName: filename || name, type: (type ? ArtifactType[type] : ArtifactType[ArtifactType.Auto]) }, function (err, response, uploadUrl) {
                console.log(response.statusCode + ': ' + uploadUrl);
                switch (type) {
                    case ArtifactType.Zip:
                        console.log("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " " + path.normalize(location.dir + (location.ext ? '/' + location.name : '')));
                        proc.exec("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " *", { cwd: path.normalize(location.dir + (location.ext ? '/' + location.name : '')), env: process.env }, function (err, stdout, stderr) {
                            if (err)
                                console.error(err);
                            console.log(stdout);
                            BuildWorker.getInstance()
                                .request
                                .upload(uploadUrl, path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip"), function (err, res, body) {
                                if (err)
                                    console.error(err);
                                console.log(response.statusCode + ': ' + JSON.stringify(body));
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
                                    console.error(err);
                                console.log(response.statusCode + ': ' + JSON.stringify(body));
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
        return new Appveyor.Build(versionRaw);
    }
    Appveyor.getBuildVersion = getBuildVersion;
})(Appveyor || (Appveyor = {}));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Appveyor;
//# sourceMappingURL=appveyor.js.map