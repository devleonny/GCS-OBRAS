
async function telaChecklist(idOrcamento = 'ORCA_1faf8f5a-7413-40ac-98d7-11d3d015489f') {

  try {

    overlayAguarde()

    const {
      dados_orcam,
      dados_composicoes,
      snapshots
    } = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    const { contrato } = dados_orcam || {}
    const { cliente } = snapshots || {}

    const pag1 = 'checklist'
    const tabela1 = await modTab({
      id: idOrcamento,
      dados_composicoes,
      pag: pag1,
      body: pag1,
      base: 'vw_checklist',
      funcaoAdicional: ['atualizarAndamentoChecklist', 'graficoDiario'],
      explode: {
        path: 'checklist'
      },
      filtros: {
        'id': { op: '=', value: idOrcamento },
        'checklist.*.filtro': { op: '!=', value: null }
      },
      criarLinha: 'criarLinhaChecklist',
      colunas: {
        'Código': { chave: 'checklist.*.codigo' },
        'Descrição': { chave: 'checklist.*.descricao' },
        'Unidade': { chave: 'checklist.*.unidade' },
        'Quantidade': { chave: 'checklist.*.qtde' },
        'Realizado': {},
        'Andamento': {},
        'Registrar': {}
      },
    })

    // TABELA 2
    const pag2 = 'detalhamento_checklist'
    const tabela2 = await modTab({
      dados_composicoes,
      pag: pag2,
      body: pag2,
      base: 'vw_checklist',
      filtros: {
        id: { op: '=', value: idOrcamento }
      },
      explode: {
        path: 'detalhamento'
      },
      criarLinha: 'criarLinhaDetalhada',
      colunas: {
        'Código': { chave: 'detalhamento.*.codigo_item', op: '=' },
        'Descrição': { chave: 'detalhamento.*.descricao' },
        'Rack': { chave: 'detalhamento.*.rack' },
        'Local': { chave: 'detalhamento.*.local' },
        'Equipamento': { chave: 'detalhamento.*.descricao_item' },
        'Realizado': {},
        'Data': { chave: 'detalhamento.*.data', tipoPesquisa: 'data' },
        'Observação': { chave: 'detalhamento.*.observacao' }
      },
    })

    tela.innerHTML = `
        <div class="painel-geral-checklist">

            <div style="${horizontal}; gap: 1rem;">
              <span class="tag-pendencias">${contrato}</span>
              <span class="titulo-1">${cliente}</span>
            </div>

            <div style="display: flex; flex-direction: row; gap: 5px;">

                <div id="indicadorGeral" class="checklist-painel"></div>

                <div class="checklist-painel">
                    <div id="graficoDiario"></div>
                </div>

            </div>

            <div style="display: flex; flex-direction: row; gap: 1rem;">

              <div class="checklist-tabelas">
                <span class="titulo-2">Itens do Orçamento <b>***Apenas Instalação & Configuração</b></span>
                ${tabela1}
              </div>  

              <div class="checklist-tabelas">
                <span class="titulo-2">Detalhamento Por Dia</span>
                ${tabela2}
              </div> 

            </div>

        </div>
    `
    await paginacao()

    removerTodosPopups()

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao abrir o checklist: Fale com o suporte.' })
  }

}

function criarLinhaDetalhada(registro) {

  const {
    codigo_item,
    data,
    ip,
    rack,
    local,
    descricao,
    observacao,
    descricao_item,
    codigo,
    realizado
  } = registro || {}

  return `
    <tr>
      <td>${codigo_item}</td>
      <td>${descricao || ''}</td>
      <td>${rack || ''}</td>
      <td>${local || ''}</td>
      <td>${descricao_item}</td>
      <td style="text-align: center;">
        <img src="imagens/${realizado ? 'concluido' : 'cancel'}.png">
      </td>
      <td>${dtFormatada(data)}</td>
      <td>${observacao || ''}</td>
    </tr>
  `
}

async function atualizarAndamentoChecklist() {

  const painel = document.querySelector('#indicadorGeral')

  const { id } = controles.checklist
  const {
    checklist_mao_obra,
    andamento,
    total_dias,
    previsao_dias,
    data_inicial,
    data_final
  } = await recuperarDado('vw_checklist', id)

  const andamentosExtras = (checklist_mao_obra || [])
    .map(({ codigo, descricao }) => {
      return `
        <div style="${vertical}; gap: 5px;">
          ${criarVelocimetroHTML({ rotulo: '%', valor: 15 })}
          <div style="${horizontal}; gap: 0.5rem;">
            <img src="imagens/pesquisar2.png" onclick="registrarChecklist('${codigo}')">
            <span>${descricao}</span>
          </div>
        </div>
        `
    })
    .join('')

  const andamentoGeral = criarVelocimetroHTML({ rotulo: 'Instalação', valor: andamento })

  const modelo = ({ titulo, valor, funcao }) => `
    <div ${funcao ? `onclick="${funcao}"` : ''} class="checklist-indicador">
      ${valor ? valor : ''}
      <span>${titulo}</span>
    </div>
  `

  const esquema = [
    {
      titulo: 'Dias Trabalhados',
      valor: total_dias,
    },
    {
      titulo: 'Previsão Conclusão',
      valor: previsao_dias,
    },
    {
      titulo: 'Começo da Obra',
      valor: data_inicial,
    },
    {
      titulo: 'Última Atividade',
      valor: data_final,
    },
    {
      titulo: 'Ver Opções',
      funcao: `abrirAtalhos('${id}')`,
    }
  ]

  const etiquetas = esquema
    .map(e => modelo(e))
    .join('')

  painel.innerHTML = `
    <div style="display: flex; flex-direction: row; gap: 1rem;">
      <div style="${vertical}; min-width: 300px;">
        ${andamentoGeral}
        ${andamentosExtras}
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 5px;">${etiquetas}</div>
    </div>
    `

}

async function criarLinhaChecklist(item) {

  const {
    codigo,
    descricao,
    unidade,
    qtde,
    realizado,
  } = item

  const andamento = Number(((realizado / qtde) * 100).toFixed(0))

  return `
        <tr>
            <td>${codigo}</td>
            <td>${descricao}</td>
            <td>${unidade}</td>
            <td>${qtde}</td>
            <td>${realizado || 0}</td>
            <td>
                ${divPorcentagem(andamento)}
            </td>
            <td style="text-align: center;">
                <img src="imagens/lapis.png" onclick="registrarChecklist('${codigo}')">
            </td>
        </tr>
    `

}

async function registrarChecklist(codigo) {

  try {
    overlayAguarde()

    const hoje = new Date().toISOString().slice(0, 10)

    const { id, dados_composicoes } = controles.checklist
    const { qtde, descricao, imagem, unidade } = dados_composicoes?.[codigo] || {}
    const { detalhamento, mao_obra } = await recuperarDado('checklist', `${codigo}_${id}`) || {}
    let ths = []
    let linhas = []
    const fixo = 'style="min-width: 100px" contentEditable="true"'
    const ehMaoObra = descricao.includes('MÃO DE OBRA')

    if (ehMaoObra) {

      ths = [
        'UNIDADE',
        'QUANTIDADE',
        `
            <div style="${horizontal}; gap: 5px;">
              <input oninput="preencherDemais(this, 'data')" type="date">
              <span>DATA</span>
            </div>
          `,
        'OBSERVAÇÃO'
      ].map(th => `<th>${th}</th>`).join('')

      linhas = (mao_obra || [])
        .map(({ data, quantidade, observacao }, i) => {

          return `
            <tr>
              <td name="quantidade" ${fixo}>${quantidade || 0}</td>
              <td>${unidade || 'UN'}</td>
              <td>
                <input type="date" name="data" value="${data || ''}">
              </td>
              <td ${fixo} name="observacao">${observacao || ''}</td>
            </tr>
          `
        })

    } else {

      for (let i = 0; i < qtde; i++) {

        const {
          descricao,
          rack,
          local,
          pilar,
          setor,
          ip,
          realizado,
          data,
          observacao
        } = detalhamento?.[i] || {}

        linhas.push(`
            <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td ${fixo} name="descricao">${descricao || ''}</td>
                <td ${fixo} name="rack">${rack || ''}</td>
                <td ${fixo} name="local">${local || ''}</td>
                <td ${fixo} name="pilar">${pilar || ''}</td>
                <td ${fixo} name="setor">${setor || ''}</td>
                <td ${fixo} name="ip">${ip || ''}</td>
                <td style="text-align: center;">
                    <input ${realizado ? 'checked' : ''} name="realizado" style="width: 2rem; height: 2rem;" type="checkbox">
                </td>
                <td><input type="date" name="data" value="${data || ''}"></td>
                <td ${fixo} name="observacao">${observacao || ''}</td>
            </tr>
            `)
      }

      ths = [
        'ORDEM',
        'DESCRIÇÃO',
        'RACK',
        'LOCAL',
        'PILAR',
        'SETOR',
        'IP',
        ` 
            <div style="${horizontal}; gap: 5px;">
              <input oninput="preencherDemais(this, 'realizado')"  style="width: 2rem; height: 2rem;" type="checkbox">
              <span>REALIZADO</span>
            </div>
            `,
        `
            <div style="${horizontal}; gap: 5px;">
              <input oninput="preencherDemais(this, 'data')" type="date">
              <span>DATA</span>
            </div>
          `,
        'OBSERVAÇÃO'
      ].map(th => `<th>${th}</th>`).join('')

    }

    // TABELA GENÉRICA;
    const tabela = `
        <div style="padding: 0.5rem;">
            <div style="${horizontal}; justify-content: start; gap: 1rem; padding: 5px;">
                <img src="${imagem || logo}" style="width: 5rem; border-radius: 5px;">
                <span class="titulo-2">${descricao}</span>
            </div>
            <table class="tabela">
                <thead>
                    ${ths}
                </thead>
                <tbody id="checklistAtivo">
                    ${linhas.join('')}
                </tbody>
            </table>
        </div>
        `

    const botoes = [
      {
        texto: 'Salvar',
        funcao: ehMaoObra
          ? `salvarRegistroMO('${codigo}')`
          : `salvarRegistroChecklist('${codigo}')`,
        img: 'concluido'
      }
    ]

    if (ehMaoObra)
      botoes.push({
        texto: 'Adicionar Linha',
        funcao: `adicionarLinhaChecklistMO('${unidade}')`,
        img: 'baixar'
      })

    popup({
      cor: 'white',
      titulo: 'Registrar Andamento',
      elemento: tabela,
      botoes
    })

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao abrir o item: Fale com o suporte.' })
  }

}


function adicionarLinhaChecklistMO(unidade) {

  const fixo = 'style="min-width: 100px" contentEditable="true"'

  document.getElementById('checklistAtivo').insertAdjacentHTML('beforeend', `
      <tr>
        <td>${unidade || 'UN'}</td>
        <td name="quantidade" ${fixo}></td>
        <td>
          <input type="date" name="data">
        </td>
        <td ${fixo} name="observacao"></td>
      </tr>
    `)

}

function preencherDemais(input, campo) {

  [...document.querySelectorAll(`[name="${campo}"]`)].forEach(e => {

    if (campo == 'data')
      e.value = input.value

    if (campo == 'realizado')
      e.checked = input.checked

  })

}

async function salvarRegistroMO(codigo) {

  try {

    overlayAguarde()

    const idOrcamento = controles?.checklist?.id

    if (!idOrcamento)
      return popup({ mensagem: 'Falha ao localizar o orçamento: Fale com o suporte.' })

    const idLancamento = `${codigo}_${idOrcamento}`

    const mao_obra = [...document.querySelectorAll('#checklistAtivo tr')]
      .map(tr => {

        const elemento = (n) => {
          const e = tr.querySelector(`[name="${n}"]`)
          return n == 'realizado' ? e?.checked : e?.value || e?.textContent
        }

        return {
          quantidade: Number(elemento('quantidade') || 0),
          data: elemento('data'),
          observacao: elemento('observacao')
        }

      })

    await enviar(`checklist/${idLancamento}`, {
      codigo,
      id_orcamento: idOrcamento,
      mao_obra
    })

    removerTodosPopups()

  } catch (err) {
    console.log(err)
    popup({ mensagem: 'Falha ao registrar a quantidade: Fale com o suporte.' })
  }

}

async function salvarRegistroChecklist(codigo) {

  try {

    overlayAguarde()

    const idOrcamento = controles?.checklist?.id

    if (!idOrcamento)
      return popup({ mensagem: 'Falha ao localizar o orçamento: Fale com o suporte.' })

    const idLancamento = `${codigo}_${idOrcamento}`

    const detalhamento = [...document.querySelectorAll('#checklistAtivo tr')]
      .map(tr => {

        const elemento = (n) => {
          const e = tr.querySelector(`[name="${n}"]`)
          return n == 'realizado' ? e?.checked : e?.value || e?.textContent
        }

        return {
          descricao: elemento('descricao'),
          rack: elemento('rack'),
          local: elemento('local'),
          pilar: elemento('pilar'),
          setor: elemento('setor'),
          ip: elemento('ip'),
          realizado: elemento('realizado'),
          data: elemento('data'),
          observacao: elemento('observacao')
        }
      })

    await enviar(`checklist/${idLancamento}`, {
      codigo,
      id_orcamento: idOrcamento,
      detalhamento
    })

    removerTodosPopups()

  } catch (err) {
    console.log(err)
    popup({ mensagem: 'Falha ao registrar a quantidade: Fale com o suporte.' })
  }

}

async function graficoDiario() {
  const idOrcamento = controles.checklist.id;

  const dadosView = await recuperarDado('vw_checklist', idOrcamento) || {};
  const { checklist = [], total_itens_filtrados = 0 } = dadosView;

  const elemento = document.getElementById('graficoDiario');
  if (!elemento) {
    console.warn('Elemento #graficoDiario não encontrado.');
    return;
  }

  elemento.innerHTML = '';

  const detalhamentoGeral = checklist
    .map(c => c.detalhamento || [])
    .flat();

  const realizadosPorData = {};
  let realizadosSemData = 0;

  for (const { data, realizado } of detalhamentoGeral) {
    const ok = realizado === true || realizado === 'true';
    if (!ok) continue;

    if (!data) {
      realizadosSemData++;
      continue;
    }

    const chaveData = String(data).slice(0, 10); // 'aaaa-mm-dd'
    realizadosPorData[chaveData] ??= 0;
    realizadosPorData[chaveData]++;
  }

  const totalObra = Number(total_itens_filtrados) || 0;

  if (totalObra === 0) {
    elemento.innerHTML = `
      <div class="grafico-diario-vazio">
        Não há itens filtrados para calcular o gráfico.
      </div>
    `;
    return;
  }

  const dados = Object.entries(realizadosPorData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, realizadosNoDia]) => {
      const percentual = Number(((realizadosNoDia / totalObra) * 100).toFixed(1));
      const [ano, mes, dia] = data.split('-');
      const rotulo = `${dia}/${mes}`;
      return { data, rotulo, realizadosNoDia, percentual };
    });

  if (dados.length === 0 && realizadosSemData === 0) {
    elemento.innerHTML = `
      <div class="grafico-diario-vazio">
        Nenhum item realizado foi encontrado.
      </div>
    `;
    return;
  }

  if (dados.length === 0) {
    elemento.innerHTML = `
      <div class="grafico-diario-wrapper">
        <div class="grafico-diario-titulo">
          Andamento diário
        </div>
        <div class="grafico-diario-vazio">
          Todos os itens realizados estão sem data (${realizadosSemData}/${totalObra}).
        </div>
      </div>
    `;
    return;
  }

  // --- gráfico ---

  const largura = 800;
  const altura = 200;
  const margem = { topo: 40, direita: 20, inferior: 60, esquerda: 20 };
  const larguraGrafico = largura - margem.esquerda - margem.direita;
  const alturaGrafico = altura - margem.topo - margem.inferior;

  const espacoX = dados.length === 1
    ? larguraGrafico
    : larguraGrafico / (dados.length - 1);

  const calcularX = (i) =>
    margem.esquerda + (dados.length === 1
      ? larguraGrafico / 2
      : i * espacoX);

  const calcularY = (percentual) =>
    margem.topo + alturaGrafico - (percentual / 100) * alturaGrafico;

  const pontosPolyline = dados
    .map((item, i) => `${calcularX(i)},${calcularY(item.percentual)}`)
    .join(' ');

  const pontos = dados.map((item, i) => {
    const x = calcularX(i);
    const y = calcularY(item.percentual);
    return `
      <circle
        cx="${x}"
        cy="${y}"
        r="4"
        fill="#2563eb"
      >
        <title>${item.data}: ${item.percentual}% (${item.realizadosNoDia}/${totalObra})</title>
      </circle>
      <text
        x="${x}"
        y="${y - 8}"
        text-anchor="middle"
        fill="#2563eb"
        font-size="11"
        font-weight="600"
      >${item.percentual.toLocaleString()}%</text>
    `;
  }).join('');

  const labelsX = dados.map((item, i) => {
    const x = calcularX(i);
    const y = altura - margem.inferior + 20;
    return `
      <text
        x="${x}"
        y="${y}"
        text-anchor="middle"
        fill="#6b7280"
        font-size="11"
        transform="rotate(-45 ${x} ${y})"
      >${item.rotulo}</text>
    `;
  }).join('');

  // linha base (eixo X) e grade horizontal
  const yBase = margem.topo + alturaGrafico;

  const linhasGrade = [25, 50, 75].map(p => {
    const y = calcularY(p);
    return `
      <line
        x1="${margem.esquerda}"
        y1="${y}"
        x2="${largura - margem.direita}"
        y2="${y}"
        stroke="#e5e7eb"
        stroke-width="1"
        stroke-dasharray="4 4"
      ></line>
    `;
  }).join('');

  elemento.innerHTML = `
    <div class="grafico-diario-wrapper">
      <div class="grafico-diario-titulo">
        Andamento diário (% dos itens filtrados por dia)
      </div>

      <svg
        class="grafico-diario-svg"
        viewBox="0 0 ${largura} ${altura}"
        preserveAspectRatio="none"
        role="img"
        aria-label="Andamento diário"
      >
        <!-- linha base (eixo X) -->
        <line
          x1="${margem.esquerda}"
          y1="${yBase}"
          x2="${largura - margem.direita}"
          y2="${yBase}"
          stroke="#d1d5db"
          stroke-width="1"
        ></line>

        ${linhasGrade}

        <polyline
          points="${pontosPolyline}"
          fill="none"
          stroke="#2564eb71"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></polyline>

        ${pontos}
        ${labelsX}
      </svg>

      ${realizadosSemData > 0
      ? `<div class="grafico-diario-legenda-sem-data">
             Sem data: ${realizadosSemData} realizados (fora do gráfico)
           </div>`
      : ''
    }
    </div>
  `;
}