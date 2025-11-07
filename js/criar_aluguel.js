function apagarOrcamentoAluguel() {

    popup(`
        <div style="display: flex; gap: 1vw; align-items: center; padding: 2vw; background-color: #d2d2d2;">
            <label>Tem certeza que deseja apagar o Orçamento?</label>
            ${botao('Confirmar', `confirmarExclusaoAluguel()`, 'green')}
        </div>
        `, 'Alerta')

}

async function confirmarExclusaoAluguel() {

    removerPopup()
    baseOrcamento(undefined, true)
    await telaCriarOrcamentoAluguel()

}

async function telaCriarOrcamentoAluguel() {

    funcaoTela = 'telaCriarOrcamentoAluguel'

    modo = 'ALUGUEL'

    const acumulado = `
    <div class="contornoTela">

        <div id="orcamento_padrao">

            <div class="menu-superior">

                <div style="${horizontal} justify-content: space-evenly; width: 100%;">
                    <div
                        style="display: flex; flex-direction: column; justify-content: center; align-items: start; border-radius: 3px;">
                        <label style="white-space: nowrap; margin-right: 2vw; font-size: 1.0em;">TOTAL GERAL</label>
                        <label style="white-space: nowrap; font-size: 3.0em;" id="total_geral"></label>
                    </div>

                    <img src="imagens/direita.png">

                    <div style="${vertical}">
                        <label>Quantidade</label>
                        <input id="quantidade_periodo" oninput="total()" class="opcoes">
                    </div>

                    <div style="${vertical}">
                        <label>Período de Locação</label>
                        <select id="lpu" onchange="atualizarPeriodo(this.value)" class="opcoes">
                            ${['DIAS', 'SEMANAS', 'MESES', 'ANOS'].map(op => `<option>${op}</option>`).join('')}
                        </select>
                    </div>

                </div>

                <div id="desconto_total"></div>

            </div>

            <br>

            <div id="tabelas"></div>

            <div id="tabelaItens"></div>

        </div>

    </div>
    `
    const orcamentoPadrao = document.getElementById('orcamento_padrao')
    if (!orcamentoPadrao) tela.innerHTML = acumulado

    criarMenus('criarOrcamentosAluguel')
    await carregarTabelasAluguel()
    await tabelaProdutosAluguel()
}

async function carregarTabelasAluguel() {

    let orcamentoBase = baseOrcamento()
    const linhas = document.getElementById('linhas_ALUGUEL')
    const divTabelas = document.getElementById('tabelas')
    const tabela = 'ALUGUEL'

    if(linhas) return total()

    document.getElementById('lpu').value = orcamentoBase?.periodo || 'DIA'
    document.getElementById('quantidade_periodo').value = orcamentoBase?.quantidade_periodo || ''
    const colunas = ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Custo Unit', 'Valor Total', 'Imagem', 'Remover']
    if(!linhas) divTabelas.innerHTML = `
        <div id="toolbarSuperior" style="display: none; justify-content: right; width: 100%;">
            <div class="menu-top" style="background-color: ${coresTabelas(tabela)};">
                <span>${tabela}</span>
                <label id="total_ALUGUEL">R$ -- </label>
            </div>
        </div>

        <div id="${tabela}">
            <table id="cabecalho_${tabela}" class="tabela-orcamento">
                <thead style="background-color: ${coresTabelas(tabela)};">
                    ${colunas.map(op => `<th>${op}</th>`).join('')}
                </thead>
                <tbody id="linhas_ALUGUEL"></tbody>
            </table>
        </div>
        `

    const dadosComposicoes = orcamentoBase?.dados_composicoes || {}

    for (const [codigo, produto] of Object.entries(dadosComposicoes)) {

        criarLinhaOrcAluguel(codigo, produto)

    }

    await total()

}

function criarLinhaOrcAluguel(codigo, produto) {
    const idLinha = `orc_${codigo}`
    const tds = `
        <td>${codigo}</td>
        <td>${produto?.descricao || 'N/A'}</td>
        <td>${produto?.unidade || 'UN'}</td>
        <td>
            <input oninput="total()" type="number" class="campoValor" value="${produto?.qtde || ''}">
        </td>
        <td>
            <input oninput="total()" type="number" class="campoValor" value="${produto?.custo || ''}">
        </td>
        <td><label></label></td>
        <td>
            <img onclick="abrirImagem(this, '${codigo}')" src="${produto?.imagem || logo}" style="width: 4rem;">
        </td>
        <td>
            <img src="imagens/cancel.png" onclick="removerItem('${codigo}', this)" style="width: 1.5rem;">
        </td>
    `

    const trExistente = document.getElementById(idLinha)
    if (trExistente) return trExistente.innerHTML = tds

    const linhas = document.getElementById(`linhas_ALUGUEL`)
    linhas.insertAdjacentHTML('beforeend', `<tr id="${idLinha}">${tds}</tr>`)
}

function atualizarPeriodo(periodo) {
    let orcamentoBase = baseOrcamento()
    orcamentoBase.periodo = periodo
    baseOrcamento(orcamentoBase)
}

function mostrarTabelaAluguel(tabela) {

    if (!tabela) return

    let divTabelas = document.getElementById('tabelas')
    let tabelas = divTabelas.querySelectorAll('table')

    tabelas.forEach(tab => {
        tab.parentElement.style.display = 'none'
    })

    let displayTabela = document.getElementById(tabela)

    displayTabela.style.display == 'none' ? displayTabela.style.display = 'flex' : ''

    let toolbarSuperior = document.getElementById('toolbarSuperior')
    let divs = toolbarSuperior.querySelectorAll('div')

    divs.forEach(div => {
        div.style.opacity = '0.7'
    })

    document.getElementById(`toolbar_${tabela}`).style.opacity = '1'
}

async function removerItem(codigo, img) {

    let orcamentoBase = baseOrcamento()

    if (orcamentoBase.dados_composicoes[codigo]) {

        delete orcamentoBase.dados_composicoes[codigo]

        baseOrcamento(orcamentoBase)

        img.parentElement.parentElement.remove() // Equivalente a tr

        await total()
    }

}

async function enviarDadosAluguel() {
    let orcamentoBase = baseOrcamento()
    orcamentoBase.origem = origem

    if (!orcamentoBase.dados_orcam) {
        return popup(mensagem('Preencha os dados do Cliente'), 'Alerta')
    }

    const dados_orcam = orcamentoBase.dados_orcam;

    if (dados_orcam.cliente_selecionado === '') return popup(mensagem('Cliente em branco'), 'Alerta')

    if (dados_orcam.contrato === '') return popup(mensagem('Chamado em branco'), 'Alerta')

    if (dados_orcam.contrato == 'sequencial') {
        const resposta = await proxORC()
        if (resposta.err) return popup(mensagem(resposta.err), 'Alerta', true)
        orcamentoBase.dados_orcam.contrato = `ORC_${resposta.proximo}`
    }

    if (orcamentoBase.total_desconto > 0) {
        orcamentoBase.aprovacao = {
            status: 'pendente',
            usuario: acesso.usuario
        }
    }

    if (!orcamentoBase.id) orcamentoBase.id = 'ORCA_' + unicoID();

    popup(mensagem('Aguarde... redirecionando...', 'imagens/concluido.png'), 'Processando...')

    await inserirDados({ [orcamentoBase.id]: orcamentoBase }, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${orcamentoBase.id}`, orcamentoBase)

    baseOrcamento(undefined, true)
    await telaOrcamentos(true)

    removerPopup()
}

function pesquisarProdutosAluguel(col, texto) {

    if (!filtrosPagina[pagina]) {
        filtrosPagina[pagina] = {}
    }

    pesquisarGenerico(col, texto, filtrosPagina[pagina], `compos_${pagina}`)
}

async function recuperarComposicoesAluguel() {

    overlayAguarde()

    let nuvem = await receber('dados_composicoes')

    await inserirDados(nuvem, 'dados_composicoes')
    await tabelaProdutosAluguel()

    removerOverlay()
}

async function tabelaProdutosAluguel() {

    const moduloComposicoes = (
        acesso.permissao == 'adm' ||
        acesso.permissao == 'log' ||
        acesso.permissao == 'editor' ||
        acesso.permissao == 'gerente' ||
        acesso.permissao == 'diretor'
    )

    const colunas = ['Código', 'Descrição', 'tipo', 'Quantidade', 'Imagem']
    let ths = ''
    let pesquisa = ''
    colunas.forEach((col, i) => {
        ths += `<th>${col}</th>`
        pesquisa += `<th contentEditable="true" style="text-align: left; background-color: white;" oninput="pesquisarProdutosAluguel(${i}, this.textContent)"></th>`
    })

    let botoes = `
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
                onclick="recuperarComposicoesAluguel()">
                <img src="imagens/atualizar_2.png" style="width: 30px; cursor: pointer;">
                <label style="color: white; cursor: pointer;">Atualizar</label>
            </div>`

    if (moduloComposicoes) {
        botoes += `
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
                onclick="cadastrarItem()">
                <img src="imagens/add.png" style="width: 30px; cursor: pointer;">
                <label style="color: white; cursor: pointer;">Criar Item</label>
            </div>`
    }

    const cor = `background-color: ${coresTabelas('ALUGUEL')}`

    const acumulado = `
        <div style="position: relative; display: flex; justify-content: center; width: 100%; margin-top: 30px; gap: 10px;">
            <label class="menu-top" style="${cor};" onclick="alterarTabela('ALUGUEL')">ALUGUEL</label>
            ${botoes}
        </div>

        <div class="borda-tabela"">
            <div class="topo-tabela" style="${cor}"></div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisa}</tr>
                    </thead>
                    <tbody id="linhasProdAluguel"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
        `

    const linhasProdAluguel = document.getElementById('linhasProdAluguel')
    const tabelaItens = document.getElementById('tabelaItens')
    if (!linhasProdAluguel) tabelaItens.innerHTML = acumulado

    dados_composicoes = await recuperarDados('dados_composicoes') || {}

    for (const [codigo, produto] of Object.entries(dados_composicoes)) {

        if (origem !== produto.origem) continue

        criarLinhaProdAluguel(codigo, produto)
    }

}

function criarLinhaProdAluguel(codigo, produto) {

    const linhasProdAluguel = document.getElementById('linhasProdAluguel')

    const tds = `
        <td>
            <div style="${horizontal}; gap: 5px;">
                <label>${codigo}</label>
                <div style="${horizontal}">
                    ${moduloComposicoes ? `<img src="imagens/editar.png" style="width: 1.5vw; cursor: pointer;" onclick="cadastrarItem('${codigo}')">` : ''}
                    ${moduloComposicoes ? `<img src="imagens/excluir.png" style="width: 1.5vw; cursor: pointer;" onclick="confirmarExclusao_item('${codigo}')">` : ''}
                </div>
            </div>
        </td>
        <td>
            <div style="${vertical}; text-align: left;">
                <b>Descrição</b>
                ${produto.descricao}<br>
                <b>Fabricante</b>
                ${produto.fabricante}<br>
                <b>Modelo</b>
                ${produto.modelo}<br>
            </div>
        </td>
        <td>${produto.tipo}</td>
        <td style="text-align: center;">
            <input type="number" class="campoValor" oninput="incluirItemAluguel('${codigo}', this.value)">
        </td>
        <td style="text-align: center;">
            <img src="${produto?.imagem || logo}" style="width: 4rem; cursor: pointer;" onclick="abrirImagem(this, '${codigo}')">
        </td>
    `

    const idElem = `prod_${codigo}`
    const trExistente = document.getElementById(idElem)
    if (trExistente) return trExistente.innerHTML = tds

    linhasProdAluguel.insertAdjacentHTML('beforeend', `<tr id="${idElem}">${tds}</tr>`)

}

async function total() {

    let orcamentoBase = baseOrcamento() || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let totais = { GERAL: { valor: 0, exibir: 'none', bruto: 0 } }
    let divTabelas = document.getElementById('tabelas')
    let tables = divTabelas.querySelectorAll('table')
    let quantidade_periodo = document.getElementById('quantidade_periodo').value

    orcamentoBase.lpu_ativa = modo // Salvando no mesmo local que as LPUs, para mostrar na tabela geral;
    orcamentoBase.quantidade_periodo = quantidade_periodo

    if (!orcamentoBase.dados_composicoes) orcamentoBase.dados_composicoes = {}

    tables.forEach(tab => {
        let nomeTabela = String(tab.id).split('_')[1]
        totais[nomeTabela] = { valor: 0, exibir: 'none' }
    })

    if (orcamentoBase.dados_composicoes) {
        for (let tabela in totais) {

            if (tabela == 'GERAL') continue

            let tbody = document.getElementById(`linhas_${tabela}`)
            if (!tbody) continue

            let trs = tbody.querySelectorAll('tr')

            if (trs.length > 0) {
                totais[tabela].exibir = 'flex'
            } else {
                totais[tabela].exibir = 'none'
            }

            trs.forEach(tr => {
                let tds = tr.querySelectorAll('td')
                let codigo = tds[0].textContent
                let tdDescricao = tds[1]
                let tdQuantidade = tds[3].querySelector('input')
                let tdCusto = tds[4].querySelector('input')
                let tdTotal = tds[5].querySelector('label')

                let valorUnitario = Number(tdCusto.value)
                let quantidade = Number(tdQuantidade.value)
                let descricao = dados_composicoes[codigo]?.descricao || 'Atualize a base de Produtos'
                let totalLinha = valorUnitario * quantidade

                // Valor bruto sem desconto;
                totais.GERAL.bruto += totalLinha

                if (!totais[modo]) {
                    totais[modo] = { valor: 0, exibir: 'none' }
                }

                totais[modo].valor += totalLinha
                totais.GERAL.valor += totalLinha

                // Inclusão dos dados atualizados nas tds
                tdDescricao.textContent = descricao

                tdTotal.classList = 'labelAprovacao'
                tdTotal.style.backgroundColor = totalLinha > 0 ? 'green' : '#B12425'
                tdTotal.textContent = dinheiro(totalLinha)

                // Salvamento dos itens no Orcamento
                if (!orcamentoBase.dados_composicoes[codigo]) orcamentoBase.dados_composicoes[codigo] = {}

                orcamentoBase.dados_composicoes[codigo] = {
                    ...orcamentoBase.dados_composicoes[codigo],
                    codigo,
                    descricao,
                    qtde: quantidade,
                    custo: valorUnitario,
                    tipo: modo // Salvar como 'ALUGUEL' para que as próximas tabelas sejam configuradas de acordo;
                }

            })
        }
    }

    for (tot in totais) {
        let divTotal = document.getElementById(`total_${tot}`)
        if (divTotal) divTotal.textContent = dinheiro(totais[tot].valor)
    }

    document.getElementById('total_geral').textContent = dinheiro(totais.GERAL.valor)
    orcamentoBase.total_geral = totais.GERAL.valor

    baseOrcamento(orcamentoBase)

    // Mensagem aleatório de boas vindas;
    let aleatorio = Math.floor(Math.random() * metaforas.length)
    const quieto = `
        <div class="quieto">
            <label class="novo_titulo">${metaforas[aleatorio]}</label>
        </div>
    `
    let tabelas = document.getElementById('tabelas')
    let divQuieto = document.querySelector('.quieto')
    if (divQuieto) divQuieto.remove()

    if (orcamentoBase.dados_composicoes && Object.keys(orcamentoBase.dados_composicoes).length > 0) {
        document.getElementById('toolbarSuperior').style.display = 'flex'
    } else {
        tabelas.insertAdjacentHTML('afterbegin', quieto)
    }

}

async function incluirItemAluguel(codigo, novaQuantidade) {
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamentoBase = baseOrcamento()
    let produto = dados_composicoes[codigo]

    let linha = `
        <tr>
            <td>${codigo}</td>
            <td style="position: relative;"></td>
            <td style="text-align: center;">${produto?.unidade}</td>
            <td style="text-align: center;">
                <input oninput="total()" type="number" class="campoValor" value="${novaQuantidade}">
            </td>
            <td style="text-align: center;">
                <input oninput="total()" type="number" class="campoValor">
            </td>
            <td>
                <label></label>
            </td>
            <td style="text-align: center;">
                <img onclick="abrirImagem(this, '${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
            </td>
            <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${codigo}', this)" style="cursor: pointer; width: 2vw;"></td>
        </tr>
    `

    if (itemExistente(modo, codigo, novaQuantidade)) {

        let tbody = document.getElementById(`linhas_${modo}`)

        if (!tbody) { // Lançamento do 1º Item de cada tipo;

            if (!orcamentoBase.dados_composicoes) {
                orcamentoBase.dados_composicoes = {}
            }

            orcamentoBase.dados_composicoes[codigo] = {
                codigo: codigo,
                qtde: novaQuantidade,
                tipo: produto?.tipo,
                unidade: produto?.unidade || 'UN',
                custo: 0,
                descricao: produto?.descricao
            }

            baseOrcamento(orcamentoBase)
            return carregarTabelasAluguel()

        } else {
            tbody.insertAdjacentHTML('beforeend', linha)
        }
    }

    await total()
}

function itemExistente(tipo, codigo, quantidade) {

    let incluir = true
    let orcamentoBase = baseOrcamento()
    let linhas = document.getElementById(`linhas_${tipo}`)
    if (!linhas) return incluir
    let trs = linhas.querySelectorAll('tr')

    trs.forEach(tr => {

        let tds = tr.querySelectorAll('td')
        let acrescimo = orcamentoBase.lpu_ativa !== 'LPU CARREFOUR' ? 0 : 1

        if (tds[0].textContent == codigo) {

            incluir = false
            tds[3 + acrescimo].querySelector('input').value = quantidade

        }

    })

    return incluir

}
