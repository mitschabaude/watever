# watever - WebAssembly text bundler

`watever` is a bundler/transpiler for WebAssembly + JavaScript. We make it easy to write modules in **raw Webassembly text format (WAT)** that are consumable across the JavaScript ecosystem.

```sh
npm i watever
```

We aim to solve the many pain points which make raw WAT development cumbersome:

- Statically link multiple WAT modules<!--  so that development is not constrained to single files. -->
  - 💡 We're reusing existing import syntax: `(import "./path/to/other.wat" "helper" (func $helper))` means that code for the `$helper` function gets included in your Wasm. <!-- - Imported WAT files get resolved like node modules, so you can distribute WAT via npm -->
- Treeshake the result to produce lean bytecode
- Declare JS imports directly from WAT (instead of in separate JS loader code)
- Pass complex values between WAT and JS, like strings, TypedArrays, objects, ...
- Consume async JS functions from WAT

The high-level goal is to **create fully-featured WAT modules without writing any JS glue code**. WAT files should stand on their own. After transpilation by `watever`, they act like normal nodes in the JS module graph that produce ESM exports & consume ESM imports.

<!-- One of the consequences of going all-in on WAT linking is that we can expose utility functions (e.g., for memory management) as WAT libraries that are _only imported and bundled when needed_, instead of packing them all by default into every Wasm file. -->

## Usage

Let's say we have a WAT module:

```wat
;; my-module.wat
(module
  (export "myFunction" (func $my_function))

  (func $my_function (param i32) (result i32)
    ;; ... code ...
  )
)
```

Pointing the `watever` CLI at our `.wat` file will produce something that can be consumed in JavaScript:

```sh
npx watever my-module.wat
```

This creates a JS file `my-module.wat.js` which contains the inlined Wasm bytecode plus some wrapper code. It exposes WAT exports as ESM exports, so that in another module we can simply do the following:

```js
import { myFunction } from "./my-module.wat.js";

let result = await myFunction(5);
```

Currently, **all exported functions are async**. This is because behind the scenes we have to await the promise returned by `WebAssembly.instantiate`. We may change this soon when top-level await is supported widely enough.

The `.wat.js` file will look something like this:

<!-- prettier-ignore -->
```js
import {wrap} from 'watever/wrap.js';
let wasm = "AGFzbQEAAAABGAVgAn9/AGAAAGAB..."; // Wasm bytecode (base64-encoded)
let {myFunction} = wrap(wasm, ["myFunction" /* exports */], { /* imports */ });
export {myFunction};
```

Note that the JS glue code contained in the `wrap()` function is imported from our library rather than inlined, so its size impact when using multiple WAT modules in one project stays small (~1.5 kB minzipped).

In the future, we also want to have plugins for common JS build tools (like webpack) to avoid a separate build step for WAT and enable optimizations like tree-shaking based on what functions are imported from the WAT module.
