const strHHMM = (minutosTotais) => {

    const minutosPorDia = 1440

    const dias = Math.floor(minutosTotais / minutosPorDia)
    const restoMinutos = minutosTotais % minutosPorDia

    const horas = Math.floor(restoMinutos / 60)
    const minutos = restoMinutos % 60

    const prefixoDias = dias > 0
        ? `${dias}d `
        : ''

    return `
        <span style="white-space: nowrap;">
            ${prefixoDias}${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}min
        </span>
    `
}

const estT = (tempo) => {
    return !tempo
        ? 'off'
        : tempo == '00:00'
            ? 'zero'
            : 'on'
}

async function telaChecklist(id) {

    const existente = document.querySelector('.toolbar-checklist')
    if (existente)
        return

    const { snapshots } = await recuperarDado('dados_orcamentos', id) || {}

    const colunas = {
        '': {},
        'Código': { chave: 'codigo' },
        'Itens do Orçamento': { chave: 'descricao' },
        'Quantidade': { chave: 'qtde' },
        'Tempo/Atividade': {},
        'Tempo/Total': {},
        'Serviço Executado': {},
        'Tempo/Realizado': {},
        '% Conclusão': {}
    }

    const btnExtras = `
        <div style="color: white; ${horizontal}; gap: 1rem;">
            <input style="width: 1.5rem; height: 1.5rem;" type="checkbox" onclick="marcarItensChecklist(this)">
            <span>Marcar todos</span>
        </div>`

    const tabela = modTab({
        id,
        colunas,
        pag: 'checklist',
        btnExtras,
        funcaoAdicional: ['calcularTempos'],
        filtros: {
            'tipo': { op: '!=', value: 'VENDA' }
        },
        body: 'bodyChecklist',
        criarLinha: 'carregarLinhaChecklist',
        base: () => baseChecklist()
    })

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <div class="toolbar-checklist">

                <div style="${vertical}; align-items: center;">

                    <div style="${horizontal}; justify-content: space-evenly; width: 100%;">
                        <div id="porcentagem" style="padding: 0.5rem;"></div>
                        <span>Obra iniciada em: <b><span id="inicio"></span></b> </span>
                    </div>

                    <div class="opcoes-orcamento">
                        ${modeloBotoes('gerente', 'Técnicos na Obra', `tecnicosAtivos('${id}')`)}
                        ${modeloBotoes('cancel', 'Remover Itens Selecionados', `removerItensEmMassaChecklist()`)}
                        ${modeloBotoes('checklist', 'Ver Itens Removidos', `verItensRemovidos()`)}
                        ${modeloBotoes('baixar', 'Serviço Avulso', `adicionarServicoAvulso()`)}
                        ${modeloBotoes('relatorio', 'Relatório', `relatorioChecklist()`)}
                        ${modeloBotoes('atualizar', 'Atualizar', `atualizarGCS()`)}
                    </div>
                    
                </div>

                <div class="resultados"></div>

            </div>

            ${tabela}

        </div>`

    const campos = (snapshots?.contrato || [])
        .filter(c => c)
        .join(' - ')

    const titulo = `Checklist - ${campos}`

    popup({ elemento, titulo })

    await paginacao()

}

async function baseChecklist() {

    const { id } = controles.checklist
    const { dados_composicoes, checklist } = await recuperarDado('dados_orcamentos', id) || {}
    const { avulso, itens, qReal } = checklist || {}

    const mesclado = {
        ...dados_composicoes || {},
        ...avulso || {}
    }

    // Modelagem dos dados;
    for (const [codigo, dados] of Object.entries(mesclado)) {

        const { tempo } = await recuperarDado('dados_composicoes', codigo) || '00:00'
        mesclado[codigo].tempo = tempo || '00:00'

        // Item removido;
        if (itens?.[codigo]?.removido) {
            delete mesclado[codigo]
            continue
        }

        if (!dados?.tipo)
            mesclado[codigo].descricao = `${mesclado[codigo].descricao} <b>[Avulso]</b>`

        // Itens avulso não tem;
        mesclado[codigo].codigo = codigo

        mesclado[codigo].itens = itens?.[codigo] || {}

        if (qReal?.[codigo])
            mesclado[codigo].qReal = qReal?.[codigo]?.qtde
    }

    return mesclado

}

async function carregarLinhaChecklist(produto) {

    const { codigo, tempo, descricao, unidade, qtde, qReal, itens } = produto || {}

    const qtdeRealizada = Object.values(itens || {})
        .reduce((acc, item) => acc + (item?.quantidade || 0), 0)

    const [h, m] = tempo.split(':').map(Number)
    const minUnit = h * 60 + m
    const total = minUnit * (qReal || qtde || 0)
    const tempoRealizado = minUnit * qtdeRealizada

    const tds = `
        <td>
            <input style="width: 1.5rem; height: 1.5rem;" name="itensChecklist" data-codigo="${codigo}" type="checkbox">
        </td>
        <td>${codigo}</td>
        <td>${descricao || ''}</td>
        <td>
            <div style="${horizontal}; gap: 5px;">
                <span>${qReal || qtde || 0}</span>
                <img src="imagens/ajustar.png" onclick="painelAlterarQuantidade('${codigo}')">
            </div>
        </td>
        <td>
            <div style="${horizontal}; gap: 5px;">
                <span class="${estT(tempo)}">
                    ${tempo} por <b>${unidade || 'UND'}</b>
                </span>
                <img src="imagens/ajustar.png" onclick="painelAlterarTempo('${codigo}')">
            </div>
        </td>
        <td>
            ${strHHMM(total)}
        </td>
        <td>
            <div style="${horizontal}; gap: 10px;">
                <span>${qtdeRealizada}</span>
                <img onclick="registrarChecklist('${codigo}')" src="imagens/baixar.png">
            </div>
        </td>
        <td>
            ${strHHMM(tempoRealizado)}
        </td>
        <td>
            ${divPorcentagem(((tempoRealizado / total) * 100).toFixed(1))}
        </td>`

    return `<tr> ${tds} </tr>`

}

async function painelAlterarTempo(codigo) {

    const { tempo } = await recuperarDado('dados_composicoes', codigo) || '00:00'

    const linhas = [
        {
            texto: 'Qual o tempo da atividade?',
            elemento: `<input type="time" id="tempoProduto" value="${tempo}">`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarTempo('${codigo}')` }
    ]

    popup({ linhas, botoes, titulo: 'Definir tempo' })

}

async function salvarTempo(codigo) {

    overlayAguarde()

    const produto = await recuperarDado('dados_composicoes', codigo)

    if (!produto)
        return removerPopup()

    const tempo = document?.querySelector('#tempoProduto')?.value || '00:00'

    await inserirDados({ [codigo]: produto }, 'dados_composicoes')
    enviar(`dados_composicoes/${codigo}/tempo`, tempo)

    removerPopup()

}

async function painelAlterarQuantidade(codigo) {

    const linhas = [
        {
            texto: 'Editar quantidade',
            elemento: `<input type="number" id="qReal">`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarQtdReal('${codigo}')` }
    ]

    popup({ linhas, botoes, titulo: 'Nova Quantidade' })

}

async function salvarQtdReal(codigo) {

    const qtde = Number(document?.getElementById('qReal')?.value || 0)
    if (qtde == 0)
        return removerPopup()

    overlayAguarde()

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)

    orcamento.checklist.qReal ??= {}
    orcamento.checklist.qReal[codigo] ??= {}
    orcamento.checklist.qReal[codigo].qtde = qtde

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id}/checklist/qReal/${codigo}/qtde`, qtde)

    removerPopup()

}

async function tecnicosAtivos(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const listaTecs = orcamento?.checklist?.tecnicos || []
    let tecs = ''

    for (const codTec of listaTecs) {
        const dados = await recuperarDado('dados_clientes', codTec) || {}
        tecs += maisTecnico(codTec, dados?.nome || 'N/A', true)
    }

    const linhas = [
        {
            elemento: `<div id="blocoTecnicos" style="${vertical};">${tecs}</div>`
        }
    ]

    const botoes = [
        { texto: 'Adicionar', img: 'baixar', funcao: `maisTecnico()` },
        { texto: 'Salvar', img: 'concluido', funcao: `salvarTecnicos('${id}')` },
    ]

    popup({ linhas, botoes, titulo: 'Técnicos na Obra' })

}

async function salvarTecnicos(id) {

    overlayAguarde()

    const tecnicos = []
    const spans = document.querySelectorAll('#blocoTecnicos span')

    for (const span of spans) {
        if (!span.id) continue
        if (tecnicos.includes(span.id)) continue
        tecnicos.push(span.id)
    }

    // Caso seja com base no orçamento;
    const orcamento = await recuperarDado('dados_orcamentos', id)
    orcamento.checklist ??= {}
    orcamento.checklist.tecnicos = tecnicos
    enviar(`dados_orcamentos/${id}/checklist/tecnicos`, tecnicos)
    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    removerPopup()

}

async function relatorioChecklist() {

    const colunas = {
        'Data': { chave: 'data' },
        'Descrição': { chave: 'descricao' },
        'Duração': {},
        'Quantidade': {},
        'Comentários': { chave: 'comentario' },
        'Técnicos': { chave: 'tecnicos' },
    }

    const modelo = (texto, elemento) => `
        <div class="balao-checklist">
            <label>${texto}</label>
            ${elemento}
        </div>`

    const tabela = modTab({
        pag: 'relatChecklist',
        funcaoAdicional: ['gerarRelatorioChecklist'],
        colunas,
        body: 'relatorioChecklist',
        base: () => baseRelatorioChecklist(),
        criarLinha: 'criarLinhaRelChecklist'
    })

    const elemento = `
    
        <div style="background-color: #d2d2d2; padding: 2rem;">

            <div class="toolbar-checklist" style="width: max-content; gap: 1rem;">
                ${modelo('De', `<input name="de" onchange="pesquisarDtChecklist()" type="date">`)}
                ${modelo('Até', `<input name="ate" onchange="pesquisarDtChecklist()" type="date">`)}
            </div>

            <hr>

            <div class="toolbar-relatorio">
                <span id="toolbar-relatorio" onclick="mostrarPagina('relatorio')">Relatório</span>
                <span id="toolbar-graficos" onclick="mostrarPagina('graficos')">Gráficos</span>
            </div>

            <div name="relatorio" style="${horizontal}; align-items: start; gap: 1rem;">

                ${tabela}

                <div class="calendarios"></div>

            </div>

            <div name="graficos" class="graficos"></div>

        </div>
    `

    popup({ elemento, titulo: 'Relatório Diário' })

    mostrarPagina('relatorio')

    await paginacao()

}

async function baseRelatorioChecklist() {

    const { id } = controles.checklist
    const { checklist, dados_composicoes } = await recuperarDado('dados_orcamentos', id)
    const dados = {}

    Object.entries(checklist?.itens || {})
        .forEach(([codigo, lancamentos]) => {

            const info = dados_composicoes?.[codigo] || checklist?.avulso?.[codigo] || {}

            Object.entries(lancamentos).forEach(([id, lancamento]) => {
                const item = { codigo, ...lancamento, codigo, ...info }
                item.data = conversorData(item?.data)
                return dados[id] = item
            })

        })

    return dados

}

async function criarLinhaRelChecklist(item) {

    const { codigo, descricao, data, qtde, quantidade, tecnicos, comentario } = item || {}

    const { tempo } = await recuperarDado('dados_composicoes', codigo) || '00:00'

    const qtdeTotal = qtde || 0

    const nomes = []

    for (const c of (tecnicos || [])) {
        const { nome } = await recuperarDado('dados_clientes', c)
        if (nome)
            nomes.push(nome)
    }

    const [h, m] = tempo.split(':').map(Number)
    const minUnit = h * 60 + m
    const executado = minUnit * quantidade
    const total = minUnit * qtdeTotal

    return `
        <tr>
            <td>${data}</td>
            <td>${descricao}</td>
            <td style="white-space: nowrap;">
                <input style="display:none;" name="executado" value="${executado}">
                <input style="display:none;" name="total" value="${total}">
                <input>
                ${strHHMM(executado)}
                /
                ${strHHMM(total)}
            </td>
            <td>${quantidade} / ${qtdeTotal}</td>
            <td>${comentario || ''}</td>
            <td style="text-align:left;">
                ${nomes.map(n => `• ${n}`).join('<br>')}
            </td>
        </tr>
    `

}

function mostrarPagina(pagina) {

    const paginas = ['relatorio', 'graficos', 'pagamentos', 'orcamento']
    for (const pg of paginas) {
        const el = document.querySelector(`[name="${pg}"]`)
        if (el) {
            el.style.display = 'none'
            document.getElementById(`toolbar-${pg}`).style.opacity = 0.5
        }
    }

    document.querySelector(`[name="${pagina}"]`).style.display = 'flex'
    document.getElementById(`toolbar-${pagina}`).style.opacity = 1

}

async function pesquisarDtChecklist(dt = null) {

    controles.relatChecklist.filtros ??= {}

    let filtro = {}

    if (!dt) {

        const de = document.querySelector('[name="de"]').value
        const ate = document.querySelector('[name="ate"]').value

        filtro = [
            { op: '>=d', value: de },
            { op: '<=d', value: ate },
        ]

    } else {

        filtro = { op: '=', value: dt }

    }

    controles.relatChecklist.filtros = {
        ...controles.relatChecklist.filtros,
        'data': filtro
    }

    await paginacao()

}

function criarCalendario(datas) {

    const meses = {
        1: 'Janeiro',
        2: 'Fevereiro',
        3: 'Março',
        4: 'Abril',
        5: 'Maio',
        6: 'Junho',
        7: 'Julho',
        8: 'Agosto',
        9: 'Setembro',
        10: 'Outubro',
        11: 'Novembro',
        12: 'Dezembro'
    }

    const ths = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        .map(sem => `<th>${sem}</th>`)
        .join('')

    const marcado = `style="background-color: green; color: white; cursor: pointer;"`

    // Transformar em objetos Date e agrupar por ano-mês;
    const grupos = {}
    datas.forEach(ts => {
        const d = new Date(ts)
        const ano = d.getFullYear()
        const mes = d.getMonth() + 1 // 1–12
        const chave = `${ano}-${mes}`
        if (!grupos[chave]) grupos[chave] = { ano, mes, dias: new Set() }
        grupos[chave].dias.add(d.getDate())
    })

    let calendarios = ''

    for (const chave in grupos) {
        const { ano, mes, dias } = grupos[chave]
        const diasMes = new Date(ano, mes, 0).getDate()

        let trs = ''
        let tds = ''
        let primeiroDia = new Date(ano, mes - 1, 1).getDay()

        // Espaços antes do primeiro dia
        for (let v = 0; v < primeiroDia; v++) {
            tds += `<td></td>`
        }

        for (let i = 1; i <= diasMes; i++) {
            const dt = new Date(ano, mes - 1, i)
            const sem = dt.getDay()

            tds += `<td onclick="pesquisarDtChecklist('${dt.toLocaleDateString()}')" ${dias.has(i) ? marcado : ''}>${i}</td>`

            if (sem === 6) {
                trs += `<tr>${tds}</tr>`
                tds = ''
            }
        }

        // Completar última linha
        if (tds) {
            for (let v = new Date(ano, mes - 1, diasMes).getDay() + 1; v <= 6; v++) {
                tds += `<td></td>`
            }
            trs += `<tr>${tds}</tr>`
        }

        calendarios += `
            <div class="borda-tabela">
                <div class="topo-tabela">
                    <span style="padding: 5px; color: white; font-size: 1.1rem;">${meses[mes]} • ${ano}</span>
                </div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead><tr>${ths}</tr></thead>
                        <tbody>${trs}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>
        `
    }

    document.querySelector('.calendarios').innerHTML = calendarios
}

async function gerarRelatorioChecklist() {

    let de = document.querySelector('[name="de"]').value
    let ate = document.querySelector('[name="ate"]').value

    const datas = []
    const quantidades = {}

    if (!de || !ate) return

    overlayAguarde()

    const coresPadrao = [
        'hsl(0, 70%, 50%)',
        'hsl(30, 70%, 50%)',
        'hsl(60, 70%, 45%)',
        'hsl(120, 60%, 45%)',
        'hsl(180, 60%, 45%)',
        'hsl(210, 70%, 55%)',
        'hsl(260, 60%, 60%)',
        'hsl(300, 65%, 55%)',
        'hsl(330, 65%, 55%)',
        'hsl(20, 70%, 45%)'
    ]

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)
    const itens = orcamento?.checklist?.itens || {}

    const dt = (iso) => {
        const [a, m, d] = iso.split('-')
        return new Date(a, m - 1, d)
    }

    de = dt(de)
    ate = dt(ate)

    const desempenhoEquipes = {}

    for (const [codigo, lancamentos] of Object.entries(itens)) {

        const { tempo } = await recuperarDado('dados_composicoes', codigo) || '00:00'

        for (const [_, dados] of Object.entries(lancamentos)) {

            if (_ == 'removido') continue

            quantidades[codigo] ??= 0
            quantidades[codigo] += dados.quantidade || 0

            const dLanc = dt(dados.data)
            if (dLanc < de || dLanc > ate) continue

            datas.push(dLanc.getTime())

            const nomes = []
            for (const c of (dados.tecnicos || [])) {
                const { nome } = await recuperarDado('dados_clientes', c)
                if (nome)
                    nomes.push(nome)
            }

            const equipeKey = nomes.join(', ') || 'Sem equipe'

            const [h, m] = tempo.split(':').map(Number)
            const minUnit = h * 60 + m
            const executado = minUnit * dados.quantidade
            const chaveData = dados.data

            desempenhoEquipes[equipeKey] ??= {}
            desempenhoEquipes[equipeKey][chaveData] ??= 0
            desempenhoEquipes[equipeKey][chaveData] += executado

        }
    }

    criarCalendario(datas)

    // ===========================================================
    // 1) MONTAR TODO O HTML DOS GRÁFICOS PRIMEIRO
    // ===========================================================
    const htmlGraficos = `
        <div style="${vertical}; gap: 0.5rem;">
            <div id="indicadores" style="${vertical}; gap: 4px;"></div>
            <canvas id="graficoLinha"></canvas>
            <hr>
            <canvas id="graficoBarraPequenos"></canvas>
            <hr>
            <canvas id="graficoBarraGrandes"></canvas>
        </div>
    `
    const graficos = document.querySelector('.graficos')
    graficos.innerHTML = htmlGraficos

    // obtém os elementos
    const canvasLinha = document.getElementById('graficoLinha')
    const ctx = canvasLinha.getContext('2d')
    const indicadoresDiv = document.getElementById('indicadores')

    // ===========================================================
    // 2) GRÁFICO DE LINHA (DESEMPENHO DIÁRIO)
    // ===========================================================

    const todasDatas = [...new Set(datas.map(ts => {
        const d = new Date(ts)
        return d.toISOString().slice(0, 10)
    }))].sort()

    const datasets = Object.entries(desempenhoEquipes).map(([equipe, reg], idx) => {

        const soma = Object.values(reg).reduce((a, b) => a + b, 0)
        const dias = Object.values(reg).filter(v => v > 0).length || 1

        const mediaDia = soma / dias
        const semanas = Math.ceil(dias / 7) || 1
        const mediaSem = soma / semanas

        indicadoresDiv.insertAdjacentHTML('beforeend', `
        <div style="${vertical}; gap: 2px;">
            <span><b>${equipe}</b></span>
            <span>Diário: ${mediaDia.toFixed(0)} min</span>
            <span>Semanal: ${mediaSem.toFixed(0)} min</span>
        </div>
    `)

        return {
            label: equipe,
            data: todasDatas.map(d => reg[d] || 0),
            fill: false,
            borderWidth: 2,
            tension: 0.2,
            borderColor: coresPadrao[idx % coresPadrao.length]
        }
    })

    const maxVal = Math.max(
        ...Object.values(desempenhoEquipes).flatMap(r => Object.values(r))
    ) || 0

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: todasDatas.map(d => {
                const [a, m, dd] = d.split('-')
                return `${dd}/${m}`
            }),
            datasets
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Desempenho diário (minutos executados)'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: Math.ceil(maxVal * 1.1),
                    ticks: { callback: v => v + ' min' }
                }
            }
        }
    })

    // ===========================================================
    // 3) GRÁFICOS DE BARRAS HORIZONTAIS (ORÇADO x REALIZADO)
    // ===========================================================

    const labelsPequenos = []
    const orcadoPequenos = []
    const realizadoPequenos = []

    const labelsGrandes = []
    const orcadoGrandes = []
    const realizadoGrandes = []

    for (const [cod, real] of Object.entries(quantidades)) {

        const { descricao } = await recuperarDado('dados_composicoes', cod) || 'N/A'
        const qtOrc = orcamento?.dados_composicoes?.[cod]?.qtde || 0
        const label = descricao

        if (qtOrc > 20) {
            labelsGrandes.push(label)
            orcadoGrandes.push(qtOrc)
            realizadoGrandes.push(real)
        } else {
            labelsPequenos.push(label)
            orcadoPequenos.push(qtOrc)
            realizadoPequenos.push(real)
        }
    }

    // inserir dois canvases

    const ctxPequenos = document.getElementById('graficoBarraPequenos').getContext('2d')
    const ctxGrandes = document.getElementById('graficoBarraGrandes').getContext('2d')

    // --- gráfico pequenos ---
    new Chart(ctxPequenos, {
        type: 'bar',
        data: {
            labels: labelsPequenos,
            datasets: [
                {
                    label: 'Orçado',
                    data: orcadoPequenos,
                    backgroundColor: '#6464ff99'
                },
                {
                    label: 'Realizado',
                    data: realizadoPequenos,
                    backgroundColor: '#64c86499'
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Comparativo Orçado x Executado (≤ 20 unidades)'
                }
            },
            scales: {
                x: { beginAtZero: true },
                y: { ticks: { autoSkip: false } }
            }
        }
    })

    // --- gráfico grandes ---
    new Chart(ctxGrandes, {
        type: 'bar',
        data: {
            labels: labelsGrandes,
            datasets: [
                {
                    label: 'Orçado',
                    data: orcadoGrandes,
                    backgroundColor: '#6464ffff'
                },
                {
                    label: 'Realizado',
                    data: realizadoGrandes,
                    backgroundColor: '#64c86499'
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Comparativo Orçado x Executado (> 20 unidades)'
                }
            },
            scales: {
                x: { beginAtZero: true },
                y: { ticks: { autoSkip: false } }
            }
        }
    })

    removerOverlay()
}


async function adicionarServicoAvulso() {

    controlesCxOpcoes.codigo = {
        base: 'dados_composicoes',
        retornar: ['descricao'],
        filtros: {
            'tipo': { op: '=', value: 'SERVIÇO' }
        },
        colunas: {
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao' },
        }
    }

    const elemento = `
        <div style="${horizontal}; gap: 10px; background-color: #d2d2d2; padding: 2rem;">
            ${modelo('Descrição', `<span name="codigo" onclick="cxOpcoes('codigo')" class="opcoes">Selecione</span>`)}
            ${modelo('Quantidade', `<input name="qtde" type="number" style="padding: 5px; border-radius: 3px;">`)}
            <img src="imagens/concluido.png" style="width: 2rem;" onclick="salvarAvulso()">
        </div>
    `

    popup({ elemento, titulo: 'Incluir Serviço', audoDestruicao: ['codigo'] })
}

async function salvarAvulso() {

    const qtde = Number(document.querySelector('[name="qtde"]').value)
    const codigo = document.querySelector('[name="codigo"]').id

    if (!qtde)
        return popup({ mensagem: 'Não deixe a quantidade em Branco' })

    overlayAguarde()
    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)
    orcamento.checklist ??= {}
    orcamento.checklist.avulso ??= {}

    const produto = await recuperarDado('dados_composicoes', codigo)

    const dados = {
        qtde,
        descricao: produto.descricao,
        usuario: acesso.usuario,
        data: new Date().toLocaleString()
    }

    orcamento.checklist.avulso[codigo] = dados

    enviar(`dados_orcamentos/${id}/checklist/avulso/${codigo}`, dados)
    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    removerPopup()
}

async function verItensRemovidos() {

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)
    let itens = Object.entries(orcamento?.checklist?.itens || {})
        .filter(([, dados]) => dados.removido)
        .map(([codigo,]) => {

            const descricao = orcamento?.dados_composicoes?.[codigo]?.descricao || orcamento?.checklist?.avulso?.[codigo]?.descricao || '...'

            return `
            <div style="${horizontal}; gap: 10px;">
                <img onclick="recuperarItem('${codigo}', this)" src="imagens/atualizar.png">
                <span>${descricao}</span> 
            </div>`
        })
        .join('')

    const elemento = `
        <div style="${vertical}; gap: 5px; padding: 1rem;">

            ${itens || `<span>Sem itens removidos até o momento`}

        </div>`

    popup({ elemento, titulo: 'Itens Removidos' })

}

async function recuperarItem(codigo, img) {

    overlayAguarde()
    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)

    delete orcamento.checklist.itens[codigo].removido

    deletar(`dados_orcamentos/${id}/checklist/itens/${codigo}/removido`)

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    img.closest('div').remove()
    removerOverlay()

}

async function removerItensEmMassaChecklist() {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]:checked')

    if (itensChecklist.length == 0)
        return

    overlayAguarde()

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)

    orcamento.checklist ??= {}
    orcamento.checklist.itens ??= {}

    for (const check of itensChecklist) {

        const codigo = check.dataset.codigo

        orcamento.checklist.itens[codigo] ??= {}
        const dados = {
            usuario: acesso.usuario,
            data: new Date().toLocaleString()
        }

        orcamento.checklist.itens[codigo].removido = dados

        enviar(`dados_orcamentos/${id}/checklist/itens/${codigo}/removido`, dados)

    }

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    removerOverlay()

}

function marcarItensChecklist(input) {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]')

    for (const check of itensChecklist) {
        const tr = check.closest('tr')
        check.checked = tr.style.display !== 'none' && input.checked
    }

}

async function atualizarTempo(input, codigo) {

    const produto = await recuperarDado('dados_composicoes', codigo)
    produto.tempo = input.value
    enviar(`dados_composicoes/${codigo}/tempo`, input.value)
    await inserirDados({ [codigo]: produto }, 'dados_composicoes')

    input.classList = input.value !== ''
        ? 'on'
        : 'off'

}

async function calcularTemposChecklist() {

    const dados = await baseChecklist()

    let minutosObra = 0
    let minutosExecutado = 0
    let totalAtividades = 0
    let diasTrabalhados = new Set()

    const lista = Object.values(dados)

    for (const item of lista) {

        totalAtividades++

        const qtde = item.qtde || 0
        const qReal = item.qReal || 0
        const tempoUnitario = item.tempo

        const [h, m] = tempoUnitario.split(':').map(Number)
        const minutosUnit = (h * 60) + m

        const baseQuantidade = qtde || qReal

        const minutosTotais = minutosUnit * baseQuantidade
        minutosObra += minutosTotais

        let executadoItem = 0

        if (item.itens) {
            for (const chave in item.itens) {
                const exec = item.itens[chave]
                executadoItem += Number(exec.quantidade || 0)
                diasTrabalhados.add(exec.data)
            }
        }

        const minutosExecLinha = minutosUnit * executadoItem
        minutosExecutado += minutosExecLinha
    }

    const minutosPendentes = minutosObra - minutosExecutado
    const totalDiasPrevisto = Math.ceil(minutosObra / 480)
    const previsao = Math.ceil(minutosPendentes / 480)

    const calculo = calcularDiasCorridos([...diasTrabalhados])
    const diasCorridos = calculo.dias
    const inicio = calculo.inicio

    return {
        inicio,
        diasCorridos,
        diasTrabalhados: diasTrabalhados.size,
        totalAtividades,
        minutosObra,
        minutosExecutado,
        minutosPendentes,
        totalDiasPrevisto,
        previsao,
        porcentagem: minutosObra
            ? ((minutosExecutado / minutosObra) * 100).toFixed(1)
            : 0
    }
}

function calcularDiasCorridos(listaDatas) {

    if (!listaDatas || listaDatas.length === 0) return 0

    function parseDataLocal(dataStr) {
        const [ano, mes, dia] = dataStr.split('-').map(Number)
        return new Date(ano, mes - 1, dia)
    }

    const maisAntiga = listaDatas
        .map(d => parseDataLocal(d))
        .sort((a, b) => a - b)[0]

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const dif = hoje - maisAntiga

    return {
        dias: Math.floor(dif / 86400000),
        inicio: maisAntiga
    }
}

async function calcularTempos() {

    const {
        inicio,
        minutosObra,
        diasCorridos,
        diasTrabalhados,
        minutosExecutado,
        totalAtividades,
        minutosPendentes,
        totalDiasPrevisto,
        previsao,
        porcentagem
    } = await calcularTemposChecklist()

    const modelo = (texto, valor) => `
        <div class="balao-checklist">
            <label>${texto}</label>
            <span>${valor}</span>
        </div>`

    const divInicio = document.getElementById('inicio')
    if (divInicio)
        divInicio.textContent = inicio?.toLocaleDateString() || ''

    const divResultados = document.querySelector('.resultados')

    let resultados = ''

    resultados += modelo('Total de Atividades', totalAtividades)
    resultados += modelo('Dias Até Hoje', diasCorridos)
    resultados += modelo('Dias Trabalhados', diasTrabalhados)
    resultados += modelo('Conclusão <br>em Dias', previsao)
    resultados += modelo('Tempo Total', strHHMM(minutosObra))
    resultados += modelo('Tempo Realizado', strHHMM(minutosExecutado))
    resultados += modelo('Tempo Pendente', strHHMM(minutosPendentes))

    const analise = (diasTrabalhados + previsao) <= totalDiasPrevisto
    const strAnalise = analise
        ? 'Entrega no Prazo'
        : diasTrabalhados > totalDiasPrevisto
            ? 'Atrasado'
            : 'Possível Atraso'

    resultados += modelo('Status', `
    <div style="${horizontal}; gap: 5px;">
        ${strAnalise}
        <img src="imagens/${analise ? 'joinha' : 'atrasado'}.png" style="width: 2rem;">
    </div>`)

    divResultados.innerHTML = resultados

    document.getElementById('porcentagem').innerHTML = `
        <div style="${vertical}">
            <span>Porcentagem de conclusão</span>
            ${divPorcentagem(porcentagem)}
        </div>`
}

async function registrarChecklist(codigo) {

    overlayAguarde()

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const itens = orcamento?.checklist?.itens?.[codigo] || {}

    const data = (data) => {
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    let linhas = ''

    // Bloqueio por excesso de quantidade;
    quantidadeRealizadoItem = 0
    quantidadeItem = orcamento?.checklist?.qReal?.[codigo]?.qtde || orcamento?.dados_composicoes?.[codigo]?.qtde || orcamento?.checklist?.avulso?.[codigo]?.qtde || 0

    for (const [idLancamento, dados] of Object.entries(itens)) {

        quantidadeRealizadoItem += dados.quantidade

        const nomesTecnicos = []

        for (const tcod of (dados?.tecnicos || [])) {
            const { nome } = await recuperarDado('dados_clientes', tcod)
            if (nome)
                nomesTecnicos.push(nome)
        }

        linhas += `
        <tr>
            <td>${data(dados.data)}</td>
            <td>
                <div style="${horizontal}; gap: 0.5rem;">
                    <input style="width: 5rem; text-align: center;" class="opcoes"  oninput="mostrarBtn(this)" type="number" value="${dados.quantidade}">
                    <img src="imagens/concluido.png" style="display: none; width: 1.5rem;" onclick="alterarQuantidadeChecklist(this, '${idLancamento}', '${codigo}', ${dados.quantidade})">
                </div>
            </td>
            <td style="white-space: pre-wrap;">${nomesTecnicos.join('\n')}</td>
            <td>
                <div style="${horizontal}; gap: 0.5rem;">
                    <textarea oninput="mostrarBtn(this)">${dados?.comentario || ''}</textarea>
                    <img src="imagens/concluido.png" style="display: none; width: 1.5rem;" onclick="alterarComentario(this, '${idLancamento}', '${codigo}')">
                </div>
            </td>
            <td><img src="imagens/cancel.png" style="width: 1.5rem;" onclick="removerChecklist('${codigo}', '${idLancamento}')"></td>
        </tr>`
    }

    const acumulado = `
        <div id="blocoTecnicos"></div>

        <hr style="width: 100%;">

        <span>Quantidade Orçada: ${quantidadeItem}</span>

        <div class="form-checklist">
            <input name="quantidadeForm" type="number">
            <input name="data" type="date">
            <textarea name="comentario" placeholder="Comentário"></textarea>
            <img src="imagens/concluido.png" style="width: 1.5rem;" onclick="salvarQuantidade('${codigo}')">
        </div>
        
        <hr style="width: 100%;">

        <div class="borda-tabela">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <tr>${['Data', 'Quantidade', 'Técnico(s)', 'Comentário', 'Excluir'].map(op => `<th>${op}</th>`).join('')}</tr>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    const formChecklist = document.querySelector('.painel-registro-checklist')
    if (!formChecklist)
        popup({ elemento: `<div class="painel-registro-checklist">${acumulado}</div>`, titulo: 'Registrar' })
    else
        formChecklist.innerHTML = acumulado

    for (const codTec of orcamento?.checklist?.tecnicos || []) {
        const { nome } = await recuperarDado('dados_clientes', codTec) || '...'
        maisTecnico(codTec, nome)
    }
}

async function alterarComentario(img, idLancamento, codigo) {

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)

    const textarea = img.previousElementSibling
    const comentario = textarea.value
    orcamento.checklist.itens[codigo][idLancamento].comentario = comentario
    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id}/checklist/itens/${codigo}/${idLancamento}/comentario`, comentario)

    img.style.display = 'none'

}

function mostrarBtn(input) {
    const img = input.nextElementSibling
    img.style.display = ''
}

async function alterarQuantidadeChecklist(img, idLancamento, codigo, qtdeAnterior) {

    const input = img.previousElementSibling
    const quantidade = Number(input.value)

    img.style.display = 'none'

    if (((quantidadeRealizadoItem - qtdeAnterior) + quantidade) > quantidadeItem)
        return input.value = qtdeAnterior

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)

    orcamento.checklist.itens[codigo][idLancamento].quantidade = quantidade

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${id}/checklist/itens/${codigo}/${idLancamento}/quantidade`, quantidade)

}

function maisTecnico(cod, nome, devolver) {
    const blocoTecnicos = document.getElementById('blocoTecnicos')
    cod = cod || ID5digitos()
    nome = nome || 'Selecione'

    if (document.getElementById(cod))
        return

    controlesCxOpcoes[cod] = {
        base: 'dados_clientes',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' },
            'CNPJ/CPF': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' }
        }
    }

    const modelo = `
        <div style="${horizontal}; justify-content: start; gap: 5px;">
            <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="this.parentElement.remove()">
            <span class="opcoes" id="${cod}" name="${cod}" onclick="cxOpcoes('${cod}')">${nome}</span>
        </div>`

    if (devolver)
        return modelo

    if (blocoTecnicos)
        blocoTecnicos.insertAdjacentHTML('beforeend', modelo)
}

async function salvarQuantidade(codigo) {

    overlayAguarde()

    const tecnicos = []
    const spanTecnicos = document.querySelectorAll('#blocoTecnicos span')

    for (const span of spanTecnicos) if (!tecnicos.includes(span.id)) tecnicos.push(span.id)

    const form = document.querySelector('.form-checklist')

    const quantidade = Number(form.querySelector('[name="quantidadeForm"]').value)
    const data = form.querySelector('[name="data"]').value
    const comentario = form.querySelector('[name="comentario"]').value

    // Bloqueios;
    if ((quantidadeRealizadoItem + quantidade) > quantidadeItem)
        return popup({ mensagem: 'Não é possível exceder a quantidade orçada' })

    if (!tecnicos.length) {
        await registrarChecklist(codigo)
        return popup({ mensagem: 'É necessário ter pelo menos 1 técnico realizando a atividade...', titulo: 'Ninguém fez?' })
    }

    if (!quantidade || !data)
        return popup({ mensagem: 'Preencha todos os campos' })

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)

    orcamento.checklist ??= {}
    orcamento.checklist.itens ??= {}
    orcamento.checklist.itens[codigo] ??= {}

    const dados = { quantidade, tecnicos, data, comentario }
    const idLancamento = ID5digitos()

    orcamento.checklist.itens[codigo][idLancamento] = dados

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    removerPopup()

    enviar(`dados_orcamentos/${id}/checklist/itens/${codigo}/${idLancamento}`, dados)

}

async function removerChecklist(codigo, idLancamento) {

    overlayAguarde()

    const { id } = controles.checklist
    const orcamento = await recuperarDado('dados_orcamentos', id)
    delete orcamento.checklist.itens[codigo][idLancamento]

    deletar(`dados_orcamentos/${id}/checklist/itens/${codigo}/${idLancamento}`)

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    removerPopup()
    await registrarChecklist(codigo)

    removerOverlay()

}

function calculadoraChecklist() {

    const bodyChecklist = document.getElementById('bodyChecklist')
    const trs = bodyChecklist.querySelectorAll('tr')

    for (const tr of trs) {
        const tds = document.querySelectorAll('td')

        const qtdeOrcamento = conversor(tds[1].textContent)
        const qtdeRealizada = conversor(tds[2].textContent)

        tds[3].textContent = conversor(qtdeOrcamento - qtdeRealizada)

    }

}
