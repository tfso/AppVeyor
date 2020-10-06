import events = require('events');
import path = require('path');
import proc = require('child_process');
import http = require('http');
import unzip = require('unzip');
import fs = require('fs');
import os = require('os');

import AppVeyor from './../appveyor';


export class Command extends events.EventEmitter {
    private _lastOutputWithLF = false
    private options: Object = {};

    public static path: string;

    constructor(options?: Object) {
        super();

        this.options = Object.assign(this.options, {
            env: process.env,
            cwd: process.cwd() 
        }, options);
    }

    public output(std: string | Buffer): string {
        let out: string = '';

        for (let line of Command.parseOutput(std)) {
            if (this._lastOutputWithLF == false && line.length > 1) {
                this.emit('stdout', '\n'); this._lastOutputWithLF = true;
                out += '\n';
            }

            if (line.length == 1) {
                this.emit('stdout', line); this._lastOutputWithLF = false;
                out += line;

            } else {
                this.emit('stdout', line + '\n');
                out += line + '\n';
            }
        }

        return out;
    }

    public static parseOutput(std: string | Buffer): string[] {
        var regex = /^(?:\[([A-Z]{3})\])?[\s\t]?(.+)([\r\n]+|$)/mgi,
            match, output = [];

        while ((match = regex.exec(std.toString())) != null)
        {
            switch (match[1])
            {
                case "INF":
                    output.push('\u001b[32m[INF]\u001b[39m ' + match[2]); break;

                case "LOG":
                    output.push('[LOG]' + ' ' + match[2]); break;

                case "WARN":
                    output.push('\u001b[33m[WARN]\u001b[39m ' + match[2]); break;

                case "ERR":
                    output.push('\u001b[31m[ERR]\u001b[39m ' + match[2]); break;

                default:
                    output.push(match[2]); break;
            }
        }

        return output;
    }

    public static async addRepository(name: string, url: string): Promise<string> {
        return await new Command().addRepository(name, url);
    }

    public async addRepository(name: string, url: string): Promise<string> {
        return await this.execute('repository', 'add', name, url);
    }

    public static async execute(args: string[], cwd?: string): Promise<string> {
        return await new Command(cwd ? { cwd: cwd } : null).execute(...args)
    }

    public async execute(...args: string[]) : Promise<string> {
        let err: any = null,
            cmd: proc.ChildProcess,
            output: string = '';

        await new Promise((resolve, reject) => {
            cmd = proc.spawn(Command.path || 'sencha.exe', args, this.options);

            cmd.stdout.on('data', (data) => {
                output += this.output(data)
            })

            cmd.stderr.on('data', (data) => {
                output += this.output(data)
            })

            cmd.on('error', (ex) => {
                err = ex;
            })

            cmd.on('close', (code) => {
                if (code != 0) {
                    err = err || new Error();
                    err.code = code;

                    reject(err);
                }
                else
                {
                    resolve();
                }
            })
        })
        
        return output
    }

   
    public async install(url: string, destination?: string): Promise<string> {
        return await Command.install(url, destination);
    }

    public static async install(url: string, destination?: string): Promise<string> {
        destination = (destination ? path.normalize(destination) : path.normalize(os.tmpdir() + '/sencha-cmd/'));

        let executable = await Command.download(url);

        var err,
            cmd = proc.spawn(executable, ['-a', '-q', '-dir', destination], {}),
            location = path.normalize(destination + "/sencha.exe");

        try
        {
            await new Promise<string>((resolve, reject) => {
                let err: Error,
                    errMessage: string;

                cmd.on('stdout', (t) => {
                    if (t) { }
                })

                cmd.on('stderr', (t) => {
                    errMessage = t; 
                })

                cmd.on('error', (ex) => {
                    err = ex;
                })

                cmd.on('close', (code) => {
                    if (code != 0)
                        return reject(err || new Error(errMessage));
                    
                    return resolve();
                })
            });

            AppVeyor.BuildWorker.addMessage('Installed Sencha Cmd at ' + location);
        }
        catch (ex)
        {
            AppVeyor.BuildWorker.addException('Installation of Sencha Command failed', ex);
        }

        return Command.path = location;
    }

    private static download(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try
            {
                var request = http.get(url, function (response) {
                    var isExtracting = false;
                    if (url.endsWith('.zip')) {
                        response.pipe(unzip.Parse())
                            .on('entry', (entry) => {
                                var fileName = entry.path;
                                if (fileName.slice(-3) === "exe")
                                {
                                    isExtracting = true;

                                    var destination = path.normalize(os.tmpdir() + "/" + fileName);
                                    entry.pipe(fs.createWriteStream(destination))
                                        .on('close', () => {
                                            resolve(destination);
                                        });
                                } else
                                {
                                    entry.autodrain();
                                }
                            })
                            .on('close', () => {
                                if (isExtracting === false)
                                    reject(new Error('Not executable in zip archive at ' + url));
                            })
                    }else {
                        var split = url.split('/');
                        var fileName = split[split.length-1];
                        var destination = path.normalize(os.tmpdir() + "/" + fileName);
                        response.pipe(fs.createWriteStream(destination)).on('finish', () => resolve(destination));
                    }

                }).on('error', (err) => {
                    reject(err);
                });

            } catch (err)
            {
                reject(err);
            }
        });
    }
}