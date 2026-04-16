async function painelCustos(id) {

    overlayAguarde()

    const { dados_orcam, snapshots, esquema_composicoes, dados_composicoes, lpu_ativa, total_geral } = await recuperarDado('dados_orcamentos', id) || {}

    const omieCliente = dados_orcam?.omie_cliente || ''
    const cliente = snapshots?.cliente || {}

    const pag = 'criarOrcamento'
    const tabelaOrcamento = await modTab({
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

    const dados = [
        cliente?.nome,
        cliente?.cidade,
        dados_orcam?.chamado,
        dados_orcam?.contrato
    ]
        .filter(d => d)
        .map(d => `<span>${d}</span>`)
        .join('\n')


    const filtros = []
    if (dados_orcam?.contrato)
        filtros.push({ op: 'includes', value: dados_orcam?.contrato })

    if (dados_orcam?.chamado)
        filtros.push({ op: 'includes', value: dados_orcam?.chamado })

    const pagamentos = {
        ...await pesquisarDB({
            base: 'lista_pagamentos',
            filtros: {
                'snapshots.departamentos': filtros
            }
        })
    }

    const tabelaPagamentos = await modTab({
        pag: 'custosPagamentos',
        body: 'bodyCustosPagamentos',
        criarLinha: 'criarLinhaCustoPagamento',
        base: pagamentos.resultados,
        filtros: {
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

    const somaPagamentos = await contarPorCampo({
        base: 'lista_pagamentos',
        filtros: {
            'snapshots.departamentos': filtros,
            'param.*.codigo_tipo_documento': { op: '!=', value: 'CTE' },
        },
        path: 'param.*.valor_documento',
        modo: 'soma'
    })

    const tabelaFretes = await modTab({
        pag: 'custosFretes',
        body: 'bodyCustosFretes',
        criarLinha: 'criarLinhaCustoPagamento',
        base: pagamentos.resultados,
        filtros: {
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

    const somaFretes = await contarPorCampo({
        base: 'lista_pagamentos',
        filtros: {
            'param.*.codigo_tipo_documento': { op: '=', value: 'CTE' },
            'snapshots.departamentos': filtros
        },
        path: 'param.*.valor_documento',
        modo: 'soma'
    })

    const tabelaVeiculos = await modTab({
        pag: 'custoVeiculos',
        body: 'custoVeiculos',
        base: 'custo_veiculos',
        criarLinha: 'criarLinhaCustoVeiculo',
        filtros: { 'snapshots.departamentos': filtros },
        colunas: {
            'Data Pagamento': { chave: 'data_pagamento', tipoPesquisa: 'data' },
            'Comentário': { chave: 'comentario' },
            'Realizado': { chave: 'snapshots.realizado' },
            'Criado por': { chave: 'usuario' },
            'Motorista': { chave: 'snapshots.motoristas' }
        }
    })

    const somaCombustiveis = await contarPorCampo({
        base: 'custo_veiculos',
        filtros: { 'snapshots.departamentos': filtros },
        path: 'realizado',
        modo: 'soma'
    })

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <div class="toolbar-checklist">
            
                <img src="imagens/GrupoCostaSilva.png" style="width: 7rem;">

                <div class="resultados">

                    <div class="balao-checklist">
                        <label>Dados do Orçamento</label>
                        <span>${dados}</span>
                    </div>

                    <div class="balao-checklist">
                        <label>Total do Orçamento</label>
                        <span>${dinheiro(total_geral || 0)}</span>
                    </div>

                    <div class="balao-checklist">
                        <label>Pagamentos Solicitados</label>
                        <span>${dinheiro(somaPagamentos?.todos || 0)}</span>
                    </div>

                    <div class="balao-checklist">
                        <label>Abastecimento</label>
                        <span>${dinheiro(somaCombustiveis?.todos || 0)}</span>
                    </div>

                    <div class="balao-checklist">
                        <label>Fretes</label>
                        <span>${dinheiro(somaFretes?.todos || 0)}</span>
                    </div>

                </div>

            </div>

            <div style="width: 100%;">
                <div class="toolbar-relatorio">
                    <span data-toolbar="orcamento" onclick="mostrarPagina(this)" style="opacity: 1;">Orçamento</span>
                    <span data-toolbar="pagamentos" onclick="mostrarPagina(this)" style="opacity: 0.5;">Pagamentos</span>
                    <span data-toolbar="veiculos" onclick="mostrarPagina(this)" style="opacity: 0.5;">Combustíveis</span>
                    <span data-toolbar="fretes" onclick="mostrarPagina(this)" style="opacity: 0.5;">Fretes</span>
                </div>
                
                <div data-tabela="orcamento">
                    ${tabelaOrcamento}
                </div>

                <div data-tabela="pagamentos" style="display: none;">
                    ${tabelaPagamentos}
                </div>

                <div data-tabela="veiculos" style="display: none;">
                    ${tabelaVeiculos}
                </div>

                <div data-tabela="fretes" style="display: none;">
                    ${tabelaFretes}
                </div>
            </div>

        </div>
    `

    popup({ elemento, titulo: 'Painel de Custos' })

    await paginacao()

}

async function criarLinhaCustoVeiculo(combustivel) {

    const { data_pagamento, comentario, realizado, usuario, snapshots } = combustivel || {}

    const dMotoristas = (snapshots?.motoristas || [])
        .join('\n')

    const tr = `
        <tr>
            <td>${new Date(data_pagamento).toLocaleDateString()}</td>
            <td>${comentario}</td>
            <td>${dinheiro(realizado || 0)}</td>
            <td>${usuario}</td>
            <td>${dMotoristas}</td>
        </tr>
    `

    return tr
}

async function criarLinhaCustoPagamento(pagamento) {

    const { criado, param, status, snapshots } = pagamento || {}
    const { valor_documento, data_previsao, codigo_cliente_fornecedor } = param?.[0] || {}
    const cliente = snapshots?.cliente || ''

    const tds = `
        <td>${data_previsao || ''}</td>
        <td style="white-space: nowrap;">${dinheiro(valor_documento)}</td>
        <td>${status || ''}</td>
        <td>${criado || ''}</td>
        <td>${cliente || ''}</td>
        <td>
            <img src="imagens/pesquisar2.png">
        </td>
        `

    return `<tr>${tds}</tr>`

}
