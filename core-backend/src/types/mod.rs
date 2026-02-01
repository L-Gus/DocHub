//! Módulo de tipos do DocHub
//!
//! Define todos os tipos de dados utilizados no sistema, organizados por domínio.
//! Inclui tipos para API, PDFs, configurações e utilitários.
//!
//! ## Organização:
//! - `api_types`: Tipos para comunicação frontend/backend
//! - `pdf_types`: Tipos específicos do domínio PDF
//!
//! ## Princípios:
//! 1. Tipos fortemente tipados para segurança
//! 2. Documentação completa e exemplos
//! 3. Validações embutidas quando apropriado
//! 4. Compatibilidade com serialização JSON
//! 5. Separação clara entre entrada, processamento e saída

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::utils::error_handling::{Result, AppError, ValidationError};

pub mod api_types;
pub mod pdf_types;

// Re-exports principais para facilitar imports
pub use api_types::{
    ApiAction, ApiRequest, ApiResponse, ApiError,
    MergeRequest, SplitRequest, ValidateRequest, MetadataRequest,
};
pub use pdf_types::{
    PdfId, PdfDocument, PdfMetadata, PdfOperation,
    DocumentStatus, FilePermissions,
};

// Re-exports de constantes
pub use api_types::API_VERSION;

// Re-exports de enums
pub use pdf_types::{IssueSeverity};

// Re-exports de tipos utilitários
// pub use pdf_types::{FileMetadata, ProcessingMetrics};

// ==================== TIPOS COMUNS ====================

/// Resultado genérico de operações
pub type OperationResult<T> = Result<T>;

/// Timestamp para auditoria
pub type Timestamp = chrono::DateTime<chrono::Utc>;

/// Caminho de arquivo validado
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatedPath(pub PathBuf);

impl ValidatedPath {
    /// Cria um caminho validado
    pub fn new(path: PathBuf) -> Result<Self> {
        // Validações básicas de segurança
        if path.is_absolute() {
            return Err(AppError::Validation(ValidationError::InvalidInput {
                message: "Absolute paths not allowed".to_string(),
            }));
        }

        // Verifica caracteres perigosos
        let path_str = path.to_string_lossy();
        if path_str.contains("..") || path_str.contains("\\") {
            return Err(AppError::Validation(ValidationError::InvalidInput {
                message: "Invalid path characters".to_string(),
            }));
        }

        Ok(Self(path))
    }

    /// Retorna o caminho interno
    pub fn as_path(&self) -> &Path {
        &self.0
    }
}

impl AsRef<Path> for ValidatedPath {
    fn as_ref(&self) -> &Path {
        &self.0
    }
}

// ==================== VALIDAÇÕES COMUNS ====================

/// Valida se uma string não está vazia
pub fn validate_non_empty(s: &str, field: &str) -> Result<()> {
    if s.trim().is_empty() {
        return Err(AppError::Validation(ValidationError::InvalidInput {
            message: format!("Field '{}' cannot be empty", field),
        }));
    }
    Ok(())
}

/// Valida se um número está em um intervalo
pub fn validate_range<T: PartialOrd + std::fmt::Display>(
    value: T,
    min: T,
    max: T,
    field: &str
) -> Result<()> {
    if value < min || value > max {
        return Err(AppError::Validation(ValidationError::InvalidInput {
            message: format!("Value {} for field '{}' must be between {} and {}", value, field, min, max),
        }));
    }
    Ok(())
}

// ==================== CONSTANTES ====================

/// Tamanho máximo de arquivo aceito (100MB)
pub const MAX_FILE_SIZE: u64 = 100 * 1024 * 1024;

/// Número máximo de arquivos por operação
pub const MAX_FILES_PER_OPERATION: usize = 10;

/// Timeout padrão para operações (5 minutos)
pub const DEFAULT_TIMEOUT_SECS: u64 = 300;
