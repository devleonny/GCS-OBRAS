

function apagarOrcamentoLocacao() {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `confirmarExclusaoLocacao()` }
    ]

    popup({ elemento: 'Tem certeza que deseja apagar o Orçamento?', titulo: 'Limpar tela', botoes, modal: true })

}

async function confirmarExclusaoLocacao() {

    removerPopup()
    baseOrcamento(undefined, true)
    await telaCriarOrcamentoLocacao()

}

async function telaCriarOrcamentoLocacao() {

    // Última barreira: qualquer caminho que chegue aqui sem permissão para no aviso.
    if (bloquearLocacao())
        return

    modo = MODO_LOCACAO

    const acumulado = `
    <div class="contorno-tela-criar-orcamento">

        <div id="orcamento_locacao">

            <div class="menu-superior">

                <div style="${horizontal} justify-content: space-evenly; width: 100%;">
                    <div
                        style="display: flex; flex-direction: column; justify-content: center; align-items: start; border-radius: 3px;">
                        <label style="white-space: nowrap; margin-right: 2vw; font-size: 1.0em;">TOTAL MENSAL</label>
                        <label style="white-space: nowrap; font-size: 3.0em;" id="total_geral"></label>
                        <label style="white-space: nowrap;" id="total_contrato"></label>
                    </div>

                    <img src="imagens/direita.png">

                    <div style="${vertical}">
                        <label>Quantidade</label>
                        <input id="quantidade_periodo" type="number" oninput="total()" class="campo-locacao">
                    </div>

                    <div style="${vertical}">
                        <label>Período de Locação</label>
                        <select id="lpu" onchange="atualizarPeriodo(this.value)" class="campo-locacao">
                            ${['DIAS', 'SEMANAS', 'MESES', 'ANOS'].map(op => `<option>${op}</option>`).join('')}
                        </select>
                    </div>

                    <div style="${vertical}">
                        <label>Preço do equipamento</label>
                        <select id="lpu_locacao" onchange="alterarLpuLocacao(this.value)" class="campo-locacao"></select>
                    </div>

                </div>

                <div id="info_locacao" class="locacao-info"></div>

                <div id="desconto_total"></div>

            </div>

            <br>

            <div id="tabelas"></div>

            <div id="tabelaItens"></div>

        </div>

    </div>
    `
    const orcamentoLocacao = document.getElementById('orcamento_locacao')
    if (!orcamentoLocacao)
        tela.innerHTML = acumulado

    await carregarConfigLocacao()
    await carregarOpcoesLpuLocacao()
    await carregarTabelasLocacao()
    await tabelaProdutosLocacao()

    atualizarToolbar()
}

async function carregarTabelasLocacao() {

    let orcamentoBase = baseOrcamento()
    const linhas = document.getElementById(`linhas_${MODO_LOCACAO}`)
    const divTabelas = document.getElementById('tabelas')
    const tabela = MODO_LOCACAO

    if (linhas) return total()

    document.getElementById('lpu').value = orcamentoBase?.periodo || 'MESES'
    document.getElementById('quantidade_periodo').value = orcamentoBase?.quantidade_periodo || ''
    const colunas = ['Código', 'Descrição', 'Unidade', 'Quantidade', 'Valor do Equipamento', 'Mensalidade Unit', 'Total Mensal', 'Imagem', 'Remover']
    if (!linhas) divTabelas.innerHTML = `
        <div id="${tabela}" class="tabela-locacao">
            <table id="cabecalho_${tabela}" class="tabela-orcamento">
                <thead style="background-color: ${coresTabelas(tabela)};">
                    ${colunas.map(op => `<th>${op}</th>`).join('')}
                </thead>
                <tbody id="linhas_${tabela}"></tbody>
            </table>
        </div>
        `

    const dadosComposicoes = orcamentoBase?.dados_composicoes || {}

    // Itens salvos sem descrição (ex.: gravados como {} por versão antiga) recuperam do cadastro.
    const semDescricao = Object.entries(dadosComposicoes)
        .filter(([, produto]) => !descricaoValidaLocacao(produto?.descricao))
    if (semDescricao.length) {
        await Promise.all(semDescricao.map(async ([codigo, produto]) => {
            const cadastro = await recuperarDado('dados_composicoes', codigo) || {}
            dadosComposicoes[codigo] = {
                ...produto,
                descricao: descricaoValidaLocacao(cadastro.descricao) ? cadastro.descricao : '',
                unidade: produto?.unidade || cadastro.unidade
            }
        }))
        orcamentoBase.dados_composicoes = dadosComposicoes
        baseOrcamento(orcamentoBase)
    }

    for (const [codigo, produto] of Object.entries(dadosComposicoes)) {

        criarLinhaOrcLocacao(codigo, produto)

    }

    await total()

}

function descricaoValidaLocacao(descricao) {
    return typeof descricao === 'string' && descricao.trim() !== '' && descricao !== 'N/A'
}

// Única montagem da linha do orçamento: usada ao reabrir e ao incluir item.
// Equipamento (cadastro com Equipamento = SIM): a mensalidade sai do valor × coeficiente do prazo,
// a não ser que o usuário digite outra (mensalidade_manual). Item antigo que não é equipamento: valor digitado.
function criarLinhaOrcLocacao(codigo, produto) {
    const idLinha = `orc_${codigo}`
    const equipamento = produto?.equipamento === true
    const manual = equipamento && produto?.mensalidade_manual === true
    const valorEquipamento = equipamento
        ? `<input name="valor_equipamento" oninput="total()" type="number" step="0.01" class="campo-locacao" value="${produto?.valor_equipamento ?? ''}">`
        : `<span class="locacao-aviso">Não é equipamento</span>`
    const tds = `
        <td>${codigo}</td>
        <td name="descricao">${descricaoValidaLocacao(produto?.descricao) ? produto.descricao : 'N/A'}</td>
        <td style="text-align: center;">${produto?.unidade || 'UN'}</td>
        <td style="text-align: center;">
            <input name="quantidade" oninput="total()" type="number" class="campo-locacao" value="${produto?.qtde ?? ''}">
        </td>
        <td style="text-align: center;">${valorEquipamento}</td>
        <td style="text-align: center;">
            <div class="locacao-mensalidade">
                <input name="custo" oninput="marcarMensalidadeManual(this)" type="number" step="0.01" class="campo-locacao" value="${produto?.custo || ''}">
                <span name="origem" class="locacao-origem"></span>
            </div>
        </td>
        <td style="text-align: center;"><span name="total" class="valor-orcamento"></span></td>
        <td style="text-align: center;">
            <img class="imagem-orc" data-composicao="${escaparAtributo(codigo)}" onclick="abrirImagem(this, '${codigo}')" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo" src="${logo}">
        </td>
        <td style="text-align: center;">
            <img src="imagens/fechar.png" title="Remover item" onclick="removerItem('${codigo}', this)" style="width: 1.5rem;">
        </td>
    `

    const atributos = `data-equipamento="${equipamento ? 1 : 0}" data-manual="${manual ? 1 : 0}"`

    const trExistente = document.getElementById(idLinha)
    if (trExistente) {
        trExistente.dataset.equipamento = equipamento ? 1 : 0
        trExistente.dataset.manual = manual ? 1 : 0
        return trExistente.innerHTML = tds
    }

    const linhas = document.getElementById(`linhas_${MODO_LOCACAO}`)
    linhas.insertAdjacentHTML('beforeend', `<tr id="${idLinha}" ${atributos}>${tds}</tr>`)
}

async function atualizarPeriodo(periodo) {
    let orcamentoBase = baseOrcamento()
    orcamentoBase.periodo = periodo
    baseOrcamento(orcamentoBase)
    await total()
}

// Mensalidade digitada num equipamento: deixa de seguir a tabela até clicar em "recalcular".
async function marcarMensalidadeManual(input) {
    const tr = input.closest('tr')
    if (tr?.dataset.equipamento === '1') tr.dataset.manual = 1
    await total()
}

async function recalcularMensalidade(codigo) {
    const tr = document.getElementById(`orc_${codigo}`)
    if (tr) tr.dataset.manual = 0
    await total()
}

async function carregarOpcoesLpuLocacao() {
    if (typeof LPUS === 'undefined' || !Array.isArray(LPUS) || !LPUS.length) {
        const { lpus } = await recuperarDado('mvw_lpus', 1) || {}
        LPUS = lpus || []
    }
    const atual = baseOrcamento()?.locacao?.lpu || 'lpu hope'
    const opcoes = [...new Set([atual, ...LPUS])].sort((a, b) => a === 'lpu hope' ? -1 : b === 'lpu hope' ? 1 : a.localeCompare(b))
    const select = document.getElementById('lpu_locacao')
    select.innerHTML = opcoes.map(l => `<option value="${escaparAtributo(l)}">${escaparAtributo(String(l).toUpperCase())}</option>`).join('')
    select.value = atual
}

// Troca a LPU de referência: o valor de cada equipamento passa a ser o preço dele nessa LPU.
async function alterarLpuLocacao(lpu) {
    overlayAguarde()
    const orcamentoBase = baseOrcamento()
    orcamentoBase.locacao = { ...(orcamentoBase.locacao || {}), lpu }
    baseOrcamento(orcamentoBase)

    const semPreco = []
    for (const tr of document.querySelectorAll('tr[data-equipamento="1"]')) {
        const codigo = tr.querySelector('td').textContent
        const produto = await recuperarDado('dados_composicoes', codigo) || {}
        const preco = precoLpuLocacao(produto, lpu)
        if (preco > 0) tr.querySelector('[name="valor_equipamento"]').value = preco
        else semPreco.push(codigo)
    }

    await total()
    removerOverlay()
    if (semPreco.length)
        popup({ mensagem: `Sem preço na ${String(lpu).toUpperCase()}: ${semPreco.join(', ')}. O valor anterior foi mantido.` })
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

async function enviarDadosLocacao() {

    const orcamentoBase = baseOrcamento()
    sincronizarRevisaoAtual(orcamentoBase)

    if (!orcamentoBase?.dados_orcam?.omie_cliente) 
        return painelClientes()

    // Salvar o usuário na primeira vez apenas;
    if (!orcamentoBase.usuario) 
        orcamentoBase.usuario = acesso.usuario

    if (!orcamentoBase.id)
        orcamentoBase.id = 'ORCA_' + crypto.randomUUID()

    // Data de registro fixa e validade de 15 dias (validade_orcamento.js).
    garantirValidadeOrcamento(orcamentoBase.dados_orcam)

    popup({ tempo: 3, mensagem: 'Aguarde... redirecionando...', imagem: 'imagens/concluido.png' })

    const { success } = await enviar(`dados_orcamentos/${orcamentoBase.id}`, orcamentoBase) || {}

    // Deixa o PDF pronto no cache, em segundo plano (sem await).
    if (success) preaquecerPdfOrcamento(orcamentoBase.id)

    baseOrcamento(undefined, true)
    await telaOrcamentos()

    removerPopup()
}

async function tabelaProdutosLocacao() {

    const colunas = {
        'Código': { chave: 'codigo', },
        'Descrição': { chave: 'descricao' },
        'tipo': { chave: 'tipo' },
        'Quantidade': {},
        'Imagem': {}
    }

    let btnExtras = `<label style="color: white;">Somente itens classificados como <b>Equipamento</b> no cadastro</label>`

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
        filtrosFixos: { classificacao: { op: '=', value: 'EQUIPAMENTO' } },
        funcaoAdicional: ['total'],
        criarLinha: 'criarLinhaProdLocacao',
        body: 'bodyComposicoesLocacao',
        btnExtras,
        pag: 'orcamentoLocacao'
    })

    document.getElementById('tabelaItens').innerHTML = `<div style="margin-top: 1rem;">${tabela}</div>`

    await paginacao()

}

function criarLinhaProdLocacao(produto) {

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
            <input type="number" value="${escaparAtributo(quantidadeOrcamento)}" oninput="incluirItemLocacao('${codigo}', this.value)">
        </td>
        <td style="text-align: center;">
            <img class="imagem-orc" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo" src="${produto?.imagem || logo}" onclick="abrirImagem(this, '${codigo}')">
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
    const periodo = document.getElementById('lpu').value

    orcamentoBase.lpu_ativa = modo // Salvando no mesmo local que as LPUs, para mostrar na tabela geral;
    orcamentoBase.quantidade_periodo = quantidade_periodo
    // Período antigo fora da lista (ex.: 'MENSAL') fica como estava.
    if (periodo) orcamentoBase.periodo = periodo

    orcamentoBase.dados_composicoes ??= {}

    // Tabela de coeficientes deste orçamento (a copiada nele, ou a atual na primeira vez).
    const configLocacao = configLocacaoDoOrcamento(orcamentoBase)
    const mesesLocacao = prazoLocacaoMeses(periodo, quantidade_periodo)
    const coeficienteLocacao = mesesLocacao ? configLocacao.coeficientes[mesesLocacao] || null : null

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
            let tdQuantidade = tr.querySelector('[name="quantidade"]')
            let tdCusto = tr.querySelector('[name="custo"]')
            let tdTotal = tr.querySelector('[name="total"]')
            const origem = tr.querySelector('[name="origem"]')
            const inputValor = tr.querySelector('[name="valor_equipamento"]')

            const equipamento = tr.dataset.equipamento === '1'
            const manual = equipamento && tr.dataset.manual === '1'
            const valorEquipamento = inputValor ? Number(inputValor.value) || 0 : 0

            if (equipamento && !manual) {
                const calculo = mensalidadeLocacao({ valor: valorEquipamento, meses: mesesLocacao, config: configLocacao })
                if (calculo) {
                    tdCusto.value = calculo.mensalidade.toFixed(2)
                    origem.innerHTML = `Tabela ${mesesLocacao}m`
                } else {
                    origem.innerHTML = !(valorEquipamento > 0)
                        ? '<span class="locacao-aviso">Informe o valor</span>'
                        : '<span class="locacao-aviso">Sem coeficiente</span>'
                }
            } else if (manual) {
                origem.innerHTML = `<span class="locacao-recalcular" onclick="recalcularMensalidade('${codigo}')">Manual · recalcular</span>`
            } else {
                origem.innerHTML = ''
            }

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
                descricao: descricaoValidaLocacao(textoDescricao)
                    ? textoDescricao
                    : descricaoValidaLocacao(descricaoSalva) ? descricaoSalva : '',
                qtde: quantidade,
                custo: valorUnitario,
                tipo: modo, // Salvar como 'LOCAÇÃO' para que as próximas tabelas sejam configuradas de acordo;
                equipamento,
                ...(equipamento ? { valor_equipamento: valorEquipamento, mensalidade_manual: manual } : {})
            }

        }
    }

    for (tot in totais) {
        let divTotal = document.getElementById(`total_${tot}`)
        if (divTotal) divTotal.innerHTML = dinheiro(totais[tot].valor)
    }

    document.getElementById('total_geral').innerHTML = dinheiro(totais.GERAL.valor)
    orcamentoBase.total_geral = totais.GERAL.valor

    const totalContrato = mesesLocacao ? totais.GERAL.valor * mesesLocacao : null
    document.getElementById('total_contrato').innerHTML = totalContrato !== null
        ? `Contrato de ${mesesLocacao} meses: ${dinheiro(totalContrato)}`
        : ''

    orcamentoBase.locacao = {
        ...(orcamentoBase.locacao || {}),
        ...configLocacao,
        lpu: document.getElementById('lpu_locacao')?.value || orcamentoBase.locacao?.lpu || 'lpu hope',
        prazo_meses: mesesLocacao,
        coeficiente: coeficienteLocacao,
        total_contrato: totalContrato
    }

    document.getElementById('info_locacao').innerHTML = painelInfoLocacao({ config: configLocacao, meses: mesesLocacao, periodo })

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
    const tab = document.getElementById(MODO_LOCACAO)
    if (divQuieto) divQuieto.remove()

    if (orcamentoBase.dados_composicoes && Object.keys(orcamentoBase.dados_composicoes).length > 0) {
        tab.style.display = ''
    } else {
        tab.style.display = 'none'
        tabelas.insertAdjacentHTML('afterbegin', quieto)
    }

}

async function incluirItemLocacao(codigo, novaQuantidade) {

    const orcamentoBase = baseOrcamento()
    const produto = await recuperarDado('dados_composicoes', codigo) || {}

    // Só equipamentos entram na locação; material de consumo vai em orçamento comum.
    if (produto?.classificacao !== 'EQUIPAMENTO')
        return popup({ mensagem: `<b>${produto?.descricao || codigo}</b> não está classificado como Equipamento no cadastro.<br>Material vai em orçamento comum.` })

    const lpu = document.getElementById('lpu_locacao')?.value || 'lpu hope'
    const novoItem = {
        codigo: codigo,
        qtde: novaQuantidade,
        tipo: modo,
        unidade: produto?.unidade || 'UN',
        custo: 0,
        descricao: produto?.descricao,
        equipamento: true,
        valor_equipamento: precoLpuLocacao(produto, lpu),
        mensalidade_manual: false
    }

    if (itemExistente(modo, codigo, novaQuantidade)) {

        let tbody = document.getElementById(`linhas_${modo}`)

        if (!tbody) { // Lançamento do 1º Item de cada tipo;

            if (!orcamentoBase.dados_composicoes) {
                orcamentoBase.dados_composicoes = {}
            }

            orcamentoBase.dados_composicoes[codigo] = novoItem

            baseOrcamento(orcamentoBase)
            return carregarTabelasLocacao()

        } else {
            criarLinhaOrcLocacao(codigo, novoItem)
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
