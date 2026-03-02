async function painelCustos(id) {


    const { dados_orcam, dados_composicoes, total_geral } = await recuperarDado('dados_orcamentos', id) || {}

    const omieCliente = dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omieCliente)

    const tabelaOrcamento = await modTab({
        pag: 'custos',
        body: 'bodyCustos',
        criarLinha: 'criarLinhaCustoOrcamento',
        base: dados_composicoes || {},
        colunas: {
            'Código': {},
            'Descrição': { chave: 'descricao' },
            'Tipo': { chave: 'tipo', tipoPesquisa: 'select' },
            'Valor Unit Venda': {},
            'Valor Unit Compra': {},
            'Impostos': {},
            'Frete Saída': {},
            'Lucro Líquido': {},
            'Lucratividade Individual': {}
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
        .join('')

    const pagamentos = {
        ...await pesquisarDB({
            base: 'lista_pagamentos',
            filtros: {
                'snapshots.departamentos': { op: 'includes', value: dados_orcam?.contrato }
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

    const elemento = `
        <div class="painel-custos">

            <div style="${horizontal}; justify-content: start; gap: 2rem;">
            
                <img src="imagens/painelcustos.png">

                <div style="${vertical}">
                    <span><span style="font-size: 1.5rem;">${dinheiro(total_geral || 0)}</span> Total do Orçamento</span>
                    <span><span style="font-size: 1.5rem;">${dinheiro(0)}</span> Lucratividade</span>
                    ${divPorcentagem(0)}
                </div>

                <div style="${vertical};">
                    ${dados}
                </div>

            </div>

            <hr>

            <div class="toolbar-relatorio">
                <span id="toolbar-orcamento" onclick="mostrarPagina('orcamento')" style="opacity: 1;">Orçamento</span>
                <span id="toolbar-pagamentos" onclick="mostrarPagina('pagamentos')" style="opacity: 0.5;">Pagamentos</span>
            </div>
            
            <div name="orcamento" class="orcamento">
                ${tabelaOrcamento}
            </div>

            <div name="pagamentos" class="pagamentos" style="display: none;">
                ${tabelaPagamentos}
            </div>

        </div>
    `

    popup({ elemento, titulo: 'Painel de Custos' })

    await paginacao()

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

function criarLinhaCustoOrcamento(item) {

    const { codigo, descricao, tipo, custo } = item || {}


    const tds = `
        <td>${codigo}</td>
        <td>${descricao || ''}</td>
        <td>${tipo || ''}</td>

        <td style="white-space: nowrap;">${dinheiro(custo)}</td>
        <td style="white-space: nowrap;">${dinheiro(0)}</td>
        <td style="white-space: nowrap;">${dinheiro(0)}</td>
        <td style="white-space: nowrap;">${dinheiro(0)}</td>
        <td style="white-space: nowrap;">${dinheiro(0)}</td>
        <td>
            ${divPorcentagem(0)}
        </td>
        `

    return `<tr>${tds}</tr>`

}
