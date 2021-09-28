(module
  (import "js" "console.log#lift" (func $log (param i32 i32)))
  (import "watever/memory.wat" "get_length" (func $get_length (param i32) (result i32)))
  (import "watever/glue.wat" "lift_int" (func $lift_int (param i32) (result i32)))
  (import "watever/glue.wat" "lift_raw_string" (func $lift_raw_string (param i32 i32) (result i32)))

  (export "sum" (func $sum))

  (data (i32.const 0) "length:")
  (data (i32.const 7) "sum:")
  
  (func $sum
    (param $pointer i32)
    (result i32)

    (local $i i32)
    (local $sum i32)
    (local $length i32)
    (call $get_length (local.get $pointer))
    local.set $length

    (call $log
      (call $lift_raw_string (i32.const 0) (i32.const 7))
      (call $lift_int (local.get $length)))

    i32.const 0
    local.set $sum

    i32.const 0
    local.set $i
    loop
      local.get $pointer
      local.get $i
      i32.add
      i32.load8_u

      local.get $sum
      i32.add
      local.set $sum

      (i32.add (local.get $i) (i32.const 1))
      local.tee $i
      local.get $length
      i32.lt_u
      br_if 0
    end

    (call $log
      (call $lift_raw_string (i32.const 7) (i32.const 4))
      (call $lift_int (local.get $sum)))

    local.get $sum
  )
  
)
