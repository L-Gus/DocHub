//! Sistema de roteamento e despacho
//!
//! Responsável por mapear requests para os handlers apropriados
//! baseado no tipo de operação e parâmetros.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::types::api_types::{ApiRequest, ApiResponse, ApiError, ApiAction};
use crate::utils::error_handling::Result;

/// Router principal da API
#[derive(Debug)]
pub struct ApiRouter {
    routes: RwLock<HashMap<ApiAction, Route>>,
}

/// Representa uma rota
pub struct Route {
    pub action: ApiAction,
    pub method: String,
    pub path: String,
    pub handler: Arc<dyn RouteHandler + Send + Sync>,
}

impl std::fmt::Debug for Route {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Route")
            .field("action", &self.action)
            .field("method", &self.method)
            .field("path", &self.path)
            .field("handler", &"<handler>")
            .finish()
    }
}

/// Handler de rota
#[async_trait::async_trait]
pub trait RouteHandler: Send + Sync {
    async fn handle(&self, request: ApiRequest) -> Result<ApiResponse>;
}

impl ApiRouter {
    /// Cria um novo router
    pub fn new() -> Self {
        Self {
            routes: RwLock::new(HashMap::new()),
        }
    }

    /// Registra uma nova rota
    pub async fn register(&self, route: Route) -> Result<()> {
        let mut routes = self.routes.write().await;
        routes.insert(route.action.clone(), route);
        Ok(())
    }

    /// Roteia uma requisição para o handler apropriado
    pub async fn route(&self, request: &ApiRequest) -> Result<ApiResponse> {
        let routes = self.routes.read().await;

        // Encontra a rota baseada no tipo de operação
        if let Some(route) = routes.get(&request.action) {
            route.handler.handle(request.clone()).await
        } else {
            Err(ApiError::unknown_action(&format!("{:?}", request.action)).into())
        }
    }

    /// Retorna o número de rotas registradas
    pub async fn route_count(&self) -> usize {
        let routes = self.routes.read().await;
        routes.len()
    }
}

impl Route {
    /// Cria uma nova rota
    pub fn new(
        action: ApiAction,
        method: &str,
        path: &str,
        handler: Arc<dyn RouteHandler + Send + Sync>,
    ) -> Self {
        Self {
            action,
            method: method.to_string(),
            path: path.to_string(),
            handler,
        }
    }
}