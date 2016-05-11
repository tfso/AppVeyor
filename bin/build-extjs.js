#!/usr/bin/env node
"use strict";
var process = require('child_process');
process.exec('sencha.exe help', function (err, stdout, stderr) {
    if (err) {
        console.error(err);
        return;
    }
    console.log(stdout);
});
//# sourceMappingURL=build-extjs.js.map