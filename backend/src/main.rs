// src/main.rs

use std::error::Error;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::thread;
use serde::{Deserialize, Serialize};

mod pdf_ops;
mod utils;

// Tipos de operações suportadas
#[derive(Debug, Serialize, Deserialize)]
pub enum Operation {
    Merge {
        input_paths: Vec<PathBuf>,
        output_path: PathBuf,
    },
    Split {
        input_path: PathBuf,
        output_dir: PathBuf,
        ranges: Vec<String>, // Ex: ["1-5", "7", "9-12"]
    },
    GetMetadata {
        input_paths: Vec<PathBuf>,
    },
}

// Resultados das operações
#[derive(Debug, Serialize, Deserialize)]
pub enum OperationResult {
    Success {
        message: String,
        output_path: Option<PathBuf>,
        metadata: Option<Vec<PdfMetadata>>,
    },
    Error {
        message: String,
        details: Option<String>,
    },
}

// Metadados do PDF
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PdfMetadata {
    pub path: PathBuf,
    pub pages: usize,
    pub size_bytes: u64,
    pub size_human: String,
}

// Gerenciador do backend
pub struct Backend {
    operation_tx: Sender<Operation>,
    result_rx: Receiver<OperationResult>,
}

impl Backend {
    pub fn new() -> Self {
        let (operation_tx, operation_rx) = channel();
        let (result_tx, result_rx) = channel();

        // Thread worker para processamento pesado
        thread::spawn(move || {
            while let Ok(operation) = operation_rx.recv() {
                let result = Self::process_operation(operation);
                if result_tx.send(result).is_err() {
                    break;
                }
            }
        });

        Self {
            operation_tx,
            result_rx,
        }
    }

    fn process_operation(operation: Operation) -> OperationResult {
        match operation {
            Operation::Merge {
                input_paths,
                output_path,
            } => {
                match pdf_ops::merge::merge_pdfs(&input_paths, &output_path) {
                    Ok(_) => OperationResult::Success {
                        message: format!("Arquivos mesclados com sucesso em: {}", output_path.display()),
                        output_path: Some(output_path),
                        metadata: None,
                    },
                    Err(e) => OperationResult::Error {
                        message: "Falha ao mesclar PDFs".to_string(),
                        details: Some(e.to_string()),
                    },
                }
            }
            Operation::Split {
                input_path,
                output_dir,
                ranges,
            } => {
                match pdf_ops::split::split_pdf(&input_path, &output_dir, &ranges) {
                    Ok(output_paths) => OperationResult::Success {
                        message: format!("PDF dividido em {} partes", output_paths.len()),
                        output_path: None,
                        metadata: None,
                    },
                    Err(e) => OperationResult::Error {
                        message: "Falha ao dividir PDF".to_string(),
                        details: Some(e.to_string()),
                    },
                }
            }
            Operation::GetMetadata { input_paths } => {
                let mut metadata = Vec::new();
                let mut errors = Vec::new();

                for path in input_paths {
                    match pdf_ops::metadata::get_pdf_metadata(&path) {
                        Ok(meta) => metadata.push(meta),
                        Err(e) => errors.push(format!("{}: {}", path.display(), e)),
                    }
                }

                if !errors.is_empty() {
                    OperationResult::Error {
                        message: "Erro ao ler metadados de alguns arquivos".to_string(),
                        details: Some(errors.join("\n")),
                    }
                } else {
                    OperationResult::Success {
                        message: "Metadados recuperados com sucesso".to_string(),
                        output_path: None,
                        metadata: Some(metadata),
                    }
                }
            }
        }
    }

    pub fn execute(&self, operation: Operation) -> Result<OperationResult, Box<dyn Error>> {
        self.operation_tx.send(operation)?;
        Ok(self.result_rx.recv()?)
    }
}

// Função principal (se executado como binário standalone)
fn main() {
    // Para comunicação IPC via Electron, o backend será chamado via stdio
    // Esta função principal pode ser usada para testes ou execução standalone
    println!("Gus Docs Backend inicializado");
    println!("Aguardando comandos via IPC...");
}