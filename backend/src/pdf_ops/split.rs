// src/pdf_ops/split.rs

use std::error::Error;
use std::path::{Path, PathBuf};
use lopdf::{Document, Object, Dictionary};

/// Divide um PDF em múltiplos arquivos baseado em intervalos de páginas
pub fn split_pdf(
    input_path: &Path,
    output_dir: &Path,
    ranges: &[String],
) -> Result<Vec<PathBuf>, Box<dyn Error>> {
    // Verifica se o arquivo existe
    if !input_path.exists() {
        return Err(format!("Arquivo não encontrado: {}", input_path.display()).into());
    }

    // Cria diretório de saída
    std::fs::create_dir_all(output_dir)?;

    // Carrega o documento
    let doc = Document::load(input_path)?;
    let total_pages = doc.get_pages().len();

    // Valida os ranges
    let page_ranges = parse_ranges(ranges, total_pages)?;

    // Gera arquivos para cada range
    let mut output_paths = Vec::new();
    
    for (i, range) in page_ranges.iter().enumerate() {
        let output_path = output_dir.join(format!(
            "{}_parte_{}.pdf",
            input_path.file_stem().unwrap_or_default().to_string_lossy(),
            i + 1
        ));

        // Cria um novo documento para este range
        let mut new_doc = Document::new();
        
        // Copia as páginas do range
        for &page_num in range {
            // Obtém o ID da página (os IDs das páginas são os valores do HashMap)
            let pages = doc.get_pages();
            if let Some(&page_id) = pages.get(&(page_num as u32)) {
                if let Ok(page_obj) = doc.get_object(page_id) {
                    new_doc.objects.insert(page_id, page_obj.clone());
                }
            }
        }

        // Adiciona referências das páginas ao catalog
        let pages_refs: Vec<Object> = new_doc
            .objects
            .iter()
            .filter(|(_, obj)| obj.type_name().unwrap_or_default() == b"Page")
            .map(|(&id, _)| Object::Reference(id))
            .collect();

        let mut pages_dict = Dictionary::new();
        pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
        pages_dict.set("Kids", Object::Array(pages_refs.clone()));
        pages_dict.set("Count", Object::Integer(pages_refs.len() as i64));

        let pages_id = new_doc.add_object(pages_dict);
        
        let mut catalog_dict = Dictionary::new();
        catalog_dict.set("Type", Object::Name(b"Catalog".to_vec()));
        catalog_dict.set("Pages", Object::Reference(pages_id));

        let catalog_id = new_doc.add_object(catalog_dict);
        
        // Atualiza o trailer com a referência do catalog
        new_doc.trailer.set(b"Root", Object::Reference(catalog_id));

        // Salva o documento
        new_doc.save(&output_path)?;
        output_paths.push(output_path);
    }

    Ok(output_paths)
}

/// Analisa strings de range (ex: "1-5", "7", "9-12") em vetores de números de página
fn parse_ranges(ranges: &[String], total_pages: usize) -> Result<Vec<Vec<usize>>, Box<dyn Error>> {
    let mut result = Vec::new();

    for range_str in ranges {
        let mut pages_in_range = Vec::new();
        
        // Remove espaços e divide por vírgulas
        let parts: Vec<&str> = range_str.split(',').map(|s| s.trim()).collect();
        
        for part in parts {
            if part.is_empty() {
                continue;
            }

            if part.contains('-') {
                // É um range como "1-5"
                let page_parts: Vec<&str> = part.split('-').map(|s| s.trim()).collect();
                
                if page_parts.len() != 2 {
                    return Err(format!("Formato de range inválido: '{}'", part).into());
                }
                
                let start: usize = page_parts[0].parse()?;
                let end: usize = page_parts[1].parse()?;
                
                if start < 1 || end < start {
                    return Err(format!("Range inválido: '{}'. Deve ser 1 <= inicio <= fim", part).into());
                }
                
                if end > total_pages {
                    return Err(format!(
                        "Página {} excede o total de páginas ({})",
                        end, total_pages
                    ).into());
                }
                
                for page in start..=end {
                    pages_in_range.push(page);
                }
            } else {
                // É uma página única
                let page: usize = part.parse()?;
                
                if page < 1 {
                    return Err(format!("Número de página inválido: '{}'. Deve ser >= 1", part).into());
                }
                
                if page > total_pages {
                    return Err(format!(
                        "Página {} excede o total de páginas ({})",
                        page, total_pages
                    ).into());
                }
                
                pages_in_range.push(page);
            }
        }
        
        if !pages_in_range.is_empty() {
            result.push(pages_in_range);
        }
    }

    if result.is_empty() {
        return Err("Nenhum range válido fornecido".into());
    }

    Ok(result)
}

/// Valida se os ranges são válidos sem executar a divisão
pub fn validate_ranges(ranges: &[String], total_pages: usize) -> Result<(), Box<dyn Error>> {
    parse_ranges(ranges, total_pages)?;
    Ok(())
}