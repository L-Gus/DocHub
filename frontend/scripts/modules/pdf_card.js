// frontend/scripts/modules/pdf_card.js
/**
 * Factory de Cards de PDF
 * Gera componentes visuais para arquivos PDF baseados no contexto
 */

import { app } from '../../app.js';

// ============================================
// 1. CONFIGURAÇÕES E CONSTANTES
// ============================================
const CARD_CONFIG = {
  merge: {
    className: 'pdf-card merge-card',
    width: '200px',
    height: '240px',
    draggable: true,
    showThumbnail: true,
    showActions: true,
    showPageCount: true,
    showFileSize: true,
    truncateName: 20,
    context: 'merge'
  },
  splitPreview: {
    className: 'pdf-card split-preview-card',
    width: '120px',
    height: '150px',
    draggable: false,
    showThumbnail: true,
    showActions: false,
    showPageCount: false,
    showFileSize: false,
    truncateName: 15,
    pageNumber: true,  // Mostra número da página
    context: 'splitPreview'
  },
  splitMain: {
    className: 'pdf-card split-main-card',
    width: '100%',
    height: 'auto',
    draggable: false,
    showThumbnail: true,
    showActions: true,
    showPageCount: true,
    showFileSize: true,
    truncateName: false,
    context: 'splitMain'
  }
};

// ============================================
// 2. UTILITÁRIOS
// ============================================
function formatFileName(name, maxLength = 20) {
  if (!maxLength || name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

function generatePlaceholder(pageNum = null) {
  const placeholder = document.createElement('div');
  placeholder.className = 'pdf-thumbnail-placeholder';
  
  if (pageNum !== null) {
    placeholder.innerHTML = `
      <div class="page-number-badge">${pageNum}</div>
      <div class="pdf-icon">📄</div>
    `;
    placeholder.setAttribute('data-page', pageNum);
  } else {
    placeholder.innerHTML = '<div class="pdf-icon">📄</div>';
  }
  
  return placeholder;
}

// ============================================
// 3. FÁBRICA PRINCIPAL DE CARDS
// ============================================
export function createPdfCard(pdfData, context = 'merge', options = {}) {
  // Configuração baseada no contexto
  const baseConfig = CARD_CONFIG[context] || CARD_CONFIG.merge;
  const config = { ...baseConfig, ...options };
  
  // Criar elemento principal
  const card = document.createElement('div');
  card.className = config.className;
  card.dataset.pdfId = pdfData.id;
  card.dataset.context = context;
  
  // Aplicar estilos dimensionais
  if (config.width) card.style.width = config.width;
  if (config.height) card.style.height = config.height;
  
  // Adicionar atributos de drag & drop
  if (config.draggable) {
    card.draggable = true;
    card.setAttribute('aria-grabbed', 'false');
  }
  
  // Construir conteúdo do card
  card.innerHTML = buildCardHTML(pdfData, config);
  
  // Adicionar event listeners
  addCardEventListeners(card, pdfData, config);
  
  // Aplicar estado inicial
  updateCardState(card, 'normal');
  
  return card;
}

// ============================================
// 4. CONSTRUÇÃO DO HTML DO CARD
// ============================================
function buildCardHTML(pdfData, config) {
  const fileName = config.truncateName 
    ? formatFileName(pdfData.name, config.truncateName)
    : pdfData.name;
  
  let thumbnailHTML = '';
  if (config.showThumbnail) {
    if (pdfData.thumbnail) {
      thumbnailHTML = `
        <img src="${pdfData.thumbnail}" 
             alt="Preview: ${pdfData.name}" 
             class="pdf-thumbnail"
             loading="lazy">
      `;
    } else {
      thumbnailHTML = '<div class="pdf-thumbnail-placeholder"></div>';
    }
  }
  
  let pageInfoHTML = '';
  if (config.pageNumber && pdfData.pageNumber) {
    pageInfoHTML = `<div class="page-number">Página ${pdfData.pageNumber}</div>`;
  } else if (config.showPageCount && pdfData.pages) {
    pageInfoHTML = `<div class="page-count">${pdfData.pages} pág.</div>`;
  }
  
  let fileSizeHTML = '';
  if (config.showFileSize && pdfData.size) {
    fileSizeHTML = `<div class="file-size">${pdfData.size}</div>`;
  }
  
  let actionsHTML = '';
  if (config.showActions) {
    actionsHTML = `
      <div class="card-actions">
        <button class="btn-card-action btn-remove" 
                aria-label="Remover arquivo"
                title="Remover">
          ×
        </button>
        <button class="btn-card-action btn-drag-handle" 
                aria-label="Arrastar para reordenar"
                title="Arrastar">
          ≡
        </button>
        ${config.context === 'merge' ? `
        <button class="btn-card-action btn-preview" 
                aria-label="Visualizar PDF"
                title="Visualizar">
          👁️
        </button>
        ` : ''}
      </div>
    `;
  }
  
  return `
    <div class="card-header">
      <div class="card-thumbnail">
        ${thumbnailHTML}
        ${pdfData.error ? '<div class="error-overlay">⚠️</div>' : ''}
      </div>
      ${pageInfoHTML}
    </div>
    
    <div class="card-body">
      <h4 class="card-title" title="${pdfData.name}">
        ${fileName}
      </h4>
      ${fileSizeHTML}
    </div>
    
    ${actionsHTML}
    
    <div class="card-context-menu">
      <ul>
        <li data-action="preview">👁️ Visualizar</li>
        <li data-action="remove">🗑️ Remover</li>
        <li data-action="showInExplorer">📁 Mostrar no explorador</li>
        <li data-action="copyPath">📋 Copiar caminho</li>
        <li data-action="properties">📊 Propriedades</li>
      </ul>
    </div>
  `;
}

// ============================================
// 5. GERENCIAMENTO DE EVENTOS
// ============================================
function addCardEventListeners(card, pdfData, config) {
  // Hover
  card.addEventListener('mouseenter', () => {
    if (card.dataset.state !== 'dragging') {
      updateCardState(card, 'hover');
    }
  });
  
  card.addEventListener('mouseleave', () => {
    if (card.dataset.state !== 'dragging') {
      updateCardState(card, 'normal');
    }
  });
  
  // Click para preview
  if (config.context !== 'splitPreview') {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.card-actions')) {
        openPdfPreview(pdfData);
      }
    });
  }
  
  // Botões de ação
  const removeBtn = card.querySelector('.btn-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Remover "${pdfData.name}" da lista?`)) {
        app.removePdf(pdfData.id);
        card.remove();
        app.showToast('Arquivo removido', 'info', 2000);
      }
    });
  }
  
  const previewBtn = card.querySelector('.btn-preview');
  if (previewBtn) {
    previewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPdfPreview(pdfData);
    });
  }
  
  // Drag & Drop (apenas para merge)
  if (config.draggable) {
    const dragHandle = card.querySelector('.btn-drag-handle');
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', startDrag);
    }
    
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('drop', handleDrop);
  }
  
  // Context Menu (clique direito)
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(card, e.clientX, e.clientY, pdfData);
  });
  
  // Fechar context menu ao clicar fora
  document.addEventListener('click', hideContextMenu);
}

// ============================================
// 6. GERENCIAMENTO DE ESTADOS
// ============================================
function updateCardState(card, state) {
  card.dataset.state = state;
  
  // Remover classes de estado anteriores
  card.classList.remove('state-normal', 'state-hover', 'state-dragging', 'state-selected', 'state-error');
  
  // Adicionar nova classe
  card.classList.add(`state-${state}`);
  
  // Atualizar atributos ARIA
  switch (state) {
    case 'dragging':
      card.setAttribute('aria-grabbed', 'true');
      card.style.opacity = '0.5';
      break;
    case 'selected':
      card.setAttribute('aria-selected', 'true');
      break;
    case 'error':
      card.setAttribute('aria-invalid', 'true');
      break;
    default:
      card.setAttribute('aria-grabbed', 'false');
      card.setAttribute('aria-selected', 'false');
      card.style.opacity = '1';
  }
}

// ============================================
// 7. DRAG & DROP IMPLEMENTATION
// ============================================
let dragSrcEl = null;

function startDrag(e) {
  // Esta função é apenas para o botão de drag handle
  if (dragSrcEl) return;
  
  const card = e.target.closest('.pdf-card');
  if (!card) return;
  
  dragSrcEl = card;
  updateCardState(card, 'dragging');
  
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', card.outerHTML);
  e.dataTransfer.setData('text/plain', card.dataset.pdfId);
  
  // Adicionar classe global durante o drag
  document.body.classList.add('dragging-active');
}

function handleDragStart(e) {
  dragSrcEl = this;
  updateCardState(this, 'dragging');
  
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.outerHTML);
  e.dataTransfer.setData('text/plain', this.dataset.pdfId);
  
  // Adicionar classe global durante o drag
  document.body.classList.add('dragging-active');
}

function handleDragEnd() {
  if (dragSrcEl) {
    updateCardState(dragSrcEl, 'normal');
  }
  dragSrcEl = null;
  
  // Remover classe global
  document.body.classList.remove('dragging-active');
  
  // Remover todas as marcações de drop target
  document.querySelectorAll('.drop-target').forEach(el => {
    el.classList.remove('drop-target');
  });
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault(); // Permite drop
  }
  
  e.dataTransfer.dropEffect = 'move';
  
  // Adicionar indicação visual de drop target
  if (this !== dragSrcEl && this.classList.contains('pdf-card')) {
    this.classList.add('drop-target');
  }
  
  return false;
}

function handleDragLeave(e) {
  // Remover indicação de drop target
  if (this.classList.contains('pdf-card')) {
    this.classList.remove('drop-target');
  }
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  
  // Remover indicação de drop target
  if (this.classList.contains('pdf-card')) {
    this.classList.remove('drop-target');
  }
  
  if (dragSrcEl && dragSrcEl !== this) {
    // Obter containers
    const srcContainer = dragSrcEl.parentNode;
    const targetContainer = this.parentNode;
    
    // Verificar se estão no mesmo container
    if (srcContainer === targetContainer) {
      // Reordenação no mesmo container
      const allCards = Array.from(srcContainer.children)
        .filter(el => el.classList.contains('pdf-card') && el !== dragSrcEl);
      
      const targetIndex = allCards.indexOf(this);
      
      if (targetIndex !== -1) {
        // Determinar posição de inserção
        if (dragSrcEl.compareDocumentPosition(this) & Node.DOCUMENT_POSITION_FOLLOWING) {
          // dragSrcEl está antes do this, inserir antes
          srcContainer.insertBefore(dragSrcEl, this);
        } else {
          // dragSrcEl está depois do this, inserir depois
          srcContainer.insertBefore(dragSrcEl, this.nextSibling);
        }
        
        // Atualizar estado no app
        updatePdfOrder(srcContainer);
        
        // Feedback visual
        app.showToast('Ordem atualizada', 'success', 1500);
      }
    }
  }
  
  return false;
}

function updatePdfOrder(container) {
  const pdfIds = Array.from(container.querySelectorAll('.pdf-card'))
    .map(card => card.dataset.pdfId)
    .filter(id => id);
  
  // Aqui você pode atualizar a ordem no state global se necessário
  console.log('Nova ordem dos PDFs:', pdfIds);
  
  // Disparar evento para outros módulos
  const event = new CustomEvent('pdfOrderUpdated', {
    detail: { pdfIds }
  });
  document.dispatchEvent(event);
}

// ============================================
// 8. CONTEXT MENU
// ============================================
let currentContextMenu = null;

function showContextMenu(card, x, y, pdfData) {
  // Remover menu anterior
  hideContextMenu();
  
  const menu = card.querySelector('.card-context-menu');
  if (!menu) return;
  
  // Posicionar menu
  menu.style.display = 'block';
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
  menu.style.position = 'fixed';
  menu.style.zIndex = '1000';
  
  // Adicionar event listeners aos itens do menu
  menu.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      handleContextMenuAction(item.dataset.action, pdfData);
      hideContextMenu();
    });
  });
  
  currentContextMenu = menu;
}

function hideContextMenu() {
  if (currentContextMenu) {
    currentContextMenu.style.display = 'none';
    currentContextMenu = null;
  }
}

function handleContextMenuAction(action, pdfData) {
  switch (action) {
    case 'preview':
      openPdfPreview(pdfData);
      break;
    case 'remove':
      if (confirm(`Remover "${pdfData.name}"?`)) {
        app.removePdf(pdfData.id);
        app.showToast('Arquivo removido', 'info', 2000);
      }
      break;
    case 'showInExplorer':
      // Integrar com Electron para abrir explorador
      if (window.electronAPI) {
        window.electronAPI.showItemInFolder(pdfData.path);
      } else {
        app.showToast('Funcionalidade disponível apenas na versão desktop', 'warning', 3000);
      }
      break;
    case 'copyPath':
      navigator.clipboard.writeText(pdfData.path)
        .then(() => app.showToast('Caminho copiado!', 'success', 1500))
        .catch(err => {
          console.error('Erro ao copiar caminho:', err);
          app.showToast('Erro ao copiar caminho', 'error', 2000);
        });
      break;
    case 'properties':
      showPdfProperties(pdfData);
      break;
    default:
      console.warn(`Ação de contexto desconhecida: ${action}`);
  }
}

// ============================================
// 9. FUNÇÕES AUXILIARES
// ============================================
function openPdfPreview(pdfData) {
  app.showToast(`Abrindo visualização: ${pdfData.name}`, 'info', 2000);
  
  // Criar modal de preview (implementação básica)
  const modal = document.createElement('div');
  modal.className = 'pdf-preview-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  modal.innerHTML = `
    <div class="preview-content" style="
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0;">${pdfData.name}</h3>
        <button class="close-preview" style="
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
        ">×</button>
      </div>
      <div class="preview-body">
        <p>Preview do PDF: ${pdfData.name}</p>
        <p>Páginas: ${pdfData.pages || 'N/A'}</p>
        <p>Tamanho: ${pdfData.size || 'N/A'}</p>
        ${pdfData.thumbnail ? `
        <div style="text-align: center; margin-top: 20px;">
          <img src="${pdfData.thumbnail}" alt="Preview" style="max-width: 100%; max-height: 60vh;">
          <p><small>Preview da primeira página</small></p>
        </div>
        ` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Fechar modal
  const closeBtn = modal.querySelector('.close-preview');
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Fechar com ESC
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
  
  console.log('Preview PDF:', pdfData);
}

function showPdfProperties(pdfData) {
  // Modal com propriedades detalhadas
  const props = `
    Nome: ${pdfData.name}
    Caminho: ${pdfData.path}
    Páginas: ${pdfData.pages || 'N/A'}
    Tamanho: ${pdfData.size || 'N/A'}
    Data: ${pdfData.modifiedDate || 'N/A'}
    ID: ${pdfData.id || 'N/A'}
  `;
  
  const modal = document.createElement('div');
  modal.className = 'properties-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white;
      padding: 25px;
      border-radius: 10px;
      max-width: 500px;
      width: 90%;
    ">
      <h3 style="margin-top: 0;">Propriedades do PDF</h3>
      <pre style="
        background: #f5f5f5;
        padding: 15px;
        border-radius: 5px;
        white-space: pre-wrap;
        font-family: monospace;
      ">${props}</pre>
      <div style="text-align: right; margin-top: 20px;">
        <button class="close-props" style="
          padding: 8px 16px;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Fechar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.close-props').addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ============================================
// 10. FUNÇÕES PÚBLICAS PARA OUTROS MÓDULOS
// ============================================
export function createMergeCard(pdfData) {
  return createPdfCard(pdfData, 'merge');
}

export function createSplitPreviewCard(pdfData, pageNum) {
  return createPdfCard({
    ...pdfData,
    pageNumber: pageNum,
    name: `Página ${pageNum}`
  }, 'splitPreview');
}

export function createSplitMainCard(pdfData) {
  return createPdfCard(pdfData, 'splitMain');
}

export function updateCardThumbnail(cardId, thumbnailUrl) {
  const card = document.querySelector(`[data-pdf-id="${cardId}"]`);
  if (card) {
    const thumbnail = card.querySelector('.pdf-thumbnail');
    if (thumbnail) {
      thumbnail.src = thumbnailUrl;
    } else {
      const placeholder = card.querySelector('.pdf-thumbnail-placeholder');
      if (placeholder) {
        placeholder.innerHTML = `<img src="${thumbnailUrl}" class="pdf-thumbnail" loading="lazy">`;
      }
    }
  }
}

export function markCardAsError(cardId, errorMessage) {
  const card = document.querySelector(`[data-pdf-id="${cardId}"]`);
  if (card) {
    updateCardState(card, 'error');
    card.title = `Erro: ${errorMessage}`;
    
    // Adicionar overlay de erro
    const thumbnail = card.querySelector('.card-thumbnail');
    if (thumbnail && !thumbnail.querySelector('.error-overlay')) {
      const errorOverlay = document.createElement('div');
      errorOverlay.className = 'error-overlay';
      errorOverlay.textContent = '⚠️';
      errorOverlay.title = errorMessage;
      thumbnail.appendChild(errorOverlay);
    }
  }
}

export function clearAllCards() {
  document.querySelectorAll('.pdf-card').forEach(card => {
    card.remove();
  });
}

// ============================================
// 11. INICIALIZAÇÃO E EXPORT
// ============================================
// Exportar funções principais
export default {
  createMergeCard,
  createSplitPreviewCard,
  createSplitMainCard,
  updateCardThumbnail,
  markCardAsError,
  clearAllCards
};

// Adicionar utilitários ao objeto global para debug
if (process.env.NODE_ENV === 'development') {
  window.pdfCardUtils = {
    formatFileName,
    generatePlaceholder,
    updateCardState,
    updatePdfOrder
  };
}