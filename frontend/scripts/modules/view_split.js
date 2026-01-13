/**
 * View Split - Gus Docs
 * Responsabilidades:
 * - Gerenciar upload de UM PDF
 * - Controlar estado local do split
 * - Validar entrada de páginas
 * - Preparar dados para execução futura
 *
 * NÃO executa split real (Rust virá depois)
 */

import { state, updateState, showToast, validatePdfFile } from '../app.js';
import { createSplitMainCard } from './pdf_card.js';
import { setupDropZone, setElementState, updateCounters, updateFilenamePreview } from '../modules/ui_render.js';

// ===============================
// ESTADO LOCAL
// ===============================
const SplitView = {
  initialized: false,
  currentPdfId: null
};

// ===============================
// CACHE DE ELEMENTOS
// ===============================
function cacheSplitDOM() {
  return {
    container: document.getElementById('view-split'),
    dropZone: document.getElementById('split-drop-zone'),
    fileInput: document.getElementById('split-file-input'),
    pdfContainer: document.getElementById('split-pdf-container'),
    emptyState: document.getElementById('split-empty-state'),
    pagesInput: document.getElementById('split-pages-input'),
    executeBtn: document.getElementById('execute-split-btn'),
    clearBtn: document.getElementById('split-clear-btn'),
    fileCount: document.getElementById('split-file-count'),
    pageCount: document.getElementById('split-page-count')
  };
}

// ===============================
// INICIALIZAÇÃO
// ===============================
function initSplitView() {
  if (SplitView.initialized) return;

  const DOM = cacheSplitDOM();
  if (!DOM.container) {
    console.warn('⚠️ Split view não encontrada no DOM');
    return;
  }

  bindSplitEvents(DOM);
  initDropZone(DOM);
  renderSplitView(DOM);

  SplitView.initialized = true;
  console.log('✂️ Split View inicializada');
}

// ===============================
// DROP ZONE
// ===============================
function initDropZone(DOM) {
  if (!DOM.dropZone) return;

  setupDropZone('split-drop-zone', {
    maxFiles: 1,
    onDrop(_, validFiles) {
      if (validFiles.length) {
        handleFileSelection(validFiles[0], DOM);
      }
    }
  });
}

// ===============================
// EVENTOS
// ===============================
function bindSplitEvents(DOM) {
  // Abrir file picker ao clicar na drop zone
  DOM.dropZone?.addEventListener('click', () => {
    DOM.fileInput?.click();
  });

  // Seleção via input de arquivo
  DOM.fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileSelection(file, DOM);
    e.target.value = '';
  });

  // Limpar PDF atual
  DOM.clearBtn?.addEventListener('click', () => {
    clearSplit(DOM);
    showToast('Arquivo removido', 'info', 2000);
  });

  // Validação dinâmica do input de páginas
  DOM.pagesInput?.addEventListener('input', (e) => {
    validatePagesInput(e.target, DOM);
    updateFilenamePreviewBasedOnInput(DOM);
  });

  // Executar split
  DOM.executeBtn?.addEventListener('click', () => {
    executeSplit(DOM);
  });
}

// ===============================
// LÓGICA DE SELEÇÃO DE ARQUIVO
// ===============================
function handleFileSelection(file, DOM) {
  // Validar arquivo
  const validation = validatePdfFile(file);
  if (!validation.valid) {
    showToast(validation.message, 'error', 2500);
    return;
  }

  // Limpar PDF anterior do estado global
  updateState({ pdfs: [] });

  // Criar novo PDF com ID único
  const pdfData = {
    id: crypto.randomUUID(),
    file: file,
    name: file.name,
    size: file.size,
    pages: null // Será preenchido se o metadata estiver disponível
  };

  // Adicionar ao estado global
  updateState({
    pdfs: [pdfData]
  });

  SplitView.currentPdfId = pdfData.id;
  
  // Tentar extrair metadata de páginas se possível
  extractPageCount(pdfData).then((pages) => {
    if (pages) {
      pdfData.pages = pages;
      updateState({
        pdfs: [pdfData]
      });
      updateCounters(DOM.dropZone, 1, pages);
    }
  });

  renderSplitView(DOM);
  updateFilenamePreviewBasedOnInput(DOM);
  showToast('PDF carregado para divisão', 'success', 2000);
}

// ===============================
// VALIDAÇÃO DE PÁGINAS
// ===============================
function validatePagesInput(inputElement, DOM) {
  const value = inputElement.value.trim();
  const isValid = isValidPageRange(value);
  
  // Aplicar classes CSS para feedback visual
  if (value === '') {
    inputElement.classList.remove('valid', 'invalid');
  } else if (isValid) {
    inputElement.classList.add('valid');
    inputElement.classList.remove('invalid');
  } else {
    inputElement.classList.add('invalid');
    inputElement.classList.remove('valid');
  }
  
  // Verificar limites de páginas se disponível
  if (isValid && SplitView.currentPdfId) {
    const pdfData = state.pdfs.find(pdf => pdf.id === SplitView.currentPdfId);
    if (pdfData?.pages) {
      const pagesOutOfRange = checkPagesOutOfRange(value, pdfData.pages);
      if (pagesOutOfRange) {
        inputElement.classList.add('invalid');
        inputElement.classList.remove('valid');
        showToast(`Páginas fora do limite (máx: ${pdfData.pages})`, 'warning', 3000);
      }
    }
  }
  
  updateSplitControls(DOM);
  
  return isValid;
}

function isValidPageRange(value) {
  if (!value) return false;
  
  // Padrão: números, vírgulas e hífens (ex: 1, 3-5, 10)
  const pattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;
  
  if (!pattern.test(value)) return false;
  
  // Validar cada parte individualmente
  const parts = value.split(',').map(part => part.trim());
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(num => parseInt(num.trim()));
      if (isNaN(start) || isNaN(end) || start > end) {
        return false;
      }
    }
  }
  
  return true;
}

function checkPagesOutOfRange(rangeString, maxPages) {
  const parts = rangeString.split(',').map(part => part.trim());
  
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(num => parseInt(num.trim()));
      if (start > maxPages || end > maxPages) {
        return true;
      }
    } else {
      const pageNum = parseInt(part);
      if (pageNum > maxPages) {
        return true;
      }
    }
  }
  
  return false;
}

// ===============================
// PREVIEW DE NOMES DE ARQUIVO
// ===============================
function updateFilenamePreviewBasedOnInput(DOM) {
  if (!DOM.pagesInput || !SplitView.currentPdfId) return;
  
  const pdfData = state.pdfs.find(pdf => pdf.id === SplitView.currentPdfId);
  if (!pdfData) return;
  
  const rangeValue = DOM.pagesInput.value.trim();
  const isValid = isValidPageRange(rangeValue);
  
  if (isValid && rangeValue) {
    // Gerar nomes de arquivo de exemplo
    const baseName = pdfData.name.replace('.pdf', '');
    const parts = rangeValue.split(',').map(part => part.trim());
    
    const previewNames = parts.map((part, index) => {
      return `${baseName}_p${part}.pdf`;
    });
    
    updateFilenamePreview(DOM.dropZone, previewNames.slice(0, 3)); // Mostrar apenas 3 exemplos
  } else {
    updateFilenamePreview(DOM.dropZone, null);
  }
}

// ===============================
// EXECUÇÃO DO SPLIT
// ===============================
function executeSplit(DOM) {
  const pdfData = state.pdfs.find(pdf => pdf.id === SplitView.currentPdfId);
  
  if (!pdfData) {
    showToast('Nenhum PDF carregado', 'warning', 2000);
    return;
  }
  
  const pagesRange = DOM.pagesInput.value.trim();
  const isValid = validatePagesInput(DOM.pagesInput, DOM);
  
  if (!isValid) {
    showToast('Intervalo de páginas inválido', 'error', 2500);
    return;
  }
  
  // Verificar limites de páginas
  if (pdfData.pages) {
    const outOfRange = checkPagesOutOfRange(pagesRange, pdfData.pages);
    if (outOfRange) {
      showToast(`Páginas fora do limite (máx: ${pdfData.pages})`, 'error', 3000);
      return;
    }
  }
  
  // Desabilitar botão com estado de loading
  setElementState(DOM.executeBtn, 'loading');
  
  console.log('✂️ SPLIT PREPARADO:', {
    pdf: pdfData,
    pagesRange
  });
  
  // Simular processamento (será substituído pelo Rust)
  setTimeout(() => {
    setElementState(DOM.executeBtn, 'default');
    showToast('Split ainda não implementado', 'info', 2500);
  }, 1500);
}

// ===============================
// RENDERIZAÇÃO
// ===============================
function renderSplitView(DOM) {
  DOM.pdfContainer.innerHTML = '';
  
  const pdfData = state.pdfs.find(pdf => pdf.id === SplitView.currentPdfId);
  
  if (!pdfData) {
    DOM.emptyState.style.display = 'flex';
    DOM.pagesInput.value = '';
    DOM.pagesInput.classList.remove('valid', 'invalid');
  } else {
    DOM.emptyState.style.display = 'none';
    DOM.pdfContainer.appendChild(
      createSplitMainCard(pdfData)
    );
  }
  
  updateSplitStats(DOM);
  updateSplitControls(DOM);
  updateFilenamePreviewBasedOnInput(DOM);
}

function updateSplitStats(DOM) {
  const pdfData = state.pdfs.find(pdf => pdf.id === SplitView.currentPdfId);
  
  if (DOM.fileCount) {
    DOM.fileCount.textContent = pdfData ? '1 arquivo' : '0 arquivos';
  }
  
  if (DOM.pageCount) {
    DOM.pageCount.textContent = pdfData?.pages ? `${pdfData.pages} páginas` : '—';
  }
  
  // Atualizar contadores na drop zone
  if (DOM.dropZone && pdfData) {
    updateCounters(DOM.dropZone, 1, pdfData.pages);
  }
}

function updateSplitControls(DOM) {
  const pdfData = state.pdfs.find(pdf => pdf.id === SplitView.currentPdfId);
  const isValidPages = validatePagesInput(DOM.pagesInput, DOM);
  
  if (DOM.clearBtn) {
    DOM.clearBtn.disabled = !pdfData;
  }
  
  if (DOM.executeBtn) {
    DOM.executeBtn.disabled = !pdfData || !isValidPages;
  }
}

// ===============================
// LIMPEZA
// ===============================
function clearSplit(DOM) {
  // Remover PDF do estado global
  updateState({ pdfs: [] });
  SplitView.currentPdfId = null;
  
  // Resetar UI
  DOM.pagesInput.value = '';
  DOM.pagesInput.classList.remove('valid', 'invalid');
  updateFilenamePreview(DOM.dropZone, null);
  
  renderSplitView(DOM);
}

// ===============================
// UTILITÁRIOS
// ===============================
async function extractPageCount(pdfData) {
  // Esta é uma implementação simplificada
  // Em uma implementação real, você usaria pdf.js ou backend para extrair metadata
  try {
    // Simulação - em produção, isso seria substituído por leitura real do PDF
    console.log('Extraindo contagem de páginas do PDF:', pdfData.name);
    
    // Retornar null por enquanto (será implementado posteriormente)
    return null;
  } catch (error) {
    console.error('Erro ao extrair contagem de páginas:', error);
    return null;
  }
}

// ===============================
// INTEGRAÇÃO COM ROUTER
// ===============================
document.addEventListener('viewChanged', (e) => {
  if (e.detail.view === 'split') {
    initSplitView();
    
    // Verificar se já há PDFs no estado global ao entrar na view
    const DOM = cacheSplitDOM();
    if (state.pdfs.length > 0) {
      // Usar o primeiro PDF da lista
      SplitView.currentPdfId = state.pdfs[0].id;
      renderSplitView(DOM);
    }
  }
});

export default {
  initSplitView
};