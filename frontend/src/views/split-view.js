import { setupDropZone, showToast, setElementState, updateFilenamePreview } from '../services/ui-render.js';
import { PdfCard } from '../components/pdf/pdf-card.js';

export class SplitView {
  constructor() {
    this.currentPdf = null;
    this.isInitialized = false;
    this.dropZoneHandler = null;
  }

  render() {
    const view = document.getElementById('router-view');
    view.innerHTML = `
      <header class="view-header">
        <h2>Dividir PDF</h2>
        <p class="view-description">
          Extraia páginas específicas ou intervalos de um documento PDF.
        </p>
        <div class="view-hint">
          <span class="hint-icon">💡</span>
          <span>Use vírgulas para páginas únicas e hífen para intervalos (ex: 1, 3, 5-10)</span>
        </div>
      </header>

      <!-- DROP ZONE SPLIT -->
      <div class="drop-section">
        <div class="drop-zone" id="split-drop-zone">
          <input type="file" id="split-file-input" accept=".pdf" hidden>

          <div class="drop-zone-header">
            <div class="drop-zone-icon">✂️</div>
            <div class="drop-zone-title">Selecione um PDF para dividir</div>
            <div class="drop-zone-subtitle">Arraste e solte ou clique para escolher</div>
          </div>

          <div class="pdf-cards-container" id="split-pdf-container">
            <!-- Card do PDF será inserido aqui -->
          </div>
        </div>
      </div>

      <!-- CONFIGURAÇÃO SPLIT -->
      <section class="config-panel" id="split-config-panel" style="display: none;">
        <div class="config-header">
          <h3>Configuração de divisão</h3>
        </div>

        <div class="config-body">
          <div class="config-row">
            <label for="split-pages-input">Páginas a extrair</label>
            <input type="text" id="split-pages-input" class="input" placeholder="Ex: 1, 3, 5-10, 15-20" value="">
            <div class="help-text">Use vírgulas para páginas únicas e hífen para intervalos</div>
          </div>

          <div class="config-row main-name-row">
            <label for="split-output-name">Nome base para arquivos</label>
            <input type="text" id="split-output-name" class="input" placeholder="pagina" value="pagina">
            <div class="help-text">Os arquivos serão nomeados como: nome_base_1.pdf, nome_base_2.pdf, etc.</div>
          </div>

          <div class="config-row">
            <div class="preview-info">
              <strong>Preview dos arquivos:</strong><br>
              <div id="split-preview-container">
                <!-- Preview dos nomes será inserido aqui -->
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CONTROLES -->
      <div class="view-controls">
        <button id="split-clear-btn" class="btn btn-secondary" disabled>
          <span>Limpar</span>
        </button>
        <button id="split-execute-btn" class="btn btn-primary" disabled>
          <span>Dividir PDF</span>
        </button>
      </div>
    `;

    this.initSplitView();
  }

  initSplitView() {
    if (this.isInitialized) return;

    // Configura drop zone
    this.setupDropZone();

    // Configura eventos
    this.bindEvents();

    this.isInitialized = true;
    console.log('✂️ Split View inicializada');
  }

  setupDropZone() {
    this.dropZoneHandler = setupDropZone('split-drop-zone', {
      accept: ['.pdf'],
      maxFiles: 1, // Apenas um arquivo por vez
      maxSize: 100 * 1024 * 1024, // 100MB
      onFileSelect: (files) => this.handleFileSelection(files[0]),
      onError: (error) => {
        showToast(error.message, 'error', 4000);
      }
    });
  }

  bindEvents() {
    // Botão de limpar
    const clearBtn = document.getElementById('split-clear-btn');
    clearBtn?.addEventListener('click', () => this.clearPdf());

    // Botão de executar
    const executeBtn = document.getElementById('split-execute-btn');
    executeBtn?.addEventListener('click', () => this.executeSplit());

    // Input de páginas
    const pagesInput = document.getElementById('split-pages-input');
    pagesInput?.addEventListener('input', (e) => {
      this.validatePagesInput(e.target);
      this.updatePreview();
    });

    // Input de nome
    const nameInput = document.getElementById('split-output-name');
    nameInput?.addEventListener('input', () => this.updatePreview());

    // Escuta resposta do Rust
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('from-rust', (event, response) => {
      this.handleRustResponse(response);
    });
  }

  handleFileSelection(file) {
    // Limpa PDF anterior
    this.clearPdf();

    // Cria dados do PDF
    this.currentPdf = {
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      pages: 0, // Será extraído
      thumbnail: null,
      file: file
    };

    // Cria card
    const container = document.getElementById('split-pdf-container');
    const card = new PdfCard(this.currentPdf, 'split');
    container.appendChild(card.element);

    // Tenta extrair metadados
    this.extractPdfMetadata();

    // Mostra painel de configuração
    const configPanel = document.getElementById('split-config-panel');
    if (configPanel) {
      configPanel.style.display = 'block';
    }

    this.updateControls();
    showToast('PDF carregado para divisão', 'success', 2000);
  }

  extractPdfMetadata() {
    // Simulação - em produção, isso seria feito via Rust
    setTimeout(() => {
      this.currentPdf.pages = Math.floor(Math.random() * 100) + 10; // 10-110 páginas
      this.updateControls();
      this.updatePreview();
    }, 500);
  }

  validatePagesInput(inputElement) {
    const value = inputElement.value.trim();
    const isValid = this.isValidPageRange(value, this.currentPdf?.pages || 0);

    // Feedback visual
    if (value === '') {
      inputElement.classList.remove('input-success', 'input-error');
    } else if (isValid) {
      inputElement.classList.remove('input-error');
      inputElement.classList.add('input-success');
    } else {
      inputElement.classList.remove('input-success');
      inputElement.classList.add('input-error');
    }

    this.updateControls();
  }

  isValidPageRange(value, maxPages) {
    if (!value) return false;

    const ranges = value.split(',').map(r => r.trim());
    const pageRegex = /^(\d+)(?:-(\d+))?$/;

    for (const range of ranges) {
      const match = range.match(pageRegex);
      if (!match) return false;

      const start = parseInt(match[1]);
      const end = match[2] ? parseInt(match[2]) : start;

      if (start < 1 || end < start || (maxPages > 0 && end > maxPages)) {
        return false;
      }
    }

    return true;
  }

  updatePreview() {
    const pagesInput = document.getElementById('split-pages-input');
    const nameInput = document.getElementById('split-output-name');

    if (!pagesInput || !nameInput) return;

    const pagesValue = pagesInput.value.trim();
    const baseName = nameInput.value.trim() || 'pagina';

    const previewContainer = document.getElementById('split-preview-container');
    if (!previewContainer) return;

    if (!pagesValue || !this.isValidPageRange(pagesValue, this.currentPdf?.pages || 0)) {
      previewContainer.innerHTML = '<em>Digite um intervalo válido de páginas</em>';
      return;
    }

    // Gera preview dos nomes de arquivo
    const ranges = this.parsePageRanges(pagesValue);
    const fileNames = [];

    ranges.forEach((range, index) => {
      if (range.start === range.end) {
        fileNames.push(`${baseName}_${range.start}.pdf`);
      } else {
        for (let page = range.start; page <= range.end; page++) {
          fileNames.push(`${baseName}_${page}.pdf`);
        }
      }
    });

    // Mostra preview (limita a 10 primeiros)
    const displayNames = fileNames.slice(0, 10);
    let html = displayNames.map(name => `<code>${name}</code>`).join('<br>');

    if (fileNames.length > 10) {
      html += `<br><em>... e mais ${fileNames.length - 10} arquivo(s)</em>`;
    }

    previewContainer.innerHTML = html;
  }

  parsePageRanges(value) {
    const ranges = value.split(',').map(r => r.trim());
    const result = [];

    for (const range of ranges) {
      const [start, end] = range.split('-').map(Number);
      result.push({
        start: start,
        end: end || start
      });
    }

    return result;
  }

  updateControls() {
    const hasPdf = !!this.currentPdf;
    const pagesInput = document.getElementById('split-pages-input');
    const hasValidPages = pagesInput && this.isValidPageRange(pagesInput.value.trim(), this.currentPdf?.pages || 0);

    // Botão de limpar
    const clearBtn = document.getElementById('split-clear-btn');
    if (clearBtn) {
      clearBtn.disabled = !hasPdf;
    }

    // Botão de executar
    const executeBtn = document.getElementById('split-execute-btn');
    if (executeBtn) {
      executeBtn.disabled = !(hasPdf && hasValidPages);

      if (!hasPdf) {
        executeBtn.title = 'Selecione um PDF primeiro';
      } else if (!hasValidPages) {
        executeBtn.title = 'Digite um intervalo válido de páginas';
      } else {
        executeBtn.title = 'Dividir PDF';
      }
    }
  }

  clearPdf() {
    this.currentPdf = null;

    const container = document.getElementById('split-pdf-container');
    if (container) {
      container.innerHTML = '';
    }

    // Esconde painel de configuração
    const configPanel = document.getElementById('split-config-panel');
    if (configPanel) {
      configPanel.style.display = 'none';
    }

    // Limpa inputs
    const pagesInput = document.getElementById('split-pages-input');
    const nameInput = document.getElementById('split-output-name');
    if (pagesInput) pagesInput.value = '';
    if (nameInput) nameInput.value = 'pagina';

    this.updateControls();
    this.updatePreview();

    showToast('PDF removido', 'info', 2000);
  }

  executeSplit() {
    if (!this.currentPdf) {
      showToast('Selecione um PDF primeiro', 'warning', 3000);
      return;
    }

    const pagesInput = document.getElementById('split-pages-input');
    const pagesValue = pagesInput?.value.trim();

    if (!pagesValue || !this.isValidPageRange(pagesValue, this.currentPdf.pages)) {
      showToast('Digite um intervalo válido de páginas', 'warning', 3000);
      return;
    }

    const nameInput = document.getElementById('split-output-name');
    const baseName = nameInput?.value.trim() || 'pagina';

    // Prepara dados
    const ranges = this.parsePageRanges(pagesValue);
    const outputDir = './output'; // Em produção, permitir escolher diretório

    // Mostra loading
    const executeBtn = document.getElementById('split-execute-btn');
    setElementState(executeBtn, 'loading');

    // Envia para Rust
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('to-rust', {
      action: 'split',
      data: {
        file: this.currentPdf.file.path,
        ranges: ranges,
        output_dir: outputDir,
        base_name: baseName
      }
    });

    showToast('Dividindo PDF...', 'info', 2000);
  }

  handleRustResponse(response) {
    // Remove loading
    const executeBtn = document.getElementById('split-execute-btn');
    setElementState(executeBtn, 'normal');

    if (response.success) {
      const count = response.files?.length || 0;
      showToast(`${count} arquivo(s) criado(s) com sucesso!`, 'success', 5000);
      this.clearPdf();
    } else {
      showToast(`Erro ao dividir PDF: ${response.error}`, 'error', 5000);
    }
  }

  destroy() {
    if (this.dropZoneHandler) {
      this.dropZoneHandler.destroy();
    }

    // Remove listeners do ipcRenderer
    const { ipcRenderer } = require('electron');
    ipcRenderer.removeAllListeners('from-rust');

    this.isInitialized = false;
    console.log('✂️ Split View destruída');
  }
}
