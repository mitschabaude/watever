(module
  (import "js" "(p, c) => p.then(x => c(x))#lift" (func $js_then (param i32 i32) (result i32)))
  (import "./glue.wat" "lift_extern" (func $lift_extern (param i32) (result i32)))
  (import "./glue.wat" "lift_function" (func $lift_function (param i32) (result i32)))

  (export "then" (func $then))
  (export "then_lift" (func $then_lift))

  ;; takes a promise (=externref) + a function index in the only table, which has to be exported as "table"
  ;; returns another promise (=externref)
  (func $then (param $promise i32) (param $index i32) (result i32)
    (call $lift_extern (local.get $promise))
    (call $lift_function (local.get $index))
    (call $js_then)
  )

  ;; same as $then but returns an already lifted promise that can be returned to JS
  (func $then_lift (param $promise i32) (param $index i32) (result i32)
    (call $then (local.get 0) (local.get 1))
    call $lift_extern
  )
)
