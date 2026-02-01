//! Build script para o DocHub Backend
//!
//! Executado durante a compilação para:
//! - Gerar metadados de build
//! - Configurar recursos
//! - Executar verificações de pré-build
//! - Preparar assets
//!
//! ## Funcionalidades:
//! - Geração de versão baseada em git
//! - Validação de dependências
//! - Configuração de features condicionais
//! - Otimização de build

use std::env;
use std::path::Path;
use std::process::Command;

/// Executa verificações e configurações de build
fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=Cargo.toml");
    println!("cargo:rerun-if-changed=../../config/default.toml");

    // Verificar se estamos em um repositório git
    check_git_repository();

    // Gerar informações de versão
    generate_version_info();

    // Configurar features baseadas na plataforma
    configure_platform_features();

    // Verificar dependências críticas
    check_critical_dependencies();

    println!("Build configuration completed successfully");
}

/// Verifica se estamos em um repositório git válido
fn check_git_repository() {
    let output = Command::new("git")
        .args(&["rev-parse", "--git-dir"])
        .output();

    match output {
        Ok(result) if result.status.success() => {
            println!("cargo:rustc-env=GIT_REPOSITORY=true");

            // Tentar obter commit hash
            if let Ok(commit) = Command::new("git")
                .args(&["rev-parse", "--short", "HEAD"])
                .output()
            {
                if commit.status.success() {
                    let commit_hash = String::from_utf8_lossy(&commit.stdout).trim().to_string();
                    println!("cargo:rustc-env=GIT_COMMIT_HASH={}", commit_hash);
                }
            }
        }
        _ => {
            println!("cargo:rustc-env=GIT_REPOSITORY=false");
            println!("cargo:warning=Not in a git repository - some features may be limited");
        }
    }
}

/// Gera informações de versão baseadas em git e Cargo.toml
fn generate_version_info() {
    // Versão do Cargo.toml
    let cargo_version = env!("CARGO_PKG_VERSION");
    println!("cargo:rustc-env=CARGO_VERSION={}", cargo_version);

    // Timestamp de build
    let build_time = chrono::Utc::now().to_rfc3339();
    println!("cargo:rustc-env=BUILD_TIME={}", build_time);

    // Informações do Rust
    let rustc_version = rustc_version::version().unwrap_or_else(|_| rustc_version::Version::new(0, 0, 0));
    println!("cargo:rustc-env=RUSTC_VERSION={}", rustc_version);

    // Target da compilação
    let target = env::var("TARGET").unwrap_or_else(|_| "unknown".to_string());
    println!("cargo:rustc-env=BUILD_TARGET={}", target);

    // Perfil de build
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    println!("cargo:rustc-env=BUILD_PROFILE={}", profile);
}

/// Configura features baseadas na plataforma alvo
fn configure_platform_features() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();

    // Features específicas do Windows
    if target_os == "windows" {
        println!("cargo:rustc-cfg=feature=\"windows\"");
    }

    // Features específicas do Unix
    if target_os == "linux" || target_os == "macos" {
        println!("cargo:rustc-cfg=feature=\"unix\"");
    }

    // Features específicas de arquitetura
    match target_arch.as_str() {
        "x86_64" => println!("cargo:rustc-cfg=feature=\"x86_64\""),
        "aarch64" => println!("cargo:rustc-cfg=feature=\"aarch64\""),
        _ => {}
    }

    // Configurações de otimização
    if env::var("PROFILE").unwrap_or_default() == "release" {
        println!("cargo:rustc-cfg=feature=\"release\"");
    }
}

/// Verifica dependências críticas do sistema
fn check_critical_dependencies() {
    // Verificar se lopdf pode ser compilado
    if !Path::new("Cargo.lock").exists() {
        println!("cargo:warning=Cargo.lock not found - this may cause build issues");
    }

    // Verificar se arquivos de configuração existem
    let config_paths = [
        "../../config/default.toml",
        "../../docs",
    ];

    for path in &config_paths {
        if !Path::new(path).exists() {
            println!("cargo:warning=Required file/directory not found: {}", path);
        }
    }
}
