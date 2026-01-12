// src/pdf_ops/metadata.rs

use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use lopdf::Document;
use super::super::PdfMetadata;

/// Obtém metadados de um arquivo PDF
pub fn get_pdf_metadata(input_path: &Path) -> Result<PdfMetadata, Box<dyn Error>> {
    // Verifica se o arquivo existe
    if !input_path.exists() {
        return Err(format!("Arquivo não encontrado: {}", input_path.display()).into());
    }

    // Obtém metadados do sistema de arquivos
    let file_metadata = fs::metadata(input_path)?;
    let size_bytes = file_metadata.len();
    
    // Obtém metadados do PDF
    let doc = Document::load(input_path)?;
    let pages = doc.get_pages().len();
    
    // Formata tamanho para leitura humana
    let size_human = format_file_size(size_bytes);
    
    Ok(PdfMetadata {
        path: input_path.to_path_buf(),
        pages,
        size_bytes,
        size_human,
    })
}

/// Obtém metadados de múltiplos PDFs
pub fn get_multiple_pdf_metadata(input_paths: &[PathBuf]) -> Vec<Result<PdfMetadata, String>> {
    input_paths
        .iter()
        .map(|path| {
            get_pdf_metadata(path).map_err(|e| {
                format!("Erro ao ler {}: {}", path.display(), e)
            })
        })
        .collect()
}

/// Formata bytes para tamanho legível (KB, MB)
fn format_file_size(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    
    if bytes == 0 {
        return "0 B".to_string();
    }
    
    if bytes < KB as u64 {
        format!("{} B", bytes)
    } else if bytes < MB as u64 {
        format!("{:.2} KB", bytes as f64 / KB)
    } else {
        format!("{:.2} MB", bytes as f64 / MB)
    }
}

/// Estima o tamanho total de múltiplos PDFs
pub fn estimate_total_size(input_paths: &[PathBuf]) -> Result<(u64, String), Box<dyn Error>> {
    let mut total_bytes = 0u64;
    let mut errors = Vec::new();
    
    for path in input_paths {
        match fs::metadata(path) {
            Ok(metadata) => {
                total_bytes += metadata.len();
            }
            Err(e) => {
                errors.push(format!("{}: {}", path.display(), e));
            }
        }
    }
    
    if !errors.is_empty() {
        return Err(format!("Erros ao calcular tamanho:\n{}", errors.join("\n")).into());
    }
    
    let human_size = format_file_size(total_bytes);
    
    Ok((total_bytes, human_size))
}