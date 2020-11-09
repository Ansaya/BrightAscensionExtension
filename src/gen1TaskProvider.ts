import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as vscode from 'vscode';
import * as os from 'os';

export class Gen1TaskProvider implements vscode.TaskProvider {
	static gen1Type = 'gen1';
	private gen1Promise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor(workspaceRoot: string) {
		const pattern = path.join(workspaceRoot, '**/config/project.mk');
		const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
		fileWatcher.onDidChange(() => this.gen1Promise = undefined);
		fileWatcher.onDidCreate(() => this.gen1Promise = undefined);
		fileWatcher.onDidDelete(() => this.gen1Promise = undefined);
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.gen1Promise) {
			this.gen1Promise = getGen1Tasks();
		}
		return this.gen1Promise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;
		// A Gen1 task consists of a targetRoot containing the Makefile and optional arguments for the make command
		// Make sure that this looks like a Gen1 task by checking that there is a task.
		if (task) {
			// resolveTask requires that the same definition object be used.
			const definition: Gen1TaskDefinition = <any>_task.definition;
            return new vscode.Task(definition, _task.scope ?? vscode.TaskScope.Workspace, definition.targetRoot, Gen1TaskProvider.gen1Type, 
                new vscode.ShellExecution(`make ${definition.args?.join(' ')}`, { cwd: definition.targetRoot }));
		}
		return undefined;
	}
}

let _channel: vscode.OutputChannel;
function getOutputChannel(): vscode.OutputChannel {
    if (!_channel) {
        _channel = vscode.window.createOutputChannel('Gen1 Auto Detection');
    }
    return _channel;
}

function exists(file: string): Promise<boolean> {
    return new Promise<boolean>((resolve, _reject) => {
        fs.exists(file, (value) => {
            resolve(value);
        });
    });
}

function exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        cp.exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stdout, stderr });
            }
            resolve({ stdout, stderr });
        });
    });
}

function read(filePath: string) : Promise<{ data: Buffer }> {
    return new Promise<{ data: Buffer }>((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if(err)
            {
                reject({ err });
            }
            resolve({ data });
        });
    });
}

interface Gen1TaskDefinition extends vscode.TaskDefinition {
    targetRoot: string;
    args?: string[];
}

const getTarget = /TARGET \:\= (.*)/;
const getTargetType = /TARGET_TYPE \:\= (.*)/;
const getConfigs = /VALID_CONFIGS [\:\+]\= (.*)/g;

async function getGen1Tasks(): Promise<vscode.Task[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const result: vscode.Task[] = [];
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return result;
    }
    for (const workspaceFolder of workspaceFolders) {
        const folderString = workspaceFolder.uri.fsPath;
        if (!folderString) {
            continue;
        }
        console.log("Exploring folder " + folderString);

        try {
            const { stdout, stderr } = await exec("find . -wholename '*/config/project.mk'", { cwd: folderString});
            if (stderr && stderr.length > 0) {
                getOutputChannel().appendLine(stderr);
                getOutputChannel().show(true);
            }
            if(stdout)
            {
                let mkFiles = stdout.split('\n');
                console.log(`Found ${mkFiles.length} valid project.mk files.`);
                for(const mkFile of mkFiles)
                {
                    if(mkFile.length === 0)
                    {
                        continue;
                    }
                    const targetRoot = mkFile.replace('config/project.mk', '');
                    const makeFile = path.join(folderString, targetRoot, 'Makefile');
                    if (!await exists(makeFile)) 
                    {
                        console.log("Makefile not found for " + mkFile);
                        continue;
                    }
                    
                    let { data } = await read(path.join(folderString, mkFile));
                    let mkText = data.toString();
                    let target = getTarget.exec(mkText);
                    if(target === null)
                    {
                        getOutputChannel().appendLine('Unable to find target name');
                        getOutputChannel().show(true);
                        continue;
                    }
                    let targetType = getTargetType.exec(mkText);
                    if(targetType === null)
                    {
                        getOutputChannel().appendLine('Unable to find target type for ' + target);
                        getOutputChannel().show(true);
                        continue;
                    }
                    let targetSign = target[1] + (targetType[1] === 'bin' ? ' deployment' : ' library');
                    console.log("Gen1 valid configuration found for " + targetSign + ".");
                    let configs = getConfigs.exec(mkText);
                    while (configs !== null) {
                        let targetConfigs = configs[1].split(/\s+/);
                        for(const config of targetConfigs)
                        {
                            if(config.length === 0)
                            {
                                continue;
                            }
                            const taskName = targetSign + ' for ' + config;
                            const build: Gen1TaskDefinition = {
                                type: Gen1TaskProvider.gen1Type,
                                targetRoot: targetRoot,
                                args: [`-j${os.cpus().length}`, `CONFIG=${config}`]
                            };
                            const buildTask = new vscode.Task(build, workspaceFolder, 'Build ' + taskName, build.type, 
                                new vscode.ShellExecution(`make ${build.args?.join(' ')}`, { cwd: build.targetRoot }));
                            result.push(buildTask);
                            buildTask.group = vscode.TaskGroup.Build;

                            const clean: Gen1TaskDefinition = {
                                type: Gen1TaskProvider.gen1Type,
                                targetRoot: targetRoot,
                                args: [`-j${os.cpus().length}`, `CONFIG=${config}`, 'clean']
                            };
                            const cleanTask = new vscode.Task(clean, workspaceFolder, 'Clean ' + taskName, clean.type, 
                                new vscode.ShellExecution(`make ${clean.args?.join(' ')}`, { cwd: clean.targetRoot }));
                            result.push(cleanTask);
                            cleanTask.group = vscode.TaskGroup.Build;
                        }
                        configs = getConfigs.exec(mkText);
                    }
                }
            }
        } catch (err) {
            const channel = getOutputChannel();
            if (err.stderr) {
                channel.appendLine(err.stderr);
            }
            if (err.stdout) {
                channel.appendLine(err.stdout);
            }
            channel.appendLine('Auto detecting Gen1 tasks failed.');
            channel.show(true);
        }
    }
    return result;
}