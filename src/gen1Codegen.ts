import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

enum GenOneType
{
	COMPONENT = 'component type',
	DEPLOYMENT = 'deployment',
	LIBRARY = 'library',
	SERVICE = 'service'
}

export class GenOneCodegen
{
	private genOneRoot: string;
	private validConfigs: string[];

	constructor(gen1_root: string)
	{
		this.genOneRoot = gen1_root;
		this.validConfigs = fs.readdirSync(path.join(gen1_root, 'OBSW/Source', 'build_system/config')).map(fileMK => fileMK.replace('.mk', ''));
	}

	private codegen(args: string[], cwd: string): Thenable<vscode.TaskExecution>
	{
		return execAsTask(path.join(this.genOneRoot, 'Tooling/bin/codegen ' + args.join(' ') + ' -v'), cwd);
	}

	public newItem(dir: string, type: GenOneType): any
	{
		return vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new " + type.valueOf()))
		.then((name: string | undefined) => {
			if(name === undefined)
			{
				return;
			} 
			console.log('User entered: ' + name);
			name = name.trim();
			let newDir = (type == GenOneType.DEPLOYMENT || type == GenOneType.LIBRARY) ? (path.sep + name) : '';
			this.codegen([type.valueOf().replace(' ', ''), 'new', '.' + newDir, '-n', name], dir);
		});
	}

	private newProject(dir: string): any
	{
		return vscode.window.showQuickPick([
			{
				label: 'Deployment',
				detail: 'Create new deployment project'
			},
			{
				label: 'Library',
				detail: 'Create new component library'
			}
		], { matchOnDescription: true })
		.then((type: vscode.QuickPickItem | undefined) => {
			if(type === undefined)
			{
				return;
			}
			if(type.label === 'Library')
			{
				return this.newItem(dir, GenOneType.LIBRARY);
			}
			return this.newItem(dir, GenOneType.DEPLOYMENT);
		});
	}

	private newLibraryItem(dir: string): any
	{
		return vscode.window.showQuickPick([
			{
				label: 'Component Type',
				detail: ''
			},
			{
				label: 'Service',
				detail: ''
			}
		], {matchOnDescription: true})
		.then((type: vscode.QuickPickItem | undefined) => {
			if(type === undefined)
			{
				return;
			}
			if(type.label === 'Service')
			{
				return this.newItem(dir, GenOneType.SERVICE);
			}
			return this.newItem(dir, GenOneType.COMPONENT);
		})
	}

	public async new(dir: string, workspaceRoot: string): Promise<any>
	{
		let projectRoot = seekProjectRoot(dir, workspaceRoot);
		if(projectRoot !== workspaceRoot)
		{
			let targetType = await getProjectTarget(projectRoot);
			if(targetType == GenOneType.LIBRARY)
			{
				return this.newLibraryItem(projectRoot);
			}
			return;
		}
		return this.newProject(projectRoot)
	}

	public genDeployment(file: string): any
	{
		return vscode.window.showQuickPick([
			{
				label: "--remove-unused",
				detail: "Remove any files that are not part of the generated resource tree"
			},
			{
				label: "--short-prefixes",
				detail: "Generates short prefixes for component instance names"
			}], { matchOnDescription: true, canPickMany: true })
			.then((flags: vscode.QuickPickItem[] | undefined) => {
				if(flags === undefined)
				{
					return;
				}	
				let genARGS = ['deployment', 'generate', '.'];
				flags.forEach(flag => genARGS.push(flag.label));
				console.log('Deployment generate args: ' + genARGS.join(' '));
				this.codegen(genARGS, path.dirname(file));
			});
	}

	public genComponentType(file: string): any
	{
		return vscode.window.showQuickPick([
			{
				label: "--unit-tests",
				description: "Generates unit tests"
			},
			{
				label: "--unprotected",
				description: "Do not generate protection locks"
			},
			{
				label: "--value-storage",
				description: "Generate config storage for values"
			}], { matchOnDescription: true, canPickMany: true })
			.then((flags: vscode.QuickPickItem[] | undefined) => {
				if(flags === undefined)
				{
					return;
				}
				let componentPath = path.dirname(file).split('inc/');
				let componentName = componentPath[1].replace(/\//g, '.');
				let genARGS = ['componenttype', 'generate', '.', '-n', componentName];
				flags.forEach(flag => genARGS.push(flag.label));
				console.log('Component generate args: ' + genARGS.join(' '));
				this.codegen(genARGS, componentPath[0]);
			});
	}

	public genService(file: string): any
	{
		return vscode.window.showQuickPick([
			{
				label: "--unit-tests",
				description: "Generates unit tests"
			}], { matchOnDescription: true, canPickMany: true })
			.then((flags: vscode.QuickPickItem[] | undefined) => {
				if(flags === undefined)
				{
					return;
				}
				let servicePath = path.dirname(file).split('inc/');
				let componentName = servicePath[1].replace(/\//g, '.');
				let genARGS = ['service', 'generate', '.', '-n', componentName];
				flags.forEach(flag => genARGS.push(flag.label));
				console.log('Component generate args: ' + genARGS.join(' '));
				this.codegen(genARGS, servicePath[0]);
			});
	}
}

class FSNameInputOptions implements vscode.InputBoxOptions
{
	prompt: string;

	constructor(prompt: string)
	{
		this.prompt = prompt;
	}

	validateInput(value: string): string | undefined | null | Thenable<string | undefined | null>
	{
		if(value.match(/^[a-zA-Z](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?\.?[a-zA-Z0-9_-]+$/g))
		{
			return undefined;
		}
		return value;
	} 
}

function execAsTask(cmd: string, cwd: string): Thenable<vscode.TaskExecution>
{
	return vscode.tasks.executeTask(new vscode.Task(
		{
			type: 'genone-codegen'
		}, 
		vscode.TaskScope.Workspace, 
		'Bright Ascension CodeGen', 
		'genone-codegen',
		new vscode.ShellExecution(cmd, { cwd: cwd })
	));
}

function seekProjectRoot(dir: string, workspaceRoot: string): string
{
	let relativePath = dir.replace(workspaceRoot, '').split(path.sep);
	let projectRoot = dir;
	do
	{
		if(fs.existsSync(path.join(projectRoot, 'config/project.mk')) &&
			fs.existsSync(path.join(projectRoot, 'Makefile')))
		{
			break;
		}
		relativePath.pop();
		projectRoot = path.join(workspaceRoot, relativePath.join(path.sep));
	} while(projectRoot !== workspaceRoot);

	return projectRoot;
}

function getProjectTarget(projectRoot: string): Promise<GenOneType>
{
	let getTargetType = /TARGET_TYPE \:\= (.*)/;
	return new Promise<GenOneType>((resolve, reject) => {
		fs.readFile(path.join(projectRoot, 'config/project.mk'), (err, data) => {
			if(err)
			{
				reject(err);
			}
			let target = getTargetType.exec(data.toString());
			if(target)
			{
				resolve(target[0].trim().toLowerCase() === 'bin' ? GenOneType.DEPLOYMENT : GenOneType.LIBRARY);
			}
			reject('Unable to parse project.mk file');
		})
	});
}

