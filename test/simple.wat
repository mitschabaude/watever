(module
  (import "js" "console.log" (func $log (param i32)))
  (import "../src/return.wat" "get_length" (func $get_length (param i32) (result i32)))
  (import "../src/return.wat" "return_int" (func $return_int (param i32) (result i32)))

  (export "sum" (func $sum))
  
  (func $sum
    (param $offset i32)
    (result i32)

    (local $i i32)
    (local $sum i32)
    (local $length i32)
    (call $get_length (local.get $offset))
    local.set $length

    local.get $length
    call $log

    i32.const 0
    local.set $sum

    i32.const 0
    local.set $i
    loop
      local.get $offset
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

    local.get $sum
    call $log

    local.get $sum
    call $return_int
  )
  
)
