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