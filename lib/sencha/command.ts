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

    public static path: string;

    constructor() {
        super();
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

    public static parseOutput(std: string | Buffer): string[] {
        var regex = /^(?:\[([A-Z]{3})\])?\s*(.+)$/mgi,
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

    public static addRepository(name: string, url: string, callback?: (err: Error, output?: string) => void): Promise<string> {
        var execute = new Promise<string>((resolve, reject) => {
            var err, output = [],
                cmd = proc.spawn(Command.path || 'sencha.exe', ['repository', 'add', name, url], { env: process.env });


            cmd.stdout.on('data', (data) => {
                output.push(Command.parseOutput(data));
            })

            cmd.stderr.on('data', (data) => {
                output.push(Command.parseOutput(data));
            })

            cmd.on('error', (ex) => {
                err = ex;
            })

            cmd.on('close', (code) => {
                if (code != 0)
                {
                    reject(err || new Error('Adding repository to workspace failed (' + code + ')'));
                }
                else
                {
                    resolve(output.join('\n'));
                }
            })
        });

        if (callback != null)
        {
            // callback
            execute.then((output) => { callback(null, output); }).catch((err) => { callback(err); });
        }
        else
        {
            // promise
            return execute;
        }
    }

    public static async execute(args: string[], output?: (data: string | Buffer) => void, cwd?: string) : Promise<void> {
        let err: any = null,
            cmd: proc.ChildProcess;

        await new Promise((resolve, reject) => {
            cmd = proc.spawn(Command.path || 'sencha.exe', args, { cwd: cwd || process.cwd(), env: process.env });

            cmd.stdout.on('data', (data) => {
                if (output)
                    Command.parseOutput(data).forEach((line) => output(line))
            })

            cmd.stderr.on('data', (data) => {
                if (output)
                    Command.parseOutput(data).forEach((line) => output(line))
            })

            cmd.on('error', (ex) => {
                err = ex;
            })

            cmd.on('close', (code) => {
                if (code != 0)
                {
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
        
        return;
    }

    public static async install(url: string, destination?: string): Promise<string> {
        destination = (destination ? path.normalize(destination) : path.normalize(os.tmpdir() + '/sencha-cmd/'));

        let executable = await Command.download(url);

        var err,
            cmd = proc.spawn(executable, ['-a', '-q', '-dir', destination], {});

        try
        {
            let location = await new Promise<string>((resolve, reject) => {
                let err: Error,
                    errMessage: string;

                cmd.on('stdout', (t) => {
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
                    
                    return resolve(path.normalize(destination + "/sencha.exe"));
                })
            });

            AppVeyor.BuildWorker.addMessage('Installed Sencha Cmd at ' + localStorage);

            return Command.path = location;
        }
        catch (ex)
        {
            AppVeyor.BuildWorker.addException('Installation of Sencha Command failed', ex);
        }
    }

    private static download(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try
            {
                var request = http.get(url, function (response) {
                    var isExtracting = false;

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