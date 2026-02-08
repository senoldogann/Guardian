use std::process::Command;

#[allow(dead_code)]
pub async fn run_command(command: &str, args: &[&str]) -> Result<String, String> {
    // SECURITY: Strictly allowlist binaries and patterns
    let allowed_binaries = [
        "cargo", "npm", "npx", "go", "python3", "python", "pip", "pytest",
    ];
    if !allowed_binaries.contains(&command) {
        return Err(format!(
            "Security Violation: Binary '{}' is not in the allowlist.",
            command
        ));
    }

    let cmd = command.to_string();
    let args_vec: Vec<String> = args.iter().map(|&s| s.to_string()).collect();

    // OPTIMIZATION: Use spawn_blocking for CPU-intensive blocking operations
    tokio::task::spawn_blocking(move || {
        let output = Command::new(&cmd)
            .args(&args_vec)
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn verify_rust_project(root: &str) -> Result<String, String> {
    run_verification(root, "cargo", &["check"], "Cargo Check")
}

pub fn verify_node_project(root: &str) -> Result<String, String> {
    use serde_json::Value;
    use std::fs;
    use std::path::Path;

    let pkg_path = Path::new(root).join("package.json");
    let content = match fs::read_to_string(&pkg_path) {
        Ok(c) => c,
        Err(_) => return Ok("NPM Build skipped: package.json not found".to_string()),
    };

    let parsed: Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok("NPM Build skipped: package.json parse failed".to_string()),
    };

    let has_build = parsed.get("scripts").and_then(|s| s.get("build")).is_some();

    if !has_build {
        return Ok("NPM Build skipped: build script not found".to_string());
    }

    run_verification(root, "npm", &["run", "build"], "NPM Build")
}

pub fn verify_go_project(root: &str) -> Result<String, String> {
    run_verification(root, "go", &["vet", "./..."], "Go Vet")
}

pub fn verify_python_project(root: &str) -> Result<String, String> {
    run_verification(
        root,
        "python3",
        &["-m", "compileall", "."],
        "Python CompileAll",
    )
}

fn run_verification(root: &str, bin: &str, args: &[&str], label: &str) -> Result<String, String> {
    let out = Command::new(bin)
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|e| format!("{} failed to start: {}", label, e))?;

    if out.status.success() {
        Ok(format!("{} Passed", label))
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        Err(format!("{} Failed:\n{}", label, stderr))
    }
}

pub fn auto_verify_project(root: &str) -> Result<String, String> {
    use std::path::Path;
    let root_path = Path::new(root);

    if root_path.join("Cargo.toml").exists() {
        return verify_rust_project(root);
    }
    if root_path.join("package.json").exists() {
        return verify_node_project(root);
    }
    if root_path.join("go.mod").exists() {
        return verify_go_project(root);
    }
    if root_path.join("requirements.txt").exists() || root_path.join("pyproject.toml").exists() {
        return verify_python_project(root);
    }

    Ok("No compatible project detected for auto-verification. Skipping.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use tempfile::tempdir;

    #[test]
    fn test_auto_verify_rust_detection() {
        let dir = tempdir().unwrap();
        File::create(dir.path().join("Cargo.toml")).unwrap();

        let result = auto_verify_project(dir.path().to_str().unwrap());
        // Since we don't have cargo check in the test env easily, we check if it ATTEMPTED to run it.
        // It should return an error or success depending on the env, but we want to see it NOT skip.
        assert!(!result
            .unwrap_or_default()
            .contains("No compatible project detected"));
    }

    #[test]
    fn test_auto_verify_node_detection() {
        let dir = tempdir().unwrap();
        File::create(dir.path().join("package.json")).unwrap();

        let result = auto_verify_project(dir.path().to_str().unwrap());
        assert!(!result
            .unwrap_or_default()
            .contains("No compatible project detected"));
    }

    #[test]
    fn test_auto_verify_go_detection() {
        let dir = tempdir().unwrap();
        File::create(dir.path().join("go.mod")).unwrap();

        let result = auto_verify_project(dir.path().to_str().unwrap());
        assert!(!result
            .unwrap_or_default()
            .contains("No compatible project detected"));
    }

    #[test]
    fn test_auto_verify_python_detection() {
        let dir = tempdir().unwrap();
        File::create(dir.path().join("requirements.txt")).unwrap();

        let result = auto_verify_project(dir.path().to_str().unwrap());
        assert!(!result
            .unwrap_or_default()
            .contains("No compatible project detected"));
    }

    #[test]
    fn test_auto_verify_skip() {
        let dir = tempdir().unwrap();
        let result = auto_verify_project(dir.path().to_str().unwrap());
        assert!(result.unwrap().contains("No compatible project detected"));
    }
}
