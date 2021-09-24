(module
  ;; (import "./sum-inner-import.js" "log" (func $log (param i32)))
  (import "js" "x => console.log(x)" (func $log (param i32)))

  (import "watever/memory.wat" "alloc" (func $alloc (param i32) (result i32)))

  (import "watever/glue.wat" "get_length" (func $get_length (param i32) (result i32)))
  (import "watever/glue.wat" "lift_int" (func $lift_int (param i32) (result i32)))
  (import "watever/glue.wat" "lift_float" (func $lift_float (param f64) (result i32)))
  (import "watever/glue.wat" "lift_bool" (func $lift_bool (param i32) (result i32)))
  (import "watever/glue.wat" "lift_bytes" (func $lift_bytes (param i32 i32) (result i32)))
  (import "watever/glue.wat" "lift_string" (func $lift_string (param i32 i32) (result i32)))
  (import "watever/glue.wat" "new_array" (func $new_array (param i32) (result i32)))
  (import "watever/glue.wat" "new_object" (func $new_object (param i32) (result i32)))
  (import "watever/glue.wat" "add_entry" (func $add_entry (param i32 i32)))

  (export "sum" (func $sum))
  (export "avg" (func $avg))
  (export "double#lift" (func $double))
  (export "isSumEven#lift" (func $isSumEven))
  (export "howIsSum#lift" (func $howIsSum))
  ;; (export "twice" (func $twice))
  (export "createArray#lift" (func $createArray))

  (data (i32.const 0) "even")
  (data (i32.const 4) "not-even")
  (global $EVEN i32 (i32.const 0))
  (global $EVEN_END i32 (i32.const 4))
  (global $NOT_EVEN i32 (i32.const 4))
  (global $NOT_EVEN_END i32 (i32.const 12))

  (func $createArray
    (result i32)
    (local $pointer i32)
    (local $bytes0 i32)
    (local $bytes1 i32)

    ;; allocate & populate 2 byte arrays of length 4

    i32.const 4
    call $alloc
    local.set $bytes0

    i32.const 4
    call $alloc
    local.set $bytes1

    local.get $bytes0
    i32.const 0x04030201
    i32.store

    local.get $bytes1
    i32.const 0x0c0b0a09
    i32.store

    i32.const 6
    call $new_array

    i32.const 9
    call $lift_int
    drop
    local.get $bytes0
    i32.const 4
    call $lift_bytes
    drop
    local.get $bytes1
    i32.const 4
    call $lift_bytes
    drop
    i32.const 1
    call $lift_bool
    drop
    f64.const 3.141592
    call $lift_float
    drop
    i32.const 1
    call $new_object
    drop
    global.get $EVEN
    global.get $EVEN_END
    call $add_entry
    global.get $EVEN
    global.get $EVEN_END
    call $lift_string
    drop
  )

  (func $double
    (param $pointer i32)
    (result i32)

    (local $i i32)
    (local $ii i32)
    (local $length i32)
    (call $get_length (local.get $pointer))
    local.set $length

    i32.const 0
    local.set $i
    loop
      local.get $pointer
      local.get $i
      i32.add
      local.tee $ii

      local.get $ii
      i32.load8_u

      i32.const 2
      i32.mul

      i32.store8

      (i32.add (local.get $i) (i32.const 1))
      local.tee $i
      local.get $length
      i32.lt_u
      br_if 0
    end

    local.get $pointer
    local.get $length
    call $lift_bytes
  )

  ;; (func $twice
  ;;   (param $pointer i32) (param $length i32)
  ;;   (result i32)
  ;;   (local $pointer2 i32)
  ;;   (local $length2 i32)
    
  ;;   local.get $length
  ;;   i32.const 2
  ;;   i32.mul
  ;;   local.tee $length2
  ;;   call $alloc
  ;;   local.set $pointer2

  ;;   local.get $pointer2
  ;;   local.get $pointer
  ;;   local.get $length
  ;;   memory.copy

  ;;   local.get $pointer2
  ;;   local.get $length
  ;;   i32.add
  ;;   local.get $pointer
  ;;   local.get $length
  ;;   memory.copy

  ;;   local.get $pointer2
  ;;   local.get $length2
  ;;   call $lift_string
  ;; )

  (func $isSumEven
    (param $pointer i32)
    (result i32)

    local.get $pointer
    call $sum
    call $read_int
    i32.const 1
    i32.and
    i32.const 1
    i32.xor
    call $lift_bool
  )

  (func $howIsSum
    (param $pointer i32)
    (result i32)

    (local $tmp i32)

    local.get $pointer
    call $sum
    call $read_int
    i32.const 1
    i32.and
    i32.eqz

    if (result i32)
      global.get $EVEN
      global.get $EVEN_END
      call $lift_string
    else
      global.get $NOT_EVEN
      global.get $NOT_EVEN_END
      call $lift_string
    end
    
  )

  (func $avg
    (param $pointer i32)
    (result f64)
    (local $length i32)
    (call $get_length (local.get $pointer))
    local.set $length

    local.get $pointer
    call $sum
    f64.convert_i32_u

    local.get $length
    f64.convert_i32_u

    f64.div
  )
  
  (func $sum
    (param $pointer i32)
    (result i32)

    (local $i i32)
    (local $sum i32)
    (local $length i32)
    (call $get_length (local.get $pointer))
    local.set $length

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

    local.get $sum
  )
  
  (func $read_int
    (param $pointer i32) (result i32)
    local.get $pointer
    i32.const 1
    i32.add
    i32.load
  )
)
