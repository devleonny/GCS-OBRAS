async function painelCustos(id) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const { dados_orcam, snapshots } = orcamento
    // Salvo localmente;
    controles.orcamento ??= {}
    controles.orcamento.save = orcamento

    const omieCliente = dados_orcam?.omie_cliente || ''
    const { cliente, cidade } = snapshots || {}

    const dados = [
        cliente,
        cidade,
        dados_orcam?.contrato
    ]
        .filter(d => d)
        .map(d => `<span>${d}</span>`)
        .join('')


    const esquema = [
        {
            titulo: 'Total do Orçamento',
            id: 't-orcamento',
            funcao: `tabOrcamentoCusto()`
        },
        {
            titulo: 'Pagamentos Solicitados',
            id: 't-pagamentos',
            funcao: `tabPagamentosCusto()`
        },
        {
            titulo: 'Abastecimento',
            id: 't-abastecimento',
            funcao: `tabVeiculosCusto()`
        },
        {
            titulo: 'Fretes',
            id: 't-fretes',
            funcao: `tabFretesCusto()`
        }
    ]

    const toolbar = esquema
        .map(({ titulo, id, funcao }) => {

            return `
            <div onclick="${funcao}" class="balao-checklist">
                <label>${titulo}</label>
                <div id="${id}">
                    <img src="gifs/loading.gif" style="width: 5rem">
                </div>
            </div>
        `
        })
        .join('')

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <div class="toolbar-checklist">

                <div style="${horizontal}; gap: 5px;">
                    <img src="imagens/GrupoCostaSilva.png" style="width: 7rem;">
                    <div style="${vertical}">${dados}</div>
                </div>

                <div class="resultados">
                    ${toolbar}
                </div>

            </div>

            <div class="painel-custos"></div>

        </div>
    `

    popup({ elemento, titulo: 'Painel de Custos' })

    await carregarTotaisCusto(id)

}

async function tabOrcamentoCusto() {

    const { esquema_composicoes, dados_composicoes } = controles.orcamento.save || {}

    const pag = 'criarOrcamento'
    const tabela = await modTab({
        base: Object.values(esquema_composicoes || dados_composicoes || {}),
        pag,
        nude: true,
        scroll: true,
        editavel: false,
        funcaoAdicional: ['formatarLinhasOrcamento', 'calcularSubtotais'],
        body: 'bodyOrcamento',
        criarLinha: 'carregarLinhaOrcamento',
        colunas: {}
    })

    const painel = document.querySelector('.painel-custos')

    painel.innerHTML = tabela

    await paginacao(pag)

}

async function tabPagamentosCusto() {

    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato

    const pag = 'custosPagamentos'
    const tabela = await modTab({
        pag,
        body: 'bodyCustosPagamentos',
        criarLinha: 'criarLinhaCustoPagamento',
        base: 'lista_pagamentos',
        filtros: {
            'snapshots.departamentos.*.departamento': { op: 'includes', value: contrato },
            'param.*.codigo_tipo_documento': { op: '!=', value: 'CTE' },
        },
        colunas: {
            'Data': { chave: 'param.*.data_previsao', tipoPesquisa: 'data' },
            'Valor': { chave: 'descricao' },
            'Status': { chave: 'status', tipoPesquisa: 'select' },
            'Solicitante': { chave: 'criado' },
            'Recebedor': {},
            'Detalhes': {}
        }
    })

    const painel = document.querySelector('.painel-custos')

    painel.innerHTML = tabela

    await paginacao(pag)

}

async function tabVeiculosCusto() {

    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato

    const pag = 'custo-veiculos'
    const tabela = await modTab({
        pag,
        body: 'bodyVeiculos',
        base: 'custo_veiculos',
        criarLinha: 'criarLinhaCustoVeiculo',
        filtros: {
            'snapshots.departamentos.*.departamento': { op: '=', value: contrato }
        },
        colunas: {
            'Data Pagamento': { chave: 'data_pagamento', tipoPesquisa: 'data' },
            'Comentário': { chave: 'comentario' },
            'Realizado': { chave: 'snapshots.realizado' },
            'Criado por': { chave: 'usuario' },
            'Motorista': { chave: 'snapshots.motoristas' }
        }
    })

    const painel = document.querySelector('.painel-custos')

    painel.innerHTML = tabela

    await paginacao(pag)

}

async function tabFretesCusto() {

    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato

    const pag = 'custosFretes'

    const tabela = await modTab({
        pag,
        body: 'bodyCustosFretes',
        criarLinha: 'criarLinhaCustoPagamento',
        base: 'lista_pagamentos',
        filtros: {
            'snapshots.departamentos.*.departamento': { op: 'includes', value: contrato },
            'param.*.codigo_tipo_documento': { op: '=', value: 'CTE' },
        },
        colunas: {
            'Data': { chave: 'param.*.data_previsao', tipoPesquisa: 'data' },
            'Valor': { chave: 'descricao' },
            'Status': { chave: 'status', tipoPesquisa: 'select' },
            'Solicitante': { chave: 'criado' },
            'Recebedor': {},
            'Detalhes': {}
        }
    })

    const painel = document.querySelector('.painel-custos')

    painel.innerHTML = tabela

    await paginacao(pag)

}

async function criarLinhaCustoVeiculo(combustivel) {

    const { data_pagamento, comentario, realizado, usuario, snapshots } = combustivel || {}
    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato
    const departamento = (snapshots?.departamentos || [])
        .filter(d => d.departamento == contrato)

    const dMotoristas = (snapshots?.motoristas || [])
        .join('\n')

    const tr = `
        <tr>
            <td>${new Date(data_pagamento).toLocaleDateString()}</td>
            <td>${comentario}</td>
            <td>${dinheiro(departamento?.[0]?.valor || 0)}</td>
            <td>${usuario}</td>
            <td>${dMotoristas}</td>
        </tr>
    `

    return tr
}

async function criarLinhaCustoPagamento(pagamento) {

    const { dados_orcam } = controles?.orcamento?.save || {}
    const { criado, param, status, snapshots } = pagamento || {}
    const { valor_documento, data_previsao, codigo_cliente_fornecedor } = param?.[0] || {}
    const cliente = snapshots?.cliente || ''
    const contrato = dados_orcam?.contrato
    const valor = (snapshots.departamentos || [])
        .filter(d => d.departamento == contrato)

    const tds = `
        <td>${data_previsao || ''}</td>
        <td style="white-space: nowrap;">${dinheiro(valor?.[0]?.valor)}</td>
        <td>${status || ''}</td>
        <td>${criado || ''}</td>
        <td>${cliente || ''}</td>
        <td>
            <img src="imagens/pesquisar2.png" onclick="abrirDetalhesPagamentos('${pagamento.id}')">
        </td>
        `

    return `<tr>${tds}</tr>`

}

async function carregarTotaisCusto() {

    const { dados_orcam, snapshots, total_geral } = controles.orcamento.save || {}

    atualizar('t-orcamento', dinheiro(total_geral))

    const filtro = { op: 'includes', value: dados_orcam?.contrato }

    const somaPagamentos = await contarPorCampo({
        base: 'lista_pagamentos',
        filtros: {
            'departamento': filtro,
            'param.*.codigo_tipo_documento': { op: '!=', value: 'CTE' },
        },
        explode: { path: 'snapshots.departamentos' },
        path: 'valor',
        modo: 'soma'
    })

    atualizar('t-pagamentos', dinheiro(somaPagamentos.total))

    const somaFretes = await contarPorCampo({
        base: 'lista_pagamentos',
        filtros: {
            'param.*.codigo_tipo_documento': { op: '=', value: 'CTE' },
            'departamento': filtro
        },
        explode: { path: 'snapshots.departamentos' },
        path: 'valor',
        modo: 'soma'
    })

    atualizar('t-fretes', dinheiro(somaFretes.total))

    const somaCombustiveis = await contarPorCampo({
        base: 'custo_veiculos',
        filtros: {
            'departamento': filtro
        },
        explode: { path: 'snapshots.departamentos' },
        path: 'valor',
        modo: 'soma'
    })

    atualizar('t-abastecimento', dinheiro(somaCombustiveis.total))

    function atualizar(id, valor) {
        const ele = document.getElementById(id)
        if (ele)
            ele.textContent = valor
    }

}