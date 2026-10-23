

function apagarOrcamentoAluguel() {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `confirmarExclusaoAluguel()` }
    ]

    popup({ elemento: 'Tem certeza que deseja apagar o Orçamento?', titulo: 'Limpar tela', botoes })

}

async function confirmarExclusaoAluguel() {

    removerPopup()
    baseOrcamento(undefined, true)
    await telaCriarOrcamentoAluguel()

}

async function telaCriarOrcamentoAluguel() {

    modo = 'ALUGUEL'

    const acumulado = `
    <div class="contorno-tela-criar-orcamento">

        <div id="orcamento_aluguel">

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
                        <input id="quantidade_periodo" type="number" oninput="total()" class="campo-aluguel">
                    </div>

                    <div style="${vertical}">
                        <label>Período de Locação</label>
                        <select id="lpu" onchange="atualizarPeriodo(this.value)" class="campo-aluguel">
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
    const orcamentoAluguel = document.getElementById('orcamento_aluguel')
    if (!orcamentoAluguel)
        tela.innerHTML = acumulado

    await carregarTabelasAluguel()
    await tabelaProdutosAluguel()

    atualizarToolbar()
}

async function carregarTabelasAluguel() {

    let orcamentoBase = baseOrcamento()
    const linhas = document.getElementById('linhas_ALUGUEL')
    const divTabelas = document.getElementById('tabelas')
    const tabela = 'ALUGUEL'

    if (linhas) return total()

    document.getElementById('lpu').value = orcamentoBase?.periodo || 'DIAS'
    document.getElementById('quantidade_periodo').value = orcamentoBase?.quantidade_periodo || ''
    const colunas = ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Custo Unit', 'Valor Total', 'Imagem', 'Remover']
    if (!linhas) divTabelas.innerHTML = `
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

    // Itens salvos sem descrição (ex.: gravados como {} por versão antiga) recuperam do cadastro.
    const semDescricao = Object.entries(dadosComposicoes)
        .filter(([, produto]) => !descricaoValidaAluguel(produto?.descricao))
    if (semDescricao.length) {
        await Promise.all(semDescricao.map(async ([codigo, produto]) => {
            const cadastro = await recuperarDado('dados_composicoes', codigo) || {}
            dadosComposicoes[codigo] = {
                ...produto,
                descricao: descricaoValidaAluguel(cadastro.descricao) ? cadastro.descricao : '',
                unidade: produto?.unidade || cadastro.unidade,
                imagem: produto?.imagem || cadastro.imagem
            }
        }))
        orcamentoBase.dados_composicoes = dadosComposicoes
        baseOrcamento(orcamentoBase)
    }

    for (const [codigo, produto] of Object.entries(dadosComposicoes)) {

        criarLinhaOrcAluguel(codigo, produto)

    }

    await total()

}

function descricaoValidaAluguel(descricao) {
    return typeof descricao === 'string' && descricao.trim() !== '' && descricao !== 'N/A'
}

// Única montagem da linha do orçamento: usada ao reabrir e ao incluir item.
function criarLinhaOrcAluguel(codigo, produto) {
    const idLinha = `orc_${codigo}`
    const tds = `
        <td>${codigo}</td>
        <td name="descricao">${descricaoValidaAluguel(produto?.descricao) ? produto.descricao : 'N/A'}</td>
        <td style="text-align: center;">${produto?.unidade || 'UN'}</td>
        <td style="text-align: center;">
            <input name="quantidade" oninput="total()" type="number" class="campo-aluguel" value="${produto?.qtde ?? ''}">
        </td>
        <td style="text-align: center;">
            <input name="custo" oninput="total()" type="number" class="campo-aluguel" value="${produto?.custo || ''}">
        </td>
        <td style="text-align: center;"><span name="total" class="valor-orcamento"></span></td>
        <td style="text-align: center;">
            <img class="imagem-orc" onclick="abrirImagem(this, '${codigo}')" src="${produto?.imagem || logo}">
        </td>
        <td style="text-align: center;">
            <img src="imagens/fechar.png" title="Remover item" onclick="removerItem('${codigo}', this)" style="width: 1.5rem;">
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

    const orcamentoBase = baseOrcamento()
    sincronizarRevisaoAtual(orcamentoBase)

    if (!orcamentoBase?.dados_orcam?.omie_cliente) 
        return painelClientes()

    // Salvar o usuário na primeira vez apenas;
    if (!orcamentoBase.usuario) 
        orcamentoBase.usuario = acesso.usuario

    if (!orcamentoBase.id) 
        orcamentoBase.id = 'ORCA_' + crypto.randomUUID()

    popup({ tempo: 3, mensagem: 'Aguarde... redirecionando...', imagem: 'imagens/concluido.png' })

    await enviar(`dados_orcamentos/${orcamentoBase.id}`, orcamentoBase)

    baseOrcamento(undefined, true)
    await telaOrcamentos()

    removerPopup()
}

async function tabelaProdutosAluguel() {

    const colunas = {
        'Código': { chave: 'codigo', },
        'Descrição': { chave: 'descricao' },
        'tipo': { chave: 'tipo' },
        'Quantidade': {},
        'Imagem': {}
    }

    let btnExtras = ''

    if (moduloComposicoes) {
        btnExtras += `
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
                onclick="cadastrarItem()">
                <img src="imagens/add.png" style="width: 30px; cursor: pointer;">
                <label style="color: white; cursor: pointer;">Criar Item</label>
            </div>`
    }

    // Fica abaixo da tabela do orçamento: sem altura mínima, a altura disponível chega a 0
    // quando o orçamento cresce e a tabela some. Mesmo valor da tela de orçamento normal.
    const tabela = await modTab({
        base: 'dados_composicoes',
        alturaMinima: '60dvh',
        colunas,
        funcaoAdicional: ['total'],
        criarLinha: 'criarLinhaProdAluguel',
        body: 'bodyComposicoesAluguel',
        btnExtras,
        pag: 'orcamentoAluguel'
    })

    document.getElementById('tabelaItens').innerHTML = `<div style="margin-top: 1rem;">${tabela}</div>`

    await paginacao()

}

function criarLinhaProdAluguel(produto) {

    const { codigo } = produto
    // Mesma ideia do orçamento normal: a quantidade já lançada volta preenchida.
    const quantidadeOrcamento = baseOrcamento()?.dados_composicoes?.[codigo]?.qtde ?? ''

    const tds = `
        <td>
            <div class="campo-codigo-composicao">
                <span>${codigo}</span>
                ${moduloComposicoes ? `<div class="composicao"><img src="imagens/editar.png" onclick="cadastrarItem('${codigo}')"></div>` : ''}
            </div>
        </td>
        <td>
            <div style="${vertical}; text-align: left;">
                <b>Descrição</b>
                ${produto.descricao || ''}<br>
                ${produto.fabricante ? `<b>Fabricante</b> ${produto.fabricante}<br>` : ''}
                ${produto.modelo ? `<b>Modelo</b> ${produto.modelo}<br>` : ''}
            </div>
        </td>
        <td>${produto.tipo || ''}</td>
        <td>
            <input type="number" value="${escaparAtributo(quantidadeOrcamento)}" oninput="incluirItemAluguel('${codigo}', this.value)">
        </td>
        <td style="text-align: center;">
            <img class="imagem-orc" src="${produto?.imagem || logo}" onclick="abrirImagem(this, '${codigo}')">
        </td>
    `

    return `<tr>${tds}</tr>`

}

async function total() {

    let orcamentoBase = baseOrcamento() || {}
    let totais = { GERAL: { valor: 0, exibir: 'none', bruto: 0 } }
    let divTabelas = document.getElementById('tabelas')
    let tables = divTabelas.querySelectorAll('table')
    let quantidade_periodo = document.getElementById('quantidade_periodo').value

    orcamentoBase.lpu_ativa = modo // Salvando no mesmo local que as LPUs, para mostrar na tabela geral;
    orcamentoBase.quantidade_periodo = quantidade_periodo

    orcamentoBase.dados_composicoes ??= {}

    tables.forEach(tab => {
        let nomeTabela = String(tab.id).split('_')[1]
        totais[nomeTabela] = { valor: 0, exibir: 'none' }
    })

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

        for (const tr of trs) {

            const tds = tr.querySelectorAll('td')

            const codigo = tds[0].textContent

            let tdDescricao = tds[1]
            let tdQuantidade = tds[3].querySelector('input')
            let tdCusto = tds[4].querySelector('input')
            let tdTotal = tds[5].querySelector('[name="total"]')

            let valorUnitario = Number(tdCusto.value)
            let quantidade = Number(tdQuantidade.value)
            let totalLinha = valorUnitario * quantidade

            // Valor bruto sem desconto;
            totais.GERAL.bruto += totalLinha

            if (!totais[modo]) {
                totais[modo] = { valor: 0, exibir: 'none' }
            }

            totais[modo].valor += totalLinha
            totais.GERAL.valor += totalLinha

            tdTotal.innerHTML = dinheiro(totalLinha)

            // Salvamento dos itens no Orcamento
            orcamentoBase.dados_composicoes[codigo] ??= {}

            // Texto da célula ("N/A" é só exibição); senão mantém a descrição já salva.
            const textoDescricao = tdDescricao.textContent.trim()
            const descricaoSalva = orcamentoBase.dados_composicoes[codigo].descricao

            orcamentoBase.dados_composicoes[codigo] = {
                ...orcamentoBase.dados_composicoes[codigo],
                codigo,
                descricao: descricaoValidaAluguel(textoDescricao)
                    ? textoDescricao
                    : descricaoValidaAluguel(descricaoSalva) ? descricaoSalva : '',
                qtde: quantidade,
                custo: valorUnitario,
                tipo: modo // Salvar como 'ALUGUEL' para que as próximas tabelas sejam configuradas de acordo;
            }

        }
    }

    for (tot in totais) {
        let divTotal = document.getElementById(`total_${tot}`)
        if (divTotal) divTotal.innerHTML = dinheiro(totais[tot].valor)
    }

    document.getElementById('total_geral').innerHTML = dinheiro(totais.GERAL.valor)
    orcamentoBase.total_geral = totais.GERAL.valor

    // Salvar a revisão, se existirem;
    const selectRevisao = document.querySelector('[name="revisao"]')
    if (selectRevisao && selectRevisao.value !== '' && orcamentoBase.revisoes) {
        const revisao = selectRevisao.value
        orcamentoBase.revisoes.historico[revisao] = structuredClone(orcamentoBase.dados_composicoes)
    }

    baseOrcamento(orcamentoBase)

    // Mensagem aleatório de boas vindas;

    const quieto = `
        <div class="quieto">
            <label class="novo_titulo">Sem Itens</label>
        </div>
    `
    const tabelas = document.getElementById('tabelas')
    const divQuieto = document.querySelector('.quieto')
    const tab = document.getElementById('ALUGUEL')
    if (divQuieto) divQuieto.remove()

    if (orcamentoBase.dados_composicoes && Object.keys(orcamentoBase.dados_composicoes).length > 0) {
        tab.style.display = ''
    } else {
        tab.style.display = 'none'
        tabelas.insertAdjacentHTML('afterbegin', quieto)
    }

}

async function incluirItemAluguel(codigo, novaQuantidade) {

    const orcamentoBase = baseOrcamento()
    const produto = await recuperarDado('dados_composicoes', codigo) || {}

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
            criarLinhaOrcAluguel(codigo, {
                descricao: produto?.descricao,
                unidade: produto?.unidade,
                imagem: produto?.imagem,
                qtde: novaQuantidade
            })
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
