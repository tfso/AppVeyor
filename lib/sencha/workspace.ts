import events = require('events');
import fsp = require('../../lib/fs-promise');
import path = require('path');
import request = require('request-json');
import proc = require('child_process');


import AppVeyor from './../appveyor';
import { IConfiguration } from './common';
import { Module, IModule, ModuleType, IBuildConfiguration } from './module';
import { Command } from './command';


export interface IWorkspace extends events.EventEmitter {
    workspace: string
    sdk: string

    upgrade(callback?: (err: Error) => void): Promise<any>
    build(options?: IBuildConfiguration, callback?: (err: Error) => void): Promise<any>
    publish(url?: string, callback?: (err: Error) => void): Promise<any>
}

export class Workspace extends events.EventEmitter implements IWorkspace {
    workspace = ""
    sdk = ""
    buildPath = ""

    _lastOutputWithLF = false

    constructor(config: IConfiguration) {
        super();

        this.workspace = path.normalize(config.path);
        this.sdk = config.sdk;
    }

    public output(std: string | Buffer) {
        Command.parseOutput(std)
            .forEach((line) => {
                if (this._lastOutputWithLF == false && line.length > 1)
                {
                    this._lastOutputWithLF = true;
                    this.emit('stdout', '\n');
                }

                if (line.length == 1)
                {
                    this.emit('stdout', line); this._lastOutputWithLF = false;
                } else
                {
                    this.emit('stdout', line + '\n');
                }
            })
    }

    public async publish(url?: string): Promise<void> {
        try {
            let buildPath = this.workspace + "/build/", // this may default to something else, check .sencha/workspace/sencha.cfg
                modules = await this.getModules();
     
            await this.sync(modules.map((module) => {
                return async () => {
                    switch (module.type)
                    {
                        case ModuleType.Application:
                            await new Promise((resolve, reject) => 
                                AppVeyor.BuildWorker.addArtifact(module.name, path.normalize(buildPath + 'production/' + module.name + '/'), module.name + ".zip", AppVeyor.ArtifactType.Zip, (err) => { if (err) return reject(err); resolve(); })
                            );

                            break;

                        case ModuleType.Package:
                            if (url)
                            {
                                if (module.publish == false)
                                {
                                    process.stdout.write('\u001b[36mUploading artifact \u001b[39m' + module.name + ' \u001b[36mto remote repository\u001b[39m...\u001b[33mIGNORED\u001b[39m in config\n');
                                    break;
                                }

                                process.stdout.write('\u001b[36mUploading artifact \u001b[39m' + module.name + ' \u001b[36mto remote repository\u001b[39m...');
                                var req = request.createClient(url);

                                try
                                {
                                    let res = await new Promise<any>((resolve, reject) => {
                                        req.sendFile('', buildPath + module.name + '/' + module.name + ".pkg", (err, res, body) => {
                                            if (err)
                                                return reject(err);

                                            resolve(res);
                                        })
                                    })

                                    if (res.statusCode > 299)
                                        throw new Error('Http Error ' + res.statusCode + ': ' + res.statusMessage + '; ' + JSON.stringify(res.body));

                                    process.stdout.write('\u001b[32mOK\u001b[39m\n');
                                }
                                catch (ex)
                                {
                                    process.stdout.write('\u001b[31mFAILED\u001b[39m\n');
                                    AppVeyor.BuildWorker.addException('Uploading artifact ' + module.name + ' failed', ex)
                                }
                            }
                            else
                            {
                                await new Promise((resolve, reject) =>
                                    AppVeyor.BuildWorker.addArtifact(module.name, path.normalize(buildPath + module.name + '/' + module.name + ".pkg"), module.name + ".pkg", AppVeyor.ArtifactType.Auto, (err) => { if (err) return reject(err); resolve() })
                                );
                            }

                            break;
                    }
                }
            }))

            this.emit('close', 0);
        } 
        catch(ex)
        {
                this.emit('close', ex.code || -1, ex);
        }
    }

    public async upgrade(): Promise<void> {
        try
        {
            await new Command({ cwd: this.workspace })
                .on('stdout', data => this.output(data))
                .execute('framework', 'upgrade', 'ext', this.sdk || "ext")

            this.emit('close', 0, null);
        }
        catch (ex)
        {
            this.emit('close', ex.code || -1, ex);
            throw ex;
        }      
    }

    public async install(): Promise<void> {
        try
        {
            await new Command({ cwd: this.workspace })
                .on('stdout', data => this.output(data))
                .execute('framework', 'add', 'ext', this.sdk || "ext");

            this.emit('close', 0, null);
        }
        catch (ex)
        {
            this.emit('close', ex.code || -1, ex);
            throw new Error('Upgrading workspace failed (' + ex.code + ': ' + ex.description + ')');
        }
    }

    public async build(options?: IBuildConfiguration): Promise<void> {
        try
        {
            let modules = await this.getModules();

            for (let module of modules) {
                this.emit('stdout', 'Found ' + (module.type == ModuleType.Package ? 'package' : 'application') + ' "\u001b[36m' + module.name + '\u001b[39m" at "' + path.dirname(module.location) + '"\n');

                module.on('stdout', (data) => {
                    this.output(data);
                })

                module.on('stderr', (data) => {
                    this.output(data);
                })
            }

            await this.sync(modules.map((module) => {
                return async () => {
                    if (options.buildOnly == null || module.type == options.buildOnly)
                    {
                        this.emit('stdout', '\n');

                        return await module.build(options);
                    }
                    else
                    {
                        this.emit('stdout', '\n');
                        this.emit('Ignoring ' + module.name);
                    }
                }
            }));

            this.emit('close', 0);
        }
        catch (ex)
        {
            this.emit('close', -1, ex)

            throw ex;
        }
    }

    private getModules(): Promise<Array<IModule>>
    private getModules(callback: (err: Error, modules?: Array<IModule>) => void): void
    private getModules(callback?: (err: Error, modules?: Array<IModule>) => void)
    {
        var execute: Promise<Array<IModule>> = new Promise((resolve, reject) => {
            this.emit('stdout', 'Finding apps and packages in ' + this.workspace + '\n');

            Promise
                .all([
                    fsp
                        .listFiles(this.workspace, 1)
                        .then((files) => {
                            if (files == null || files == undefined)
                                return [];

                            return files
                                .filter((file) => {
                                    return path.parse(file).base == 'app.json';
                                })
                                .map((file) => {
                                    return new Module({ path: file, buildPath: this.buildPath });
                                });
                        }),
                    fsp
                        .listFiles(path.join(this.workspace, 'packages/local'), 1)
                        .then((files) => {
                            if (files == null || files == undefined)
                                return [];

                            return files
                                .filter((file) => {
                                    return path.parse(file).base == 'package.json';
                                })
                                .map((file) => {
                                    return new Module({ path: file, buildPath: this.buildPath });
                                });
                        })
                ]
                )
                .then((response) => {

                    var modules = [].concat.apply([], response);

                    return Promise
                        .all(
                        modules.map((module) => {
                            return module.open();
                        })
                        )
                        .then(() => {
                            resolve(modules);
                        })
                        .catch((err) => {
                            throw err;
                        });
                })
                .catch((err) => {
                    reject(err);
                })
        });

        if (callback != null)
        {
            // callback
            execute.then((modules) => { callback(null, modules); }).catch((err) => { callback(err); });
        }
        else
        {
            // promise
            return execute;
        }
    }

    private sync<T>(values: Iterable<T | PromiseLike<T>>): Promise<Array<T>> {
        return new Promise<T[]>((resolve, reject) => {
            try
            {
                let results: Array<T> = [],
                    iterator = values[Symbol.iterator](),
                    iterate = (iterator: Iterator<T | PromiseLike<T>>) => {
                        let res = iterator.next();

                        switch (res.done)
                        {
                            case false:

                                if (res.value)
                                {
                                    let promise: Promise<T>;

                                    if (res.value instanceof Promise)
                                        promise = res.value;
                                    else if (typeof res.value == 'function' && (<Function>res.value).length == 2)
                                        promise = new Promise(res.value);
                                    else if (typeof res.value == 'function')
                                        promise = (<Function>res.value).call(undefined);
                                    else
                                        promise = Promise.resolve(res.value);

                                    promise
                                        .then((result) => {
                                            results.push(result);

                                            iterate(iterator);
                                        })
                                        .catch(err => {
                                            reject(err)
                                        });
                                }
                                break;

                            case true:
                                resolve(results);
                                break;
                        }
                    };

                iterate(iterator);

            } catch (err)
            {
                reject(err);
            }
        });
    }
}