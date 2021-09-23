;; this module adds the bare necesseties for sane .wat development:
;; * bump & reset memory management with $alloc: [i32 $length] -> [i32 $pointer] 
;; * simple API for returning strings, booleans, byte arrays, nested objects and arrays
;; added overhead: 235B gzipped, 335B plain
(module

  (import "./memory.wat" "alloc" (func $alloc (param i32) (result i32)))

  (export "get_length" (func $get_length))
  
  (export "lift_int" (func $lift_int))
  (export "lift_float" (func $lift_float))
  (export "lift_bool" (func $lift_bool))
  (export "lift_bytes" (func $lift_bytes))
  (export "lift_string" (func $lift_string))
  (export "lift_extern" (func $lift_extern))
  (export "lift_function" (func $lift_function))
  (export "new_array" (func $new_array))
  (export "new_object" (func $new_object))
  (export "add_entry" (func $add_entry))

  (global $INT i32 (i32.const 0))
  (global $FLOAT i32 (i32.const 1))
  (global $BOOL i32 (i32.const 2))
  (global $BYTES i32 (i32.const 3))
  (global $STRING i32 (i32.const 4))
  (global $ARRAY i32 (i32.const 5))
  (global $OBJECT i32 (i32.const 6))
  (global $EXTERN i32 (i32.const 7))
  (global $FUNCTION i32 (i32.const 8))

  (func $get_length (param $pointer i32) (result i32)
    (i32.load (i32.sub (local.get $pointer) (i32.const 4)))
  )

  (func $lift_int
    (param i32) (result i32)
    ;; (call $log (local.get 0))
    (call $store8 (global.get $INT))
    (call $store32 (local.get 0))
  )
  (func $lift_float
    (param f64) (result i32)
    (call $store8 (global.get $FLOAT))
    (f64.store (call $alloc (i32.const 8)) (local.get 0))
  )
  (func $lift_bool
    (param i32) (result i32)
    (call $store8 (global.get $BOOL))
    (call $store8 (local.get 0))
    drop
  )
  (func $lift_bytes
    (param $offset i32) (param $length i32) (result i32)
    (call $store8 (global.get $BYTES))
    (call $store32 (local.get $offset))
    (call $store32 (local.get $length))
  )
  (func $lift_string
    (param $offset i32) (param $length i32) (result i32)
    (call $store8 (global.get $STRING))
    (call $store32 (local.get $offset))
    (call $store32 (local.get $length))
  )
  (func $lift_extern
    (param $id i32) (result i32)
    (call $store8 (global.get $EXTERN))
    (call $store32 (local.get 0))
  )
  (func $lift_function
    (param $index i32) (result i32)
    (call $store8 (global.get $FUNCTION))
    (call $store32 (local.get 0))
  )

  ;; these 2 return a pointer that should be the return value
  (func $new_array
    (param $length i32) (result i32)
    (call $store8 (global.get $ARRAY))
    (call $store8 (local.get $length))
    drop
  )
  (func $new_object
    (param $length i32) (result i32)
    (call $store8 (global.get $OBJECT))
    (call $store8 (local.get $length))
    drop
  )

  (func $add_entry
    (param $offset i32) (param $length i32)
    (call $new_array (i32.const 2))
    drop
    (call $lift_string (local.get $offset) (local.get $length))
    drop
  )

  (func $store8 ;; returns its pointer
    (param i32) (result i32)
    (local $pointer i32)
    i32.const 1
    call $alloc
    local.tee $pointer
    local.get $pointer
    local.get 0
    i32.store8
  )

  (func $store32
    (param i32)
    i32.const 4
    call $alloc
    local.get 0
    i32.store
  )
)
