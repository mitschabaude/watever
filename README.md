# watever - WebAssembly text bundler

`watever` is a bundler/transpiler for WebAssembly + JavaScript. We make it easy to write modules in **raw Webassembly text format (WAT)** that are consumable across the JavaScript ecosystem.

```sh
npm i watever
```

We aim to solve the many pain points which make raw WAT development cumbersome:

- Statically link multiple WAT modules so that development is not constrained to single files.
  - 💡 We're reusing existing import syntax: `(import "./path/to/other.wat" "helper" (func $helper))` means that code for the `$helper` function gets included in your Wasm. <!-- - Imported WAT files get resolved like node modules, so you can distribute WAT via npm -->
- Treeshake WAT modules to produce lean Wasm bytecode
- Declare JS imports directly from WAT instead of in separate JS loader code <!--  that has to know about the WAT module's requirements -->
- Pass complex values between WAT and JS, like strings, TypedArrays, objects, ...
- Consume async JS functions from WAT

The high-level goal is to **create fully-featured WAT modules without writing any JS glue code**. WAT files should stand on their own. After transpilation, they should act like normal nodes in the JS module graph that produce ESM exports & consume ESM imports.

One of the consequences of going all-in on WAT linking is that we can expose utility functions (e.g., for memory management) as WAT libraries that are _only imported and bundled when needed_, instead of packing them all by default into every Wasm file.

## Usage

One simple way to use `watever` is as a CLI that can be pointed at a `.wat` file and produces something that can be consumed in JS.

```sh
npx watever my-module.wat
```

This produces a JS file `my-module.wat.js` which contains inlined Wasm bytecode and some wrapper code that exposes its exports as ESM exports, so that in another module we simply can `import {functionFromWat} from './my-module.wat.js'`. Currently, **all exported functions are async**. This is because behind the scenes we have to await the promise returned by `WebAssembly.instantiate`. We may change this soon when top-level await is supported widely enough.

The JS glue code in our `.wat.js` is imported from a small library and not generated separately for every WAT module, so the size impact when using multiple WAT modules in one project is relatively small.

In the future, we also want to have plugins for common JS build tools (like webpack) to avoid a separate build step for WAT and enable optimizations like tree-shaking based on what functions are imported from the WAT module.

<!-- - Enables to _statically include_ other `.wat` files with WAT import syntax : `(import "./path/to/other.wat" "helper" (func $helper (param i32)))` -->
