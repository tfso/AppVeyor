import proc = require('child_process');
import path = require('path');
import program = require('commander');

program
    .version(process.env.npm_package_version || require('./../package.json').version)
    .option('-c, --sencha-cmd <path>', 'Path to sencha command, either given by install or environment SENCHACMD, default: ' + (process.env.SENCHACMD || "sencha.exe"), path.normalize, process.env.SENCHACMD || "sencha.exe")
    .command('*')
    .action((options) => {

        process.env['SENCHACMD'] = (options.senchaCmd || 'sencha.exe');

        new Promise((resolve, reject) => {
            var err,
                cmd = proc.spawn(process.env.SENCHACMD, process.argv.slice(2, process.argv.length), { cwd: process.cwd(), env: process.env });

            cmd.stdout.on('data', (data) => {
                output(data); // this.emit('stdout', data.toString().replace(/\n/gi, ""));
            })

            cmd.stderr.on('data', (data) => {
                output(data); //this.emit('stderr', data.toString().replace(/\n/gi, ""));
            })

            cmd.on('error', (ex) => {
                err = ex;
            })

            cmd.on('close', (code) => {
                if (code != 0) {
                    reject(err || new Error());
                }
                else {
                    resolve();
                }
            })
        })
        .then(() => {
            process.exit(0);
        })
        .catch(() => {
            process.exit(-1);
        })
    });


program.parse(process.argv);

if (program.args.length == 0)
    program.help();


var lastOutputWithLF = false;

function output(std: Buffer) {
    getSenchaOutput(std)
        .forEach((line) => {
            if (lastOutputWithLF == false && line.length > 1) {
                lastOutputWithLF = true;
                process.stdout.write("\n");
            }

            if (line.length == 1) {
                process.stdout.write(line); lastOutputWithLF = false;
            } else {
                process.stdout.write(line + '\n');
            }
        })
}

function getSenchaOutput(std: Buffer): string[] {
    var regex = /^(?:\[([A-Z]{3})\])?(.+)$/mgi,
        match, output = [];
    
    while ((match = regex.exec(std.toString())) != null) {

        switch (match[1]) {
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

