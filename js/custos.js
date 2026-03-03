async function painelCustos(id) {


    const { dados_orcam, lpu_ativa, dados_composicoes, total_geral } = await recuperarDado('dados_orcamentos', id) || {}

    const omieCliente = dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omieCliente)

    const tabelaOrcamento = await modTab({
        pag: 'custos',
        body: 'bodyCustos',
        lpu: String(lpu_ativa).toLowerCase(),
        criarLinha: 'criarLinhaCustoOrcamento',
        base: dados_composicoes || {},
        colunas: {
            'Marcar': {},
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao' },
            'Tipo': { chave: 'tipo', tipoPesquisa: 'select' },
            'Valor Unit Venda': {},
            'Quantidade': {},
            'Unidade': { chave: 'unidade', tipoPesquisa: 'select' },
            'Valor Total Venda': {},
            'Desconto': {},
            'Valor Unit Compra': {},
            'Valor Total Compra': {},
            'Frete Saída': {},
            'Lucratividade R$': {},
            'Lucratividade %': {}
        }
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
        filtros: { 'snapshots.departamentos': filtros },
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
            'Criado por': { chave: 'usuario' }
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

                </div>

            </div>

            <div style="width: 100%;">
                <div class="toolbar-relatorio">
                    <span data-toolbar="orcamento" onclick="mostrarPagina(this)" style="opacity: 1;">Orçamento</span>
                    <span data-toolbar="pagamentos" onclick="mostrarPagina(this)" style="opacity: 0.5;">Pagamentos</span>
                    <span data-toolbar="veiculos" onclick="mostrarPagina(this)" style="opacity: 0.5;">Combustíveis</span>
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
            </div>

        </div>
    `

    popup({ elemento, titulo: 'Painel de Custos' })

    await paginacao()

}

async function criarLinhaCustoVeiculo(combustivel) {

    const { data_pagamento, comentario, realizado, usuario } = combustivel || {}

    const tr = `
        <tr>
            <td>${new Date(data_pagamento).toLocaleDateString()}</td>
            <td>${comentario}</td>
            <td>${dinheiro(realizado || 0)}</td>
            <td>${usuario}</td>
        </tr>
    `

    return tr
}

async function criarLinhaCustoPagamento(pagamento) {

    const { criado, param, status } = pagamento || {}
    const { valor_documento, data_previsao, codigo_cliente_fornecedor } = param?.[0] || {}
    const { nome } = await recuperarDado('dados_clientes', codigo_cliente_fornecedor) || {}

    const tds = `
        <td>${data_previsao || ''}</td>
        <td style="white-space: nowrap;">${dinheiro(valor_documento)}</td>
        <td>${status || ''}</td>
        <td>${criado || ''}</td>
        <td>${nome || ''}</td>
        <td>
            <img src="imagens/pesquisar2.png">
        </td>
        `

    return `<tr>${tds}</tr>`

}

async function criarLinhaCustoOrcamento(item) {

    const { codigo, descricao, unidade, tipo, qtde, desconto, custo } = item || {}
    const produto = await recuperarDado('dados_composicoes', codigo) || {}
    const { lpu } = controles.custos || {}

    const tabPreco = produto[lpu] || {}
    const ativo = tabPreco.historico?.[tabPreco?.ativo] || {}
    const custoCompra = ativo.custo || 0


    const totalUnit = qtde * custo
    const totalCompra = qtde * custoCompra || 0
    const lucratividade = totalUnit - totalCompra - desconto

    const lucraPorc = ((lucratividade / totalUnit) * 100).toFixed(1)

    const tds = `

        <td>
            <input type="checkbox" style="width: 1.5rem; height: 1.5rem;">
        </td>
        <td>${codigo}</td>
        <td>${descricao || ''}</td>
        <td>${tipo || ''}</td>

        <td style="white-space: nowrap;">${dinheiro(custo)}</td>
        <td>${qtde}</td>
        <tD>${unidade || 'UN'}</td>
        <td style="white-space: nowrap;">${dinheiro(totalUnit)}</td>
        <td style="white-space: nowrap;">${dinheiro(desconto || 0)}</td>
        <td style="white-space: nowrap;">${dinheiro(custoCompra || 0)}</td>
        <td style="white-space: nowrap;">${dinheiro(totalCompra)}</td>
        <td style="white-space: nowrap;">${0}</td>
        <td style="white-space: nowrap;">${dinheiro(lucratividade)}</td>
        <td>
            ${divPorcentagem(lucraPorc)}
        </td>
        `

    return `<tr>${tds}</tr>`

}
