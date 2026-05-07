const stLista = [
    'EM ANDAMENTO',
    'OBRA PARALISADA',
    'CONCLUÍDO',
    'POC EM ANDAMENTO'
]

function formatacaoPagina() {

    const pag = 'orcamentos'
    let status = ''

    if (controles?.[pag]?.filtros?.['snapshots.prioridade']) {
        status = 'prioridades'

    } else if (controles?.[pag]?.filtros?.['chamado']) {
        status = 'chamados'

    } else if (controles?.[pag]?.filtros?.['preventiva']) {
        status = 'preventiva'

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

    overlayAguarde()

    atualizarToolbar(true) // GCS no título

    funcaoTela = 'telaOrcamentos'

    const colunas = {
        'Última alteração': { chave: 'lpu_ativa' },
        'Status': { chave: 'status.atual' },
        'Pedido': { chave: 'snapshots.pedidos' },
        'Notas': { chave: 'snapshots.notas' },
        'Tags': { chave: 'snapshots.tags.*.nome' },
        'Contrato': { chave: 'snapshots.contrato' },
        'Cidade': { chave: 'snapshots.cidade' },
        'Status em Ocorrências': {},
        'Responsaveis': { chave: 'snapshots.responsavel' },
        'Resumo': {},
        'Total do Orçamento': { chave: 'snapshots.valor' },
        'Ações': {}
    }

    const tabela = await modTab({
        funcaoAdicional: ['formatacaoPagina'],
        colunas,
        ordenar: {
            path: 'timestamp',
            direcao: 'desc'
        },
        base: 'dados_orcamentos',
        criarLinha: 'criarLinhaOrcamento',
        body: 'linhas',
        pag: 'orcamentos',
        substituicoes: [
            {
                path: 'dados_orcam.contrato',
                tabela: 'departamentos_ac',
                campoBusca: 'descricao',
                retorno: 'descricao',
                destino: 'departamentoExistente'
            },
            {
                path: 'dados_orcam.contrato',
                tabela: 'dados_ocorrencias',
                campoBusca: 'id',
                retorno: 'snapshots.ultimaCorrecao',
                destino: 'ultimaCorrecao'
            }
        ]
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

    tela.innerHTML = acumulado

    await paginacao()
    await carregarToolbar()

    removerOverlay()

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

async function criarLinhaOrcamento(orcamento) {

    const { id, vinculados, departamentoExistente } = orcamento || {}

    const master = orcamento?.dados_orcam?.chamado || orcamento?.dados_orcam?.contrato
    const idMaster = vinculados
        ? id
        : null

    const linhas = []

    await linhaOrcamento(orcamento)

    for (const id of Object.keys(vinculados || [])) {

        const orcamento = await recuperarDado('dados_orcamentos', id)

        // Se o orçamento foi excluído, o recuperarDado vai falhar;
        if (orcamento == null)
            continue

        await linhaOrcamento(orcamento)

    }

    return linhas.join('')

    async function linhaOrcamento(orcamento) {

        const { id, dados_orcam, timestamp, snapshots, total_geral } = orcamento || {}
        const { ultimaCorrecao, notas, pedidos } = snapshots || {}
        const { pagamentos = 0, fretes = 0, abastecimentos = 0 } = snapshots?.custos || {}
        
        // Velocímetro
        const totalCusto = pagamentos + fretes + abastecimentos
        const porcentagem = Number(((totalCusto / total_geral) * 100).toFixed(1))
        const resumo = criarVelocimetroHTML({ rotulo: 'Custos', limite: 40, valor: porcentagem })

        const labelTipoCorrecao = ultimaCorrecao
            ? formatacaoTipoCorrecao(ultimaCorrecao)
            : ''
        
        const pedidosStatus = (pedidos || [])
            .map(({ tipo, pedido, valor, autorizado_por }) => {

                const label = `
                <div class="etiquetas" style="text-align: left; min-width: 100px;">
                    <label>${tipo || ''}</label>
                    <label>${pedido}</label>
                    ${autorizado_por ? `<label><b>${autorizado_por}</b></label>` : ''}
                    <label>${dinheiro(valor)}</label>
                </div>
                `
                return label
            })
            .join('') 
        

        const notasStatus = (notas || [])
            .map(({ categoria, n_nota, total }) => `
                <div class="etiquetas" style="text-align: left; min-width: 100px;">
                    <label>${categoria || ''}</label>
                    <label>${n_nota || ''}</label>
                    <label>${dinheiro(total)}</label>
                </div>
            `)
            .join('')

        const responsaveis = Object.entries(orcamento.usuarios || {})
            .map(([user,]) => user)
            .join(', ')

        // Labels do campo Contrato [Revisão, chamado, cliente, etc]
        const { contrato } = dados_orcam || {}
        const numOficial = String(dados_orcam?.chamado || contrato || '-').trim()
        const rAtual = orcamento?.revisoes?.atual
        const etiqRevAtual = rAtual
            ? `<span class="etiqueta-revisao">${rAtual}</span>`
            : ''

        // idMaster existe e orçamento difrente do master; (Ou seja, slaves);
        const nomeVinculado = (idMaster && idMaster !== id)
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

        // Tags;
        const listaTags = Object.values(snapshots?.tags || {})
            .map(tag => modeloTag(tag, id))
            .join('')

        const data = new Date(timestamp).toLocaleString()
        const celulas = `
        <td>
            <div style="${vertical}">
                <span><b>${orcamento?.lpu_ativa || ''}</b></span>
                <span>${data}</span>
            </div>
        </td>
            <td>
            <div style="${vertical}; gap: 5px;">
                ${seletorStatus(orcamento)}
                <div style="${horizontal}; width: 100%; justify-content: end; gap: 5px;">
                    <span>Dep</span>
                    <img src="imagens/${departamentoExistente ? 'concluido' : 'cancel'}.png" style="width: 1.5rem;">
                </div>
            </div>
        </td>
        <td>
            <div class="bloco-etiquetas">${pedidosStatus}</div>
        </td>
        <td>
            <div class="bloco-etiquetas">${notasStatus}</div>
        </td>
        <td>
            <div style="${vertical}; gap: 2px;">
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="renderPainel('${id}')">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${listaTags}
                </div>
            </div>
        </td>
        <td>${finalContrato}</td>
        <td>${(snapshots?.cidade || '').toUpperCase()}</td>
        <td>${labelTipoCorrecao}</td>
        <td>
            <div style="${vertical}">
                <span>${orcamento?.usuario || '--'}</span>
                <span>${responsaveis}</span>
            </div>
        </td>
        <td>
            ${resumo}
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
        <tr class="linha-master">
            ${celulas}
        </tr>`

        linhas.push(linha)

    }

}

function seletorStatus(orcamento) {

    const { id, status } = orcamento || {}

    const st = status?.atual || ''

    const opcoes = ['', ...fluxograma]
        .sort((a, b) => a.localeCompare(b))
        .map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`)
        .join('')

    return `
        <select name="status" class="opcoesSelect" onchange="alterarStatus('${id}', this)">
            ${opcoes}
        </select>`

}

async function alterarStatus(id, select) {

    await enviar(`dados_orcamentos/${id}/status/atual`, select.value)
    
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

async function editar(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}

    if (orcamento.aprovacao)
        delete orcamento.aprovacao

    const jaEmEdicao = Object.values(JSON.parse(localStorage.getItem('temporario')) || {})
        .some(orc => orc.id == id)

    if (jaEmEdicao)
        return painelEdicao()

    // Sem edições do mesmo orçamento existentes, continue;
    sessionStorage.setItem('idEdicao', crypto.randomUUID())
    baseOrcamento(orcamento)

    removerPopup()

    precosAntigos = null

    orcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function duplicar(orcam_) {

    const orcamentoBase = await recuperarDado('dados_orcamentos', orcam_) || {}
    const novoOrcamento = {
        esquema_composicoes: orcamentoBase.esquema_composicoes || {},
        dados_composicoes: orcamentoBase.dados_composicoes || {},
        lpu_ativa: orcamentoBase.lpu_ativa || 'LPU HOPE',
        dados_orcam: {
            ...orcamentoBase.dados_orcam || {},
            contrato: '',
            analista: acesso.nome_completo,
            email_analista: acesso.email,
            telefone_analista: acesso.telefone
        }

    }

    baseOrcamento(novoOrcamento)

    removerPopup()

    precosAntigos = null

    novoOrcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function carregarToolbar() {

    const filtros = {}

    const cont1 = await contarPorCampo({ base: 'dados_orcamentos', filtros, path: 'status.atual' })
    const cont4 = await contarPorCampo({ base: 'dados_orcamentos', filtros, path: 'preventiva' })

    const contToolbar = {
        ...cont1,
        'preventiva': cont4['S'],
        'SEM STATUS': cont1['EM BRANCO'] || 0
    }

    const toolbar = document.getElementById('toolbar')
    const fluxogramaCompleto = ['preventiva', 'todos', ...fluxograma]

    for (const campo of fluxogramaCompleto) {

        const contagem = contToolbar[campo] || 0

        const tool = toolbar.querySelector(`[name="${campo}"]`)
        if (tool) {
            tool.querySelector('span').textContent = contagem
            continue
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
                onclick="filtrarToolbar('${campo}')">
                <label>${campo.toUpperCase()}</label>
                <span ${f}>${contagem}</span>
            </div>
            `
        toolbar.insertAdjacentHTML('beforeend', novaTool)
    }

}

async function filtrarToolbar(campo) {

    const filtros = {}

    if (campo == 'chamados') {
        filtros['chamado'] = { op: '=', value: 'S' }

    } else if (campo == 'SEM STATUS') {
        filtros['status.atual'] = { op: 'IS_EMPTY' }

    } else if (campo == 'prioridades') {
        filtros['snapshots.prioridade'] = { op: '<', value: 3 }

    } else if (campo == 'preventiva') {
        filtros['preventiva'] = { op: '=', value: 'S' }

    } else if (campo !== 'todos') { // Demais campos, exceto 'todos';
        filtros['status.atual'] = { op: '=', value: campo }

    }

    controles.orcamentos.pagina = 1
    controles.orcamentos.filtros = filtros

    await paginacao()

}

async function baixarExcelOrcamentos() {
    const schema = {
        table: "dados_orcamentos",
        alias: "o",

        joins: [
            {
                type: "LEFT",
                table: "dados_clientes_ac",
                alias: "c",
                on: `
                    c.id = json_extract(
                        CASE WHEN json_valid(o.dados_orcam) THEN o.dados_orcam ELSE '{}' END,
                        '$.omie_cliente'
                    )`
            },
            {
                type: "LEFT",
                table: "empresas",
                alias: "e",
                on: "e.id = c.empresa"
            }
        ],

        columns: [
            {
                field: "o.timestamp",
                as: "Última alteração",
                type: "date",
                sourceFormat: "timestamp",
            },
            {
                json: {
                    field: "o.status",
                    path: "$.atual"
                },
                as: "Status",
            },
            { field: "o.aba", as: "Aba" },
            {
                jsonArray: {
                    field: "o.status",
                    path: "$.historico",
                    property: "pedido"
                },
                as: "Pedidos",
            },
            {
                jsonArray: {
                    field: "o.status",
                    path: "$.historico",
                    property: "nf"
                },
                as: "Notas",
            },
            {
                jsonObjectJoin: {
                    field: "o.tags",
                    table: "tags_orcamentos",
                    joinField: "id",
                    selectField: "nome"
                },
                as: "Tags",
            },
            {
                json: {
                    field: "o.dados_orcam",
                    path: "$.contrato"
                },
                as: "Número Orçamento",
            },
            { field: "o.usuario", as: "Criado por" },
            { field: "e.nome", as: "Empresa" },
            { field: "c.nome", as: "Nome" },
            { field: "c.cidade", as: "Cidade" },
            { field: "c.endereco", as: "Endereço" },
            {
                field: "o.total_geral",
                as: "Total Geral",
                type: "currency"
            },
        ],
        filters: [
            {
                custom: "(o.excluido IS NULL OR o.excluido = '')"
            },
            {
                custom: "o.dados_composicoes IS NOT NULL"
            }
        ],
        orderBy: "o.timestamp DESC"
    }

    overlayAguarde()
    await baixarRelatorioExcel(schema, 'Orçamentos')
    removerOverlay()
}