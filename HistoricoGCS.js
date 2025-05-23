document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const tipo = tab.dataset.tab;
    carregarRegistros(tipo);
  });
});

async function carregarRegistros(tipo) {
  const registros = await recuperarDados('registrosAlteracoes') || [];

  const filtrados = registros.filter(reg => {
    if (tipo === 'todos') return true;
    if (tipo === 'orcamentos') return reg.tipo === 'dados_orcamentos';
    if (tipo === 'composicoes') return reg.tipo === 'dados_composicoes';
  });

  const corpo = document.getElementById('tabela-corpo');
  corpo.innerHTML = '';

  filtrados.forEach(reg => {
    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${reg.data}</td>
      <td>${reg.usuario}</td>
      <td>${reg.tipo}</td>
      <td>${reg.codigo}</td>
      <td>${reg.comentario}</td>
    `;
    corpo.appendChild(linha);
  });
}

// Inicializa com todos os registros
carregarRegistros('todos');