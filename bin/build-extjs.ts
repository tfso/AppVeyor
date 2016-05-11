#!/usr/bin/env node

import process = require('child_process');

process.exec('sencha.exe help', (err, stdout, stderr) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(stdout);
});