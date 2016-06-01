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
    var BuildVersion = (function () {
        function BuildVersion(version) {
            this._major = 0;
            this._minor = 0;
            this._revision = null;
            this._build = null;
            var match;
            match = /(\d+)\.(\d+)(?:\.(\d+))?\.(\d+)/ig.exec(version);
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
        Object.defineProperty(BuildVersion.prototype, "Major", {
            get: function () {
                return this._major;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(BuildVersion.prototype, "Minor", {
            get: function () {
                return this._minor;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(BuildVersion.prototype, "Revision", {
            get: function () {
                return this._revision || 0;
            },
            set: function (value) {
                this._revision = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(BuildVersion.prototype, "Build", {
            get: function () {
                return this._build || 0;
            },
            set: function (value) {
                this._build = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(BuildVersion.prototype, "length", {
            get: function () {
                if (this._revision == null)
                    return 2;
                if (this._build == null)
                    return 3;
                return 4;
            },
            enumerable: true,
            configurable: true
        });
        BuildVersion.prototype.hasRevision = function () {
            return (this._revision != null);
        };
        BuildVersion.prototype.toString = function () {
            return this.Major + "." + this.Minor + (this.hasRevision() == true ? "." + this.Revision : "") + "." + this.Build;
        };
        return BuildVersion;
    }());
    Appveyor.BuildVersion = BuildVersion;
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
        BuildWorker.addArtifact = function (name, source, filename, type, cb) {
            var _this = this;
            var location = path.parse(source), dir = path.normalize(location.dir + (location.ext ? '' : '/' + location.name));
            process.stdout.write('\u001b[36mAdding artifact\u001b[39m ' + name + '...');
            BuildWorker.getInstance()
                .request
                .post('api/artifacts', { name: name, path: dir, fileName: filename || location.base, type: (type ? ArtifactType[type] : ArtifactType[ArtifactType.Auto]) }, function (err, response, uploadUrl) {
                if (err && response.statusCode > 299) {
                    process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                    _this.addException('Posting artifact ' + name + ' to appveyor failed', err);
                    return cb(err);
                }
                process.stdout.write('\u001b[32mOK\u001b[39m\n');
                // we have a uploadUrl we can upload our artifact
                switch (type) {
                    case ArtifactType.Zip:
                        //console.log("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " " + dir);
                        process.stdout.write('\u001b[36mZipping source\u001b[39m...');
                        proc.exec("7z a " + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + " *", { cwd: dir, env: process.env }, function (err, stdout, stderr) {
                            if (err) {
                                process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                _this.addException('Uploading artifact ' + name + ' failed', err);
                                return cb(err);
                            }
                            process.stdout.write('\u001b[32mOK\u001b[39m\n');
                            process.stdout.write('\u001b[36mUploading artifact\u001b[39m...');
                            BuildWorker.getInstance()
                                .request
                                .upload(uploadUrl, path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip"), function (err, res, body) {
                                if (err) {
                                    process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                    _this.addException('Uploading artifact file "' + path.normalize(os.tmpdir() + '/sencha-build/' + name + ".zip") + '" to "' + uploadUrl + '" failed', err);
                                    return cb(err);
                                }
                                process.stdout.write('\u001b[32mOK\u001b[39m\n');
                                _this.addMessage('Uploaded artifact ' + name + ' from ' + source);
                                cb(null);
                            });
                        });
                        break;
                    case ArtifactType.WebDeployPackage:
                        _this.addMessage("Artifact " + name + " has type WebDeployPackage that isn't implemented");
                        cb(null);
                        break;
                    case ArtifactType.NuGetPackage:
                        _this.addMessage("Artifact " + name + " has type of NuGetPackage that isn't implemented");
                        cb(null);
                        break;
                    case ArtifactType.Auto:
                        if (location.ext && location.base) {
                            process.stdout.write('\u001b[36mUploading artifact\u001b[39m...');
                            // we have a file
                            BuildWorker.getInstance()
                                .request
                                .upload(uploadUrl, source, function (err, res, body) {
                                if (err) {
                                    process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                    _this.addException('Uploading artifact file "' + path.normalize(source) + '" to "' + uploadUrl + '" failed', err);
                                    cb(err);
                                }
                                process.stdout.write('\u001b[32mOK\u001b[39m\n');
                                _this.addMessage('Uploaded artifact ' + name + ' from "' + source + '"');
                                cb(null);
                            });
                        }
                        else {
                            process.stdout.write('\u001b[36mUploading artifact\u001b[39m...\u001b[31mFAILED\u001b[39m\n');
                            _this.addMessage("Artifact " + name + " has type of Auto and the provided location is not a file " + location);
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
        };
        return BuildWorker;
    }());
    Appveyor.BuildWorker = BuildWorker;
    function getBuildVersion(rawversion) {
        var buildVersion, variables = [
            'APPVEYOR_BUILD_VERSION',
            'APPVEYOR_REPO_TAG_NAME'
        ];
        if (rawversion == null) {
            buildVersion = new Appveyor.BuildVersion(variables
                .map(function (variable) {
                return process.env[variable] || "0.0.1";
            })
                .filter(function (variable) {
                return variable !== undefined && variable.length > 0;
            })[0] || '0.0.1');
        }
        else {
            buildVersion = new Appveyor.BuildVersion(rawversion);
            buildVersion.Build = parseInt(process.env['APPVEYOR_BUILD_NUMBER']) || 1;
        }
        return buildVersion;
    }
    Appveyor.getBuildVersion = getBuildVersion;
})(Appveyor || (Appveyor = {}));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Appveyor;
//# sourceMappingURL=appveyor.js.map