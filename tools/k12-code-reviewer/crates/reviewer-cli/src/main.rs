use std::error::Error;
use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, Subcommand};
use k12_code_reviewer_core::{ReviewEngine, ReviewRequest};

#[derive(Debug, Parser)]
#[command(name = "k12-code-reviewer")]
#[command(about = "Static code review CLI for the K12 agent platform")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Review one JSON request from a file or standard input.
    Review {
        /// JSON request file. When omitted, the request is read from stdin.
        #[arg(short, long)]
        input: Option<PathBuf>,

        /// Pretty-print the JSON report.
        #[arg(long)]
        pretty: bool,
    },
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("k12-code-reviewer: {error}");
            ExitCode::from(2)
        }
    }
}

fn run() -> Result<(), Box<dyn Error>> {
    let cli = Cli::parse();
    match cli.command {
        Command::Review { input, pretty } => {
            let request_json = read_input(input.as_ref())?;
            let request: ReviewRequest = serde_json::from_str(&request_json)?;
            let report = ReviewEngine::default().review(&request);
            let output = if pretty {
                serde_json::to_string_pretty(&report)?
            } else {
                serde_json::to_string(&report)?
            };
            println!("{output}");
        }
    }
    Ok(())
}

fn read_input(path: Option<&PathBuf>) -> Result<String, Box<dyn Error>> {
    if let Some(path) = path {
        return Ok(fs::read_to_string(path)?);
    }

    let mut buffer = String::new();
    io::stdin().read_to_string(&mut buffer)?;
    Ok(buffer)
}
