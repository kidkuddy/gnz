mod commands;
mod sidecar;

use commands::BackendState;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

struct SidecarState(Mutex<Option<sidecar::SidecarManager>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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

            // Build native File menu
            let new_window_item = MenuItem::with_id(
                app,
                "new-window",
                "New Window",
                true,
                Some("CmdOrCtrl+Shift+N"),
            )?;
            let file_menu = Submenu::with_items(app, "File", true, &[&new_window_item])?;
            let menu = Menu::with_items(app, &[&file_menu])?;
            app.set_menu(menu)?;

            app.on_menu_event(|app, event| {
                if event.id() == "new-window" {
                    let label = format!(
                        "gnz-{}",
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis()
                    );
                    let _ = WebviewWindowBuilder::new(
                        app,
                        &label,
                        WebviewUrl::App("index.html".into()),
                    )
                    .title("gnz")
                    .inner_size(1200.0, 800.0)
                    .build();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_backend_port,
            commands::proxy_get,
            commands::proxy_post,
            commands::proxy_put,
            commands::proxy_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
