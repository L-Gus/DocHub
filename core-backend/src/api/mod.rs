//! Módulo de API do DocHub
//! 
//! Responsável por gerenciar todos os handlers e roteamento de requisições
//! entre o frontend Electron e o backend Rust.
//! 
//! ## Organização:
//! - `handlers/`: Handlers específicos por domínio
//! - `middleware/`: Middleware para processamento comum
//! - `router/`: Sistema de roteamento e despacho
//! - `validation/`: Validação de requests
//! 
//! ## Fluxo de uma requisição:
//! 1. Request recebida do frontend (JSON via IPC)
//! 2. Validação e parsing para tipos fortemente tipados
//! 3. Roteamento para handler específico
//! 4. Processamento com middleware
//! 5. Resposta serializada para JSON

pub mod file_handlers;
pub mod handlers;
pub mod middleware;
pub mod pdf_handlers;
pub mod router;
pub mod validation;

// Re-export para facilitar imports
pub use handlers::{PdfHandler, FileHandler, SystemHandler, HealthHandler};
pub use file_handlers::FileHandler as FileOpsHandler;
pub use router::{ApiRouter, Route, RouteHandler};
pub use middleware::{MiddlewareChain, ApiMiddleware, RequestContext};
pub use validation::{RequestValidator, ValidationRules};

use crate::types::api_types::{ApiRequest, ApiResponse, ApiError, ApiAction};
use crate::utils::error_handling::Result;
use crate::utils::config::ConfigManager;
use std::sync::Arc;
use tracing::{info, error, instrument};

/// Contexto da API compartilhado entre handlers
#[derive(Debug, Clone)]
pub struct ApiContext {
    /// Gerenciador de configuração
    pub config_manager: Arc<ConfigManager>,
    /// Router da API
    pub router: Arc<ApiRouter>,
    /// Cadeia de middleware
    pub middleware: Arc<MiddlewareChain>,
}

impl ApiContext {
    /// Cria um novo contexto da API
    pub async fn new(config_manager: Arc<ConfigManager>) -> Result<Self> {
        // Cria o router
        let router = Arc::new(ApiRouter::new());

        // Cria a cadeia de middleware
        let mut middleware_chain = MiddlewareChain::new();
        middleware_chain.register(Box::new(middleware::LoggingMiddleware));
        middleware_chain.register(Box::new(middleware::ValidationMiddleware));
        middleware_chain.register(Box::new(middleware::MetricsMiddleware));
        let middleware = Arc::new(middleware_chain);

        let context = Self {
            config_manager,
            router,
            middleware,
        };

        // Registra todas as rotas
        context.register_routes().await?;

        info!("API context initialized successfully");
        Ok(context)
    }
    
    /// Registra todas as rotas da API
    async fn register_routes(&self) -> Result<()> {
        info!("Registering API routes");
        
        // Handlers
        let pdf_handler = Arc::new(PdfHandler::new());
        let file_handler = Arc::new(FileHandler::new());
        let system_handler = Arc::new(SystemHandler::new());
        let health_handler = Arc::new(HealthHandler::new());
        
        // ==================== ROTAS DE PDF ====================
        
        // Merge
        self.router.register(Route::new(
            ApiAction::Merge,
            "POST",
            "/api/v1/pdf/merge",
            pdf_handler.clone(),
        )).await?;
        
        // Split
        self.router.register(Route::new(
            ApiAction::Split, 
            "POST",
            "/api/v1/pdf/split",
            pdf_handler.clone(),
        )).await?;
        
        // Validate
        self.router.register(Route::new(
            ApiAction::Validate,
            "POST", 
            "/api/v1/pdf/validate",
            pdf_handler.clone(),
        )).await?;
        
        // Metadata
        self.router.register(Route::new(
            ApiAction::GetMetadata,
            "GET",
            "/api/v1/pdf/metadata",
            pdf_handler.clone(),
        )).await?;
        
        // ==================== ROTAS DE ARQUIVO ====================
        
        // List files
        self.router.register(Route::new(
            ApiAction::ListFiles,
            "GET",
            "/api/v1/files/list",
            file_handler.clone(),
        )).await?;
        
        // Create directory
        self.router.register(Route::new(
            ApiAction::CreateDirectory,
            "POST",
            "/api/v1/files/directory",
            file_handler.clone(),
        )).await?;
        
        // Remove path
        self.router.register(Route::new(
            ApiAction::RemovePath,
            "DELETE",
            "/api/v1/files/path",
            file_handler.clone(),
        )).await?;
        
        // File exists - This might need a new enum variant, but for now let's use ListFiles
        self.router.register(Route::new(
            ApiAction::ListFiles,
            "GET",
            "/api/v1/files/exists",
            file_handler.clone(),
        )).await?;
        
        // ==================== ROTAS DO SISTEMA ====================
        
        // System info
        self.router.register(Route::new(
            ApiAction::GetSystemInfo,
            "GET",
            "/api/v1/system/info",
            system_handler.clone(),
        )).await?;
        
        // Config
        self.router.register(Route::new(
            ApiAction::GetConfig,
            "GET",
            "/api/v1/system/config",
            system_handler.clone(),
        )).await?;
        
        // Update config
        self.router.register(Route::new(
            ApiAction::UpdateConfig,
            "PUT",
            "/api/v1/system/config",
            system_handler.clone(),
        )).await?;
        
        // ==================== ROTAS DE HEALTH ====================
        
        // Health check
        self.router.register(Route::new(
            ApiAction::HealthCheck,
            "GET",
            "/api/v1/health",
            health_handler.clone(),
        )).await?;
        
        // Metrics
        self.router.register(Route::new(
            ApiAction::GetMetrics,
            "GET",
            "/api/v1/health/metrics",
            health_handler.clone(),
        )).await?;
        
        info!("Registered {} API routes", self.router.route_count().await);
        Ok(())
    }
    
    /// Processa uma requisição da API
    #[instrument(name = "api_process_request", skip(self), fields(request_id = %request.request_id))]
    pub async fn process_request(&self, request: ApiRequest) -> Result<ApiResponse> {
        let start_time = std::time::Instant::now();
        
        info!(
            "Processing API request: {} [{}]",
            request.request_id,
            request.action.as_str()
        );
        
        // Cria contexto da requisição
        let mut context = RequestContext::new(request);
        
        // Executa middleware
        self.middleware.execute(&mut context).await?;
        
        // Roteia para handler apropriado
        let response = match self.router.route(&context.request).await {
            Ok(response) => response,
            Err(e) => {
                error!(
                    request_id = %context.request.request_id,
                    error = %e,
                    "Failed to route request"
                );
                
                ApiResponse::error(
                    &context.request.request_id,
                    ApiError {
                        code: "ROUTING_ERROR".to_string(),
                        message: "Failed to route request".to_string(),
                        details: Some(e.to_string()),
                        error_type: crate::types::api_types::ErrorType::Server,
                        suggested_action: Some("Check the API endpoint and try again".to_string()),
                        stack_trace: None,
                    }
                )
            }
        };
        
        let processing_time = start_time.elapsed();
        
        info!(
            request_id = %context.request.request_id,
            processing_time_ms = processing_time.as_millis(),
            success = response.success,
            "Request processing completed"
        );
        
        Ok(response.with_processing_time(context.request.timestamp))
    }
    
    /// Processa uma requisição a partir de JSON bruto (para compatibilidade com IPC)
    #[instrument(name = "api_process_raw", skip(self, raw_json))]
    pub async fn process_raw_request(&self, raw_json: serde_json::Value) -> Result<ApiResponse> {
        // Converte JSON para ApiRequest
        let request: ApiRequest = raw_json.try_into()
            .map_err(|e| {
                error!("Failed to parse API request: {}", e);
                e
            })?;
        
        // Processa a requisição
        self.process_request(request).await
    }
    
    /// Obtém estatísticas da API
    pub async fn get_stats(&self) -> ApiStats {
        ApiStats {
            total_routes: self.router.route_count().await,
            middleware_count: 3, // TODO: Implementar contagem real de middleware
            uptime_seconds: 0, // Seria calculado baseado no tempo de inicialização
        }
    }
}

/// Estatísticas da API
#[derive(Debug, Clone, serde::Serialize)]
pub struct ApiStats {
    pub total_routes: usize,
    pub middleware_count: usize,
    pub uptime_seconds: u64,
}

// ==================== FUNÇÕES DE CONVENIÊNCIA ====================

/// Inicializa o contexto da API
pub async fn init_api(config_manager: Arc<ConfigManager>) -> Result<ApiContext> {
    ApiContext::new(config_manager).await
}

/// Processa uma requisição usando o contexto global da API
pub async fn process_api_request(request: ApiRequest) -> Result<ApiResponse> {
    use once_cell::sync::OnceCell;
    use tokio::sync::Mutex;
    
    static API_CONTEXT: OnceCell<Mutex<Option<Arc<ApiContext>>>> = OnceCell::new();
    
    let context_cell = API_CONTEXT.get_or_init(|| Mutex::new(None));
    let mut context_lock = context_cell.lock().await;
    
    if (*context_lock).is_none() {
        // Precisa inicializar a configuração primeiro
        let config_manager = crate::utils::config::init_config().await?;
        let api_context = init_api(Arc::new(config_manager)).await?;
        *context_lock = Some(Arc::new(api_context));
    }
    
    context_lock.as_ref().unwrap().process_request(request).await
}

// ==================== TESTES ====================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::api_types::{ApiAction, ApiRequest};
    use serde_json::json;
    
    #[tokio::test]
    async fn test_api_context_creation() -> Result<()> {
        let config_manager = Arc::new(crate::utils::config::ConfigManager::new().await?);
        let context = ApiContext::new(config_manager).await?;
        
        assert!(context.router.route_count() > 0);
        assert!(context.middleware.count() > 0);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_api_process_raw_request() -> Result<()> {
        let config_manager = Arc::new(crate::utils::config::ConfigManager::new().await?);
        let context = ApiContext::new(config_manager).await?;
        
        // Testa uma requisição de health check
        let raw_request = json!({
            "request_id": "test-123",
            "action": "health_check",
            "data": {},
            "timestamp": 1234567890,
            "api_version": crate::types::api_types::API_VERSION,
            "metadata": {}
        });
        
        let response = context.process_raw_request(raw_request).await?;
        
        assert_eq!(response.request_id, "test-123");
        // Health check deve sempre retornar sucesso
        assert!(response.success);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_api_process_request_validation_error() -> Result<()> {
        let config_manager = Arc::new(crate::utils::config::ConfigManager::new().await?);
        let context = ApiContext::new(config_manager).await?;
        
        // Request inválida (sem request_id)
        let raw_request = json!({
            "action": "merge",
            "data": {},
            "timestamp": 1234567890,
            "api_version": crate::types::api_types::API_VERSION,
        });
        
        let response = context.process_raw_request(raw_request).await;
        
        // Deve falhar na validação/parsing
        assert!(response.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_api_get_stats() -> Result<()> {
        let config_manager = Arc::new(crate::utils::config::ConfigManager::new().await?);
        let context = ApiContext::new(config_manager).await?;
        
        let stats = context.get_stats().await;
        
        assert!(stats.total_routes > 0);
        assert!(stats.middleware_count > 0);
        
        Ok(())
    }
}