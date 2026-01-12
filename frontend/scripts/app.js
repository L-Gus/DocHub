// frontend/scripts/app.js
/**
 * Gus Docs - Gerenciador de Estado e Router Principal
 * 
 * Este arquivo gerencia:
 * - Estado global da aplicação
 * - Navegação entre telas (SPA-like)
 * - Inicialização dos módulos
 */

// ============================================
// 1. CONSTANTES E CONFIGURAÇÕES
// ============================================
const CONFIG = {
  views: {
    merge: {
      id: 'view-merge',
      navSelector: 'a[data-view="merge"]',
      title: 'Unir PDFs',
      shortcut: 'Ctrl+M'
    },
    split: {
      id: 'view-split',
      navSelector: 'a[data-view="split"]',
      title: 'Dividir PDF',
      shortcut: 'Ctrl+S'
    }
  },
  maxFileSize: 100 * 1024 * 1024, // 100MB
  supportedFileTypes: ['.pdf', '.PDF'],
  defaultTheme: 'dark',
  storageKeys: {
    theme: 'gus-docs-theme',
    mergePresets: 'gus-docs-merge-presets',
    splitPresets: 'gus-docs-split-presets'
  }
};

// ============================================
// 2. ESTADO GLOBAL
// ============================================
const state = {
  // Navegação
  currentView: 'merge',
  previousView: null,
  
  // Dados dos PDFs
  pdfs: [],
  
  // Configurações gerais
  outputDir: '',
  namingPreset: {
    prefix: '',
    baseName: 'merged',
    suffix: '',
    counterStart: 1,
    counterDigits: 3
  },
  savedPresets: [],
  
  // UI
  theme: document.body.getAttribute('data-theme') || CONFIG.defaultTheme,
  isLoading: false,
  isInitialized: false,
  
  // Configurações específicas por view
  mergeSettings: {
    sortBy: 'name',
    autoNaming: true,
    preserveOrder: true
  },
  splitSettings: {
    pageRanges: '',
    outputFormat: 'separate',
    namingPattern: '[name]_p[pages]'
  }
};

// ============================================
// 3. ELEMENTOS DOM (cacheados após DOM ready)
// ============================================
let DOM = {};

/**
 * Cacheia elementos DOM importantes
 */
function cacheDOMElements() {
  try {
    DOM = {
      // Container principal
      appContainer: document.querySelector('.app-container'),
      body: document.body,
      
      // Views
      viewMerge: document.getElementById('view-merge'),
      viewSplit: document.getElementById('view-split'),
      
      // Títulos
      pageTitle: document.querySelector('.view-header h2'),
      viewDescription: document.querySelector('.view-description'),
      
      // Loading overlay
      loadingOverlay: document.getElementById('global-loading-overlay'),
      loadingText: null,
      
      // Notificações/toasts
      toastContainer: document.getElementById('toast-container'),
      modalContainer: document.getElementById('modal-container'),
      
      // Elementos específicos do Merge View
      pdfCardsContainer: document.getElementById('pdf-cards-container'),
      emptyState: document.getElementById('empty-state'),
      fileCount: document.getElementById('file-count'),
      pageCount: document.getElementById('page-count'),
      sizeTotal: document.getElementById('size-total'),
      clearAllBtn: document.getElementById('clear-all-btn'),
      executeMergeBtn: document.getElementById('execute-merge-btn'),
      
      // Elementos específicos do Split View
      splitPdfContainer: document.getElementById('split-pdf-container'),
      splitEmptyState: document.getElementById('split-empty-state'),
      splitFileCount: document.getElementById('split-file-count'),
      splitPageCount: document.getElementById('split-page-count'),
      splitClearBtn: document.getElementById('split-clear-btn'),
      executeSplitBtn: document.getElementById('execute-split-btn'),
      
      // Navegação
      menuLinks: document.querySelectorAll('.menu-link'),
      themeToggle: document.getElementById('theme-toggle'),
      themeIcon: document.getElementById('theme-icon'),
      themeLabel: document.getElementById('theme-label')
    };
    
    console.log('✅ Elementos DOM cacheados');
  } catch (error) {
    console.error('❌ Erro ao cachear elementos DOM:', error);
  }
}

// ============================================
// 4. ROTEADOR DE VIEWS (SPA)
// ============================================

/**
 * Alterna entre as views da aplicação
 * @param {string} view - Nome da view ('merge' ou 'split')
 */
function switchView(view) {
  // Validar view
  if (!CONFIG.views[view]) {
    console.error(`View "${view}" não existe`);
    return false;
  }
  
  // Verificar se já está na view atual
  if (state.currentView === view) {
    console.log(`Já está na view: ${view}`);
    return false;
  }
  
  console.log(`🔄 Alternando view: ${state.currentView} → ${view}`);
  
  // Salvar view anterior
  state.previousView = state.currentView;
  state.currentView = view;
  
  // Atualizar navegação
  updateNavigation(view);
  
  // Mostrar/ocultar views
  toggleViewsVisibility(view);
  
  // Atualizar título da página
  updatePageTitle(view);
  
  // Atualizar URL hash
  updateUrlHash(view);
  
  // Disparar evento
  dispatchViewChangedEvent(view);
  
  return true;
}

/**
 * Atualiza a navegação lateral
 */
function updateNavigation(view) {
  DOM.menuLinks?.forEach(link => {
    const linkView = link.getAttribute('data-view');
    if (linkView === view) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });
}

/**
 * Mostra/oculta as views
 */
function toggleViewsVisibility(view) {
  Object.keys(CONFIG.views).forEach(viewKey => {
    const viewElement = document.getElementById(CONFIG.views[viewKey].id);
    if (viewElement) {
      if (viewKey === view) {
        viewElement.classList.add('active');
        viewElement.setAttribute('aria-hidden', 'false');
      } else {
        viewElement.classList.remove('active');
        viewElement.setAttribute('aria-hidden', 'true');
      }
    }
  });
}

/**
 * Atualiza o título da página
 */
function updatePageTitle(view) {
  if (DOM.pageTitle && CONFIG.views[view].title) {
    DOM.pageTitle.textContent = CONFIG.views[view].title;
    document.title = `Gus Docs - ${CONFIG.views[view].title}`;
  }
}

/**
 * Atualiza o hash da URL
 */
function updateUrlHash(view) {
  const newHash = `#${view}`;
  if (window.location.hash !== newHash) {
    window.location.hash = newHash;
  }
}

/**
 * Dispara evento de mudança de view
 */
function dispatchViewChangedEvent(view) {
  const event = new CustomEvent('viewChanged', { 
    detail: { 
      view,
      previousView: state.previousView 
    }
  });
  document.dispatchEvent(event);
  console.log(`✅ View alterada para: ${view}`);
}

/**
 * Manipula mudanças no hash da URL
 */
function handleHashChange() {
  const hash = window.location.hash.substring(1);
  
  if (hash && CONFIG.views[hash]) {
    switchView(hash);
  } else if (!hash) {
    // Default para merge
    switchView('merge');
  }
}

// ============================================
// 5. GERENCIAMENTO DE ESTADO
// ============================================

/**
 * Atualiza o estado global
 * @param {Object} newState - Novos valores para o estado
 */
function updateState(newState) {
  const oldState = { ...state };
  Object.assign(state, newState);
  
  // Disparar evento de estado atualizado
  const event = new CustomEvent('stateUpdated', { 
    detail: { 
      newState: { ...state },
      oldState,
      changedKeys: Object.keys(newState)
    }
  });
  document.dispatchEvent(event);
  
  console.log('📊 Estado atualizado:', Object.keys(newState));
  return state;
}

/**
 * Adiciona um PDF ao estado
 */
function addPdf(pdf) {
  if (!pdf || !pdf.name) {
    console.error('PDF inválido:', pdf);
    return null;
  }
  
  // Gerar ID único se não existir
  if (!pdf.id) {
    pdf.id = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Adicionar timestamp
  pdf.addedAt = new Date().toISOString();
  
  const newPdfs = [...state.pdfs, pdf];
  updateState({ pdfs: newPdfs });
  
  // Atualizar estatísticas
  updateFileStats();
  
  console.log(`📄 PDF adicionado: ${pdf.name} (ID: ${pdf.id})`);
  return pdf.id;
}

/**
 * Remove um PDF do estado
 */
function removePdf(pdfId) {
  const index = state.pdfs.findIndex(pdf => pdf.id === pdfId);
  if (index === -1) {
    console.warn(`PDF com ID ${pdfId} não encontrado`);
    return false;
  }
  
  const removedPdf = state.pdfs[index];
  const newPdfs = state.pdfs.filter(pdf => pdf.id !== pdfId);
  updateState({ pdfs: newPdfs });
  
  // Atualizar estatísticas
  updateFileStats();
  
  console.log(`🗑️ PDF removido: ${removedPdf.name}`);
  return true;
}

/**
 * Limpa todos os PDFs
 */
function clearPdfs() {
  if (state.pdfs.length === 0) return;
  
  const count = state.pdfs.length;
  updateState({ pdfs: [] });
  updateFileStats();
  
  console.log(`🧹 ${count} PDF(s) removido(s)`);
  return count;
}

/**
 * Atualiza estatísticas de arquivos na UI
 */
function updateFileStats() {
  if (!DOM.fileCount || !DOM.pageCount || !DOM.sizeTotal) return;
  
  const totalPages = state.pdfs.reduce((sum, pdf) => sum + (pdf.pages || 0), 0);
  const totalSize = state.pdfs.reduce((sum, pdf) => sum + (pdf.size || 0), 0);
  
  DOM.fileCount.textContent = `${state.pdfs.length} arquivo${state.pdfs.length !== 1 ? 's' : ''}`;
  DOM.pageCount.textContent = `${totalPages} página${totalPages !== 1 ? 's' : ''}`;
  DOM.sizeTotal.textContent = formatFileSize(totalSize);
  
  // Habilitar/desabilitar botões
  if (DOM.clearAllBtn) {
    DOM.clearAllBtn.disabled = state.pdfs.length === 0;
  }
  
  if (DOM.executeMergeBtn) {
    DOM.executeMergeBtn.disabled = state.pdfs.length < 2;
  }
  
  // Mostrar/ocultar empty state
  if (DOM.emptyState && DOM.pdfCardsContainer) {
    DOM.emptyState.style.display = state.pdfs.length === 0 ? 'flex' : 'none';
  }
  
  console.log(`📊 Estatísticas: ${state.pdfs.length} arquivos, ${totalPages} páginas, ${formatFileSize(totalSize)}`);
}

/**
 * Formata tamanho de arquivo para leitura humana
 */
function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) return '0 Bytes';
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// 6. GERENCIAMENTO DE TEMA
// ============================================

/**
 * Inicializa o tema da aplicação
 */
function initTheme() {
  console.log('🎨 Inicializando tema...');
  
  if (window.gusThemeManager) {
    const tm = window.gusThemeManager;
    
    // Se não estiver inicializado, inicializar
    if (!tm.isInitialized) {
      tm.init();
    }
    
    // Sincronizar com estado global
    state.theme = tm.resolvedTheme;
    document.body.setAttribute('data-theme', state.theme);
    
    // Configurar listener para mudanças de tema
    tm.on('themeChanged', handleThemeChange);
    
    updateThemeToggleUI();
    console.log(`✅ Tema inicializado via ThemeManager: ${state.theme}`);
  } else {
    // Fallback: usar localStorage ou preferência do sistema
    console.warn('ThemeManager não disponível, usando fallback');
    applyThemeFallback();
  }
}

/**
 * Aplica fallback de tema
 */
function applyThemeFallback() {
  try {
    const savedTheme = localStorage.getItem(CONFIG.storageKeys.theme);
    if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
      state.theme = savedTheme;
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      state.theme = prefersDark ? 'dark' : 'light';
    }
    
    document.body.setAttribute('data-theme', state.theme);
    localStorage.setItem(CONFIG.storageKeys.theme, state.theme);
    
    updateThemeToggleUI();
    console.log(`✅ Tema fallback aplicado: ${state.theme}`);
  } catch (error) {
    console.error('❌ Erro ao aplicar fallback de tema:', error);
    state.theme = CONFIG.defaultTheme;
    document.body.setAttribute('data-theme', CONFIG.defaultTheme);
  }
}

/**
 * Manipula mudanças de tema
 */
function handleThemeChange(data) {
  if (data && data.resolvedTheme) {
    state.theme = data.resolvedTheme;
    updateState({ theme: state.theme });
    updateThemeToggleUI();
    
    console.log(`🎨 Tema alterado para: ${state.theme}`);
    
    // Disparar evento global
    const event = new CustomEvent('appThemeChanged', { 
      detail: { theme: state.theme }
    });
    document.dispatchEvent(event);
  }
}

/**
 * Atualiza a UI do botão de alternar tema
 */
function updateThemeToggleUI() {
  if (!DOM.themeIcon || !state.theme) return;
  
  const isDark = state.theme === 'dark';
  const themeManager = window.gusThemeManager;
  
  if (themeManager) {
    DOM.themeIcon.textContent = themeManager.getThemeIcon();
  } else {
    DOM.themeIcon.textContent = isDark ? '🌙' : '☀️';
  }
  
  if (DOM.themeLabel) {
    DOM.themeLabel.textContent = isDark ? 'Escuro' : 'Claro';
  }
  
  if (DOM.themeToggle) {
    DOM.themeToggle.title = isDark 
      ? 'Tema Escuro (Clique para Tema Claro)' 
      : 'Tema Claro (Clique para Tema Escuro)';
  }
}

/**
 * Alterna o tema
 */
function toggleTheme() {
  if (window.gusThemeManager) {
    window.gusThemeManager.toggleTheme();
  } else {
    // Fallback manual
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', state.theme);
    localStorage.setItem(CONFIG.storageKeys.theme, state.theme);
    
    updateState({ theme: state.theme });
    updateThemeToggleUI();
    
    // Disparar evento
    const event = new CustomEvent('themeChanged', { 
      detail: { theme: state.theme }
    });
    document.dispatchEvent(event);
    
    console.log(`🎨 Tema alternado manualmente para: ${state.theme}`);
  }
}

// ============================================
// 7. SISTEMA DE LOADING
// ============================================

/**
 * Cria o overlay de loading
 */
function createLoadingOverlay() {
  if (document.getElementById('global-loading-overlay')) {
    DOM.loadingOverlay = document.getElementById('global-loading-overlay');
    DOM.loadingText = document.getElementById('global-loading-text');
    return;
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'global-loading-overlay';
  overlay.className = 'global-loading-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-live', 'polite');
  
  const content = document.createElement('div');
  content.className = 'loading-content';
  
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.setAttribute('aria-label', 'Carregando');
  
  const text = document.createElement('div');
  text.id = 'global-loading-text';
  text.className = 'loading-text';
  text.textContent = 'Processando...';
  
  content.appendChild(spinner);
  content.appendChild(text);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  // Adicionar estilos CSS
  const style = document.createElement('style');
  style.id = 'loading-styles';
  style.textContent = `
    .global-loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal, 9999);
      backdrop-filter: blur(4px);
    }
    
    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    
    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: var(--color-primary, #007bff);
      animation: spin 1s linear infinite;
    }
    
    .loading-text {
      color: white;
      margin-top: 20px;
      font-size: 16px;
      font-weight: 500;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(style);
  
  DOM.loadingOverlay = overlay;
  DOM.loadingText = text;
  
  console.log('🌀 Overlay de loading criado');
}

/**
 * Mostra o loading
 */
function showLoading(message = 'Processando...') {
  if (!DOM.loadingOverlay) {
    createLoadingOverlay();
  }
  
  state.isLoading = true;
  
  if (DOM.loadingText && message) {
    DOM.loadingText.textContent = message;
  }
  
  if (DOM.loadingOverlay) {
    DOM.loadingOverlay.style.display = 'flex';
    DOM.loadingOverlay.setAttribute('aria-hidden', 'false');
  }
  
  // Disparar evento
  const event = new CustomEvent('loadingStateChanged', { 
    detail: { isLoading: true, message }
  });
  document.dispatchEvent(event);
  
  console.log(`⏳ Loading: ${message}`);
}

/**
 * Esconde o loading
 */
function hideLoading() {
  state.isLoading = false;
  
  if (DOM.loadingOverlay) {
    DOM.loadingOverlay.style.display = 'none';
    DOM.loadingOverlay.setAttribute('aria-hidden', 'true');
  }
  
  // Disparar evento
  const event = new CustomEvent('loadingStateChanged', { 
    detail: { isLoading: false }
  });
  document.dispatchEvent(event);
  
  console.log('✅ Loading finalizado');
}

// ============================================
// 8. SISTEMA DE NOTIFICAÇÕES (TOASTS)
// ============================================

/**
 * Mostra uma notificação toast
 */
function showToast(message, type = 'info', duration = 5000) {
  if (!DOM.toastContainer) {
    console.warn('Container de toasts não encontrado');
    return null;
  }
  
  if (!message || typeof message !== 'string') {
    console.error('Mensagem de toast inválida:', message);
    return null;
  }
  
  const toastId = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const toast = document.createElement('div');
  
  toast.id = toastId;
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');
  toast.setAttribute('aria-label', `${type}: ${message}`);
  
  // Estilos inline como fallback
  toast.style.cssText = `
    background-color: ${getToastColor(type)};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    margin-bottom: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-width: 300px;
    max-width: 400px;
    word-break: break-word;
  `;
  
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Fechar notificação" 
            style="background: none; border: none; color: white; 
                   font-size: 20px; cursor: pointer; margin-left: 10px; 
                   opacity: 0.7; padding: 0 5px;">
      ×
    </button>
  `;
  
  DOM.toastContainer.appendChild(toast);
  
  // Animação de entrada
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  });
  
  // Fechar ao clicar
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    dismissToast(toast);
  });
  
  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }
  
  console.log(`💬 Toast [${type}]: ${message}`);
  return toastId;
}

/**
 * Retorna a cor do toast baseada no tipo
 */
function getToastColor(type) {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  return colors[type] || colors.info;
}

/**
 * Fecha um toast
 */
function dismissToast(toastElement) {
  if (!toastElement || !toastElement.parentNode) return;
  
  toastElement.style.transform = 'translateX(100%)';
  
  setTimeout(() => {
    if (toastElement.parentNode) {
      toastElement.parentNode.removeChild(toastElement);
    }
  }, 300);
}

// ============================================
// 9. EVENT LISTENERS
// ============================================

/**
 * Configura todos os event listeners
 */
function initEventListeners() {
  console.log('🔌 Configurando event listeners...');
  
  // Navegação via menu lateral
  DOM.menuLinks?.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      if (view) {
        switchView(view);
      }
    });
  });
  
  // Alternar tema
  if (DOM.themeToggle) {
    DOM.themeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
      
      // Feedback visual
      DOM.themeToggle.classList.add('animating');
      setTimeout(() => {
        DOM.themeToggle.classList.remove('animating');
      }, 300);
    });
  }
  
  // Atalhos de teclado
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Navegação por hash
  window.addEventListener('hashchange', handleHashChange);
  
  // Prevenir drag & drop padrão do navegador
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  // Botão Limpar Tudo (Merge)
  if (DOM.clearAllBtn) {
    DOM.clearAllBtn.addEventListener('click', () => {
      if (state.pdfs.length > 0) {
        if (confirm(`Remover todos os ${state.pdfs.length} arquivo(s)?`)) {
          clearPdfs();
          showToast('Todos os arquivos foram removidos', 'info', 3000);
        }
      }
    });
  }
  
  // Botão Limpar (Split)
  if (DOM.splitClearBtn) {
    DOM.splitClearBtn.addEventListener('click', () => {
      // Implementar lógica de limpar split
      showToast('Funcionalidade em desenvolvimento', 'info', 2000);
    });
  }
  
  console.log('✅ Event listeners configurados');
}

/**
 * Manipula atalhos de teclado
 */
function handleKeyboardShortcuts(e) {
  // Ignorar se estiver em input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  
  // Ctrl+M para Merge
  if (e.ctrlKey && e.key === 'm') {
    e.preventDefault();
    switchView('merge');
  }
  
  // Ctrl+S para Split
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    switchView('split');
  }
  
  // Ctrl+T para alternar tema
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    toggleTheme();
  }
  
  // Esc para limpar seleção/fechar modais
  if (e.key === 'Escape') {
    // Pode ser usado para fechar modais, toasts, etc.
    const activeModal = document.querySelector('.modal.show');
    if (activeModal) {
      activeModal.remove();
    }
  }
}

// ============================================
// 10. INICIALIZAÇÃO DA APLICAÇÃO
// ============================================

/**
 * Inicializa a aplicação
 */
function initApp() {
  console.log('🚀 Inicializando Gus Docs...');
  
  try {
    // 1. Cachear elementos DOM
    cacheDOMElements();
    
    // 2. Inicializar tema
    initTheme();
    
    // 3. Configurar event listeners
    initEventListeners();
    
    // 4. Verificar hash da URL
    handleHashChange();
    
    // 5. Criar overlay de loading
    createLoadingOverlay();
    
    // 6. Marcar como inicializado
    state.isInitialized = true;
    
    // 7. Disparar evento de inicialização
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('appReady', {
        detail: { 
          theme: state.theme,
          view: state.currentView,
          timestamp: new Date().toISOString()
        }
      }));
      
      console.log('✅ Gus Docs inicializado com sucesso!');
      console.log('📊 Estado inicial:', {
        theme: state.theme,
        view: state.currentView,
        pdfCount: state.pdfs.length
      });
      
      // Mostrar mensagem de boas-vindas
      showToast('Gus Docs está pronto! Arraste seus PDFs para começar.', 'success', 3000);
    }, 100);
    
  } catch (error) {
    console.error('❌ Erro crítico ao inicializar a aplicação:', error);
    showToast('Erro ao inicializar a aplicação', 'error', 5000);
  }
}

// ============================================
// 11. EXPORTS E INTERFACE PÚBLICA
// ============================================

// Export para módulos ES6
export {
  state,
  switchView,
  updateState,
  addPdf,
  removePdf,
  clearPdfs,
  updateFileStats,
  formatFileSize,
  toggleTheme,
  showLoading,
  hideLoading,
  showToast,
  dismissToast,
  initApp
};

// Interface global para outros módulos
window.app = {
  // Estado
  state,
  
  // Navegação
  switchView,
  
  // Gerenciamento de estado
  updateState,
  addPdf,
  removePdf,
  clearPdfs,
  updateFileStats,
  formatFileSize,
  
  // Tema
  toggleTheme,
  initTheme,
  updateThemeToggleUI,
  
  // UI
  showLoading,
  hideLoading,
  showToast,
  dismissToast,
  
  // Utilitários
  get themeManager() {
    return window.gusThemeManager || null;
  },
  
  // Informações
  get version() {
    return '1.0.0';
  },
  
  get isReady() {
    return state.isInitialized;
  }
};

// ============================================
// 12. INICIALIZAÇÃO AUTOMÁTICA
// ============================================

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM já carregado, inicializar imediatamente
  setTimeout(initApp, 0);
}

// ============================================
// 13. UTILITÁRIOS ADICIONAIS
// ============================================

/**
 * Valida um arquivo PDF
 */
export function validatePdfFile(file) {
  if (!file) return { valid: false, error: 'Arquivo inválido' };
  
  // Verificar tipo
  const isValidType = CONFIG.supportedFileTypes.some(type => 
    file.name.toLowerCase().endsWith(type.toLowerCase())
  );
  
  if (!isValidType) {
    return { 
      valid: false, 
      error: `Tipo de arquivo não suportado. Use: ${CONFIG.supportedFileTypes.join(', ')}` 
    };
  }
  
  // Verificar tamanho
  if (file.size > CONFIG.maxFileSize) {
    return { 
      valid: false, 
      error: `Arquivo muito grande (max: ${formatFileSize(CONFIG.maxFileSize)})` 
    };
  }
  
  return { valid: true, error: null };
}

/**
 * Extrai informações básicas de um arquivo
 */
export function extractFileInfo(file) {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    path: file.path || file.name
  };
}