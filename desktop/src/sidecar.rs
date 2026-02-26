use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

pub struct SidecarManager {
    child: Child,
    #[allow(dead_code)]
    port: u16,
}

impl SidecarManager {
    /// Resolve the sidecar binary path.
    /// In development, looks for `binaries/gnz-backend-{target-triple}` relative to src-tauri.
    /// In production, Tauri places external binaries next to the app binary.
    fn binary_path() -> PathBuf {
        let target_triple = current_target_triple();

        // In production, the binary is next to the executable
        if let Ok(exe_dir) = std::env::current_exe() {
            let prod_path = exe_dir
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .join(format!("gnz-backend-{}", target_triple));
            if prod_path.exists() {
                return prod_path;
            }
        }

        // In development, look relative to the crate root
        let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(format!("gnz-backend-{}", target_triple));

        dev_path
    }

    /// Spawn the Go backend sidecar on the given port.
    /// Blocks until the sidecar prints "READY" on stdout.
    pub fn spawn(port: u16) -> Result<Self, String> {
        let bin = Self::binary_path();

        let mut child = Command::new(&bin)
            .args(["--port", &port.to_string()])
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("failed to spawn sidecar at {:?}: {}", bin, e))?;

        // Read stdout until we see "READY"
        let stdout = child
            .stdout
            .take()
            .ok_or("failed to capture sidecar stdout")?;

        let reader = BufReader::new(stdout);
        let mut ready = false;

        for line in reader.lines() {
            match line {
                Ok(l) => {
                    if l.contains("READY") {
                        ready = true;
                        break;
                    }
                }
                Err(e) => {
                    return Err(format!("error reading sidecar stdout: {}", e));
                }
            }
        }

        if !ready {
            let _ = child.kill();
            return Err("sidecar exited without sending READY".to_string());
        }

        Ok(Self { child, port })
    }

    /// Kill the sidecar process.
    pub fn kill(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        self.kill();
    }
}

fn current_target_triple() -> &'static str {
    env!("TARGET_TRIPLE")
}
