(module
  (import "js" "console.log#lift" (func $log (param i32)))

  (import "./inner-imports.js" "asyncFunction#lift" (func $async_function (result i32)))
  (import "../src/glue.wat" "get_length" (func $get_length (param i32) (result i32)))
  (import "../src/glue.wat" "lift_extern" (func $lift_extern (param i32) (result i32)))
  (import "../src/glue.wat" "lift_function" (func $lift_function (param i32) (result i32)))
  (import "../src/glue.wat" "lift_string" (func $lift_string (param i32 i32) (result i32)))
  (import "../src/promise.wat" "then_lift" (func $then_lift (param i32 i32) (result i32)))
  ;; (import "../src/table.wat" "table" (table 1 funcref))

  (export "table" (table 0))
  (export "asyncCall#lift" (func $async_call))

  ;; TODO can't import table due to bug in @webassemblyjs/decoder > parseImportSection
  ;; imported tables are not added to internal bookkeeping & referencing them causes an error
  ;; + have to implement importing tables in bundle-wasm
  (table 1 funcref)
  (elem (i32.const 0) $then_handler)

  (data (i32.const 0) "returned from async WAT :)") ;; length 26

  (func $async_call
    (result i32)
    call $async_function ;; returns a promise
    i32.const 0 ;; index of our $then_handler in the table
    call $then_lift
  )

  (func $then_handler (param $string i32) (result i32)
    ;; log the string we get to the console
    (call $lift_string (local.get $string) (call $get_length (local.get $string)))
    call $log

    (call $lift_string (i32.const 0) (i32.const 26))
  )
)