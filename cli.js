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

const findFederationConfigs = (base, files, result) => {
    files = files || fs.readdirSync(base);
    result = result || [];

    files.forEach((file) => {
        const newBase = path.join(base, file);
        if (fs.statSync(newBase).isDirectory()) {
            result = findFederationConfigs(newBase, fs.readdirSync(newBase), result);
        } else {
            if (file === 'federation.config.json') {
                result.push(require(path.resolve('./', newBase)));
            }
        }
    });

    return result;
};

const configs = findFederationConfigs('./');

if (configs.length !== 1) {
    console.error(`ERROR: Found ${configs.length} federation configs`);
    process.exit(1);
}

const federationConfig = configs[0];
const compileFiles = Object.values(federationConfig.exposes);
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

    program.emit();

    let typing = fs.readFileSync(outFile, { encoding: 'utf8', flag: 'r' });

    const moduleRegex = RegExp(/declare module "(.*)"/, 'g');
    const moduleNames = [];

    while ((execResults = moduleRegex.exec(typing)) !== null) {
        moduleNames.push(execResults[1]);
    }

    moduleNames.forEach((name) => {
        const regex = RegExp(`"${name}`, 'g');
        typing = typing.replace(regex, `"${federationConfig.name}/${name}`);
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
