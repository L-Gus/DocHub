//! # DocHub Core Library
//! 
//! Biblioteca principal do backend DocHub. Responsável pelo processamento de PDFs
//! e comunicação com o frontend Electron.
//! 
//! ## Organização de Módulos
//! - `api`: Handlers IPC e endpoints da aplicação
//! - `processors`: Processadores de documentos (merge, split, etc.)
//! - `types`: Estruturas de dados e tipos do domínio
//! - `utils`: Utilitários compartilhados (erros, logging, config)

// Re-exportações públicas para facilitar o uso externo
pub mod api;
pub mod processors;
pub mod types;
pub mod utils;

// Re-exporta tipos comuns para facilitar imports
pub use utils::error_handling::{AppError, Result};

use serde_json::{Value, json};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Contexto da aplicação compartilhado entre handlers
#[derive(Debug, Clone)]
pub struct AppContext {
    /// Configurações da aplicação
    pub config: Arc<utils::config::AppConfig>,
    /// Estado compartilhado (thread-safe)
    pub state: Arc<Mutex<AppState>>,
}

/// Estado interno da aplicação
#[derive(Debug, Default)]
pub struct AppState {
    /// Contador de operações processadas
    pub processed_operations: u64,
    /// Cache de metadados de PDF (se implementado futuramente)
    pub pdf_cache: std::collections::HashMap<String, types::pdf_types::PdfMetadata>,
}

impl AppContext {
    /// Cria um novo contexto da aplicação
    pub async fn new() -> Result<Self> {
        let config = utils::config::AppConfig::default()
            .map_err(|e| AppError::config(format!("Failed to load config: {}", e)))?;
        
        let state = Arc::new(Mutex::new(AppState::default()));
        
        Ok(Self {
            config: Arc::new(config),
            state,
        })
    }
}

/// Ponto de entrada principal para processamento de comandos (assíncrono)
///
/// # Arguments
/// * `action` - Ação a ser executada ("merge", "split", etc.)
/// * `data` - Dados da requisição em JSON
/// 
/// # Returns
/// `Result<Value>` - Resposta serializada em JSON ou erro
/// 
/// # Errors
/// Retorna `AppError` se:
/// - A ação for desconhecida
/// - Os dados forem inválidos
/// - O processamento falhar
pub async fn process_command(action: String, data: Value) -> Result<Value> {
    // Log da requisição recebida
    tracing::debug!("Processing command: {}", action);
    
    // Processa baseado na ação
    match action.as_str() {
        "merge" => handle_merge(data).await,
        "split" => handle_split(data).await,
        "validate" => handle_validate(data).await,
        "get_metadata" => handle_get_metadata(data).await,
        "health_check" => Ok(json!({"status": "ok", "version": "0.1.0"})),
        _ => Err(AppError::unknown_action(&action)),
    }
}

/// Handler para ação de merge de PDFs (assíncrono)
async fn handle_merge(data: Value) -> Result<Value> {
    tracing::info!("Handling merge request");
    
    // Valida e converte os dados de entrada
    let merge_request = processors::pdf_merger::MergeRequest::from_value(&data)
        .map_err(|e| AppError::validation(format!("Invalid merge request: {}", e)))?;
    
    // Executa o processamento (assíncrono)
    let result = processors::pdf_merger::merge_pdfs(serde_json::to_value(merge_request).unwrap())
        .await
        .map_err(|e| AppError::processing(format!("Merge failed: {}", e)))?;
    
    // Retorna o resultado serializado
    Ok(serde_json::to_value(result)
        .map_err(|e| AppError::serialization(format!("Failed to serialize merge result: {}", e)))?)
}

/// Handler para ação de split de PDF (assíncrono)
async fn handle_split(data: Value) -> Result<Value> {
    tracing::info!("Handling split request");
    
    let result = processors::pdf_splitter::split_pdf(data)
        .await
        .map_err(|e| AppError::processing(format!("Split failed: {}", e)))?;
    
    Ok(result)
}

/// Handler para validação de PDF (assíncrono)
async fn handle_validate(data: Value) -> Result<Value> {
    tracing::debug!("Handling validate request");
    
    let result = processors::pdf_validator::validate_pdf(data)
        .await
        .map_err(|e| AppError::processing(format!("Validation failed: {}", e)))?;
    
    Ok(result)
}

/// Handler para obtenção de metadados (assíncrono)
async fn handle_get_metadata(data: Value) -> Result<Value> {
    tracing::debug!("Handling get_metadata request");
    
    let result = processors::pdf_validator::get_pdf_metadata(data)
        .await
        .map_err(|e| AppError::processing(format!("Failed to get metadata: {}", e)))?;
    
    Ok(result)
}

/// Inicializa o contexto da aplicação (assíncrono)
///
/// # Example
/// ```rust
/// use dochub_backend::init_app;
/// 
/// #[tokio::main]
/// async fn main() {
///     let context = init_app().await.expect("Failed to initialize app");
/// }
/// ```
pub async fn init_app() -> Result<AppContext> {
    // Inicializa o sistema de logging
    init_logging();
    
    AppContext::new().await
}

/// Inicializa o sistema de logging
fn init_logging() {
    // Configuração básica do tracing
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set tracing subscriber");
    
    tracing::info!("Logging system initialized");
}

// ==================== VERSÃO SÍNCRONA (COMPATIBILIDADE) ====================

/// Versão síncrona para compatibilidade com código existente
#[deprecated(note = "Use process_command_async instead")]
pub fn process_command_sync(action: String, data: Value) -> Value {
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    match rt.block_on(process_command(action, data)) {
        Ok(result) => result,
        Err(e) => json!({
            "success": false,
            "error": e.to_string(),
            "error_type": format!("{:?}", e)
        }),
    }
}

// ==================== TESTES ====================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn test_process_command_unknown_action() {
        let request = json!({
            "files": ["test.pdf"],
            "output": "output.pdf"
        });
        
        let result = process_command("unknown_action".to_string(), request).await;
        assert!(result.is_err());
        
        if let Err(AppError::Unknown(ref msg)) = result.unwrap_err() {
            assert!(msg.contains("unknown_action"));
        }
    }

    #[tokio::test]
    async fn test_process_command_health_check() {
        let result = process_command("health_check".to_string(), json!({})).await;
        assert!(result.is_ok());
        
        let value = result.unwrap();
        assert_eq!(value["status"], "ok");
        assert_eq!(value["version"], "0.1.0");
    }

    #[tokio::test]
    async fn test_init_app_creates_context() {
        // Para teste, podemos mockar a configuração
        // Por enquanto, testamos apenas que a função não panica
        let result = init_app().await;
        // Pode falhar em ambiente de teste sem config, isso é ok
        println!("Init app result: {:?}", result);
    }
}