fn main() {
    // Expose the target triple so sidecar.rs can locate the correct binary name.
    println!(
        "cargo:rustc-env=TARGET_TRIPLE={}",
        std::env::var("TARGET").unwrap()
    );
    tauri_build::build()
}
