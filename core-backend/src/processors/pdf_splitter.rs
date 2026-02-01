//! Processador de split de PDFs para o DocHub
//! 
//! Responsável por dividir documentos PDF em múltiplos arquivos baseado em intervalos de páginas.
//! 
//! ## Funcionalidades:
//! - Split por intervalos de páginas (ex: 1-3, 5-7, 10-15)
//! - Split por páginas individuais
//! - Validação de intervalos (ordem, sobreposição, limites)
//! - Preservação de metadados e estrutura
//! - Tratamento de erros robusto
//! 
//! ## Formatos suportados:
//! - Intervalos: "1-3", "5", "7-10"
//! - Listas: "1,3,5-7,9"
//! - Páginas específicas: vec![1, 3, 5]

use lopdf::{Document, Object, ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::fmt;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::time::Instant;
use tracing::{info, warn, error, instrument};

use crate::utils::error_handling::{Result, AppError, PdfError, ValidationError};
use crate::utils::error_handling::validate;
use crate::api::file_handlers::FileHandler;

/// Representa um intervalo de páginas (inclusivo)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PageRange {
    /// Número da primeira página (1-indexed)
    pub start: u32,
    /// Número da última página (1-indexed, inclusive)
    pub end: u32,
}

impl PageRange {
    /// Cria um novo intervalo de páginas
    pub fn new(start: u32, end: u32) -> Result<Self> {
        validate(
            start >= 1,
            AppError::validation(format!("Page numbers must be >= 1, got start={}", start))
        )?;
        
        validate(
            end >= start,
            AppError::validation(format!("End page ({}) must be >= start page ({})", end, start))
        )?;

        Ok(Self { start, end })
    }

    /// Cria um intervalo para uma única página
    pub fn single(page: u32) -> Result<Self> {
        Self::new(page, page)
    }

    /// Verifica se o intervalo contém uma página específica
    pub fn contains(&self, page: u32) -> bool {
        page >= self.start && page <= self.end
    }

    /// Número de páginas no intervalo
    pub fn page_count(&self) -> u32 {
        self.end - self.start + 1
    }

    /// Converte para uma string no formato "start-end" ou "page" se for único
    pub fn to_string(&self) -> String {
        if self.start == self.end {
            format!("{}", self.start)
        } else {
            format!("{}-{}", self.start, self.end)
        }
    }

    /// Tenta criar um intervalo a partir de uma string como "1-3" ou "5"
    pub fn from_str(s: &str) -> Result<Self> {
        let parts: Vec<&str> = s.split('-').collect();
        
        match parts.len() {
            1 => {
                // Página única: "5"
                let page = parts[0].parse::<u32>()
                    .map_err(|_| AppError::validation(format!("Invalid page number: {}", s)))?;
                Self::single(page)
            }
            2 => {
                // Intervalo: "1-3"
                let start = parts[0].parse::<u32>()
                    .map_err(|_| AppError::validation(format!("Invalid start page: {}", parts[0])))?;
                let end = parts[1].parse::<u32>()
                    .map_err(|_| AppError::validation(format!("Invalid end page: {}", parts[1])))?;
                Self::new(start, end)
            }
            _ => Err(AppError::validation(format!("Invalid page range format: {}", s))),
        }
    }

    /// Expande o intervalo em uma lista de números de página
    pub fn expand(&self) -> Vec<u32> {
        (self.start..=self.end).collect()
    }
}

impl fmt::Display for PageRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_string())
    }
}

impl FromStr for PageRange {
    type Err = AppError;

    fn from_str(s: &str) -> Result<Self> {
        Self::from_str(s)
    }
}

/// Parser de intervalos de páginas
#[derive(Debug, Clone)]
pub struct PageRangeParser;

impl PageRangeParser {
    /// Parse uma lista de intervalos em formato string
    /// Exemplo: "1-3,5,7-10" → vec![PageRange{1,3}, PageRange{5,5}, PageRange{7,10}]
    pub fn parse_ranges(input: &str) -> Result<Vec<PageRange>> {
        let parts: Vec<&str> = input.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
        
        validate(
            !parts.is_empty(),
            AppError::validation("No page ranges provided")
        )?;

        let mut ranges = Vec::new();
        for part in parts {
            ranges.push(PageRange::from_str(part)?);
        }

        // Valida se há sobreposições
        Self::validate_no_overlaps(&ranges)?;

        Ok(ranges)
    }

    /// Parse a partir de um array JSON
    pub fn parse_from_json(value: &Value) -> Result<Vec<PageRange>> {
        match value {
            Value::String(s) => {
                // Formato string: "1-3,5,7-10"
                Self::parse_ranges(s)
            }
            Value::Array(arr) => {
                // Formato array de arrays: [[1,3], [5,5], [7,10]]
                let mut ranges = Vec::new();
                
                for item in arr {
                    match item {
                        Value::Array(range_arr) if range_arr.len() == 2 => {
                            let start = range_arr[0].as_u64()
                                .ok_or_else(|| AppError::validation("Invalid start page in range"))? as u32;
                            let end = range_arr[1].as_u64()
                                .ok_or_else(|| AppError::validation("Invalid end page in range"))? as u32;
                            
                            ranges.push(PageRange::new(start, end)?);
                        }
                        Value::Number(num) => {
                            let page = num.as_u64()
                                .ok_or_else(|| AppError::validation("Invalid page number"))? as u32;
                            ranges.push(PageRange::single(page)?);
                        }
                        _ => return Err(AppError::validation("Invalid range format in array")),
                    }
                }
                
                Self::validate_no_overlaps(&ranges)?;
                Ok(ranges)
            }
            _ => Err(AppError::validation("Invalid ranges format, expected string or array")),
        }
    }

    /// Valida que não há sobreposições entre intervalos
    fn validate_no_overlaps(ranges: &[PageRange]) -> Result<()> {
        let mut sorted_ranges = ranges.to_vec();
        sorted_ranges.sort_by_key(|r| r.start);

        for window in sorted_ranges.windows(2) {
            let prev = &window[0];
            let curr = &window[1];
            
            if curr.start <= prev.end {
                return Err(AppError::validation(
                    format!("Overlapping page ranges: {} and {}", prev, curr)
                ));
            }
        }

        Ok(())
    }

    /// Converte intervalos para uma lista plana de números de página
    pub fn ranges_to_page_list(ranges: &[PageRange]) -> Vec<u32> {
        ranges.iter()
            .flat_map(|range| range.expand())
            .collect()
    }
}

/// Configurações para o split de PDFs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitConfig {
    /// Preservar metadados em cada arquivo splitado
    pub preserve_metadata: bool,
    /// Padrão de nomeação para arquivos de saída
    pub naming_pattern: String,
    /// Criar diretório de saída se não existir
    pub create_output_dir: bool,
    /// Manter a ordem original das páginas mesmo em intervalos não sequenciais
    pub preserve_page_order: bool,
}

impl Default for SplitConfig {
    fn default() -> Self {
        Self {
            preserve_metadata: true,
            naming_pattern: "split_{index}".to_string(),
            create_output_dir: true,
            preserve_page_order: true,
        }
    }
}

/// Request para split de PDF
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitRequest {
    /// Caminho para o PDF a ser dividido
    pub file_path: PathBuf,
    /// Intervalos de páginas para split
    pub page_ranges: Vec<PageRange>,
    /// Diretório de saída para os PDFs resultantes
    pub output_dir: PathBuf,
    /// Configurações opcionais do split
    #[serde(default)]
    pub config: SplitConfig,
}

impl SplitRequest {
    /// Cria um SplitRequest a partir de JSON
    pub fn from_value(data: &Value) -> Result<Self> {
        let file_path = data["file"]
            .as_str()
            .map(PathBuf::from)
            .ok_or_else(|| AppError::validation("Missing or invalid 'file' field"))?;

        let ranges_value = &data["ranges"];
        let page_ranges = PageRangeParser::parse_from_json(ranges_value)?;

        let output_dir = data["output_dir"]
            .as_str()
            .map(PathBuf::from)
            .ok_or_else(|| AppError::validation("Missing or invalid 'output_dir' field"))?;

        // Configurações opcionais
        let config = if let Some(config_val) = data.get("config") {
            serde_json::from_value(config_val.clone())
                .map_err(|e| AppError::validation(format!("Invalid config: {}", e)))?
        } else {
            SplitConfig::default()
        };

        Ok(Self {
            file_path,
            page_ranges,
            output_dir,
            config,
        })
    }

    /// Valida a request
    pub fn validate(&self, file_handler: &FileHandler, total_pages: u32) -> Result<()> {
        // 1. Valida arquivo de entrada
        let metadata = file_handler.validate_file(self.file_path.to_str().unwrap_or(""))?;
        
        info!(
            path = %self.file_path.display(),
            size = metadata.len(),
            "Input file validated for split"
        );

        // 2. Valida intervalos de páginas
        validate(
            !self.page_ranges.is_empty(),
            AppError::validation("No page ranges provided for split")
        )?;

        // 3. Valida que todas as páginas estão dentro dos limites
        for (i, range) in self.page_ranges.iter().enumerate() {
            validate(
                range.start <= total_pages,
                AppError::validation(format!(
                    "Range {}: Start page ({}) exceeds total pages ({})",
                    i + 1, range.start, total_pages
                ))
            )?;
            
            validate(
                range.end <= total_pages,
                AppError::validation(format!(
                    "Range {}: End page ({}) exceeds total pages ({})",
                    i + 1, range.end, total_pages
                ))
            )?;
        }

        // 4. Valida diretório de saída
        if self.config.create_output_dir && !self.output_dir.exists() {
            info!(
                output_dir = %self.output_dir.display(),
                "Output directory does not exist, will be created"
            );
        }

        info!(
            file = %self.file_path.display(),
            range_count = self.page_ranges.len(),
            total_pages_requested = self.page_ranges.iter().map(|r| r.page_count()).sum::<u32>(),
            "Split request validated successfully"
        );

        Ok(())
    }

    /// Gera o caminho de saída para um split específico
    pub fn generate_output_path(&self, index: usize) -> PathBuf {
        let pattern = self.config.naming_pattern.replace("{index}", &(index + 1).to_string());
        
        // Também pode suportar outros placeholders como {range}, {start}, {end}
        let pattern = pattern.replace("{range}", &self.page_ranges[index].to_string());
        let pattern = pattern.replace("{start}", &self.page_ranges[index].start.to_string());
        let pattern = pattern.replace("{end}", &self.page_ranges[index].end.to_string());
        
        self.output_dir.join(format!("{}.pdf", pattern))
    }
}

/// Resultado do split
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitResult {
    /// Caminhos dos arquivos gerados
    pub output_files: Vec<PathBuf>,
    /// Número total de páginas processadas
    pub total_pages_processed: u32,
    /// Tamanho total dos arquivos gerados (em bytes)
    pub total_output_size: u64,
    /// Tempo total de processamento (em milissegundos)
    pub processing_time_ms: u128,
    /// Número de arquivos criados
    pub files_created: usize,
    /// Metadados preservados (se aplicável)
    pub metadata_preserved: bool,
    /// Estatísticas por intervalo
    pub range_stats: Vec<RangeStat>,
}

/// Estatísticas para um intervalo específico
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RangeStat {
    /// Intervalo de páginas
    pub range: PageRange,
    /// Caminho do arquivo gerado
    pub output_file: PathBuf,
    /// Tamanho do arquivo (em bytes)
    pub file_size: u64,
    /// Número de páginas neste split
    pub page_count: u32,
}

/// Processador de split de PDFs
#[derive(Debug)]
pub struct PdfSplitter {
    file_handler: FileHandler,
}

impl PdfSplitter {
    /// Cria um novo PdfSplitter
    pub fn new() -> Self {
        Self {
            file_handler: FileHandler::new(),
        }
    }

    /// Cria um PdfSplitter com um FileHandler específico
    pub fn with_file_handler(file_handler: FileHandler) -> Self {
        Self { file_handler }
    }

    /// Divide um PDF em múltiplos arquivos baseado em intervalos de páginas
    #[instrument(name = "split_pdf", skip(self, request), fields(
        input_file = %request.file_path.display(),
        range_count = request.page_ranges.len(),
        output_dir = %request.output_dir.display()
    ))]
    pub async fn split_pdf(&self, request: SplitRequest) -> Result<SplitResult> {
        let start_time = Instant::now();

        info!("Starting PDF split process");

        // 1. Carrega o documento
        let doc = self.load_document(&request.file_path)?;
        let total_pages = doc.get_pages().len() as u32;

        // 2. Valida a request com o número real de páginas
        request.validate(&self.file_handler, total_pages)?;

        // 3. Cria diretório de saída se necessário
        if request.config.create_output_dir && !request.output_dir.exists() {
            self.file_handler.create_dir(request.output_dir.to_str().unwrap_or(""))?;
            info!("Created output directory: {}", request.output_dir.display());
        }

        // 4. Executa o split
        let split_results = self.perform_split(&doc, &request)?;

        let processing_time = start_time.elapsed();

        let result = SplitResult {
            output_files: split_results.iter().map(|r| r.output_file.clone()).collect(),
            total_pages_processed: split_results.iter().map(|r| r.page_count).sum(),
            total_output_size: split_results.iter().map(|r| r.file_size).sum(),
            processing_time_ms: processing_time.as_millis(),
            files_created: split_results.len(),
            metadata_preserved: request.config.preserve_metadata,
            range_stats: split_results,
        };

        info!(
            input_file = %request.file_path.display(),
            files_created = result.files_created,
            total_pages = result.total_pages_processed,
            total_size = result.total_output_size,
            processing_time_ms = result.processing_time_ms,
            "PDF split completed successfully"
        );

        Ok(result)
    }

    // ==================== MÉTODOS PRIVADOS ====================

    /// Carrega um documento PDF com tratamento de erros
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

    /// Executa o split real do documento
    #[instrument(name = "perform_split", skip(self, doc, request))]
    fn perform_split(&self, doc: &Document, request: &SplitRequest) -> Result<Vec<RangeStat>> {
        let pages = doc.get_pages();
        let mut results = Vec::new();
        let mut max_object_id = doc.max_id + 1;

        // Mapa global para rastrear IDs de objetos entre splits
        let mut global_object_id_map = HashMap::new();

        for (range_index, range) in request.page_ranges.iter().enumerate() {
            info!(
                range_index,
                range = %range,
                page_count = range.page_count(),
                "Processing page range"
            );

            let mut split_doc = Document::with_version("1.5");
            let mut object_id_map = HashMap::new();

            // Preserva metadados do original se configurado
            if request.config.preserve_metadata {
                if let Ok(info) = doc.trailer.get(b"Info") {
                    split_doc.trailer.set(b"Info", info.clone());
                }
            }

            // Para cada página no intervalo
            for page_num in range.expand() {
                let &page_id = pages.get(&page_num)
                    .ok_or_else(|| AppError::Pdf(PdfError::PageNotFound {
                        path: request.file_path.clone(),
                        page: page_num,
                    }))?;

                // Obtém o objeto da página
                let page_obj = doc.get_object(page_id)
                    .map_err(|e| {
                        error!(
                            page_num,
                            error = %e,
                            "Failed to get page object"
                        );
                        AppError::Pdf(PdfError::PageNotFound {
                            path: request.file_path.clone(),
                            page: page_num,
                        })
                    })?
                    .clone();

                // Cria um novo ID único para este objeto
                let new_page_id = (max_object_id, 0);
                max_object_id += 1;

                // Mapeia IDs
                object_id_map.insert(page_id, new_page_id);
                global_object_id_map.insert(page_id, new_page_id);

                // Adiciona ao documento splitado
                split_doc.objects.insert(new_page_id, page_obj);

                info!(range_index, page_num, "Page added to split document");
            }

            // Atualiza referências de objetos no documento splitado
            self.update_object_references(&mut split_doc, &object_id_map);

            // Gera caminho de saída e salva
            let output_path = request.generate_output_path(range_index);
            self.save_split_document(&mut split_doc, &output_path)?;

            // Obtém estatísticas deste split
            let file_size = self.file_handler.validate_file(output_path.to_str().unwrap_or(""))?.len();

            results.push(RangeStat {
                range: *range,
                output_file: output_path,
                file_size,
                page_count: range.page_count(),
            });

            info!(
                range_index,
                output_file = %results.last().unwrap().output_file.display(),
                file_size = results.last().unwrap().file_size,
                "Split completed for range"
            );
        }

        Ok(results)
    }

    /// Atualiza referências de objetos no documento splitado
    fn update_object_references(&self, doc: &mut Document, id_mapping: &HashMap<ObjectId, ObjectId>) {
        let objects_to_update: Vec<_> = doc.objects
            .iter()
            .filter(|(_, obj)| matches!(obj, Object::Reference(_)))
            .map(|(id, _)| *id)
            .collect();

        for obj_id in objects_to_update {
            if let Ok(Object::Reference(ref_id)) = doc.get_object(obj_id) {
                if let Some(&mapped_id) = id_mapping.get(ref_id) {
                    doc.objects.insert(obj_id, Object::Reference(mapped_id));
                }
            }
        }
    }

    /// Salva um documento splitado
    #[instrument(name = "save_split_document", skip(self, doc, output_path))]
    fn save_split_document(&self, doc: &mut Document, output_path: &Path) -> Result<()> {
        info!(path = %output_path.display(), "Saving split PDF");
        
        doc.save(output_path)
            .map_err(|e| {
                error!(path = %output_path.display(), error = %e, "Failed to save split PDF");
                AppError::Pdf(PdfError::ProcessingFailed {
                    reason: format!("Failed to save split PDF: {}", e),
                })
            })?;
            
        info!(path = %output_path.display(), "Split PDF saved successfully");
        Ok(())
    }

    /// Split de PDF (versão simplificada para compatibilidade)
    #[deprecated(note = "Use split_pdf_async with SplitRequest instead")]
    pub fn split_pdf_sync(data: Value) -> Result<Value> {
        let request = SplitRequest::from_value(&data)?;
        let splitter = PdfSplitter::new();
        
        // Executa síncrono (para compatibilidade)
        let rt = tokio::runtime::Runtime::new()
            .map_err(|e| AppError::processing(format!("Failed to create runtime: {}", e)))?;
            
        let result = rt.block_on(splitter.split_pdf(request))?;
        
        Ok(serde_json::to_value(result)
            .map_err(|e| AppError::serialization(format!("Failed to serialize result: {}", e)))?)
    }
}

// ==================== FUNÇÕES DE CONVENIÊNCIA ====================

/// Função de conveniência para split de PDFs (mantém compatibilidade)
#[instrument(name = "split_pdf", skip(data))]
pub async fn split_pdf(data: Value) -> Result<Value> {
    let request = SplitRequest::from_value(&data)?;
    let splitter = PdfSplitter::new();
    let result = splitter.split_pdf(request).await?;
    
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
    fn test_page_range_creation() -> Result<()> {
        let range = PageRange::new(1, 5)?;
        assert_eq!(range.start, 1);
        assert_eq!(range.end, 5);
        assert_eq!(range.page_count(), 5);
        assert!(range.contains(3));
        assert!(!range.contains(6));
        
        let single = PageRange::single(3)?;
        assert_eq!(single.start, 3);
        assert_eq!(single.end, 3);
        assert_eq!(single.page_count(), 1);
        
        Ok(())
    }

    #[test]
    fn test_page_range_invalid() {
        // Start < 1
        assert!(PageRange::new(0, 5).is_err());
        
        // End < start
        assert!(PageRange::new(5, 3).is_err());
    }

    #[test]
    fn test_page_range_from_str() -> Result<()> {
        let range1 = PageRange::from_str("1-5")?;
        assert_eq!(range1.start, 1);
        assert_eq!(range1.end, 5);
        
        let range2 = PageRange::from_str("3")?;
        assert_eq!(range2.start, 3);
        assert_eq!(range2.end, 3);
        
        assert!(PageRange::from_str("1-2-3").is_err()); // Formato inválido
        assert!(PageRange::from_str("a-b").is_err());   // Não numérico
        
        Ok(())
    }

    #[test]
    fn test_page_range_parser() -> Result<()> {
        // String format
        let ranges = PageRangeParser::parse_ranges("1-3,5,7-10")?;
        assert_eq!(ranges.len(), 3);
        assert_eq!(ranges[0], PageRange::new(1, 3)?);
        assert_eq!(ranges[1], PageRange::single(5)?);
        assert_eq!(ranges[2], PageRange::new(7, 10)?);
        
        // JSON array format
        let json = json!([[1, 3], [5, 5], [7, 10]]);
        let ranges = PageRangeParser::parse_from_json(&json)?;
        assert_eq!(ranges.len(), 3);
        
        // Overlapping ranges should fail
        assert!(PageRangeParser::parse_ranges("1-3,2-5").is_err());
        
        Ok(())
    }

    #[tokio::test]
    async fn test_split_request_from_value() -> Result<()> {
        // String ranges format
        let data = json!({
            "file": "input.pdf",
            "ranges": "1-3,5,7-10",
            "output_dir": "./output"
        });
        
        let request = SplitRequest::from_value(&data)?;
        assert_eq!(request.file_path, PathBuf::from("input.pdf"));
        assert_eq!(request.page_ranges.len(), 3);
        assert_eq!(request.output_dir, PathBuf::from("./output"));
        
        // Array ranges format
        let data = json!({
            "file": "input.pdf",
            "ranges": [[1, 3], [5, 5], [7, 10]],
            "output_dir": "./output"
        });
        
        let request = SplitRequest::from_value(&data)?;
        assert_eq!(request.page_ranges.len(), 3);
        
        Ok(())
    }

    #[test]
    fn test_split_request_generate_output_path() -> Result<()> {
        let request = SplitRequest {
            file_path: PathBuf::from("input.pdf"),
            page_ranges: vec![PageRange::new(1, 3)?, PageRange::single(5)?],
            output_dir: PathBuf::from("./output"),
            config: SplitConfig::default(),
        };
        
        let path1 = request.generate_output_path(0);
        assert!(path1.to_string_lossy().contains("split_1"));
        
        let path2 = request.generate_output_path(1);
        assert!(path2.to_string_lossy().contains("split_2"));
        
        Ok(())
    }

    #[test]
    fn test_split_config_default() {
        let config = SplitConfig::default();
        assert!(config.preserve_metadata);
        assert_eq!(config.naming_pattern, "split_{index}");
        assert!(config.create_output_dir);
        assert!(config.preserve_page_order);
    }

    #[test]
    fn test_pdf_splitter_creation() {
        let splitter = PdfSplitter::new();
        assert!(splitter.file_handler.config.max_file_size > 0);
        
        let file_handler = FileHandler::new();
        let splitter = PdfSplitter::with_file_handler(file_handler);
        assert!(splitter.file_handler.config.max_file_size > 0);
    }

    // Nota: Testes de split real requerem PDFs de teste
    // Estes seriam adicionados com arquivos de teste reais
}