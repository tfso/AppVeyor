"use strict";
var Appveyor;
(function (Appveyor) {
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
})(Appveyor || (Appveyor = {}));
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
exports.getBuildVersion = getBuildVersion;
//# sourceMappingURL=appveyor-properties.js.map