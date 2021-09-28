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