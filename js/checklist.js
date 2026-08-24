
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
        path: 'realizado.*'
      },
      criarLinha: 'criarLinhaDetalhada',
      colunas: {
        'Data': { chave: 'detalhamento.*.data', tipoPesquisa: 'data' },
        'Código': { chave: 'detalhamento.*.codigo_item', op: '=' },
        'Descrição': { chave: 'detalhamento.*.descricao' },
        'Rack': { chave: 'detalhamento.*.rack' },
        'Local': { chave: 'detalhamento.*.local' },
        'IP': { chave: 'detalhamento.*.ip' },
        'Equipamento': { chave: 'detalhamento.*.descricao_item' },
        'Quantidade': {},
        'Unidade': {},
        'Realizado': {},
        'Observação': { chave: 'detalhamento.*.observacao' }
      },
    })

    tela.innerHTML = `
        <div class="painel-geral-checklist">

          <div id="pdf" style="${vertical}; padding: 1rem; gap: 1rem;">

            <div style="${horizontal}; gap: 1rem;">
              <img src="${logo}">
              <span>CHECKLIST</span>
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

    const pag = 'checklist'
    const tabela = await modTab({
      id: idOrcamento,
      btnExtras: `
        <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
          <button onclick="desativarEmMassa()">Desativar Itens selecionados</button>
          <div style="${horizontal}; gap: 5px; color: white;">
            <input oninput="preencherDemais(this, 'desativar')" style="width: 2rem; height: 2rem;" type="checkbox">
            <span>Marcar todos</span>
          </div>
        </div>
        `,
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
    data,
    ip,
    rack,
    local,
    descricao,
    observacao,
    unidade,
    codigo,
    quantidade,
    realizado
  } = registro || {}

  const { dados_composicoes } = controles.detalhamento_checklist || {}
  const { descricao: descricao_item } = dados_composicoes?.[codigo] || {}

  return `
    <tr>
      <td>${dtFormatada(data)}</td>
      <td>${codigo}</td>
      <td>${descricao || ''}</td>
      <td>${rack || ''}</td>
      <td>${local || ''}</td>
      <td>${ip || ''}</td>
      <td>${descricao_item || ''}</td>
      <td>${quantidade || 1}</td>
      <td>${unidade || 'UN'}</td>
      <td style="text-align: center;">
        <img src="imagens/${realizado ? 'concluido' : 'cancel'}.png">
      </td>
      <td>${observacao || ''}</td>
    </tr>
  `
}

async function atualizarAndamentoChecklist() {

  const painel = document.querySelector('#indicadorGeral')

  const idOrcamento = controles.detalhamento_checklist.id
  const { snapshots, realizado, desativados_checklist } = await recuperarDado('dados_orcamentos', idOrcamento) || {}
  const {
    andamento,
    total_geral,
    total_dias,
    previsao_dias,
    data_inicial,
    data_final
  } = snapshots?.checklist || {}

  // Porcentagem Geral
  const porcentagemGeral = criarVelocimetroHTML({ rotulo: '% Geral', valor: total_geral })

  const req = {
    andamento,
    realizado,
    desativados_checklist
  }

  const porcentagens = (andamento || [])
    .map(({ tipo, codigo, descricao, unidade, ordem, andamento, numerador, denominador }) => {

      const ehMaoObra = tipo == 'MÃO_DE_OBRA'
      const funcao = ehMaoObra
        ? `abrirTabMO('${idOrcamento}', '${codigo}', '${unidade}', '${descricao}')`
        : `abrirTabelaInstConf('${tipo}')`

      const grafico = graficoDiario({
        ...req,
        ehMaoObra,
        ordem,
        codigo,
        tipo
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
      <div style="display: flex; gap: 5px;">
        ${porcentagemGeral}
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">${etiquetas}</div>
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

  const tipo = (descricao || '').includes('CONFIGURA')
    ? 'CONFIGURAÇÃO'
    : 'INSTALAÇÃO'

  const andamento = Number(((realizado / qtde) * 100).toFixed(0))

  return `
        <tr style="opacity: ${desativado ? 0.2 : 1};">
            <td>${codigo}</td>
            <td>${descricao}</td>
            <td>${unidade}</td>
            <td style="text-align: center;">
              <span class="checklist-num">${qtde}</span>
            </td>
            <td style="text-align: center;">
              <span class="checklist-num">${realizado || 0}</span>
            </td>
            <td>
                ${divPorcentagem(andamento)}
            </td>
            <td style="text-align: center;">
                <img src="imagens/lapis.png" onclick="tabInstConf('${codigo}', '${tipo}')">
            </td>
            <td style="text-align: center;">
                <input name="desativar" data-codigo="${codigo}"  ${desativado ? 'checked' : ''} style="width: 2rem; height: 2rem;" type="checkbox">
            </td>
        </tr>
    `
}

async function desativarEmMassa() {

  try {

    overlayAguarde()

    const { id } = controles.detalhamento_checklist
    const { desativados_checklist } = await recuperarDado('dados_orcamentos', id) || {}

    const atualizado = {
      ...desativados_checklist
    }

    Object([...document.querySelectorAll('[name="desativar"]')]).forEach(input => {

      const codigo = input.dataset.codigo
      const desativado = input.checked

      if (desativado)
        atualizado[codigo] = { data: new Date().toLocaleString() }

      if (!desativado)
        delete atualizado[codigo]

    })

    await enviar(`dados_orcamentos/${id}/desativados_checklist`, atualizado)

    removerOverlay()

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao desativar os itens no Checklist: Fale com o suporte.' })
  }


}

async function abrirTabMO(idOrcamento, codigo, unidade, descricao) {

  overlayAguarde()

  const tabela = await modTab({
    colunas: {
      'Código': {},
      'Quantidade': {},
      'Data': {},
      'Observação': {}
    },
    base: 'checklist',
    body: 'mo',
    pag: 'mo',
    criarLinha: 'criarLinhaMO',
    filtros: {
      id_orcamento: { op: '=', value: idOrcamento },
      codigo: { op: '=', value: codigo }
    }
  })

  const elemento = `
    <div style="padding: 1rem;">
      ${montarPagina({ tabela, titulo: descricao, imagem: 'checklist' })}
    </div>
    `
  const botoes = [
    {
      texto: 'Adicionar Linha',
      funcao: `adicionarLinhaChecklistMO('${codigo}', '${unidade}')`,
      img: 'baixar'
    }
  ]

  popup({ elemento, botoes, titulo: 'Mão de Obra', descricao })

  await paginacao('mo')

}

function criarLinhaMO(item) {

  const {
    observacao,
    quantidade,
    data,
    codigo
  } = item || {}

  return `
    <tr>
      <td>${codigo}</td>
      <td>${quantidade || 0}</td>
      <td>${dtFormatada(data)}</td>
      <td style="white-space: wrap;">${observacao}</td>
    </tr>
  `

}

async function tabInstConf(codigo, tipo) {

  try {

    overlayAguarde()

    const { id: idOrcamento } = controles.detalhamento_checklist

    const pag = 'InstConf'
    const tabela = await modTab({
      colunas: {
        'Descrição': {},
        'Rack': {},
        'Local': {},
        'Pilar': {},
        'Setor': {},
        'IP': {},
        'Fotos': {},
        'Quantidade': {},
        'Data': {}
      },
      base: 'checklist',
      body: pag,
      pag,
      criarLinha: 'criarLinhaInstConf',
      filtros: {
        id_orcamento: { op: '=', value: idOrcamento },
        codigo: { op: '=', value: codigo }
      }
    })

    const elemento = `
      <div style="padding: 1rem;">
          ${montarPagina({ tabela, titulo: '', imagem: 'checklist' })}
      </div>
    `

    const botoes = [
      {
        texto: 'Adicionar Linha',
        funcao: `adicionarLinhaChecklistInstConf('${codigo}', '${tipo}')`,
        img: 'concluido'
      }
    ]

    popup({
      titulo: 'Registrar Andamento',
      elemento,
      botoes
    })

    await paginacao(pag)

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao abrir o item: Fale com o suporte.' })
  }

}

async function adicionarLinhaChecklistInstConf(codigo, tipo, id) {

  const {
    fotos,
  } = id
      ? await recuperarDado('checklist', id) || {}
      : {}

  const linhas = [
    {
      texto: 'Quantidade',
      elemento: `<input name="quantidade" type="number">`
    },
    {
      texto: 'Data',
      elemento: `<input name="data" type="date">`
    },
    {
      texto: 'Descrição',
      elemento: `<input name="descricao">`
    },
    {
      texto: 'Rack',
      elemento: `<input name="rack">`
    },
    {
      texto: 'Local',
      elemento: `<input name="local">`
    },
    {
      texto: 'Pilar',
      elemento: `<input name="pilar">`
    },
    {
      texto: 'Setor',
      elemento: `<input name="setor">`
    },
    {
      texto: 'IP',
      elemento: `<input name="ip">`
    },
    {
      texto: 'Fotos',
      elemento: `
          <input
            name="foto"
            type="file"
            multiple
            accept="image/png, image/jpeg, image/webp"
            required>
      `
    },
    {
      texto: 'Observação',
      editor: ''
    }
  ]

  const botoes = [
    { texto: 'Salvar', funcao: `salvarItemChecklistInstConf('${codigo}', '${tipo}')`, img: 'concluido' }
  ]

  popup({ linhas, botoes, titulo: 'Registrar' })

}

async function salvarItemChecklistInstConf(codigo, tipo) {

  try {

    overlayAguarde()

    const idOrcamento = controles.detalhamento_checklist.id
    const id = crypto.randomUUID()
    const camposFixos = ['descricao', 'rack', 'local', 'pilar', 'setor', 'ip', 'data']

    const item = {
      id,
      id_orcamento: idOrcamento,
      quantidade: Number(document.querySelector('[name="quantidade"]').value),
      observacao: document.querySelector('.editor-conteudo').innerHTML,
      tipo,
      codigo
    }

    camposFixos.forEach(campo => {
      item[campo] = document.querySelector(`[name="${campo}"]`).value
    })

    await enviar(`checklist/${id}`, item)

    removerPopup()

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao salvar o registro: Fale com o suporte.' })
  }

}

function criarLinhaInstConf(item) {

  const {
    descricao,
    rack,
    ip,
    local,
    pilar,
    setor,
    fotos,
    realizado,
    data
  } = item || {}


  return `
    <tr>
      <td>${descricao || ''}</td>
      <td>${rack || ''}</td>
      <td>${local || ''}</td>
      <td>${pilar || ''}</td>
      <td>${setor || ''}</td>
      <td>${ip || ''}</td>
      <td>${fotos || ''}</td>
      <td>${realizado || ''}</td>
      <td>${data || ''}</td>
    </tr>
  `

}

function alterarImagemPreview(input) {
  const container = input.closest('div')
  const texto = container?.querySelector(
    '.textoArquivosSelecionados'
  )

  const quantidade = input.files?.length || 0

  if (!texto) return

  if (quantidade === 0) {
    texto.textContent = ''
    return
  }

  texto.textContent = quantidade === 1
    ? '1 arquivo selecionado'
    : `${quantidade} arquivos selecionados`

}

function adicionarLinhaChecklistMO(codigo, unidade) {

  const linhas = [
    {
      texto: 'Unidade',
      elemento: `<span>${unidade}</span>`
    },
    {
      texto: 'Quantidade',
      elemento: `<input name="quantidade" type="number">`
    },
    {
      texto: 'Data',
      elemento: `<input name="data" type="date">`
    },
    {
      texto: 'Observação',
      editor: ''
    }
  ]

  const botoes = [
    { texto: 'Salvar', funcao: `salvarItemChecklistMO('${codigo}')`, img: 'concluido' }
  ]

  popup({ linhas, botoes, titulo: 'Registrar' })

}

async function salvarItemChecklistMO(codigo) {

  try {

    overlayAguarde()

    const idOrcamento = controles.detalhamento_checklist.id
    const id = crypto.randomUUID()
    const item = {
      id,
      id_orcamento: idOrcamento,
      quantidade: Number(document.querySelector('[name="quantidade"]').value),
      observacao: document.querySelector('.editor-conteudo').innerHTML,
      data: document.querySelector('[name="data"]').value,
      tipo: 'MÃO_OBRA',
      codigo
    }

    await enviar(`checklist/${id}`, item)

    removerPopup()

  } catch (err) {
    console.error(err)
    popup({ mensagem: 'Falha ao salvar o registro: Fale com o suporte.' })
  }

}

function preencherDemais(input, campo) {

  [...document.querySelectorAll(`[name="${campo}"]`)].forEach(e => {

    if (campo == 'data')
      e.value = input.value

    else
      e.checked = input.checked

  })

}

async function salvarRegistroMO(codigo) {

  try {

    overlayAguarde()

    const idOrcamento = controles.detalhamento_checklist.id

    if (!idOrcamento)
      return popup({ mensagem: 'Falha ao localizar o orçamento: Fale com o suporte.' })

    const realizado = [...document.querySelectorAll('#checklistAtivo tr')]
      .map(tr => {

        const elemento = (n) => {
          const e = tr.querySelector(`[name="${n}"]`)
          return n == 'realizado' ? e?.checked : e?.value || e?.textContent
        }

        return {
          tipo: 'MÃO DE OBRA',
          codigo,
          realizado: true,
          quantidade: Number(elemento('quantidade') || 0),
          data: elemento('data'),
          observacao: elemento('observacao')
        }

      })

    await enviar(`checklist/${idOrcamento}/realizado/${codigo}`, realizado)

    removerPopup()

  } catch (err) {
    console.log(err)
    popup({ mensagem: 'Falha ao registrar a quantidade: Fale com o suporte.' })
  }

}

async function salvarRegistroChecklist(codigo, tipo) {

  try {

    overlayAguarde()

    const idOrcamento = controles.detalhamento_checklist.id

    if (!idOrcamento)
      return popup({ mensagem: 'Falha ao localizar o orçamento: Fale com o suporte.' })

    const { realizado: realizadoAtual } = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    const lista = await Promise.all([...document.querySelectorAll('#checklistAtivo tr')]
      .map(async (tr) => {

        const elemento = (n) => {
          const e = tr.querySelector(`[name="${n}"]`)
          return n == 'realizado' ? e?.checked : e?.value || e?.textContent
        }

        const realizado = elemento('realizado')
        const ordem = elemento('ordem')

        // Fotos;
        const input = tr.querySelector('[name="foto"]')
        const resposta = (await importarAnexos({ input }) || [])
          .map(anexo => ({ [crypto.randomUUID()]: anexo }))
        const fotos = {
          ...realizadoAtual?.[codigo]?.[ordem]?.fotos || {},
          ...Object.assign({}, ...resposta)
        }

        const dados = {
          ordem,
          fotos,
          codigo,
          tipo,
          descricao: elemento('descricao'),
          rack: elemento('rack'),
          local: elemento('local'),
          pilar: elemento('pilar'),
          setor: elemento('setor'),
          ip: elemento('ip'),
          realizado,
          data: elemento('data'),
          observacao: elemento('observacao')
        }

        return { [ordem]: dados }

      })
    )

    const detalhamento = Object.assign({}, ...lista)

    await enviar(`dados_orcamentos/${idOrcamento}/realizado/${codigo}`, detalhamento)

    removerPopup()

  } catch (err) {
    console.log(err)
    popup({ mensagem: 'Falha ao registrar a quantidade: Fale com o suporte.' })
  }

}

function graficoDiario({ desativados_checklist, ordem, andamento, realizado, ehMaoObra, codigo = null, tipo = null }) {

  const realizadosPorData = {}
  let realizadosSemData = 0

  const detalhamentoFiltrado = Object.values(realizado || {})
    .flat()
    .filter(item => !desativados_checklist?.[item.codigo]) // Itens desativados;
    .filter(item => ehMaoObra ? item.codigo == codigo : item.tipo == tipo)

  for (const { data, quantidade } of detalhamentoFiltrado) {
    if (!data) {
      realizadosSemData++
      continue
    }

    const chaveData = String(data).slice(0, 10)
    realizadosPorData[chaveData] ??= 0
    realizadosPorData[chaveData] += ehMaoObra ? (Number(quantidade) || 0) : 1
  }

  const totalObra =
    andamento.find(item => {
      if (ehMaoObra) {
        return item.codigo == codigo
      }
      if (tipo && item.tipo == tipo) {
        return true
      }
      if (codigo && item.codigo == codigo) {
        return true
      }
      return false
    })?.denominador ?? 0

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
  }

  // Ordena por data e calcula percentuais
  const dados = dadosLista
    .slice()
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .map(item => {
      const percentual = Number(
        ((item.realizadosNoDia / totalObra) * 100).toFixed(1)
      )
      const [ano, mes, dia] = String(item.data).split('-')
      const rotulo = `${dia}/${mes}`
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

  // --- Cálculos de Média ---
  const totalRealizadoComData = dados.reduce((acc, cur) => acc + cur.realizadosNoDia, 0)
  const totalDias = dados.length
  const mediaQtdDia = (totalRealizadoComData / totalDias).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  const mediaPercDia = ((totalRealizadoComData / totalObra / totalDias) * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  // --- Gráfico SVG ---
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
    margem.topo + alturaGrafico - (percentual / 100) * alturaGrafico

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
        font-weight="600">${item.percentual.toLocaleString('pt-BR')}%</text>
    `
  }).join('')

  const labelsX = dados.map((item, i) => {
    const x = calcularX(i)
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

  const yBase = margem.topo + alturaGrafico

  const linhasGrade = [25, 50, 75].map(p => {
    const y = calcularY(p)
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

      <div class="grafico-diario-cabecalho">
        <div class="grafico-diario-titulo">
          Andamento diário (% dos itens filtrados por dia)
        </div>
        <div class="grafico-diario-media" style="font-size: 13px; color: #4b5563;">
          Média: <strong>${mediaQtdDia}/dia</strong> (${mediaPercDia}%/dia)
        </div>
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
      filtros: {
        realizado: { op: 'NOT_EMPTY' }
      },
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

    tela.innerHTML = montarPagina({ titulo: 'Orçamentos com Checklist', imagem: 'checklist', tabela })

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
    total_geral,
    data_final,
    data_inicial
  } = checklist || {}

  // Tags;
  const listaTags = Object.values(tags || {})
    .map(tag => modeloTag(tag, id))
    .join('')

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
        ${criarVelocimetroHTML({ rotulo: '% Geral', valor: total_geral })}
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