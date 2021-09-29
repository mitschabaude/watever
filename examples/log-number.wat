(module
  (import "js" "console.log" (func $log (param f64)))

  (func $log_number (export "logNumber")
    (call $log (f64.const 3.14159265))
  )
)