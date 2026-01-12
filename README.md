# Gus Docs (MVP)

> **Hub de Produtividade PDF Offline & Seguro**

O **Gus Docs** é uma aplicação desktop focada na manipulação, organização e padronização de arquivos PDF. Projetado para ambientes que exigem alta privacidade e eficiência (como escritórios de advocacia e setores administrativos), o software opera **100% offline**, garantindo que nenhum dado sensível deixe a máquina do usuário.

A arquitetura combina a flexibilidade de interface do **Electron** com a performance e segurança de memória do **Rust**.

---

## 🚀 Visão Geral do MVP

Este MVP (Minimum Viable Product) visa validar a experiência do usuário na gestão de documentos e entregar uma base sólida e livre de erros para operações de **Merge** e **Split**, com foco obsessivo em UX (User Experience) e feedback visual imediato.

### Diferenciais
* **Privacidade Absoluta:** Sem telemetria, sem banco de dados remoto, sem upload de arquivos.
* **Performance:** O processamento pesado de PDFs é realizado por um backend em Rust.
* **Previsibilidade:** O usuário sempre sabe o nome final e o tamanho estimado do arquivo antes de executar a ação.

---

## 🛠 Stack Tecnológica

A arquitetura segue o padrão de **Frontend "Burro" / Backend "Inteligente"**. A interface apenas coleta intenções e exibe estados; toda a lógica de negócio reside no Rust.

* **Frontend (UI):** HTML5, CSS3, JavaScript (ES6+ Vanilla).
* **Container Desktop:** Electron (Gerenciamento de janelas e ciclo de vida).
* **Backend (Core):** Rust (Manipulação de I/O, processamento de streams de PDF, cálculos).
* **Plataforma:** Windows (Build atual), com código agnóstico preparado para Linux/macOS.

---

## ✨ Funcionalidades (Escopo do MVP)

### 1. Manipulação de Arquivos
* **Merge:** Combinação de múltiplos PDFs em um único arquivo ordenado.
* **Split:** Divisão de arquivos baseada em intervalos de páginas (ex: `1, 3, 5-10`).
* **Processamento Local:** Toda operação de leitura e escrita é feita localmente pelo binário Rust.

### 2. Organização e Nomenclatura
Sistema robusto para padronização de arquivos de saída:
* **Padrões de Nome:** Configuração de `Prefixo` + `Nome Base` + `Sufixo`.
* **Diretório de Saída:** Seleção de pasta de destino personalizada.
* **Presets:** Capacidade de salvar configurações de nomenclatura para reuso.

### 3. Interface e UX
* **Drag & Drop:** Arraste arquivos diretamente do sistema operacional.
* **Reordenação Visual:** Organização da ordem de merge via "clicar e arrastar" nos cards.
* **Temas:** Suporte nativo a *Dark Mode* e *Light Mode*.
* **SPA-like:** Navegação fluida entre abas (Merge/Split) sem recarregamento da janela.

### 4. PDF Cards & Previews Inteligentes
Cada arquivo carregado é tratado como um objeto rico visualmente:
* **Thumbnail:** Renderização da primeira página do PDF.
* **Metadados:** Exibição de contagem de páginas e tamanho do arquivo (MB/KB).
* **Live Preview:**
    * Visualização em tempo real do **nome final do arquivo** conforme o usuário digita.
    * Estimativa do **tamanho final** do arquivo consolidado.

---

## 📂 Estrutura do Projeto

A estrutura de pastas foi desenhada para modularidade. No frontend, cada funcionalidade principal (Merge, Split) possui seus próprios scripts de controle, facilitando a manutenção e a adição de futuras ferramentas (como OCR ou Conversão) sem "quebrar" o código existente.

```text
gus-docs/
│
├── backend/                  # Core em Rust
│   ├── src/
│   │   ├── main.rs           # Entry point e comunicação IPC
│   │   ├── pdf_ops/          # Módulos de manipulação
│   │   │   ├── merge.rs
│   │   │   ├── split.rs
│   │   │   └── metadata.rs   # Leitura de tamanho/páginas
│   │   └── utils/
│   └── Cargo.toml
│
├── electron/                 # Container
│   ├── main.js               # Processo principal do Electron
│   ├── preload.js            # Ponte de segurança (ContextBridge)
│   └── package.json
│
├── frontend/                 # Interface do Usuário
│   ├── index.html            # Layout Base
│   ├── assets/               # Ícones, fontes
│   ├── styles/
│   │   ├── main.css          # Estilos globais e variáveis (temas)
│   │   ├── components.css    # Estilos de cards e botões
│   │   └── layouts.css
│   │
│   └── scripts/
│       ├── app.js            # Gerenciador de estado global e Router
│       ├── api.js            # Camada de comunicação com o Electron/Rust
│       │
│       └── modules/          # Lógica isolada por funcionalidade
│           ├── ui_render.js  # Manipulação geral do DOM
│           ├── view_merge.js # Lógica específica da tela de Merge
│           ├── view_split.js # Lógica específica da tela de Split
│           └── pdf_card.js   # Fábrica de componentes visuais (Cards)
│
└── README.md

⛔ Funcionalidades Fora do Escopo (MVP)
Para garantir a entrega e estabilidade da versão 1.0, os seguintes itens não estão incluídos neste MVP:

OCR (Reconhecimento Óptico de Caracteres).

Scanner integrado ou integração direta com hardware de scanner.

Banco de dados local (SQLite, etc) - O sistema baseia-se em File System.

Assinatura Digital de documentos.

Integração ou sincronização com Nuvem (Google Drive, OneDrive).

Edição de conteúdo do PDF (texto/imagens).

🔧 Configuração e Instalação (Desenvolvimento)
Pré-requisitos
Node.js (v18+)

Rust & Cargo (Stable)

1. Build do Backend (Rust)
Compile o binário que será utilizado pelo Electron.

Bash

cd backend
cargo build --release
# O binário gerado deve ser movido ou referenciado pelo Electron
2. Setup do Frontend/Electron
Instale as dependências e inicie a aplicação.

Bash

# Na raiz do projeto
npm install

# Iniciar em modo de desenvolvimento
npm run dev
🧠 Diretrizes de Desenvolvimento
Imutabilidade do Frontend: O JavaScript do frontend não deve processar buffers de arquivos. Ele apenas envia caminhos (paths) e instruções para o backend.

Tratamento de Erros: O Rust deve capturar falhas de I/O (ex: arquivo corrompido, permissão negada) e retornar erros estruturados para que o Frontend exiba toasts ou modais amigáveis.

Modularidade CSS/JS: Ao criar uma nova funcionalidade (ex: "Conversor JPG"), crie um novo arquivo em frontend/scripts/modules/view_converter.js e isole seus estilos. Não acumule código no app.js.

📄 Licença
Este projeto é proprietário e desenvolvido para fins específicos de produtividade corporativa.