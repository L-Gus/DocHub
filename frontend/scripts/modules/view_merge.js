/**
 * View Merge - Gus Docs
 * Responsabilidades:
 * - Inicializar a tela de Merge
 * - Gerenciar UI da lista de PDFs
 * - Reagir às mudanças do estado global
 * - Configurar saída e preview
 * - Ordenação por drag & drop
 *
 * NÃO executa merge real (isso será feito via api.js + Rust)
 */

import { state, updateState, showToast, validatePdfFile } from '../app.js';
import { createMergeCard } from './pdf_card.js';
import { setupDropZone, updateAllPreviews, setElementState } from '../modules/ui_render.js';

const MergeView = {
  initialized: false,
  dropInitialized: false
};

// ===============================
// CACHE DE ELEMENTOS
// ===============================
function cacheMergeDOM() {
  return {
    container: document.getElementById('view-merge'),
    dropZone: document.getElementById('merge-drop-zone'),
    pdfContainer: document.getElementById('pdf-cards-container'),
    emptyState: document.getElementById('empty-state'),
    configControls: document.getElementById('merge-config-controls'),
    fileCount: document.getElementById('file-count'),
    pageCount: document.getElementById('page-count'),
    sizeTotal: document.getElementById('size-total'),
    clearBtn: document.getElementById('clear-all-btn'),
    executeBtn: document.getElementById('execute-merge-btn'),
    addMoreDropzone: document.getElementById('add-more-dropzone'),
    addMoreInput: document.getElementById('add-more-input'),
    outputName: document.getElementById('output-name'),
    outputPrefix: document.getElementById('output-prefix'),
    outputSuffix: document.getElementById('output-suffix')
  };
}

// ===============================
// INICIALIZAÇÃO
// ===============================
function initMergeView() {
  if (MergeView.initialized) return;

  const DOM = cacheMergeDOM();

  if (!DOM.container) {
    console.warn('⚠️ Merge view não encontrada no DOM');
    return;
  }

  bindMergeEvents(DOM);
  initDropZone(DOM);
  renderMergeList(DOM);
  updateConfigVisibility(DOM);
  updateExecuteButton(DOM);

  MergeView.initialized = true;
  console.log('🔗 Merge View inicializada');
}

// ===============================
// DROP ZONE
// ===============================
function initDropZone(DOM) {
  if (MergeView.dropInitialized || !DOM.dropZone) return;

  setupDropZone('merge-drop-zone', {
    onDrop(files, validFiles) {
      if (validFiles.length === 0) return;

      const newPdfs = [];
      const duplicates = [];

      validFiles.forEach(file => {
        // Verificar duplicata
        const isDuplicate = state.pdfs.some(pdf => 
          pdf.name === file.name && pdf.size === file.size
        );

        if (isDuplicate) {
          duplicates.push(file.name);
          return;
        }

        newPdfs.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: file.size,
          pages: 0 // futuramente via pdf.js
        });
      });

      // Feedback sobre duplicatas
      if (duplicates.length > 0) {
        const msg = duplicates.length === 1 
          ? `"${duplicates[0]}" já foi adicionado`
          : `${duplicates.length} arquivos já foram adicionados`;
        showToast(msg, 'warning', 2500);
      }

      // Adicionar novos arquivos
      if (newPdfs.length > 0) {
        updateState({
          pdfs: [...state.pdfs, ...newPdfs]
        });
        showToast(`${newPdfs.length} arquivo(s) adicionado(s)`, 'success', 2000);
      }
    }
  });

  MergeView.dropInitialized = true;
  console.log('📥 Drop zone do Merge configurada');
}

// ===============================
// EVENTOS
// ===============================
function bindMergeEvents(DOM) {
  // Executar merge (stub)
  DOM.executeBtn?.addEventListener('click', () => {
    if (state.pdfs.length < 2) {
      showToast('Adicione pelo menos 2 PDFs', 'warning', 2500);
      return;
    }

    if (!DOM.outputName?.value.trim()) {
      showToast('Digite um nome para o arquivo de saída', 'warning', 2500);
      DOM.outputName?.focus();
      return;
    }

    // Desabilitar botão e mostrar loading
    setElementState(DOM.executeBtn, 'loading', 'Processando...');
    showToast('Iniciando merge...', 'info', 1500);

    // TODO: Chamar API real quando implementada
    setTimeout(() => {
      setElementState(DOM.executeBtn, 'enabled', 'Executar Merge');
      showToast('Merge ainda não implementado no backend', 'info', 3000);
    }, 2000);
  });

  // Limpar tudo
  DOM.clearBtn?.addEventListener('click', () => {
    if (state.pdfs.length === 0) return;

    updateState({ pdfs: [] });
    showToast('Lista de PDFs limpa', 'success', 2000);
  });

  // Adição manual de arquivos
  DOM.addMoreDropzone?.addEventListener('click', () => {
    DOM.addMoreInput?.click();
  });

  DOM.addMoreInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    const newPdfs = [];
    const errors = [];
    const duplicates = [];

    files.forEach(file => {
      // Validação
      const validation = validatePdfFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        return;
      }

      // Verificar duplicata
      const isDuplicate = state.pdfs.some(pdf => 
        pdf.name === file.name && pdf.size === file.size
      );

      if (isDuplicate) {
        duplicates.push(file.name);
        return;
      }

      newPdfs.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        pages: 0 // futuramente via pdf.js
      });
    });

    // Feedback
    if (errors.length > 0) {
      showToast(errors[0], 'error', 3000);
    }

    if (duplicates.length > 0) {
      const msg = duplicates.length === 1 
        ? `"${duplicates[0]}" já foi adicionado`
        : `${duplicates.length} arquivos já foram adicionados`;
      showToast(msg, 'warning', 2500);
    }

    // Adicionar novos
    if (newPdfs.length > 0) {
      updateState({
        pdfs: [...state.pdfs, ...newPdfs]
      });
      showToast(`${newPdfs.length} arquivo(s) adicionado(s)`, 'success', 2000);
    }

    // Resetar input
    e.target.value = '';
  });

  // Inputs de configuração
  DOM.outputName?.addEventListener('input', () => {
    updateExecuteButton(DOM);
    updatePreview();
  });

  DOM.outputPrefix?.addEventListener('input', updatePreview);
  DOM.outputSuffix?.addEventListener('input', updatePreview);

  // Reagir a mudanças no estado
  document.addEventListener('stateUpdated', (e) => {
    if (e.detail.changedKeys.includes('pdfs')) {
      renderMergeList(DOM);
      updateConfigVisibility(DOM);
      updateExecuteButton(DOM);
      updatePreview();
    }
  });

  // Atualização de ordem (drag & drop)
  document.addEventListener('pdfOrderUpdated', (e) => {
    const { pdfIds } = e.detail;

    const ordered = pdfIds
      .map(id => state.pdfs.find(pdf => pdf.id === id))
      .filter(Boolean);

    if (ordered.length === state.pdfs.length) {
      updateState({ pdfs: ordered });
      console.log('🔁 Ordem dos PDFs sincronizada');
    }
  });
}

// ===============================
// RENDERIZAÇÃO
// ===============================
function renderMergeList(DOM) {
  if (!DOM.pdfContainer || !DOM.emptyState) return;

  // Limpar container
  DOM.pdfContainer.innerHTML = '';

  if (state.pdfs.length === 0) {
    DOM.emptyState.style.display = 'flex';
    updateMergeStats(DOM);
    return;
  }

  DOM.emptyState.style.display = 'none';

  state.pdfs.forEach((pdf, index) => {
    const card = createMergeCard(pdf, index + 1);
    if (card) {
      DOM.pdfContainer.appendChild(card);
    }
  });

  updateMergeStats(DOM);
}

// ===============================
// UI / STATS
// ===============================
function updateMergeStats(DOM) {
  const totalPages = state.pdfs.reduce((sum, pdf) => sum + (pdf.pages || 0), 0);
  const totalSize = state.pdfs.reduce((sum, pdf) => sum + (pdf.size || 0), 0);

  DOM.fileCount && 
    (DOM.fileCount.textContent = 
      `${state.pdfs.length} arquivo${state.pdfs.length !== 1 ? 's' : ''}`);

  DOM.pageCount && 
    (DOM.pageCount.textContent = 
      `${totalPages} página${totalPages !== 1 ? 's' : ''}`);

  DOM.sizeTotal && 
    (DOM.sizeTotal.textContent = formatFileSize(totalSize));

  DOM.clearBtn && (DOM.clearBtn.disabled = state.pdfs.length === 0);
}

function updateConfigVisibility(DOM) {
  if (!DOM.configControls) return;
  
  DOM.configControls.style.display = state.pdfs.length > 0 ? 'block' : 'none';
}

function updateExecuteButton(DOM) {
  if (!DOM.executeBtn || !DOM.outputName) return;
  
  const hasEnoughFiles = state.pdfs.length >= 2;
  const hasName = DOM.outputName.value.trim().length > 0;
  
  DOM.executeBtn.disabled = !(hasEnoughFiles && hasName);
  
  if (!hasEnoughFiles) {
    DOM.executeBtn.title = 'Adicione pelo menos 2 PDFs';
  } else if (!hasName) {
    DOM.executeBtn.title = 'Digite um nome para o arquivo de saída';
  } else {
    DOM.executeBtn.title = 'Executar merge dos PDFs';
  }
}

function updatePreview() {
  const DOM = cacheMergeDOM();
  
  if (!DOM.outputName || !updateAllPreviews) return;
  
  const baseName = DOM.outputName.value.trim() || 'documento_mesclado';
  const prefix = DOM.outputPrefix?.value.trim() || '';
  const suffix = DOM.outputSuffix?.value.trim() || '';
  
  const totalPages = state.pdfs.reduce((sum, pdf) => sum + (pdf.pages || 0), 0);
  const totalSize = state.pdfs.reduce((sum, pdf) => sum + (pdf.size || 0), 0);
  
  updateAllPreviews(baseName, prefix, suffix, totalPages, totalSize);
}

// ===============================
// INTEGRAÇÃO COM ROUTER
// ===============================
document.addEventListener('viewChanged', (e) => {
  if (e.detail.view === 'merge') {
    initMergeView();
  }
});

// ===============================
// UTIL
// ===============================
function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default {
  initMergeView
};