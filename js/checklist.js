
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

    // TABELA 
    const pag = 'detalhamento_checklist'
    const tabela1 = await modTab({
      id: idOrcamento,
      dados_composicoes,
      pag,
      body: pag,
      base: 'dados_orcamentos',
      funcaoAdicional: ['atualizarAndamentoChecklist'],
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
        'Quantidade': {},
        'Unidade': {},
        'Realizado': {},
        'Data': { chave: 'detalhamento.*.data', tipoPesquisa: 'data' },
        'Observação': { chave: 'detalhamento.*.observacao' }
      },
    })

    tela.innerHTML = `
        <div class="painel-geral-checklist">

          <div id="pdf" style="${vertical}; padding: 1rem; gap: 1rem;">

            <div style="${horizontal}; gap: 1rem;">
              <span>ANDAMENTO • </span>
              <span class="tag-pendencias">${contrato}</span>
              <span class="titulo-1">${cliente}</span>
            </div>

            <div id="indicadorGeral" style="width: 100%; ${vertical}; gap: 1rem;"></div>

          </div>

          <div class="checklist-tabelas">
            <span class="titulo-2">Todas as atividades realizadas Por Data</span>
            ${tabela1}
          </div>  

        </div>
    `
    await paginacao(pag)

    removerTodosPopups()

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao abrir o checklist: Fale com o suporte.' })
  }

}

async function abrirTabelaInstConf(tipo) {

  try {
    overlayAguarde()

    const idOrcamento = controles.detalhamento_checklist.id

    const {
      dados_orcam,
      dados_composicoes,
      snapshots
    } = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    const { contrato } = dados_orcam || {}
    const { cliente } = snapshots || {}

    const pag = 'checklist'
    const tabela = await modTab({
      id: idOrcamento,
      dados_composicoes,
      pag,
      body: pag,
      base: 'dados_orcamentos',
      explode: {
        path: 'snapshots.checklist.itens'
      },
      filtros: {
        'id': { op: '=', value: idOrcamento },
        'snapshots.checklist.itens.*.tipo': { op: '=', value: tipo }
      },
      criarLinha: 'criarLinhaChecklist',
      colunas: {
        'Código': { chave: 'checklist.*.codigo' },
        'Descrição': { chave: 'checklist.*.descricao' },
        'Unidade': { chave: 'checklist.*.unidade' },
        'Quantidade': { chave: 'checklist.*.qtde' },
        'Realizado': {},
        'Andamento': {},
        'Registrar': {},
        'Desativar': {}
      }
    })

    popup({
      titulo: `Itens do Orçamento`,
      elemento: `<div style="padding: 1rem;">${tabela}</div>`
    })

    await paginacao(pag)

  } catch (err) {
    popup({ mensagem: 'Falha ao abrir o formulário: Fale com o suporte.' })
    console.error(err)
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
    unidade,
    descricao_item,
    codigo,
    quantidade,
    realizado
  } = registro || {}

  return `
    <tr>
      <td>${codigo_item}</td>
      <td>${descricao || ''}</td>
      <td>${rack || ''}</td>
      <td>${local || ''}</td>
      <td>${descricao_item}</td>
      <td>${quantidade || 1}</td>
      <td>${unidade || 'UN'}</td>
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

  const idOrcamento = controles.detalhamento_checklist.id
  const { snapshots } = await recuperarDado('dados_orcamentos', idOrcamento) || {}
  const {
    andamento,
    detalhamento,
    total_dias,
    previsao_dias,
    data_inicial,
    data_final
  } = snapshots?.checklist || {}

  // Porcentagem Geral
  const numeradorSomado = (andamento || [])
    .reduce((acc, item) => acc + (item.numerador), 0)

  const denominadorSomado = (andamento || [])
    .reduce((acc, item) => acc + (item.denominador), 0)

  const andGeralPorc = Number(((numeradorSomado / denominadorSomado) * 100).toFixed(2))
  const porcentagemGeral = criarVelocimetroHTML({ rotulo: 'Porcentagem Geral', valor: andGeralPorc })

  const req = {
    andamento,
    detalhamento
  }

  const porcentagens = (andamento || [])
    .map(({ tipo, codigo, descricao, unidade, andamento, numerador, denominador }) => {

      const ehMaoObra = tipo == 'MÃO_DE_OBRA'
      const funcao = ehMaoObra
        ? `registrarChecklist('${codigo}')`
        : `abrirTabelaInstConf('${tipo}')`

      const grafico = graficoDiario({
        ...req,
        ...(
          ehMaoObra ? { codigo } : { tipo }
        )
      })

      return `
        <div class="checklist-painel">
          <div style="${vertical}; width: 300px; margin-left: 1rem; gap: 5px;">
            ${criarVelocimetroHTML({ rotulo: `${numerador} / ${denominador} ${unidade || 'UN'}S`, valor: andamento })}
            <div style="${horizontal}; gap: 0.5rem;">
              <img src="imagens/pesquisar2.png" onclick="${funcao}">
              <span>${descricao || tipo}</span>
            </div>
          </div>
          ${grafico}
        </div>
        `
    })
    .join('')

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
      titulo: 'Dias para Conclusão',
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
      funcao: `abrirAtalhos('${idOrcamento}')`,
    },
    {
      titulo: 'Baixar em PDF',
      funcao: `pdfChecklist()`,
    }
  ]

  const etiquetas = esquema
    .map(e => modelo(e))
    .join('')

  painel.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 5px;">
        ${porcentagemGeral}
        ${etiquetas}
      </div>
      ${porcentagens}
    `

}

async function criarLinhaChecklist(item) {

  const {
    codigo,
    descricao,
    unidade,
    qtde,
    realizado,
    desativado
  } = item

  const andamento = Number(((realizado / qtde) * 100).toFixed(0))

  return `
        <tr style="opacity: ${desativado ? 0.2 : 1};">
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
            <td style="text-align: center;">
                <input ${desativado ? 'checked' : ''} onchange="habDesab(this, '${codigo}')" style="width: 2rem; height: 2rem;" type="checkbox">
            </td>
        </tr>
    `
}

async function habDesab(input, codigo) {

  try {

    const desativado = input.checked

    const tr = input.closest('tr')
    tr.style.opacity = desativado ? 0.2 : 1

    const { id: id_orcamento } = controles.detalhamento_checklist

    await enviar(`checklist/${codigo}_${id_orcamento}`, {
      codigo,
      id_orcamento,
      desativado
    })

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao ativar/desativar o item: Fale com o suporte.' })
  }

}

async function registrarChecklist(codigo) {

  try {
    overlayAguarde()

    const hoje = new Date().toISOString().slice(0, 10)

    const { id, dados_composicoes } = controles.detalhamento_checklist
    const { qtde, descricao, imagem, unidade } = dados_composicoes?.[codigo] || {}
    const { detalhamento, mao_obra } = await recuperarDado('checklist', `${codigo}_${id}`) || {}
    let ths = []
    let linhas = []
    const fixo = 'style="min-width: 100px" contentEditable="true"'
    const ehMaoObra = descricao.includes('MÃO DE OBRA')

    if (ehMaoObra) {

      ths = [
        'REMOVER',
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
              <td style="text-align: center;">
                <img onclick="this.parentElement.parentElement.remove()" src="imagens/fechar.png">
              </td>
              <td>${unidade || 'UN'}</td>
              <td style="text-align: center;" name="quantidade" ${fixo}>${quantidade || 0}</td>
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

    const botoes = []

    if (ehMaoObra)
      botoes.push({
        texto: 'Adicionar Linha',
        funcao: `adicionarLinhaChecklistMO('${unidade}')`,
        img: 'baixar'
      })

    botoes.push({
      texto: 'Salvar',
      funcao: ehMaoObra
        ? `salvarRegistroMO('${codigo}')`
        : `salvarRegistroChecklist('${codigo}')`,
      img: 'concluido'
    }
    )

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
        <td style="text-align: center;">
          <img onclick="this.parentElement.parentElement.remove()" src="imagens/fechar.png">
        </td>
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

    const idOrcamento = controles.detalhamento_checklist.id

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
          realizado: true,
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

    removerPopup()

  } catch (err) {
    console.log(err)
    popup({ mensagem: 'Falha ao registrar a quantidade: Fale com o suporte.' })
  }

}

async function salvarRegistroChecklist(codigo) {

  try {

    overlayAguarde()

    const idOrcamento = controles.detalhamento_checklist.id

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

    removerPopup()

  } catch (err) {
    console.log(err)
    popup({ mensagem: 'Falha ao registrar a quantidade: Fale com o suporte.' })
  }

}

function graficoDiario({ andamento, detalhamento, codigo = null, tipo = null }) {

  const realizadosPorData = {}
  let realizadosSemData = 0

  const ehMaoObra = codigo ? true : false

  const detalhamentoFiltrado = (detalhamento || [])
    .filter(item => {

      if (codigo && item.codigo_item !== codigo)
        return false

      if (tipo && item.tipo !== tipo)
        return false

      return item.realizado
    })

  for (const { data, tipo, codigo, quantidade } of detalhamentoFiltrado) {

    if (!data) {
      realizadosSemData++
      continue
    }

    const chaveData = String(data).slice(0, 10)
    realizadosPorData[chaveData] ??= 0
    realizadosPorData[chaveData] += ehMaoObra ? quantidade : 1
  }

  const totalObra =
    andamento.find(item => {

      if (ehMaoObra) {
        return item.codigo == codigo;
      }

      if (tipo && item.tipo == tipo) {
        return true;
      }

      if (codigo && item.codigo == codigo) {
        return true;
      }

      return false;
    })?.denominador ?? 0;

  const dadosLista = Object.entries(realizadosPorData)
    .map(([data, realizadosNoDia]) => ({
      data,
      realizadosNoDia,
      totalObra,
      realizadosSemData,
    }))

  if (totalObra === 0) {
    return `
      <div class="grafico-diario-vazio">
        Não há itens filtrados para calcular o gráfico.
      </div>
    `
    return
  }

  // Ordena por data e calcula percentuais
  const dados = dadosLista
    .slice()
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .map(item => {
      const percentual = Number(
        ((item.realizadosNoDia / totalObra) * 100).toFixed(1)
      );
      const [ano, mes, dia] = String(item.data).split('-');
      const rotulo = `${dia}/${mes}`;
      return {
        data: String(item.data),
        rotulo,
        realizadosNoDia: Number(item.realizadosNoDia),
        percentual,
      }
    })

  if (dados.length === 0 && realizadosSemData === 0) {
    return `
      <div class="grafico-diario-vazio">
        Nenhum item realizado foi encontrado.
      </div>
    `
  }

  if (dados.length === 0) {
    return `
      <div class="grafico-diario-wrapper">
        <div class="grafico-diario-titulo">
          Andamento diário
        </div>
        <div class="grafico-diario-vazio">
          Todos os itens realizados estão sem data (${realizadosSemData}/${totalObra}).
        </div>
      </div>
    `
  }

  // --- gráfico ---
  const largura = 800
  const altura = 200
  const margem = { topo: 40, direita: 20, inferior: 60, esquerda: 20 }
  const larguraGrafico = largura - margem.esquerda - margem.direita
  const alturaGrafico = altura - margem.topo - margem.inferior

  const espacoX = dados.length === 1
    ? larguraGrafico
    : larguraGrafico / (dados.length - 1)

  const calcularX = (i) =>
    margem.esquerda + (dados.length === 1
      ? larguraGrafico / 2
      : i * espacoX)

  const calcularY = (percentual) =>
    margem.topo + alturaGrafico - (percentual / 100) * alturaGrafico;

  const pontosPolyline = dados
    .map((item, i) => `${calcularX(i)},${calcularY(item.percentual)}`)
    .join(' ')

  const pontos = dados.map((item, i) => {
    const x = calcularX(i)
    const y = calcularY(item.percentual)
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
        font-weight="600">${item.percentual.toLocaleString()}%</text>
    `
  }).join('')

  const labelsX = dados.map((item, i) => {
    const x = calcularX(i);
    const y = altura - margem.inferior + 20
    return `
      <text
        x="${x}"
        y="${y}"
        text-anchor="middle"
        fill="#6b7280"
        font-size="11"
        transform="rotate(-45 ${x} ${y})"
      >${item.rotulo}</text>
    `
  }).join('')

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
    `
  }).join('')

  return `
    <div class="grafico-diario-wrapper">
      <div class="grafico-diario-titulo">
        Andamento diário (% dos itens filtrados por dia)
      </div>

      <svg
        class="grafico-diario-svg"
        viewBox="0 0 ${largura} ${altura}"
        preserveAspectRatio="none"
        role="img"
        aria-label="Andamento diário">
        <!-- linha base (eixo X) -->
        <line
          x1="${margem.esquerda}"
          y1="${yBase}"
          x2="${largura - margem.direita}"
          y2="${yBase}"
          stroke="#d1d5db"
          stroke-width="1"></line>

        ${linhasGrade}

        <polyline
          points="${pontosPolyline}"
          fill="none"
          stroke="#2564eb71"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"></polyline>

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
  `
}

async function telaTodosChecklists() {

  try {
    overlayAguarde()

    const pag = 'lista_checklist'

    const tabela = await modTab({
      base: 'dados_orcamentos',
      pag,
      criarLinha: 'criarLinhaOrcamentoChecklist',
      body: pag,
      colunas: {
        'Orçamento': { chave: 'snapshots.contrato' },
        'Tags': { chave: 'snapshots.tags' },
        'Total Orçamento': { chave: 'snapshots.total' },
        'Dias Trabalhados': {},
        'Previsão Dias': {},
        'Início das atividades': { chave: 'data_inicial', tipoPesquisa: 'data' },
        'Última atividade': { chave: 'data_final', tipoPesquisa: 'data' },
        'Previsão Dias': {},
        'Andamento': {},
        'Ver Checklist': {}
      }
    })

    tela.innerHTML = `
      <div style="padding: 2rem;">
          ${tabela}
      </div>
    `

    await paginacao(pag)

    removerOverlay()

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao abrir a listagem de Checklists: Fale com o suporte.' })
  }

}

function criarLinhaOrcamentoChecklist(orcamento) {

  const {
    id,
    snapshots,
    dados_orcam,
    total_geral: valor_orcamento
  } = orcamento || {}

  const {
    checklist,
    contrato,
    tags
  } = snapshots || {}

  const {
    total_dias,
    previsao_dias,
    andamento,
    total_geral,
    total_realizado,
    data_final,
    data_inicial
  } = checklist || {}

  // Tags;
  const listaTags = Object.values(tags || {})
    .map(tag => modeloTag(tag, id))
    .join('')

  const valor = Number(((total_realizado / total_geral) * 100).toFixed(2))

  return `
    <tr>
      <td>
        ${(contrato || []).map(d => d).join('<br>')}
      </td>
      <td>
        <div style="display: flex; flex-wrap: wrap; gap: 3px;">${listaTags}</div>
      </td>
      <td>
        ${dinheiro(valor_orcamento)}
      </td>
      <td>
        <span class="etiqueta-valores">${total_dias || 0}</span>
      </td>
      <td>
        <span class="etiqueta-valores">${previsao_dias || 0}</span>
      </td>
      <td>
        <span class="etiqueta-valores">${data_inicial || 'Sem data'}</span>
      </td>
      <td>
        <span class="etiqueta-valores">${data_final || 'Sem data'}</span>
      </td>
      <td>
        ${divPorcentagem(valor)}
      </td>
      <td style="text-align: center;">
        <img onclick="telaChecklist('${id}')" src="imagens/pesquisar2.png">
      </td>
  </tr>
  `

}

async function pdfChecklist() {

  await pdf({
    id: 'pdf',
    estilos: ['checklist', 'velocimetro', 'ocorrencias'],
    nome: `Checklist_${1}`
  })

}