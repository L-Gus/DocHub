import { HomeView } from '../views/home-view.js';
import { MergeView } from '../views/merge-view.js';
import { SplitView } from '../views/split-view.js';
import { SettingsView } from '../views/settings-view.js';

export class Router {
  constructor() {
    this.routes = {
      '/': HomeView,
      '/merge': MergeView,
      '/split': SplitView,
      '/settings': SettingsView,
    };
    this.currentView = null;
  }

  init() {
    console.log('🚀 Inicializando router...');
    this.navigate('/');
    window.addEventListener('hashchange', () => {
      console.log('📍 Hash mudou para:', window.location.hash);
      this.handleHashChange();
    });
    console.log('✅ Router inicializado');
  }

  handleHashChange() {
    const hash = window.location.hash.slice(1) || '/';
    this.navigate(hash);
  }

  navigate(path) {
    console.log('🔄 Navegando para:', path);
    const ViewClass = this.routes[path];
    if (ViewClass) {
      try {
        if (this.currentView && typeof this.currentView.destroy === 'function') {
          this.currentView.destroy();
        }
        console.log('📦 Criando view:', ViewClass.name);
        this.currentView = new ViewClass();
        if (typeof this.currentView.render === 'function') {
          this.currentView.render();
          console.log('✅ View renderizada:', ViewClass.name);
        } else {
          console.error('❌ View não tem método render:', ViewClass.name);
        }
      } catch (error) {
        console.error('❌ Erro ao navegar para', path, ':', error);
      }
    } else {
      console.warn('⚠️ Rota não encontrada:', path);
    }
  }
}
