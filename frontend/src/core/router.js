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
    this.navigate('/');
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  handleHashChange() {
    const hash = window.location.hash.slice(1) || '/';
    this.navigate(hash);
  }

  navigate(path) {
    const ViewClass = this.routes[path];
    if (ViewClass) {
      if (this.currentView) {
        this.currentView.destroy();
      }
      this.currentView = new ViewClass();
      this.currentView.render();
    }
  }
}
