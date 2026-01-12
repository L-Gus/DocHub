// src/pdf_ops/merge.rs

use std::error::Error;
use std::path::{Path, PathBuf};
use lopdf::{Document, Object, Dictionary};

/// Mescla múltiplos PDFs em um único arquivo
pub fn merge_pdfs(input_paths: &[PathBuf], output_path: &Path) -> Result<(), Box<dyn Error>> {
    if input_paths.is_empty() {
        return Err("Nenhum arquivo PDF fornecido para mesclagem".into());
    }

    // Verifica se todos os arquivos existem
    for path in input_paths {
        if !path.exists() {
            return Err(format!("Arquivo não encontrado: {}", path.display()).into());
        }
    }

    // Cria diretório de saída se não existir
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Inicializa documento de resultado
    let mut result_doc = Document::new();

    // Processa cada arquivo
    for (i, input_path) in input_paths.iter().enumerate() {
        println!("Processando arquivo {}: {}", i + 1, input_path.display());
        
        match Document::load(input_path) {
            Ok(doc) => {
                // Adiciona todas as páginas ao documento resultante
                let page_ids = doc.get_pages();
                
                for &page_id in page_ids.values() {
                    if let Ok(page_obj) = doc.get_object(page_id) {
                        result_doc.objects.insert(page_id, page_obj.clone());
                    }
                }
            }
            Err(e) => {
                return Err(format!(
                    "Erro ao carregar PDF {}: {}",
                    input_path.display(),
                    e
                ).into());
            }
        }
    }

    // Adiciona referências das páginas ao catalog
    let pages: Vec<Object> = result_doc
        .objects
        .iter()
        .filter(|(_, obj)| obj.type_name().unwrap_or_default() == b"Page")
        .map(|(&id, _)| Object::Reference(id))
        .collect();

    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    pages_dict.set("Kids", Object::Array(pages.clone()));
    pages_dict.set("Count", Object::Integer(pages.len() as i64));

    let pages_id = result_doc.add_object(pages_dict);
    
    let mut catalog_dict = Dictionary::new();
    catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
    catalog_dict.set("Pages", Object::Reference(pages_id));

    let catalog_id = result_doc.add_object(catalog_dict);
    
    // Atualiza o trailer com a referência do catalog
    result_doc.trailer.set(b"Root", Object::Reference(catalog_id));

    // Salva o documento mesclado
    result_doc.save(output_path)?;
    
    Ok(())
}

/// Estima o tamanho do arquivo resultante da mesclagem
pub fn estimate_merged_size(input_paths: &[PathBuf]) -> Result<u64, Box<dyn Error>> {
    let mut total_size = 0u64;
    
    for path in input_paths {
        if let Ok(metadata) = std::fs::metadata(path) {
            total_size += metadata.len();
        }
    }
    
    // Estimativa conservadora (comprimindo duplicações)
    Ok((total_size as f64 * 0.9) as u64)
}