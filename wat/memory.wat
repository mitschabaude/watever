;; this module adds bare necesseties for wat development:
;; * bump & reset memory management with $alloc: [i32 $length] -> [i32 $pointer] 
(module
  ;; this should be provided by build pipeline, marks end of data sections
  (import "meta" "data_end" (global $data_end i32))
  
  (import "watever-js-wrapper" "addLock" (func $add_lock (param i32) (result i32)))
  (import "watever-js-wrapper" "removeLock" (func $remove_lock (param i32) (result i32)))
  
  (export "memory" (memory $memory))
  (export "alloc" (func $alloc))
  (export "reset" (func $reset))
  (export "get_length" (func $get_length))
  (export "keep" (func $keep))
  (export "free" (func $free))

  (memory $memory 1)
  (global $alloc_start (mut i32) (i32.const 0))
  (global $alloc_offset (mut i32) (i32.const 0))

  (start $init)

  (func $init
    (global.set $alloc_start (global.get $data_end))
    (global.set $alloc_offset (global.get $alloc_start))
  )

  (func $reset
    (global.set $alloc_offset (global.get $alloc_start))
  )

  (func $alloc
    (param $length i32) (result i32)
    (local $pointer i32)
    (local $allocpages i32)

    ;; pointer = alloc_offset + 4
    ;; memory[alloc_offset] = length
    ;; alloc_offset = pointer + length
    (local.set $pointer (i32.add (global.get $alloc_offset) (i32.const 4)))
    (i32.store (global.get $alloc_offset) (local.get $length))
    (global.set $alloc_offset
      (i32.add (local.get $pointer) (local.get $length))
    )

    ;; if ((((alloc_offset + 4) >> 16) + 1) > memory.size) { memory.grow(...) }
    global.get $alloc_offset
    i32.const 4
    i32.add
    i32.const 16
    i32.shr_u
    i32.const 1
    i32.add
    local.tee $allocpages
    memory.size
    i32.gt_u
    if 
      local.get $allocpages
      memory.grow
      drop
    end

    local.get $pointer
  )

  (func $get_length (param $pointer i32) (result i32)
    (i32.load (i32.sub (local.get $pointer) (i32.const 4)))
  )

  ;; set of locks is currently stored in JS for simplicity
  ;; => persisting & freeing not as efficient as possible (but small code size)
  ;; TODO: fast implementation in WAT (e.g. using a balanced tree)
  ;; later: persist & free less important because second memory can be used for persistent allocations
  (func $keep
    (param $pointer i32)
    (local $lock i32) (local $max_lock i32)

    ;; lock = pointer + length
    (local.set $lock (i32.add (local.get $pointer) (call $get_length (local.get $pointer))))
    
    ;; let max_lock = add_lock(lock)
    (local.set $max_lock (call $add_lock (local.get $lock)))

    ;; if (alloc_start < max_lock) alloc_start = max_lock;
    (i32.lt_u (global.get $alloc_start) (local.get $max_lock))
    if
      (global.set $alloc_start (local.get $max_lock))
    end
  )

  (func $free
    (param $pointer i32)
    (local $lock i32) (local $max_lock i32)
    ;; lock = pointer + length
    (local.set $lock (i32.add (local.get $pointer) (call $get_length (local.get $pointer))))
    
    ;; let max_lock = remove_lock(lock)
    (local.set $max_lock (call $remove_lock (local.get $lock)))

    ;; if (max_lock === -1) alloc_start = data_end;
    (i32.eq (i32.const -1) (local.get $max_lock))
    if
      (global.set $alloc_start (global.get $data_end))
    end

    ;; if (alloc_start > max_lock) alloc_start = max_lock;
    (i32.gt_u (global.get $alloc_start) (local.get $max_lock))
    if
      (global.set $alloc_start (local.get $max_lock))
    end
  )

)
