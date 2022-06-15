#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const os = require("os");
const ts = require('typescript');

const getArg = (argName) => {
    const argIndex = process.argv.indexOf(argName);
    return argIndex !== -1 ? process.argv[argIndex + 1] : null;
};

const outDirArg = getArg('--outputDir');
const outputDir = outDirArg
    ? path.resolve('./', outDirArg)
    : path.resolve(__dirname, '../../@types/__federated_types/');

const configPathArg = getArg('--config');
const configPath = configPathArg
    ? path.resolve(configPathArg)
    : null;

const findFederationConfig = (base) => {
    let files = fs.readdirSync(base);
    let queue = [];

    for( let i = 0; i < files.length; i++ ) {
        const file = files[i];
        const newBase = path.join(base, file);
        if (file === 'federation.config.json') {
            return path.resolve('./', newBase);
        } else if(fs.statSync(newBase).isDirectory() && !newBase.includes('node_modules')) {
            queue.push(newBase);
        }
    }

    for( let i = 0; i < queue.length; i++ ) {
        return findFederationConfig(queue[i]);
    }
};

if (configPath && !fs.existsSync(configPath)) {
    console.error(`ERROR: Unable to find a provided config: ${configPath}`);
    process.exit(1);
}

const federationConfigPath = configPath || findFederationConfig('./');


if (federationConfigPath === undefined) {
    console.error(`ERROR: Unable to find a federation.config.json file in this package`);
    process.exit(1);
}

console.log(`Using config file: ${federationConfigPath}`);

const federationConfig = require(federationConfigPath);
const compileFiles = Object.values(federationConfig.exposes);
const compileKeys = Object.keys(federationConfig.exposes);
const outFile = path.resolve(outputDir, `${federationConfig.name}.d.ts`);

try {
    if (fs.existsSync(outFile)) {
        fs.unlinkSync(outFile);
    }

    // write the typings file
    const program = ts.createProgram(compileFiles, {
        outFile,
        declaration: true,
        emitDeclarationOnly: true,
        skipLibCheck: true,
        jsx: 'react',
        esModuleInterop: true,
    });

    const emitResult = program.emit();

    // if errors have been detected, log them to the console
    if (emitResult && emitResult.diagnostics) {
        emitResult.diagnostics.forEach(diagnostic => {
            console.error(`Error in file: ${diagnostic.file.fileName}:`);
            console.error(diagnostic.messageText);
            console.error();
      })
    }

    let typing = fs.readFileSync(outFile, { encoding: 'utf8', flag: 'r' });

    const moduleRegex = RegExp(/declare module "(.*)"/, 'g');
    const moduleNames = [];

    while ((execResults = moduleRegex.exec(typing)) !== null) {
        moduleNames.push(execResults[1]);
    }

    moduleNames.forEach((name) => {
        // exposeName - relative name of exposed component (if not found - just take moduleName)
        const exposeName = compileKeys.find(key => federationConfig.exposes[key].endsWith(name)) || name;
        const regex = RegExp(`"${name}"`, 'g');
        const moduleDeclareName = path.join(federationConfig.name, exposeName).replace(/[\\/]/g, '/');
        typing = typing.replace(regex, `"${moduleDeclareName}"`);
    });

    console.log('writing typing file:', outFile);

    fs.writeFileSync(outFile, typing);

    // if we are writing to the node_modules/@types directory, add a package.json file
    if (outputDir.includes( os.platform() === "win32"
                ? "node_modules\\@types"
                : "node_modules/@types")) {
        const packageJsonPath = path.resolve(outputDir, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            console.log('writing package.json:', packageJsonPath);
            fs.copyFileSync(path.resolve(__dirname, 'typings.package.tmpl.json'), packageJsonPath);
        } else {
            console.log(packageJsonPath, 'already exists');
        }
    } else {
        console.log('not writing to node modules, dont need a package.json');
    }

    // write/update the index.d.ts file
    const indexPath = path.resolve(outputDir, 'index.d.ts');
    const importStatement = `export * from './${federationConfig.name}';`;

    if (!fs.existsSync(indexPath)) {
        console.log('creating index.d.ts file');
        fs.writeFileSync(indexPath, `${importStatement}\n`);
    } else {
        console.log('updating index.d.ts file');
        const contents = fs.readFileSync(indexPath);
        if (!contents.includes(importStatement)) {
            fs.writeFileSync(indexPath, `${contents}${importStatement}\n`);
        }
    }

    console.log('Success!');
} catch (e) {
    console.error(`ERROR:`, e);
    process.exit(1);
}
