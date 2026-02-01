//! Validação de requests
//!
//! Responsável por validar e sanitizar requests antes do processamento.

use crate::types::api_types::{ApiRequest, ApiResponse, ApiError};
use crate::utils::error_handling::Result;

/// Validador de requests
pub struct RequestValidator;

/// Regras de validação
pub struct ValidationRules;