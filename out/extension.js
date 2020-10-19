"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require('path');
const fs = require('fs');
class FSNameInputOptions {
    constructor(prompt) {
        this.prompt = prompt;
    }
    validateInput(value) {
        if (value.match(/^[a-zA-Z](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?\.?[a-zA-Z0-9_-]+$/g)) {
            return undefined;
        }
        return value;
    }
}
function callCodeGen(args, cwd) {
    let task = new vscode.Task({
        type: 'BAType'
    }, vscode.TaskScope.Workspace, 'Build', 'Bright Ascension CodeGen', new vscode.ShellExecution('codegen', args.concat(['-v']), { cwd: cwd }), undefined);
    vscode.tasks.executeTask(task);
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Bright Ascension CodeGen extension activated!');
    let ba_config = vscode.workspace.getConfiguration('brightascension');
    let gen1_root = ba_config.get('gen1_root');
    if (gen1_root === undefined) {
        vscode.window.showErrorMessage('Bright Ascension CodeGen activation error: please set Gen1 FSDK root in VS Code settings!');
        return;
    }
    let obsw_root = path.join(gen1_root, 'OBSW/Source');
    console.log('Gen1 FSDK root: ' + gen1_root);
    console.log('Gen1 FSDK OBSW: ' + obsw_root);
    let gen1_configs = fs.readdirSync(path.join(obsw_root, 'build_system/config'));
    gen1_configs = gen1_configs.map(fileMK => fileMK.replace('.mk', ''));
    console.log('Available configs: ' + gen1_configs.join(', '));
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let newDeployment = vscode.commands.registerCommand('brightascension.newDeployment', (uri) => {
        vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new deployment"))
            .then((deplName) => {
            if (deplName == undefined) {
                return;
            }
            console.log('User entered: ' + deplName);
            deplName = deplName.trim();
            callCodeGen(['deplyment', 'new', './' + deplName], uri.fsPath);
        });
    });
    let newLibrary = vscode.commands.registerCommand('brightascension.newLibrary', (uri) => {
        vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new library"))
            .then((libName) => {
            if (libName == undefined) {
                return;
            }
            console.log('User entered: ' + libName);
            libName = libName.trim();
            callCodeGen(['library', 'new', './' + libName, '-n', libName], uri.fsPath);
        });
    });
    let newComponentType = vscode.commands.registerCommand('brightascension.newComponentType', (uri) => {
        vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new component type"))
            .then((cTypeName) => {
            if (cTypeName == undefined) {
                return;
            }
            console.log('User entered: ' + cTypeName);
            cTypeName = cTypeName.trim();
            callCodeGen(['componenttype', 'new', '.', '-n', cTypeName], uri.fsPath);
        });
    });
    let newService = vscode.commands.registerCommand('brightascension.newService', (uri) => {
        vscode.window.showInputBox(new FSNameInputOptions("Enter a name for the new service"))
            .then((serviceName) => {
            if (serviceName == undefined) {
                return;
            }
            console.log('User entered: ' + serviceName);
            serviceName = serviceName.trim();
            callCodeGen(['service', 'new', '.', '-n', serviceName], uri.fsPath);
        });
    });
    let generateDeployment = vscode.commands.registerCommand('brightascension.generateDeployment', (uri) => {
        vscode.window.showQuickPick([
            {
                label: "--remove-unused",
                detail: "Remove any files that are not part of the generated resource tree"
            },
            {
                label: "--short-prefixes",
                detail: "Generates short prefixes for component instance names"
            }
        ], { matchOnDescription: true, canPickMany: true })
            .then((flags) => {
            if (flags == undefined) {
                return;
            }
            let genARGS = ['deployment', 'generate', '.'];
            flags.forEach(flag => genARGS.push(flag.label));
            console.log('Deployment generate args: ' + genARGS.join(' '));
            callCodeGen(genARGS, uri.fsPath.replace('/deployment.xml', ''));
        });
    });
    let generateComponentType = vscode.commands.registerCommand('brightascension.generateComponentType', (uri) => {
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
            }
        ], { matchOnDescription: true, canPickMany: true })
            .then((flags) => {
            if (flags == undefined) {
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
    let generateService = vscode.commands.registerCommand('brightascension.generateService', (uri) => {
        vscode.window.showQuickPick([
            {
                label: "--unit-tests",
                description: "Generates unit tests"
            }
        ], { matchOnDescription: true, canPickMany: true })
            .then((flags) => {
            if (flags == undefined) {
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
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
    console.log("Birght Ascension CodeGen extension deactivated!");
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map