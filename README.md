## What is this for?

With Webpack 5's ModuleFederationPlugin, module federation is easy to implement. Coupling it with a mono-repo is powerful, but if your project uses TypeScript, it's tedious to manually create/maintain ambient type definitions for your packages so TypeScript can resolve the dynamic imports to their proper types. While using @ts-ignore on your imports works, it is a bummer to lose intellisense and type-checking capabilities.

This package exposes a node CLI command called `make-federated-types`. Once installed, you can run that command within a package, and it will write a typings file for your package into you node_modules directory that will be resolved by the TypeScript compiler.

## How is this used?

You'll need to install this module with either NPM or yarn:

```
yarn add @pixability-ui/federated-types
```

You'll also need to place a `federation.config.json` in each package being federated. It will contain the remote name and exported members. These properties are used in Webpack's `ModuleFederationPlugin` configuration object. An example:

#### `federation.config.json`

```json
{
    "name": "app2",
    "exposes": {
        "./Button": "./app2/Button"
    }
}
```

It's recommended that you spread these properties into your ModuleFederationPlugin configuration, like so:

#### `webpack.config.js`

```javascript

const deps = require('../package.json').dependencies;
const federationConfig = require('./federation.config.json');

module.exports = {
    ...

    plugins: [
        new ModuleFederationPlugin({
            ...federationConfig,
            filename: "remoteEntry.js",
            shared: {
                ...deps,
            },
        }),
    ],

    ...
}

```

Then you can call `make-federated-types` from your `scripts` block in your package's `package.json` file:

#### `package.json`

```json
scripts: {
    "make-types": "make-federated-types"
}
```

This will write new package to the `node_modules/@types/__federated_types` in your project. Since TypeScript will resolve typings in the `node_modules/@types` directory by default, you won't have to set up any other resolution or pathing in your tsconfig files to start using your typings.

If you would rather specify a directory in which to write the typing files, you can pass an `--outputDir` parameter to the command like so:

#### `package.json`

```json
scripts: {
    "make-types": "make-federated-types --outputDir ../../my_types/"
}
```

#### `package.json`

If you would like to specify custom path to the config, you can pass `--config` parameter like so:

```json
scripts: {
    "make-types": "make-federated-types --config ./path/to/my/config.json --outputDir ../../my_types/"
}
```
