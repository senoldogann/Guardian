use crate::executor;
use tauri::{AppHandle, Emitter};

use super::is_turkish;
use super::ui_text;

pub(super) fn run_auto_verify(app: AppHandle, root: String, language: String) {
    tokio::task::spawn_blocking(move || {
        app.emit(
            "guardian:analyzing",
            ui_text(
                language.as_str(),
                "Running Automatic Verification...",
                "Otomatik doğrulama çalıştırılıyor...",
            )
            .to_string(),
        )
        .ok();
        let verify_res = executor::auto_verify_project(&root);
        match verify_res {
            Ok(msg) => {
                if msg.contains("Passed") {
                    app.emit(
                        "guardian:info",
                        if is_turkish(language.as_str()) {
                            format!("DOĞRULAMA BAŞARILI: {}", msg)
                        } else {
                            format!("VERIFICATION PASSED: {}", msg)
                        },
                    )
                    .ok();
                }
            }
            Err(err) => {
                app.emit(
                    "guardian:verification",
                    if is_turkish(language.as_str()) {
                        format!("Doğrulama başarısız: {}", err)
                    } else {
                        format!("Verification failed: {}", err)
                    },
                )
                .ok();
            }
        }
    });
}
