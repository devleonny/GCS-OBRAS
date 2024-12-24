function verificarPagamentos() {

  let mais_de_um = ""
  let plural = ""

  const listaPagamentos = JSON.parse(localStorage.getItem("lista_pagamentos"));
  const acesso = JSON.parse(localStorage.getItem("acesso"));

  if (!listaPagamentos || !acesso || !acesso.usuario) {
    console.log("Dados inválidos ou inexistentes no localStorage.");
    return;
  }

  const pagamentosExcluidos = Object.values(listaPagamentos).filter(pagamento =>
    pagamento.status === "Pagamento Excluído" && pagamento.criado === acesso.usuario
  );

  const pagamentosReprovados = Object.values(listaPagamentos).filter(pagamento =>
    pagamento.status === "Reprovado" && pagamento.criado === acesso.usuario
  );

  const popup = document.getElementById("popup");
  const popupMessage = document.getElementById("popup-message");

  let mensagem = "";

  if (pagamentosExcluidos.length > 1) {
    mais_de_um = "m"
    plural = "s"
  }

  if (pagamentosExcluidos.length > 0) {
    mensagem += `Existe${mais_de_um} ${pagamentosExcluidos.length} pagamento${plural} excluído${plural}. `;
  }

  mais_de_um = ""
  plural = ""

  if (pagamentosReprovados.length > 1) {
    mais_de_um = "m"
    plural = "s"
  }

  if (pagamentosReprovados.length > 0) {
    mensagem += `Existe${mais_de_um} ${pagamentosReprovados.length} pagamento${plural} reprovado${plural}. `;
  }

  if (mensagem) {
    popupMessage.textContent = mensagem.trim();
    popup.style.display = "block";
  }
}

function closePopup() {

  document.getElementById("popup").style.display = "none";

}

verificarPagamentos();

const { ipcRenderer } = require('electron');

ipcRenderer.on('update-available', () => {
  document.getElementById('painel_geral').style.display = 'none';
  document.getElementById('progress-container').style.display = 'block';
});

ipcRenderer.on('download-progress', (event, percent) => {
  const progress = document.getElementById('progress');
  progress.style.width = `${percent}%`;
  progress.textContent = `${percent}%`;
});

ipcRenderer.on('update-downloaded', () => {
  ipcRenderer.send('install-update');
});