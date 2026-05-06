function formatacaoPagina() {

    const pag = 'orcamentos'
    const status = controles?.orcamentos?.filtros?.['snapshots.ultimaCorrecao']?.value
    const abas = document.querySelectorAll('.aba-toolbar')

    abas.forEach(a => a.style.opacity = 0.5)

    const aba = document.querySelector(`[name="${status ? status : 'todos'}"]`)
    if (aba) aba.style.opacity = 1

}

async function telaOrcamentos() {

    overlayAguarde()

    atualizarToolbar(true) // GCS no título

    funcaoTela = 'telaOrcamentos'

    const colunas = {
        'Última alteração': { chave: 'lpu_ativa' },
        'Pedido': { chave: 'snapshots.pedidos' },
        'Notas': { chave: 'snapshots.notas' },
        'Tags': { chave: 'snapshots.tags.*.nome' },
        'Contrato': { chave: 'snapshots.contrato' },
        'Cidade': { chave: 'snapshots.cidade' },
        'Status em Ocorrências': { chave: 'snapshots.ultimaCorrecao' },
        'Responsaveis': { chave: 'snapshots.responsavel' },
        'Resumo': {},
        'Total do Orçamento': { chave: 'snapshots.valor' },
        'Ações': {}
    }

    const pag = 'orcamentos'
    const tabela = await modTab({
        funcaoAdicional: ['formatacaoPagina'],
        colunas,
        pag,
        ordenar: {
            direcao: 'DESC',
            path: 'dados_orcam.data',
            tipo: 'data_br'
        },
        base: 'dados_orcamentos',
        criarLinha: 'criarLinhaOrcamento',
        body: 'linhas',
        substituicoes: [
            {
                path: 'dados_orcam.contrato',
                tabela: 'departamentos_ac',
                campoBusca: 'descricao',
                retorno: 'descricao',
                destino: 'departamentoExistente'
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

    await paginacao(pag)
    await carregarToolbar()

    removerOverlay()

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

        console.log(pedidos, notas)

        const pedidosStatus = [] // (pedidos || [])
            .map(({ tipo, pedido, valor, autorizadoPor }) => {

                const label = `
                <div class="etiquetas" style="text-align: left; min-width: 100px;">
                    <label>${tipo || ''}</label>
                    <label>${pedido}</label>
                    ${autorizadoPor ? `<label><b>${autorizadoPor}</b></label>` : ''}
                    <label>${dinheiro(valor)}</label>
                </div>
                `
                return label
            })
            .join('') 
        

        const notasStatus = []//(notas || [])
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
        const { contrato, data } = dados_orcam || {}
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

        const celulas = `
        <td>
            <div style="${vertical}">
                <span><b>${orcamento?.lpu_ativa || ''}</b></span>
                <span>${data}</span>
                <br>
                <div style="${horizontal}; width: 100%; justify-content: start; gap: 5px;">
                    <img src="imagens/${departamentoExistente ? 'concluido' : 'cancel'}.png" style="width: 1.5rem;">
                    <span>Dep</span>
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

    const contagem = await contarPorCampo({
        base: 'dados_orcamentos',
        path: 'snapshots.ultimaCorrecao'
    })

    const toolbar = document.getElementById('toolbar')

    for (const [titulo, quantidade] of Object.entries(contagem)) {

        const tool = toolbar.querySelector(`[name="${titulo}"]`)

        if (tool) {
            tool.querySelector('span').textContent = quantidade
            continue
        }

        const novaTool = `
            <div style="opacity: 0.5; height: 3rem;"
                class="aba-toolbar"
                data-status="${titulo}"
                name="${titulo}"
                onclick="filtrarToolbar('${titulo}')">
                <label>${titulo.toUpperCase()}</label>
                <span>${quantidade}</span>
            </div>
            `
        toolbar.insertAdjacentHTML('beforeend', novaTool)
    }

}

async function filtrarToolbar(campo) {

    controles.orcamentos.pagina = 1
    controles.orcamentos.filtros = {
        ...controles.orcamentos.filtros,
        'snapshots.ultimaCorrecao': { op: '=', value: campo }
    }

    if (campo == 'todos')
        delete controles.orcamentos.filtros['snapshots.ultimaCorrecao']

    await paginacao('orcamentos')

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
                on: "c.id::text = o.dados_orcam ->> 'omie_cliente'"
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
