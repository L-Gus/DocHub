// frontend/scripts/app.js
/**
 * Gus Docs - Gerenciador de Estado e Router Principal
 * Implementação do padrão "Frontend Burro"
 * Núcleo de orquestração que delega processamento pesado ao Rust
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
// 2. ESTADO GLOBAL (FONTE DA VERDADE)
// ============================================
const state = {
  // Navegação
  currentView: 'merge',
  previousView: null,
  
  // Dados dos PDFs
  pdfs: [], // Array de objetos PDF: {id, file, name, size, pages, status}
  
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
    sortBy: 'name', // 'name', 'date', 'size'
    autoNaming: true,
    preserveOrder: true
  },
  splitSettings: {
    pageRanges: '',
    outputFormat: 'separate', // 'separate', 'ranges', 'every'
    namingPattern: '[name]_p[pages]'
  }
};

// ============================================
// 3. ELEMENTOS DOM (CACHEADOS APÓS DOM READY)
// ============================================
let DOM = {};

/**
 * Cacheia elementos DOM essenciais
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
      
      // Navegação
      menuLinks: document.querySelectorAll('.menu-link'),
      themeToggle: document.getElementById('theme-toggle'),
      themeIcon: document.getElementById('theme-icon'),
      themeLabel: document.getElementById('theme-label'),
      
      // Loading overlay
      loadingOverlay: null,
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
      executeSplitBtn: document.getElementById('execute-split-btn')
    };
    
    console.log('✅ Elementos DOM cacheados');
  } catch (error) {
    console.error('❌ Erro ao cachear elementos DOM:', error);
  }
}

// ============================================
// 4. GERENCIAMENTO DE ESTADO
// ============================================

/**
 * Atualiza o estado global (dispara evento obrigatório)
 * @param {Object} newState - Novos valores para o estado
 * @returns {Object} - Estado atualizado
 */
function updateState(newState) {
  const oldState = { ...state };
  Object.assign(state, newState);
  
  // Disparar evento obrigatório de estado atualizado
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

// ============================================
// 5. ROTEAMENTO SPA E NAVEGAÇÃO
// ============================================

/**
 * Alterna entre as views da aplicação (SPA-like)
 * @param {string} view - Nome da view ('merge' ou 'split')
 * @returns {boolean} - Sucesso da operação
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
  const previousView = state.currentView;
  updateState({ 
    currentView: view, 
    previousView: previousView 
  });
  
  // Atualizar navegação
  updateNavigation(view);
  
  // Mostrar/ocultar views
  toggleViewsVisibility(view);
  
  // Atualizar título da página
  updatePageTitle(view);
  
  // Atualizar URL hash
  updateUrlHash(view);
  
  // Disparar evento de mudança de view
  dispatchViewChangedEvent(view, previousView);
  
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
function dispatchViewChangedEvent(view, previousView) {
  const event = new CustomEvent('viewChanged', { 
    detail: { 
      view,
      previousView,
      timestamp: new Date().toISOString()
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
// 6. GERENCIAMENTO DE ARQUIVOS E VALIDAÇÃO
// ============================================

/**
 * Valida um arquivo PDF
 * @param {File} file - Objeto File do input/drag-and-drop
 * @returns {Object} - {valid: boolean, error: string|null}
 */
function validatePdfFile(file) {
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
 * @param {File} file - Objeto File
 * @returns {Object} - Informações do arquivo
 */
function extractFileInfo(file) {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    path: file.path || file.name
  };
}

/**
 * Adiciona um PDF ao estado global
 * @param {Object} pdf - Objeto PDF
 * @returns {string|null} - ID do PDF ou null em caso de erro
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
  pdf.status = 'pending'; // pending, processing, ready, error
  
  const newPdfs = [...state.pdfs, pdf];
  updateState({ pdfs: newPdfs });
  
  // Atualizar estatísticas
  updateFileStats();
  
  console.log(`📄 PDF adicionado: ${pdf.name} (ID: ${pdf.id})`);
  return pdf.id;
}

/**
 * Remove um PDF do estado
 * @param {string} pdfId - ID do PDF
 * @returns {boolean} - Sucesso da operação
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
 * @returns {number} - Quantidade de PDFs removidos
 */
function clearPdfs() {
  if (state.pdfs.length === 0) return 0;
  
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
// 7. INTEGRAÇÃO COM MÓDULOS (ECOSSISTEMA)
// ============================================

/**
 * Inicializa a integração com módulos externos
 */
function initModulesIntegration() {
  console.log('🧩 Inicializando integração com módulos...');
  
  // 1. ThemeManager
  if (window.gusThemeManager) {
    console.log('🎨 Inicializando ThemeManager...');
    window.gusThemeManager.init();
    updateState({ theme: window.gusThemeManager.resolvedTheme });
    document.body.setAttribute('data-theme', state.theme);
  } else {
    console.warn('⚠️ ThemeManager não disponível, usando fallback');
    initThemeFallback();
  }
  
  // 2. UIRender
  if (window.uiRender) {
    console.log('🎭 Inicializando UIRender...');
    window.uiRender.init();
  } else {
    console.warn('⚠️ UIRender não disponível');
  }
  
  // 3. Configurar listeners para carregamento lazy das views
  document.addEventListener('viewChanged', handleViewChangedForLazyLoading);
}

/**
 * Fallback para tema (se ThemeManager não estiver disponível)
 */
function initThemeFallback() {
  try {
    const savedTheme = localStorage.getItem(CONFIG.storageKeys.theme);
    if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light')) {
      updateState({ theme: savedTheme });
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      updateState({ theme: prefersDark ? 'dark' : 'light' });
    }
    
    document.body.setAttribute('data-theme', state.theme);
    localStorage.setItem(CONFIG.storageKeys.theme, state.theme);
  } catch (error) {
    console.error('❌ Erro no fallback de tema:', error);
    updateState({ theme: CONFIG.defaultTheme });
    document.body.setAttribute('data-theme', CONFIG.defaultTheme);
  }
}

/**
 * Manipula mudanças de view para carregamento lazy
 */
function handleViewChangedForLazyLoading(event) {
  const view = event.detail.view;
  
  console.log(`📦 Verificando carregamento lazy para view: ${view}`);
  
  // Aqui você pode implementar carregamento dinâmico de módulos
  // Exemplo com dynamic imports (ES6 modules):
  /*
  if (view === 'merge' && !window.mergeViewLoaded) {
    import('./view_merge.js')
      .then(module => {
        window.mergeViewLoaded = true;
        module.init();
      })
      .catch(error => console.error('Erro ao carregar merge view:', error));
  }
  */
}

// ============================================
// 8. SISTEMA GLOBAL DE FEEDBACK
// ============================================

/**
 * Mostra overlay de loading global
 * @param {string} message - Mensagem opcional
 */
function showLoading(message = 'Processando...') {
  updateState({ isLoading: true });
  
  if (!DOM.loadingOverlay) {
    createLoadingOverlay();
  }
  
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
 * Esconde overlay de loading
 */
function hideLoading() {
  updateState({ isLoading: false });
  
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

/**
 * Cria o overlay de loading se não existir
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
  
  // Adicionar estilos CSS mínimos
  const style = document.createElement('style');
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
      z-index: 9999;
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
 * Mostra uma notificação toast
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duração em ms (0 = sem auto-dismiss)
 * @returns {string} - ID do toast
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

// ============================================
// 9. LISTENERS GLOBAIS E UX
// ============================================

/**
 * Configura todos os event listeners globais
 */
function initEventListeners() {
  console.log('🔌 Configurando event listeners...');
  
  // 1. Navegação via menu lateral
  DOM.menuLinks?.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      if (view) {
        switchView(view);
      }
    });
  });
  
  // 2. Alternar tema
  if (DOM.themeToggle) {
    DOM.themeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  }
  
  // 3. Atalhos de teclado
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // 4. Navegação por hash
  window.addEventListener('hashchange', handleHashChange);
  
  // 5. Prevenção padrão de drag & drop
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  // 6. Botão Limpar Tudo (Merge)
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
    showToast('Alternado para Unir PDFs', 'info', 1000);
  }
  
  // Ctrl+S para Split
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    switchView('split');
    showToast('Alternado para Dividir PDF', 'info', 1000);
  }
  
  // Ctrl+T para alternar tema
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    toggleTheme();
  }
  
  // Esc para limpar seleção/fechar modais
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal.show');
    if (activeModal) {
      activeModal.remove();
      showToast('Modal fechado', 'info', 1000);
    }
    
    // Fechar todos os toasts
    const toasts = document.querySelectorAll('.toast');
    toasts.forEach(toast => dismissToast(toast));
  }
}

/**
 * Alterna o tema
 */
function toggleTheme() {
  if (window.gusThemeManager) {
    window.gusThemeManager.toggleTheme();
    updateState({ theme: window.gusThemeManager.resolvedTheme });
  } else {
    // Fallback manual
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    updateState({ theme: newTheme });
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem(CONFIG.storageKeys.theme, newTheme);
    
    // Disparar evento
    const event = new CustomEvent('themeChanged', { 
      detail: { theme: newTheme }
    });
    document.dispatchEvent(event);
    
    showToast(`Tema alterado para ${newTheme === 'dark' ? 'Escuro' : 'Claro'}`, 'info', 2000);
  }
  
  console.log(`🎨 Tema alternado para: ${state.theme}`);
}

// ============================================
// 10. INICIALIZAÇÃO (BOOTSTRAPPING)
// ============================================

/**
 * Inicializa a aplicação
 */
function initApp() {
  console.log('🚀 Inicializando Gus Docs...');
  
  try {
    // 1. Cachear elementos essenciais do DOM
    cacheDOMElements();
    
    // 2. Inicializar integração com módulos
    initModulesIntegration();
    
    // 3. Configurar event listeners
    initEventListeners();
    
    // 4. Verificar hash da URL para carregar aba correta
    handleHashChange();
    
    // 5. Marcar como inicializado
    updateState({ isInitialized: true });
    
    // 6. Disparar evento de inicialização
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
        pdfCount: state.pdfs.length,
        isReady: state.isInitialized
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
  validatePdfFile,
  extractFileInfo,
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
  
  // Validação
  validatePdfFile,
  extractFileInfo,
  formatFileSize,
  
  // Tema
  toggleTheme,
  
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
 * Função utilitária para debounce
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Função utilitária para throttle
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}