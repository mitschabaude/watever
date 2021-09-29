# watever - WebAssembly text bundler

watever is a bundler/transpiler for WebAssembly + JavaScript. We make it easy to write modules in **raw WebAssembly text format (WAT)** that are consumable across the JavaScript ecosystem.

```sh
npm i watever
```

The `watever` command bundles your WAT to Wasm bytecode and generates a light-weight JS wrapper:

```sh
npx watever my-wat-module.wat # creates my-wat-module.wat.js
```

We aim to solve all the pain points with raw WAT development:

- Statically link multiple WAT modules
- Treeshake the result to produce lean bytecode
- Declare JS imports directly from WAT (instead of in separate JS loader code)
- Pass complex values between WAT and JS, like strings, TypedArrays, objects, etc
- Consume async JS functions from WAT

The goal is to **create fully-featured WAT modules without writing any JS glue code**. WAT files should stand on their own. After transpilation by watever, they act like nodes in the JS module graph that produce ESM exports & consume ESM imports.

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

The syntax is [spec-compliant WAT](https://webassembly.github.io/spec/core/text/index.html) plus conventions about how import statements are interpreted. In this example, the `(import "js" ...)` convention allows you to import arbitrary JavaScript objects with inline code.

> 💡 If you're not familiar with WAT syntax, we recommend going through [this MDN explainer](https://developer.mozilla.org/en-US/docs/WebAssembly/Understanding_the_text_format) before you continue.

<!-- Here, we import one function from JS and one from a second WAT module. This import syntax convention lies at the core of watever. We also export a function called `myFunction`. -->

Let's throw the file at watever:

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

> 🎮 **Try it yourself:** You can find these code snippets under `/examples`. Clone the repo, transpile with `npx watever examples/*.wat` and run them like `node examples/log-number.js`. To run them with deno, use the `--deno` flag when transpiling: `npx watever examples/*.wat --deno`.

### Hello world

Let's take the last example one step further and make it an actual "hello world" program. To do that, we need to pass a string to `console.log`, which is not something that plain WebAssembly allows. But watever makes it quite easy!

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
  (import "watever/glue.wat" "lift_raw_string" (func $lift_raw_string (param i32 i32) (result i32)))

  (data (i32.const 0) "Hello, world!") ;; string of length 13

  (func $hello_world (export "helloWorld")
    (call $lift_raw_string
      (i32.const 0) ;; pointer to the string in memory
      (i32.const 13) ;; length
    )
    call $log
  )
)
```

There is a bit going on here that requires explanation. First, we added an import which points to `"watever/glue.wat"` and imports a function called `"lift_raw_string"`.
This function is used inside `$hello_world` to put an `i32` value on the stack which will be interpreted as `"Hello, world!"` by the `$log` function.
The import `"watever/glue.wat"` gets resolved like you're used to: to a file inside `node_modules`.

There's nothing special about the `"watever"` library in this regard, you could import from any npm library with the same syntax. Most importantly, you can also import from relative paths to your own WAT files, like `(import "./my-helper.wat" ...)`. All imported WAT is analyzed by watever and the parts that are used are added to the Wasm output. Unused code is eliminated. This is why we call watever a bundler! It enables multi-file WAT development and reusable, shareable code, like any proper programming language.

There is another change we made in the code above, to enable passing a string to JavaScript. We added the instruction `#lift` at the end of the first import: `"console.log#lift"`. This instruction tells watever to wrap `console.log` so that it understands the `i32` returned by `$lift_raw_string` and turns it into a JS string. _Lifting_ is our terminology for taking one or more low-level Wasm types (numbers) that somehow describe a high-level JS type, and transforming them into the actual JS type. In the case of `$lift_raw_string`, a string is described by 1) its starting position in memory and 2) its byte length.

Currently watever supports lifting for integers, floats, booleans, strings, raw bytes arrays (`Uint8Array`), JS arrays, JS objects, functions and opaque external references.

### Passing values, allocating memory

Let's learn some more possibilities. We make another slight change and give our function the following signature:

```js
import { hello } from "./hello-name.wat.js";
let greeting = await hello("Gregor");
console.log(greeting);
// "Hello, Gregor!"
```

This time, WAT's responsibility is not to log anything but to transform a string. We'll have to create the new string in Wasm memory rather than point to an existing location. The code below shows how to do this.

> 🤔 This might also give you an idea about whether writing raw WAT sounds fun to you. It's low-level stuff!

```wat
;; hello-name.wat
(module
  (import "watever/glue.wat" "lift_string" (func $lift_string (param i32) (result i32)))
  (import "watever/memory.wat" "get_length" (func $get_length (param i32) (result i32)))
  (import "watever/memory.wat" "alloc" (func $alloc (param i32) (result i32)))

  (data (i32.const 0) "Hello, !") ;; all the 8 chars we'll need

  (func $hello (export "hello#lift")
    (param $name i32) (result i32)

    (local $greeting_length i32)
    (local $greeting i32)
    (local $i i32)

    ;; get length of input string $name, add 8 to it to calculate length of output string
    (call $get_length (local.get $name))
    (i32.const 8) (i32.add)
    local.set $greeting_length

    ;; allocate memory of the given length, save pointer in local $greeting
    (call $alloc (local.get $greeting_length)))
    local.set $greeting

    ;; write "Hello, " into the new location, byte by byte
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
    (call $lift_string (local.get $greeting))
  )
)
```

We'll focus only on the important parts here. First, look at the function signature:

```wat
(func $hello (export "hello#lift")
  (param $name i32) (result i32)
  ;; ...
```

See what happens here?

- The export statement in the function header now reads `(export "hello#lift")`. This tells watever that the `(result i32)` returned from this function shall be lifted to a JS value. Lifting is always about going **WAT -> JS**, so `#lift` applies to function arguments in an import statement, and to return values in an export statement.

- The string that's passed into `hello("Gregor")` in JS ends up on the WAT side as a `(param $name i32)`. This is a pointer to the memory address containing the string's bytes (UTF8-encoded by `TextEncoder`). The number of bytes allocated to a pointer can be obtained with the `$get_length` helper – this is how we get the length of the input string.

The procedure of transforming a JS string to a WAT number is called _lowering_. Lowering is about going **JS -> WAT**, so it happens either when you pass arguments to a WAT function from JS, or return something from a JS function called by WAT.

> 💡 For lowering, we didn't need an annotation like `#lift`: it happens automatically – just pass normal JS values to your WAT functions. This is possible because lowering leaves JS `number`s and `undefined` untouched, and thus preserves the behaviour of vanilla (unwrapped) Wasm modules. Apart from that, lowering transforms `string`, `TypedArray` and `ArrayBuffer` to pointers into Wasm memory, and passes all other JS objects as an opaque `i32` that represents an external reference (more on that later). <!-- (Internally, the length is just stored in the 4 bytes preceding the pointer.) --> <!-- (This is possible because lowering doesn't change vanilla Wasm modules.)  -->

Another notable part is how we create the new string in Wasm memory:

```wat
  (call $alloc (local.get $greeting_length)))
  local.set $greeting
```

To create a new pointer, we call the `$alloc` function imported from `watever/memory.wat`. It takes a length (number of bytes), allocates memory of that length and returns a pointer.

The bulk of the function consists of copying characters into the memory addresses starting at `$greeting`. At the end, we return this string by lifting it:

```wat
  (call $lift_string (local.get $greeting))
```

This `$lift_string` function is a bit simpler than `$lift_raw_string` in the last example, because this time, `$greeting` is a pointer that has its length encoded, so we don't have to manually supply the length.

 <!-- : we know about data sections at compile time and expose a magic constant which tells you the first memory offset not occupied by them, via `(import "meta" "data_end" (global $data_end i32))`. This is used by `watever/memory.wat` to determine where allocations start -->

**Some notes about memory:**

- You may have wondered whether allocations done by `$alloc` can interfere with `(data ...)` sections. The answer is no, because `watever/memory.wat` knows where the last data section ends, and only allocates at offsets higher than that.

- `$alloc` is also directly used by our JS wrapper when it copies lowered values to Wasm memory (like `$name` above). _All_ pointers created by `$alloc` will be _automatically deallocated_ at the end of each function call into WAT. This means that most of the time, you don't have to think about freeing memory. (In case you do need to keep memory around, there is an escape hatch – see the next example.)

- `$alloc` handles dynamically growing the memory for you.

To enable these conveniences, the module `watever/memory.wat` (which declares and exports a Wasm memory) is imported implicitly in every watever bundle, so that it can be exported and used by our JS wrappers. Because of that, as you may have noticed, none of our previous code examples had to declare memory. The downside is that currently, watever is not compatible with Wasm modules that declare their own memory, e.g. to implement custom garbage collection schemes. We expect that this can be resolved when [multiple memories](https://github.com/WebAssembly/multi-memory/blob/master/proposals/multi-memory/Overview.md) become available.

### Importing JS and handling async

Finally, we will add one more feature to our WAT module and interact with an async JS API. The module will take a github username and respond with the following message, which contains the user's number of published github repos:

```js
import { hello } from "./hello-github-user.wat.js";
let greeting = await hello("mitschabaude");
console.log(greeting);
// "Hello, mitschabaude! I see you have 19 github repositories."
```

To achieve this, we're going to import the following JS module, which can fetch the number of repos from Github's REST API:

```js
// github.js
export async function numberOfRepos(username) {
  let res = await fetch(`https://api.github.com/users/${username}/repos`);
  let json = await res.json();
  return `${json.length}`;
}
```

Here' the WAT in all its glory:

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

This may be too much to digest, so let's focus on the interesting parts: The exported function `$hello_github_user` and the code preceding it. First, we create a `table` containing a single function reference (to `$create_greeting`):

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
- We then call the JS function `$number_of_repos`, which returns a promise. Automatic lowering turns that promise into an `i32` which represents an opaque external reference to the promise in JS land. In the future, this will be Wasm-native behaviour, and use the [`externref` type](https://github.com/WebAssembly/reference-types/blob/master/proposals/reference-types/Overview.md), but this is so useful that watever sort-of polyfills it.
- We then call another helper, `$then` from `watever/promises.wat`. This is where we pass our promise and the table index `0` to chain another WAT function to the promise.
- We get another promise (again, opaque) and return it.

In the callback `$create_greeting`, the main thing of interest is that we use `$free` to remove the lock on the `$username` pointer that was created by `$keep`. This just means it gets deallocated like all other pointers at the end of the function call.

### Under the hood

To get a glimpse at how all this works, let's look at the autogenerated JS file from our last example.
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
- As you can see, our `(import "./github.js" "numberOfRepos" ...)` is converted into a JS import statement and `numberOfRepos` is passed to `wrap()` (which will pass it to `WebAssembly.instantiate`), together with other JS imports. On the other hand, imported WAT got bundled directly into the Wasm bytecode.
- Wasm bytecode is inlined as a base64 string. I think this is a far better default than fetching a `.wasm` file, for the same reason that we bundle JS modules by default: because, when deployed on the web, it saves a roundtrip to the server that is only initiated after the importing file has loaded. Code-splitting is a good thing, but should be applied with purpose and not as a random by-product of using Wasm in JS.

## FAQ

### How am I supposed to integrate this into my project?

You can use JS produced by the watever CLI directly in node (as ES module) or deno. To use it on the web, you'll need a second build step _after_ watever that performs JS bundling, like webpack.

In the future, I plan to create plugins to integrate watever in popular JS build pipelines, to only have one build step. This will also enable optimizations like tree-shaking WAT modules based on what is imported from them on the JS side. In fact, this project originated from [esbuild-plugin-wat](https://github.com/mitschabaude/esbuild-plugin-wat) which quickly got out of hand as I wanted to add more and more features 😅

## TODOs

- create comprehensive API docs of `watever/*.wat` modules
- watch mode for the CLI
- enable post-MVP syntax that's still missing from @webassemblyjs
- merge together start sections from imported modules
<!-- - deno integration: enable importing `.wat` from URL? -->

<!-- FAQ material: -->

<!-- When developing modules with WAT, you'll probably find that you use `#lift` on most exported functions. So why don't we just make this the default behaviour? The reason is that `#lift` implies that you cannot just pass a normal integer to JS as an `i32` any more (you'd need another helper from `watever/glue.wat` for that, `"lift_int"`). In other words, automatic lifting would break plain WAT code that knows nothing about lifting. However, watever wants to be a general-purpose tool applicable across the WebAssembly ecosystem. It should be usable to turn _any_ WAT or Wasm file into a JS module. Therefore, the default behaviour must be to leave `i32` untransformed. -->

<!--  Should the memory become too large after a function call (> 10MB), we delete the Wasm instance to allow it to be garbage collected, and cheaply reinstantiate it on the next call. This (sadly) is the only way to avoid potential memory leaks in Wasm. -->
