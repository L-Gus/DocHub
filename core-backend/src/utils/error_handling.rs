//! Sistema de tratamento de erros do DocHub
//! 
//! ## Hierarquia de Erros:
//! AppError (principal)
//! ├── IoError (erros de I/O)
//! ├── ValidationError (erros de validação)
//! ├── PdfError (erros de processamento PDF)
//! ├── ConfigError (erros de configuração)
//! └── Unknown (erros genéricos)
//! 
//! ## Uso:
//! ```rust
//! use crate::utils::error_handling::{Result, AppError, ValidationError};
//! 
//! fn validate_input(input: &str) -> Result<()> {
//!     if input.is_empty() {
//!         return Err(AppError::validation("Input cannot be empty"));
//!     }
//!     Ok(())
//! }
//! ```

use std::fmt;
use std::path::PathBuf;
use thiserror::Error;

// ==================== HIERARQUIA DE ERROS ====================

/// Erro principal da aplicação - unifica todos os tipos de erro
#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO operation failed: {0}")]
    Io(#[from] IoError),
    
    #[error("Validation failed: {0}")]
    Validation(#[from] ValidationError),
    
    #[error("PDF processing failed: {0}")]
    Pdf(#[from] PdfError),
    
    #[error("Configuration error: {0}")]
    Config(#[from] ConfigError),
    
    #[error("API error: {0}")]
    Api(#[from] crate::types::api_types::ApiError),
    
    // Mantém compatibilidade com versão antiga
    #[error("{0}")]
    Legacy(String),
}

/// Erros de operações de I/O
#[derive(Error, Debug)]
pub enum IoError {
    #[error("File not found: {path}")]
    FileNotFound { path: PathBuf },
    
    #[error("Permission denied for: {path}")]
    PermissionDenied { path: PathBuf },
    
    #[error("Disk full while writing: {path}")]
    DiskFull { path: PathBuf },
    
    #[error("Read failed for {path}: {source}")]
    ReadFailed {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    
    #[error("Write failed for {path}: {source}")]
    WriteFailed {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    
    #[error("Serialization failed: {message}")]
    SerializationFailed { message: String },
    
    #[error("Deserialization failed: {message}")]
    DeserializationFailed { message: String },
}

/// Erros de validação de entrada e domínio
#[derive(Error, Debug)]
pub enum ValidationError {
    #[error("Empty file list provided")]
    EmptyFileList,
    
    #[error("File too large: {path} ({size} bytes, max: {max})")]
    FileTooLarge {
        path: PathBuf,
        size: u64,
        max: u64,
    },
    
    #[error("Invalid page range: {range}. Must be 1-indexed and start <= end")]
    InvalidPageRange { range: String },
    
    #[error("Unsupported PDF version: {version}")]
    UnsupportedPdfVersion { version: String },
    
    #[error("Invalid input: {message}")]
    InvalidInput { message: String },
    
    #[error("Duplicate file: {path}")]
    DuplicateFile { path: PathBuf },
    
    #[error("Invalid file format. Expected PDF, got: {actual}")]
    InvalidFileFormat { actual: String },
    
    #[error("Unknown action: {action}")]
    UnknownAction { action: String },
}

/// Erros específicos de processamento PDF
#[derive(Error, Debug)]
pub enum PdfError {
    #[error("PDF corrupted or invalid: {path}")]
    CorruptedPdf { path: PathBuf },
    
    #[error("PDF encryption not supported: {path}")]
    EncryptedPdf { path: PathBuf },
    
    #[error("Merge failed: {reason}")]
    MergeFailed { reason: String },
    
    #[error("Split failed on page {page}: {reason}")]
    SplitFailed { page: u32, reason: String },
    
    #[error("PDF library error: {0}")]
    LibraryError(String),
    
    #[error("PDF processing failed: {reason}")]
    ProcessingFailed { reason: String },
    
    #[error("Page {page} not found in PDF: {path}")]
    PageNotFound { path: PathBuf, page: u32 },
}

/// Erros de configuração da aplicação
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Missing required configuration: {key}")]
    MissingConfig { key: String },
    
    #[error("Invalid configuration for {key}: {value}")]
    InvalidConfig { key: String, value: String },
    
    #[error("Failed to load configuration: {reason}")]
    LoadFailed { reason: String },
}

// ==================== TYPE ALIASES ====================

/// Type alias padrão para Result com AppError
pub type Result<T> = std::result::Result<T, AppError>;

/// Type alias para resultados com anyhow (erros em pontos de entrada)
pub type AnyResult<T> = anyhow::Result<T>;

// ==================== IMPLEMENTAÇÕES PARA APPERROR ====================

impl AppError {
    /// Cria um erro de validação de forma conveniente
    pub fn validation(msg: impl Into<String>) -> Self {
        AppError::Validation(ValidationError::InvalidInput {
            message: msg.into(),
        })
    }
    
    /// Cria um erro de processamento de forma conveniente
    pub fn processing(msg: impl Into<String>) -> Self {
        AppError::Pdf(PdfError::ProcessingFailed {
            reason: msg.into(),
        })
    }
    
    /// Cria um erro de configuração de forma conveniente
    pub fn config(msg: impl Into<String>) -> Self {
        AppError::Config(ConfigError::LoadFailed {
            reason: msg.into(),
        })
    }
    
    /// Cria um erro de serialização de forma conveniente
    pub fn serialization(msg: impl Into<String>) -> Self {
        AppError::Io(IoError::SerializationFailed {
            message: msg.into(),
        })
    }
    
    /// Cria um erro de ação desconhecida
    pub fn unknown_action(action: &str) -> Self {
        AppError::Validation(ValidationError::UnknownAction { action: action.to_string() })
    }
    
    /// Converte de std::io::Error com contexto
    pub fn from_io_error(context: &str, path: PathBuf, source: std::io::Error) -> Self {
        AppError::Io(IoError::ReadFailed {
            path,
            source,
        })
    }
    
    /// Converte de uma string (para compatibilidade com código antigo)
    pub fn from_string(msg: impl Into<String>) -> Self {
        AppError::Legacy(msg.into())
    }
    
    /// Obtém o código do erro para identificação
    pub fn error_code(&self) -> &'static str {
        match self {
            AppError::Io(_) => "IO_ERROR",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::Pdf(_) => "PDF_ERROR",
            AppError::Config(_) => "CONFIG_ERROR",
            AppError::Api(_) => "API_ERROR",
            AppError::Legacy(_) => "LEGACY_ERROR",
        }
    }
    
    /// Verifica se é um erro de validação
    pub fn is_validation_error(&self) -> bool {
        matches!(self, AppError::Validation(_))
    }
    
    /// Verifica se é um erro de I/O
    pub fn is_io_error(&self) -> bool {
        matches!(self, AppError::Io(_))
    }
    
    /// Converte para JSON para comunicação com frontend
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "success": false,
            "error": {
                "code": self.error_code(),
                "message": self.to_string(),
                "type": format!("{:?}", self),
            }
        })
    }
}

// ==================== CONVERSÕES PARA COMPATIBILIDADE ====================

// Converte de String para AppError (para compatibilidade)
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Legacy(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Legacy(s.to_string())
    }
}

// Converte de std::io::Error para AppError
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::Io(IoError::ReadFailed {
            path: PathBuf::from("unknown"),
            source: error,
        })
    }
}

// Mantém compatibilidade com struct AppError antiga
impl From<crate::utils::error_handling::AppError> for std::io::Error {
    fn from(error: crate::utils::error_handling::AppError) -> Self {
        std::io::Error::new(std::io::ErrorKind::Other, error.to_string())
    }
}

// ==================== HELPER FUNCTIONS ====================

/// Helper para validações rápidas
pub fn validate(condition: bool, error: impl Into<AppError>) -> Result<()> {
    if condition {
        Ok(())
    } else {
        Err(error.into())
    }
}

/// Valida que uma lista não está vazia
pub fn validate_not_empty<T>(items: &[T], error_msg: &str) -> Result<()> {
    validate(!items.is_empty(), AppError::validation(error_msg))
}

/// Valida o tamanho de um arquivo
pub fn validate_file_size(path: &PathBuf, size: u64, max_size: u64) -> Result<()> {
    if size > max_size {
        Err(AppError::Validation(ValidationError::FileTooLarge {
            path: path.clone(),
            size,
            max: max_size,
        }))
    } else {
        Ok(())
    }
}

// ==================== TRAIT EXTENSIONS ====================

/// Extensão para Option para conversão com mensagem de erro
pub trait OptionExt<T> {
    fn ok_or_error(self, error: impl Into<AppError>) -> Result<T>;
    fn ok_or_empty_file_list(self) -> Result<T>;
}

impl<T> OptionExt<T> for Option<T> {
    fn ok_or_error(self, error: impl Into<AppError>) -> Result<T> {
        self.ok_or_else(|| error.into())
    }
    
    fn ok_or_empty_file_list(self) -> Result<T> {
        self.ok_or_else(|| {
            AppError::Validation(ValidationError::EmptyFileList)
        })
    }
}

/// Extensão para Result para adicionar contexto
pub trait ResultExt<T, E> {
    fn with_path_context(self, path: PathBuf) -> Result<T>
    where
        E: Into<AppError>;
        
    fn with_context(self, context: &str) -> Result<T>
    where
        E: Into<AppError>;
}

impl<T, E> ResultExt<T, E> for std::result::Result<T, E>
where
    E: Into<AppError>,
{
    fn with_path_context(self, path: PathBuf) -> Result<T> {
        self.map_err(|e| {
            let app_error: AppError = e.into();
            match app_error {
                AppError::Io(IoError::ReadFailed { source, .. }) => {
                    AppError::Io(IoError::ReadFailed { path, source })
                }
                AppError::Io(IoError::WriteFailed { source, .. }) => {
                    AppError::Io(IoError::WriteFailed { path, source })
                }
                _ => app_error,
            }
        })
    }
    
    fn with_context(self, context: &str) -> Result<T> {
        self.map_err(|e| {
            let error: AppError = e.into();
            AppError::Legacy(format!("{}: {}", context, error))
        })
    }
}

// ==================== TESTES ====================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;

    #[test]
    fn test_validation_error_creation() {
        let error = AppError::validation("Input is invalid");
        assert!(error.is_validation_error());
        assert_eq!(error.error_code(), "VALIDATION_ERROR");
        
        let json = error.to_json();
        assert_eq!(json["success"], false);
        assert_eq!(json["error"]["code"], "VALIDATION_ERROR");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_error = io::Error::new(io::ErrorKind::NotFound, "File not found");
        let app_error: AppError = io_error.into();
        
        assert!(app_error.is_io_error());
        assert_eq!(app_error.error_code(), "IO_ERROR");
    }

    #[test]
    fn test_string_conversion() {
        let error: AppError = "Test error".into();
        match error {
            AppError::Legacy(msg) => assert_eq!(msg, "Test error"),
            _ => panic!("Expected Legacy error"),
        }
    }

    #[test]
    fn test_validate_helper() {
        let result = validate(true, "Should not error");
        assert!(result.is_ok());
        
        let result = validate(false, AppError::validation("Test error"));
        assert!(result.is_err());
        
        if let Err(AppError::Validation(ValidationError::InvalidInput { message })) = result {
            assert_eq!(message, "Test error");
        } else {
            panic!("Expected validation error");
        }
    }

    #[test]
    fn test_option_ext() {
        let some_value: Option<i32> = Some(42);
        let result = some_value.ok_or_error("Error message");
        assert_eq!(result.unwrap(), 42);
        
        let none_value: Option<i32> = None;
        let result = none_value.ok_or_error(AppError::validation("Empty"));
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_not_empty() {
        let empty: Vec<i32> = vec![];
        let result = validate_not_empty(&empty, "List is empty");
        assert!(result.is_err());
        
        let non_empty = vec![1, 2, 3];
        let result = validate_not_empty(&non_empty, "List is empty");
        assert!(result.is_ok());
    }
}