(module
  (import "js" "console.log#lift" (func $log (param i32)))
  (import "js" "(p, c) => p.then(c)#lift" (func $then (param i32 i32) (result i32)))

  (import "./inner-imports.js" "promise#lift" (func $promise (param i32) (result i32)))
  (import "../src/glue.wat" "get_length" (func $get_length (param i32) (result i32)))
  (import "../src/glue.wat" "lift_extern" (func $lift_extern (param i32) (result i32)))
  (import "../src/glue.wat" "lift_function" (func $lift_function (param i32) (result i32)))
  (import "../src/glue.wat" "lift_string" (func $lift_string (param i32 i32) (result i32)))
  ;; (import "../src/table.wat" "table" (table 1 funcref))

  (export "table" (table 0))
  (export "asyncCall#lift" (func $async_call))

  ;; TODO can't import table due to bug in @webassemblyjs/decoder > parseImportSection
  ;; imported tables are not added to internal bookkeeping & referencing them causes an error
  ;; + have to implement importing tables in bundle-wasm
  (table 1 funcref)
  (elem (i32.const 0) $callback)

  (data (i32.const 0) "YEAH!")

  ;; TODO instead of passing a callback to $promise, it would be cleaner to pass
  ;; the promise and the callback to a generic $then function
  (func $async_call
    (result i32)
    (call $lift_function (i32.const 0))
    call $promise
    call $lift_extern
  )

  (func $callback (param $pointer i32) (result i32)
    (call $lift_string (local.get $pointer) (call $get_length (local.get $pointer)))
    call $log
    (call $lift_string (i32.const 0) (i32.const 5))
  )
)