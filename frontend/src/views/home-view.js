export class HomeView {
  render() {
    const view = document.getElementById('router-view');
    view.innerHTML = `
      <div class="home">
        <h2>Bem-vindo ao DocHub</h2>
        <p>Escolha uma operação:</p>
        <a href="#/merge">Mesclar PDFs</a>
        <a href="#/split">Dividir PDF</a>
        <a href="#/settings">Configurações</a>
      </div>
    `;
  }

  destroy() {
    // Cleanup
  }
}
