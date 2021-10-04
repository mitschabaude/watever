(module
  (import "js" "(p, c, ...args) => p.then(x => c(x, ...args))#lift" (func $js_then (param i32 i32) (result i32)))
  (import "js" "(p, c, ...args) => p.then(x => c(x, ...args))#lift" (func $js_then_1 (param i32 i32 i32) (result i32)))
  (import "js" "(p, c, ...args) => p.then(x => c(x, ...args))#lift" (func $js_then_2 (param i32 i32 i32 i32) (result i32)))
  (import "js" "(p, c, ...args) => p.then(x => c(x, ...args))#lift" (func $js_then_3 (param i32 i32 i32 i32 i32) (result i32)))

  (import "./glue.wat" "lift_extern" (func $lift_extern (param i32) (result i32)))
  (import "./glue.wat" "lift_function" (func $lift_function (param i32) (result i32)))

  (export "then" (func $then))
  (export "then_lift" (func $then_lift))

  (export "then_1" (func $then_1))
  (export "then_2" (func $then_2))
  (export "then_3" (func $then_3))

  ;; takes a promise (=externref) + a function index in the only table, which has to be exported as "table"
  ;; returns another promise (=externref)
  (func $then (param $promise i32) (param $index i32) (result i32)
    (call $lift_extern (local.get $promise))
    (call $lift_function (local.get $index))
    (call $js_then)
  )
  ;; variants which allow passing 1, 2 or 3 additional params to the callback
  ;; e.g. with $then_2 the callback gets called like promise.then(x => cb(x, a0, a1))
  (func $then_1 (param $promise i32) (param $index i32) (param $a0 i32) (result i32)
    (call $lift_extern (local.get $promise))
    (call $lift_function (local.get $index))
    (local.get $a0)
    (call $js_then_1)
  )
  (func $then_2 (param $promise i32) (param $index i32) (param $a0 i32) (param $a1 i32) (result i32)
    (call $lift_extern (local.get $promise))
    (call $lift_function (local.get $index))
    (local.get $a0) (local.get $a1)
    (call $js_then_2)
  )
  (func $then_3 (param $promise i32) (param $index i32) (param $a0 i32) (param $a1 i32) (param $a2 i32) (result i32)
    (call $lift_extern (local.get $promise))
    (call $lift_function (local.get $index))
    (local.get $a0) (local.get $a1) (local.get $a2)
    (call $js_then_3)
  )

  ;; same as $then but returns an already lifted promise that can be returned to JS
  (func $then_lift (param $promise i32) (param $index i32) (result i32)
    (call $then (local.get 0) (local.get 1))
    call $lift_extern
  )
)
