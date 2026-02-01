//! Sistema de logging estruturado do DocHub
//!
//! Fornece utilitários para logging consistente e estruturado em toda a aplicação.
//! Baseado no tracing crate para performance e flexibilidade.
//!
//! ## Níveis de log:
//! - ERROR: Erros críticos que impedem operação
//! - WARN: Avisos que não impedem operação mas devem ser investigados
//! - INFO: Informações gerais sobre operação normal
//! - DEBUG: Informações detalhadas para desenvolvimento
//! - TRACE: Informações muito detalhadas para troubleshooting
//!
//! ## Uso:
//! ```rust
//! use crate::utils::logging::{init_logging, log_info};
//!
//! // Inicializar logging no main
//! init_logging()?;
//!
//! // Usar macros de logging
//! log_info("Application started");
//! tracing::info!("User logged in", user_id = 123);
//! ```

use tracing::{debug, info, warn, error, Level};
use tracing_subscriber::{fmt, EnvFilter};
use std::io;
use crate::utils::error_handling::{Result, AppError};

// ==================== INICIALIZAÇÃO ====================

/// Inicializa o sistema de logging
///
/// Configura o subscriber do tracing com formatação apropriada
/// para o ambiente (desenvolvimento vs produção).
pub fn init_logging() -> Result<()> {
    // Filtro baseado em variável de ambiente RUST_LOG
    // Padrão: info para aplicação, warn para crates externos
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("dochub_backend=info,tracing=warn"));

    // Formatação para desenvolvimento
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false) // Remove nome do crate do output
        .with_thread_ids(false) // Remove IDs de thread
        .with_thread_names(false) // Remove nomes de thread
        .with_file(false) // Remove arquivo e linha (para produção)
        .with_line_number(false)
        .compact() // Formato compacto
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .map_err(|e| AppError::Legacy(format!("Failed to set tracing subscriber: {}", e)))?;

    info!("Logging system initialized");
    Ok(())
}

/// Inicializa logging para testes
///
/// Versão simplificada que loga apenas para stderr sem timestamps.
pub fn init_test_logging() -> Result<()> {
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::new("dochub_backend=debug"))
        .with_target(false)
        .with_thread_ids(false)
        .with_thread_names(false)
        .with_file(false)
        .with_line_number(false)
        .without_time() // Sem timestamp para testes
        .compact()
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .map_err(|e| AppError::Legacy(format!("Failed to set test subscriber: {}", e)))?;

    Ok(())
}

// ==================== UTILITÁRIOS DE LOGGING ====================

/// Log de informação
pub fn log_info(message: &str) {
    info!("{}", message);
}

/// Log de erro
pub fn log_error(message: &str) {
    error!("{}", message);
}

/// Log de aviso
pub fn log_warn(message: &str) {
    warn!("{}", message);
}

/// Log de debug
pub fn log_debug(message: &str) {
    debug!("{}", message);
}

/// Log com contexto estruturado
pub fn log_with_context(level: Level, context: &str, message: &str, fields: &[(&str, &str)]) {
    // Para logging estruturado, seria melhor usar uma abordagem diferente
    // Por enquanto, vamos logar os campos como parte da mensagem
    let fields_str = fields.iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join(", ");
    
    let full_message = if fields_str.is_empty() {
        format!("[{}] {}", context, message)
    } else {
        format!("[{}] {} | {}", context, message, fields_str)
    };
    
    match level {
        Level::ERROR => error!("{}", full_message),
        Level::WARN => warn!("{}", full_message),
        Level::INFO => info!("{}", full_message),
        Level::DEBUG => debug!("{}", full_message),
        Level::TRACE => tracing::trace!("{}", full_message),
    }
}

// ==================== LOGGING DE PERFORMANCE ====================

/// Log de operação com timing
pub fn log_operation_start(operation: &str, id: Option<&str>) {
    if let Some(id) = id {
        info!(operation = operation, id = id, "Operation started");
    } else {
        info!(operation = operation, "Operation started");
    }
}

/// Log de operação concluída com timing
pub fn log_operation_end(operation: &str, id: Option<&str>, duration_ms: u128) {
    if let Some(id) = id {
        info!(operation = operation, id = id, duration_ms = duration_ms, "Operation completed");
    } else {
        info!(operation = operation, duration_ms = duration_ms, "Operation completed");
    }
}

/// Log de erro de operação
pub fn log_operation_error(operation: &str, id: Option<&str>, error: &str) {
    if let Some(id) = id {
        error!(operation = operation, id = id, error = error, "Operation failed");
    } else {
        error!(operation = operation, error = error, "Operation failed");
    }
}

// ==================== LOGGING DE ARQUIVOS ====================

/// Log de processamento de arquivo
pub fn log_file_processing(file_path: &str, operation: &str, size_bytes: Option<u64>) {
    if let Some(size) = size_bytes {
        info!(
            file_path = file_path,
            operation = operation,
            file_size = size,
            "File processing started"
        );
    } else {
        info!(
            file_path = file_path,
            operation = operation,
            "File processing started"
        );
    }
}

/// Log de conclusão de processamento de arquivo
pub fn log_file_processed(file_path: &str, operation: &str, success: bool, duration_ms: u128) {
    if success {
        info!(
            file_path = file_path,
            operation = operation,
            duration_ms = duration_ms,
            "File processed successfully"
        );
    } else {
        error!(
            file_path = file_path,
            operation = operation,
            duration_ms = duration_ms,
            "File processing failed"
        );
    }
}

// ==================== CONFIGURAÇÃO AVANÇADA ====================

/// Configuração de logging
#[derive(Debug, Clone)]
pub struct LoggingConfig {
    pub level: Level,
    pub enable_file: bool,
    pub enable_console: bool,
    pub file_path: Option<String>,
    pub max_file_size: u64,
    pub max_files: usize,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: Level::INFO,
            enable_file: true,
            enable_console: true,
            file_path: None,
            max_file_size: 10 * 1024 * 1024, // 10MB
            max_files: 5,
        }
    }
}

impl LoggingConfig {
    /// Aplica a configuração
    pub fn apply(&self) -> Result<()> {
        // Re-inicializar com nova configuração
        // Nota: Em produção, isso seria mais sofisticado
        init_logging()
    }
}
