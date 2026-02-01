export class SettingsView {
  render() {
    const view = document.getElementById('router-view');
    view.innerHTML = `
      <div class="settings">
        <h2>Configurações</h2>
        <p>Configurações aqui.</p>
      </div>
    `;
  }

  destroy() {
    // Cleanup
  }
}
