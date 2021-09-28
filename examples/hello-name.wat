(module
  (import "watever/glue.wat" "lift_string" (func $lift_string (param i32) (result i32)))
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
    (call $lift_string
      (local.get $greeting) ;; pointer to the string in memory
    )
  )
)