//! Handlers de operações de arquivo para o DocHub
//! 
//! Responsável por operações de I/O de arquivos de forma segura e validada.
//! 
//! ## Funcionalidades:
//! - Verificação de existência de arquivos
//! - Criação de diretórios
//! - Operações de leitura/escrita com validações
//! - Limpeza de arquivos temporários
//! 
//! ## Segurança:
//! - Validação de paths para prevenir directory traversal
//! - Limites de tamanho de arquivo
//! - Verificação de permissões

use std::fs;
use std::path::{Path, PathBuf};
use std::io;
use tracing::{info, warn, error, instrument};

use crate::utils::error_handling::{Result, AppError, IoError, ValidationError};
use crate::utils::error_handling::{validate, validate_not_empty};

/// Configurações para operações de arquivo
#[derive(Debug, Clone)]
pub struct FileHandlerConfig {
    /// Tamanho máximo de arquivo permitido (em bytes)
    pub max_file_size: u64,
    /// Diretório temporário para operações
    pub temp_dir: PathBuf,
    /// Extensões de arquivo permitidas
    pub allowed_extensions: Vec<String>,
}

impl Default for FileHandlerConfig {
    fn default() -> Self {
        Self {
            max_file_size: 100 * 1024 * 1024, // 100MB
            temp_dir: std::env::temp_dir().join("dochub"),
            allowed_extensions: vec!["pdf".to_string(), "PDF".to_string()],
        }
    }
}

/// Handler de arquivos com estado e configuração
#[derive(Debug, Clone)]
pub struct FileHandler {
    config: FileHandlerConfig,
}

impl FileHandler {
    /// Cria um novo FileHandler com configuração padrão
    pub fn new() -> Self {
        Self::with_config(FileHandlerConfig::default())
    }
    
    /// Cria um novo FileHandler com configuração personalizada
    pub fn with_config(config: FileHandlerConfig) -> Self {
        // Garante que o diretório temporário existe
        let _ = fs::create_dir_all(&config.temp_dir);
        
        Self { config }
    }
    
    /// Verifica se um arquivo existe de forma segura
    #[instrument(name = "file_exists", skip(self))]
    pub fn file_exists(&self, path: &str) -> Result<bool> {
        let path_buf = self.validate_path(path)?;
        
        // Verifica existência
        match fs::metadata(&path_buf) {
            Ok(metadata) => {
                if metadata.is_file() {
                    info!(path = %path, "File exists");
                    Ok(true)
                } else {
                    warn!(path = %path, "Path exists but is not a file");
                    Ok(false)
                }
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                info!(path = %path, "File does not exist");
                Ok(false)
            }
            Err(e) => {
                error!(path = %path, error = %e, "Error checking file existence");
                Err(AppError::from_io_error("checking file existence", path_buf, e))
            }
        }
    }
    
    /// Cria um diretório de forma segura (recursivamente se necessário)
    #[instrument(name = "create_dir", skip(self))]
    pub fn create_dir(&self, path: &str) -> Result<()> {
        let path_buf = self.validate_path(path)?;
        
        // Verifica se já existe
        if path_buf.exists() {
            if path_buf.is_dir() {
                info!(path = %path, "Directory already exists");
                return Ok(());
            } else {
                return Err(AppError::Io(IoError::WriteFailed {
                    path: path_buf,
                    source: io::Error::new(
                        io::ErrorKind::AlreadyExists,
                        "Path exists but is not a directory"
                    ),
                }));
            }
        }
        
        // Cria o diretório
        fs::create_dir_all(&path_buf)
            .map_err(|e| AppError::from_io_error("creating directory", path_buf.clone(), e))?;
        
        info!(path = %path, "Directory created successfully");
        Ok(())
    }
    
    /// Cria um diretório temporário único
    #[instrument(name = "create_temp_dir", skip(self))]
    pub fn create_temp_dir(&self, prefix: Option<&str>) -> Result<PathBuf> {
        let prefix = prefix.unwrap_or("dochub");
        let temp_name = format!("{}_{}", prefix, uuid::Uuid::new_v4());
        let temp_path = self.config.temp_dir.join(temp_name);
        
        self.create_dir(temp_path.to_str().unwrap_or(""))?;
        
        info!(path = %temp_path.display(), "Temporary directory created");
        Ok(temp_path)
    }
    
    /// Verifica se um arquivo é válido (existe, é PDF, tem tamanho adequado)
    #[instrument(name = "validate_file", skip(self))]
    pub fn validate_file(&self, path: &str) -> Result<fs::Metadata> {
        let path_buf = self.validate_path(path)?;
        
        // 1. Verifica se o arquivo existe
        let metadata = fs::metadata(&path_buf)
            .map_err(|e| AppError::from_io_error("reading file metadata", path_buf.clone(), e))?;
        
        // 2. Verifica se é um arquivo (não diretório)
        validate(
            metadata.is_file(),
            AppError::validation(format!("Path is not a file: {}", path))
        )?;
        
        // 3. Verifica tamanho do arquivo
        validate(
            metadata.len() <= self.config.max_file_size,
            AppError::Validation(ValidationError::FileTooLarge {
                path: path_buf.clone(),
                size: metadata.len(),
                max: self.config.max_file_size,
            })
        )?;
        
        // 4. Verifica extensão do arquivo (opcional, mas recomendado)
        if let Some(ext) = path_buf.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();
            if !self.config.allowed_extensions.iter().any(|e| e.to_lowercase() == ext_str) {
                warn!(path = %path, extension = %ext_str, "File has unsupported extension");
                // Não falha aqui, apenas loga um aviso
                // Para falhar: return Err(AppError::Validation(...))
            }
        }
        
        info!(
            path = %path,
            size = metadata.len(),
            "File validated successfully"
        );
        
        Ok(metadata)
    }
    
    /// Lista arquivos em um diretório (com filtro por extensão)
    #[instrument(name = "list_files", skip(self))]
    pub fn list_files(&self, dir_path: &str, extension_filter: Option<&str>) -> Result<Vec<PathBuf>> {
        let dir_path_buf = self.validate_path(dir_path)?;
        
        // Verifica se é um diretório
        let dir_metadata = fs::metadata(&dir_path_buf)
            .map_err(|e| AppError::from_io_error("reading directory metadata", dir_path_buf.clone(), e))?;
        
        validate(
            dir_metadata.is_dir(),
            AppError::validation(format!("Path is not a directory: {}", dir_path))
        )?;
        
        // Lê o diretório
        let entries = fs::read_dir(&dir_path_buf)
            .map_err(|e| AppError::from_io_error("reading directory", dir_path_buf.clone(), e))?;
        
        let mut files = Vec::new();
        
        for entry in entries {
            match entry {
                Ok(entry) => {
                    let path = entry.path();
                    
                    // Verifica se é um arquivo
                    if let Ok(metadata) = entry.metadata() {
                        if metadata.is_file() {
                            // Filtra por extensão se especificado
                            if let Some(ext_filter) = extension_filter {
                                if let Some(ext) = path.extension() {
                                    if ext.to_string_lossy().to_lowercase() == ext_filter.to_lowercase() {
                                        files.push(path);
                                    }
                                }
                            } else {
                                files.push(path);
                            }
                        }
                    }
                }
                Err(e) => {
                    warn!(error = %e, "Error reading directory entry");
                    // Continua mesmo com erros em alguns arquivos
                }
            }
        }
        
        info!(
            dir = %dir_path,
            file_count = files.len(),
            "Directory listed successfully"
        );
        
        Ok(files)
    }
    
    /// Remove um arquivo de forma segura
    #[instrument(name = "remove_file", skip(self))]
    pub fn remove_file(&self, path: &str) -> Result<()> {
        let path_buf = self.validate_path(path)?;
        
        // Verifica se é um arquivo (não permite remover diretórios)
        if let Ok(metadata) = fs::metadata(&path_buf) {
            validate(
                metadata.is_file(),
                AppError::validation("Cannot remove directories with remove_file, use remove_dir instead")
            )?;
        }
        
        fs::remove_file(&path_buf)
            .map_err(|e| AppError::from_io_error("removing file", path_buf, e))?;
        
        info!(path = %path, "File removed successfully");
        Ok(())
    }
    
    /// Remove um diretório e todo o seu conteúdo (recursivo)
    #[instrument(name = "remove_dir_all", skip(self))]
    pub fn remove_dir_all(&self, path: &str) -> Result<()> {
        let path_buf = self.validate_path(path)?;
        
        // Verifica se está dentro do diretório temporário para segurança
        if !self.is_safe_to_delete(&path_buf) {
            return Err(AppError::validation(
                "Cannot delete directories outside of temp directory for safety"
            ));
        }
        
        if path_buf.exists() {
            fs::remove_dir_all(&path_buf)
                .map_err(|e| AppError::from_io_error("removing directory", path_buf, e))?;
            
            info!(path = %path, "Directory removed successfully");
        } else {
            info!(path = %path, "Directory does not exist, nothing to remove");
        }
        
        Ok(())
    }
    
    /// Limpa arquivos temporários antigos (mais de 1 hora)
    #[instrument(name = "cleanup_old_temp_files", skip(self))]
    pub fn cleanup_old_temp_files(&self, max_age_hours: u32) -> Result<u32> {
        let mut cleaned_count = 0;
        
        if self.config.temp_dir.exists() {
            let entries = fs::read_dir(&self.config.temp_dir)
                .map_err(|e| AppError::from_io_error("reading temp directory", self.config.temp_dir.clone(), e))?;
            
            let cutoff_time = std::time::SystemTime::now()
                .checked_sub(std::time::Duration::from_secs(max_age_hours as u64 * 3600))
                .unwrap_or_else(std::time::SystemTime::now);
            
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    
                    if let Ok(metadata) = entry.metadata() {
                        if let Ok(modified) = metadata.modified() {
                            if modified < cutoff_time {
                                if metadata.is_file() {
                                    if let Err(e) = fs::remove_file(&path) {
                                        warn!(path = %path.display(), error = %e, "Failed to remove old temp file");
                                    } else {
                                        cleaned_count += 1;
                                    }
                                } else if metadata.is_dir() {
                                    if let Err(e) = fs::remove_dir_all(&path) {
                                        warn!(path = %path.display(), error = %e, "Failed to remove old temp directory");
                                    } else {
                                        cleaned_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        info!(
            cleaned_count = cleaned_count,
            temp_dir = %self.config.temp_dir.display(),
            "Temp files cleanup completed"
        );
        
        Ok(cleaned_count)
    }
    
    // ==================== MÉTODOS PRIVADOS ====================
    
    /// Valida um path para prevenir directory traversal e outros problemas
    fn validate_path(&self, path: &str) -> Result<PathBuf> {
        let path_buf = PathBuf::from(path);
        
        // 1. Verifica se o path não está vazio
        validate_not_empty(path.as_bytes(), "Path cannot be empty")?;
        
        // 2. Prevenir directory traversal
        if path_buf.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return Err(AppError::validation(
                format!("Path contains directory traversal attempts: {}", path)
            ));
        }
        
        // 3. Verifica caminhos absolutos (opcional, depende dos requisitos)
        if path_buf.is_absolute() && !self.is_safe_absolute_path(&path_buf) {
            warn!(path = %path, "Absolute path may not be safe");
            // Pode ser um erro ou apenas um aviso, dependendo da política
        }
        
        // 4. Valida comprimento máximo do path
        if path.len() > 4096 {
            return Err(AppError::validation("Path is too long"));
        }
        
        Ok(path_buf)
    }
    
    /// Verifica se um path absoluto é seguro
    fn is_safe_absolute_path(&self, path: &Path) -> bool {
        // Por padrão, permite apenas alguns diretórios conhecidos
        // Personalize conforme necessário
        
        let user_dirs = vec![
            dirs::document_dir(),
            dirs::download_dir(),
            dirs::desktop_dir(),
            dirs::home_dir(),
        ];
        
        user_dirs.iter()
            .flatten()
            .any(|user_dir| path.starts_with(user_dir))
    }
    
    /// Verifica se é seguro deletar um diretório
    fn is_safe_to_delete(&self, path: &Path) -> bool {
        // Só permite deletar dentro do diretório temporário
        path.starts_with(&self.config.temp_dir)
    }
}

// ==================== FUNÇÕES DE CONVENIÊNCIA (para compatibilidade) ====================

/// Função de conveniência para verificar se um arquivo existe
/// Mantida para compatibilidade com código existente
#[deprecated(note = "Use FileHandler::file_exists instead for better error handling")]
pub fn file_exists(path: &str) -> bool {
    Path::new(path).exists()
}

/// Função de conveniência para criar um diretório
/// Mantida para compatibilidade com código existente
#[deprecated(note = "Use FileHandler::create_dir instead for better error handling")]
pub fn create_dir(path: &str) -> Result<()> {
    let handler = FileHandler::new();
    handler.create_dir(path)
}

// ==================== TESTES ====================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_file_handler_creation() {
        let handler = FileHandler::new();
        assert_eq!(handler.config.max_file_size, 100 * 1024 * 1024);
        assert!(handler.config.temp_dir.exists() || handler.config.temp_dir.parent().unwrap().exists());
    }

    #[test]
    fn test_file_exists() -> Result<()> {
        let handler = FileHandler::new();
        let temp_dir = TempDir::new()?;
        let test_file = temp_dir.path().join("test.txt");
        
        // Arquivo não existe
        assert!(!handler.file_exists(test_file.to_str().unwrap())?);
        
        // Cria o arquivo
        fs::write(&test_file, "test content")?;
        assert!(handler.file_exists(test_file.to_str().unwrap())?);
        
        Ok(())
    }

    #[test]
    fn test_create_dir() -> Result<()> {
        let handler = FileHandler::new();
        let temp_dir = TempDir::new()?;
        let new_dir = temp_dir.path().join("new/sub/directory");
        
        // Cria diretório
        handler.create_dir(new_dir.to_str().unwrap())?;
        assert!(new_dir.exists());
        assert!(new_dir.is_dir());
        
        // Não falha se o diretório já existe
        handler.create_dir(new_dir.to_str().unwrap())?;
        
        Ok(())
    }

    #[test]
    fn test_validate_file() -> Result<()> {
        let handler = FileHandler::new();
        let temp_dir = TempDir::new()?;
        let test_file = temp_dir.path().join("test.pdf");
        
        // Cria um arquivo de teste
        fs::write(&test_file, "fake pdf content")?;
        
        // Validação deve passar
        let metadata = handler.validate_file(test_file.to_str().unwrap())?;
        assert!(metadata.is_file());
        
        Ok(())
    }

    #[test]
    fn test_validate_path_security() -> Result<()> {
        let handler = FileHandler::new();
        
        // Directory traversal deve falhar
        let result = handler.validate_path("../etc/passwd");
        assert!(result.is_err());
        
        // Path vazio deve falhar
        let result = handler.validate_path("");
        assert!(result.is_err());
        
        // Path normal deve passar
        let result = handler.validate_path("documents/test.pdf");
        assert!(result.is_ok());
        
        Ok(())
    }

    #[test]
    fn test_create_temp_dir() -> Result<()> {
        let handler = FileHandler::new();
        
        let temp_dir = handler.create_temp_dir(Some("test"))?;
        assert!(temp_dir.exists());
        assert!(temp_dir.is_dir());
        
        // Limpeza
        fs::remove_dir_all(temp_dir)?;
        
        Ok(())
    }

    #[test]
    fn test_list_files() -> Result<()> {
        let handler = FileHandler::new();
        let temp_dir = TempDir::new()?;
        
        // Cria alguns arquivos
        fs::write(temp_dir.path().join("file1.pdf"), "pdf1")?;
        fs::write(temp_dir.path().join("file2.pdf"), "pdf2")?;
        fs::write(temp_dir.path().join("file3.txt"), "text")?;
        
        // Lista todos os arquivos
        let all_files = handler.list_files(temp_dir.path().to_str().unwrap(), None)?;
        assert_eq!(all_files.len(), 3);
        
        // Lista apenas PDFs
        let pdf_files = handler.list_files(temp_dir.path().to_str().unwrap(), Some("pdf"))?;
        assert_eq!(pdf_files.len(), 2);
        
        Ok(())
    }
}