//! Middleware para processamento comum de requests
//!
//! Middleware são componentes que interceptam e processam requests
//! antes ou depois dos handlers principais.

use std::sync::Arc;
use tokio::sync::RwLock;
use crate::types::api_types::{ApiRequest, ApiResponse, ApiError};
use crate::utils::error_handling::Result;

/// Cadeia de middleware
pub struct MiddlewareChain {
    middlewares: Vec<Box<dyn ApiMiddleware + Send + Sync>>,
}

impl std::fmt::Debug for MiddlewareChain {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MiddlewareChain")
            .field("middlewares_count", &self.middlewares.len())
            .finish()
    }
}

/// Middleware individual
#[async_trait::async_trait]
pub trait ApiMiddleware: Send + Sync {
    async fn process(&self, context: &mut RequestContext) -> Result<()>;
}

/// Contexto da requisição
#[derive(Debug, Clone)]
pub struct RequestContext {
    pub request: ApiRequest,
    pub response: Option<ApiResponse>,
}

impl MiddlewareChain {
    /// Cria uma nova cadeia de middleware
    pub fn new() -> Self {
        Self {
            middlewares: Vec::new(),
        }
    }

    /// Registra um middleware na cadeia
    pub fn register(&mut self, middleware: Box<dyn ApiMiddleware + Send + Sync>) {
        self.middlewares.push(middleware);
    }

    /// Executa todos os middlewares na cadeia
    pub async fn execute(&self, context: &mut RequestContext) -> Result<()> {
        for middleware in &self.middlewares {
            middleware.process(context).await?;
        }
        Ok(())
    }

    /// Retorna o número de middlewares na cadeia
    pub fn count(&self) -> usize {
        self.middlewares.len()
    }
}

impl Default for MiddlewareChain {
    fn default() -> Self {
        Self::new()
    }
}

impl RequestContext {
    /// Cria um novo contexto de requisição
    pub fn new(request: ApiRequest) -> Self {
        Self {
            request,
            response: None,
        }
    }
}

/// Middleware de logging
pub struct LoggingMiddleware;

#[async_trait::async_trait]
impl ApiMiddleware for LoggingMiddleware {
    async fn process(&self, context: &mut RequestContext) -> Result<()> {
        tracing::info!("Processing request: {}", context.request.action);
        Ok(())
    }
}

/// Middleware de validação
pub struct ValidationMiddleware;

#[async_trait::async_trait]
impl ApiMiddleware for ValidationMiddleware {
    async fn process(&self, context: &mut RequestContext) -> Result<()> {
        // Validação básica - action é sempre válido pois é enum
        // Podemos adicionar outras validações aqui
        Ok(())
    }
}

/// Middleware de métricas
pub struct MetricsMiddleware;

#[async_trait::async_trait]
impl ApiMiddleware for MetricsMiddleware {
    async fn process(&self, context: &mut RequestContext) -> Result<()> {
        // TODO: Implementar métricas
        Ok(())
    }
}