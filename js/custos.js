async function painelCustos() {

    overlayAguarde()

    const orcamento = db.dados_orcamentos[id_orcam]
    const omieCliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omieCliente)

    const spans1 = (texto, valor) => `<span>${texto}: <b>${dinheiro(valor)}</b></span>`
    const colunas = ['Código', 'Descrição', 'Tipo', 'Valor no Orçamento', 'Custo Compra', 'Impostos', 'Frete Saída', 'Lucro Líquido', 'Lucratividade Individual']
    const ths = colunas.map(op => `<th>${op}</th>`).join('')
    const pesquisa = colunas.map((op, i) => `
        <th contentEditable="true" 
        style="text-align: left; background-color: white;"
        oninput="pesquisarGenerico('${i}', this.textContent, 'bodyCustos')">
        </th>
    `)
        .join('')


    const elemento = `
        <div class="painel-custos">

            <span>${cliente.nome}</span>
            <span><b>${orcamento.dados_orcam.contrato}</b></span>
            <span>${cliente.cidade}</span>

            <hr style="width: 100%;">

            <div style="${horizontal}; justify-content: start; gap: 2rem;">
            
                <img src="imagens/painelcustos.png" style="width: 3rem">

                <div style="${vertical}">
                    <span><span style="font-size: 1.5rem;">${dinheiro(orcamento.total_geral)}</span> Total do Orçamento</span>
                    <span><span style="font-size: 1.5rem;">${dinheiro(0)}</span> Lucratividade</span>
                    ${divPorcentagem(0)}
                </div>

            </div>

            <hr>

            <div class="toolbar-relatorio">
                <span id="toolbar-orcamento" onclick="mostrarPagina('orcamento')" style="opacity: 1;">Orçamento</span>
                <span id="toolbar-pagamentos" onclick="mostrarPagina('pagamentos')" style="opacity: 0.5;">Pagamentos</span>
            </div>
            
            <div class="orcamento">
                <div class="borda-tabela">
                    <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela" id="tabela_composicoes">
                            <thead>
                                <tr>${ths}</tr>
                                <tr>${pesquisa}</tr>
                            </thead>
                            <tbody id="bodyCustos"></tbody>
                        </table>
                    </div>
                    <div class="rodape-tabela"></div>
                </div>
            </div>

            <div class="pagamentos" style="display: none;">
                <div class="borda-tabela">
                    <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela" id="tabela_composicoes">
                            <thead>
                                <tr>${['Recebedor', 'Cidade', 'Valor', ''].map(op => `<th>${op}</th>`).join('')}</tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <div class="rodape-tabela"></div>
                </div>
            </div>

        </div>
    `

    const painelCustos = document.querySelector('.painel-custos')
    if (!painelCustos) popup({ elemento, titulo: 'Painel de Custos' })

    for (const [codigo, item] of Object.entries(orcamento.dados_composicoes || {})) {
        criarLinhaCusto(codigo, item)
    }

}

function criarLinhaCusto(codigo, item) {

    const totalLinha = 0

    const td = (valor) => `<td style="white-space: nowrap;">${dinheiro(valor)}</td>`

    const tds = `
        <td>${codigo}</td>
        <td>${item.descricao}</td>
        <td>${item.tipo}</td>

        ${td(totalLinha)}
        ${td()}
        ${td()}
        ${td()}
        ${td()}
        <td>
            ${divPorcentagem(0)}
        </td>
        `

    const trExistente = document.getElementById(`CUSTO_${codigo}`)
    if (trExistente)
        return trExistente.innerHTML = tds

    document
        .getElementById('bodyCustos')
        .insertAdjacentHTML('beforeend', `<tr id="${codigo}">${tds}</tr>`)

}
