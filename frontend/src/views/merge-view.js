import { setupDropZone, updateAllPreviews, showToast, setElementState } from '../services/ui-render.js';
import { PdfCard } from '../components/pdf-card.js';

export class MergeView {
  constructor() {
    this.files = [];
    this.isInitialized = false;
    this.dropZoneHandler = null;
  }

  render() {
    const view = document.getElementById('router-view');
    view.innerHTML = `
      <header class="view-header">
        <h2>Mesclar PDFs</h2>
        <p class="view-description">
          Combine múltiplos arquivos PDF em um único documento. Arraste e solte os arquivos ou clique para selecionar.
        </p>
        <div class="view-hint">
          <span class="hint-icon">💡</span>
          <span>Arraste para reordenar os arquivos na ordem desejada</span>
        </div>
      </header>

      <!-- DROP ZONE COM CARDS -->
      <div class="drop-section">
        <div class="drop-zone" id="merge-drop-zone">
          <input type="file" id="merge-file-input" accept=".pdf" multiple hidden>

          <div class="drop-zone-header">
            <div class="drop-zone-icon">📄</div>
            <div class="drop-zone-title">Arraste seus PDFs aqui</div>
            <div class="drop-zone-subtitle">ou clique para selecionar arquivos</div>
          </div>

          <div class="pdf-cards-container" id="merge-pdf-container">
            <!-- Cards serão inseridos aqui -->
          </div>
        </div>
      </div>

      <!-- ESTATÍSTICAS -->
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-value" data-counter="files">0</div>
          <div class="stat-label">Arquivos</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" data-counter="pages">0</div>
          <div class="stat-label">Páginas</div>
        </div>
        <div class="stat-item">
          <div class="stat-value" data-counter="size">0 MB</div>
          <div class="stat-label">Tamanho</div>
        </div>
      </div>

      <!-- CONFIGURAÇÃO DE SAÍDA -->
      <section class="config-panel" id="merge-config-panel" style="display: none;">
        <div class="config-header">
          <h3>Configuração de saída</h3>
        </div>

        <div class="config-body">
          <div class="config-row">
            <label for="merge-output-name">Nome do arquivo</label>
            <input type="text" id="merge-output-name" class="input" placeholder="documento_mesclado" value="documento_mesclado">
          </div>

          <div class="config-row">
            <label for="merge-output-prefix">Prefixo (opcional)</label>
            <input type="text" id="merge-output-prefix" class="input" placeholder="Ex: Parte_">
          </div>

          <div class="config-row">
            <label for="merge-output-suffix">Sufixo (opcional)</label>
            <input type="text" id="merge-output-suffix" class="input" placeholder="Ex: _final">
          </div>

          <div class="config-row">
            <div class="preview-info">
              <strong>Arquivo final:</strong> <span data-preview="filename">documento_mesclado.pdf</span><br>
              <strong>Tamanho estimado:</strong> <span data-preview="size">—</span><br>
              <strong>Total de páginas:</strong> <span data-preview="pages">—</span>
            </div>
          </div>
        </div>
      </section>

      <!-- CONTROLES -->
      <div class="view-controls">
        <button id="merge-clear-btn" class="btn btn-secondary" disabled>
          <span>Limpar tudo</span>
        </button>
        <button id="merge-execute-btn" class="btn btn-primary" disabled>
          <span>Mesclar PDFs</span>
        </button>
      </div>
    `;

    this.initMergeView();
  }

  initMergeView() {
    if (this.isInitialized) return;

    // Configura drop zone
    this.setupDropZone();

    // Configura eventos
    this.bindEvents();

    // Estado inicial
    this.updateStats();
    this.updateControls();

    this.isInitialized = true;
    console.log('🔗 Merge View inicializada');
  }

  setupDropZone() {
    this.dropZoneHandler = setupDropZone('merge-drop-zone', {
      accept: ['.pdf'],
      maxFiles: 50,
      maxSize: 100 * 1024 * 1024, // 100MB
      onFileSelect: (files) => this.handleFileSelection(files),
      onError: (error) => {
        showToast(error.message, 'error', 4000);
      }
    });
  }

  bindEvents() {
    // Botão de limpar
    const clearBtn = document.getElementById('merge-clear-btn');
    clearBtn?.addEventListener('click', () => this.clearAll());

    // Botão de executar
    const executeBtn = document.getElementById('merge-execute-btn');
    executeBtn?.addEventListener('click', () => this.executeMerge());

    // Inputs de configuração
    const outputName = document.getElementById('merge-output-name');
    const outputPrefix = document.getElementById('merge-output-prefix');
    const outputSuffix = document.getElementById('merge-output-suffix');

    [outputName, outputPrefix, outputSuffix].forEach(input => {
      input?.addEventListener('input', () => this.updatePreview());
    });

    // Escuta resposta do Rust
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('from-rust', (event, response) => {
      this.handleRustResponse(response);
    });
  }

  handleFileSelection(files) {
    const container = document.getElementById('merge-pdf-container');

    files.forEach(file => {
      // Cria dados do PDF
      const pdfData = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        pages: 0, // Será atualizado depois
        thumbnail: null,
        file: file
      };

      // Adiciona à lista
      this.files.push(pdfData);

      // Cria card
      const card = new PdfCard(pdfData, 'merge');
      container.appendChild(card.element);

      // Tenta extrair metadados
      this.extractPdfMetadata(pdfData);
    });

    this.updateStats();
    this.updateControls();
    this.updatePreview();

    showToast(`${files.length} arquivo(s) adicionado(s)`, 'success', 2000);
  }

  extractPdfMetadata(pdfData) {
    // Simulação - em produção, isso seria feito via Rust
    setTimeout(() => {
      pdfData.pages = Math.floor(Math.random() * 50) + 1;
      this.updateStats();
      this.updatePreview();
    }, 500);
  }

  updateStats() {
    const totalFiles = this.files.length;
    const totalPages = this.files.reduce((sum, pdf) => sum + (pdf.pages || 0), 0);
    const totalSize = this.files.reduce((sum, pdf) => sum + (pdf.size || 0), 0);

    // Atualiza contadores
    const counters = {
      files: totalFiles,
      pages: totalPages,
      size: this.formatFileSize(totalSize)
    };

    // Atualiza elementos
    Object.entries(counters).forEach(([key, value]) => {
      const elements = document.querySelectorAll(`[data-counter="${key}"]`);
      elements.forEach(el => el.textContent = value);
    });
  }

  updateControls() {
    const hasFiles = this.files.length > 0;
    const hasEnoughFiles = this.files.length >= 2;
    const outputName = document.getElementById('merge-output-name');
    const hasName = outputName?.value.trim().length > 0;

    // Mostra/esconde painel de configuração
    const configPanel = document.getElementById('merge-config-panel');
    if (configPanel) {
      configPanel.style.display = hasFiles ? 'block' : 'none';
    }

    // Botão de limpar
    const clearBtn = document.getElementById('merge-clear-btn');
    if (clearBtn) {
      clearBtn.disabled = !hasFiles;
    }

    // Botão de executar
    const executeBtn = document.getElementById('merge-execute-btn');
    if (executeBtn) {
      executeBtn.disabled = !(hasEnoughFiles && hasName);

      if (!hasEnoughFiles) {
        executeBtn.title = 'Adicione pelo menos 2 PDFs';
      } else if (!hasName) {
        executeBtn.title = 'Digite um nome para o arquivo de saída';
      } else {
        executeBtn.title = 'Mesclar PDFs';
      }
    }
  }

  updatePreview() {
    const outputName = document.getElementById('merge-output-name')?.value.trim() || 'documento_mesclado';
    const outputPrefix = document.getElementById('merge-output-prefix')?.value.trim() || '';
    const outputSuffix = document.getElementById('merge-output-suffix')?.value.trim() || '';

    const totalPages = this.files.reduce((sum, pdf) => sum + (pdf.pages || 0), 0);
    const totalSize = this.files.reduce((sum, pdf) => sum + (pdf.size || 0), 0);

    updateAllPreviews({
      filename: outputName,
      prefix: outputPrefix,
      suffix: outputSuffix,
      pages: totalPages,
      size: totalSize
    });
  }

  clearAll() {
    this.files = [];
    const container = document.getElementById('merge-pdf-container');
    if (container) {
      container.innerHTML = '';
    }

    this.updateStats();
    this.updateControls();
    this.updatePreview();

    showToast('Lista de PDFs limpa', 'info', 2000);
  }

  executeMerge() {
    if (this.files.length < 2) {
      showToast('Adicione pelo menos 2 PDFs para mesclar', 'warning', 3000);
      return;
    }

    const outputName = document.getElementById('merge-output-name')?.value.trim();
    if (!outputName) {
      showToast('Digite um nome para o arquivo de saída', 'warning', 3000);
      return;
    }

    // Prepara dados
    const filePaths = this.files.map(pdf => pdf.file.path);
    const output = `${outputName}.pdf`;

    // Mostra loading
    const executeBtn = document.getElementById('merge-execute-btn');
    setElementState(executeBtn, 'loading');

    // Envia para Rust
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('to-rust', {
      action: 'merge',
      data: { files: filePaths, output }
    });

    showToast('Mesclando PDFs...', 'info', 2000);
  }

  handleRustResponse(response) {
    // Remove loading
    const executeBtn = document.getElementById('merge-execute-btn');
    setElementState(executeBtn, 'normal');

    if (response.success) {
      showToast(`PDF mesclado com sucesso! Salvo como: ${response.output}`, 'success', 5000);
      this.clearAll();
    } else {
      showToast(`Erro ao mesclar: ${response.error}`, 'error', 5000);
    }
  }

  formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  destroy() {
    if (this.dropZoneHandler) {
      this.dropZoneHandler.destroy();
    }

    // Remove listeners do ipcRenderer
    const { ipcRenderer } = require('electron');
    ipcRenderer.removeAllListeners('from-rust');

    this.isInitialized = false;
    console.log('🔗 Merge View destruída');
  }
}
