use std::process::Command;

fn main() {
    // Embed build metadata
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=assets/block_page.html");

    // Git commit hash (short)
    let git_hash = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    println!("cargo:rustc-env=ICON_GIT_HASH={}", git_hash);

    // Build timestamp
    let build_time = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
    println!("cargo:rustc-env=ICON_BUILD_TIME={}", build_time);

    // Target OS
    println!(
        "cargo:rustc-env=ICON_TARGET_OS={}",
        std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_else(|_| "unknown".to_string())
    );

    // Target architecture
    println!(
        "cargo:rustc-env=ICON_TARGET_ARCH={}",
        std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_else(|_| "unknown".to_string())
    );

    // Windows: embed application manifest and icon
    #[cfg(target_os = "windows")]
    {
        if std::path::Path::new("assets/icon.ico").exists() {
            let mut res = winresource::WindowsResource::new();
            res.set_icon("assets/icon.ico");
            res.set("ProductName", "Icon Agent");
            res.set("CompanyName", "GS2E");
            res.set("FileDescription", "Icon AI Monitoring Agent");
            res.set("LegalCopyright", "Copyright (C) 2024 GS2E");
            if let Err(e) = res.compile() {
                eprintln!("Warning: Failed to compile Windows resources: {}", e);
            }
        }
    }
}
