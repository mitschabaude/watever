# watever - WebAssembly text bundler

`watever` is a bundler/transpiler for WebAssembly + JavaScript. We make it easy to write modules in **raw WebAssembly text format (WAT)** that are consumable across the JavaScript ecosystem.

```sh
npm i watever
```

The `watever` command bundles your WAT to Wasm bytecode and generates a light-weight JS wrapper file:

```sh
npx watever my-wat-module.wat # creates my-wat-module.wat.js
```

We aim to solve all the pain points which make raw WAT development cumbersome:

- Statically link multiple WAT modules
- Declare JS imports directly from WAT (instead of in separate JS loader code)
- Pass complex values between WAT and JS, like strings, TypedArrays, objects, etc
- Consume async JS functions from WAT
<!-- - Treeshake the result to produce lean bytecode -->

The high-level goal is to **create fully-featured WAT modules without writing any JS glue code**. WAT files should stand on their own. After transpilation by `watever`, they act like normal nodes in the JS module graph that produce ESM exports & consume ESM imports.

<!-- One of the consequences of going all-in on WAT linking is that we can expose utility functions (e.g., for memory management) as WAT libraries that are _only imported and bundled when needed_, instead of packing them all by default into every Wasm file. -->

## Getting started

Let's say we have a simple WAT module, which exports a function that logs a number:

```wat
;; log-number.wat
(module
  (import "js" "console.log" (func $log (param f64)))

  (func $log_number (export "logNumber")
    (call $log (f64.const 3.14159265))
  )
)
```

The syntax here is [spec-compliant WAT syntax](https://developer.mozilla.org/en-US/docs/WebAssembly/Understanding_the_text_format), plus some conventions about how import statements are interpreted. In this example, the `(import "js" "...")` convention allows you to import arbitrary JavaScript objects with inline code.

<!-- Here, we import one function from JS and one from a second WAT module. This import syntax convention lies at the core of `watever`. We also export a function called `myFunction`. -->

Let's throw this file at `watever`:

```sh
npx watever log-number.wat
```

This creates a JS file `log-number.wat.js` which exposes our exported `logNumber()` as a named JS export, so we can use it like a normal JS module:

```js
import { logNumber } from "./log-number.wat.js";
await logNumber();
// "3.14159265"
```

The only gotcha here is that our function has become **async**. That's because behind the scenes we have to unwrap the Promise returned by `WebAssembly.instantiate`. (We might change this behaviour when top-level await is supported widely enough.)

### Hello world

Let's take this example one step further and make it an actual "hello world" program. To do that, we need to pass a string to `console.log`, which is not something that plain WebAssembly allows. But `watever` makes this quite easy!

First, here's how we will use it from JavaScript:

```js
import { helloWorld } from "./hello-world.wat.js";
await helloWorld();
// "Hello, world!"
```

And here's the code to make that happen:

```wat
;; hello-world.wat
(module
  (import "js" "console.log#lift" (func $log (param i32)))
  (import "watever/glue.wat" "lift_string" (func $lift_string (param i32 i32) (result i32)))

  (data (i32.const 0) "Hello, world!") ;; string of length 13

  (func $hello_world (export "helloWorld")
    (call $lift_string
      (i32.const 0) ;; pointer to the string in memory
      (i32.const 13) ;; length
    )
    call $log
  )
)
```

There is a bit going on here that requires explanation. First, we added an import which points to `"watever/glue.wat"` and imports a function called `"lift_string"`.
This function is then used inside `$hello_world` to put an `i32` value on the stack which will be interpreted as `"Hello, world!"` by the `$log` function.
The import `"watever/glue.wat"` gets resolved like you're used to: to a file inside `node_modules`.

There's nothing special about the `"watever"` library in this regard, you could import from any npm-installed library with the same syntax. Most importantly, you can also import from _relative_ paths to your own WAT files, like `(import "./my-helper.wat" ...)`. All imported WAT is analyzed by `watever` and the parts that are used are added to the Wasm output. (Unused code is eliminated.) This is why we call `watever` a bundler! It enables multi-file development and reusable, shareable code, like any proper programming language. Oh, and by the way: You can also import JS functions from `.js` files!

There is another change we made in the code above, to enable passing a string to JavaScript. We added the instruction `#lift` at the end of the first import: `"console.log#lift"`. This instruction tells `watever` to wrap `console.log` so that it understands the `i32` returned by `$lift_string` and turns it into a JS string. _Lifting_ is our terminology for taking one or more low-level Wasm types (numbers) that somehow describe a high-level JS type, and transforming them into the actual JS type. In this case, a string is described by 1) its starting position in memory and 2) its byte length. These two numbers are given to `$lift_string` which creates a single `i32` that encodes the whole string.

Currently `watever` supports lifting for integers, floats, booleans, strings, raw bytes arrays (`Uint8Array`), JS arrays, JS objects, functions and opaque external references. This is enough for doing quite complex stuff like calling an async JS function, passing another WAT function as `.then` callback and returning the resulting promise to JS.

<!-- When developing modules with WAT, you'll probably find that you use `#lift` on most exported functions. So why don't we just make this the default behaviour? The reason is that `#lift` implies that you cannot just pass a normal integer to JS as an `i32` any more (you'd need another helper from `watever/glue.wat` for that, `"lift_int"`). In other words, automatic lifting would break plain WAT code that knows nothing about lifting. However, `watever` wants to be a general-purpose tool applicable across the WebAssembly ecosystem. It should be usable to turn _any_ WAT or Wasm file into a JS module. Therefore, the default behaviour must be to leave `i32` untransformed. -->

### Passing values, allocating memory

Let's learn some more possibilities. We make another slight change and give our function the following signature:

```js
import { hello } from "./hello.wat.js";
let greeting = await hello("Gregor");
console.log(greeting);
// "Hello, Gregor!"
```

This time, WAT's responsibility is not to log anything but to transform a string. It will have to create the new string in its memory rather than point to an existing location. The code below shows how to do this. It might also give you an idea about whether writing raw WAT is for you. It's low-level stuff!

```wat
;; hello.wat
(module
  (import "watever/glue.wat" "lift_string" (func $lift_string (param i32 i32) (result i32)))
  (import "watever/memory.wat" "get_length" (func $get_length (param i32) (result i32)))
  (import "watever/memory.wat" "alloc" (func $alloc (param i32) (result i32)))

  (data (i32.const 0) "Hello, !") ;; all the 8 chars we'll need

  (func $hello (export "hello#lift")
    (param $name i32) (result i32)

    (local $name_length i32)
    (local $greeting i32)
    (local $i i32)

    ;; get length of input string $name, save it in a local
    (call $get_length (local.get $name))
    local.set $name_length

    ;; allocate new string of length (8 + $name_length), save pointer in a local
    (call $alloc (i32.add (i32.const 8) (local.get $name_length)))
    local.set $greeting

    ;; write "Hello, " into the new location, byte... by... byte
    (i32.store8 offset=0 (local.get $greeting) (i32.load8_u offset=0 (i32.const 0))) ;; "H"
    (i32.store8 offset=1 (local.get $greeting) (i32.load8_u offset=1 (i32.const 0))) ;; "e"
    (i32.store8 offset=2 (local.get $greeting) (i32.load8_u offset=2 (i32.const 0))) ;; "l"
    (i32.store8 offset=3 (local.get $greeting) (i32.load8_u offset=3 (i32.const 0))) ;; "l"
    (i32.store8 offset=4 (local.get $greeting) (i32.load8_u offset=4 (i32.const 0))) ;; "o"
    (i32.store8 offset=5 (local.get $greeting) (i32.load8_u offset=5 (i32.const 0))) ;; ","
    (i32.store8 offset=6 (local.get $greeting) (i32.load8_u offset=6 (i32.const 0))) ;; " "

    ;; write $name into the new location, by looping over its bytes
    (local.set $i (i32.const 0))
    loop
      (i32.store8 offset=7
        (i32.add (local.get $greeting) (local.get $i))
        (i32.load8_u
          (i32.add (local.get $name) (local.get $i))
        )
      )
      (br_if 0 (i32.ne (local.get $name_length)
        (local.tee $i (i32.add (local.get $i) (i32.const 1)))
      ))
    end

    ;; write the final "!"
    (i32.store8 offset=7
      (i32.add (local.get $greeting) (local.get $i))
      (i32.load8_u offset=7 (i32.const 0))
    )

    ;; return the new string
    (call $lift_string
      (local.get $greeting) ;; pointer to the string in memory
      (i32.add (i32.const 8) (local.get $name_length)) ;; length
    )
  )
)
```

Apart from the fact that there's more logic involved, three new things are notable here:

- The export statement in the function header now reads `(export "hello#lift")`. This tells `watever` that what is returned from this function shall be lifted to a JS value (note that `#lift` applies to function _output_ in an export statement but to function _input_ in an import statement). At the end of the `$hello` function, we use `$lift_string` again to put a return value on the stack.

- The string that's passed to `hello(...)` in JS ends up on the WAT side as an `i32` called `$name`. This is a pointer to the memory location containing the strings raw bytes (UTF-8, produced by `TextEncoder`). The string's length is internally stored in the 4 bytes _preceding_ the pointer and can be obtained with the `$get_length` helper. This procedure of transforming a JS string to a WAT number is called _lowering_, the counterpart to lifting. In contrast to lifting, lowering happens automatically, without an annotation. (This is possible because lowering doesn't change vanilla Wasm modules.) It happens either when you pass parameters to a WAT function from JS, or return something from a JS function called by WAT. Lowering leaves JS `number`s and `undefined` untouched, transforms `TypedArray` and `ArrayBuffer` to pointers like for `string`, and transforms all other JS objects to opaque references (currently `i32`, will be `externref` when [reference types](https://github.com/WebAssembly/reference-types/blob/master/proposals/reference-types/Overview.md) are widely supported).

- To create a new string, we call the `$alloc` function from `watever/memory.wat`. It takes a length, allocates memory of that length (number of bytes) and returns a pointer. <!-- : we know about data sections at compile time and expose a magic constant which tells you the first memory offset not occupied by them, via `(import "meta" "data_end" (global $data_end i32))`. This is used by `watever/memory.wat` to determine where allocations start -->

**Some notes about memory:**

Allocations will not interfere with `(data ...)` sections, because `watever/memory.wat` knows about the end of all data sections at compile time and only allocates at offsets higher than that. `$alloc` is also used by our JS wrapper, when it copies lowered values (like the `$name` string above) to Wasm memory. All pointers created by `$alloc` will be _automatically reset_ at the end of each function call into WAT. This means most of the time, you don't have to think about freeing memory yourself. (In case you do need to keep memory around, there is an escape hatch – see the next section.)

To enable these conveniences, the module `watever/memory.wat` (which declares and exports a Wasm memory) is imported implicitly in every `watever` bundle, so that it can be exported and used by our JS wrappers. Because of that, as you may have noticed, none of our previous code examples had to declare memory. The downside is that currently, `watever` is not compatible with Wasm modules that declare their own memory, e.g. to implement custom garbage collection schemes. We expect that this can be resolved when [multiple memories](https://github.com/WebAssembly/multi-memory/blob/master/proposals/multi-memory/Overview.md) become available.

### Importing JS and handling async

Finally, we will add one more feature to our WAT module and interact with an async JS API. The module will take a github username and respond with the following message, which contains the user's number of github repositories:

```js
import { hello } from "./hello-github-user.wat.js";
let greeting = await hello("mitschabaude");
console.log(greeting);
// "Hello, mitschabaude! I see you have 19 github repositories."
```

To achieve this, assume we have the following JS module which fetches the number of repositories from the Github REST API:

```js
// github.js
export async function numberOfRepos(username) {
  let res = await fetch(`https://api.github.com/users/${username}/repos`);
  let json = await res.json();
  return json.length + "";
}
```

The WAT looks like this:

```wat
;; hello-github-user.wat
(module
  (import "./github.js" "numberOfRepos#lift" (func $number_of_repos (param i32) (result i32)))

  (import "watever/glue.wat" "lift_string" (func $lift_string (param i32) (result i32)))
  (import "watever/glue.wat" "lift_extern" (func $lift_extern (param i32) (result i32)))
  (import "watever/memory.wat" "get_length" (func $get_length (param i32) (result i32)))
  (import "watever/memory.wat" "alloc" (func $alloc (param i32) (result i32)))
  (import "watever/memory.wat" "keep" (func $keep (param i32)))
  (import "watever/memory.wat" "free" (func $free (param i32)))
  (import "watever/promise.wat" "then" (func $then (param i32 i32) (result i32)))

  (data (i32.const 0) "Hello, ! I see you have  github repositories.")

  (table 1 funcref)
  (export "table" (table 0))
  (elem (i32.const 0) $create_greeting)

  (global $username (mut i32) (i32.const 0))

  (func $hello_github_user (export "hello#lift")
    (param $username i32) (result i32)
    (local $promise i32)

    ;; store the $username pointer as a global and use $keep to keep it in memory
    (global.set $username (local.get $username))
    (call $keep (local.get $username))

    ;; call the async JS function, with the $username as argument
    (call $number_of_repos (call $lift_string (local.get $username)))
    local.set $promise

    ;; chain the function at table index 0 after the $promise
    (call $then
      (local.get $promise)
      (i32.const 0)
    )
    ;; this produces a new promise which we take from the stack...
    local.set $promise

    ;; ...and return (and tell JS to read it as an external reference)
    (call $lift_extern (local.get $promise))
  )

  (func $create_greeting
    (param $reponumber i32) (result i32)
    (local $greeting i32)

    ;; put length of new string on stack
    (call $get_length (global.get $username))
    (call $get_length (local.get $reponumber))
    i32.const 45
    (i32.add) (i32.add)

    ;; allocate new string $greeting
    call $alloc
    local.set $greeting

    ;; copy string fragments into $greeting
    local.get $greeting
    i32.const 0 i32.const 7
    call $copy_string ;; "Hello, "
    global.get $username (call $get_length (global.get $username))
    call $copy_string ;; ${username}
    i32.const 7 i32.const 17
    call $copy_string ;; "! I see you have "
    local.get $reponumber (call $get_length (local.get $reponumber))
    call $copy_string ;; ${repos}
    i32.const 24 i32.const 21
    call $copy_string ;; " github repositories."
    drop

    ;; free the string kept in memory before
    (call $free (global.get $username))

    ;; return the new, combined string
    (call $lift_string (local.get $greeting))
  )

  (func $copy_string
    (param $target i32) (param $source i32) (param $length i32)
    (result i32)
    (local $i i32)
    (local.set $i (i32.const 0))
    loop
      (i32.store8
        (i32.add (local.get $target) (local.get $i))
        (i32.load8_u (i32.add (local.get $source) (local.get $i)))
      )
      (br_if 0 (i32.ne (local.get $length)
        (local.tee $i (i32.add (local.get $i) (i32.const 1)))
      ))
    end
    (i32.add (local.get $target) (local.get $i))
  )
)
```

This may be too much to digest, so let's focus on the most interesting parts: The exported function `$hello_github_user` and the code preceding it. First, we create a `table` containing a single function reference (to `$create_greeting`):

```wat
(table 1 funcref)
(export "table" (table 0))
(elem (i32.const 0) $create_greeting)
```

The idea is this: To handle a promise, we basically do `.then(callback)` where the callback is another Wasm function.
However, because function references are not (yet) first-class values, we actually have to pass the callback as a _table index_. Behind the scenes, the JS wrapper will then assume that our module exports a table called "table", and get the callback with

```js
let callback = instance.exports.table.get(index);
```

This is admittedly a bit messy. But it will soon get very nice, when [reference types](https://github.com/WebAssembly/reference-types/blob/master/proposals/reference-types/Overview.md) land, because then we'll just create the function reference from the function directly (no table needed).

To see WAT handling promises in action, check out the code of `$hello_github_user`. A couple of things to note:

- We import the JS function with `(import "./github.js" "numberOfRepos" ...)`, another twist on import syntax convention.
- At the beginning in `$hello_github_user`, we make sure that we can access the input `$username` later, when the JS promise resolves. For that, we store the pointer in a mutable global. We also invoke `$keep` from `watever/memory.wat`, which causes the pointer to stay alive even after this function returns.
- We then call the JS function `$number_of_repos`, which returns a promise. Automatic lowering turns that promise into an `i32` which represents an opaque external reference to the promise in JS land. In the future, this will be Wasm-native behaviour, and use the [`externref` type](https://github.com/WebAssembly/reference-types/blob/master/proposals/reference-types/Overview.md), but this is so useful that `watever` sort-of polyfills it.
- We then call another helper, `$then` from `watever/promises.wat`. This is where we pass our promise and the table index `0` to chain another WAT function to the promise.
- We get another promise (again, opaque) and return it.

In the callback `$create_greeting`, the main thing of interest is that we use `$free` to remove the lock on the `$username` pointer that was created by `$keep`. This just means it gets deallocated like all other pointers at the end of the function call.

### Under the hood

To understand even better how all this works, let's look at the autogenerated JS file from our last example.
I added comments and formatting for clarity.

<!-- prettier-ignore -->
```js
// hello-github-user.wat.js
import { wrap } from "watever/wrap.js";
import { numberOfRepos } from "./github.js";
import { addLock, removeLock } from "watever/wrap.js";

// Wasm bytecode (base64)
let wasm = "AGFzbQEAAAABGgVgAX8Bf2ACf38Bf2AAAGABfwBgA...";

let { table, hello, memory, alloc, reset } = wrap(
  wasm,
  // exports:
  ["table", "hello#lift", "memory", "alloc", "reset"],
  // imports:
  {
    "./github.js": { "numberOfRepos#lift": numberOfRepos },
    "watever/wrap.js": { "addLock": addLock, "removeLock": removeLock },
    "js": { "(p, c) => p.then(x => c(x))#lift": "(p, c) => p.then(x => c(x))" },
  }
);

export { table, hello, memory, alloc, reset };
```

Some remarks:

- All JS wrapper code is contained in the `wrap()` function that is imported from `watever`, so its size impact when using multiple WAT modules in one project stays small (~1.6 kB minzipped).
- As you can see, our JS import of `"./github.js"` is converted into an actual import statement and `numberOfRepos` is passed to `wrap()` (which will pass it to `WebAssembly.instantiate`), together with other JS imports. On the other hand, imported WAT code got bundled directly into the Wasm bytecode.
- Wasm bytecode is inlined as a base64 string. We think this approach is a far better default than fetching a `.wasm` file, for the same reason that we bundle JS modules by default: because it saves a roundtrip to the server (that is only initiated after the importing file has loaded). Code-splitting can be a good thing, but should be applied with purpose and not as a random byproduct of using Wasm and JS together.

Currently, you can use the `watever` CLI as a build step that comes _before_ JS bundling.

In the future, we plan to create plugins for popular build tools like webpack, to avoid a separate build step for WAT. This will also enable optimizations like tree-shaking WAT modules based on what is imported from them on the JS side.

## TODOs

- create comprehensive API docs of `watever/*.wat` modules
- watch mode for the CLI
- enable post-MVP syntax that's still missing from @webassemblyjs
- merge together start sections from imported modules
