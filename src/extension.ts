// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { stderr } from 'process';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as path from 'path';
import { Gen1TaskProvider } from './gen1TaskProvider';
import { GenOneCodegen } from './gen1Codegen';

let gen1TaskProvider: vscode.Disposable | undefined;
let gen1Codegen: GenOneCodegen | undefined;

function resolvePath(dir: string) : Promise<string>
{
	return new Promise<string>((resolve, reject) => {
		cp.exec('echo ' + dir, (err, stdout, stderr) => {
			if(err)
			{
				reject({err, stdout, stderr});
			}
			resolve(stdout.trim());
		});
	});
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

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
	gen1Root = await resolvePath(gen1Root);
	if(!fs.existsSync(gen1Root))
	{
		vscode.window.showErrorMessage('Bright Ascension CodeGen activation error: please set a valid path for Gen1 FSDK root in VS Code settings!');
		return;
	}
	let obswRoot: string = path.join(gen1Root, 'OBSW/Source');
	console.log('Gen1 FSDK root: ' + gen1Root);
	console.log('Gen1 FSDK OBSW: ' + obswRoot);

	gen1Codegen = new GenOneCodegen(gen1Root);
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let create = vscode.commands.registerCommand('brightascension.create', (uri: vscode.Uri) => {
		let currentWorkspace = vscode.workspace.getWorkspaceFolder(uri);
		if(currentWorkspace)
		{
			gen1Codegen?.new(uri.fsPath, currentWorkspace.uri.fsPath);
		}
	});

	let generateDeployment = vscode.commands.registerCommand(
		'brightascension.generateDeployment', (uri: vscode.Uri) => {
			gen1Codegen?.genDeployment(uri.fsPath);
		});

	let generateComponentType = vscode.commands.registerCommand(
		'brightascension.generateComponentType', (uri: vscode.Uri) => {
			gen1Codegen?.genComponentType(uri.fsPath);
		});

	let generateService = vscode.commands.registerCommand(
		'brightascension.generateService', (uri: vscode.Uri) => {
			gen1Codegen?.genService(uri.fsPath);
		});

	context.subscriptions.push(create);
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
