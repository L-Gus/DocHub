// src/error.rs

use thiserror::Error;

#[derive(Error, Debug)]
pub enum PdfError {
    #[error("Arquivo não encontrado: {0}")]
    FileNotFound(String),
    
    #[error("Erro de I/O: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("PDF corrompido ou inválido: {0}")]
    InvalidPdf(String),
    
    #[error("Range de páginas inválido: {0}")]
    InvalidPageRange(String),
    
    #[error("Erro ao analisar número: {0}")]
    ParseError(#[from] std::num::ParseIntError),
    
    #[error("Erro desconhecido: {0}")]
    Unknown(String),
}