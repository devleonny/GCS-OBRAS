const stLista = [
    'EM ANDAMENTO',
    'OBRA PARALISADA',
    'CONCLUÍDO',
    'POC EM ANDAMENTO'
]

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

async function rstTelaOrcamentos() {
    tela.innerHTML = ''
    await telaOrcamentos()
}

function formatacaoPagina() {

    const pag = 'orcamentos'
    let status = ''

    if (controles?.[pag]?.filtros?.['snapshots.prioridade']) {
        status = 'prioridades'

    } else if (controles?.[pag]?.filtros?.['chamado']) {
        status = 'chamados'

    } else {
        const pesq = controles?.[pag]?.filtros?.['status.atual']
        status = pesq?.op == 'IS_EMPTY'
            ? 'SEM STATUS'
            : pesq?.value || 'todos'
    }

    const abas = document.querySelectorAll('.aba-toolbar')

    abas.forEach(a => a.style.opacity = 0.5)

    const aba = document.querySelector(`[name="${status}"]`)
    if (aba) aba.style.opacity = 1

}

async function telaOrcamentos() {

    atualizarToolbar(true) // GCS no título

    funcaoTela = 'telaOrcamentos'

    const pag = 'orcamentos'
    const colunas = {
        'última alteração': { chave: 'lpu_ativa' },
        'status': { chave: 'status.atual' },
        'pedido': '',
        'notas': '',
        'tags': { chave: 'snapshots.tags' },
        'contrato': { chave: 'snapshots.contrato' },
        'cidade': { chave: 'snapshots.cidade' },
        'responsaveis': { chave: 'snapshots.responsavel' },
        'indicadores': '',
        'valor': { chave: 'snapshots.valor' },
        'ações': ''
    }

    const btnExtras = `<span style="color: white; cursor: pointer; white-space: nowrap;" onclick="filtroOrcamentos()">Filtros ☰</span>`

    const tabela = modTab({
        funcaoAdicional: ['formatacaoPagina'],
        btnExtras,
        filtros: {
            'dados_orcam': { op: 'NOT_EMPTY' },
            'arquivado': { op: '!=', value: 'S' },
        },
        colunas,
        base: 'dados_orcamentos',
        criarLinha: 'criarLinhaOrcamento',
        body: 'linhas',
        pag
    })

    const acumulado = `
        <div style="${vertical}; width: 95vw;">
            <div style="${horizontal}; width: 95vw;">
                <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
                <div id="toolbar"></div>
                <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
            </div>

            ${tabela}
        </div>
        `

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    if (!tabelaOrcamento) tela.innerHTML = acumulado

    await carregarToolbar()
    criarMenus('orcamentos')
    mostrarMenus(false)

    await paginacao(pag)

}

function filtroOrcamentos() {

    const filtros = {
        arquivado: controles?.orcamentos?.filtros?.arquivado?.op == '=',
    }

    const linhas = []

    const interruptor = (chave, ativo) => `
        <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
            <input
                type="checkbox"
                ${ativo ? 'checked' : ''}
                name="filtros"
                onchange="mudarInterruptor(this)"
                data-chave="${chave}"
                style="opacity:0; width:0; height:0;">
                <span class="track" style="background-color:${ativo ? '#4caf50' : '#ccc'}"></span>
                <span class="thumb" style="transform:translateX(${ativo ? '26px' : '0'})"></span>
        </label>`

    for (const [chave, ativo] of Object.entries(filtros)) {
        linhas.push({
            texto: inicialMaiuscula(chave),
            elemento: interruptor(chave, ativo)
        })
    }

    popup({ linhas, titulo: 'Gerenciar Filtro', nra: false })

}

async function mudarInterruptor(el) {
    const ativo = el.checked
    const label = el.parentElement
    const chave = el.dataset.chave

    controles.orcamentos.filtros[chave] = { op: ativo ? '=' : '!=', value: 'S' }
    await paginacao()

    const track = label.querySelector('.track')
    const thumb = label.querySelector('.thumb')

    if (track) track.style.backgroundColor = ativo ? '#4caf50' : '#ccc'
    if (thumb) thumb.style.transform = ativo ? 'translateX(26px)' : 'translateX(0)'
}

function scrollar(direcao) {

    direcao = direcao == 'next' ? 1 : -1
    const movimento = 1000 * direcao
    const toolbar = document.getElementById('toolbar')

    if (toolbar) toolbar.scrollBy({ left: movimento, behavior: 'smooth' })

}

async function criarLinhaOrcamento(orcamento, master, idMaster) {

    const { id, dados_orcam, snapshots = {} } = orcamento

    let labels = {
        PEDIDO: '',
        FATURADO: ''
    }

    for (const historico of Object.values(orcamento?.status?.historico || {})) {

        if (labels[historico.status] == undefined) continue
        if (historico.tipo == 'Remessa') continue

        const valor1 = historico.tipo
        const valor2 = historico.status == 'FATURADO' ? historico.nf : historico.pedido
        const valor3 = conversor(historico.valor)

        labels[historico.status] += `
                <div class="etiquetas" style="text-align: left; min-width: 100px;">
                    <label>${valor1}</label>
                    <label>${valor2}</label>
                    ${historico.valor ? `<label>${dinheiro(valor3)}</label>` : ''}
                </div>
                `
    }

    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const responsaveis = Object.entries(orcamento.usuarios || {})
        .map(([user,]) => user)
        .join(', ')

    // Labels do campo Contrato [Revisão, chamado, cliente, etc]
    const contrato = dados_orcam?.contrato
    const numOficial = String(dados_orcam?.chamado || contrato || '-').trim()
    const rAtual = orcamento?.revisoes?.atual
    const etiqRevAtual = rAtual ? `<span class="etiqueta-revisao">${rAtual}</span>` : ''

    const nomeVinculado = master
        ? `
        <div style="${horizontal}; gap: 5px;">
            <span>${numOficial}</span>
            <div class="viculado">
                <img src="imagens/link2.png">
                <span>${master}</span>
            </div>
        </div>
        `
        : `<span name="contrato">${numOficial}</span>`

    const finalContrato = `
        <div style="${vertical};text-align: left; gap: 2px;">
            ${nomeVinculado}
            ${etiqRevAtual}
            <span>${(snapshots?.cliente || '').toUpperCase()}</span>
            ${contrato !== numOficial ? `<div style="${horizontal}; justify-content: end; width: 100%; color: #5f5f5f;"><small>${contrato}</small></div>` : ''}
        </div>`

    const data = new Date(orcamento.timestamp).toLocaleString()

    // Comentários nos status;
    const info = Object
        .values(orcamento?.status?.historicoStatus || {})
        .filter(s => (s.info && s.info !== ''))

    const opcoesPda = abas
        .map(aba => `<option ${orcamento.aba == aba ? 'selected' : ''}>${aba}</option>`)
        .join('')

    // Tags;
    const tags = []

    for (const idTag of Object.keys(orcamento.tags || {})) {

        const tag = await recuperarDado('tags_orcamentos', idTag)

        tags.push(modeloTag(tag, id))

    }

    let depExistente = false

    const celulas = `
         <td>
            <div style="text-align: left;${vertical}; gap: 2px;">
                <label><b>${orcamento.lpu_ativa}</b></label>
                <span>${data}</span>
                <select name="aba" class="opcoesSelect" onchange="atualizarAba(this, '${id}')">
                    <option></option>
                    ${opcoesPda}
                </select>
            </div>
        </td>
        <td>
            <div style="${vertical}; gap: 5px;">
                <div style="${horizontal}; gap: 2px;">
                    <img onclick="mostrarInfo('${id}')" src="imagens/observacao${info.length > 0 ? '' : '_off'}.png">
                    <select name="status" class="opcoesSelect" data-id="${id}" onchange="alterarStatus(this)">
                        ${opcoes}
                    </select>
                </div>
                <div style="${horizontal}; width: 100%; justify-content: end; gap: 5px;">
                    <span>Dep</span>
                    <img src="imagens/${depExistente ? 'concluido' : 'cancel'}.png" style="width: 1.5rem;">
                </div>
            </div>
        </td>
        <td>
            <div class="bloco-etiquetas">${labels.PEDIDO}</div>
        </td>
        <td>
            <div class="bloco-etiquetas">${labels.FATURADO}</div>
        </td>
        <td>
            <div style="${vertical}; gap: 2px;">
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="renderPainel('${id}')">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${tags.join('')}
                </div>
            </div>
        </td>
        <td>${finalContrato}</td>
        <td>${(snapshots?.cidade || '').toUpperCase()}</td>
        <td>
            <div style="${vertical}">
                <span>${orcamento?.usuario || '--'}</span>
                <span>${responsaveis}</span>
            </div>
        </td>
        <td>
            <div style="${vertical}; width: 100%; gap: 2px;">
                <span>Checklist</span>
                ${divPorcentagem(orcamento?.checklist?.andamento || 0)}
                <span>LC %</span>
                ${divPorcentagem(0)}
            </div>
        </td>
        <td>
            <div style="${vertical}; width: 100%;">
                <input style="display: none;" type="number" value="${orcamento.total_geral}">
                <span style="font-size: 0.8rem; white-space: nowrap;">${dinheiro(orcamento.total_geral)}</span>
            </div>
        </td>
        <td>
            <img 
                onclick="${idMaster ? `abrirAtalhos('${id}', '${idMaster}')` : `abrirAtalhos('${id}')`}"
                src="imagens/pesquisar2.png"
                style="width: 1.5rem;">
        </td>`

    const linha = `
        <tr class="linha-master" data-prioridade="${orcamento?.snapshots?.prioridade}">
            ${celulas}
        </tr>`

    return linha

}

function verificarPrioridade(orcamento) {

    const acoes = orcamento?.pda?.acoes || {}
    let prioridade = 3 // Baixa prioridade;

    const souResponsavel = Object
        .values(acoes)
        .some(a => a.responsavel == acesso.usuario && a.status == 'pendente')

    // Sou responsável e a ação está pendente; TRUE
    if (souResponsavel) return 0

    const stLiberado = Object
        .values(orcamento?.status?.historicoStatus || {})
        .some(h => stLista.includes(h.para))

    if (stLiberado) return prioridade

    const inicio = new Date(orcamento?.inicio)
    const hoje = new Date()
    const diffDias = Math.abs(hoje - inicio) / (1000 * 60 * 60 * 24)
    if (diffDias < 7) prioridade = 0
    else if (diffDias < 14) prioridade = 1
    else if (diffDias < 21) prioridade = 2

    return prioridade
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

async function carregarToolbar() {

    const filtros = { 'dados_orcam': { op: 'NOT_EMPTY' }, 'arquivado': { op: '!=', value: 'S' } }
    const cont1 = await contarPorCampo({ base: 'dados_orcamentos', filtros, path: 'status.atual' })
    const cont2 = await contarPorCampo({ base: 'dados_orcamentos', filtros, path: 'chamado' })
    const cont3 = await contarPorCampo({ base: 'dados_orcamentos', filtros, path: 'snapshots.prioridade' })

    const contToolbar = {
        ...cont1,
        'SEM STATUS': cont1['EM BRANCO'] || 0,
        'chamados': cont2['S'],
        'prioridades': ((cont3[0] || 0) + (cont3[1] || 0) + (cont3[2] || 0))
    }

    const toolbar = document.getElementById('toolbar')
    const pag = 'orcamentos'
    const fluxogramaCompleto = ['prioridades', 'chamados', 'todos', ...fluxograma]

    for (const campo of fluxogramaCompleto) {

        const contagem = contToolbar[campo] || 0

        const tool = toolbar.querySelector(`[name="${campo}"]`)
        if (tool) {
            tool.querySelector('span').textContent = contagem
            continue
        }

        let filtrosPesq = `'status.atual': {op:'=', value: '${campo}'}`

        if (campo == 'chamados') {
            filtrosPesq = `'chamado': {op:'=', value: 'S'}`

        } else if (campo == 'SEM STATUS') {
            filtrosPesq = `'status.atual': {op: 'IS_EMPTY'}`

        } else if (campo == 'prioridades') {
            filtrosPesq = `'snapshots.prioridade': {op: '<', value: 3}`

        } else if (campo == 'todos') {
            filtrosPesq = ''
        }

        const f = campo == 'VENDA DIRETA'
            ? 'style="background: linear-gradient(45deg, #222, #b12425);"'
            : ''

        const novaTool = `
            <div
                style="opacity: 0.5; height: 3rem;"
                class="aba-toolbar"
                data-status="${campo}"
                name="${campo}"
                onclick="
                controles.${pag}.pagina = 1; 
                controles.${pag}.filtros = { 'dados_orcam': { op: 'NOT_EMPTY' }, 'arquivado': { op: '!=', value: 'S' }, ${filtrosPesq} };
                paginacao('${pag}')">
                <label>${campo.toUpperCase()}</label>
                <span ${f}>${contagem}</span>
            </div>
            `
        toolbar.insertAdjacentHTML('beforeend', novaTool)
    }

}
