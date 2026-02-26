mod commands;
mod sidecar;

use commands::BackendState;
use std::sync::Mutex;
use tauri::Manager;

struct SidecarState(Mutex<Option<sidecar::SidecarManager>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(Mutex::new(None)))
        .setup(|app| {
            let port = portpicker::pick_unused_port()
                .expect("no free port available");

            // Attempt to spawn the sidecar. In development without the binary present,
            // we log the error and continue so that cargo check / frontend work proceeds.
            match sidecar::SidecarManager::spawn(port) {
                Ok(mgr) => {
                    let state: tauri::State<SidecarState> = app.state();
                    *state.0.lock().unwrap() = Some(mgr);
                    println!("sidecar started on port {}", port);
                }
                Err(e) => {
                    eprintln!("warning: failed to start sidecar: {}", e);
                    eprintln!("backend proxy commands will not work until sidecar is available");
                }
            }

            app.manage(BackendState {
                port,
                client: reqwest::Client::new(),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::proxy_get,
            commands::proxy_post,
            commands::proxy_put,
            commands::proxy_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
