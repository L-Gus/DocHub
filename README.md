# 🦜 DocHub
**Hub de Produtividade PDF Offline & Seguro**

> "Frontend Burro / Backend Inteligente"

O **DocHub** é uma aplicação desktop focada na manipulação, organização e padronização de arquivos PDF. Projetado para ambientes que exigem alta privacidade e eficiência (como setores jurídicos e administrativos), o software opera **100% offline**, garantindo que nenhum dado sensível deixe a máquina do usuário [3, 6].

A arquitetura combina a flexibilidade de interface do **Electron** com a performance e segurança de memória do **Rust** [3].

### 🚀 Diferenciais
*   **Privacidade Absoluta:** Sem telemetria, sem banco de dados remoto, sem upload de arquivos [7].
*   **Performance:** Processamento pesado realizado via Rust (backend local) [7].
*   **Previsibilidade:** Live Preview do nome final e estimativa de tamanho antes de processar [7].

---

### 🛠 Stack Tecnológica
*   **Frontend (UI):** Electron + Vanilla JS (ES6 Modules) - Apenas coleta intenções e exibe estados [8].
*   **Backend (Core):** Rust - I/O, processamento de streams e lógica de negócio [8].
*   **Plataforma:** Windows (MVP), preparado para Linux/macOS [8].

---

## ✨ Funcionalidades (MVP)

### 1. Manipulação de Arquivos
*   **Merge:** Combinação de múltiplos PDFs em um único arquivo ordenado [4].
*   **Split:** Divisão de arquivos baseada em intervalos de páginas (ex: 1, 3, 5-10) [4].
*   **Processamento Local:** Toda operação de leitura/escrita é feita pelo binário Rust [4].

### 2. Organização e UX
*   **Nomenclatura Inteligente:** Configuração de Prefixo + Nome Base + Sufixo com Presets salvos [4].
*   **Drag & Drop:** Arraste arquivos direto do SO [9].
*   **Visualização Rica:** Thumbnails das páginas, reordenação visual e Dark/Light Mode nativo [9].


---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
*   **Node.js** (v16 ou superior)
*   **Rust** (Cargo instalado e configurado)

### Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/gus-docs.git
   cd gus-docs
2. Instale as dependências do Frontend:
3. Compile o Backend Rust (opcional, o script de dev geralmente faz isso):
Desenvolvimento
Para iniciar o ambiente de desenvolvimento com Hot Reload (Frontend) e compilação do Rust:
# Executa o script de dev localizado em scripts/dev.js
npm run dev
Build para Produção
Gera os instaladores/executáveis na pasta dist/:
npm run build

---

## 🏗️ Estrutura de Pastas Detalhada

```
gus-docs/
│
├── 📁 core-backend/              # Backend Rust - Processamento pesado
│   ├── 📁 src/
│   │   ├── 📁 api/               # Handlers IPC e endpoints
│   │   │   ├── mod.rs            # Exportação de módulos
│   │   │   ├── pdf_handlers.rs   # Handlers específicos de PDF
│   │   │   └── file_handlers.rs  # Handlers de arquivos e I/O
│   │   │
│   │   ├── 📁 processors/        # Processadores de documentos
│   │   │   ├── mod.rs
│   │   │   ├── pdf_merger.rs     # Lógica de merge de PDFs
│   │   │   ├── pdf_splitter.rs   # Lógica de split de PDFs
│   │   │   └── pdf_validator.rs  # Validação e metadados
│   │   │
│   │   ├── 📁 utils/             # Utilitários compartilhados
│   │   │   ├── mod.rs
│   │   │   ├── error_handling.rs # Sistema de erros customizado
│   │   │   ├── logging.rs        # Sistema de logs estruturado
│   │   │   └── config.rs         # Configurações do backend
│   │   │
│   │   ├── 📁 types/             # Tipos e estruturas de dados
│   │   │   ├── mod.rs
│   │   │   ├── pdf_types.rs      # Structs específicas de PDF
│   │   │   └── api_types.rs      # Tipos para comunicação IPC
│   │   │
│   │   ├── lib.rs                # Módulo principal do backend
│   │   └── main.rs               # Ponto de entrada do Rust
│   │
│   ├── Cargo.toml                # Dependências Rust
│   └── build.rs                  # Scripts de build customizados
│
├── 📁 frontend/                  # Frontend Electron
│   │
│   ├── 📁 src/                   # Código fonte JavaScript
│   │   │
│   │   ├── 📁 core/              # Núcleo da aplicação
│   │   │   ├── app.js            # [CORE] Gerenciador principal
│   │   │   ├── state-manager.js  # Gerenciador de estado reativo
│   │   │   ├── router.js         # Sistema de roteamento SPA
│   │   │   └── event-bus.js      # Barramento de eventos global
│   │   │
│   │   ├── 📁 api/               # Comunicação com backend
│   │   │   ├── ipc-client.js     # Cliente IPC para Electron
│   │   │   ├── pdf-api.js        # Interface de API para PDFs
│   │   │   ├── file-api.js       # Interface para operações de arquivo
│   │   │   └── mock-api.js       # Mock para desenvolvimento web
│   │   │
│   │   ├── 📁 stores/            # Stores e gerenciamento de estado
│   │   │   ├── app-store.js      # Store principal da aplicação
│   │   │   ├── pdf-store.js      # Store específica para PDFs
│   │   │   ├── ui-store.js       # Store para estado da interface
│   │   │   └── settings-store.js # Store para configurações
│   │   │
│   │   ├── 📁 components/        # Componentes reutilizáveis
│   │   │   ├── 📁 ui/            # Componentes de interface básicos
│   │   │   │   ├── button.js     # Componente de botão
│   │   │   │   ├── card.js       # Componente de card
│   │   │   │   ├── modal.js      # Componente de modal
│   │   │   │   └── toast.js      # Componente de notificação
│   │   │   │
│   │   │   ├── 📁 pdf/           # Componentes específicos de PDF
│   │   │   │   ├── pdf-card.js   # Card de PDF individual
│   │   │   │   ├── pdf-list.js   # Lista de PDFs
│   │   │   │   └── pdf-preview.js # Preview de páginas
│   │   │   │
│   │   │   └── 📁 forms/         # Componentes de formulário
│   │   │       ├── drop-zone.js  # Área de drag & drop
│   │   │       ├── file-input.js # Input de arquivos
│   │   │       └── range-input.js # Input de intervalos
│   │   │
│   │   ├── 📁 views/             # Views/Pages da aplicação
│   │   │   ├── merge-view.js     # View de merge de PDFs
│   │   │   ├── split-view.js     # View de split de PDF
│   │   │   ├── settings-view.js  # View de configurações
│   │   │   └── home-view.js      # View inicial/dashboard
│   │   │
│   │   ├── 📁 utils/             # Utilitários e helpers
│   │   │   ├── dom.js            # Manipulação segura de DOM
│   │   │   ├── validation.js     # Funções de validação
│   │   │   ├── file-utils.js     # Utilitários de arquivo
│   │   │   ├── formatters.js     # Formatação de dados
│   │   │   ├── logger.js         # Sistema de logging frontend
│   │   │   └── constants.js      # Constantes globais
│   │   │
│   │   ├── 📁 services/          # Serviços da aplicação
│   │   │   ├── theme-service.js  # Gerenciamento de temas
│   │   │   ├── storage-service.js # Serviço de armazenamento
│   │   │   ├── shortcut-service.js # Serviço de atalhos
│   │   │   └── analytics-service.js # Serviço de analytics
│   │   │
│   │   ├── 📁 styles/            # Estilos CSS modularizados
│   │   │   ├── 📁 base/          # Estilos base
│   │   │   │   ├── reset.css     # Reset CSS
│   │   │   │   ├── variables.css # Variáveis CSS (tokens)
│   │   │   │   └── typography.css # Tipografia
│   │   │   │
│   │   │   ├── 📁 layout/        # Layouts e grids
│   │   │   │   ├── grid.css      # Sistema de grid
│   │   │   │   ├── sidebar.css   # Estilos da sidebar
│   │   │   │   └── responsive.css # Media queries
│   │   │   │
│   │   │   ├── 📁 components/    # Estilos de componentes
│   │   │   │   ├── buttons.css   # Estilos de botões
│   │   │   │   ├── cards.css     # Estilos de cards
│   │   │   │   ├── modals.css    # Estilos de modais
│   │   │   │   └── forms.css     # Estilos de formulários
│   │   │   │
│   │   │   ├── 📁 utilities/     # Classes utilitárias
│   │   │   │   ├── spacing.css   # Utilitários de espaçamento
│   │   │   │   ├── flex.css      # Utilitários de flexbox
│   │   │   │   └── text.css      # Utilitários de texto
│   │   │   │
│   │   │   └── main.css          # Arquivo principal de estilos
│   │   │
│   │   ├── index.html            # Ponto de entrada HTML
│   │   └── main.js               # Ponto de entrada JavaScript
│   │
│   ├── 📁 assets/                # Recursos estáticos
│   │   ├── 📁 icons/             # Ícones SVG
│   │   ├── 📁 fonts/             # Fontes customizadas
│   │   └── 📁 images/            # Imagens e ilustrações
│   │
│   └── package.json              # Dependências Node.js
│
├── 📁 shared/                    # Código compartilhado
│   ├── 📁 types/                 # Tipos TypeScript (opcional)
│   │   ├── pdf.types.ts          # Tipos de PDF
│   │   ├── api.types.ts          # Tipos de API
│   │   └── app.types.ts          # Tipos da aplicação
│   │
│   └── 📁 constants/             # Constantes compartilhadas
│       ├── errors.constants.ts   # Códigos de erro
│       └── config.constants.ts   # Configurações compartilhadas
│
├── 📁 tests/                     # Testes automatizados
│   ├── 📁 unit/                  # Testes unitários
│   ├── 📁 integration/           # Testes de integração
│   ├── 📁 e2e/                   # Testes end-to-end
│   └── setup.js                  # Configuração de testes
│
├── 📁 scripts/                   # Scripts de build e desenvolvimento
│   ├── build.js                  # Script de build
│   ├── dev.js                    # Script de desenvolvimento
│   └── package.js                # Script de empacotamento
│
├── 📁 docs/                      # Documentação adicional
│   ├── api.md                    # Documentação da API
│   ├── architecture.md           # Documentação de arquitetura
│   └── contributing.md           # Guia de contribuição
│
├── electron-builder.yml          # Configuração do Electron Builder
├── Cargo.toml                    # Configuração do Rust (raiz)
├── package.json                  # Configuração do projeto
└── README.md                     # Este arquivo
```

---

## 🔧 Variáveis Globais e Escopo

### **Variáveis Globais (Apenas estas devem existir no escopo global)**

```javascript
// scripts/utils/constants.js
export const GLOBAL_CONSTANTS = Object.freeze({
  // Configurações da aplicação
  APP: {
    NAME: 'Gus Docs',
    VERSION: '1.0.0',
    ENV: process.env.NODE_ENV || 'development',
    IS_DEV: process.env.NODE_ENV === 'development',
    IS_PROD: process.env.NODE_ENV === 'production',
  },
  
  // Limites e restrições
  LIMITS: {
    MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_FILES_COUNT: 50,
    MAX_PAGES_PER_PDF: 1000,
  },
  
  // Tipos de arquivo suportados
  FILE_TYPES: {
    PDF: ['application/pdf', '.pdf'],
    IMAGES: ['image/jpeg', 'image/png', 'image/jpg'],
  },
  
  // Storage keys
  STORAGE_KEYS: {
    THEME: 'gus_docs_theme',
    RECENT_FILES: 'gus_docs_recent_files',
    USER_SETTINGS: 'gus_docs_user_settings',
    UI_STATE: 'gus_docs_ui_state',
  },
  
  // Eventos da aplicação
  EVENTS: {
    STATE_CHANGED: 'state:changed',
    PDF_ADDED: 'pdf:added',
    PDF_REMOVED: 'pdf:removed',
    VIEW_CHANGED: 'view:changed',
    THEME_CHANGED: 'theme:changed',
    ERROR_OCCURRED: 'error:occurred',
  },
  
  // Rotas da aplicação
  ROUTES: {
    HOME: '/',
    MERGE: '/merge',
    SPLIT: '/split',
    SETTINGS: '/settings',
    ABOUT: '/about',
  },
  
  // Mensagens padrão
  MESSAGES: {
    ERRORS: {
      FILE_TOO_LARGE: 'O arquivo é muito grande. Tamanho máximo: 100MB',
      INVALID_TYPE: 'Tipo de arquivo inválido. Apenas PDFs são suportados.',
      DUPLICATE_FILE: 'Este arquivo já foi adicionado.',
      PROCESSING_ERROR: 'Erro ao processar o arquivo.',
    },
    SUCCESS: {
      FILES_ADDED: 'Arquivos adicionados com sucesso.',
      PROCESS_COMPLETED: 'Processamento concluído.',
    },
  },
});
```

### **Singleton Global (Única instância global permitida)**

```javascript
// scripts/core/app.js
class DocHubApp {
  static #instance = null;
  
  static getInstance() {
    if (!DocHubApp.#instance) {
      DocHubApp.#instance = new DocHubApp();
    }
    return DocHubApp.#instance;
  }
  
  constructor() {
    // Inicialização privada
  }
}

// Export para uso controlado
export const app = DocHubApp.getInstance();
```

---

## 📁 Responsabilidades por Diretório

### **1. `core-backend/` - Backend Rust**
**Responsabilidade:** Todo o processamento pesado, I/O de arquivos, operações de PDF.

**Arquivos principais:**
- `src/api/pdf_handlers.rs` - Handlers para operações de PDF via IPC
- `src/processors/pdf_merger.rs` - Algoritmos de merge de PDF
- `src/processors/pdf_splitter.rs` - Algoritmos de split de PDF
- `src/utils/error_handling.rs` - Sistema centralizado de erros

**Integração:**
- Comunica via IPC (Inter-Process Communication) com o frontend
- Recebe comandos serializados, processa e retorna resultados
- Nunca acessa o DOM ou lógica de interface

### **2. `frontend/src/core/` - Núcleo da Aplicação**
**Responsabilidade:** Orquestração geral, gerenciamento de ciclo de vida.

**Arquivos principais:**
- `app.js` - Inicialização e controle principal
- `state-manager.js` - Gerenciamento de estado reativo
- `router.js` - Navegação SPA
- `event-bus.js` - Comunicação entre módulos

### **3. `frontend/src/stores/` - Gerenciamento de Estado**
**Responsabilidade:** Armazenamento e reatividade do estado da aplicação.

**Arquivos principais:**
- `app-store.js` - Store principal com observáveis
- `pdf-store.js` - Estado específico de PDFs
- `ui-store.js` - Estado da interface

### **4. `frontend/src/api/` - Comunicação Backend**
**Responsabilidade:** Ponte entre frontend e backend.

**Arquivos principais:**
- `ipc-client.js` - Cliente para comunicação IPC
- `pdf-api.js` - Interface para operações de PDF
- `mock-api.js` - Fallback para desenvolvimento web

### **5. `frontend/src/components/` - Componentes UI**
**Responsabilidade:** Componentes reutilizáveis e isolados.

**Organização:**
- `ui/` - Componentes básicos (Button, Modal, Card)
- `pdf/` - Componentes específicos de PDF
- `forms/` - Componentes de formulário

### **6. `frontend/src/views/` - Views/Páginas**
**Responsabilidade:** Telas específicas da aplicação.

**Arquivos principais:**
- `merge-view.js` - View de combinação de PDFs
- `split-view.js` - View de divisão de PDF

### **7. `frontend/src/services/` - Serviços**
**Responsabilidade:** Funcionalidades transversais.

**Arquivos principais:**
- `theme-service.js` - Gerenciamento de temas
- `storage-service.js` - Persistência local
- `shortcut-service.js` - Atalhos de teclado

### **8. `frontend/src/utils/` - Utilitários**
**Responsabilidade:** Funções helper e utilitários.

**Arquivos principais:**
- `dom.js` - Manipulação segura de DOM
- `validation.js` - Validações diversas
- `logger.js` - Sistema de logging estruturado

### **9. `frontend/src/styles/` - Estilos CSS**
**Responsabilidade:** Estilização seguindo ITCSS.

**Organização:**
- `base/` - Reset, variáveis, tipografia
- `layout/` - Grids, sidebar, responsividade
- `components/` - Estilos específicos de componentes
- `utilities/` - Classes utilitárias

---

## 🔄 Fluxo de Dados e Integração

### **1. Comunicação Frontend ↔ Backend**

```javascript
// Fluxo completo: Usuário adiciona PDF para merge
User Action → Component → Store → API → IPC → Rust → Processamento → Resposta → UI Update

// Exemplo concreto:
1. Usuário solta arquivo na drop-zone
2. drop-zone.js valida e emite evento
3. pdf-store.js atualiza estado local
4. merge-view.js detecta mudança e chama API
5. pdf-api.js envia via IPC para Rust
6. Rust processa e retorna resultado
7. Estado é atualizado e UI reage
```

### **2. Sistema de Eventos**

```javascript
// Event Bus (scripts/core/event-bus.js)
class EventBus {
  static emit(event, data) {
    // Dispara evento global
  }
  
  static on(event, callback) {
    // Registra listener
  }
  
  static off(event, callback) {
    // Remove listener
  }
}

// Uso em componentes:
EventBus.on(GLOBAL_CONSTANTS.EVENTS.PDF_ADDED, (pdf) => {
  // Atualizar UI
});
```

### **3. Injeção de Dependências**

```javascript
// scripts/core/dependency-injector.js
class DependencyInjector {
  static services = new Map();
  
  static register(name, service) {
    this.services.set(name, service);
  }
  
  static get(name) {
    if (!this.services.has(name)) {
      throw new Error(`Service ${name} not registered`);
    }
    return this.services.get(name);
  }
}

// Registro durante inicialização:
DependencyInjector.register('themeService', themeService);
DependencyInjector.register('storageService', storageService);

// Uso em qualquer módulo:
const themeService = DependencyInjector.get('themeService');
```

---

## 🚀 Inicialização da Aplicação

### **Sequência de Bootstrapping**

```javascript
// main.js - Ponto de entrada principal
(async () => {
  try {
    // 1. Carrega constantes e configurações
    await ConfigLoader.load();
    
    // 2. Inicializa sistema de logging
    Logger.init({
      level: GLOBAL_CONSTANTS.APP.IS_DEV ? 'debug' : 'error',
      persist: true
    });
    
    // 3. Configura injeção de dependências
    await setupDependencies();
    
    // 4. Inicializa serviços essenciais
    await ThemeService.init();
    await StorageService.init();
    
    // 5. Carrega estado persistido
    const savedState = await StorageService.load('app_state');
    
    // 6. Inicializa gerenciador de estado
    const stateManager = new StateManager(savedState || initialState);
    DependencyInjector.register('stateManager', stateManager);
    
    // 7. Configura sistema de roteamento
    const router = new Router();
    router.registerRoutes(routes);
    DependencyInjector.register('router', router);
    
    // 8. Inicializa API client
    const apiClient = GLOBAL_CONSTANTS.APP.IS_DEV 
      ? new MockAPIClient() 
      : new IPCClient();
    DependencyInjector.register('apiClient', apiClient);
    
    // 9. Monta interface principal
    await renderApp();
    
    // 10. Inicia serviços em background
    startBackgroundServices();
    
    Logger.info('Aplicação inicializada com sucesso');
    
  } catch (error) {
    handleFatalError(error);
  }
})();
```

---

## 📦 Módulos ES6 - Import/Export

### **Padrão de Exportação**

```javascript
// scripts/components/ui/button.js

// 1. Classe principal (export padrão)
export default class Button {
  constructor(config) {
    // Implementação
  }
  
  render() {
    return this.#createTemplate();
  }
  
  #createTemplate() {
    // Método privado
  }
}

// 2. Funções utilitárias (export nomeado)
export function createButton(config) {
  return new Button(config);
}

export function isValidButtonConfig(config) {
  // Validação
}

// 3. Constantes relacionadas
export const BUTTON_TYPES = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  DANGER: 'danger'
};

export const BUTTON_SIZES = {
  SMALL: 'sm',
  MEDIUM: 'md',
  LARGE: 'lg'
};
```

### **Padrão de Importação**

```javascript
// scripts/views/merge-view.js

// Importação seletiva
import Button, { 
  BUTTON_TYPES, 
  BUTTON_SIZES,
  createButton 
} from '../components/ui/button.js';

// Importação de utilitários
import { 
  validateFile, 
  formatFileSize 
} from '../utils/file-utils.js';

// Importação de serviços
import { 
  PDFService 
} from '../services/pdf-service.js';

// Importação de stores
import { 
  usePdfStore 
} from '../stores/pdf-store.js';
```

---

## 🛡️ Tratamento de Erros

### **Hierarquia de Erros**

```javascript
// scripts/utils/errors/custom-errors.js
export class AppError extends Error {
  constructor(message, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.timestamp = new Date().toISOString();
  }
}

export class ValidationError extends AppError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR');
    this.field = field;
  }
}

export class APIError extends AppError {
  constructor(message, statusCode) {
    super(message, 'API_ERROR');
    this.statusCode = statusCode;
  }
}

// Uso:
try {
  if (!isValid) {
    throw new ValidationError('Arquivo inválido', 'fileInput');
  }
} catch (error) {
  if (error instanceof ValidationError) {
    // Tratamento específico
  }
  ErrorHandler.handle(error);
}
```

### **Error Boundary Global**

```javascript
// scripts/core/error-boundary.js
class GlobalErrorBoundary {
  static init() {
    // Captura erros não tratados
    window.addEventListener('error', this.#handleError);
    window.addEventListener('unhandledrejection', this.#handlePromiseRejection);
  }
  
  static #handleError(event) {
    const error = event.error || new Error(event.message);
    ErrorTracker.track(error);
    ErrorUI.showFriendlyError(error);
    event.preventDefault();
  }
}
```

---

## 🎨 Sistema de Estilos (ITCSS)

### **Ordem de Importação CSS**

```css
/* main.css */

/* 1. Settings - Variáveis e configurações */
@import './base/variables.css';
@import './base/typography.css';

/* 2. Tools - Mixins e funções */
/* 3. Generic - Reset e normalização */
@import './base/reset.css';

/* 4. Elements - Estilos de elementos HTML */
@import './base/elements.css';

/* 5. Objects - Layouts e containers */
@import './layout/grid.css';
@import './layout/sidebar.css';

/* 6. Components - Componentes específicos */
@import './components/buttons.css';
@import './components/cards.css';
@import './components/modals.css';

/* 7. Utilities - Classes utilitárias */
@import './utilities/spacing.css';
@import './utilities/flex.css';
@import './utilities/text.css';
```

### **Variáveis CSS Organizadas**

```css
/* styles/base/variables.css */
:root {
  /* Cores primárias */
  --color-primary-50: #f0f9ff;
  --color-primary-500: #0ea5e9;
  --color-primary-900: #0c4a6e;
  
  /* Espaçamento base */
  --spacing-unit: 4px;
  --spacing-xs: calc(var(--spacing-unit) * 1);
  --spacing-sm: calc(var(--spacing-unit) * 2);
  --spacing-md: calc(var(--spacing-unit) * 4);
  
  /* Tipografia */
  --font-family-base: 'Inter', -apple-system, sans-serif;
  --font-size-base: 16px;
  --line-height-base: 1.5;
  
  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
  
  /* Transições */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 350ms ease;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

---

## 🧪 Padrões de Teste

### **Estrutura de Testes**

```javascript
// tests/unit/components/button.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import Button from '../../../frontend/src/components/ui/button.js';

describe('Button Component', () => {
  let button;
  
  beforeEach(() => {
    button = new Button({
      text: 'Click me',
      type: 'primary',
      onClick: vi.fn()
    });
  });
  
  it('should render with correct text', () => {
    const element = button.render();
    expect(element.textContent).toBe('Click me');
  });
  
  it('should apply correct CSS class', () => {
    const element = button.render();
    expect(element.classList.contains('btn-primary')).toBe(true);
  });
  
  it('should handle click events', () => {
    const element = button.render();
    element.click();
    expect(button.config.onClick).toHaveBeenCalled();
  });
});

// tests/integration/pdf-merger.test.js
import { describe, it, expect } from 'vitest';
import { mergePDFs } from '../../core-backend/src/processors/pdf_merger.rs';

describe('PDF Merger Integration', () => {
  it('should merge multiple PDFs into one', async () => {
    const pdfs = [pdf1, pdf2, pdf3];
    const result = await mergePDFs(pdfs);
    
    expect(result.success).toBe(true);
    expect(result.data.pageCount).toBe(15); // 5 + 5 + 5
    expect(result.data.size).toBeLessThan(MAX_FILE_SIZE);
  });
});
```

---

## 📝 Convenções de Código

### **JavaScript/ES6**
```javascript
// 1. Nomenclatura
const CONSTANT_VALUE = 'immutable';
let mutableVariable = 'can change';
privateMethod() { /* prefixo # para privados */ }
publicMethod() { /* métodos públicos */ }
_eventHandler() { /* prefixo _ para protegidos */ }

// 2. Arquitetura de Funções
export function doSomething(param1, param2) {
  // Validações no início
  if (!isValid(param1)) {
    throw new ValidationError('Invalid param');
  }
  
  // Lógica principal
  const result = process(param1, param2);
  
  // Cleanup se necessário
  cleanup();
  
  // Retorno consistente
  return { success: true, data: result };
}

// 3. Comentários JSDoc
/**
 * Processa um arquivo PDF para extrair metadados
 * @param {File} file - Objeto File do input
 * @param {Object} options - Opções de processamento
 * @param {boolean} options.extractText - Extrair texto do PDF
 * @returns {Promise<PDFMetadata>} Metadados do PDF
 * @throws {ValidationError} Se o arquivo for inválido
 * @throws {APIError} Se houver erro no processamento
 */
export async function processPDF(file, options = {}) {
  // Implementação
}
```

### **Rust (Backend)**
```rust
// src/processors/pdf_merger.rs
use crate::errors::ProcessorError;
use crate::types::PDFDocument;

/// Merge múltiplos documentos PDF em um único arquivo
///
/// # Arguments
/// * `documents` - Vetor de documentos PDF a serem combinados
/// * `output_path` - Caminho para o arquivo de saída
///
/// # Returns
/// Result contendo o caminho do arquivo gerado ou um erro
///
/// # Errors
/// Retorna `ProcessorError` se:
/// - Nenhum documento for fornecido
/// - Falha ao ler algum documento
/// - Falha ao escrever o arquivo de saída
pub fn merge_pdfs(
    documents: Vec<PDFDocument>,
    output_path: &str,
) -> Result<String, ProcessorError> {
    // Implementação
}
```

---

## 🔗 Dependências e Integração entre Módulos

### **Mapa de Dependências**

```
frontend/src/core/app.js
├── depends on: state-manager, router, event-bus
├── provides: inicialização global
└── used by: main.js (ponto de entrada)

frontend/src/stores/app-store.js
├── depends on: event-bus, logger
├── provides: estado global reativo
└── used by: todas as views e componentes

frontend/src/api/ipc-client.js
├── depends on: constants, logger
├── provides: comunicação com backend
└── used by: todos os serviços que precisam de backend

frontend/src/views/merge-view.js
├── depends on: pdf-store, pdf-api, ui components
├── provides: interface de merge
└── used by: router

core-backend/src/api/pdf_handlers.rs
├── depends on: processors, utils
├── provides: endpoints IPC para PDF
└── used by: main.rs (registro de handlers)
```

### **Regras de Importação**
1. **Nunca** importe de módulos em diretórios superiores (`../../../../`)
2. Use importações relativas apenas dentro do mesmo diretório ou um nível acima
3. Para cross-imports, use o sistema de injeção de dependências
4. Módulos de `utils/` podem ser importados por qualquer lugar
5. Módulos de `core/` só podem ser importados durante inicialização

---

## 🚨 Regras de Segurança

### **Frontend**
```javascript
// 1. Sanitização de inputs
import { sanitizeFileName } from '../utils/sanitizer.js';

const safeFileName = sanitizeFileName(userInput);
// Remove: < > : " / \ | ? *

// 2. Validação de caminhos de arquivo
function isValidFilePath(path) {
  return !path.includes('..') && // Prevenir directory traversal
         !path.startsWith('/') && // Prevenir caminhos absolutos
         path.length < 255; // Limite de tamanho
}

// 3. Content Security Policy
// index.html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline';
               style-src 'self' 'unsafe-inline'">
```

### **Backend Rust**
```rust
// 1. Validação de inputs
fn validate_user_input(input: &str) -> Result<(), ValidationError> {
    if input.contains("..") {
        return Err(ValidationError::new("Directory traversal attempt"));
    }
    if input.len() > 255 {
        return Err(ValidationError::new("Input too long"));
    }
    Ok(())
}

// 2. Limites de recursos
fn process_with_limits(file: &Path) -> Result<(), ProcessorError> {
    let metadata = fs::metadata(file)?;
    if metadata.len() > MAX_FILE_SIZE {
        return Err(ProcessorError::FileTooLarge);
    }
    // Processamento seguro
}
```

---
