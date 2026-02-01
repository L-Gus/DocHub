//! Tipos de domínio relacionados a PDFs
//! 
//! Define estruturas de dados que representam conceitos do domínio de PDF,
//! incluindo documentos, páginas, metadados, operações e resultados.
//! 
//! ## Princípios:
//! 1. Semântica clara e expressiva
//! 2. Validações embutidas sempre que possível
//! 3. Separação entre tipos de entrada, processamento e saída
//! 4. Compatibilidade com serialização para comunicação IPC

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::fmt;
use thiserror::Error;
use tracing::warn;

use crate::utils::error_handling::{Result, AppError, ValidationError};

// ==================== IDENTIFICAÇÃO DE PDF ====================

/// Identificador único de um documento PDF
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct PdfId(uuid::Uuid);

impl PdfId {
    /// Cria um novo ID único
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4())
    }
    
    /// Cria a partir de uma string
    pub fn parse_str(s: &str) -> Result<Self> {
        uuid::Uuid::parse_str(s)
            .map(Self)
            .map_err(|e| AppError::validation(format!("Invalid PDF ID: {}", e)))
    }
    
    /// Retorna como string
    pub fn as_str(&self) -> String {
        self.0.to_string()
    }
}

impl Default for PdfId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for PdfId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ==================== DOCUMENTO PDF ====================

/// Representa um documento PDF com todos os seus metadados
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfDocument {
    /// ID único do documento
    pub id: PdfId,
    /// Caminho do arquivo no sistema
    pub file_path: PathBuf,
    /// Informações básicas do arquivo
    pub file_info: FileInfo,
    /// Metadados específicos do PDF
    pub pdf_metadata: PdfMetadata,
    /// Estado do documento
    pub status: DocumentStatus,
    /// Data/hora da última modificação conhecida
    pub last_modified: Option<chrono::DateTime<chrono::Utc>>,
}

impl PdfDocument {
    /// Cria um novo documento PDF a partir de um caminho
    pub fn from_path(path: &Path) -> Result<Self> {
        let metadata = std::fs::metadata(path)
            .map_err(|e| AppError::from_io_error("reading file metadata", path.to_path_buf(), e))?;
        
        // Validações básicas
        if !metadata.is_file() {
            return Err(AppError::validation(format!("Path is not a file: {}", path.display())));
        }
        
        if metadata.len() == 0 {
            return Err(AppError::validation(format!("File is empty: {}", path.display())));
        }
        
        // Verifica extensão (opcional, mas útil)
        if let Some(ext) = path.extension() {
            if ext.to_string_lossy().to_lowercase() != "pdf" {
                warn!(
                    path = %path.display(),
                    extension = %ext.to_string_lossy(),
                    "File does not have .pdf extension"
                );
            }
        }
        
        Ok(Self {
            id: PdfId::new(),
            file_path: path.to_path_buf(),
            file_info: FileInfo::from_metadata(&metadata, path)?,
            pdf_metadata: PdfMetadata::default(), // Será preenchido posteriormente
            status: DocumentStatus::Loaded,
            last_modified: metadata.modified().ok().map(|t| {
                chrono::DateTime::<chrono::Utc>::from(t)
            }),
        })
    }
    
    /// Valida o documento para operações
    pub fn validate_for_operation(&self, operation: &PdfOperation) -> Result<()> {
        match operation {
            PdfOperation::Merge => {
                // Para merge, precisamos que o documento esteja válido
                if self.status != DocumentStatus::Valid {
                    return Err(AppError::validation(
                        format!("Document {} is not valid for merge", self.id)
                    ));
                }
            }
            PdfOperation::Split => {
                // Para split, precisamos de informações de páginas
                if self.pdf_metadata.page_count == 0 {
                    return Err(AppError::validation(
                        format!("Document {} has no pages for split", self.id)
                    ));
                }
            }
            PdfOperation::Validate | PdfOperation::ExtractMetadata => {
                // Sempre permitido
            }
            _ => {
                // Outras operações são permitidas por padrão
            }
        }
        
        Ok(())
    }
    
    /// Atualiza metadados do PDF
    pub fn update_metadata(&mut self, metadata: PdfMetadata) {
        self.pdf_metadata = metadata;
        self.status = DocumentStatus::Valid;
    }
}

/// Estado do documento PDF
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DocumentStatus {
    /// Documento carregado mas não analisado
    Loaded,
    /// Documento válido e pronto para operações
    Valid,
    /// Documento corrompido ou inválido
    Corrupted,
    /// Documento criptografado/protegido
    Encrypted,
    /// Documento em processamento
    Processing,
    /// Operação concluída com sucesso
    Completed,
    /// Operação falhou
    Failed,
}

// ==================== INFORMAÇÕES DE ARQUIVO ====================

/// Informações gerais do arquivo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    /// Nome do arquivo (sem caminho)
    pub filename: String,
    /// Extensão do arquivo
    pub extension: Option<String>,
    /// Tamanho em bytes
    pub size: u64,
    /// Data de criação
    pub created: Option<chrono::DateTime<chrono::Utc>>,
    /// Data de modificação
    pub modified: Option<chrono::DateTime<chrono::Utc>>,
    /// Data de último acesso
    pub accessed: Option<chrono::DateTime<chrono::Utc>>,
    /// Permissões do arquivo
    pub permissions: FilePermissions,
}

impl FileInfo {
    /// Cria a partir de metadados do sistema
    pub fn from_metadata(metadata: &std::fs::Metadata, path: &Path) -> Result<Self> {
        let filename = path.file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());
        
        let extension = path.extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_string());
        
        let permissions = FilePermissions::from_metadata(metadata);
        
        Ok(Self {
            filename,
            extension,
            size: metadata.len(),
            created: metadata.created().ok().map(|t| chrono::DateTime::<chrono::Utc>::from(t)),
            modified: metadata.modified().ok().map(|t| chrono::DateTime::<chrono::Utc>::from(t)),
            accessed: metadata.accessed().ok().map(|t| chrono::DateTime::<chrono::Utc>::from(t)),
            permissions,
        })
    }
    
    /// Formata o tamanho do arquivo de forma legível
    pub fn format_size(&self) -> String {
        const UNITS: [&str; 6] = ["B", "KB", "MB", "GB", "TB", "PB"];
        let mut size = self.size as f64;
        let mut unit_index = 0;
        
        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }
        
        format!("{:.2} {}", size, UNITS[unit_index])
    }
    
    /// Verifica se o arquivo é um PDF baseado na extensão
    pub fn is_likely_pdf(&self) -> bool {
        self.extension.as_ref()
            .map(|ext| ext.eq_ignore_ascii_case("pdf"))
            .unwrap_or(false)
    }
}

/// Permissões do arquivo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePermissions {
    /// Leitura permitida
    pub readable: bool,
    /// Escrita permitida
    pub writable: bool,
    /// Execução permitida
    pub executable: bool,
}

impl FilePermissions {
    /// Cria a partir de metadados do sistema
    pub fn from_metadata(metadata: &std::fs::Metadata) -> Self {
        #[cfg(unix)]
        use std::os::unix::fs::PermissionsExt;
        
        #[cfg(unix)]
        let mode = metadata.permissions().mode();
        #[cfg(not(unix))]
        let mode = 0;
        
        Self {
            readable: mode & 0o444 != 0,
            writable: mode & 0o222 != 0,
            executable: mode & 0o111 != 0,
        }
    }
}

// ==================== METADADOS DE PDF ====================

/// Metadados específicos de PDF (expandidos)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfMetadata {
    /// Número total de páginas
    pub page_count: u32,
    /// Versão do PDF (ex: "1.5")
    pub version: String,
    /// Título do documento
    pub title: Option<String>,
    /// Autor do documento
    pub author: Option<String>,
    /// Assunto
    pub subject: Option<String>,
    /// Palavras-chave
    pub keywords: Vec<String>,
    /// Criador (software)
    pub creator: Option<String>,
    /// Produtor
    pub producer: Option<String>,
    /// Data de criação
    pub creation_date: Option<String>,
    /// Data de modificação
    pub modification_date: Option<String>,
    /// O PDF está criptografado?
    pub encrypted: bool,
    /// Permissões (se criptografado)
    pub permissions: PdfPermissions,
    /// Informações de páginas individuais
    pub pages: Vec<PageInfo>,
    /// Informações de fontes incorporadas
    pub embedded_fonts: Vec<FontInfo>,
    /// Informações de imagens
    pub images: Vec<ImageInfo>,
    /// Informações de anotações/comentários
    pub annotations: Vec<AnnotationInfo>,
    /// Bookmarks/outlines
    pub bookmarks: Vec<BookmarkInfo>,
    /// Informações técnicas
    pub technical_info: TechnicalInfo,
}

impl Default for PdfMetadata {
    fn default() -> Self {
        Self {
            page_count: 0,
            version: "1.4".to_string(), // Versão mais comum
            title: None,
            author: None,
            subject: None,
            keywords: Vec::new(),
            creator: None,
            producer: None,
            creation_date: None,
            modification_date: None,
            encrypted: false,
            permissions: PdfPermissions::default(),
            pages: Vec::new(),
            embedded_fonts: Vec::new(),
            images: Vec::new(),
            annotations: Vec::new(),
            bookmarks: Vec::new(),
            technical_info: TechnicalInfo::default(),
        }
    }
}

impl PdfMetadata {
    /// Cria um resumo básico do documento
    pub fn summary(&self) -> PdfSummary {
        PdfSummary {
            page_count: self.page_count,
            title: self.title.clone(),
            author: self.author.clone(),
            encrypted: self.encrypted,
            has_images: !self.images.is_empty(),
            has_annotations: !self.annotations.is_empty(),
            has_bookmarks: !self.bookmarks.is_empty(),
        }
    }
}

/// Resumo do documento PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfSummary {
    pub page_count: u32,
    pub title: Option<String>,
    pub author: Option<String>,
    pub encrypted: bool,
    pub has_images: bool,
    pub has_annotations: bool,
    pub has_bookmarks: bool,
}

/// Permissões do PDF (se criptografado)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PdfPermissions {
    /// Permite impressão
    pub allow_printing: bool,
    /// Permite modificação
    pub allow_modification: bool,
    /// Permite copiar texto
    pub allow_copy_text: bool,
    /// Permite adicionar anotações
    pub allow_annotations: bool,
    /// Permite preencher formulários
    pub allow_form_filling: bool,
    /// Permite extração de conteúdo
    pub allow_content_extraction: bool,
    /// Permite montagem do documento
    pub allow_document_assembly: bool,
}

/// Informações de uma página específica
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageInfo {
    /// Número da página (1-indexed)
    pub page_number: u32,
    /// Dimensões (largura x altura em pontos)
    pub dimensions: (f64, f64),
    /// Rotação (0, 90, 180, 270)
    pub rotation: u32,
    /// Conteúdo da página (texto extraído, se disponível)
    pub content: Option<String>,
    /// Número de objetos na página
    pub object_count: usize,
    /// Tem recursos específicos?
    pub has_annotations: bool,
    pub has_images: bool,
    pub has_text: bool,
}

/// Informações de fonte incorporada
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontInfo {
    pub name: String,
    pub font_type: FontType,
    pub embedded: bool,
    pub subset: bool,
}

/// Tipo de fonte
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FontType {
    Type0,
    Type1,
    MMType1,
    Type3,
    TrueType,
    CIDFontType0,
    CIDFontType2,
    Unknown,
}

/// Informações de imagem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub format: ImageFormat,
    pub width: u32,
    pub height: u32,
    pub color_space: ColorSpace,
    pub bits_per_component: u8,
    pub compressed: bool,
    pub size_bytes: Option<u64>,
}

/// Formato de imagem
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImageFormat {
    JPEG,
    JPEG2000,
    CCITTFax,
    JBIG2,
    Raw,
    Unknown,
}

/// Espaço de cor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ColorSpace {
    DeviceGray,
    DeviceRGB,
    DeviceCMYK,
    CalGray,
    CalRGB,
    Lab,
    ICCBased,
    Indexed,
    Pattern,
    Separation,
    DeviceN,
    Unknown,
}

/// Informações de anotação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnotationInfo {
    pub annotation_type: AnnotationType,
    pub page: u32,
    pub rectangle: (f64, f64, f64, f64), // x1, y1, x2, y2
    pub contents: Option<String>,
    pub author: Option<String>,
    pub creation_date: Option<String>,
}

/// Tipo de anotação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnnotationType {
    Text,
    Link,
    FreeText,
    Line,
    Square,
    Circle,
    Polygon,
    PolyLine,
    Highlight,
    Underline,
    Squiggly,
    StrikeOut,
    Stamp,
    Caret,
    Ink,
    Popup,
    FileAttachment,
    Sound,
    Movie,
    Widget,
    Screen,
    PrinterMark,
    TrapNet,
    Watermark,
    ThreeD,
    Redact,
    Unknown,
}

/// Informações de bookmark
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkInfo {
    pub title: String,
    pub level: u32,
    pub page: u32,
    pub children: Vec<BookmarkInfo>,
}

/// Informações técnicas
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TechnicalInfo {
    /// Número total de objetos
    pub total_objects: usize,
    /// Tamanho do arquivo após descompactação
    pub uncompressed_size: Option<u64>,
    /// PDF é linearizado (otimizado para web)?
    pub linearized: bool,
    /// Usa compressão?
    pub compressed: bool,
    /// Tipo de compressão usado
    pub compression_types: Vec<CompressionType>,
    /// Contagem de objetos por tipo
    pub object_counts: std::collections::HashMap<String, usize>,
    /// Erros/warnings na análise
    pub analysis_warnings: Vec<String>,
}

/// Tipo de compressão
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompressionType {
    Flate,
    LZW,
    CCITTFax,
    JPEG,
    JPEG2000,
    JBIG2,
    RunLength,
    Unknown,
}

// ==================== OPERAÇÕES E RESULTADOS ====================

/// Tipo de operação de PDF
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PdfOperation {
    Merge,
    Split,
    Validate,
    ExtractMetadata,
    ExtractText,
    ExtractImages,
    Compress,
    Encrypt,
    Decrypt,
    Repair,
    Watermark,
}

/// Resultado de uma operação de PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfOperationResult {
    /// ID da operação
    pub operation_id: uuid::Uuid,
    /// Tipo de operação
    pub operation_type: PdfOperation,
    /// Status da operação
    pub status: OperationStatus,
    /// Documentos de entrada
    pub input_documents: Vec<PdfDocument>,
    /// Documentos de saída (se aplicável)
    pub output_documents: Vec<PdfDocument>,
    /// Estatísticas da operação
    pub statistics: OperationStatistics,
    /// Erros/warnings
    pub issues: Vec<OperationIssue>,
    /// Tempo de início
    pub start_time: chrono::DateTime<chrono::Utc>,
    /// Tempo de término
    pub end_time: Option<chrono::DateTime<chrono::Utc>>,
    /// Duração em milissegundos
    pub duration_ms: Option<u64>,
}

impl PdfOperationResult {
    /// Cria um novo resultado
    pub fn new(operation_type: PdfOperation, input_documents: Vec<PdfDocument>) -> Self {
        Self {
            operation_id: uuid::Uuid::new_v4(),
            operation_type,
            status: OperationStatus::Pending,
            input_documents,
            output_documents: Vec::new(),
            statistics: OperationStatistics::default(),
            issues: Vec::new(),
            start_time: chrono::Utc::now(),
            end_time: None,
            duration_ms: None,
        }
    }
    
    /// Marca a operação como concluída
    pub fn complete(&mut self, output_documents: Vec<PdfDocument>) {
        self.status = OperationStatus::Completed;
        self.output_documents = output_documents;
        self.end_time = Some(chrono::Utc::now());
        self.duration_ms = self.end_time
            .map(|end| (end - self.start_time).num_milliseconds() as u64);
    }
    
    /// Marca a operação como falha
    pub fn fail(&mut self, error: &str) {
        self.status = OperationStatus::Failed;
        self.issues.push(OperationIssue::error(error));
        self.end_time = Some(chrono::Utc::now());
        self.duration_ms = self.end_time
            .map(|end| (end - self.start_time).num_milliseconds() as u64);
    }
    
    /// Adiciona um warning
    pub fn add_warning(&mut self, warning: &str) {
        self.issues.push(OperationIssue::warning(warning));
    }
    
    /// Adiciona uma informação
    pub fn add_info(&mut self, info: &str) {
        self.issues.push(OperationIssue::info(info));
    }
}

/// Status da operação
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OperationStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

/// Estatísticas da operação
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OperationStatistics {
    pub pages_processed: u32,
    pub files_processed: usize,
    pub total_input_size: u64,
    pub total_output_size: u64,
    pub compression_ratio: Option<f64>,
    pub memory_used_mb: Option<f64>,
}

/// Issue da operação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationIssue {
    pub severity: IssueSeverity,
    pub message: String,
    pub details: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl OperationIssue {
    pub fn error(message: &str) -> Self {
        Self {
            severity: IssueSeverity::Error,
            message: message.to_string(),
            details: None,
            timestamp: chrono::Utc::now(),
        }
    }
    
    pub fn warning(message: &str) -> Self {
        Self {
            severity: IssueSeverity::Warning,
            message: message.to_string(),
            details: None,
            timestamp: chrono::Utc::now(),
        }
    }
    
    pub fn info(message: &str) -> Self {
        Self {
            severity: IssueSeverity::Info,
            message: message.to_string(),
            details: None,
            timestamp: chrono::Utc::now(),
        }
    }
}

/// Severidade do issue
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
}

// ==================== REQUEST/RESPONSE TYPES ====================

/// Request de merge com validações
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeRequest {
    pub files: Vec<PathBuf>,
    pub output_path: PathBuf,
    pub config: MergeConfig,
}

impl MergeRequest {
    pub fn from_value(data: &Value) -> Result<Self> {
        serde_json::from_value(data.clone())
            .map_err(|e| AppError::validation(format!("Invalid merge request: {}", e)))
    }
    
    pub fn validate(&self) -> Result<()> {
        if self.files.is_empty() {
            return Err(AppError::validation("No files provided for merge"));
        }
        
        if self.output_path.parent().is_none() {
            return Err(AppError::validation("Output path must include directory"));
        }
        
        Ok(())
    }
}

/// Configurações de merge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeConfig {
    #[serde(default = "default_true")]
    pub preserve_metadata: bool,
    #[serde(default)]
    pub optimize_size: bool,
    #[serde(default = "default_true")]
    pub keep_bookmarks: bool,
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

/// Request de split
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitRequest {
    pub file_path: PathBuf,
    pub ranges: Vec<PageRange>,
    pub output_dir: PathBuf,
    pub config: SplitConfig,
}

/// Intervalo de páginas
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PageRange {
    pub start: u32,
    pub end: u32,
}

impl PageRange {
    pub fn new(start: u32, end: u32) -> Result<Self> {
        if start < 1 {
            return Err(AppError::validation("Page numbers start at 1"));
        }
        if end < start {
            return Err(AppError::validation("End page must be >= start page"));
        }
        
        Ok(Self { start, end })
    }
    
    pub fn single(page: u32) -> Result<Self> {
        Self::new(page, page)
    }
    
    pub fn page_count(&self) -> u32 {
        self.end - self.start + 1
    }
}

/// Configurações de split
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitConfig {
    #[serde(default = "default_true")]
    pub preserve_metadata: bool,
    #[serde(default = "default_split_pattern")]
    pub naming_pattern: String,
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

// ==================== FUNÇÕES AUXILIARES ====================

fn default_true() -> bool {
    true
}

fn default_compression_level() -> u8 {
    6
}

fn default_split_pattern() -> String {
    "split_{index}".to_string()
}

// ==================== TESTES ====================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[test]
    fn test_pdf_id_generation() {
        let id1 = PdfId::new();
        let id2 = PdfId::new();
        
        assert_ne!(id1, id2);
        assert!(!id1.as_str().is_empty());
        assert!(!id2.as_str().is_empty());
        
        let parsed = PdfId::parse_str(&id1.as_str());
        assert!(parsed.is_ok());
        assert_eq!(parsed.unwrap(), id1);
    }

    #[test]
    fn test_pdf_document_creation() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let path = temp_file.path();
        
        // Escreve algo no arquivo
        std::fs::write(path, b"test content")?;
        
        let doc = PdfDocument::from_path(path)?;
        
        assert_eq!(doc.file_path, path);
        assert!(doc.file_info.size > 0);
        assert_eq!(doc.status, DocumentStatus::Loaded);
        
        Ok(())
    }

    #[test]
    fn test_file_info_size_formatting() {
        let info = FileInfo {
            filename: "test.pdf".to_string(),
            extension: Some("pdf".to_string()),
            size: 1500, // 1.5 KB
            created: None,
            modified: None,
            accessed: None,
            permissions: FilePermissions {
                readable: true,
                writable: true,
                executable: false,
            },
        };
        
        let formatted = info.format_size();
        assert!(formatted.contains("KB"));
    }

    #[test]
    fn test_page_range_validation() -> Result<()> {
        let range = PageRange::new(1, 10)?;
        assert_eq!(range.start, 1);
        assert_eq!(range.end, 10);
        assert_eq!(range.page_count(), 10);
        
        let single = PageRange::single(5)?;
        assert_eq!(single.start, 5);
        assert_eq!(single.end, 5);
        assert_eq!(single.page_count(), 1);
        
        assert!(PageRange::new(0, 5).is_err()); // start < 1
        assert!(PageRange::new(10, 5).is_err()); // end < start
        
        Ok(())
    }

    #[test]
    fn test_pdf_metadata_summary() {
        let metadata = PdfMetadata {
            page_count: 25,
            title: Some("Test Document".to_string()),
            author: Some("John Doe".to_string()),
            encrypted: false,
            images: vec![ImageInfo {
                format: ImageFormat::JPEG,
                width: 800,
                height: 600,
                color_space: ColorSpace::DeviceRGB,
                bits_per_component: 8,
                compressed: true,
                size_bytes: Some(102400),
            }],
            annotations: vec![],
            bookmarks: vec![],
            ..Default::default()
        };
        
        let summary = metadata.summary();
        assert_eq!(summary.page_count, 25);
        assert_eq!(summary.title, Some("Test Document".to_string()));
        assert!(summary.has_images);
        assert!(!summary.has_annotations);
        assert!(!summary.has_bookmarks);
    }

    #[test]
    fn test_pdf_operation_result() {
        let mut result = PdfOperationResult::new(
            PdfOperation::Merge,
            Vec::new()
        );
        
        assert_eq!(result.status, OperationStatus::Pending);
        
        result.complete(Vec::new());
        assert_eq!(result.status, OperationStatus::Completed);
        assert!(result.end_time.is_some());
        assert!(result.duration_ms.is_some());
        
        let mut result2 = PdfOperationResult::new(
            PdfOperation::Split,
            Vec::new()
        );
        
        result2.fail("Test error");
        assert_eq!(result2.status, OperationStatus::Failed);
        assert_eq!(result2.issues.len(), 1);
        assert_eq!(result2.issues[0].severity, IssueSeverity::Error);
    }

    #[test]
    fn test_operation_issue_creation() {
        let error = OperationIssue::error("Something went wrong");
        assert_eq!(error.severity, IssueSeverity::Error);
        
        let warning = OperationIssue::warning("Be careful");
        assert_eq!(warning.severity, IssueSeverity::Warning);
        
        let info = OperationIssue::info("Processing complete");
        assert_eq!(info.severity, IssueSeverity::Info);
    }
}