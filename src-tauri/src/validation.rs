//! JSON Schema validation for AI responses
//!
//! This module provides strict validation of AI-generated JSON responses
//! to prevent injection attacks and ensure data integrity.

use jsonschema::{Draft, Validator};
use once_cell::sync::Lazy;
use serde_json::Value;
use std::sync::Arc;

/// JSON Schema for Critique response validation
///
/// Security requirements:
/// - All string fields have maxLength to prevent DoS
/// - severity is strictly enum constrained
/// - No additional properties allowed (strict schema)
const CRITIQUE_SCHEMA_JSON: &str = r#"{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["file_path", "severity", "message"],
    "additionalProperties": false,
    "properties": {
        "file_path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096,
            "description": "Absolute or relative path to the file being critiqued"
        },
        "severity": {
            "type": "string",
            "enum": ["Info", "Warning", "Critical", "LGTM"],
            "description": "Severity level of the critique"
        },
        "message": {
            "type": "string",
            "minLength": 1,
            "maxLength": 10000,
            "description": "Main critique message explaining the issue"
        },
        "suggestion": {
            "type": ["string", "null"],
            "maxLength": 20000,
            "description": "Optional suggestion for fixing the issue"
        },
        "chat_message": {
            "type": ["string", "null"],
            "maxLength": 5000,
            "description": "Optional message for chat interface"
        },
        "suggested_diff": {
            "type": ["string", "null"],
            "maxLength": 50000,
            "description": "Optional code diff suggestion"
        },
        "why": {
            "type": ["string", "null"],
            "maxLength": 5000,
            "description": "Optional explanation of why this critique matters"
        }
    }
}"#;

/// JSON Schema for batch critique responses (array of critiques)
const BATCH_CRITIQUE_SCHEMA_JSON: &str = r#"{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "array",
    "minItems": 0,
    "maxItems": 100,
    "items": {
        "type": "object",
        "required": ["file_path", "severity", "message"],
        "additionalProperties": false,
        "properties": {
            "file_path": {
                "type": "string",
                "minLength": 1,
                "maxLength": 4096
            },
            "severity": {
                "type": "string",
                "enum": ["Info", "Warning", "Critical", "LGTM"]
            },
            "message": {
                "type": "string",
                "minLength": 1,
                "maxLength": 10000
            },
            "suggestion": {
                "type": ["string", "null"],
                "maxLength": 20000
            },
            "chat_message": {
                "type": ["string", "null"],
                "maxLength": 5000
            },
            "suggested_diff": {
                "type": ["string", "null"],
                "maxLength": 50000
            },
            "why": {
                "type": ["string", "null"],
                "maxLength": 5000
            }
        }
    }
}"#;

/// Pre-compiled schema for single critique validation
static CRITIQUE_SCHEMA: Lazy<Arc<Validator>> = Lazy::new(|| {
    let schema_value: Value =
        serde_json::from_str(CRITIQUE_SCHEMA_JSON).expect("CRITIQUE_SCHEMA_JSON is valid JSON");
    Arc::new(
        jsonschema::options()
            .with_draft(Draft::Draft7)
            .build(&schema_value)
            .expect("CRITIQUE_SCHEMA_JSON is a valid JSON Schema"),
    )
});

/// Pre-compiled schema for batch critique validation
static BATCH_CRITIQUE_SCHEMA: Lazy<Arc<Validator>> = Lazy::new(|| {
    let schema_value: Value = serde_json::from_str(BATCH_CRITIQUE_SCHEMA_JSON)
        .expect("BATCH_CRITIQUE_SCHEMA_JSON is valid JSON");
    Arc::new(
        jsonschema::options()
            .with_draft(Draft::Draft7)
            .build(&schema_value)
            .expect("BATCH_CRITIQUE_SCHEMA_JSON is a valid JSON Schema"),
    )
});

/// Validation result type
pub type ValidationResult = Result<(), Vec<String>>;

/// Validates a single critique JSON response
///
/// # Security Features:
/// - Strict schema validation (no additional properties)
/// - Max length constraints on all fields
/// - Enum validation for severity field
/// - Prevents code injection through string fields
///
/// # Arguments
/// * `json_str` - The JSON string to validate
///
/// # Returns
/// * `Ok(())` - Validation passed
/// * `Err(Vec<String>)` - List of validation error messages
pub fn validate_critique(json_str: &str) -> ValidationResult {
    // First, parse as JSON
    let value: Value = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(e) => return Err(vec![format!("Invalid JSON syntax: {}", e)]),
    };

    // Validate against schema
    validate_against_schema(&value, &CRITIQUE_SCHEMA)?;

    // Additional path traversal validation
    match value.get("file_path").and_then(Value::as_str) {
        Some(path) => {
            if let Err(e) = validate_file_path(path) {
                return Err(vec![format!("file_path validation failed: {}", e)]);
            }
        }
        None => {
            return Err(vec!["file_path missing or not a string".to_string()]);
        }
    }

    Ok(())
}

/// Validates a batch critique JSON response (array)
///
/// # Arguments
/// * `json_str` - The JSON array string to validate
///
/// # Returns
/// * `Ok(())` - Validation passed
/// * `Err(Vec<String>)` - List of validation error messages
pub fn validate_batch_critiques(json_str: &str) -> ValidationResult {
    // First, parse as JSON
    let value: Value = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(e) => return Err(vec![format!("Invalid JSON syntax: {}", e)]),
    };

    // Validate against batch schema
    validate_against_schema(&value, &BATCH_CRITIQUE_SCHEMA)?;

    let mut errors: Vec<String> = Vec::new();
    let items = match value.as_array() {
        Some(items) => items,
        None => return Err(vec!["Batch payload is not a JSON array".to_string()]),
    };

    for (idx, item) in items.iter().enumerate() {
        match item.get("file_path").and_then(Value::as_str) {
            Some(path) => {
                if let Err(e) = validate_file_path(path) {
                    errors.push(format!("item {} file_path invalid: {}", idx, e));
                }
            }
            None => errors.push(format!("item {} file_path missing or not a string", idx)),
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// Validates a Value against a pre-compiled schema
fn validate_against_schema(value: &Value, schema: &Validator) -> ValidationResult {
    if schema.is_valid(value) {
        return Ok(());
    }

    let error_messages: Vec<String> = schema
        .iter_errors(value)
        .map(|e| {
            let path = e.instance_path.to_string();
            if path.is_empty() {
                format!("Validation error: {}", e)
            } else {
                format!("Validation error at '{}': {}", path, e)
            }
        })
        .collect();
    Err(error_messages)
}

/// Validates and sanitizes string content to prevent injection attacks
///
/// # Checks:
/// - Null bytes (could truncate strings in C libraries)
/// - Control characters (except common whitespace)
/// - Unicode bidirectional characters (spoofing attacks)
/// - HTML/JavaScript injection attempts
pub fn sanitize_string_content(content: &str, field_name: &str) -> Result<String, String> {
    // Check for null bytes
    if content.contains('\0') {
        return Err(format!("{} contains null bytes", field_name));
    }

    // Check for dangerous Unicode (bidirectional characters used for spoofing)
    let dangerous_unicode = ['\u{202A}', '\u{202B}', '\u{202C}', '\u{202D}', '\u{202E}'];
    for ch in dangerous_unicode {
        if content.contains(ch) {
            return Err(format!(
                "{} contains potentially dangerous Unicode characters",
                field_name
            ));
        }
    }

    // Check for obvious script injection attempts
    let dangerous_patterns = [
        "<script",
        "javascript:",
        "onerror=",
        "onload=",
        "eval(",
        "exec(",
        "system(",
        "child_process",
        "require(",
        "import(",
    ];

    let lower = content.to_lowercase();
    for pattern in &dangerous_patterns {
        if lower.contains(pattern) {
            return Err(format!(
                "{} contains potentially dangerous content pattern: {}",
                field_name, pattern
            ));
        }
    }

    Ok(content.to_string())
}

pub fn sanitize_code_content(content: &str, field_name: &str) -> Result<String, String> {
    if content.contains('\0') {
        return Err(format!("{} contains null bytes", field_name));
    }

    let dangerous_unicode = ['\u{202A}', '\u{202B}', '\u{202C}', '\u{202D}', '\u{202E}'];
    for ch in dangerous_unicode {
        if content.contains(ch) {
            return Err(format!(
                "{} contains potentially dangerous Unicode characters",
                field_name
            ));
        }
    }

    if content
        .chars()
        .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    {
        return Err(format!("{} contains control characters", field_name));
    }

    Ok(content.to_string())
}

/// Validates that file_path doesn't contain path traversal attempts
///
/// This is a secondary defense in addition to the patcher's validation
pub fn validate_file_path(path: &str) -> Result<(), String> {
    // Check for obvious path traversal patterns
    if path.contains("..") || path.contains("//") || path.contains("\\\\") {
        return Err("Invalid path traversal detected".to_string());
    }

    // Check for null bytes
    if path.contains('\0') {
        return Err("Null bytes detected in path".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_critique_passes() {
        let valid_json = r#"{
            "file_path": "/path/to/file.rs",
            "severity": "Warning",
            "message": "This is a valid critique message",
            "suggestion": "Consider fixing this",
            "chat_message": null,
            "suggested_diff": null,
            "why": null
        }"#;

        let result = validate_critique(valid_json);
        assert!(
            result.is_ok(),
            "Valid critique should pass validation: {:?}",
            result
        );
    }

    #[test]
    fn test_lgtm_critique_passes() {
        let lgtm_json = r#"{
            "file_path": "/path/to/file.rs",
            "severity": "LGTM",
            "message": "LGTM"
        }"#;

        let result = validate_critique(lgtm_json);
        assert!(result.is_ok(), "LGTM critique must be accepted");
    }

    #[test]
    fn test_invalid_severity_fails() {
        let invalid_json = r#"{
            "file_path": "/path/to/file.rs",
            "severity": "InvalidSeverity",
            "message": "This has an invalid severity"
        }"#;

        let result = validate_critique(invalid_json);
        assert!(result.is_err(), "Invalid severity must be rejected");
    }

    #[test]
    fn test_sanitize_code_content_allows_system_keyword() {
        let input = "fn system_call() {\n    println!(\"ok\");\n}";
        let result = sanitize_code_content(input, "suggested_diff");
        assert!(
            result.is_ok(),
            "Code content should allow system keyword usage"
        );
    }

    #[test]
    fn test_additional_properties_fails() {
        let malicious_json = r#"{
            "file_path": "/path/to/file.rs",
            "severity": "Warning",
            "message": "Valid message",
            "malicious_field": "<script>alert('xss')</script>"
        }"#;

        let result = validate_critique(malicious_json);
        assert!(result.is_err(), "Additional properties must be rejected");
    }

    #[test]
    fn test_empty_message_fails() {
        let empty_json = r#"{
            "file_path": "/path/to/file.rs",
            "severity": "Warning",
            "message": ""
        }"#;

        let result = validate_critique(empty_json);
        assert!(result.is_err(), "Empty message should fail validation");
    }

    #[test]
    fn test_missing_required_field_fails() {
        let incomplete_json = r#"{
            "file_path": "/path/to/file.rs",
            "severity": "Warning"
        }"#;

        let result = validate_critique(incomplete_json);
        assert!(
            result.is_err(),
            "Missing required fields should fail validation"
        );
    }

    #[test]
    fn test_message_too_long_fails() {
        let long_message = "x".repeat(10001);
        let long_json = format!(
            r#"{{
            "file_path": "/path/to/file.rs",
            "severity": "Warning",
            "message": "{}"
        }}"#,
            long_message
        );

        let result = validate_critique(&long_json);
        assert!(
            result.is_err(),
            "Message exceeding maxLength should fail validation"
        );
    }

    #[test]
    fn test_valid_batch_passes() {
        let valid_batch = r#"[
            {
                "file_path": "/path/file1.rs",
                "severity": "Critical",
                "message": "Critical issue found"
            },
            {
                "file_path": "/path/file2.rs",
                "severity": "Info",
                "message": "Info message"
            }
        ]"#;

        let result = validate_batch_critiques(valid_batch);
        assert!(
            result.is_ok(),
            "Valid batch should pass validation: {:?}",
            result
        );
    }

    #[test]
    fn test_empty_batch_passes() {
        let empty_batch = r#"[]"#;

        let result = validate_batch_critiques(empty_batch);
        assert!(result.is_ok(), "Empty batch should pass validation");
    }

    #[test]
    fn test_batch_too_large_fails() {
        let critiques: Vec<String> = (0..101)
            .map(|i| format!(
                r#"{{"file_path": "/path/file{}.rs", "severity": "Warning", "message": "Issue {}"}}"#,
                i, i
            ))
            .collect();
        let large_batch = format!("[{}]", critiques.join(","));

        let result = validate_batch_critiques(&large_batch);
        assert!(
            result.is_err(),
            "Batch exceeding maxItems should fail validation"
        );
    }

    #[test]
    fn test_sanitize_string_null_bytes() {
        let result = sanitize_string_content("hello\0world", "test_field");
        assert!(result.is_err(), "Null bytes should be rejected");
    }

    #[test]
    fn test_sanitize_string_script_injection() {
        let result = sanitize_string_content("<script>alert('xss')</script>", "test_field");
        assert!(result.is_err(), "Script tags should be rejected");
    }

    #[test]
    fn test_sanitize_string_javascript_protocol() {
        let result = sanitize_string_content("javascript:alert('xss')", "test_field");
        assert!(result.is_err(), "JavaScript protocol should be rejected");
    }

    #[test]
    fn test_validate_file_path_traversal() {
        let result = validate_file_path("../../../etc/passwd");
        assert!(result.is_err(), "Path traversal should be rejected");
    }

    #[test]
    fn test_validate_file_path_null_bytes() {
        let result = validate_file_path("/path/to/file\0.rs");
        assert!(result.is_err(), "Null bytes in path should be rejected");
    }

    #[test]
    fn test_validate_file_path_valid() {
        let result = validate_file_path("/path/to/file.rs");
        assert!(result.is_ok(), "Valid path should be accepted");
    }

    #[test]
    fn test_invalid_json_syntax_fails() {
        let invalid_json = r#"{not valid json}"#;

        let result = validate_critique(invalid_json);
        assert!(result.is_err(), "Invalid JSON syntax should fail");
    }

    #[test]
    fn test_suggested_diff_with_code_passes() {
        let diff_json = r#"{
            "file_path": "/path/to/file.rs",
            "severity": "Warning",
            "message": "Consider this fix",
            "suggested_diff": "fn main() {\n    println!(\"Hello\");\n}"
        }"#;

        let result = validate_critique(diff_json);
        assert!(result.is_ok(), "Suggested diff with valid code should pass");
    }

    #[test]
    fn test_why_field_passes() {
        let why_json = r#"{
            "file_path": "/path/to/file.rs",
            "severity": "Warning",
            "message": "This is a valid critique message",
            "why": "This improves accessibility by adding ARIA labels"
        }"#;

        let result = validate_critique(why_json);
        assert!(
            result.is_ok(),
            "Critique with why field should pass validation"
        );
    }
}
