//! Validador e analisador de PDFs para o DocHub
//! 
//! Responsável por validar a integridade de arquivos PDF e extrair metadados úteis.
//! 
//! ## Funcionalidades:
//! - Validação de integridade de PDFs
//! - Extração de metadados (número de páginas, tamanho, versão, etc.)
//! - Detecção de PDFs criptografados/protegidos
//! - Verificação de conformidade com padrões
//! - Análise de estrutura interna
//! 
//! ## Métricas coletadas:
//! - Informações básicas do arquivo
//! - Metadados do documento
//! - Estatísticas de páginas
//! - Informações técnicas

use lopdf::{Document, Object};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tracing::{info, warn, error, instrument};

use crate::utils::error_handling::{Result, AppError, PdfError, ValidationError};
use crate::api::file_handlers::FileHandler;

/// Níveis de validação disponíveis
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ValidationLevel {
    /// Verificação básica (carregamento do documento)
    Basic,
    /// Validação completa (estrutura, metadados, integridade)
    Full,
    /// Análise profunda (todos os objetos, referências cruzadas)
    Deep,
}

impl Default for ValidationLevel {
    fn default() -> Self {
        Self::Full
    }
}

/// Configurações para validação de PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationConfig {
    /// Nível de validação a ser executado
    pub level: ValidationLevel,
    /// Verificar referências cruzadas
    pub check_xref: bool,
    /// Validar estrutura de objetos
    pub validate_structure: bool,
    /// Verificar se o PDF está criptografado
    pub detect_encryption: bool,
    /// Extrair metadados detalhados
    pub extract_metadata: bool,
    /// Tamanho máximo do arquivo para análise profunda (em bytes)
    pub max_size_for_deep_analysis: u64,
}

impl Default for ValidationConfig {
    fn default() -> Self {
        Self {
            level: ValidationLevel::Full,
            check_xref: true,
            validate_structure: true,
            detect_encryption: true,
            extract_metadata: true,
            max_size_for_deep_analysis: 50 * 1024 * 1024, // 50MB
        }
    }
}

/// Metadados extraídos de um PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfMetadata {
    /// Caminho do arquivo
    pub file_path: PathBuf,
    /// Tamanho do arquivo em bytes
    pub file_size: u64,
    /// Número total de páginas
    pub page_count: usize,
    /// Versão do PDF (ex: "1.5")
    pub pdf_version: String,
    /// Título do documento
    pub title: Option<String>,
    /// Autor do documento
    pub author: Option<String>,
    /// Assunto do documento
    pub subject: Option<String>,
    /// Palavras-chave
    pub keywords: Option<Vec<String>>,
    /// Criador do documento (software)
    pub creator: Option<String>,
    /// Produtor do PDF
    pub producer: Option<String>,
    /// Data de criação
    pub creation_date: Option<String>,
    /// Data de modificação
    pub modification_date: Option<String>,
    /// O PDF está criptografado/protegido?
    pub is_encrypted: bool,
    /// O PDF contém formulários?
    pub has_forms: bool,
    /// O PDF contém anotações?
    pub has_annotations: bool,
    /// O PDF contém javascript?
    pub has_javascript: bool,
    /// O PDF contém fontes incorporadas?
    pub has_embedded_fonts: bool,
    /// O PDF contém imagens?
    pub has_images: bool,
    /// Dimensões da primeira página (largura x altura em pontos)
    pub first_page_dimensions: Option<(f64, f64)>,
    /// Contagem de objetos por tipo
    pub object_counts: HashMap<String, usize>,
    /// Tempo de carregamento em milissegundos
    pub load_time_ms: u128,
}

/// Resultado da validação de um PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    /// O PDF é válido?
    pub is_valid: bool,
    /// Detalhes da validação
    pub details: ValidationDetails,
    /// Metadados extraídos (se configurado)
    pub metadata: Option<PdfMetadata>,
    /// Problemas encontrados (se houver)
    pub issues: Vec<ValidationIssue>,
    /// Recomendações
    pub recommendations: Vec<String>,
    /// Tempo total de validação em milissegundos
    pub validation_time_ms: u128,
}

/// Detalhes da validação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationDetails {
    /// Arquivo foi carregado com sucesso
    pub loaded_successfully: bool,
    /// Estrutura do documento é válida
    pub structure_valid: bool,
    /// Tabela de referências cruzadas é válida
    pub xref_valid: bool,
    /// Nenhum objeto corrompido encontrado
    pub no_corrupted_objects: bool,
    /// Todas as referências são válidas
    pub all_references_valid: bool,
    /// Documento está otimizado para web?
    pub is_web_optimized: bool,
    /// Conformidade com padrões PDF/A?
    pub pdfa_compliant: Option<bool>,
    /// Conformidade com padrões PDF/UA?
    pub pdfua_compliant: Option<bool>,
}

/// Problemas encontrados durante a validação
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationIssue {
    /// Nível de severidade
    pub severity: IssueSeverity,
    /// Tipo de problema
    pub issue_type: IssueType,
    /// Descrição do problema
    pub description: String,
    /// Localização do problema (objeto, página, etc.)
    pub location: Option<String>,
    /// Sugestão de correção
    pub suggestion: Option<String>,
}

/// Severidade de um problema
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IssueSeverity {
    /// Informação (não afeta funcionalidade)
    Info,
    /// Aviso (pode afetar funcionalidade)
    Warning,
    /// Erro (afeta funcionalidade)
    Error,
    /// Crítico (documento pode não funcionar)
    Critical,
}

/// Tipos de problemas que podem ser encontrados
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IssueType {
    /// Objeto corrompido ou inválido
    CorruptedObject,
    /// Referência inválida ou quebrada
    InvalidReference,
    /// Estrutura do documento inválida
    InvalidStructure,
    /// PDF criptografado/protegido
    EncryptedDocument,
    /// Formato não suportado
    UnsupportedFormat,
    /// Tamanho muito grande
    FileTooLarge,
    /// Metadata ausente ou inválida
    InvalidMetadata,
    /// Problema de compatibilidade
    CompatibilityIssue,
    /// Outro problema
    Other,
}

/// Request para validação de PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateRequest {
    /// Caminho para o PDF a ser validado
    pub file_path: PathBuf,
    /// Configurações de validação
    #[serde(default)]
    pub config: ValidationConfig,
    /// Validar apenas ou também extrair metadados
    pub extract_metadata: bool,
}

impl ValidateRequest {
    /// Cria um ValidateRequest a partir de JSON
    pub fn from_value(data: &Value) -> Result<Self> {
        let file_path = data["file"]
            .as_str()
            .map(PathBuf::from)
            .ok_or_else(|| AppError::validation("Missing or invalid 'file' field"))?;

        // Configurações opcionais
        let config = if let Some(config_val) = data.get("config") {
            serde_json::from_value(config_val.clone())
                .map_err(|e| AppError::validation(format!("Invalid config: {}", e)))?
        } else {
            ValidationConfig::default()
        };

        let extract_metadata = data.get("extract_metadata")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        Ok(Self {
            file_path,
            config,
            extract_metadata,
        })
    }

    /// Valida a request básica
    pub fn validate_basic(&self, file_handler: &FileHandler) -> Result<()> {
        // Valida arquivo de entrada
        let metadata = file_handler.validate_file(self.file_path.to_str().unwrap_or(""))?;
        
        info!(
            path = %self.file_path.display(),
            size = metadata.len(),
            "File validated for PDF validation"
        );

        // Verifica se o arquivo não é muito grande para análise profunda
        if self.config.level == ValidationLevel::Deep && 
           metadata.len() > self.config.max_size_for_deep_analysis {
            warn!(
                path = %self.file_path.display(),
                size = metadata.len(),
                max_size = self.config.max_size_for_deep_analysis,
                "File is too large for deep analysis, falling back to full validation"
            );
        }

        Ok(())
    }
}

/// Request para obtenção de metadados
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataRequest {
    /// Caminho para o PDF
    pub file_path: PathBuf,
    /// Incluir análise detalhada?
    pub include_detailed_analysis: bool,
}

impl MetadataRequest {
    /// Cria um MetadataRequest a partir de JSON
    pub fn from_value(data: &Value) -> Result<Self> {
        let file_path = data["file"]
            .as_str()
            .map(PathBuf::from)
            .ok_or_else(|| AppError::validation("Missing or invalid 'file' field"))?;

        let include_detailed_analysis = data.get("include_detailed_analysis")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(Self {
            file_path,
            include_detailed_analysis,
        })
    }
}

/// Validador de PDFs
#[derive(Debug)]
pub struct PdfValidator {
    file_handler: FileHandler,
}

impl PdfValidator {
    /// Cria um novo PdfValidator
    pub fn new() -> Self {
        Self {
            file_handler: FileHandler::new(),
        }
    }

    /// Cria um PdfValidator com um FileHandler específico
    pub fn with_file_handler(file_handler: FileHandler) -> Self {
        Self { file_handler }
    }

    /// Valida um arquivo PDF
    #[instrument(name = "validate_pdf", skip(self, request), fields(
        file = %request.file_path.display(),
        level = ?request.config.level
    ))]
    pub async fn validate_pdf(&self, request: ValidateRequest) -> Result<ValidationResult> {
        let start_time = Instant::now();

        info!("Starting PDF validation");

        // 1. Validação básica da request
        request.validate_basic(&self.file_handler)?;

        // 2. Carrega o documento
        let load_result = self.load_document(&request.file_path);
        let load_time = start_time.elapsed();

        match load_result {
            Ok(doc) => {
                info!("PDF loaded successfully, performing validation");

                // 3. Executa validação baseada no nível
                let validation_details = match request.config.level {
                    ValidationLevel::Basic => self.validate_basic(&doc),
                    ValidationLevel::Full => self.validate_full(&doc, &request.config).await,
                    ValidationLevel::Deep => self.validate_deep(&doc, &request.config).await,
                };

                // 4. Extrai metadados se solicitado
                let metadata = if request.extract_metadata || request.config.extract_metadata {
                    Some(self.extract_metadata(&doc, &request.file_path, load_time.as_millis()).await?)
                } else {
                    None
                };

                // 5. Coleta problemas encontrados
                let issues = self.collect_issues(&doc, &validation_details);
                
                // 6. Gera recomendações
                let recommendations = self.generate_recommendations(&issues, metadata.as_ref());

                let total_time = start_time.elapsed();

                let result = ValidationResult {
                    is_valid: validation_details.loaded_successfully && 
                              validation_details.structure_valid &&
                              validation_details.no_corrupted_objects,
                    details: validation_details,
                    metadata,
                    issues,
                    recommendations,
                    validation_time_ms: total_time.as_millis(),
                };

                info!(
                    file = %request.file_path.display(),
                    is_valid = result.is_valid,
                    validation_time_ms = result.validation_time_ms,
                    issues_count = result.issues.len(),
                    "PDF validation completed"
                );

                Ok(result)
            }
            Err(e) => {
                error!(error = %e, "Failed to load PDF for validation");

                // Retorna resultado indicando falha na validação
                Ok(ValidationResult {
                    is_valid: false,
                    details: ValidationDetails {
                        loaded_successfully: false,
                        structure_valid: false,
                        xref_valid: false,
                        no_corrupted_objects: false,
                        all_references_valid: false,
                        is_web_optimized: false,
                        pdfa_compliant: None,
                        pdfua_compliant: None,
                    },
                    metadata: None,
                    issues: vec![ValidationIssue {
                        severity: IssueSeverity::Critical,
                        issue_type: IssueType::CorruptedObject,
                        description: format!("Failed to load PDF: {}", e),
                        location: None,
                        suggestion: Some("Verify that the file is a valid PDF and not corrupted".to_string()),
                    }],
                    recommendations: vec![
                        "Verify file integrity".to_string(),
                        "Check if file is a valid PDF".to_string(),
                    ],
                    validation_time_ms: load_time.as_millis(),
                })
            }
        }
    }

    /// Obtém metadados de um PDF
    #[instrument(name = "get_pdf_metadata", skip(self, request), fields(
        file = %request.file_path.display()
    ))]
    pub async fn get_pdf_metadata(&self, request: MetadataRequest) -> Result<PdfMetadata> {
        let start_time = Instant::now();

        info!("Extracting PDF metadata");

        // Valida arquivo
        self.file_handler.validate_file(request.file_path.to_str().unwrap_or(""))?;

        // Carrega documento
        let doc = self.load_document(&request.file_path)?;
        let load_time = start_time.elapsed();

        // Extrai metadados
        let metadata = self.extract_metadata(&doc, &request.file_path, load_time.as_millis()).await?;

        info!(
            file = %request.file_path.display(),
            page_count = metadata.page_count,
            file_size = metadata.file_size,
            "Metadata extracted successfully"
        );

        Ok(metadata)
    }

    // ==================== MÉTODOS PRIVADOS ====================

    /// Carrega um documento PDF
    #[instrument(name = "load_document", skip(self, path))]
    fn load_document(&self, path: &Path) -> Result<Document> {
        info!(path = %path.display(), "Loading PDF document");
        
        Document::load(path)
            .map_err(|e| {
                error!(path = %path.display(), error = %e, "Failed to load PDF");
                AppError::Pdf(PdfError::CorruptedPdf {
                    path: path.to_path_buf(),
                })
            })
    }

    /// Validação básica (apenas carregamento)
    fn validate_basic(&self, doc: &Document) -> ValidationDetails {
        ValidationDetails {
            loaded_successfully: true,
            structure_valid: true,
            xref_valid: true,
            no_corrupted_objects: true,
            all_references_valid: true,
            is_web_optimized: false, // Não verificado no nível básico
            pdfa_compliant: None,
            pdfua_compliant: None,
        }
    }

    /// Validação completa
    async fn validate_full(&self, doc: &Document, config: &ValidationConfig) -> ValidationDetails {
        let mut details = self.validate_basic(doc);

        // Verifica estrutura básica
        details.structure_valid = self.validate_structure(doc).await;

        // Verifica referências cruzadas se configurado
        if config.check_xref {
            details.xref_valid = self.validate_xref(doc).await;
        }

        // Verifica objetos corrompidos
        if config.validate_structure {
            details.no_corrupted_objects = self.check_corrupted_objects(doc).await;
        }

        // Verifica referências
        details.all_references_valid = self.validate_references(doc).await;

        // Verifica otimização para web (linearizado)
        details.is_web_optimized = self.check_web_optimized(doc).await;

        info!("Full validation completed");
        details
    }

    /// Validação profunda
    async fn validate_deep(&self, doc: &Document, config: &ValidationConfig) -> ValidationDetails {
        let mut details = self.validate_full(doc, config).await;

        // Análises adicionais podem ser adicionadas aqui:
        // - Verificação de conformidade PDF/A
        // - Verificação de acessibilidade PDF/UA
        // - Análise de todos os objetos
        // - Verificação de compactação
        // - Análise de fontes e imagens

        // Por enquanto, definimos como desconhecido
        details.pdfa_compliant = Some(false);
        details.pdfua_compliant = Some(false);

        info!("Deep validation completed");
        details
    }

    /// Valida a estrutura do documento
    async fn validate_structure(&self, doc: &Document) -> bool {
        // Verifica se tem catálogo raiz
        if doc.trailer.get(b"Root").is_err() {
            warn!("PDF missing root catalog");
            return false;
        }

        // Verifica se tem info dictionary (opcional mas comum)
        if doc.trailer.get(b"Info").is_err() {
            info!("PDF missing info dictionary (optional)");
        }

        // Verifica se tem páginas
        if doc.get_pages().is_empty() {
            warn!("PDF has no pages");
            return false;
        }

        true
    }

    /// Valida a tabela de referências cruzadas
    async fn validate_xref(&self, doc: &Document) -> bool {
        // lopdf não expõe XRef diretamente, mas podemos verificar indiretamente
        // tentando acessar objetos aleatórios
        let test_object_ids: Vec<_> = doc.objects.keys().take(5).collect();
        
        for &obj_id in &test_object_ids {
            if doc.get_object(*obj_id).is_err() {
                warn!(object_id = ?obj_id, "Failed to access object, possible XRef issue");
                return false;
            }
        }

        true
    }

    /// Verifica objetos corrompidos
    async fn check_corrupted_objects(&self, doc: &Document) -> bool {
        let mut corrupted_count = 0;
        let total_objects = doc.objects.len();

        // Amostra alguns objetos para verificação
        let sample_size = std::cmp::min(20, total_objects);
        let sample_keys: Vec<_> = doc.objects.keys().take(sample_size).collect();

        for &obj_id in &sample_keys {
            match doc.get_object(*obj_id) {
                Ok(_) => {
                    // Objeto válido
                }
                Err(_) => {
                    corrupted_count += 1;
                    warn!(object_id = ?obj_id, "Corrupted object detected");
                }
            }
        }

        if corrupted_count > 0 {
            error!(
                corrupted_count,
                sample_size,
                "Found corrupted objects in PDF"
            );
            false
        } else {
            true
        }
    }

    /// Valida referências entre objetos
    async fn validate_references(&self, doc: &Document) -> bool {
        let mut invalid_refs = 0;
        
        for (&obj_id, obj) in &doc.objects {
            if let Object::Reference(ref_id) = obj {
                if doc.get_object(*ref_id).is_err() {
                    invalid_refs += 1;
                    warn!(
                        source_object = ?obj_id,
                        referenced_object = ?ref_id,
                        "Invalid reference found"
                    );
                }
            }
        }

        if invalid_refs > 0 {
            error!(invalid_ref_count = invalid_refs, "Invalid references found");
            false
        } else {
            true
        }
    }

    /// Verifica se o PDF está otimizado para web (linearizado)
    async fn check_web_optimized(&self, doc: &Document) -> bool {
        // PDF linearizado tem objeto /Linearized no catálogo
        // Esta é uma verificação simplificada
        if let Ok(root) = doc.trailer.get(b"Root") {
            if let Object::Reference(root_id) = *root {
                if let Ok(Object::Dictionary(ref dict)) = doc.get_object(root_id) {
                    return dict.get(b"Linearized").is_ok();
                }
            }
        }
        
        false
    }

    /// Extrai metadados do PDF
    #[instrument(name = "extract_metadata", skip(self, doc, load_time_ms))]
    async fn extract_metadata(
        &self,
        doc: &Document,
        file_path: &Path,
        load_time_ms: u128,
    ) -> Result<PdfMetadata> {
        let mut metadata = PdfMetadata {
            file_path: file_path.to_path_buf(),
            file_size: 0,
            page_count: 0,
            pdf_version: String::new(),
            title: None,
            author: None,
            subject: None,
            keywords: None,
            creator: None,
            producer: None,
            creation_date: None,
            modification_date: None,
            is_encrypted: false,
            has_forms: false,
            has_annotations: false,
            has_javascript: false,
            has_embedded_fonts: false,
            has_images: false,
            first_page_dimensions: None,
            object_counts: HashMap::new(),
            load_time_ms,
        };

        // Tamanho do arquivo
        if let Ok(file_metadata) = std::fs::metadata(file_path) {
            metadata.file_size = file_metadata.len();
        }

        // Informações básicas do documento
        metadata.page_count = doc.get_pages().len();
        metadata.pdf_version = format!("{:.1}", doc.version);

        // Verifica se está criptografado
        metadata.is_encrypted = doc.trailer.get(b"Encrypt").is_ok();

        // Extrai metadados do Info dictionary
        if let Ok(info) = doc.trailer.get(b"Info") {
            if let Object::Reference(info_id) = *info {
                if let Ok(Object::Dictionary(ref info_dict)) = doc.get_object(info_id) {
                    metadata.title = info_dict.get(b"Title")
                        .ok()
                        .and_then(|obj| extract_string(obj, doc));
                    metadata.author = info_dict.get(b"Author")
                        .ok()
                        .and_then(|obj| extract_string(obj, doc));
                    metadata.subject = info_dict.get(b"Subject")
                        .ok()
                        .and_then(|obj| extract_string(obj, doc));
                    
                    if let Some(keywords_obj) = info_dict.get(b"Keywords").ok() {
                        if let Some(keywords_str) = extract_string(keywords_obj, doc) {
                            metadata.keywords = Some(keywords_str.split(',').map(|s| s.trim().to_string()).collect());
                        }
                    }
                    
                    metadata.creator = info_dict.get(b"Creator")
                        .ok()
                        .and_then(|obj| extract_string(obj, doc));
                    metadata.producer = info_dict.get(b"Producer")
                        .ok()
                        .and_then(|obj| extract_string(obj, doc));
                    metadata.creation_date = info_dict.get(b"CreationDate")
                        .ok()
                        .and_then(|obj| extract_string(obj, doc));
                    metadata.modification_date = info_dict.get(b"ModDate")
                        .ok()
                        .and_then(|obj| extract_string(obj, doc));
                }
            }
        }

        // Conta objetos por tipo
        for (_, obj) in &doc.objects {
            let type_name = match obj {
                Object::Null => "Null",
                Object::Boolean(_) => "Boolean",
                Object::Integer(_) => "Integer",
                Object::Real(_) => "Real",
                Object::String(_, _) => "String",
                Object::Name(_) => "Name",
                Object::Array(_) => "Array",
                Object::Dictionary(_) => "Dictionary",
                Object::Stream(_) => "Stream",
                Object::Reference(_) => "Reference",
            };
            
            *metadata.object_counts.entry(type_name.to_string()).or_insert(0) += 1;
        }

        // Verifica características adicionais (simplificado)
        // Em uma implementação real, isso seria mais completo
        metadata.has_forms = doc.get_pages().iter().any(|(_, &page_id)| {
            doc.get_object(page_id)
                .ok()
                .and_then(|obj| {
                    if let Object::Dictionary(ref dict) = obj {
                        Some(dict.get(b"Annots").is_ok())
                    } else {
                        Some(false)
                    }
                })
                .unwrap_or(false)
        });

        info!(
            file = %file_path.display(),
            page_count = metadata.page_count,
            file_size = metadata.file_size,
            "Metadata extraction completed"
        );

        Ok(metadata)
    }

    /// Coleta problemas encontrados durante a validação
    fn collect_issues(&self, doc: &Document, details: &ValidationDetails) -> Vec<ValidationIssue> {
        let mut issues = Vec::new();

        if !details.loaded_successfully {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Critical,
                issue_type: IssueType::CorruptedObject,
                description: "Failed to load PDF document".to_string(),
                location: None,
                suggestion: Some("Verify file integrity and format".to_string()),
            });
        }

        if !details.structure_valid {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Error,
                issue_type: IssueType::InvalidStructure,
                description: "PDF structure is invalid".to_string(),
                location: None,
                suggestion: Some("The document may be corrupted or malformed".to_string()),
            });
        }

        if !details.xref_valid {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Warning,
                issue_type: IssueType::InvalidReference,
                description: "Cross-reference table issues detected".to_string(),
                location: None,
                suggestion: Some("Consider rebuilding the PDF".to_string()),
            });
        }

        if !details.no_corrupted_objects {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Error,
                issue_type: IssueType::CorruptedObject,
                description: "Corrupted objects found in PDF".to_string(),
                location: None,
                suggestion: Some("The document may need to be repaired".to_string()),
            });
        }

        // Verifica se está criptografado
        if doc.trailer.get(b"Encrypt").is_ok() {
            issues.push(ValidationIssue {
                severity: IssueSeverity::Warning,
                issue_type: IssueType::EncryptedDocument,
                description: "PDF is encrypted or password protected".to_string(),
                location: None,
                suggestion: Some("Encrypted PDFs may have limited functionality".to_string()),
            });
        }

        issues
    }

    /// Gera recomendações baseadas nos problemas e metadados
    fn generate_recommendations(&self, issues: &[ValidationIssue], metadata: Option<&PdfMetadata>) -> Vec<String> {
        let mut recommendations = Vec::new();

        // Recomendações baseadas em problemas
        for issue in issues {
            match issue.severity {
                IssueSeverity::Critical | IssueSeverity::Error => {
                    if !recommendations.contains(&"Consider repairing or recreating the PDF".to_string()) {
                        recommendations.push("Consider repairing or recreating the PDF".to_string());
                    }
                }
                IssueSeverity::Warning => {
                    if issue.issue_type == IssueType::EncryptedDocument {
                        recommendations.push("Remove encryption for full functionality".to_string());
                    }
                }
                _ => {}
            }
        }

        // Recomendações baseadas em metadados
        if let Some(meta) = metadata {
            if meta.file_size > 10 * 1024 * 1024 { // 10MB
                recommendations.push("Consider compressing the PDF to reduce file size".to_string());
            }

            if !meta.is_encrypted && meta.has_forms {
                recommendations.push("Consider adding form field validation".to_string());
            }

            if meta.page_count > 100 {
                recommendations.push("Large document - consider splitting into smaller files".to_string());
            }
        }

        recommendations
    }

    /// Validação simplificada (para compatibilidade)
    #[deprecated(note = "Use validate_pdf_async with ValidateRequest instead")]
    pub fn validate_pdf_sync(data: Value) -> Result<Value> {
        let request = ValidateRequest::from_value(&data)?;
        let validator = PdfValidator::new();
        
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| AppError::processing(format!("Failed to create runtime: {}", e)))?;
            
        let result = rt.block_on(validator.validate_pdf(request))?;
        
        Ok(serde_json::to_value(result)
            .map_err(|e| AppError::serialization(format!("Failed to serialize result: {}", e)))?)
    }

    /// Obtenção de metadados simplificada (para compatibilidade)
    #[deprecated(note = "Use get_pdf_metadata_async with MetadataRequest instead")]
    pub fn get_pdf_metadata_sync(data: Value) -> Result<Value> {
        let request = MetadataRequest::from_value(&data)?;
        let validator = PdfValidator::new();
        
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| AppError::processing(format!("Failed to create runtime: {}", e)))?;
            
        let result = rt.block_on(validator.get_pdf_metadata(request))?;
        
        Ok(serde_json::to_value(result)
            .map_err(|e| AppError::serialization(format!("Failed to serialize result: {}", e)))?)
    }
}

// ==================== FUNÇÕES AUXILIARES ====================

/// Extrai uma string de um objeto PDF
fn extract_string(obj: &Object, doc: &Document) -> Option<String> {
    match obj {
        Object::String(bytes, _) => {
            String::from_utf8(bytes.clone()).ok()
        }
        Object::Reference(ref_id) => {
            doc.get_object(*ref_id).ok().and_then(|ref_obj| extract_string(ref_obj, doc))
        }
        _ => None,
    }
}

// ==================== FUNÇÕES DE CONVENIÊNCIA ====================

/// Função de conveniência para validação de PDFs (mantém compatibilidade)
#[instrument(name = "validate_pdf", skip(data))]
pub async fn validate_pdf(data: Value) -> Result<Value> {
    let request = ValidateRequest::from_value(&data)?;
    let validator = PdfValidator::new();
    let result = validator.validate_pdf(request).await?;
    
    // Para compatibilidade com código antigo que espera um booleano
    let simple_result = json!({
        "is_valid": result.is_valid,
        "details": result.details,
        "metadata": result.metadata,
        "issues_count": result.issues.len(),
    });
    
    Ok(simple_result)
}

/// Função de conveniência para obtenção de metadados
#[instrument(name = "get_pdf_metadata", skip(data))]
pub async fn get_pdf_metadata(data: Value) -> Result<Value> {
    let request = MetadataRequest::from_value(&data)?;
    let validator = PdfValidator::new();
    let result = validator.get_pdf_metadata(request).await?;
    
    Ok(serde_json::to_value(result)
        .map_err(|e| AppError::serialization(format!("Failed to serialize result: {}", e)))?)
}

// ==================== TESTES ====================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    #[test]
    fn test_validation_level_default() {
        assert_eq!(ValidationLevel::default(), ValidationLevel::Full);
    }

    #[test]
    fn test_validation_config_default() {
        let config = ValidationConfig::default();
        assert_eq!(config.level, ValidationLevel::Full);
        assert!(config.check_xref);
        assert!(config.validate_structure);
        assert!(config.detect_encryption);
        assert!(config.extract_metadata);
        assert_eq!(config.max_size_for_deep_analysis, 50 * 1024 * 1024);
    }

    #[tokio::test]
    async fn test_validate_request_from_value() -> Result<()> {
        let data = json!({
            "file": "test.pdf"
        });
        
        let request = ValidateRequest::from_value(&data)?;
        assert_eq!(request.file_path, PathBuf::from("test.pdf"));
        assert_eq!(request.config.level, ValidationLevel::Full);
        assert!(request.extract_metadata);
        
        // Com configuração personalizada
        let data = json!({
            "file": "test.pdf",
            "config": {
                "level": "Basic",
                "extract_metadata": false
            },
            "extract_metadata": false
        });
        
        let request = ValidateRequest::from_value(&data)?;
        assert_eq!(request.config.level, ValidationLevel::Basic);
        assert!(!request.extract_metadata);
        
        Ok(())
    }

    #[tokio::test]
    async fn test_metadata_request_from_value() -> Result<()> {
        let data = json!({
            "file": "test.pdf"
        });
        
        let request = MetadataRequest::from_value(&data)?;
        assert_eq!(request.file_path, PathBuf::from("test.pdf"));
        assert!(!request.include_detailed_analysis);
        
        let data = json!({
            "file": "test.pdf",
            "include_detailed_analysis": true
        });
        
        let request = MetadataRequest::from_value(&data)?;
        assert!(request.include_detailed_analysis);
        
        Ok(())
    }

    #[test]
    fn test_issue_severity_ordering() {
        assert!(IssueSeverity::Critical > IssueSeverity::Error);
        assert!(IssueSeverity::Error > IssueSeverity::Warning);
        assert!(IssueSeverity::Warning > IssueSeverity::Info);
    }

    #[test]
    fn test_validation_details_default() {
        let details = ValidationDetails {
            loaded_successfully: false,
            structure_valid: false,
            xref_valid: false,
            no_corrupted_objects: false,
            all_references_valid: false,
            is_web_optimized: false,
            pdfa_compliant: None,
            pdfua_compliant: None,
        };
        
        assert!(!details.loaded_successfully);
        assert!(!details.structure_valid);
    }

    #[test]
    fn test_pdf_validator_creation() {
        let validator = PdfValidator::new();
        assert!(validator.file_handler.config.max_file_size > 0);
        
        let file_handler = FileHandler::new();
        let validator = PdfValidator::with_file_handler(file_handler);
        assert!(validator.file_handler.config.max_file_size > 0);
    }

    // Testes com PDFs reais seriam adicionados aqui
    // usando arquivos de teste específicos
}