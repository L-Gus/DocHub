//! Sistema de configuração do DocHub
//! 
//! Responsável por carregar, validar e gerenciar todas as configurações da aplicação.
//! 
//! ## Fontes de configuração (em ordem de precedência):
//! 1. Argumentos de linha de comando (mais alta prioridade)
//! 2. Variáveis de ambiente
//! 3. Arquivo de configuração (config.toml, config.json, etc.)
//! 4. Valores padrão (fallback)
//! 
//! ## Principais funcionalidades:
//! - Hot-reloading (recarregamento em tempo de execução)
//! - Validação de configurações
//! - Diferentes ambientes (dev, staging, production)
//! - Configurações sensíveis (secrets) via variáveis de ambiente

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::SystemTime;
use thiserror::Error;
use tokio::sync::watch;
use tracing::{debug, info, warn, error};

use crate::utils::error_handling::{Result, AppError, ConfigError};

// ==================== CONSTANTES ====================

/// Nome da aplicação
pub const APP_NAME: &str = "DocHub";

/// Versão da aplicação
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Autor da aplicação
pub const APP_AUTHOR: &str = "L-Gus";

/// Ambiente padrão
pub const DEFAULT_ENVIRONMENT: Environment = Environment::Development;

/// Configuração padrão em TOML
pub const DEFAULT_CONFIG_TOML: &str = include_str!("../../config/default.toml");

// ==================== ENUMS E TIPOS BASE ====================

/// Ambiente da aplicação
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Environment {
    #[serde(rename = "development")]
    Development,
    #[serde(rename = "staging")]
    Staging,
    #[serde(rename = "production")]
    Production,
    #[serde(rename = "testing")]
    Testing,
}

impl Environment {
    /// Determina o ambiente baseado em variáveis de ambiente
    pub fn from_env() -> Self {
        match env::var("DOC_HUB_ENV")
            .unwrap_or_else(|_| "development".to_string())
            .to_lowercase()
            .as_str()
        {
            "production" | "prod" => Self::Production,
            "staging" | "stage" => Self::Staging,
            "testing" | "test" => Self::Testing,
            _ => Self::Development,
        }
    }

    /// É ambiente de desenvolvimento?
    pub fn is_development(&self) -> bool {
        matches!(self, Self::Development | Self::Testing)
    }

    /// É ambiente de produção?
    pub fn is_production(&self) -> bool {
        matches!(self, Self::Production)
    }

    /// Nome do ambiente
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Development => "development",
            Self::Staging => "staging",
            Self::Production => "production",
            Self::Testing => "testing",
        }
    }
}

impl Default for Environment {
    fn default() -> Self {
        Self::from_env()
    }
}

/// Nível de log
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum LogLevel {
    #[serde(rename = "trace")]
    Trace,
    #[serde(rename = "debug")]
    Debug,
    #[serde(rename = "info")]
    Info,
    #[serde(rename = "warn")]
    Warn,
    #[serde(rename = "error")]
    Error,
    #[serde(rename = "off")]
    Off,
}

impl LogLevel {
    /// Converte para nível do tracing
    pub fn to_tracing_level(&self) -> tracing::Level {
        match self {
            Self::Trace => tracing::Level::TRACE,
            Self::Debug => tracing::Level::DEBUG,
            Self::Info => tracing::Level::INFO,
            Self::Warn => tracing::Level::WARN,
            Self::Error => tracing::Level::ERROR,
            Self::Off => tracing::Level::ERROR, // Fallback
        }
    }
}

impl Default for LogLevel {
    fn default() -> Self {
        if cfg!(debug_assertions) {
            Self::Debug
        } else {
            Self::Info
        }
    }
}

/// Formato de log
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum LogFormat {
    #[serde(rename = "json")]
    Json,
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "compact")]
    Compact,
}

impl Default for LogFormat {
    fn default() -> Self {
        Self::Text
    }
}

// ==================== CONFIGURAÇÕES PRINCIPAIS ====================

/// Configuração principal da aplicação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Informações gerais da aplicação
    pub app: AppInfo,
    /// Configurações do servidor/backend
    pub server: ServerConfig,
    /// Configurações de arquivos e I/O
    pub files: FileConfig,
    /// Configurações de PDF
    pub pdf: PdfConfig,
    /// Configurações de logging
    pub logging: LoggingConfig,
    /// Configurações de performance
    pub performance: PerformanceConfig,
    /// Configurações de segurança
    pub security: SecurityConfig,
    /// Configurações específicas do ambiente
    #[serde(default)]
    pub environment: EnvironmentConfig,
}

impl AppConfig {
    /// Cria configuração padrão
    pub fn default() -> Result<Self> {
        let env = Environment::default();
        
        Ok(Self {
            app: AppInfo::default(),
            server: ServerConfig::default(),
            files: FileConfig::default(),
            pdf: PdfConfig::default(),
            logging: LoggingConfig::for_environment(&env),
            performance: PerformanceConfig::default(),
            security: SecurityConfig::default(),
            environment: EnvironmentConfig::for_environment(&env),
        })
    }

    /// Valida todas as configurações
    pub fn validate(&self) -> Result<()> {
        self.app.validate()?;
        self.server.validate()?;
        self.files.validate()?;
        self.pdf.validate()?;
        self.performance.validate()?;
        self.security.validate()?;

        info!("Configuration validated successfully");
        Ok(())
    }

    /// É ambiente de desenvolvimento?
    pub fn is_development(&self) -> bool {
        self.app.environment.is_development()
    }

    /// É ambiente de produção?
    pub fn is_production(&self) -> bool {
        self.app.environment.is_production()
    }
}

/// Informações da aplicação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInfo {
    /// Nome da aplicação
    pub name: String,
    /// Versão
    pub version: String,
    /// Descrição
    pub description: String,
    /// Ambiente atual
    pub environment: Environment,
    /// Modo debug ativado?
    pub debug: bool,
    /// Diretório base da aplicação
    pub base_dir: PathBuf,
    /// Diretório de configuração
    pub config_dir: PathBuf,
    /// Diretório de dados
    pub data_dir: PathBuf,
    /// Diretório de cache
    pub cache_dir: PathBuf,
    /// Diretório de logs
    pub log_dir: PathBuf,
}

impl AppInfo {
    fn validate(&self) -> Result<()> {
        if self.name.is_empty() {
            return Err(AppError::config("App name cannot be empty"));
        }

        if self.version.is_empty() {
            return Err(AppError::config("App version cannot be empty"));
        }

        // Verifica diretórios
        for dir in &[&self.data_dir, &self.cache_dir, &self.log_dir] {
            if dir.to_string_lossy().is_empty() {
                return Err(AppError::config("App directories cannot be empty"));
            }
        }

        Ok(())
    }
}

impl Default for AppInfo {
    fn default() -> Self {
        // Usa dirs crate para diretórios padrão do sistema
        let base_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from(".config"))
            .join("dochub");

        let data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from(".local/share"))
            .join("dochub");

        let cache_dir = dirs::cache_dir()
            .unwrap_or_else(|| PathBuf::from(".cache"))
            .join("dochub");

        Self {
            name: APP_NAME.to_string(),
            version: APP_VERSION.to_string(),
            description: "Hub de Produtividade PDF Offline & Seguro".to_string(),
            environment: Environment::default(),
            debug: cfg!(debug_assertions),
            base_dir: base_dir.clone(),
            config_dir: base_dir.join("config"),
            data_dir: data_dir.clone(),
            cache_dir: cache_dir.clone(),
            log_dir: data_dir.join("logs"),
        }
    }
}

/// Configurações do servidor/backend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// Host para binding
    pub host: String,
    /// Porta para IPC
    pub port: u16,
    /// Tempo máximo de operação (segundos)
    pub max_operation_time_secs: u64,
    /// Número máximo de operações concorrentes
    pub max_concurrent_operations: usize,
    /// Tamanho máximo da fila de operações
    pub operation_queue_size: usize,
    /// Habilitar métricas?
    pub enable_metrics: bool,
    /// Intervalo de coleta de métricas (segundos)
    pub metrics_interval_secs: u64,
}

impl ServerConfig {
    fn validate(&self) -> Result<()> {
        if self.host.is_empty() {
            return Err(AppError::config("Server host cannot be empty"));
        }

        if self.port == 0 {
            return Err(AppError::config("Server port cannot be 0"));
        }

        if self.max_operation_time_secs == 0 {
            return Err(AppError::config("Max operation time cannot be 0"));
        }

        if self.max_concurrent_operations == 0 {
            return Err(AppError::config("Max concurrent operations cannot be 0"));
        }

        Ok(())
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 0, // Usará porta dinâmica para IPC
            max_operation_time_secs: 300, // 5 minutos
            max_concurrent_operations: 4,
            operation_queue_size: 100,
            enable_metrics: true,
            metrics_interval_secs: 60,
        }
    }
}

/// Configurações de arquivos e I/O
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileConfig {
    /// Tamanho máximo de arquivo (bytes)
    pub max_file_size: u64,
    /// Extensões permitidas
    pub allowed_extensions: Vec<String>,
    /// Extensões de PDF
    pub pdf_extensions: Vec<String>,
    /// Diretório temporário
    pub temp_dir: PathBuf,
    /// Manter arquivos temporários após processamento?
    pub keep_temp_files: bool,
    /// Tempo de vida de arquivos temporários (segundos)
    pub temp_file_ttl_secs: u64,
    /// Limpeza automática de arquivos temporários?
    pub auto_clean_temp_files: bool,
    /// Intervalo de limpeza (segundos)
    pub cleanup_interval_secs: u64,
    /// Buffer size para operações de I/O (bytes)
    pub io_buffer_size: usize,
}

impl FileConfig {
    fn validate(&self) -> Result<()> {
        if self.max_file_size == 0 {
            return Err(AppError::config("Max file size cannot be 0"));
        }

        if self.allowed_extensions.is_empty() {
            return Err(AppError::config("Allowed extensions cannot be empty"));
        }

        if self.pdf_extensions.is_empty() {
            return Err(AppError::config("PDF extensions cannot be empty"));
        }

        if self.temp_dir.to_string_lossy().is_empty() {
            return Err(AppError::config("Temp directory cannot be empty"));
        }

        if self.io_buffer_size == 0 {
            return Err(AppError::config("IO buffer size cannot be 0"));
        }

        Ok(())
    }
}

impl Default for FileConfig {
    fn default() -> Self {
        Self {
            max_file_size: 100 * 1024 * 1024, // 100MB
            allowed_extensions: vec![
                "pdf".to_string(),
                "PDF".to_string(),
            ],
            pdf_extensions: vec![
                "pdf".to_string(),
                "PDF".to_string(),
            ],
            temp_dir: std::env::temp_dir().join("dochub"),
            keep_temp_files: false,
            temp_file_ttl_secs: 3600, // 1 hora
            auto_clean_temp_files: true,
            cleanup_interval_secs: 300, // 5 minutos
            io_buffer_size: 8192, // 8KB
        }
    }
}

/// Configurações de PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfConfig {
    /// Versão padrão do PDF para novos documentos
    pub default_pdf_version: String,
    /// Nível de compressão padrão (1-9)
    pub default_compression_level: u8,
    /// Preservar metadados por padrão?
    pub preserve_metadata_by_default: bool,
    /// Manter bookmarks por padrão?
    pub keep_bookmarks_by_default: bool,
    /// Otimizar tamanho por padrão?
    pub optimize_size_by_default: bool,
    /// Tamanho máximo de página para thumbnail (pixels)
    pub thumbnail_max_size: u32,
    /// Qualidade do thumbnail (1-100)
    pub thumbnail_quality: u8,
    /// Formato do thumbnail (png, jpeg)
    pub thumbnail_format: String,
    /// Validar PDFs antes de processar?
    pub validate_before_processing: bool,
    /// Tentar reparar PDFs corrompidos?
    pub attempt_repair_corrupted: bool,
    /// Rejeitar PDFs criptografados?
    pub reject_encrypted_pdfs: bool,
    /// Log de operações de PDF?
    pub log_pdf_operations: bool,
}

impl PdfConfig {
    fn validate(&self) -> Result<()> {
        // Valida versão do PDF
        let valid_versions = ["1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "2.0"];
        if !valid_versions.contains(&self.default_pdf_version.as_str()) {
            return Err(AppError::config(format!(
                "Invalid PDF version: {}. Valid versions: {:?}",
                self.default_pdf_version, valid_versions
            )));
        }

        // Valida nível de compressão
        if !(1..=9).contains(&self.default_compression_level) {
            return Err(AppError::config(
                "Compression level must be between 1 and 9"
            ));
        }

        // Valida qualidade do thumbnail
        if !(1..=100).contains(&self.thumbnail_quality) {
            return Err(AppError::config(
                "Thumbnail quality must be between 1 and 100"
            ));
        }

        // Valida formato do thumbnail
        let valid_formats = ["png", "jpeg", "jpg", "webp"];
        if !valid_formats.contains(&self.thumbnail_format.to_lowercase().as_str()) {
            return Err(AppError::config(format!(
                "Invalid thumbnail format: {}. Valid formats: {:?}",
                self.thumbnail_format, valid_formats
            )));
        }

        Ok(())
    }
}

impl Default for PdfConfig {
    fn default() -> Self {
        Self {
            default_pdf_version: "1.5".to_string(),
            default_compression_level: 6,
            preserve_metadata_by_default: true,
            keep_bookmarks_by_default: true,
            optimize_size_by_default: false,
            thumbnail_max_size: 200,
            thumbnail_quality: 85,
            thumbnail_format: "png".to_string(),
            validate_before_processing: true,
            attempt_repair_corrupted: false,
            reject_encrypted_pdfs: false,
            log_pdf_operations: true,
        }
    }
}

/// Configurações de logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// Nível de log
    pub level: LogLevel,
    /// Formato de log
    pub format: LogFormat,
    /// Habilitar logging para arquivo?
    pub enable_file_logging: bool,
    /// Número máximo de arquivos de log
    pub max_log_files: usize,
    /// Tamanho máximo por arquivo de log (bytes)
    pub max_log_file_size: u64,
    /// Incluir timestamps?
    pub include_timestamps: bool,
    /// Incluir nível de log?
    pub include_level: bool,
    /// Incluir nomes de módulos?
    pub include_module_path: bool,
    /// Log colorido (apenas para terminal)
    pub colored: bool,
    /// Filtrar logs por módulo
    pub module_filters: HashMap<String, LogLevel>,
}

impl LoggingConfig {
    /// Configurações para ambiente específico
    pub fn for_environment(env: &Environment) -> Self {
        match env {
            Environment::Development | Environment::Testing => Self {
                level: LogLevel::Debug,
                format: LogFormat::Text,
                enable_file_logging: false,
                colored: true,
                include_module_path: true,
                ..Default::default()
            },
            Environment::Staging => Self {
                level: LogLevel::Info,
                format: LogFormat::Json,
                enable_file_logging: true,
                colored: false,
                ..Default::default()
            },
            Environment::Production => Self {
                level: LogLevel::Warn,
                format: LogFormat::Json,
                enable_file_logging: true,
                colored: false,
                ..Default::default()
            },
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: LogLevel::default(),
            format: LogFormat::default(),
            enable_file_logging: false,
            max_log_files: 10,
            max_log_file_size: 10 * 1024 * 1024, // 10MB
            include_timestamps: true,
            include_level: true,
            include_module_path: false,
            colored: true,
            module_filters: HashMap::new(),
        }
    }
}

/// Configurações de performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    /// Número de threads para operações de I/O
    pub io_threads: usize,
    /// Número de threads para processamento CPU
    pub cpu_threads: usize,
    /// Tamanho do pool de threads
    pub thread_pool_size: usize,
    /// Tamanho do cache de documentos (número de documentos)
    pub document_cache_size: usize,
    /// Tamanho do cache de páginas (número de páginas)
    pub page_cache_size: usize,
    /// Timeout de operação padrão (milissegundos)
    pub default_operation_timeout_ms: u64,
    /// Timeout de I/O (milissegundos)
    pub io_timeout_ms: u64,
    /// Usar memory mapping para arquivos grandes?
    pub use_memory_mapping: bool,
    /// Limite de memória para processamento (MB)
    pub memory_limit_mb: Option<u64>,
    /// Coletar estatísticas de performance?
    pub collect_performance_stats: bool,
}

impl PerformanceConfig {
    fn validate(&self) -> Result<()> {
        if self.io_threads == 0 {
            return Err(AppError::config("IO threads cannot be 0"));
        }

        if self.cpu_threads == 0 {
            return Err(AppError::config("CPU threads cannot be 0"));
        }

        if self.thread_pool_size == 0 {
            return Err(AppError::config("Thread pool size cannot be 0"));
        }

        if self.default_operation_timeout_ms == 0 {
            return Err(AppError::config("Default operation timeout cannot be 0"));
        }

        if self.io_timeout_ms == 0 {
            return Err(AppError::config("IO timeout cannot be 0"));
        }

        Ok(())
    }
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        let num_cpus = num_cpus::get();
        
        Self {
            io_threads: std::cmp::max(2, num_cpus / 2),
            cpu_threads: num_cpus,
            thread_pool_size: num_cpus * 2,
            document_cache_size: 10,
            page_cache_size: 100,
            default_operation_timeout_ms: 30_000, // 30 segundos
            io_timeout_ms: 5_000, // 5 segundos
            use_memory_mapping: true,
            memory_limit_mb: None, // Sem limite por padrão
            collect_performance_stats: true,
        }
    }
}

/// Configurações de segurança
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Validar paths para prevenir directory traversal?
    pub validate_paths: bool,
    /// Verificar assinaturas de arquivos (se disponível)?
    pub verify_file_signatures: bool,
    /// Sanitizar nomes de arquivos?
    pub sanitize_filenames: bool,
    /// Caracteres proibidos em nomes de arquivos
    pub forbidden_filename_chars: Vec<char>,
    /// Tamanho máximo de path
    pub max_path_length: usize,
    /// Permitir paths absolutos?
    pub allow_absolute_paths: bool,
    /// Diretórios permitidos (se allow_absolute_paths = false)
    pub allowed_directories: Vec<PathBuf>,
    /// Rate limiting para operações (operações/segundo)
    pub rate_limit_ops_per_sec: Option<u32>,
    /// Timeout máximo para qualquer operação (segundos)
    pub max_operation_timeout_secs: u64,
    /// Validar tipos MIME de arquivos?
    pub validate_mime_types: bool,
    /// Tipos MIME permitidos
    pub allowed_mime_types: Vec<String>,
}

impl SecurityConfig {
    fn validate(&self) -> Result<()> {
        if self.max_path_length == 0 {
            return Err(AppError::config("Max path length cannot be 0"));
        }

        if self.max_operation_timeout_secs == 0 {
            return Err(AppError::config("Max operation timeout cannot be 0"));
        }

        if self.validate_mime_types && self.allowed_mime_types.is_empty() {
            return Err(AppError::config(
                "Allowed MIME types cannot be empty when MIME validation is enabled"
            ));
        }

        Ok(())
    }
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            validate_paths: true,
            verify_file_signatures: false,
            sanitize_filenames: true,
            forbidden_filename_chars: vec![
                '<', '>', ':', '"', '/', '\\', '|', '?', '*',
                '\0', // Null character
            ],
            max_path_length: 4096,
            allow_absolute_paths: false,
            allowed_directories: vec![
                dirs::home_dir().unwrap_or_default(),
                dirs::document_dir().unwrap_or_default(),
                dirs::download_dir().unwrap_or_default(),
                dirs::desktop_dir().unwrap_or_default(),
            ],
            rate_limit_ops_per_sec: Some(10),
            max_operation_timeout_secs: 300, // 5 minutos
            validate_mime_types: true,
            allowed_mime_types: vec![
                "application/pdf".to_string(),
                "application/x-pdf".to_string(),
            ],
        }
    }
}

/// Configurações específicas do ambiente
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EnvironmentConfig {
    /// Features habilitadas neste ambiente
    pub enabled_features: Vec<String>,
    /// Features desabilitadas neste ambiente
    pub disabled_features: Vec<String>,
    /// Overrides específicos do ambiente
    pub overrides: HashMap<String, serde_json::Value>,
}

impl EnvironmentConfig {
    /// Configurações para ambiente específico
    pub fn for_environment(env: &Environment) -> Self {
        match env {
            Environment::Development | Environment::Testing => Self {
                enabled_features: vec![
                    "debug_tools".to_string(),
                    "hot_reload".to_string(),
                    "detailed_logging".to_string(),
                ],
                disabled_features: vec![
                    "rate_limiting".to_string(),
                    "strict_validation".to_string(),
                ],
                overrides: HashMap::new(),
            },
            Environment::Staging => Self {
                enabled_features: vec![
                    "metrics".to_string(),
                    "logging".to_string(),
                ],
                disabled_features: vec![
                    "debug_tools".to_string(),
                ],
                overrides: HashMap::new(),
            },
            Environment::Production => Self {
                enabled_features: vec![
                    "rate_limiting".to_string(),
                    "caching".to_string(),
                    "security_validation".to_string(),
                ],
                disabled_features: vec![
                    "debug_tools".to_string(),
                    "hot_reload".to_string(),
                ],
                overrides: HashMap::new(),
            },
        }
    }
}

// ==================== GESTOR DE CONFIGURAÇÃO ====================

/// Gerenciador de configuração com hot-reloading
#[derive(Debug)]
pub struct ConfigManager {
    config: Arc<RwLock<AppConfig>>,
    config_path: PathBuf,
    last_modified: SystemTime,
    notifier: watch::Sender<Arc<AppConfig>>,
}

impl ConfigManager {
    /// Cria um novo gerenciador de configuração
    pub async fn new() -> Result<Self> {
        let config = Self::load_config().await?;
        let (tx, _) = watch::channel(Arc::new(config.clone()));
        
        let config_path = Self::find_config_file().await?;
        let last_modified = fs::metadata(&config_path)
            .ok()
            .and_then(|m| m.modified().ok())
            .unwrap_or_else(SystemTime::now);

        let manager = Self {
            config: Arc::new(RwLock::new(config)),
            config_path,
            last_modified,
            notifier: tx,
        };

        info!("Configuration manager initialized");
        Ok(manager)
    }

    /// Carrega a configuração de todas as fontes
    async fn load_config() -> Result<AppConfig> {
        // 1. Valores padrão
        let mut config = AppConfig::default()?;

        // 2. Arquivo de configuração
        if let Some(config_file) = Self::find_config_file().await.ok() {
            debug!("Loading configuration from: {}", config_file.display());
            config = Self::merge_file_config(config, &config_file).await?;
        }

        // 3. Variáveis de ambiente
        config = Self::merge_env_config(config).await?;

        // 4. Argumentos de linha de comando (se disponíveis)
        config = Self::merge_cli_config(config).await?;

        // 5. Validação final
        config.validate()?;

        info!(
            "Configuration loaded for environment: {}",
            config.app.environment.as_str()
        );

        Ok(config)
    }

    /// Encontra o arquivo de configuração
    async fn find_config_file() -> Result<PathBuf> {
        let possible_paths = vec![
            // 1. Diretório atual
            PathBuf::from("config.toml"),
            PathBuf::from("config.json"),
            PathBuf::from("config.yaml"),
            
            // 2. Diretório de configuração do usuário
            dirs::config_dir()
                .map(|p| p.join("dochub/config.toml"))
                .unwrap_or_default(),
            
            // 3. Diretório de instalação
            PathBuf::from("/etc/dochub/config.toml"),
            
            // 4. Embedded default config
            PathBuf::from("default.toml"),
        ];

        for path in possible_paths {
            if path.exists() {
                debug!("Found config file at: {}", path.display());
                return Ok(path);
            }
        }

        warn!("No configuration file found, using defaults");
        // Cria arquivo de configuração padrão se não existir
        let default_path = PathBuf::from("config.toml");
        fs::write(&default_path, DEFAULT_CONFIG_TOML)
            .map_err(|e| AppError::config(format!("Failed to create default config: {}", e)))?;
        
        info!("Created default configuration file at: {}", default_path.display());
        Ok(default_path)
    }

    /// Merge configuração de arquivo
    async fn merge_file_config(config: AppConfig, path: &Path) -> Result<AppConfig> {
        let content = fs::read_to_string(path)
            .map_err(|e| AppError::config(format!("Failed to read config file: {}", e)))?;

        let file_config: AppConfig = match path.extension().and_then(|ext| ext.to_str()) {
            Some("toml") => toml::from_str(&content)
                .map_err(|e| AppError::config(format!("Invalid TOML config: {}", e)))?,
            Some("json") => serde_json::from_str(&content)
                .map_err(|e| AppError::config(format!("Invalid JSON config: {}", e)))?,
            Some("yaml") | Some("yml") => serde_yaml::from_str(&content)
                .map_err(|e| AppError::config(format!("Invalid YAML config: {}", e)))?,
            _ => return Err(AppError::config("Unsupported config file format")),
        };

        // Merge simples (o arquivo sobrescreve defaults)
        Ok(file_config)
    }

    /// Merge configuração de variáveis de ambiente
    async fn merge_env_config(config: AppConfig) -> Result<AppConfig> {
        let mut config = config;

        // APP
        if let Ok(name) = env::var("DOC_HUB_APP_NAME") {
            config.app.name = name;
        }
        if let Ok(env_str) = env::var("DOC_HUB_ENVIRONMENT") {
            config.app.environment = match env_str.to_lowercase().as_str() {
                "production" => Environment::Production,
                "staging" => Environment::Staging,
                "testing" => Environment::Testing,
                _ => Environment::Development,
            };
        }

        // SERVER
        if let Ok(host) = env::var("DOC_HUB_HOST") {
            config.server.host = host;
        }
        if let Ok(port) = env::var("DOC_HUB_PORT") {
            config.server.port = port.parse()
                .map_err(|e| AppError::config(format!("Invalid port: {}", e)))?;
        }

        // FILES
        if let Ok(max_size) = env::var("DOC_HUB_MAX_FILE_SIZE") {
            config.files.max_file_size = max_size.parse()
                .map_err(|e| AppError::config(format!("Invalid max file size: {}", e)))?;
        }

        // LOGGING
        if let Ok(level) = env::var("DOC_HUB_LOG_LEVEL") {
            config.logging.level = match level.to_lowercase().as_str() {
                "trace" => LogLevel::Trace,
                "debug" => LogLevel::Debug,
                "info" => LogLevel::Info,
                "warn" => LogLevel::Warn,
                "error" => LogLevel::Error,
                "off" => LogLevel::Off,
                _ => LogLevel::default(),
            };
        }

        Ok(config)
    }

    /// Merge configuração de linha de comando
    async fn merge_cli_config(config: AppConfig) -> Result<AppConfig> {
        // Esta seria implementada com uma biblioteca como clap
        // Por enquanto, apenas retorna a configuração sem modificações
        Ok(config)
    }

    /// Obtém a configuração atual
    pub fn get(&self) -> Arc<AppConfig> {
        Arc::new(self.config.read().unwrap().clone())
    }

    /// Atualiza a configuração
    pub async fn update(&mut self, new_config: AppConfig) -> Result<()> {
        new_config.validate()?;
        
        {
            let mut config = self.config.write().unwrap();
            *config = new_config;
        }

        // Notifica os subscribers
        let current_config = self.get();
        self.notifier.send(current_config)
            .map_err(|e| AppError::config(format!("Failed to notify config change: {}", e)))?;

        info!("Configuration updated successfully");
        Ok(())
    }

    /// Recarrega a configuração do arquivo
    pub async fn reload(&mut self) -> Result<()> {
        let new_config = Self::load_config().await?;
        self.update(new_config).await
    }

    /// Monitora mudanças no arquivo de configuração
    pub async fn watch_for_changes(&mut self) -> Result<()> {
        let metadata = fs::metadata(&self.config_path)
            .map_err(|e| AppError::config(format!("Failed to read config file metadata: {}", e)))?;
        
        let modified = metadata.modified()
            .map_err(|e| AppError::config(format!("Failed to get modification time: {}", e)))?;

        if modified > self.last_modified {
            debug!("Configuration file changed, reloading...");
            self.reload().await?;
            self.last_modified = modified;
        }

        Ok(())
    }

    /// Obtém um receiver para mudanças de configuração
    pub fn subscribe(&self) -> watch::Receiver<Arc<AppConfig>> {
        self.notifier.subscribe()
    }

    /// Salva a configuração atual em um arquivo
    pub async fn save_to_file(&self, path: &Path) -> Result<()> {
        let config = self.config.read().unwrap();
        let toml = toml::to_string_pretty(&*config)
            .map_err(|e| AppError::config(format!("Failed to serialize config: {}", e)))?;

        fs::write(path, toml)
            .map_err(|e| AppError::config(format!("Failed to write config file: {}", e)))?;

        info!("Configuration saved to: {}", path.display());
        Ok(())
    }
}

// ==================== FUNÇÕES DE CONVENIÊNCIA ====================

/// Cria e inicializa o gerenciador de configuração
pub async fn init_config() -> Result<ConfigManager> {
    ConfigManager::new().await
}

/// Obtém a configuração atual (singleton pattern)
pub async fn get_config() -> Result<Arc<AppConfig>> {
    use once_cell::sync::OnceCell;
    use tokio::sync::Mutex;

    static CONFIG_MANAGER: OnceCell<Mutex<Option<ConfigManager>>> = OnceCell::new();

    let manager = CONFIG_MANAGER.get_or_init(|| Mutex::new(None));
    let mut manager_lock = manager.lock().await;

    if (*manager_lock).is_none() {
        *manager_lock = Some(ConfigManager::new().await?);
    }

    Ok(manager_lock.as_ref().unwrap().get())
}

// ==================== TESTES ====================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[test]
    fn test_environment_detection() {
        env::set_var("DOC_HUB_ENV", "production");
        assert_eq!(Environment::from_env(), Environment::Production);
        assert!(Environment::from_env().is_production());
        assert!(!Environment::from_env().is_development());

        env::set_var("DOC_HUB_ENV", "development");
        assert_eq!(Environment::from_env(), Environment::Development);
        assert!(Environment::from_env().is_development());

        env::remove_var("DOC_HUB_ENV");
        assert_eq!(Environment::from_env(), Environment::Development);
    }

    #[test]
    fn test_app_config_default() -> Result<()> {
        let config = AppConfig::default()?;
        
        assert_eq!(config.app.name, APP_NAME);
        assert_eq!(config.app.version, APP_VERSION);
        assert!(!config.app.base_dir.to_string_lossy().is_empty());
        
        assert!(config.server.max_operation_time_secs > 0);
        assert!(config.files.max_file_size > 0);
        assert!(!config.pdf.default_pdf_version.is_empty());
        
        config.validate()?;
        
        Ok(())
    }

    #[test]
    fn test_file_config_validation() -> Result<()> {
        let mut config = FileConfig::default();
        assert!(config.validate().is_ok());
        
        config.max_file_size = 0;
        assert!(config.validate().is_err());
        
        config.max_file_size = 100 * 1024 * 1024;
        config.allowed_extensions.clear();
        assert!(config.validate().is_err());
        
        Ok(())
    }

    #[test]
    fn test_pdf_config_validation() -> Result<()> {
        let mut config = PdfConfig::default();
        assert!(config.validate().is_ok());
        
        config.default_pdf_version = "0.9".to_string();
        assert!(config.validate().is_err());
        
        config.default_pdf_version = "1.5".to_string();
        config.default_compression_level = 10;
        assert!(config.validate().is_err());
        
        Ok(())
    }

    #[test]
    fn test_security_config_default() {
        let config = SecurityConfig::default();
        
        assert!(config.validate_paths);
        assert!(config.sanitize_filenames);
        assert!(!config.forbidden_filename_chars.is_empty());
        assert!(config.max_path_length > 0);
        assert!(!config.allowed_mime_types.is_empty());
    }

    #[tokio::test]
    async fn test_config_file_creation() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let config = AppConfig::default()?;
        
        let toml = toml::to_string_pretty(&config)?;
        fs::write(temp_file.path(), toml)?;
        
        // Tenta carregar o arquivo
        let loaded = ConfigManager::merge_file_config(config, temp_file.path()).await;
        assert!(loaded.is_ok());
        
        Ok(())
    }

    #[test]
    fn test_logging_config_for_environment() {
        let dev_config = LoggingConfig::for_environment(&Environment::Development);
        assert_eq!(dev_config.level, LogLevel::Debug);
        assert_eq!(dev_config.format, LogFormat::Text);
        assert!(dev_config.colored);
        
        let prod_config = LoggingConfig::for_environment(&Environment::Production);
        assert_eq!(prod_config.level, LogLevel::Warn);
        assert_eq!(prod_config.format, LogFormat::Json);
        assert!(!prod_config.colored);
    }

    #[test]
    fn test_performance_config_default() {
        let config = PerformanceConfig::default();
        
        assert!(config.io_threads > 0);
        assert!(config.cpu_threads > 0);
        assert!(config.thread_pool_size > 0);
        assert!(config.default_operation_timeout_ms > 0);
    }
}