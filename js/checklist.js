let quantidadeGeral = 0
let quantidadeRealizadoGeral = 0
let previsao = 0
let diasTrabalhados = []
let tecnicos = {}
let quantidadeItem = 0
let quantidadeRealizadoItem = 0
let finalizados = 0
let filtroChecklist = {}
let filtroRelatorioChecklist = {}
let primeiroDia = null
let tagsPainel = null

const strHHMM = (minutosTotais, str) => {

    const horas = Math.floor(minutosTotais / 60)
    const minutos = minutosTotais % 60
    const calculado = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`

    return str ? `${calculado}${str}` : calculado
}

const estT = (tempo) => {
    return !tempo ? 'off' : tempo == '00:00' ? 'zero' : 'on'
}

async function telaChecklist() {

    tecnicos = {}

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let ths = ''
    let pesquisa = ''
    const colunas = ['', 'Código', 'Itens do Orçamento', 'Qtd. Orçada', 'Qtd. Real', 'Tempo/Atividade', 'Tempo/Total', 'Serviço Executado', 'Tempo/Realizado', '% Conclusão']

    let i = 0
    for (const op of colunas) {

        if (op == '') {
            ths += `<th><input type="checkbox" onclick="marcarItensChecklist(this)"></th>`
            pesquisa += `<th style="background-color: white;"></th>`

        } else {
            pesquisa += `<th style="background-color: white; text-align: left;" contentEditable="true" oninput="pesquisarGenerico('${i}', this.textContent, filtroChecklist, 'bodyChecklist'); calcularTempos()"></th>`
            ths += `
            <th>
                <div style="${horizontal}; justify-content: space-between; width: 100%; gap: 10px;">
                    <span>${op}</span>
                    <img src="imagens/filtro.png" style="width: 1rem;" onclick="filtrarAAZ(${i}, 'bodyChecklist')"> 
                </div>
            </th>`
        }

        i++
    }

    const acumulado = `
        <div style="${vertical}; padding: 1rem; background-color: #d2d2d2;">

            <div class="toolbar-checklist">

                <div style="${vertical}; align-items: center; width: 50%;">

                    <div style="${horizontal}; justify-content: space-evenly; width: 100%;">
                        <div id="porcentagem" style="padding: 0.5rem;"></div>
                        <span>Obra iniciada em: <b><span id="inicio"></span></b> </span>
                    </div>

                    <div class="opcoes-orcamento">
                        ${modeloBotoes('gerente', 'Técnicos na Obra', `tecnicosAtivos()`)}
                        ${modeloBotoes('cancel', 'Remover Itens Selecionados', `removerItensEmMassaChecklist()`)}
                        ${modeloBotoes('checklist', 'Ver Itens Removidos', `verItensRemovidos()`)}
                        ${modeloBotoes('baixar', 'Serviço Avulso', `adicionarServicoAvulso()`)}
                        ${modeloBotoes('relatorio', 'Relatório', `relatorioChecklist()`)}
                        ${modeloBotoes('atualizar3', 'Atualizar', `atualizarChecklist()`)}
                    </div>
                </div>

                <div class="resultados"></div>

            </div>

            <div id="tabelaCheklist" class="borda-tabela">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${ths}</tr>
                            <tr>${pesquisa}</tr>
                        </thead>
                        <tbody id="bodyChecklist"></tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>

        </div>
    `

    tagsTemporarias = await recuperarDados('tags')
    const dados_composicoes = await recuperarDados('dados_composicoes')
    const omieCliente = orcamento?.dados_orcam?.omie_cliente || false
    const cliente = await recuperarDado('dados_clientes', omieCliente)
    const titulo = `Checklist - ${orcamento?.dados_orcam?.contrato || '--'} - ${cliente?.nome || '--'}`

    const tabelaCheklist = document.getElementById('tabelaCheklist')
    if (!tabelaCheklist) popup(acumulado, titulo, true)

    // Reset;
    quantidadeGeral = 0
    finalizados = 0
    diasTrabalhados = []
    primeiroDia = null

    const mesclado = {
        ...orcamento?.dados_composicoes || {},
        ...orcamento?.checklist?.avulso || {}
    }

    for (const [codigo, produto] of Object.entries(mesclado)) {

        if (produto.tipo == 'VENDA') continue

        const qReal = orcamento?.checklist?.qReal?.[codigo] || {}
        const check = orcamento?.checklist?.itens?.[codigo] || {}
        const ref = dados_composicoes?.[codigo] || {}
        carregarLinhaChecklist({ codigo, produto, check, ref, qReal })

        for (const [id, dados] of Object.entries(check)) {

            if (id == 'removido') continue

            // Registro do primeiro dia;
            const [ano, mes, dia] = dados.data.split('-')
            const dt = new Date(ano, Number(mes) - 1, dia).getTime()
            if (primeiroDia == null || primeiroDia > dt) primeiroDia = dt
            // Fim

            for (const idTec of dados?.tecnicos || []) {
                const tecnico = dados_clientes?.[idTec] || {}
                tecnicos[idTec] = tecnico?.nome || 'Desatualizado...'
            }

        }
    }

    calcularTempos()

    const dataInicio = primeiroDia ? new Date(primeiroDia).toLocaleDateString() : 'Sem data'

    document.getElementById('inicio').textContent = dataInicio

    if (!orcamento) return

    orcamento.checklist ??= {}
    orcamento.checklist.inicio = dataInicio
    orcamento.checklist.andamento = porcetagemFinal

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await telaOrcamentos(true)
    enviar(`dados_orcamentos/${id_orcam}/checklist/inicio`, dataInicio)
    enviar(`dados_orcamentos/${id_orcam}/checklist/andamento`, porcetagemFinal)

}

function carregarLinhaChecklist({ codigo, produto, check, qReal, ref }) {

    if (check.removido) {
        const linha = document.getElementById(`check_${codigo}`)
        if (linha) linha.remove()
        return
    }

    let quantidade = 0
    const diasTrabalhadosLinha = []
    for (const [, dados] of Object.entries(check)) {

        quantidade += isNaN(dados.quantidade) ? 0 : dados.quantidade
        if (!diasTrabalhados.includes(dados.data)) diasTrabalhados.push(dados.data)
        if (!diasTrabalhadosLinha.includes(dados.data)) diasTrabalhadosLinha.push(dados.data)

    }

    const avulso = produto.tipo ? '' : '<span><b>[Avulso]</b></span>'

    // Relatório
    finalizados += quantidade / produto.qtde
    quantidadeRealizadoGeral += quantidade
    quantidadeGeral++

    const fontMaior = 'class="fonte-maior"'

    const tds = `
        <td><input name="itensChecklist" type="checkbox"></td>
        <td>${codigo}</td>
        <td style="text-align: right;">${produto.descricao} ${avulso}</td>
        <td ${fontMaior} name="quantidade">
            ${avulso
            ? `<input type="number" name="real" oninput="salvarQtdAvulso(this, '${codigo}')" class="qtd" value="${produto.qtde || ''}">`
            : produto.qtde
        }
        </td>
        <td>
            ${avulso
            ? '<img src="imagens/cancel.png">'
            : `<input type="number" name="real" oninput="salvarQtdReal(this, '${codigo}')" class="qtd" value="${qReal?.qtde || ''}">`
        }
        </td>
        <td>
            <div style="${vertical};">
                <input 
                    name="tempoUnitario" 
                    oninput="atualizarTempo(this, '${codigo}')" 
                    type="time" 
                    class="${estT(ref?.tempo || produto?.tempo)}"
                    value="${ref?.tempo || produto?.tempo || ''}">
                <span>por <b>${produto?.unidade || 'UND'}</b></span>
            </div>
        </td>
        <td ${fontMaior} name="totalLinha"></td>
        <td>
            <div style="${horizontal}; gap: 10px;">
                <span ${fontMaior} name="quantidadeExecutada">${quantidade}</span>
                <img onclick="registrarChecklist('${codigo}')" src="imagens/baixar.png" style="width: 1.2rem;">
            </div>
        </td>
        <td ${fontMaior} name="totalLinhaExecutado"></td>
        <td>
            <div name="porcentagem"></div>
        </td>

    `

    const trExistente = document.getElementById(`check_${codigo}`)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('bodyChecklist').insertAdjacentHTML('beforeend', `
        <tr 
        data-avulso="${avulso ? 'S' : 'N'}"
        data-codigo="${codigo}" 
        id="check_${codigo}">
            ${tds}
        </tr>
        `)

}

async function salvarQtdAvulso(input, codigo) {

    const qtde = Number(input.value)
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    orcamento.checklist.avulso[codigo].qtde = qtde

    calcularTempos()

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id_orcam}/checklist/avulso/${codigo}/qtde`, qtde)

}

async function salvarQtdReal(input, codigo) {

    const qtde = Number(input.value)
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    orcamento.checklist.qReal ??= {}
    orcamento.checklist.qReal[codigo] ??= {}
    orcamento.checklist.qReal[codigo].qtde = qtde

    calcularTempos()

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id_orcam}/checklist/qReal/${codigo}/qtde`, qtde)

}

async function tagsChecklist(codigo) {
    tagsPainel = await new TagsPainel({
        funcao: 'telaChecklist',
        baseTags: 'tags',
        idRef: codigo,
        baseRef: 'dados_composicoes'
    }).init()

    tagsPainel.painelTags()
}

async function tecnicosAtivos() {

    const acumulado = `
        <div style="${vertical}; padding: 1rem; background-color: #d2d2d2;">
            <span>Gerencie abaixo os envolvidos na Obra</span>
            <hr>
            <div class="painel-clientes">
                <div id="blocoTecnicos" style="${vertical};"></div>
            </div>
        </div>

        <div class="rodape-painel-clientes">
            ${botaoRodape('maisTecnico()', 'Adicionar', 'baixar')}
            ${botaoRodape('salvarTecnicos()', 'Salvar', 'concluido')}
        </div>
    `
    popup(acumulado, 'Técnicos na Obra', true)

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    for (const codTec of orcamento?.checklist?.tecnicos || []) {
        const dados = await recuperarDado('dados_clientes', codTec)
        maisTecnico(codTec, dados?.nome || 'N/A')
    }
}

async function salvarTecnicos() {

    overlayAguarde()

    const tecnicos = []
    const spans = document.querySelectorAll('#blocoTecnicos span')

    for (const span of spans) {
        if (!span.id) continue
        if (tecnicos.includes[span.id]) continue
        tecnicos.push(span.id)
    }

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    orcamento.checklist ??= {}
    orcamento.checklist.tecnicos = tecnicos

    enviar(`dados_orcamentos/${id_orcam}/checklist/tecnicos`, tecnicos)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    removerPopup()

}

async function relatorioChecklist() {

    let ths = ''
    let pesquisa = ''

    const colunas = ['Data', 'Descrição', 'Duração', 'Quantidade', 'Comentário', 'Técnicos']
        .map((op, i) => {

            ths += `<th>${op}</th>`
            pesquisa += `
            <th 
                style="background-color: white; text-align: left;" 
                contentEditable="true" 
                oninput="pesquisarGenerico('${i}', this.textContent, filtroRelatorioChecklist, 'relatorioChecklist'); auxiliarTotaisRelatorio();">
            </th>`

        })

    const modelo = (texto, elemento) => `
        <div class="balao-checklist">
            <label>${texto}</label>
            ${elemento}
        </div>
    `
    const ano = new Date().getFullYear()

    const acumulado = `
    
        <div style="background-color: #d2d2d2; padding: 2rem;">

            <div class="toolbar-checklist" style="width: max-content; gap: 1rem;">
                ${modelo('De', `<input name="de" onchange="gerarRelatorioChecklist()" type="date" value="${ano}-01-01">`)}
                ${modelo('Até', `<input name="ate" onchange="gerarRelatorioChecklist()" type="date" value="${ano}-12-31">`)}
                ${modelo('Horas Executadas', `<span id="he"></span>`)}
                ${modelo('Horas Totais', `<span id="ht"></span>`)}
            </div>

            <hr style="width: 100%;">

            <div class="toolbar-relatorio">
                <span id="toolbar-relatorio" onclick="mostrarPagina('relatorio')">Relatório</span>
                <span id="toolbar-graficos" onclick="mostrarPagina('graficos')">Gráficos</span>
            </div>

            <div class="relatorio">
                <div id="tabelaCheklist" class="borda-tabela">
                    <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela" id="tabela_composicoes">
                            <thead>
                                <tr>${ths}</tr>
                                <tr>${pesquisa}</tr>
                            </thead>
                            <tbody id="relatorioChecklist"></tbody>
                        </table>
                    </div>
                    <div class="rodapeTabela"></div>
                </div>

                <div class="calendarios"></div>

            </div>

            <div class="graficos"></div>

        </div>

    `

    popup(acumulado, 'Relatório Diário', true)

    mostrarPagina('relatorio')
    auxiliarTotaisRelatorio()
    await gerarRelatorioChecklist()

}

function mostrarPagina(pagina) {

    const paginas = ['relatorio', 'graficos', 'pagamentos', 'orcamento']
    for (const pg of paginas) {
        const el = document.querySelector(`.${pg}`)
        if (el) {
            el.style.display = 'none'
            document.getElementById(`toolbar-${pg}`).style.opacity = 0.5
        }
    }

    document.querySelector(`.${pagina}`).style.display = ''
    document.getElementById(`toolbar-${pagina}`).style.opacity = 1

}

function criarCalendario(datas) {
    const ths = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        .map(sem => `<th>${sem}</th>`)
        .join('')

    const marcado = `style="background-color: green; color: white;"`

    // transformar em objetos Date e agrupar por ano-mês
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

    const pesqAuto = (texto) => `pesquisarGenerico('0', '${texto}', filtroRelatorioChecklist, 'relatorioChecklist'); auxiliarTotaisRelatorio()`

    for (const chave in grupos) {
        const { ano, mes, dias } = grupos[chave]
        const diasMes = new Date(ano, mes, 0).getDate()

        let trs = ''
        let tds = ''
        let primeiroDia = new Date(ano, mes - 1, 1).getDay()

        // espaços antes do primeiro dia
        for (let v = 0; v < primeiroDia; v++) {
            tds += `<td></td>`
        }

        for (let i = 1; i <= diasMes; i++) {
            const dt = new Date(ano, mes - 1, i)
            const sem = dt.getDay()

            tds += `<td onclick="${pesqAuto(dt.toLocaleDateString())}" ${dias.has(i) ? marcado : ''}>${i}</td>`

            if (sem === 6) {
                trs += `<tr>${tds}</tr>`
                tds = ''
            }
        }

        // completar última linha
        if (tds) {
            for (let v = new Date(ano, mes - 1, diasMes).getDay() + 1; v <= 6; v++) {
                tds += `<td></td>`
            }
            trs += `<tr>${tds}</tr>`
        }

        calendarios += `
            <div class="borda-tabela">
                <div class="topo-tabela">
                    <span style="padding: 5px;">${mes}/${ano}</span>
                </div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead><tr>${ths}</tr></thead>
                        <tbody>${trs}</tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>
        `
    }

    document.querySelector('.calendarios').innerHTML = calendarios
}

function auxiliarTotaisRelatorio() {
    const linhas = document.querySelectorAll('#relatorioChecklist tr')

    const totais = {
        executado: 0,
        total: {}
    }

    for (const linha of linhas) {

        if (linha.style.display == 'none') continue

        const codigo = linha.dataset.codigo
        const executado = Number(linha.querySelector('[name="executado"]').value)
        const total = Number(linha.querySelector('[name="total"]').value)

        totais.executado += executado
        if (!totais.total[codigo]) totais.total[codigo] = total

    }

    let ht = 0
    for (const [, total] of Object.entries(totais.total)) ht += total

    document.getElementById('he').textContent = strHHMM(totais.executado)
    document.getElementById('ht').textContent = strHHMM(ht)

}

async function gerarRelatorioChecklist() {

    const tbody = document.getElementById('relatorioChecklist')
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
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const itens = orcamento?.checklist?.itens || {}
    const dados_clientes = await recuperarDados('dados_clientes')
    const dados_composicoes = await recuperarDados('dados_composicoes')

    const dt = (iso) => {
        const [a, m, d] = iso.split('-')
        return new Date(a, m - 1, d)
    }

    de = dt(de)
    ate = dt(ate)

    tbody.innerHTML = ''

    const atividades = {
        ...orcamento?.dados_composicoes,
        ...orcamento?.checklist?.avulso
    }

    const desempenhoEquipes = {}

    for (const [codigo, lancamentos] of Object.entries(itens)) {

        const comp = atividades[codigo]
        const produto = dados_composicoes?.[codigo] || {}
        const descricao = comp?.descricao || '...'
        const qtdeTotal = comp?.qtde || 0

        for (const [_, dados] of Object.entries(lancamentos)) {

            if (_ == 'removido') continue

            quantidades[codigo] ??= 0
            quantidades[codigo] += dados.quantidade || 0

            const dLanc = dt(dados.data)
            if (dLanc < de || dLanc > ate) continue

            datas.push(dLanc.getTime())

            const nomes = (dados.tecnicos || [])
                .map(c => dados_clientes?.[c]?.nome || '...')
                .sort((a, b) => a.localeCompare(b))

            const equipeKey = nomes.join(', ') || 'Sem equipe'

            const tempo = produto?.tempo || '00:00'
            const [h, m] = tempo.split(':').map(Number)
            const minUnit = h * 60 + m
            const executado = minUnit * dados.quantidade
            const total = minUnit * qtdeTotal

            const chaveData = dados.data

            desempenhoEquipes[equipeKey] ??= {}
            desempenhoEquipes[equipeKey][chaveData] ??= 0
            desempenhoEquipes[equipeKey][chaveData] += executado

            tbody.insertAdjacentHTML('beforeend', `
                <tr data-data="${dLanc.getTime()}" data-codigo="${codigo}">
                    <td>${dLanc.toLocaleDateString('pt-BR')}</td>
                    <td>${descricao}</td>
                    <td style="white-space: nowrap;">
                        <input style="display:none;" name="executado" value="${executado}">
                        <input style="display:none;" name="total" value="${total}">
                        <input>
                        ${strHHMM(executado)}
                        /
                        ${strHHMM(total)}
                    </td>
                    <td>${dados.quantidade} / ${qtdeTotal}</td>
                    <td>${dados.comentario || ''}</td>
                    <td style="text-align:left;">
                        ${nomes.map(n => `• ${n}`).join('<br>')}
                    </td>
                </tr>
            `)
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

        const ref = dados_composicoes?.[cod] || {}
        const qtOrc = orcamento?.dados_composicoes?.[cod]?.qtde || 0
        const label = ref.descricao || 'N/A'

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

    ordenarLinhasPorData()
    removerOverlay()
}

function ordenarLinhasPorData() {
    const tbody = document.querySelector('#relatorioChecklist')
    if (!tbody) return

    const linhas = [...tbody.querySelectorAll('tr')]

    linhas.sort((a, b) => Number(b.dataset.data) - Number(a.dataset.data))

    linhas.forEach(tr => tbody.appendChild(tr))
}

async function atualizarChecklist() {
    await sincronizarDados('dados_orcamentos')
    await telaChecklist()
}

async function adicionarServicoAvulso() {

    const acumulado = `
        <div style="${horizontal}; gap: 10px; background-color: #d2d2d2; padding: 2rem;">
            ${modelo('Descrição', `<span name="codigo" onclick="cxOpcoes('codigo', 'dados_composicoes', ['descricao', 'codigo', 'tipo', 'modelo', 'fabricante'])" class="opcoes">Selecione</span>`)}
            ${modelo('Quantidade', `<input name="qtde" type="number" style="padding: 5px; border-radius: 3px;">`)}
            <img src="imagens/concluido.png" style="width: 2rem;" onclick="salvarAvulso()">
        </div>
    `

    popup(acumulado, 'Incluir Serviço', true)
}

async function salvarAvulso() {

    const qtde = Number(document.querySelector('[name="qtde"]').value)
    const codigo = document.querySelector('[name="codigo"]').id

    if (!qtde) return popup(mensagem('Não deixe a quantidade em Branco'), 'Alerta', true)

    overlayAguarde()
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
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

    enviar(`dados_orcamentos/${id_orcam}/checklist/avulso/${codigo}`, dados)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await telaChecklist()
    removerPopup()
}

async function verItensRemovidos() {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let itens = ''

    for (const [codigo, dados] of Object.entries(orcamento?.checklist?.itens || {})) {

        if (!dados.removido) continue

        const descricao = orcamento?.dados_composicoes?.[codigo]?.descricao || orcamento?.checklist?.avulso?.[codigo]?.descricao || '...'

        itens += `
            <div style="${horizontal}; gap: 10px;">
                <img onclick="recuperarItem('${codigo}', this)" src="imagens/atualizar3.png" style="width: 1.2rem;">
                <span>${descricao}</span> 
            </div>
        `
    }

    const acumulado = `
        <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 2vw; min-width: 30vw;">

            ${itens}

        </div>
    
    `

    popup(acumulado, 'Itens Removidos', true)

}

async function recuperarItem(codigo, img) {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    delete orcamento.checklist.itens[codigo].removido

    deletar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/removido`)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()

    img.closest('div').remove()

}

async function removerItensEmMassaChecklist() {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]:checked')

    if (itensChecklist.length == 0) return

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.checklist) orcamento.checklist = {}
    if (!orcamento.checklist.itens) orcamento.checklist.itens = {}

    for (const check of itensChecklist) {

        const tr = check.closest('tr')
        const codigo = tr.dataset.codigo

        if (!orcamento.checklist.itens[codigo]) orcamento.checklist.itens[codigo] = {}
        const dados = { usuario: acesso.usuario, data: new Date().toLocaleString() }
        orcamento.checklist.itens[codigo].removido = dados

        enviar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/removido`, dados)

    }

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    removerOverlay()
    await telaChecklist()
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

    input.classList = input.value !== '' ? 'on' : 'off'
    calcularTempos()

}

function calcularTempos() {
    const linhas = document.querySelectorAll('#bodyChecklist tr')

    let minutosObra = 0
    let minutosExecutado = 0
    for (const linha of linhas) {

        if (linha.style.display == 'none') continue

        const avulso = linha.dataset.avulso == 'S'
        const elemQtReal = linha.querySelector('[name="real"]')
        const qReal = Number(elemQtReal.value)
        const qtde = Number(linha.querySelector('[name="quantidade"]').textContent)
        const qtdeExecutada = Number(linha.querySelector('[name="quantidadeExecutada"]').textContent)

        // Alerta para real > orçado;
        elemQtReal.classList = (qReal > qtde && !avulso) ? 'off' : 'qtd'

        const tdTotal = linha.querySelector('[name="totalLinha"]')
        const totalExecutado = linha.querySelector('[name="totalLinhaExecutado"]')

        const inputTempoUnitario = linha.querySelector('[name="tempoUnitario"]')
        const tempoUnitario = inputTempoUnitario.value

        if (!tempoUnitario) {
            tdTotal.textContent = ''
            totalExecutado.textContent = ''
            continue
        }

        const [h, m] = tempoUnitario.split(':').map(Number)
        const minutosUnit = h * 60 + m

        // total da linha
        const minutosTotais = minutosUnit * (qReal || qtde)
        minutosObra += minutosTotais

        const calculado = strHHMM(minutosTotais)
        tdTotal.textContent = minutosTotais > 480 ? `${strHHMM(minutosTotais)} / ${Math.ceil((minutosTotais / 60) / 8)} D` : strHHMM(minutosTotais)
        inputTempoUnitario.classList = estT(calculado)

        // Porcentagem
        const porcentagemDiv = linha.querySelector('[name="porcentagem"]')
        porcentagemDiv.innerHTML = divPorcentagem(((qtdeExecutada / (qReal || qtde)) * 100).toFixed(1))

        // total executado da linha
        const minutosExecutados = minutosUnit * qtdeExecutada
        totalExecutado.textContent = minutosExecutados > 480 ? `${strHHMM(minutosExecutados)} / ${Math.ceil((minutosExecutados / 60) / 8)} D` : strHHMM(minutosExecutados)
        minutosExecutado += minutosExecutados
    }

    const modelo = (texto, valor) => `
        <div class="balao-checklist">
            <label>${texto}</label>
            <span>${valor}</span>
        </div>
    `

    const divResultados = document.querySelector('.resultados')

    let resultados = ''
    const minutosPendentes = minutosObra - minutosExecutado
    const totalDiasPrevisto = Math.ceil(minutosObra / 480)
    const dTrab = diasTrabalhados.length
    const previsao = Math.ceil(minutosPendentes / 480) // 480min -- 8h -- 1dia
    const analise = (dTrab + previsao) <= totalDiasPrevisto
    const strAnalise = analise
        ? 'Entrega no Prazo'
        : dTrab > totalDiasPrevisto
            ? 'Atrasado'
            : 'Possível Atraso'

    resultados += modelo('Total de Atividades', linhas?.length || 0)
    resultados += modelo('Dias Até Hoje', diasCorridos(diasTrabalhados))
    resultados += modelo('Dias Trabalhados', dTrab)
    resultados += modelo('Conclusão <br>em Dias', previsao)

    resultados += '<div></div>' // Vazio para deixar o espaço em branco;

    resultados += modelo('Horas Totais', `${strHHMM(minutosObra, 'h')} <br> ${totalDiasPrevisto} dias`)
    resultados += modelo('Horas Realizadas', strHHMM(minutosExecutado, 'h'))
    resultados += modelo('Horas Pendentes', strHHMM(minutosPendentes, 'h'))

    resultados += modelo('Análise', strAnalise)
    resultados += `<div style="${horizontal}"><img src="imagens/${analise ? 'joinha' : 'atrasado'}.png" style="width: 4rem;"></div>`


    divResultados.innerHTML = resultados

    porcetagemFinal = ((minutosExecutado / minutosObra) * 100).toFixed(1)

    document.getElementById('porcentagem').innerHTML = `
        <div style="${vertical}">
            <span>Porcentagem de conclusão</span>
            ${divPorcentagem(porcetagemFinal)}
        </div>
    `
}

async function registrarChecklist(codigo) {

    overlayAguarde()

    const orcamento = dados_orcamentos[id_orcam]
    const itens = orcamento?.checklist?.itens?.[codigo] || {}

    const data = (data) => {
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    let linhas = ''

    // Bloqueio por excesso de quantidade;
    quantidadeRealizadoItem = 0
    quantidadeItem = orcamento?.checklist?.qReal[codigo]?.qtde || orcamento?.dados_composicoes?.[codigo]?.qtde || orcamento?.checklist?.avulso?.[codigo].qtde || 0

    for (const [idLancamento, dados] of Object.entries(itens)) {

        quantidadeRealizadoItem += dados.quantidade

        const nomesTecnicos = (dados?.tecnicos || [])
            .map(idTec => `<span>${dados_clientes?.[idTec]?.nome || '--'}</span>`)
            .join('')

        linhas += `
        <tr>
            <td>${data(dados.data)}</td>
            <td>
                <div style="${horizontal}; gap: 0.5rem;">
                    <input style="width: 5rem; text-align: center;" class="opcoes"  oninput="mostrarBtn(this)" type="number" value="${dados.quantidade}">
                    <img src="imagens/concluido.png" style="display: none; width: 1.5rem;" onclick="alterarQuantidadeChecklist(this, '${idLancamento}', '${codigo}', ${dados.quantidade})">
                </div>
            </td>
            <td>
                <div style="${vertical}">
                    ${nomesTecnicos}
                </div>
            </td>
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
            <div class="rodapeTabela"></div>
        </div>
    `

    const formChecklist = document.querySelector('.painel-registro-checklist')
    if (!formChecklist) popup(`<div class="painel-registro-checklist">${acumulado}</div>`, 'Registrar', true)
    else formChecklist.innerHTML = acumulado

    for (const codTec of orcamento?.checklist?.tecnicos || []) {
        const dados = dados_clientes[codTec]
        maisTecnico(codTec, dados?.nome || 'N/A')
    }
}

async function alterarComentario(img, idLancamento, codigo) {

    const textarea = img.previousElementSibling
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const comentario = textarea.value
    orcamento.checklist.itens[codigo][idLancamento].comentario = comentario
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/${idLancamento}/comentario`, comentario)

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

    if (((quantidadeRealizadoItem - qtdeAnterior) + quantidade) > quantidadeItem) return input.value = qtdeAnterior

    const orcamento = dados_orcamentos[id_orcam]

    orcamento.checklist.itens[codigo][idLancamento].quantidade = quantidade

    await telaChecklist()
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/${idLancamento}/quantidade`, quantidade)

}

function maisTecnico(cod, nome) {
    const blocoTecnicos = document.getElementById('blocoTecnicos')
    cod = cod || ID5digitos()
    nome = nome || 'Selecione'

    if (document.getElementById(cod)) return

    const modelo = `
        <div style="${horizontal}; gap: 5px;">
            <span class="opcoes" id="${cod}" name="${cod}" onclick="cxOpcoes('${cod}', 'dados_clientes', ['nome', 'cnpj', 'cidade'])">${nome}</span>
            <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="this.parentElement.remove()">
        </div>
    `

    if (blocoTecnicos) blocoTecnicos.insertAdjacentHTML('beforeend', modelo)
}

async function salvarQuantidade(codigo) {

    overlayAguarde()

    const tecnicos = []
    const spanTecnicos = document.querySelectorAll('#blocoTecnicos span')

    for (const span of spanTecnicos) if (!tecnicos.includes(span.id)) tecnicos.push(span.id)

    const quantidade = Number(document.querySelector('[name="quantidadeForm"]').value)
    const data = document.querySelector('[name="data"]').value
    const comentario = document.querySelector('[name="comentario"]').value

    // Bloqueios;
    if ((quantidadeRealizadoItem + quantidade) > quantidadeItem) return popup(mensagem('Não é possível exceder a quantidade orçada'), 'Alerta', true)

    if (!tecnicos.length) {
        await registrarChecklist(codigo)
        return popup(mensagem('É necessário ter pelo menos 1 técnico realizando a atividade...'), 'Ninguém fez?', true)
    }

    if (!quantidade || !data) return popup(mensagem('Preencha todos os campos'), 'Alerta', true)

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    orcamento.checklist ??= {}
    orcamento.checklist.itens ??= {}
    orcamento.checklist.itens[codigo] ??= {}

    const dados = { quantidade, tecnicos, data, comentario }
    const idLancamento = ID5digitos()

    orcamento.checklist.itens[codigo][idLancamento] = dados

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()

    removerPopup()

    enviar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/${idLancamento}`, dados)

}

async function removerChecklist(codigo, idLancamento) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    delete orcamento.checklist.itens[codigo][idLancamento]

    deletar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/${idLancamento}`)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()
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

function diasCorridos(listaDatas) {
    if (!listaDatas || listaDatas.length === 0) return 0

    const maisAntiga = listaDatas
        .map(d => new Date(d))
        .sort((a, b) => a - b)[0]

    const hoje = new Date()
    const dif = hoje - maisAntiga

    return Math.floor(dif / (1000 * 60 * 60 * 24))
}
