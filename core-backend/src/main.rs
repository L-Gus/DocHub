//! Ponto de entrada principal do DocHub Backend
//!
//! Este é o executável principal que inicializa e executa o servidor backend.
//! Responsável por:
//! - Inicialização do sistema de logging
//! - Carregamento da configuração
//! - Inicialização dos processadores
//! - Loop principal de processamento de comandos
//! - Tratamento de sinais de shutdown
//!
//! ## Comunicação:
//! O backend se comunica com o frontend via IPC (stdin/stdout) usando JSON.
//! Cada linha recebida é um comando JSON, e cada resposta é uma linha JSON.
//!
//! ## Exemplo de uso:
//! ```bash
//! echo '{"action": "merge", "data": {...}}' | ./dochub-backend
//! ```

use std::io::{self, BufRead};
use serde::{Deserialize, Serialize};
use tokio::signal;
use tracing::{info, error, warn};

use dochub_backend::process_command;

// ==================== TIPOS DE IPC ====================

/// Comando recebido do frontend
#[derive(Serialize, Deserialize, Debug)]
struct Command {
    /// Ação a ser executada
    action: String,
    /// Dados da ação (parâmetros)
    data: serde_json::Value,
    /// ID opcional para rastreamento
    #[serde(default)]
    id: Option<String>,
}

/// Resposta enviada para o frontend
#[derive(Serialize, Deserialize, Debug)]
struct Response {
    /// Sucesso da operação
    success: bool,
    /// Dados da resposta (se sucesso)
    data: Option<serde_json::Value>,
    /// Erro (se falhou)
    error: Option<String>,
    /// ID da requisição (para correspondência)
    id: Option<String>,
}

impl Response {
    /// Cria resposta de sucesso
    fn success(data: serde_json::Value, id: Option<String>) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            id,
        }
    }

    /// Cria resposta de erro
    fn error(error_msg: String, id: Option<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error_msg),
            id,
        }
    }
}

// ==================== FUNÇÃO PRINCIPAL ====================

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Inicializar logging
    dochub_backend::utils::logging::init_logging()
        .map_err(|e| {
            eprintln!("Failed to initialize logging: {}", e);
            e
        })?;

    info!("DocHub Backend v{} started", env!("CARGO_PKG_VERSION"));

    // Processar comandos diretamente na thread principal
    if let Err(e) = process_commands_loop().await {
        error!("Command processing error: {}", e);
    }

    info!("DocHub Backend stopped");
    Ok(())
}

// ==================== FUNÇÕES AUXILIARES ====================

/// Loop principal de processamento de comandos
async fn process_commands_loop() -> Result<(), Box<dyn std::error::Error>> {
    let stdin = io::stdin();
    let mut lines = stdin.lines();

    info!("Ready to process commands");

    while let Some(line) = lines.next() {
        let line = line?;
        let command: Command = match serde_json::from_str(&line) {
            Ok(cmd) => cmd,
            Err(e) => {
                let response = Response::error(format!("Invalid JSON: {}", e), None);
                println!("{}", serde_json::to_string(&response)?);
                continue;
            }
        };

        // Log do comando recebido
        if let Some(ref id) = command.id {
            info!(action = %command.action, id = %id, "Processing command");
        } else {
            info!(action = %command.action, "Processing command");
        }

        // Processar comando
        let result = process_command(command.action.clone(), command.data).await;

        // Enviar resposta
        let response = match result {
            Ok(data) => Response::success(data, command.id),
            Err(e) => {
                error!(action = %command.action, error = %e, "Command failed");
                Response::error(e.to_string(), command.id)
            }
        };

        println!("{}", serde_json::to_string(&response)?);
    }

    // Se chegamos aqui, stdin foi fechado
    info!("Command input stream closed");
    Ok(())
}

/// Configura handler para sinais de shutdown
fn setup_shutdown_signal() -> impl std::future::Future<Output = ()> {
    async {
        let ctrl_c = async {
            signal::ctrl_c()
                .await
                .expect("Failed to listen for Ctrl+C");
        };

        #[cfg(unix)]
        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("Failed to listen for SIGTERM")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }
    }
}
