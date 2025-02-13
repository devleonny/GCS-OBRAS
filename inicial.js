async function verificarPagamentos() {

  let mais_de_um = ""
  let plural = ""

  const listaPagamentos = await recuperarDados('lista_pagamentos') || {};
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

function aparecerPopupResumoOrcamentos() {
  const popupResumoOrcamentos = `

    <div id="popupResumoOrcamentos" style="
      position: fixed;
      bottom: 180px; /* Mesmo alinhamento do primeiro pop-up */
      right: 20px;
      background-color: #fff;
      padding: 20px;
      border: 1px solid #ccc;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      border-radius: 5px;
      z-index: 1000;
      width: 20vw;
      font-family: Arial, sans-serif;
      font-size: 1.1vw;
      color: #333;
    ">

    <button onclick="fecharPopUps(this.parentNode.id)" style="
      position: absolute;
      top: 0px;
      right: 0px;
      font-size: 20px;
      font-weight: bold;
      color: #999;
      cursor: pointer;
      background: none;
      border: none;
    ">×</button>
          
    <div onclick="resumo_orcamentos()" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
      <img src="gifs/atencao.gif" style="width: 50px;">
      <p style="font-size: 0.8vw; margin: 0;">ORÇAMENTOS POR ANALISTA</p>
    </div>
            
  </div>
  `;

  document.body.innerHTML += popupResumoOrcamentos;
}

function aparecerPopupAprovadosGerencia() {

  const acesso = JSON.parse(localStorage.getItem("acesso"));

  if (acesso.permissao == "adm" || acesso.permissao == "gerente") {

    const popupAprovadosGerencia = `

      <div id="popupAprovadosGerencia" style="
            position: fixed;
            bottom: 300px; /* Mesmo alinhamento do primeiro pop-up */
            right: 20px;
            background-color: #fff;
            padding: 20px;
            border: 1px solid #ccc;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            border-radius: 5px;
            z-index: 1000;
            width: 20vw;
            font-family: Arial, sans-serif;
            font-size: 1.1vw;
            color: #333;
        ">

        <button onclick="fecharPopUps(this.parentNode.id)" style="
                position: absolute;
                top: 0px;
                right: 0px;
                font-size: 20px;
                font-weight: bold;
                color: #999;
                cursor: pointer;
                background: none;
                border: none;
            ">×</button>

        <div onclick="navegarParaOrcamentos('gerente')" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <img src="gifs/atencao.gif" style="width: 50px;">
            <p style="font-size: 0.8vw;">APROVAÇÃO DO GERENTE</p>
        </div>
      </div>
    `

    document.body.innerHTML += popupAprovadosGerencia;

  }

}

function aparecerPopupAprovadosDiretoria() {

  const acesso = JSON.parse(localStorage.getItem("acesso"));

  if (acesso.permissao == "adm" || acesso.permissao == "diretoria") {

    const popupAprovadosDiretoria = `

      <div id="popupAprovadosDiretoria" style="
            position: fixed;
            bottom: 420px; /* Mesmo alinhamento do primeiro pop-up */
            right: 20px;
            background-color: #fff;
            padding: 20px;
            border: 1px solid #ccc;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            border-radius: 5px;
            z-index: 1000;
            width: 20vw;
            font-family: Arial, sans-serif;
            font-size: 1.1vw;
            color: #333;
        ">

        <button onclick="fecharPopUps(this.parentNode.id)" style="
                position: absolute;
                top: 0px;
                right: 0px;
                font-size: 20px;
                font-weight: bold;
                color: #999;
                cursor: pointer;
                background: none;
                border: none;
            ">×</button>

  
                    <div onclick="navegarParaOrcamentos('diretoria')" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <img src="gifs/atencao.gif" style="width: 50px;">
                        <p style="font-size: 0.8vw;">APROVAÇÃO DA DIRETORIA</p>
                    </div>
                    `

    document.body.innerHTML += popupAprovadosDiretoria

  }

}

function navegarParaOrcamentos(tipo) {
  localStorage.setItem("ativarPendencias", tipo); // Armazena "gerente" ou "diretoria"
  window.location.href = "orcamentos.html"; // Redireciona para a página
}

function fecharPopUps(id) {
  document.getElementById(`${id}`).remove();
}

// Chamada da função para exibir o pop-up secundário
aparecerPopupResumoOrcamentos();

aparecerPopupAprovadosGerencia()

aparecerPopupAprovadosDiretoria()

verificarPagamentos();

async function resumo_orcamentos() {
  let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
  let setores = JSON.parse(localStorage.getItem('dados_setores')) || {};
  let setores_por_nome = {};

  Object.keys(setores).forEach(id => {
    setores_por_nome[setores[id].nome] = setores[id];
  });

  let orcamentos_por_usuario = {};
  delete dados_orcamentos['id'];

  for (let id in dados_orcamentos) {
    let orcamento = dados_orcamentos[id];
    let analista = orcamento.dados_orcam.analista;

    if (!orcamentos_por_usuario[analista]) {
      orcamentos_por_usuario[analista] = {};
    }

    orcamentos_por_usuario[analista][id] = orcamento;
  }

  let linhas = '';

  for (let pessoa in orcamentos_por_usuario) {
    let orcamentos = orcamentos_por_usuario[pessoa];
    let contadores = {
      aprovados: 0,
      reprovados: 0,
      pendentes: 0,
      total: 0
    };

    for (let id in orcamentos) {
      let orc = orcamentos[id];

      if (orc.status) {
        let pedidos = orc.status;
        for (let ped in pedidos) {
          let pedido = pedidos[ped];
          if (String(pedido.pedido).includes('?')) {
            contadores.pendentes += 1;
          } else {
            contadores.aprovados += 1;
          }
          contadores.total += 1;
        }
      } else {
        contadores.total += 1;
      }

      if (orc.aprovacao && Object.keys(orc.aprovacao).length > 0) {
        let responsaveis = orc.aprovacao;
        let valor = conversor(orc.total_geral);
        let gerente = false;
        let diretoria = false;

        if (responsaveis.Gerente && responsaveis.Gerente.status) {
          gerente = responsaveis.Gerente.status === 'aprovado';
        }

        if (responsaveis.Diretoria && responsaveis.Diretoria.status) {
          diretoria = responsaveis.Diretoria.status === 'aprovado';
        }

        if (valor > 21000) {
          if (diretoria) {
            contadores.aprovados += 1;
          } else if (gerente) {
            contadores.pendentes += 1;
          } else {
            contadores.reprovados += 1;
          }
        } else {
          gerente ? contadores.aprovados += 1 : contadores.reprovados += 1;
        }
      }
    }

    // Corrigindo o cálculo de pendentes:
    contadores.pendentes = contadores.total - (contadores.aprovados + contadores.reprovados);

    let porc = {
      apr: ((contadores.aprovados / contadores.total) * 100 || 0).toFixed(0),
      rep: ((contadores.reprovados / contadores.total) * 100 || 0).toFixed(0),
      pen: ((contadores.pendentes / contadores.total) * 100 || 0).toFixed(0)
    };

    function div_porc(porc, cor) {
      return `
              <div style="width: 100px; background-color: #dfdfdf; display: flex; align-items: center; justify-content: start; border-radius: 3px;">
                  <div style="width: ${porc}%; background-color: ${cor}; text-align: center; border-radius: 3px;">
                      <label style="color: black; margin-left: 3px;">${porc}%</label>
                  <div>
              </div>
          `;
    }

    linhas += `
          <tr style="background-color: white; color: #222;">
              <td>${pessoa}</td>
              <td>${setores_por_nome[pessoa]?.setor || '--'}</td>
              <td style="text-align: center;">${contadores.total}</td>
              <td>
                  <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                      <label>${contadores.aprovados}</label>
                      ${div_porc(porc.apr, '#4CAF50')}
                  </div>
              </td>
              <td>
                  <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                      <label>${contadores.reprovados}</label>
                      ${div_porc(porc.rep, 'red')}
                  </div>
              </td>
              <td>
                  <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                      <label>${contadores.pendentes}</label>
                      ${div_porc(porc.pen, 'orange')}
                  </div>
              </td>
          </tr>
      `;
  }

  let colunas = ['Analista', 'Setor', 'Total', 'Aprovados', 'Reprovados', 'Pendentes'];
  let ths = colunas.map(col => `<th>${col}</th>`).join('');

  let acumulado = `
      <img src="imagens/BG.png" style="height: 70px; position: absolute; top: 3px; left: 3px;">
      <label>Relatório de orçamentos por Pessoa</label>
      <div>
          <table class="tabela" style="table-layout: auto;">
              <thead>
                  <tr>${ths}</tr>
              </thead>
              <tbody>
                  ${linhas}
              </tbody>
          </table>
      </div>
  `;

  openPopup_v2(acumulado);
}

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