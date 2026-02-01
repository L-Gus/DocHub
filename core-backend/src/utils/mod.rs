//! Utilitários do DocHub
//!
//! Coleção de utilitários compartilhados por todo o sistema.
//! Inclui configuração, tratamento de erros, logging e outras funcionalidades comuns.
//!
//! ## Organização:
//! - `config`: Sistema de configuração com hot-reloading
//! - `error_handling`: Hierarquia de erros tipados
//! - `logging`: Utilitários de logging estruturado
//!
//! ## Princípios:
//! 1. Reutilização máxima de código
//! 2. Interfaces consistentes
//! 3. Documentação completa
//! 4. Testabilidade

pub mod config;
pub mod error_handling;
pub mod logging;

// Re-exports principais para facilitar imports
pub use config::{
    AppConfig, ConfigManager, Environment,
    ServerConfig, FileConfig, PdfConfig, LoggingConfig,
    PerformanceConfig, SecurityConfig, EnvironmentConfig,
};
pub use error_handling::{
    Result, AppError, IoError, ValidationError, PdfError, ConfigError,
};
pub use logging::{init_logging, log_info, log_error, log_warn, log_debug};

// Re-exports de constantes
pub use config::{APP_NAME, APP_VERSION, APP_AUTHOR, DEFAULT_ENVIRONMENT};

// Re-exports de tipos utilitários
pub use config::{LogLevel, LogFormat};

// ==================== UTILITÁRIOS COMUNS ====================

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// Resultado padrão da aplicação
pub type AppResult<T> = Result<T>;

/// Converte bytes para string legível
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[0])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

/// Formata duração para string legível
pub fn format_duration(duration: Duration) -> String {
    let total_seconds = duration.as_secs();
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;

    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, seconds)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, seconds)
    } else {
        format!("{}s", seconds)
    }
}

/// Valida se um caminho é seguro (não contém .. ou caracteres perigosos)
pub fn validate_path_safety(path: &Path) -> Result<()> {
    let path_str = path.to_string_lossy();

    if path_str.contains("..") {
        return Err(AppError::Validation(ValidationError::InvalidInput {
            message: "Path contains '..' which is not allowed".to_string(),
        }));
    }

    if path_str.contains("\\") && cfg!(not(windows)) {
        return Err(AppError::Validation(ValidationError::InvalidInput {
            message: "Backslashes not allowed on Unix systems".to_string(),
        }));
    }

    Ok(())
}

/// Cria diretório se não existir
pub fn ensure_directory_exists(path: &Path) -> Result<()> {
    if !path.exists() {
        std::fs::create_dir_all(path)
            .map_err(|e| AppError::Io(IoError::WriteFailed {
                path: path.to_path_buf(),
                source: e,
            }))?;
    }
    Ok(())
}

/// Gera nome de arquivo único baseado em timestamp
pub fn generate_unique_filename(prefix: &str, extension: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    format!("{}_{}.{}", prefix, timestamp, extension.trim_start_matches('.'))
}

// ==================== MACROS ÚTEIS ====================

/// Macro para logging com contexto
#[macro_export]
macro_rules! log_with_context {
    ($level:ident, $context:expr, $($arg:tt)*) => {
        tracing::$level!(
            context = $context,
            $($arg)*
        );
    };
}

/// Macro para medir tempo de execução
#[macro_export]
macro_rules! measure_time {
    ($operation:expr) => {{
        let start = std::time::Instant::now();
        let result = $operation;
        let elapsed = start.elapsed();
        tracing::debug!(
            operation = stringify!($operation),
            duration_ms = elapsed.as_millis(),
            "Operation completed"
        );
        result
    }};
}

// ==================== CONSTANTES ====================

/// Timeout padrão para operações I/O (30 segundos)
pub const IO_TIMEOUT_SECS: u64 = 30;

/// Tamanho do buffer para operações I/O (64KB)
pub const IO_BUFFER_SIZE: usize = 64 * 1024;

/// Número máximo de tentativas para operações falhíveis
pub const MAX_RETRY_ATTEMPTS: u32 = 3;
