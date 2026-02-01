import { Router } from './router.js';
import { StateManager } from './state-manager.js';
import { EventBus } from './event-bus.js';
import { ErrorBoundary } from './error-boundary.js';
import themeManager from '../services/theme-manager.js';
import { initUIRender, showToast } from '../services/ui-render.js';

class App {
  constructor() {
    this.router = new Router();
    this.stateManager = new StateManager();
    this.eventBus = new EventBus();
    this.errorBoundary = new ErrorBoundary();

    this.init();
  }

  init() {
    // Inicializa serviços
    this.initServices();

    // Inicializa router
    this.router.init();

    // Bind events
    this.bindEvents();

    console.log('🚀 DocHub inicializado');
  }

  initServices() {
    // Inicializa gerenciador de temas
    themeManager.init();

    // Inicializa sistema de UI
    initUIRender();

    // Configura botão de tema
    this.setupThemeToggle();
  }

  setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        themeManager.cycleTheme();
        showToast('Tema alterado', 'info', 1500);
      });
    }
  }

  bindEvents() {
    // Eventos globais da aplicação
    document.addEventListener('DOMContentLoaded', () => {
      this.onDomReady();
    });

    // Eventos de erro
    window.addEventListener('error', (e) => {
      this.errorBoundary.handleError(e.error);
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.errorBoundary.handleError(e.reason);
    });
  }

  bindSidebarNavigation() {
    console.log('🔗 Configurando navegação da sidebar...');

    // Manipula cliques nos links da sidebar
    const menuLinks = document.querySelectorAll('.menu-link');
    console.log('📋 Links encontrados:', menuLinks.length);

    menuLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        console.log('🎯 Link clicado:', link.getAttribute('href'));
        e.preventDefault();

        // Remove classe active de todos os links
        document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));

        // Adiciona classe active ao link clicado
        link.classList.add('active');

        // Navega para a view
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          const path = href.slice(1); // Remove o #
          console.log('📍 Navegando para:', path);
          window.location.hash = path;
          this.router.navigate(path);
        }
      });
    });

    console.log('✅ Navegação da sidebar configurada');
  }

  onDomReady() {
    // Aplicação totalmente carregada
    console.log('📄 DOM pronto');

    // Configura navegação da sidebar
    this.bindSidebarNavigation();

    // Remove loading se existir
    const loading = document.getElementById('app-loading');
    if (loading) {
      loading.style.display = 'none';
    }
  }
}

// Utilitários globais
window.showToast = showToast;
window.themeManager = themeManager;

new App();
