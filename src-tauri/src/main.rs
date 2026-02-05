// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Startup errors must use eprintln! since tracing isn't initialized yet
    if let Err(err) = guardian_lib::run() {
        eprintln!("Guardian failed to start: {}", err);
    }
}
