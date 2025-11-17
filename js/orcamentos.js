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

    await sincronizarDados('dados_orcamentos')
    await sincronizarDados('dados_composicoes')
    await sincronizarDados('dados_clientes')
    await sincronizarDados('tags_orcamentos')
    await sincronizarDados('tags')
    await telaOrcamentos()

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

function filtrarOrcamentos({ ultimoStatus, col, texto } = {}) {
    if (ultimoStatus) filtro = ultimoStatus

    if (col !== undefined && col !== null)
        filtrosOrcamento[col] = String(texto).toLowerCase().trim()

    const body = document.getElementById('linhas')
    const linhas = body.querySelectorAll('.linha-orcamento-tabela')

    const totais = { CHAMADO: 0, TODOS: 0, 'SEM STATUS': 0 }
    const visiveis = { CHAMADO: 0, TODOS: 0, 'SEM STATUS': 0 }
    const listaStatus = new Set(['TODOS', 'CHAMADO'])
    const containersInfo = new Map()

    // primeiro loop: processa todas as linhas
    for (const linha of linhas) {
        const status = linha.querySelector('[name="status"]')?.value || ''
        const statusKey = status || 'SEM STATUS'
        const chamado = linha.dataset.chamado || 'N'
        const isChamado = chamado === 'S'
        const container = linha.closest('.linha-master')

        totais[statusKey] = (totais[statusKey] || 0) + 1
        totais.TODOS++
        if (isChamado) totais.CHAMADO = (totais.CHAMADO || 0) + 1
        listaStatus.add(statusKey)
        if (isChamado) listaStatus.add('CHAMADO')

        // armazena info de container
        if (container) {
            if (!containersInfo.has(container))
                containersInfo.set(container, { linhas: [], temChamado: false })
            containersInfo.get(container).linhas.push(linha)
            if (isChamado) containersInfo.get(container).temChamado = true
        }

        // filtro de texto normal (ainda não aplica display)
        let visivel = true
        const celulas = linha.querySelectorAll('.celula')
        for (const chave in filtrosOrcamento) {
            const termo = filtrosOrcamento[chave]
            if (!termo) continue
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

        linha.dataset._visivel = visivel ? 'S' : 'N' // marca provisoriamente
    }

    for (const [container, info] of containersInfo) {
        const { linhas, temChamado } = info
        let mostrarContainer = false

        for (const linha of linhas) {
            const status = linha.querySelector('[name="status"]')?.value || ''
            const statusKey = status || 'SEM STATUS'
            const chamado = linha.dataset.chamado || 'N'
            const isChamado = chamado === 'S'
            let visivel = linha.dataset._visivel === 'S' // resultado do filtro de texto

            if (filtro && filtro !== 'TODOS') {
                if (filtro === 'CHAMADO') {
                    // mantém as linhas do container do chamado, mas respeita busca textual
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

        // container só aparece se alguma linha dentro dele estiver visível
        container.style.display = mostrarContainer ? '' : 'none'
    }

    // --- toolbar ---
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
                 onclick="filtrarOrcamentos({ultimoStatus:'${st}'})">
                <label>${inicialMaiuscula(st)}</label>
                <span>${ativo ? visiveis[st] ?? 0 : totais[st] ?? 0}</span>
            </div>
        `)
    }
}

async function telaOrcamentos(semOverlay) {

    atualizarToolbar(true) // GCS no título

    funcaoTela = 'telaOrcamentos'

    if (!semOverlay) overlayAguarde()

    const colunasCFiltro = ['Status', 'Chamado', 'Cidade', 'Valor']
    const cabecs = ['Data/LPU', 'Status', 'Pedido', 'Notas', 'Tags', 'Chamado', 'Cidade', 'Responsáveis', 'Indicadores', 'Valor', 'Ações']
    let ths = ''
    let tsh = ''
    cabecs.forEach((cab, i) => {

        ths += `
        <div class="ths-orcamento">
            <span>${cab}</span>
            ${colunasCFiltro.includes(cab)
                ? `<img onclick="ordenarOrcamentos('${i}')" src="imagens/filtro.png">`
                : ''}
        </div>`
        tsh += `<div
            class="ths-orcamento">
                ${(cab !== 'Ações' && cab !== 'Status' && cab !== 'Indicadores')
                ? `<input placeholder="Pesquisar" name="col_${i}"  oninput="filtrarOrcamentos({col: ${i}, texto: this.value})" >`
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
            <div class="cabecalho">
                <div class="linha-orcamento-tabela" style="padding: 0px; background-color: #d2d2d2;">${ths}</div>
                <div class="linha-orcamento-tabela" style="padding: 0px;">${tsh}</div>
            </div>
            <div class="div-tabela">
                <div id="linhas"></div>
            </div>
            <div class="rodapeTabela"></div>
        </div>
        `

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    if (!tabelaOrcamento || layout == 'pda') tela.innerHTML = acumulado
    layout = 'tradicional'

    dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_clientes = await recuperarDados('dados_clientes') || {}
    tagsTemporarias = await recuperarDados('tags_orcamentos')

    // orçamentos slaves por último, eles serão incluídos nas linhas master;
    const hierarquizado = Object.fromEntries(
        Object.entries(dados_orcamentos).sort(([, a], [, b]) => {
            const temA = a?.hierarquia ? 1 : 0
            const temB = b?.hierarquia ? 1 : 0
            return temA - temB
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

    filtrarOrcamentos()

    criarMenus('orcamentos')

    // Devolver as pesquisas;
    for (const [col, termo] of Object.entries(filtrosOrcamento)) {
        const cabechalho = document.querySelector(`[name="col_${col}"]`)
        if (cabechalho) cabechalho.value = termo
    }

    if (!semOverlay) removerOverlay()

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

    const numOrcamento = `
        <div style="${horizontal}; gap: 5px;">
            <span><b>${dados_orcam.contrato}</b></span>
            <div name="icone"></div>
            ${labelRevisao}
        </div>
    `
    const orcamentoMaster = dados_orcamentos?.[orcamento?.hierarquia] || {}
    const orcamentosVinculados = orcamento.hierarquia
        ? `
        <div style="${horizontal}; gap: 5px;">
            <span><b>${orcamentoMaster?.dados_orcam?.contrato || '--'}</b></span>
            <img src="imagens/link.png" onclick="confirmarRemoverVinculo('${idOrcamento}')" style="width: 1.5rem;">
            ${numOrcamento}
        </div>
        `
        : numOrcamento

    const celulas = `
        ${cel(`
            <div style="${vertical}; padding-left: 5px;">
                <span><b>${orcamento.lpu_ativa}</b></span>
                <span>${dados_orcam?.data || ''}</span>
            </div>
        `)}
        ${cel(`
            <select name="status" class="opcoesSelect" onchange="alterar_status(this, '${idOrcamento}')">
                ${opcoes}
            </select>
        `)}
        ${cel(`<div class="bloco-etiquetas">${labels.PEDIDO}</div>`)}
        ${cel(`<div class="bloco-etiquetas">${labels.FATURADO}</div>`)}
        ${cel(`
            <div style="${horizontal}; justify-content: space-between; width: 100%; align-items: start; gap: 2px;">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${gerarLabelsAtivas(orcamento?.tags || {})}
                </div>
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="tagsOrcamento('${idOrcamento}')">
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
        ${cel(`<div style="${horizontal}; width: 100%;"><img onclick="abrirAtalhos('${idOrcamento}')" src="imagens/pesquisar2.png" style="width: 1.5rem;"></div>`)}
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

        document.getElementById('linhas').insertAdjacentHTML('afterbegin', novaLinha)
    }
}

async function tagsOrcamento(idOrcamento) {

    tagsPainel = await new TagsPainel({
        baseTags: 'tags_orcamentos',
        idRef: idOrcamento,
        baseRef: 'dados_orcamentos',
        funcao: 'telaOrcamentos'
    }).init()

    tagsPainel.painelTags()
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

    filtrarOrcamentos()

    removerPopup()

}

async function editar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    if (orcamentoBase.aprovacao) delete orcamentoBase.aprovacao

    await baseOrcamento(orcamentoBase)

    removerPopup()

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

    novoOrcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function excelOrcamentos() {

    overlayAguarde()

    try {

        const response = await fetch(`${api}/orcamentosRelatorio`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio de Orcamentos.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

    } catch (err) {
        popup(mensagem(err), 'Erro ao baixar Excel', true)
    }

    removerOverlay()

}

async function telaPDA() {

    mostrarMenus(false)

    const colunas = [
        'DATA',
        'CHAMADO',
        'LOJA',
        'STATUS',
        'RESPONSÁVEL',
        'OBSERVAÇÃO',
        'TOTAL',
        'DATA DA SAÍDA',
        'PREVISÃO DE ENTREGA',
        'DATA DE ENTREGA',
        'TRANSPORTE',
        'DETALHES'
    ]

    let ths = '', pesquisa = ''

    colunas.forEach((op, i) => {
        ths += `
        <th>
            <div style="${horizontal}; justify-content: space-between; width: 100%; gap: 1rem;">
                <span>${op}</span>
                <img onclick="filtrarAAZ('${i}', 'linhas')" src="imagens/down.png" style="width: 1rem;">
            </div>
        </th>`
        pesquisa += `<th oninput="pesquisarGenerico('${i}', this.textContent, filtroPDA, 'linhas')" style="background-color: white; text-align: left;" contentEditable="true"></th>`
    })

    const acumulado = `
        <div style="${vertical}; width: 90vw;">
            <div class="topo-tabela">
                <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
                    <img src="imagens/planilha.png" style="width: 2rem;">
                    <span style="font-size: 1rem;">Layout PDA</span>
                </div>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisa}</tr>
                    </thead>
                    <tbody id="linhas"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    const tabelaExistente = document.querySelector('.div-tabela')
    if (!tabelaExistente || layout == 'tradicional') tela.innerHTML = acumulado
    layout = 'pda'

    dados_orcamentos = await recuperarDados('dados_orcamentos')
    dados_clientes = await recuperarDados('dados_clientes')

    for (const [idOrcamento, orcamento] of Object.entries(dados_orcamentos || {}).reverse()) {

        if (orcamento.origem !== origem) {
            const trExistente = document.getElementById(idOrcamento)
            if (trExistente) trExistente.remove()
            continue
        }

        criarLinhaPDA(idOrcamento, orcamento)

    }

    criarMenus('pda')

}

function criarLinhaPDA(idOrcamento, orcamento) {

    const clienteOmie = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = dados_clientes?.[clienteOmie] || {}
    const data = orcamento?.dados_orcam?.data ? new Date(orcamento.dados_orcam.data).toLocaleString() : '--'

    const transportadoras = ['', 'CORREIOS', 'BRAEX', 'JADLOG', 'JAMEF', 'VENDA DIRETA', 'AÉREO']
        .map(op => `<option ${orcamento?.transportadora == op ? 'selected' : ''}>${op}</option>`)
        .join('')

    const datas = (campo) => {

        const data = orcamento?.[campo] || ''
        return `
            <td>
                <input onchange="atualizarCamposPDA('${idOrcamento}', '${campo}', this)" style="background-color: ${data ? '#0080004a' : '#ff00004a'};" class="datas-pda" style="background-color: transparent;" type="date" value="${data}">
            </td>
        `
    }

    const responsaveis = Object.entries(orcamento.usuarios || {})
        .map(([user,]) => user)
        .join(', ')

    const opcoesStatus = ['', ...fluxograma]
        .map(st => `<option ${orcamento?.status?.atual == st ? 'selected' : ''}>${st}</option>`)
        .join('')

    const tds = `
        <td>${data}</td>
        <td>${orcamento?.dados_orcam?.contrato || '--'}</td>
        <td>${cliente?.nome || '--'}</td>
        <td>
            <select class="opcoesSelect" onchange="alterar_status(this, '${idOrcamento}')">${opcoesStatus}</select>
        </td>
        <td>${responsaveis}</td>
        <td>
            <div style="${horizontal}; justify-content: left; gap: 5px;">
                <img onclick="adicionarObservacao('${idOrcamento}')" src="imagens/editar.png" style="width: 1.5rem;">
                <span style="min-width: 100px; text-align: left;">${orcamento?.observacao || ''}</span>
            </div>
        </td>

        <td style="white-space: nowrap;">${dinheiro(orcamento?.total_geral)}</td>

        ${datas('dtSaida')}
        ${datas('previsao')}
        ${datas('dtEntrega')}

        <td>
            <select onchange="atualizarCamposPDA('${idOrcamento}', 'transportadora', this)">${transportadoras}</select>
        </td>
        <td style="text-align: center;" onclick="abrirAtalhos('${idOrcamento}')">
            <img src="imagens/pesquisar2.png" style="width: 1.5rem; cursor: pointer;">
        </td>
    `

    const trExistente = document.getElementById(idOrcamento)

    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('linhas').insertAdjacentHTML('beforeend', `<tr id="${idOrcamento}">${tds}</tr>`)

}

async function atualizarCamposPDA(idOrcamento, campo, input) {

    let orcamento = dados_orcamentos[idOrcamento]

    orcamento[campo] = input.value

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${idOrcamento}/${campo}`, input.value)

    criarLinhaPDA(idOrcamento, orcamento)

}

async function adicionarObservacao(idOrcamento) {

    const orcamento = dados_orcamentos[idOrcamento]
    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">
            <span>Escreva uma observação:</span>
            <textarea name="observacao" cols="50" rows="10">${orcamento?.observacao || ''}</textarea>
            <button onclick="salvarObservacao('${idOrcamento}')">Salvar Observação</button>
        </div>
    `

    popup(acumulado, 'Observação', true)

}

async function salvarObservacao(idOrcamento) {

    const observacao = document.querySelector('[name="observacao"]').value
    let orcamento = dados_orcamentos[idOrcamento]

    orcamento.observacao = observacao

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${idOrcamento}/observacao`, observacao)

    criarLinhaPDA(idOrcamento, orcamento)

    removerPopup()

}
