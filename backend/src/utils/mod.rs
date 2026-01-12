// src/utils/mod.rs

use std::error::Error;
use std::path::{Path, PathBuf};
use lopdf::Document;

/// Valida se um caminho é um arquivo PDF válido
pub fn is_valid_pdf(path: &Path) -> Result<bool, Box<dyn Error>> {
    if !path.exists() {
        return Ok(false);
    }
    
    // Verifica extensão
    if let Some(ext) = path.extension() {
        if ext.to_string_lossy().to_lowercase() != "pdf" {
            return Ok(false);
        }
    } else {
        return Ok(false);
    }
    
    // Tenta carregar o PDF para verificar se não está corrompido
    match Document::load(path) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Limpa um nome de arquivo removendo caracteres inválidos
pub fn sanitize_filename(filename: &str) -> String {
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    
    filename
        .chars()
        .filter(|c| !invalid_chars.contains(c))
        .collect()
}

/// Gera um nome de arquivo único para evitar sobrescrita
pub fn generate_unique_filename(base_path: &Path) -> PathBuf {
    let mut counter = 1;
    let original_stem = base_path.file_stem().unwrap_or_default();
    let extension = base_path.extension().unwrap_or_default();
    
    let mut new_path = base_path.to_path_buf();
    
    while new_path.exists() {
        let new_filename = format!(
            "{}_{}.{}",
            original_stem.to_string_lossy(),
            counter,
            extension.to_string_lossy()
        );
        
        new_path = base_path.with_file_name(new_filename);
        counter += 1;
    }
    
    new_path
}

/// Valida se o diretório tem permissão de escrita
pub fn is_writable_directory(path: &Path) -> Result<bool, Box<dyn Error>> {
    if !path.exists() {
        // Tenta criar o diretório
        return match std::fs::create_dir_all(path) {
            Ok(_) => Ok(true),
            Err(e) => Err(format!("Não foi possível criar o diretório: {}", e).into()),
        };
    }
    
    if !path.is_dir() {
        return Ok(false);
    }
    
    // Tenta criar um arquivo temporário para testar escrita
    let test_file = path.join(".write_test_tmp");
    
    match std::fs::File::create(&test_file) {
        Ok(_) => {
            std::fs::remove_file(test_file).ok();
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

/// Converte bytes para uma representação hexadecimal (para debug)
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<Vec<String>>()
        .join("")
}