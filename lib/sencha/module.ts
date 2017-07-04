import events = require('events');
import fsp = require('../../lib/fs-promise');
import path = require('path');
import proc = require('child_process');

import AppVeyor from './../appveyor';
import { IConfiguration } from './common';
import { Command } from './command';
import patchVersion from './../patch-version';


export enum ModuleType {
    Package,
    Application
}

export interface IBuildConfiguration {
    buildOnly?: ModuleType;
    keepPackageVersion?: boolean;
    keepAppVersion?: boolean;
}

export interface IModule extends events.EventEmitter {
    location: string
    name: string
    version: string
    publish: boolean

    type: ModuleType

    open(callback?: (err: Error) => void): Promise<any>
    build(options?: IBuildConfiguration, callback?: (err: Error) => void): Promise<any>
}

export class Module extends events.EventEmitter implements IModule {
    name = ""
    location = null
    version = null
    publish = true

    constructor(config: IConfiguration) {
        super();

        this.location = path.normalize(config.path);
    }

    public get type() {
        switch (path.parse(this.location).base)
        {
            case "package.json":
                return ModuleType.Package;

            case "app.json":
                return ModuleType.Application;

            default:
                return null;
        }
    }

    public static async open(config: IConfiguration): Promise<IModule> {
        return await new Module(config).open();
    }

    public async open(): Promise<this> {
        let content = await fsp.readFile(this.location);

        content = content.replace(/("(?:(?:\\[^\n]|[^""\n])*)")|\/\*(.|\n|\r\n)*?\*\/|(?:\/\/.*$)/mgi, "$1");

        var json = JSON.parse(content);

        this.name = json.name;
        this.version = json.sencha ? json.sencha.version : json.version;
        this.publish = typeof json.publish == 'boolean' ? json.publish : true;
        
        return this;
    }

    public output(std: string | Buffer) {
        Command.parseOutput(std)
            .forEach((line) => {
                this.emit('stdout', line + '\n');
            })
    }

    public async build(options?: IBuildConfiguration) {
        try
        {
            let newversion = AppVeyor.getBuildVersion((this.type == ModuleType.Package && options && options.keepPackageVersion) || (this.type == ModuleType.Application && options && options.keepAppVersion) ? this.version : null).toString();

            this.emit('stdout', 'Building "\u001b[36m' + this.name + '\u001b[39m"\n');
            this.emit('stdout', 'Patching from version ' + this.version + ' to ' + newversion + ' based at ' + ((this.type == ModuleType.Package && options && options.keepPackageVersion) || (this.type == ModuleType.Application && options && options.keepAppVersion) ? this.version : 'N/A') + '\n');

            await patchVersion(this.location, newversion, null, null);

            await Command.execute(
                ['config', '-prop', 'skip.slice=1', /*'-prop', 'skip.sass=1',*/ 'then', (this.type == ModuleType.Package ? 'package' : 'app'), 'build', (this.type == ModuleType.Application ? 'production' : '')],
                this.output.bind(this),
                path.dirname(this.location)
            );

            this.emit('close', 0, null);
        }
        catch (ex)
        {
            this.emit('close', ex.code || -1, ex);

            throw ex;
        }
    }
}