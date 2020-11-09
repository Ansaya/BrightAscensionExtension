// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { stderr } from 'process';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';
import { Gen1TaskProvider } from './gen1TaskProvider';

var GEN1_ROOT: string = '';
let gen1TaskProvider: vscode.Disposable | undefined;

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

function callCodeGen(args: string[], cwd: string)
{
	let task = new vscode.Task(
		{
			type: 'BAType'
		}, 
		vscode.TaskScope.Workspace, 
		'Build', 
		'Bright Ascension CodeGen', 
		new vscode.ShellExecution(path.join(GEN1_ROOT, 'Tooling/bin/codegen'), args.concat(['-v']) , { cwd: cwd }), 
		undefined);
	vscode.tasks.executeTask(task);
}

function resolveEnvVar(envVar: string): undefined | string
{
	let value: Buffer | string;
	try {
		value = cp.execSync('if [[ -z "' + envVar + '"]]; then exit 1; else echo ' + envVar + '; fi');
	} catch (error) {
		console.log("Environment variable " + envVar + " not found");
		return undefined;
	}
	return value.toString().trim();
}

function exists(path: string): boolean
{
	try {
		cp.execSync('if [[ -e "' + path + '"]]; then exit 1; else echo exit 0; fi');
	} catch (error) {
		return false;
	}
	return true;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Bright Ascension CodeGen extension activated!');

	let baConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('brightascension');
	let gen1Root: string | undefined = baConfig.get('gen1_root');
	if(gen1Root === undefined)
	{
		vscode.window.showErrorMessage('Bright Ascension CodeGen activation error: please set Gen1 FSDK root in VS Code settings!');
		return;
	}
	let envVars: RegExpMatchArray | null = gen1Root.match(/\$\{[a-zA-Z](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?\}/g);
	if(envVars !== null)
	{
		let envVar: string | undefined = envVars.pop();
		for(; envVar !== undefined; envVar = envVars.pop())
		{
			let value: string | undefined = resolveEnvVar(envVar);
			if(value === undefined)
			{
				vscode.window.showErrorMessage('Bright Ascension Codegen activation error: environment variable "' + envVar + '" used in Gen1 FSDK root path is not valid');
				return;
			}
			gen1Root = gen1Root.replace(envVar, value);
		}
	}
	if(exists(gen1Root) === false)
	{
		vscode.window.showErrorMessage('Bright Ascension CodeGen activation error: please set a valid path for Gen1 FSDK root in VS Code settings!');
		return;
	}
	GEN1_ROOT = gen1Root;
	console.log('Loaded Gen1 FSDK root: ' + gen1Root);
	let obswRoot: string = path.join(gen1Root, 'OBSW/Source');
	console.log('Gen1 FSDK root: ' + gen1Root);
	console.log('Gen1 FSDK OBSW: ' + obswRoot);

	let gen1Configs: string[] = fs.readdirSync(path.join(obswRoot, 'build_system/config'));
	gen1Configs = gen1Configs.map(fileMK => fileMK.replace('.mk', ''));
	console.log('Available configs: ' + gen1Configs.join(', '));
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let newDeployment = vscode.commands.registerCommand('brightascension.newDeployment', (uri: vscode.Uri) => {
		vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new deployment"))
			.then((deplName: string | undefined) => {
				if(deplName === undefined)
				{
					return;
				} 
				console.log('User entered: ' + deplName);
				deplName = deplName.trim();
				callCodeGen(['deployment', 'new', './' + deplName] , uri.fsPath);
			});
	});

	let newLibrary = vscode.commands.registerCommand('brightascension.newLibrary', (uri: vscode.Uri) => {
		vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new library"))
			.then((libName: string | undefined) => {
				if(libName === undefined)
				{
					return;
				} 
				console.log('User entered: ' + libName);
				libName = libName.trim();
				callCodeGen(['library', 'new', './' + libName, '-n', libName], uri.fsPath);
			});
	});

	let newComponentType = vscode.commands.registerCommand('brightascension.newComponentType', (uri: vscode.Uri) => {
		vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new component type"))
			.then((cTypeName: string | undefined) => {
				if(cTypeName === undefined)
				{
					return;
				} 
				console.log('User entered: ' + cTypeName);
				cTypeName = cTypeName.trim();
				callCodeGen(['componenttype', 'new', '.', '-n', cTypeName], uri.fsPath);
			});
	});

	let newService = vscode.commands.registerCommand('brightascension.newService', (uri: vscode.Uri) => {
		vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new service"))
			.then((serviceName: string | undefined) => {
				if(serviceName === undefined)
				{
					return;
				} 
				console.log('User entered: ' + serviceName);
				serviceName = serviceName.trim();
				callCodeGen(['service', 'new', '.', '-n', serviceName], uri.fsPath);
			});
	});

	let generateDeployment = vscode.commands.registerCommand('brightascension.generateDeployment', (uri: vscode.Uri) => {
		vscode.window.showQuickPick([
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
				callCodeGen(genARGS, uri.fsPath.replace('/deployment.xml', ''));
			});
	});

	let generateComponentType = vscode.commands.registerCommand('brightascension.generateComponentType', (uri: vscode.Uri) => {
		vscode.window.showQuickPick([
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
				let componentPath = uri.fsPath.replace('/componentType.xml', '').split('inc/');
				let componentName = componentPath[1].replace(/\//g, '.');
				let genARGS = ['componenttype', 'generate', '.', '-n', componentName];
				flags.forEach(flag => genARGS.push(flag.label));
				console.log('Component generate args: ' + genARGS.join(' '));
				callCodeGen(genARGS, componentPath[0]);
			});
	});

	let generateService = vscode.commands.registerCommand('brightascension.generateService', (uri: vscode.Uri) => {
		vscode.window.showQuickPick([
			{
				label: "--unit-tests",
				description: "Generates unit tests"
			}], { matchOnDescription: true, canPickMany: true })
			.then((flags: vscode.QuickPickItem[] | undefined) => {
				if(flags === undefined)
				{
					return;
				}
				let servicePath = uri.fsPath.replace('/service.xml', '').split('inc/');
				let componentName = servicePath[1].replace(/\//g, '.');
				let genARGS = ['service', 'generate', '.', '-n', componentName];
				flags.forEach(flag => genARGS.push(flag.label));
				console.log('Component generate args: ' + genARGS.join(' '));
				callCodeGen(genARGS, servicePath[0]);
			});
	});

	context.subscriptions.push(newDeployment);
	context.subscriptions.push(newLibrary);
	context.subscriptions.push(newComponentType);
	context.subscriptions.push(newService);

	context.subscriptions.push(generateDeployment);
	context.subscriptions.push(generateComponentType);
	context.subscriptions.push(generateService);

	const workspaceRoot = vscode.workspace.rootPath;
	if(!workspaceRoot)
	{
		return;
	}
	gen1TaskProvider = vscode.tasks.registerTaskProvider(Gen1TaskProvider.gen1Type, new Gen1TaskProvider(workspaceRoot));
}

// this method is called when your extension is deactivated
export function deactivate() {
	if(gen1TaskProvider)
	{
		gen1TaskProvider.dispose();
	}
	console.log("Birght Ascension CodeGen extension deactivated!");
}
