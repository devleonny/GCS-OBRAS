let filtrosOrcamento = {}
let filtroPDA = {}
let intervaloCompleto
let intervaloCurto
let filtro;
let naoArquivados = true
let meusOrcamentos = true
let auxiliarFaturamento = {}
let baloes = document.querySelector('.baloes-top')
let layout = null

const meses = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro'
}

async function atualizarOrcamentos() {

    const tabelas = [
        'dados_orcamentos',
        'dados_composicoes',
        'dados_clientes',
        'dados_ocorrencias',
        'departamentos_AC'
    ]

    for (const tabela of tabelas) await sincronizarDados(tabela)

    await auxDepartamentos()
    await telaOrcamentos()
    await sincronizarTags()

}

function ordenarOrcamentos(colunaIndex) {
    const body = document.getElementById('linhas')
    if (!body) return

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    const ordem = tabelaOrcamento.dataset.ordem
    tabelaOrcamento.dataset.ordem = ordem === 'asc' ? 'des' : 'asc'

    // pega as linhas base
    const linhas = Array.from(body.querySelectorAll('.linha-orcamento-tabela'))

    // cria um mapeamento linha → container
    const pares = linhas.map(linha => ({
        linha,
        container: linha.closest('.linha-master')
    }))

    pares.sort((a, b) => {
        const celA = a.linha.querySelectorAll('.celula')[colunaIndex]
        const celB = b.linha.querySelectorAll('.celula')[colunaIndex]

        const valA = celA?.querySelector('input, select')?.value?.trim() || celA?.textContent?.trim() || ''
        const valB = celB?.querySelector('input, select')?.value?.trim() || celB?.textContent?.trim() || ''

        const numA = parseFloat(valA.replace(',', '.'))
        const numB = parseFloat(valB.replace(',', '.'))

        if (!isNaN(numA) && !isNaN(numB))
            return ordem === 'asc' ? numA - numB : numB - numA

        return ordem === 'asc'
            ? valA.localeCompare(valB, 'pt-BR', { numeric: true, sensitivity: 'base' })
            : valB.localeCompare(valA, 'pt-BR', { numeric: true, sensitivity: 'base' })
    })

    // limpa e reinsere os containers ordenados (evita duplicar o mesmo container)
    const vistos = new Set()
    body.innerHTML = ''
    for (const { container } of pares) {
        if (container && !vistos.has(container)) {
            body.appendChild(container)
            vistos.add(container)
        }
    }
}

function pesquisarOrcamentos({ ultimoStatus = filtro || 'TODOS', col, texto } = {}) {

    filtro = ultimoStatus

    if (col !== undefined && col !== null)
        filtrosOrcamento[col] = String(texto).toLowerCase().trim()

    if (filtrosOrcamento.status_col_1)
        localStorage.setItem('salvo', JSON.stringify(filtrosOrcamento.status_col_1))

    const body = document.getElementById('linhas')
    const linhas = body.querySelectorAll('.linha-orcamento-tabela')

    const totais = { CHAMADO: 0, TODOS: 0, 'SEM STATUS': 0 }
    const visiveis = { CHAMADO: 0, TODOS: 0, 'SEM STATUS': 0 }
    const listaStatus = new Set(['TODOS', 'CHAMADO'])
    const containersInfo = new Map()

    const ignorarStatusCol1 = ultimoStatus !== 'CHAMADO'

    for (const linha of linhas) {
        const status = linha.querySelector('[name="status"]')?.value || ''
        const statusKey = status || 'SEM STATUS'
        const chamado = linha.dataset.chamado || 'N'
        const isChamado = chamado === 'S'
        const container = linha.closest('.linha-master')
        if (!container) continue

        totais[statusKey] = (totais[statusKey] || 0) + 1
        totais.TODOS++
        if (isChamado) totais.CHAMADO = (totais.CHAMADO || 0) + 1
        listaStatus.add(statusKey)
        if (isChamado) listaStatus.add('CHAMADO')

        if (!containersInfo.has(container))
            containersInfo.set(container, { linhas: [], temChamado: false })
        containersInfo.get(container).linhas.push(linha)
        if (isChamado) containersInfo.get(container).temChamado = true

        let visivel = true

        for (const key of Object.keys(filtrosOrcamento).filter(k => k.startsWith('status_col_'))) {
            if (ignorarStatusCol1 && key === 'status_col_1') continue

            const valores = filtrosOrcamento[key]
            const coluna = parseInt(key.replace('status_col_', ''))
            const cel = linha.querySelectorAll('.celula')[coluna]
            if (!cel) continue

            const select = cel.querySelector('select')
            const valor = select ? select.value : cel.textContent.trim()

            const incluirBranco = Array.isArray(valores) && valores.includes('SEM STATUS')

            if (incluirBranco) {
                if (!(valor === '' || valores.includes(valor))) visivel = false
            } else {
                if (!valores.includes(valor)) visivel = false
            }
        }

        const celulas = linha.querySelectorAll('.celula')
        for (const chave in filtrosOrcamento) {
            const termo = filtrosOrcamento[chave]
            if (!termo || chave.startsWith('status_col_')) continue

            const celula = celulas[chave]
            if (!celula) continue

            const valor = Array.from(celula.querySelectorAll('*'))
                .map(el => {
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value
                    if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || ''
                    return el.textContent
                })
                .join(' ')
                .toLowerCase()
                .trim()

            if (!valor.includes(termo)) {
                visivel = false
                break
            }
        }

        linha.dataset._visivel = visivel ? 'S' : 'N'
    }

    for (const [container, info] of containersInfo) {
        const { linhas, temChamado } = info
        let mostrarContainer = false

        for (const linha of linhas) {
            const status = linha.querySelector('[name="status"]')?.value || ''
            const statusKey = status || 'SEM STATUS'
            const chamado = linha.dataset.chamado || 'N'
            const isChamado = chamado === 'S'

            let visivel = linha.dataset._visivel === 'S'

            if (filtro && filtro !== 'TODOS') {
                if (filtro === 'CHAMADO') {
                    visivel = temChamado && visivel
                } else if (filtro === 'SEM STATUS') {
                    visivel = visivel && statusKey === 'SEM STATUS'
                } else {
                    visivel = visivel && statusKey === filtro
                }
            }

            linha.style.display = visivel ? '' : 'none'
            if (visivel) {
                mostrarContainer = true
                visiveis[statusKey] = (visiveis[statusKey] || 0) + 1
                visiveis.TODOS = (visiveis.TODOS || 0) + 1
                if (isChamado) visiveis.CHAMADO = (visiveis.CHAMADO || 0) + 1
            }
        }

        container.style.display = mostrarContainer ? '' : 'none'
    }

    const toolbar = document.getElementById('toolbar')
    toolbar.innerHTML = ''
    const tempFluxograma = ['CHAMADO', 'TODOS', ...fluxograma]

    if (listaStatus.has('SEM STATUS') && !tempFluxograma.includes('SEM STATUS'))
        tempFluxograma.push('SEM STATUS')

    for (const st of tempFluxograma) {
        if (!listaStatus.has(st)) continue

        const ativo = filtro ? filtro === st : st === 'TODOS'
        const opacity = ativo ? 1 : 0.5

        toolbar.insertAdjacentHTML('beforeend', `
            <div style="opacity:${opacity}" class="aba-toolbar"
                 onclick="pesquisarOrcamentos({ultimoStatus:'${st}'})">
                <label>${inicialMaiuscula(st)}</label>
                <span>${ativo ? visiveis[st] ?? 0 : totais[st] ?? 0}</span>
            </div>
        `)
    }
}

async function rstTelaOrcamentos() {
    tela.innerHTML = ''
    await telaOrcamentos()
}

async function telaOrcamentos(semOverlay) {

    // Ocultar a barra de rolagem
    document.body.style.overflow = 'hidden'

    const pda = document.querySelector('.tela-gerenciamento')
    if (pda) return await telaInicial()

    atualizarToolbar(true) // GCS no título

    const salvo = JSON.parse(localStorage.getItem('salvo')) // Filtro Status
    if (salvo) filtrosOrcamento.status_col_1 = salvo

    funcaoTela = 'telaOrcamentos'

    if (!semOverlay) overlayAguarde()

    const colunasCFiltro = ['Status', 'Tags', 'Chamado', 'Cidade', 'Valor']
    const cabecs = ['Data/LPU', 'Status', 'Pedido', 'Notas', 'Tags', 'Chamado', 'Cidade', 'Responsáveis', 'Indicadores', 'Valor', 'Ações']
    let ths = ''
    let pesquisa = ''
    cabecs.forEach((cab, i) => {

        ths += `
            <div class="ths-orcamento">
                <span>${cab}</span>
                ${cab == 'Status'
                ? `<img src="imagens/filtro.png" onclick="filtroStatus(${i}, this)">`
                : colunasCFiltro.includes(cab)
                    ? `<img onclick="ordenarOrcamentos('${i}')" src="imagens/filtro.png">`
                    : ''}
            </div>`
        pesquisa += `
            <div class="ths-orcamento">
                ${(cab !== 'Ações' && cab !== 'Status' && cab !== 'Indicadores')
                ? `<input placeholder="Pesquisar" name="col_${i}"  oninput="pesquisarOrcamentos({col: ${i}, texto: this.value})" >`
                : ''}
            </div>`

    })

    const acumulado = `
        <div style="${horizontal}; width: 95vw;">
            <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
            <div id="toolbar"></div>
            <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
        </div>

        <div id="tabelaOrcamento" data-ordem="asc" style="${vertical}; width: 95vw;">
            <div class="topo-tabela"></div>
            <div class="div-tabela" style="overflow-x: hidden;">
                <div class="cabecalho">
                    <div class="linha-orcamento-tabela" style="width: 100%; padding: 0px; background-color: #d2d2d2;">${ths}</div>
                    <div class="linha-orcamento-tabela" style="padding: 0px;">${pesquisa}</div>
                </div>
                <div id="linhas"></div>
            </div>
            <div class="rodape-tabela"></div>
        </div>
        `

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    if (!tabelaOrcamento) tela.innerHTML = acumulado

    await auxDepartamentos()
    tags_orcamentos = await recuperarDados('tags_orcamentos')

    const parseData = data => {
        if (!data || typeof data !== 'string') return 0

        const partes = data.split(',').map(p => p.trim())
        const d = partes[0]
        const t = partes[1] || '00:00'

        const [dia, mes, ano] = d.split('/').map(Number)
        if (!dia || !mes || !ano) return 0

        const [hora, minuto] = t.split(':').map(Number)
        const h = isNaN(hora) ? 0 : hora
        const m = isNaN(minuto) ? 0 : minuto

        const date = new Date(ano, mes - 1, dia, h, m)
        return isNaN(date.getTime()) ? 0 : date.getTime()
    }

    const hierarquizado = Object.fromEntries(
        Object.entries(dados_orcamentos).sort(([, a], [, b]) => {
            const hA = a?.hierarquia ? 1 : 0
            const hB = b?.hierarquia ? 1 : 0
            if (hA !== hB) return hA - hB

            const tA = parseData(a?.dados_orcam?.data)
            const tB = parseData(b?.dados_orcam?.data)

            return tA - tB
        })
    )

    let idsAtivos = []

    for (const [idOrcamento, orcamento] of Object.entries(hierarquizado)) {
        if (orcamento.origem !== origem) continue
        if (naoArquivados && orcamento.arquivado) continue
        if (!naoArquivados && !orcamento.arquivado) continue
        if (!meusOrcamentos && orcamento?.dados_orcam?.analista !== acesso?.nome_completo) continue

        idsAtivos.push(idOrcamento)
        criarLinhaOrcamento(idOrcamento, orcamento)
    }

    const body = document.getElementById('linhas')
    if (!body) return

    const linhas = body.querySelectorAll('.linha-orcamento-tabela')
    const idsAtuais = Array.from(linhas)
        .map(l => l.id)
        .filter(Boolean)

    for (const idAtual of idsAtuais) {
        if (!idsAtivos.includes(idAtual)) {
            const el = document.getElementById(idAtual)
            if (!el) continue
            const container = el.closest('.linha-master') || el
            container.remove()
        }
    }

    if (!semOverlay) pesquisarOrcamentos()

    criarMenus('orcamentos')

    // Devolver as pesquisas;
    for (const [col, termo] of Object.entries(filtrosOrcamento)) {
        const cabechalho = document.querySelector(`[name="col_${col}"]`)
        if (cabechalho) cabechalho.value = termo
    }

    if (!semOverlay) removerOverlay()

}

function filtroStatus(col) {

    const filtro = document.querySelector('.filtro')
    if (filtro) filtro.remove()

    const body = document.getElementById('linhas')
    const linhas = body.querySelectorAll('.linha-orcamento-tabela')

    let termos = []
    linhas.forEach(l => {
        const cel = l.querySelectorAll('.celula')[col]
        if (!cel) return
        const select = cel.querySelector('select')
        const valor = select ? select.value : cel.textContent.trim()
        if (valor) termos.push(valor)
    })

    termos = [...new Set(termos)]
    const colKey = `status_col_${col}`
    filtrosOrcamento[colKey] ||= []

    let htmlMarcadas = `
        <div class="opcao">
            <input type="checkbox"
                    onchange="marcarTodosStatus('${colKey}', this)"
                    ${filtrosOrcamento[colKey].length === termos.length ? 'checked' : ''}>
            <label>Marcar todos</label>
        </div>
    `
    let htmlDesmarcadas = ''

    termos.forEach(op => {
        const marcado = filtrosOrcamento[colKey].includes(op)
        const bloco = `
            <div class="opcao">
                <input type="checkbox"
                       onchange="acumularStatus('${colKey}', '${op}', this)"
                       ${marcado ? 'checked' : ''}>
                <label>${op}</label>
            </div>
        `
        if (marcado) htmlMarcadas += bloco
        else htmlDesmarcadas += bloco
    })

    const box = `
        <div style="${vertical}; min-width: 300px; gap: 0.5rem; background-color: #d2d2d2; padding: 1rem;">

            <div style="${horizontal}; padding-left: 0.5rem; padding-right: 0.5rem; margin: 5px; background-color: white; border-radius: 10px;">
                <input oninput="filtrarOpcoes(this)" placeholder="Pesquisar itens" style="width: 100%;">
                <img src="imagens/pesquisar4.png" style="width: 2rem; padding: 0.5rem;"> 
            </div>

            <div id="caixaOpcoes">
                ${htmlMarcadas}
                ${htmlDesmarcadas}
            </div>

        </div>
    `
    popup(box, 'Filtrar por Status', true)
}


function acumularStatus(colKey, valor, input) {
    if (!filtrosOrcamento[colKey]) filtrosOrcamento[colKey] = []

    if (input.checked) {
        if (!filtrosOrcamento[colKey].includes(valor))
            filtrosOrcamento[colKey].push(valor)
    } else {
        filtrosOrcamento[colKey] = filtrosOrcamento[colKey].filter(v => v !== valor)
    }

    filtrarStatusAplicar()
}

function marcarTodosStatus(colKey, inputTodos) {
    const caixa = document.getElementById('caixaOpcoes')
    const checks = caixa.querySelectorAll('input[type="checkbox"]')

    filtrosOrcamento[colKey] = []

    checks.forEach(c => {
        c.checked = inputTodos.checked
        if (c.checked) filtrosOrcamento[colKey].push(c.nextElementSibling.textContent)
    })

    if (filtrosOrcamento[colKey].length == 0) delete filtrosOrcamento[colKey]

    filtrarStatusAplicar()
}

function filtrarStatusAplicar() {
    const keys = Object.keys(filtrosOrcamento).filter(k => k.startsWith('status_col_'))

    if (keys.length === 0) {
        filtro = null
        return pesquisarOrcamentos()
    }

    const colKey = keys[0]
    const valores = filtrosOrcamento[colKey]

    if (!valores.length) {
        filtro = null
        return pesquisarOrcamentos()
    }

    filtro = null
    pesquisarOrcamentos({})
}


function scrollar(direcao) {

    direcao = direcao == 'next' ? 1 : -1
    const movimento = 1000 * direcao
    const toolbar = document.getElementById('toolbar')

    if (toolbar) toolbar.scrollBy({ left: movimento, behavior: 'smooth' })

}

function criarLinhaOrcamento(idOrcamento, orcamento) {

    const dados_orcam = orcamento.dados_orcam
    if (!dados_orcam) return

    const cliente = dados_clientes?.[dados_orcam.omie_cliente] || {}
    let labels = {
        PEDIDO: '',
        FATURADO: ''
    }

    for (const [, historico] of Object.entries(orcamento?.status?.historico || {})) {

        if (labels[historico.status] == undefined) continue
        if (historico.tipo == 'Remessa') continue

        const valor1 = historico.tipo
        const valor2 = historico.status == 'FATURADO' ? historico.nf : historico.pedido
        const valor3 = conversor(historico.valor)

        labels[historico.status] += `
            <div class="etiquetas"> 
                <label>${valor1}</label>
                <label>${valor2}</label>
                ${historico.valor ? `<label>${dinheiro(valor3)}</label>` : ''}
            </div>
            `
    }

    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const totalCustos = Object.values(orcamento?.dados_custos || {}).reduce((acc, val) => acc + val, 0)
    const lucratividade = orcamento.total_geral - totalCustos
    const lucratividadePorcentagem = Number(((lucratividade / orcamento.total_geral) * 100).toFixed(0))

    const responsaveis = Object.entries(orcamento.usuarios || {})
        .map(([user,]) => user)
        .join(', ')

    const cel = (elementos) => `<div class="celula">${elementos}</div>`

    const revisao = orcamento?.revisoes?.atual || null
    const labelRevisao = revisao ? `<label class="etiqueta-revisao">${revisao}</label>` : ''
    const numOficial = dados_orcam?.chamado || dados_orcam?.contrato || '-'

    const numOrcamento = `
        <div style="${horizontal}; gap: 5px;">
            <span><b>${numOficial}</b></span>
            <div name="icone"></div>
            ${labelRevisao}
        </div>
    `
    const orcamentoMaster = dados_orcamentos?.[orcamento?.hierarquia] || {}
    const numOficialMaster = orcamentoMaster?.dados_orcam?.chamado || orcamentoMaster?.dados_orcam?.contrato || '-'
    const orcamentosVinculados = orcamento.hierarquia
        ? `
        <div style="${horizontal}; gap: 5px;">
            <span><b>${numOficialMaster}</b></span>
            <img src="imagens/link.png" onclick="confirmarRemoverVinculo('${idOrcamento}')" style="width: 1.5rem;">
            ${numOrcamento}
        </div>
        `
        : numOrcamento

    const [data, hora] = (dados_orcam?.data || '-/-/-, --:--').split(', ')

    // De orçamentos Pendentes;
    const info = Object.values(orcamento?.status?.historicoStatus || {}).filter(s => s.info)

    const opcoesPda = abas.map(aba => `<option ${orcamento.aba == aba ? 'selected' : ''}>${aba}</option>`).join('')

    const celulas = `
        ${cel(`
            <div style="${vertical}; gap: 2px;">
                <label><b>${orcamento.lpu_ativa}</b></label>
                <span>${data}</span>
                <select name="aba" class="opcoesSelect" onchange="atualizarAba(this, '${idOrcamento}')">
                    <option></option>
                    ${opcoesPda}
                </select>
            </div>
        `)}
        ${cel(`
            <div style="${vertical}; gap: 5px;">
                <div style="${horizontal}; gap: 2px;">
                    <select name="status" class="opcoesSelect" onchange="id_orcam = '${idOrcamento}'; alterarStatus(this)">
                        ${opcoes}
                    </select>
                    ${(info.length > 0 && st == 'ORC PENDENTE') ? `<img onclick="mostrarInfo('${idOrcamento}')" src="gifs/interrogacao.gif">` : ''}
                </div>
                <div style="${horizontal}; width: 100%; justify-content: end; gap: 5px;">
                    <span>Departamento</span>
                    <img src="imagens/${depPorDesc[numOficial] ? 'concluido' : 'cancel'}.png" style="width: 1.5rem;">
                </div>
            </div>
        `)}
        ${cel(`<div class="bloco-etiquetas">${labels.PEDIDO}</div>`)}
        ${cel(`<div class="bloco-etiquetas">${labels.FATURADO}</div>`)}
        ${cel(`
            <div style="${horizontal}; justify-content: space-between; width: 100%; align-items: start; gap: 2px;">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${renderAtivas({ idOrcamento, recarregarPainel: false })}
                </div>
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="renderPainel('${idOrcamento}')">
            </div>
            `)}
        ${cel(`
        <div style="${vertical};">
            ${(acesso.permissao && dados_orcam.cliente_selecionado)
            ? `*<img onclick="painelAlteracaoCliente('${idOrcamento}')" src="gifs/alerta.gif" style="width: 1.5vw; cursor: pointer;">`
            : ''}
            ${orcamentosVinculados}
            <span>${cliente?.nome || ''}</span>
        </div>`)}
        ${cel(`${cliente?.cidade || ''}`)}
        ${cel(`
            <div style="${vertical}">
                <span>${orcamento?.usuario || '--'}</span>
                <span>${responsaveis}</span>
            </div>
        `)}
        ${cel(`
            <div style="${vertical}; width: 100%; gap: 2px;">
                ${orcamento?.checklist?.andamento
                    ? `
                    <span>Checklist</span>
                    ${divPorcentagem(orcamento.checklist.andamento)}`
                    : ''}
                ${orcamento.dados_custos
                    ? `
                    <span>LC %</span>
                    ${divPorcentagem(lucratividadePorcentagem)}`
                    : ''}
            </div>
            `)}
        ${cel(`
            <div style="${vertical}; width: 100%;">
                <input style="display: none;" type="number" value="${orcamento.total_geral}">
                <span style="font-size: 0.8rem; white-space: nowrap;">${dinheiro(orcamento.total_geral)}</span>
            </div>
            `)}
        ${cel(`<img onclick="abrirAtalhos('${idOrcamento}')" src="imagens/pesquisar2.png" style="width: 1.5rem;">`)}
        `

    if (orcamento.hierarquia) { // slaves;

        // Verificar o slave em outro master; (Sim) Remove a linha;
        const slaveExistenteIDFIXO = document.getElementById(idOrcamento)
        if (slaveExistenteIDFIXO) {
            const idMaster = slaveExistenteIDFIXO.dataset.master
            if (idMaster !== orcamento.hierarquia) slaveExistenteIDFIXO.remove()
        }

        const existente = document.getElementById(orcamento.hierarquia)
        const linhaSlave = existente.nextElementSibling

        // Cor e ícone no elemento Master;
        existente.style.backgroundColor = '#ffdea4ff'
        const divIcone = existente.querySelector('[name="icone"]')
        divIcone.innerHTML = `<img src="imagens/pasta.png" style="width: 1.5rem;">`

        const slaveExistente = linhaSlave.querySelector(`#${idOrcamento}`)

        if (slaveExistente) return slaveExistente.innerHTML = celulas

        const novaLinhaSlave = `
            <div 
                style="background-color: #ffe5b7;"
                class="linha-orcamento-tabela"
                data-chamado="${orcamento?.chamado ? 'S' : 'N'}"
                data-master="${orcamento.hierarquia}"
                data-hierarquia="slave"
                data-timestamp="${orcamento?.timestamp}"
                id="${idOrcamento}">
                    ${celulas}
            </div>`

        linhaSlave.insertAdjacentHTML('beforeend', novaLinhaSlave)

    } else { // masters

        const existente = document.getElementById(idOrcamento)
        if (existente) {
            if (existente.dataset.timestamp == orcamento.timestamp) return

            if (orcamento?.master == '') {
                existente.style.backgroundColor = 'white'
                existente.style.marginTop = '0px'
            }
            return existente.innerHTML = celulas
        }

        const novaLinha = `
        <div class="linha-master">
            <div 
                class="linha-orcamento-tabela"
                data-hierarquia="master"
                data-chamado="${orcamento?.chamado ? 'S' : 'N'}"
                data-timestamp="${orcamento?.timestamp}" 
                id="${idOrcamento}">
                    ${celulas}
            </div>
            <div class="linha-slaves"></div>
        </div>`

        const divLinhas = document.getElementById('linhas')
        if(!divLinhas) return
        divLinhas.insertAdjacentHTML('afterbegin', novaLinha)
    }
}

function mostrarInfo(idOrcamento) {

    const orcamento = dados_orcamentos[idOrcamento]
    const info = Object.values(orcamento?.status?.historicoStatus || {}).filter(s => s.info)

    const infoElementos = info.map(i => `
        <div class="etiquetas">
            <span><b>Data:</b> ${i.data}</span>
            <span><b>Usuário:</b> ${i.usuario}</span>
            <span>${i.info}</span>
        </div>
        `).join('')

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">
            ${infoElementos}
        </div>
    `

    popup(acumulado, 'Informações', true)

}

async function painelAlteracaoCliente(idOrcamento) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const dados_clientes = await recuperarDados('dados_clientes')
    const opcoes = Object.entries(dados_clientes)
        .map(([codOmie, cliente]) => `<option value="${codOmie}">${cliente.cnpj} - ${cliente.nome}</option>`)
        .join('')

    const acumulado = `
    <div style="display: flex; align-items: start; flex-direction: column; justify-content: center; padding: 2vw; background-color: #d2d2d2;">

        ${modelo('Cliente', orcamento.dados_orcam.cliente_selecionado)}
        ${modelo('Cliente', orcamento.dados_orcam.cnpj)}
        ${modelo('Cliente', orcamento.dados_orcam.cidade)}

        <hr style="width: 100%;">

        <label for="clientes">Clientes Omie</label>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
            <input style="padding: 5px; width: 100%; border-radius: 3px;" list="clientes" id="cliente">
            <datalist id="clientes">${opcoes}</datalist>
            ${botao('Salvar', `associarClienteOrcamento('${idOrcamento}')`, 'green')}
        </div>

    </div>
    `

    popup(acumulado, 'ATUALIZAR CLIENTE')
}

async function associarClienteOrcamento(idOrcamento) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    const codOmie = document.getElementById('cliente').value

    orcamento.dados_orcam.omie_cliente = Number(codOmie)
    delete orcamento.dados_orcam.cliente_selecionado
    delete orcamento.dados_orcam.cidade
    delete orcamento.dados_orcam.cnpj
    delete orcamento.dados_orcam.estado
    delete orcamento.dados_orcam.cep
    delete orcamento.dados_orcam.bairro
    delete orcamento.dados_orcam.cliente_selecionado

    enviar(`dados_orcamentos/${idOrcamento}/dados_orcam`, orcamento.dados_orcam)

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    pesquisarOrcamentos()

    removerPopup()

}

async function editar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    if (orcamentoBase.aprovacao) delete orcamentoBase.aprovacao

    await baseOrcamento(orcamentoBase)

    removerPopup()

    precosAntigos = null

    orcamentoBase.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function duplicar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    let novoOrcamento = {}

    novoOrcamento.dados_orcam = orcamentoBase.dados_orcam
    novoOrcamento.esquema_composicoes = orcamentoBase.esquema_composicoes
    novoOrcamento.dados_composicoes = orcamentoBase.dados_composicoes
    novoOrcamento.lpu_ativa = orcamentoBase.lpu_ativa
    novoOrcamento.dados_orcam.contrato = ''
    novoOrcamento.dados_orcam.analista = acesso.nome_completo
    novoOrcamento.dados_orcam.email_analista = acesso.email
    novoOrcamento.dados_orcam.telefone_analista = acesso.telefone

    baseOrcamento(novoOrcamento)

    removerPopup()

    precosAntigos = null

    novoOrcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function excelOrcamentos() {

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Orçamentos')

    // Encontra todas as linhas da tabela
    const linhas = document.querySelectorAll('.linha-orcamento-tabela')

    for (let rowIndex = 0; rowIndex < linhas.length; rowIndex++) {

        if (rowIndex == 1) continue

        const linha = linhas[rowIndex]
        // Seleciona tanto os cabeçalhos (ths-orcamento) quanto as células normais (celula)
        const celulas = linha.querySelectorAll('.ths-orcamento, .celula')
        let row = []

        for (let colIndex = 0; colIndex < celulas.length; colIndex++) {
            const celula = celulas[colIndex]
            const select = celula.querySelector('select')
            const input = celula.querySelector('input')
            const textarea = celula.querySelector('textarea')

            if (select) {
                row.push(select.value)
            } else if (input) {
                // Verifica o tipo do input
                if (input.type === 'checkbox') {
                    row.push(input.checked ? 'Sim' : 'Não')
                } else if (input.type === 'number') {
                    row.push(parseFloat(input.value) || 0)
                } else if (input.type === 'date') {
                    row.push(input.value)
                } else {
                    row.push(input.value)
                }
            } else if (textarea) {
                row.push(textarea.value)
            } else {

                const clone = celula.cloneNode(true)
                clone.querySelectorAll('label').forEach(l => l.remove())
                const texto = clone.textContent.replace(/\s+/g, ' ').trim()

                row.push(texto)
            }
        }
        worksheet.addRow(row)
    }

    // ====== ESTILOS ======
    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            }
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }

            // Cabeçalho (primeira linha)
            if (rowNumber === 1) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9D9D9' }
                }
                cell.font = { bold: true }
            }

            // Formatação para colunas numéricas
            if (typeof cell.value === 'number') {
                cell.numFmt = '#,##0.00'
                if (rowNumber !== 1) {
                    cell.alignment.horizontal = 'right'
                }
            }
        })
    })

    // Ajuste automático de largura das colunas
    worksheet.columns.forEach(col => {
        let maxLength = 10
        col.eachCell(cell => {
            const cellLength = String(cell.value || '').length
            if (cellLength > maxLength) {
                maxLength = cellLength
            }
        })
        col.width = Math.min(maxLength + 2, 50) // Limite máximo de 50
    })

    // Ajusta altura das linhas para conteúdo com quebra
    worksheet.eachRow(row => {
        row.height = 20
    })

    // ====== GERAR ARQUIVO ======
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `orcamentos-${new Date().getTime()}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}