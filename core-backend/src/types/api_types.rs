//! Tipos de API para comunicação entre frontend e backend
//! 
//! Define os contratos de comunicação (request/response) entre o Electron (frontend)
//! e o Rust (backend). Todos os tipos devem ser serializáveis via serde.
//! 
//! ## Princípios:
//! 1. Tipos fortemente tipados para evitar erros
//! 2. Validações embutidas sempre que possível
//! 3. Semântica clara nos nomes e estruturas
//! 4. Compatibilidade com JSON para IPC
//! 5. Versão da API para evolução futura

use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};
use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use serde_json::Value;
use tracing::{error, warn};

impl fmt::Display for ApiAction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

use crate::utils::error_handling::{Result, AppError};
use crate::processors::pdf_validator::{ValidationLevel, ValidationConfig};

// ==================== CONSTANTES DA API ====================

/// Versão atual da API
pub const API_VERSION: &str = "1.0.0";

/// Ações suportadas pela API
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ApiAction {
    /// Merge de múltiplos PDFs
    Merge,
    /// Split de PDF por intervalos
    Split,
    /// Validação de PDF
    Validate,
    /// Obtenção de metadados de PDF
    GetMetadata,
    /// Verificação de saúde do backend
    HealthCheck,
    /// Listagem de arquivos em diretório
    ListFiles,
    /// Criação de diretório
    CreateDirectory,
    /// Remoção de arquivo/diretório
    RemovePath,
    /// Informações do sistema
    GetSystemInfo,
    /// Obter configuração
    GetConfig,
    /// Atualizar configuração
    UpdateConfig,
    /// Métricas de saúde
    GetMetrics,
}

impl ApiAction {
    /// Converte string para ação
    pub fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "merge" => Ok(Self::Merge),
            "split" => Ok(Self::Split),
            "validate" => Ok(Self::Validate),
            "get_metadata" => Ok(Self::GetMetadata),
            "health_check" | "health" => Ok(Self::HealthCheck),
            "list_files" => Ok(Self::ListFiles),
            "create_directory" => Ok(Self::CreateDirectory),
            "remove_path" => Ok(Self::RemovePath),
            "get_system_info" => Ok(Self::GetSystemInfo),
            "get_config" => Ok(Self::GetConfig),
            "update_config" => Ok(Self::UpdateConfig),
            "get_metrics" => Ok(Self::GetMetrics),
            _ => Err(AppError::validation(format!("Unknown API action: {}", s))),
        }
    }

    /// Converte ação para string
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Merge => "merge",
            Self::Split => "split",
            Self::Validate => "validate",
            Self::GetMetadata => "get_metadata",
            Self::HealthCheck => "health_check",
            Self::ListFiles => "list_files",
            Self::CreateDirectory => "create_directory",
            Self::RemovePath => "remove_path",
            Self::GetSystemInfo => "get_system_info",
            Self::GetConfig => "get_config",
            Self::UpdateConfig => "update_config",
            Self::GetMetrics => "get_metrics",
        }
    }
}

// ==================== REQUEST/RESPONSE BASE ====================

/// Request genérica da API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiRequest {
    /// ID único da requisição (para tracking)
    pub request_id: String,
    /// Ação a ser executada
    pub action: ApiAction,
    /// Dados da requisição (depende da ação)
    pub data: Value,
    /// Timestamp da requisição (milissegundos desde Unix epoch)
    pub timestamp: u128,
    /// Versão da API usada pelo cliente
    pub api_version: String,
    /// Metadados opcionais da requisição
    #[serde(default)]
    pub metadata: RequestMetadata,
}

impl ApiRequest {
    /// Cria uma nova requisição
    pub fn new(action: ApiAction, data: Value) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        Self {
            request_id: generate_request_id(),
            action,
            data,
            timestamp,
            api_version: API_VERSION.to_string(),
            metadata: RequestMetadata::default(),
        }
    }

    /// Valida a estrutura básica da requisição
    pub fn validate(&self) -> Result<()> {
        // Verifica versão da API (permitindo compatibilidade futura)
        if self.api_version != API_VERSION {
            warn!(
                expected_version = API_VERSION,
                received_version = self.api_version,
                "API version mismatch"
            );
            // Não falha, apenas loga warning para compatibilidade
        }

        // Valida que request_id não está vazio
        if self.request_id.is_empty() {
            return Err(AppError::validation("Request ID cannot be empty"));
        }

        Ok(())
    }
}

/// Metadados da requisição
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RequestMetadata {
    /// ID da sessão do usuário (se aplicável)
    pub session_id: Option<String>,
    /// ID do usuário (se autenticado)
    pub user_id: Option<String>,
    /// Informações do cliente (Electron, versão, etc.)
    pub client_info: Option<ClientInfo>,
    /// Parâmetros de debug/desenvolvimento
    #[serde(default)]
    pub debug: DebugOptions,
}

/// Informações do cliente
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    /// Nome do cliente (ex: "DocHub Electron")
    pub name: String,
    /// Versão do cliente
    pub version: String,
    /// Plataforma (ex: "windows", "linux", "macos")
    pub platform: String,
    /// Arquitetura (ex: "x64", "arm64")
    pub architecture: String,
}

/// Opções de debug
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DebugOptions {
    /// Incluir informações detalhadas na resposta
    pub verbose: bool,
    /// Forçar modo de desenvolvimento
    pub force_dev_mode: bool,
    /// Trace ID para correlacionar logs
    pub trace_id: Option<String>,
}

/// Resposta genérica da API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T = Value> {
    /// ID da requisição original
    pub request_id: String,
    /// Sucesso ou falha da operação
    pub success: bool,
    /// Dados da resposta (se sucesso)
    pub data: Option<T>,
    /// Erro (se falha)
    pub error: Option<ApiError>,
    /// Timestamp da resposta
    pub timestamp: u128,
    /// Tempo de processamento em milissegundos
    pub processing_time_ms: u128,
    /// Metadados da resposta
    #[serde(default)]
    pub metadata: ResponseMetadata,
}

impl<T> ApiResponse<T> {
    /// Cria uma resposta de sucesso
    pub fn success(request_id: &str, data: T) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        Self {
            request_id: request_id.to_string(),
            success: true,
            data: Some(data),
            error: None,
            timestamp,
            processing_time_ms: 0, // Será preenchido posteriormente
            metadata: ResponseMetadata::default(),
        }
    }

    /// Cria uma resposta de erro
    pub fn error(request_id: &str, error: ApiError) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        Self {
            request_id: request_id.to_string(),
            success: false,
            data: None,
            error: Some(error),
            timestamp,
            processing_time_ms: 0,
            metadata: ResponseMetadata::default(),
        }
    }

    /// Atualiza o tempo de processamento
    pub fn with_processing_time(mut self, start_time: u128) -> Self {
        let end_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        
        self.processing_time_ms = end_time.saturating_sub(start_time);
        self
    }

    /// Adiciona metadados à resposta
    pub fn with_metadata(mut self, metadata: ResponseMetadata) -> Self {
        self.metadata = metadata;
        self
    }
}

/// Metadados da resposta
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ResponseMetadata {
    /// Avisos não críticos (se houver)
    pub warnings: Vec<String>,
    /// Informações adicionais
    pub info: Vec<String>,
    /// Sugestões para o cliente
    pub suggestions: Vec<String>,
    /// Estatísticas da operação
    #[serde(default)]
    pub stats: OperationStats,
}

/// Estatísticas da operação
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OperationStats {
    /// Número de arquivos processados
    pub files_processed: usize,
    /// Tamanho total processado (bytes)
    pub total_size_bytes: u64,
    /// Número de páginas processadas
    pub pages_processed: usize,
    /// Memória usada (MB, se disponível)
    pub memory_used_mb: Option<f64>,
}

/// Erro da API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    /// Código do erro
    pub code: String,
    /// Mensagem descritiva do erro
    pub message: String,
    /// Detalhes técnicos (para debug)
    pub details: Option<String>,
    /// Tipo do erro
    #[serde(rename = "type")]
    pub error_type: ErrorType,
    /// Ação recomendada
    pub suggested_action: Option<String>,
    /// Stack trace (apenas em desenvolvimento)
    pub stack_trace: Option<String>,
}

impl ApiError {
    /// Cria um erro de validação
    pub fn validation(message: impl Into<String>, details: Option<String>) -> Self {
        Self {
            code: "VALIDATION_ERROR".to_string(),
            message: message.into(),
            details,
            error_type: ErrorType::Validation,
            suggested_action: Some("Verifique os dados fornecidos e tente novamente".to_string()),
            stack_trace: None,
        }
    }

    /// Cria um erro de processamento
    pub fn processing(message: impl Into<String>, details: Option<String>) -> Self {
        Self {
            code: "PROCESSING_ERROR".to_string(),
            message: message.into(),
            details,
            error_type: ErrorType::Processing,
            suggested_action: Some("Tente novamente ou verifique os arquivos de entrada".to_string()),
            stack_trace: None,
        }
    }

    /// Cria um erro de I/O
    pub fn io(message: impl Into<String>, details: Option<String>) -> Self {
        Self {
            code: "IO_ERROR".to_string(),
            message: message.into(),
            details,
            error_type: ErrorType::Io,
            suggested_action: Some("Verifique permissões de arquivo e espaço em disco".to_string()),
            stack_trace: None,
        }
    }

    /// Cria um erro de ação desconhecida
    pub fn unknown_action(action: &str) -> Self {
        Self {
            code: "UNKNOWN_ACTION".to_string(),
            message: format!("Ação desconhecida: {}", action),
            details: Some(format!("Ações suportadas: {}", supported_actions_list())),
            error_type: ErrorType::Client,
            suggested_action: Some("Verifique a documentação da API".to_string()),
            stack_trace: None,
        }
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for ApiError {}

/// Tipo de erro
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorType {
    /// Erro de validação de entrada
    Validation,
    /// Erro de processamento
    Processing,
    /// Erro de I/O (arquivos, rede, etc.)
    Io,
    /// Erro de configuração
    Configuration,
    /// Erro do cliente (request inválida)
    Client,
    /// Erro interno do servidor
    Server,
    /// Erro de timeout
    Timeout,
    /// Erro de permissão
    Permission,
}

// ==================== TIPOS ESPECÍFICOS DE REQUESTS ====================

/// Request de merge de PDFs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequest {
    /// Lista de caminhos para os PDFs a serem mesclados
    pub files: Vec<PathBuf>,
    /// Caminho de saída para o PDF mesclado
    pub output_path: PathBuf,
    /// Configurações opcionais do merge
    #[serde(default)]
    pub config: MergeConfig,
}

/// Configurações de merge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeConfig {
    /// Preservar metadados do primeiro documento
    #[serde(default = "default_true")]
    pub preserve_metadata: bool,
    /// Otimizar tamanho do arquivo de saída
    #[serde(default)]
    pub optimize_size: bool,
    /// Manter marcadores (bookmarks) dos documentos originais
    #[serde(default = "default_true")]
    pub keep_bookmarks: bool,
    /// Nível de compressão (1-9, onde 9 é máxima)
    #[serde(default = "default_compression_level")]
    pub compression_level: u8,
}

impl Default for MergeConfig {
    fn default() -> Self {
        Self {
            preserve_metadata: true,
            optimize_size: false,
            keep_bookmarks: true,
            compression_level: 6,
        }
    }
}

/// Request de split de PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitRequest {
    /// Caminho para o PDF a ser dividido
    pub file_path: PathBuf,
    /// Intervalos de páginas para split (formato: "1-3,5,7-10")
    pub page_ranges: String,
    /// Diretório de saída para os PDFs resultantes
    pub output_dir: PathBuf,
    /// Configurações opcionais do split
    #[serde(default)]
    pub config: SplitConfig,
}

/// Configurações de split
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitConfig {
    /// Preservar metadados em cada arquivo splitado
    #[serde(default = "default_true")]
    pub preserve_metadata: bool,
    /// Padrão de nomeação para arquivos de saída
    #[serde(default = "default_split_pattern")]
    pub naming_pattern: String,
    /// Criar diretório de saída se não existir
    #[serde(default = "default_true")]
    pub create_output_dir: bool,
}

impl Default for SplitConfig {
    fn default() -> Self {
        Self {
            preserve_metadata: true,
            naming_pattern: "split_{index}".to_string(),
            create_output_dir: true,
        }
    }
}

/// Request de validação de PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateRequest {
    /// Caminho para o PDF a ser validado
    pub file_path: PathBuf,
    /// Nível de validação
    #[serde(default)]
    pub validation_level: ValidationLevel,
    /// Configurações de validação
    #[serde(default)]
    pub config: ValidationConfig,
}

/// Request de obtenção de metadados
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataRequest {
    /// Caminho para o PDF
    pub file_path: PathBuf,
    /// Incluir análise detalhada?
    #[serde(default)]
    pub include_detailed_analysis: bool,
}

/// Request de listagem de arquivos
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesRequest {
    /// Diretório a ser listado
    pub directory: PathBuf,
    /// Filtrar por extensão (opcional)
    pub extension_filter: Option<String>,
    /// Incluir subdiretórios?
    #[serde(default)]
    pub recursive: bool,
}

/// Request de criação de diretório
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDirectoryRequest {
    /// Caminho do diretório a ser criado
    pub path: PathBuf,
    /// Criar recursivamente?
    #[serde(default = "default_true")]
    pub recursive: bool,
}

/// Request de remoção de caminho
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemovePathRequest {
    /// Caminho a ser removido
    pub path: PathBuf,
    /// Forçar remoção mesmo se não estiver vazio?
    #[serde(default)]
    pub force: bool,
    /// Remover recursivamente?
    #[serde(default)]
    pub recursive: bool,
}

// ==================== TIPOS ESPECÍFICOS DE RESPONSES ====================

/// Resposta de health check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    /// Status do serviço
    pub status: ServiceStatus,
    /// Versão do backend
    pub version: String,
    /// Tempo de atividade em segundos
    pub uptime_seconds: u64,
    /// Informações do sistema
    pub system_info: SystemInfo,
    /// Estatísticas do serviço
    #[serde(default)]
    pub stats: ServiceStats,
}

/// Status do serviço
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServiceStatus {
    /// Serviço funcionando normalmente
    Healthy,
    /// Serviço com problemas menores
    Degraded,
    /// Serviço indisponível
    Unhealthy,
}

/// Informações do sistema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    /// Sistema operacional
    pub os: String,
    /// Arquitetura
    pub architecture: String,
    /// Número de CPUs
    pub num_cpus: usize,
    /// Memória total (MB)
    pub total_memory_mb: u64,
    /// Memória disponível (MB)
    pub available_memory_mb: u64,
}

/// Estatísticas do serviço
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ServiceStats {
    /// Número total de requisições processadas
    pub total_requests: u64,
    /// Número de requisições bem-sucedidas
    pub successful_requests: u64,
    /// Número de requisições com erro
    pub failed_requests: u64,
    /// Número de PDFs processados
    pub pdfs_processed: u64,
    /// Número total de páginas processadas
    pub total_pages_processed: u64,
}

/// Resposta de listagem de arquivos
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListFilesResponse {
    /// Caminhos dos arquivos encontrados
    pub files: Vec<FileInfo>,
    /// Caminhos dos diretórios encontrados
    pub directories: Vec<DirectoryInfo>,
    /// Informações do diretório
    pub directory_info: DirectoryStats,
}

/// Informações sobre um arquivo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    /// Caminho completo do arquivo
    pub path: PathBuf,
    /// Nome do arquivo
    pub filename: String,
    /// Tamanho em bytes
    pub size: u64,
    /// Data de modificação
    pub modified: Option<String>,
    /// Data de criação
    pub created: Option<String>,
    /// É um arquivo PDF?
    pub is_pdf: bool,
    /// Extensão do arquivo
    pub extension: Option<String>,
}

/// Informações sobre um diretório
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryInfo {
    /// Caminho completo do diretório
    pub path: PathBuf,
    /// Nome do diretório
    pub name: String,
    /// Número de arquivos no diretório
    pub file_count: usize,
    /// Número de subdiretórios
    pub subdirectory_count: usize,
    /// Data de modificação
    pub modified: Option<String>,
}

/// Estatísticas do diretório
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryStats {
    /// Caminho do diretório
    pub path: PathBuf,
    /// Número total de arquivos
    pub total_files: usize,
    /// Número total de subdiretórios
    pub total_directories: usize,
    /// Tamanho total dos arquivos (bytes)
    pub total_size: u64,
    /// Tamanho ocupado no disco (bytes)
    pub disk_usage: u64,
}

// ==================== FUNÇÕES AUXILIARES ====================

/// Gera um ID único para requisição
fn generate_request_id() -> String {
    use nanoid::nanoid;
    nanoid!(16, &nanoid::alphabet::SAFE)
}

/// Lista de ações suportadas (para mensagens de erro)
fn supported_actions_list() -> String {
    vec![
        "merge", "split", "validate", "get_metadata",
        "health_check", "list_files", "create_directory", "remove_path"
    ].join(", ")
}

/// Valor padrão para booleanos (true)
fn default_true() -> bool {
    true
}

/// Valor padrão para nível de compressão
fn default_compression_level() -> u8 {
    6
}

/// Padrão padrão para split
fn default_split_pattern() -> String {
    "split_{index}".to_string()
}

// ==================== IMPLEMENTAÇÕES DE CONVERSÃO ====================

impl TryFrom<Value> for ApiRequest {
    type Error = AppError;

    fn try_from(value: Value) -> Result<Self> {
        let request: ApiRequest = serde_json::from_value(value)
            .map_err(|e| AppError::validation(format!("Invalid API request: {}", e)))?;
        
        request.validate()?;
        Ok(request)
    }
}

impl From<ApiRequest> for Value {
    fn from(request: ApiRequest) -> Self {
        serde_json::to_value(request).unwrap_or_default()
    }
}

impl<T: Serialize> From<ApiResponse<T>> for Value {
    fn from(response: ApiResponse<T>) -> Self {
        serde_json::to_value(response).unwrap_or_else(|e| {
            error!("Failed to serialize API response: {}", e);
            serde_json::json!({
                "success": false,
                "error": {
                    "code": "SERIALIZATION_ERROR",
                    "message": "Failed to serialize response"
                }
            })
        })
    }
}

// ==================== TESTES ====================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_api_action_conversion() -> Result<()> {
        assert_eq!(ApiAction::from_str("merge")?, ApiAction::Merge);
        assert_eq!(ApiAction::from_str("split")?, ApiAction::Split);
        assert_eq!(ApiAction::from_str("health_check")?, ApiAction::HealthCheck);
        assert_eq!(ApiAction::from_str("health")?, ApiAction::HealthCheck);
        
        assert!(ApiAction::from_str("unknown").is_err());
        
        Ok(())
    }

    #[test]
    fn test_api_action_as_str() {
        assert_eq!(ApiAction::Merge.as_str(), "merge");
        assert_eq!(ApiAction::Split.as_str(), "split");
        assert_eq!(ApiAction::HealthCheck.as_str(), "health_check");
    }

    #[test]
    fn test_api_request_creation() {
        let data = json!({"test": "data"});
        let request = ApiRequest::new(ApiAction::Merge, data);
        
        assert!(!request.request_id.is_empty());
        assert_eq!(request.action, ApiAction::Merge);
        assert_eq!(request.api_version, API_VERSION);
        assert!(request.timestamp > 0);
    }

    #[test]
    fn test_api_request_validation() -> Result<()> {
        let request = ApiRequest::new(ApiAction::Merge, json!({}));
        assert!(request.validate().is_ok());
        
        let mut invalid_request = ApiRequest::new(ApiAction::Merge, json!({}));
        invalid_request.request_id = String::new();
        assert!(invalid_request.validate().is_err());
        
        Ok(())
    }

    #[test]
    fn test_api_response_success() {
        let response = ApiResponse::success("req123", json!({"result": "ok"}));
        
        assert_eq!(response.request_id, "req123");
        assert!(response.success);
        assert!(response.data.is_some());
        assert!(response.error.is_none());
    }

    #[test]
    fn test_api_response_error() {
        let error = ApiError::validation("Invalid input", Some("details".to_string()));
        let response = ApiResponse::error("req123", error);
        
        assert_eq!(response.request_id, "req123");
        assert!(!response.success);
        assert!(response.data.is_none());
        assert!(response.error.is_some());
    }

    #[test]
    fn test_merge_config_default() {
        let config = MergeConfig::default();
        assert!(config.preserve_metadata);
        assert!(!config.optimize_size);
        assert!(config.keep_bookmarks);
        assert_eq!(config.compression_level, 6);
    }

    #[test]
    fn test_split_config_default() {
        let config = SplitConfig::default();
        assert!(config.preserve_metadata);
        assert_eq!(config.naming_pattern, "split_{index}");
        assert!(config.create_output_dir);
    }

    #[test]
    fn test_api_error_creation() {
        let validation_error = ApiError::validation("Field required", None);
        assert_eq!(validation_error.code, "VALIDATION_ERROR");
        assert_eq!(validation_error.error_type, ErrorType::Validation);
        
        let processing_error = ApiError::processing("Failed to process", None);
        assert_eq!(processing_error.code, "PROCESSING_ERROR");
        assert_eq!(processing_error.error_type, ErrorType::Processing);
        
        let io_error = ApiError::io("File not found", None);
        assert_eq!(io_error.code, "IO_ERROR");
        assert_eq!(io_error.error_type, ErrorType::Io);
    }

    #[test]
    fn test_generate_request_id() {
        let id1 = generate_request_id();
        let id2 = generate_request_id();
        
        assert_eq!(id1.len(), 16);
        assert_eq!(id2.len(), 16);
        assert_ne!(id1, id2); // IDs devem ser únicos (alta probabilidade)
    }

    #[test]
    fn test_api_request_try_from_value() -> Result<()> {
        let json = json!({
            "request_id": "test123",
            "action": "merge",
            "data": {},
            "timestamp": 1234567890,
            "api_version": API_VERSION,
            "metadata": {}
        });
        
        let request: ApiRequest = json.try_into()?;
        assert_eq!(request.request_id, "test123");
        assert_eq!(request.action, ApiAction::Merge);
        
        Ok(())
    }
}