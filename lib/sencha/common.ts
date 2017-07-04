import path = require('path');
import proc = require('child_process');

export interface IConfiguration {
    path: string
    buildPath?: string
    sdk?: string
}