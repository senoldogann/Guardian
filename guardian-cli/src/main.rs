mod baseline;
mod evidence;
mod guardian_lock;
mod output;
mod redaction;
mod rules_hash;
mod run_manifest;
mod scan;

use clap::{Parser, Subcommand, ValueEnum};
use guardian_scan_policy::ScanProfile;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "guardian-cli")]
#[command(about = "Guardian CLI: CI-friendly scanning with baseline + SARIF output", long_about = None)]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Scan a workspace and emit a report in JSON/SARIF/Markdown.
    Scan(ScanArgs),
}

#[derive(clap::Args)]
struct ScanArgs {
    /// Workspace root to scan.
    #[arg(long, default_value = ".")]
    root: PathBuf,

    /// Report format.
    #[arg(long, value_enum, default_value_t = OutputFormat::Json)]
    format: OutputFormat,

    /// Output path. If omitted, prints to stdout.
    #[arg(long)]
    out: Option<PathBuf>,

    /// Baseline JSON file path (typically .guardian/baseline.json).
    #[arg(long)]
    baseline: Option<PathBuf>,

    /// Disable baseline usage even if .guardian/baseline.json exists.
    #[arg(long)]
    no_baseline: bool,

    /// Max files to scan (safety + cost guardrail).
    #[arg(long, default_value_t = 200)]
    max_files: usize,

    /// Max file size in bytes to read.
    #[arg(long, default_value_t = 100_000)]
    max_file_bytes: u64,

    /// Scan profile (source|extended|full). Env: GUARDIAN_SCAN_PROFILE
    #[arg(long, value_enum)]
    scan_profile: Option<ScanProfileArg>,

    /// Offline scan (no network, no AI). Useful for CI smoke checks.
    #[arg(long)]
    offline: bool,

    /// Force mock provider (deterministic, no network). Equivalent to GUARDIAN_MOCK=1.
    #[arg(long)]
    mock: bool,

    /// Provider id (anthropic|openai|gemini|ollama). Env: GUARDIAN_PROVIDER
    #[arg(long)]
    provider: Option<String>,

    /// Model name. Env: GUARDIAN_MODEL
    #[arg(long)]
    model: Option<String>,

    /// Provider base URL. Env: GUARDIAN_BASE_URL
    #[arg(long)]
    base_url: Option<String>,

    /// API key (prefer env GUARDIAN_API_KEY). Passing via flag can leak into shell history.
    #[arg(long)]
    api_key: Option<String>,

    /// guardian.lock path (defaults to <root>/guardian.lock).
    #[arg(long)]
    lock: Option<PathBuf>,

    /// guardian.lock enforcement mode.
    #[arg(long, value_enum, default_value_t = LockModeArg::Warn)]
    lock_mode: LockModeArg,

    /// Emit a reproducible run manifest (JSON) for this scan.
    #[arg(long)]
    emit_manifest: Option<PathBuf>,

    /// Emit finding evidence/provenance (JSON) for this scan.
    #[arg(long)]
    emit_evidence: Option<PathBuf>,

    /// PR/CI gate mode. Default: fail only on new Critical findings.
    #[arg(long, value_enum, default_value_t = PrGateArg::CriticalOnly)]
    pr_gate: PrGateArg,

    /// Policy file path. Default: <root>/guardian.policy.yaml
    #[arg(long)]
    policy: Option<PathBuf>,

    /// Release gate mode.
    #[arg(long, value_enum, default_value_t = ReleaseGateArg::Strict)]
    release_gate: ReleaseGateArg,

    /// Human approver identity for manual approval/override flows.
    #[arg(long)]
    approver: Option<String>,

    /// Override reason (required for override flow).
    #[arg(long)]
    override_reason: Option<String>,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, ValueEnum)]
enum OutputFormat {
    Json,
    Sarif,
    Markdown,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, ValueEnum)]
enum ScanProfileArg {
    Source,
    Extended,
    Full,
}

impl ScanProfileArg {
    fn to_profile(self) -> ScanProfile {
        match self {
            Self::Source => ScanProfile::Source,
            Self::Extended => ScanProfile::Extended,
            Self::Full => ScanProfile::Full,
        }
    }
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, ValueEnum)]
enum LockModeArg {
    Off,
    Warn,
    Strict,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, ValueEnum)]
enum PrGateArg {
    CriticalOnly,
    NewOnly,
    Off,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, ValueEnum)]
enum ReleaseGateArg {
    Strict,
    Warn,
    Off,
}

fn main() {
    let cli = Cli::parse();

    let code = match cli.command {
        Commands::Scan(args) => match scan::run_scan(scan::ScanConfig {
            root: args.root,
            format: match args.format {
                OutputFormat::Json => output::ReportFormat::Json,
                OutputFormat::Sarif => output::ReportFormat::Sarif,
                OutputFormat::Markdown => output::ReportFormat::Markdown,
            },
            out: args.out,
            baseline_path: args.baseline,
            disable_baseline: args.no_baseline,
            max_files: args.max_files,
            max_file_bytes: args.max_file_bytes,
            scan_profile: args.scan_profile.map(|p| p.to_profile()),
            offline: args.offline,
            mock: args.mock,
            provider: args.provider,
            model: args.model,
            base_url: args.base_url,
            api_key: args.api_key,
            lock_path: args.lock,
            lock_mode: match args.lock_mode {
                LockModeArg::Off => guardian_lock::LockMode::Off,
                LockModeArg::Warn => guardian_lock::LockMode::Warn,
                LockModeArg::Strict => guardian_lock::LockMode::Strict,
            },
            emit_manifest_path: args.emit_manifest,
            emit_evidence_path: args.emit_evidence,
            pr_gate: match args.pr_gate {
                PrGateArg::CriticalOnly => scan::PrGateMode::CriticalOnly,
                PrGateArg::NewOnly => scan::PrGateMode::NewOnly,
                PrGateArg::Off => scan::PrGateMode::Off,
            },
            policy_path: args.policy,
            release_gate: match args.release_gate {
                ReleaseGateArg::Strict => scan::ReleaseGateMode::Strict,
                ReleaseGateArg::Warn => scan::ReleaseGateMode::Warn,
                ReleaseGateArg::Off => scan::ReleaseGateMode::Off,
            },
            approver: args.approver,
            override_reason: args.override_reason,
        }) {
            Ok(exit_code) => exit_code,
            Err(err) => {
                eprintln!("guardian-cli: {err:#}");
                2
            }
        },
    };

    std::process::exit(code);
}
