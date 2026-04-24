let lpuATIVA = null

const substituicoes = (lpu) => {
    return [
        {
            path: 'codigo',
            tabela: 'dados_composicoes',
            campoBusca: 'codigo',
            retorno: `snapshots.${lpu.toLowerCase()}.0`,
            destino: 'custo'
        },
        {
            path: 'agrupamento.*.codigo',
            tabela: 'dados_composicoes',
            campoBusca: 'codigo',
            retorno: `snapshots.${lpu.toLowerCase()}.0`,
            destino: 'agrupamento.*.custo'
        }
    ]
}

function coresTabelas(tabela) {

    const coresTabelas = {
        'GERAL': '#938e28',
        'VENDA': '#B12425',
        'SERVIÇO': '#008000',
        'USO E CONSUMO': '#24729d',
        'ALUGUEL': '#e96300'
    }

    if (coresTabelas[tabela]) {
        return coresTabelas[tabela]
    } else {
        return '#938e28'
    }

}

function apagarOrcamento() {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `confirmarExclusaoOrcamento()` }
    ]

    popup({ botoes, mensagem: 'Você quer limpar essa tela? <b>Isso não apagará o orçamento salvo*</b>' })
}

async function confirmarExclusaoOrcamento() {
    removerPopup()
    baseOrcamento(undefined, true)
    document.getElementById('tabelas').innerHTML = ''
    await telaCriarOrcamento()
}

async function telaCriarOrcamento() {

    funcaoTela = 'telaCriarOrcamento'
    modo = ''

    const modelo = (texto, img) => `
        <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/${img}.png" style="width: 1.7rem;">
            <span>${texto}</span>
        </div>
    `

    const acumulado = `
    <div class="contornoTela">

        <div id="orcamento_padrao" style="width: 100%;">

            <div class="menu-superior">

                <img src="imagens/GrupoCostaSilva.png" style="width: 10vw;">

                <div style="${vertical}">

                    <label style="font-size: 1.2rem;">TOTAL GERAL</label>
                    <label style="font-size: 1.7rem;" id="total_geral"></label>
                    <br>
                    
                    <div style="${horizontal}; gap: 1rem;">
                        <img src="imagens/alerta.png">
                        <span>Alterar a tabela removerá seus <b>descontos/acréscimos</b></span>
                    </div>

                    <div style="${horizontal}; gap: 1rem;">
                        <label style="font-size: 1em;">Tabela de preço</label>
                        <select id="lpu" onchange="alterarTabelaLPU(this.value)"
                            style="background-color: white; border-radius: 3px; padding: 5px;">
                        </select>
                    </div>

                </div>

                <div class="resumo">
                    <label>RESUMO</label>
                    <hr>
                    <label><b>Total Bruto</b></label>
                    <label id="total-bruto"></label>
                    <label><b>Diferença</b></label>
                    <label id="diferenca-rs"></label>
                </div>

                <div style="${vertical}; gap: 3px; margin-right: 0.5rem;">
                    <span>LEGENDAS</span>
                    <hr style="width: 100%;">
                    ${modelo('Preço Atualizado', 'preco')}
                    ${modelo('Preço Desatualizado', 'preco_neg')}
                    ${modelo('Itens Agrupados', 'elo')}
                    ${modelo('Ajustar o preço', 'ajustar')}
                </div>

            </div>

            <br>

            <div id="tabelas"></div>
            <div id="tabelaItens"></div>

        </div>

    </div>

    <div id="orcamento_livre"></div>
    `

    const orcamentoPadrao = document.getElementById('orcamento_padrao')
    if (!orcamentoPadrao)
        tela.innerHTML = acumulado

    // Inicializar tabelas;
    const orcamento = baseOrcamento()
    if (orcamento?.esquema_composicoes)
        await manterPrecos()
    else
        await manterPrecosAntigos()

}

async function manterPrecos() {

    const linhas = [
        {
            elemento: `
                <p style="text-align: left;">
                    Decida se quer editar este orçamento considerando <br>
                    os preços de <strong>quando o orçamento foi feito</strong>, <br>
                    ou se prefere atualizar tudo: <br>
                </p>`
        }
    ]

    const botoes = [
        { texto: 'Atualizar', fechar: true, img: 'atualizados', funcao: `manterPrecosAntigos('N')` },
        { texto: 'Manter preços', fechar: true, img: 'atrasado', funcao: `manterPrecosAntigos('S')` },
    ]

    popup({ linhas, botoes, titulo: 'Manter Preços', removerAnteriores: true })

}

async function manterPrecosAntigos(resposta) {

    overlayAguarde()

    await atualizarOpcoesLPU()
    await tabelaProdutosOrcamentos()
    await carregarTabelasOrcamento(resposta)

    removerOverlay()

}

async function atualizarToolbar(remover) {

    titulo = document.querySelector('[name="titulo"]')

    if (remover)
        return titulo.textContent = 'GCS'

    const orcamentoBase = baseOrcamento()
    const edicao = orcamentoBase?.dados_orcam?.contrato == 'sequencial' || (orcamentoBase && orcamentoBase?.dados_orcam?.contrato)
    const contrato = orcamentoBase?.dados_orcam?.contrato == 'sequencial' ? 'Código a definir...' : orcamentoBase?.dados_orcam?.contrato

    const modelo = (titulo, elemento) => `
        <div style="${vertical};">
            <span style="font-size: 0.7rem; color: white;">${titulo}</span>
            <div style="${horizontal}; gap: 5px;">
                ${elemento}
            </div>
        </div>
    `
    const revisoes = Object.keys(orcamentoBase?.revisoes?.historico || {})
        .map(R => `<option ${orcamentoBase?.revisoes?.atual == R ? 'selected' : ''}>${R}</option>`)
        .join('')

    const temporario = JSON.parse(localStorage.getItem('temporario')) || {}

    const alterarOrcTemp = Object.keys(temporario).length
        ? `<img src="imagens/pasta.png" onclick="painelEdicao()">`
        : ''

    titulo.innerHTML = `
        <div style="${horizontal}; gap: 0.5rem;">
            ${alterarOrcTemp}
            <img src="${edicao ? 'gifs/atencao.gif' : 'imagens/concluido.png'}" style="width: 2rem;">
            <span>${edicao ? `Editando: <b>${contrato}</b>` : 'Novo Orçamento'}</span>

            <img src="imagens/avanco.png" style="width: 1.5rem;">

            ${modelo('Revisões', `
                ${revisoes.length !== 0 ? `<select onchange="alterarRevisao()" name="revisao" class="opcoes">${revisoes}</select>` : ''}
                <img src="imagens/baixar.png" onclick="salvarRevisao()" style="width: 1.5rem;">
                ${revisoes.length !== 0 ? `<img src="imagens/cancel.png" onclick="excluirRevisao()" style="width: 1.5rem;">` : ''}
            `)}

        </div>
    `
}

function excluirRevisao() {
    const revisao = document.querySelector('[name="revisao"]').value

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `confirmarExclusaoRevisao()` }
    ]

    popup({ botoes, mensagem: `Deseja excluir a <b>${revisao}</b>?`, titulo: 'Tem certeza?' })

}

function confirmarExclusaoRevisao() {
    const revisao = document.querySelector('[name="revisao"]').value
    const orcamento = baseOrcamento()
    orcamento.revisoes ??= {}

    if (!orcamento?.revisoes?.historico?.[revisao])
        return

    delete orcamento.revisoes.historico[revisao]
    const chavesRevisoes = Object.keys(orcamento?.revisoes?.historico || {})
    const RX = chavesRevisoes[0]
    const composicoes = structuredClone(orcamento?.revisoes?.historico?.[RX] || {})

    if (orcamento.lpu_ativa == 'ALUGUEL')
        orcamento.dados_composicoes = composicoes
    else
        orcamento.esquema_composicoes = composicoes

    orcamento.revisoes.atual = RX

    revisao.innerHTML = chavesRevisoes.map(r => `<option ${r == RX ? 'selected' : ''}>${r}</option>`).join('')

    baseOrcamento(orcamento)

    atualizarToolbar()
    removerPopup()
}


async function alterarRevisao() {
    const revisao = document.querySelector('[name="revisao"]').value

    const orcamento = baseOrcamento()
    const revisaoAtual = orcamento?.revisoes?.atual
    orcamento.revisoes.atual = revisao

    const cloneComposicoes = structuredClone(orcamento.lpu_ativa == 'ALUGUEL' ? orcamento.dados_composicoes : orcamento.esquema_composicoes)

    if (revisaoAtual)
        orcamento.revisoes.historico[revisaoAtual] = cloneComposicoes

    if (orcamento.lpu_ativa == 'ALUGUEL') {
        orcamento.dados_composicoes = orcamento.revisoes.historico[revisao]

    } else {
        orcamento.esquema_composicoes = orcamento.revisoes.historico[revisao]
    }

    baseOrcamento(orcamento)

    controles.criarOrcamento.base = Object.values(orcamento?.esquema_composicoes || {})

    await paginacao('criarOrcamento')

}

async function salvarRevisao() {
    const orcamento = baseOrcamento()

    orcamento.revisoes ??= {}
    orcamento.revisoes.historico ??= {}

    const numeros = Object.keys(orcamento.revisoes.historico)
        .map(r => Number(r.replace('R', '')))

    const proximoNumero = numeros.length
        ? Math.max(...numeros) + 1
        : 1

    const numeroRevisao = `R${proximoNumero}`

    orcamento.revisoes.atual = numeroRevisao

    const esquema = orcamento.lpu_ativa == 'ALUGUEL'
        ? orcamento.dados_composicoes
        : orcamento.esquema_composicoes

    orcamento.revisoes.historico[numeroRevisao] = structuredClone(esquema)

    baseOrcamento(orcamento)
    await atualizarToolbar()
}

async function atualizarOpcoesLPU() {

    const orcamentoBase = baseOrcamento() || {}

    const lpusOrdenadas = [...LPUS].sort((a, b) => {
        if (a === 'lpu hope') return -1
        if (b === 'lpu hope') return 1
        return a.localeCompare(b)
    })

    document.getElementById('lpu').innerHTML = lpusOrdenadas
        .map(lpu => {
            return `<option ${orcamentoBase?.lpu_ativa?.toLowerCase() == lpu ? 'selected' : ''}>${lpu.toUpperCase()}</option>`
        })
        .join('')

    orcamentoBase.lpu_ativa = lpu.value
    baseOrcamento(orcamentoBase)

}

async function alterarTabelaLPU(tabelaLPU) {

    lpuATIVA = tabelaLPU
    document.getElementById('lpu').value = tabelaLPU

    const orcamentoBase = baseOrcamento()
    orcamentoBase.lpu_ativa = tabelaLPU
    baseOrcamento(orcamentoBase)

    await carregarTabelasOrcamento('N')
    await tabelaProdutosOrcamentos()

}

async function carregarTabelasOrcamento(resposta = 'S') {

    let orcamentoBase = baseOrcamento()
    lpuATIVA = String(orcamentoBase.lpu_ativa).toLowerCase()

    // Remover custos_originais;
    if (resposta == 'N') {

        for (const produtoMaster of Object.values(orcamentoBase?.esquema_composicoes || {})) {

            // Raíz
            delete produtoMaster.custo_original

            // Agrupamento
            for (const produtoSlave of Object.values(produtoMaster?.agrupamento || {}))
                delete produtoSlave.custo_original

        }
    }

    const pag = 'criarOrcamento'
    const tabelaOrcamento = await modTab({
        base: Object.values(orcamentoBase?.esquema_composicoes || orcamentoBase.dados_composicoes || {}),
        pag,
        ordenar: {
            direcao: 'asc',
            path: 'ordem'
        },
        filtros: {},
        priBase: resposta,
        substituicoes: resposta == 'N'
            ? substituicoes(lpuATIVA)
            : [],
        scroll: true,
        nude: true,
        editavel: true,
        funcaoAdicional: ['totalOrcamento'],
        body: 'bodyOrcamento',
        criarLinha: 'carregarLinhaOrcamento'
    })

    document.getElementById('tabelas').innerHTML = `
        
        <div style="display: flex; align-items: center; justify-content: center; margin-left: 1rem; gap: 1rem;">

            <div class="pesquisa-orcamento">
                <input id="termoPesquisa" oninput="pesquisarEmOrcamentos({path: 'codigo', op: 'includes', value: this.value})" placeholder="Código">
                <img src="imagens/pesquisar4.png" style="width: 1.5rem; padding: 0.5rem;"> 
            </div>
            <div class="pesquisa-orcamento">
                <input id="termoPesquisa" oninput="pesquisarEmOrcamentos({path: 'descricao', op: 'includes', value: this.value})" placeholder="Descrição">
                <img src="imagens/pesquisar4.png" style="width: 1.5rem; padding: 0.5rem;"> 
            </div>
            <div class="toolbarSuperior"></div>
        </div>
        ${tabelaOrcamento}

    `

    await paginacao(pag)

    // Salvando o orçamento com o esquema;
    orcamentoBase = baseOrcamento()
    orcamentoBase.esquema_composicoes = Object.fromEntries(
        (controles?.criarOrcamento?.base || []).map(item => { return [item.codigo, item] })
    )

    baseOrcamento(orcamentoBase)

    // Reset nas substituições;
    controles.criarOrcamento.substituicoes = []

}

function carregarLinhaOrcamento(produto) {

    const { agrupamento } = produto || {}
    const codigoMaster = produto.codigo
    const editavel = controles?.criarOrcamento?.editavel || false

    const linhaSlave = Object.values(agrupamento || {})
        .map(produto => {

            return `
                <div data-hierarquia="slave" data-codigo="${produto.codigo}" class="linha-orcamento" id="${codigoMaster}_${produto.codigo}">
                    ${criarLinha(produto)}
                </div>
            `
        })
        .join('')

    const celulasMaster = criarLinha(produto)

    const linha = `
        <tr>
            <td>
                <div id="ORCA_${codigoMaster}" style="${vertical};">
                    <div data-hierarquia="master" class="linha-orcamento" data-codigo="${codigoMaster}">${celulasMaster}</div>
                    <div class="linha-bloco">${linhaSlave}</div>
                    <div class="total-linha">
                        <span name="totalBloco"></span>
                    </div>
                </div>
            </td>
        </tr>
    `
    return linha

    function criarLinha(produto) {

        const { codigo, tipo, qtde, cnpj, custo, razaoSocial, custo_original, descricao, unidade, imagem } = produto || {}
        const total = custo * qtde
        const chave = codigoMaster !== codigo
            ? `${codigoMaster}_${codigo}`
            : codigo

        // Ajuste de preço;
        const dif = custo_original
            ? custo - custo_original
            : 0

        const sinal = dif == 0
            ? null
            : dif > 0
                ? 'acima'
                : 'abaixo'

        const precoAjustado = `
            <div>
                <img src="imagens/${sinal}.png">
                <span class="valor-orcamento">${dinheiro(dif * qtde)}</span>
            </div>`

        const celulas = `
            <div style="${horizontal}; padding: 0.5rem; gap: 0.5rem;">
                <span>${codigo}</span>
            </div>

            <div style="${vertical}">
                <span name="descricao">${descricao || 'N/A'}</span>
                <b><span name="tipo" style="font-size: 0.7rem">${tipo}</span></b>
                <div name="descVD" style="${horizontal}; display: none; gap: 2px;">
                    <textarea placeholder="CNPJ" oninput="totalOrcamento()" name="cnpj">${cnpj || ''}</textarea>
                    <textarea placeholder="RAZÃO SOCIAL" oninput="totalOrcamento()" name="razaoSocial">${razaoSocial || ''}</textarea>
                </div>
                <div name="master"></div>
            </div>

            <div name="medida">${unidade || 'UN'}</div>

            <div>
                <input name="quantidade" oninput="atualizarQtde('${chave}', this)" type="number" class="campo-valor" value="${qtde}" ${editavel ? '' : 'readOnly'}>
            </div>

            <div style="${horizontal}; justify-content: start; gap: 1rem;">
                ${editavel ? `<img onclick="alterarValorUnitario('${chave}', 'unitario')" src="imagens/ajustar.png" style="width: 1.5rem;">` : ''}
                <span name="unitario" onclick="abrirHistoricoPrecos('${codigo}', '${lpuATIVA}')" class="valor-orcamento">${dinheiro(custo || '')}</span>
            </div>

            <div style="${horizontal}; justify-content: start; gap: 1rem;">
                ${editavel ? `<img onclick="alterarValorUnitario('${chave}', 'total')" src="imagens/ajustar.png" style="width: 1.5rem;">` : ''}
                <span name="total" class="valor-orcamento">${dinheiro(total)}</span>
            </div>

            <div>
                ${sinal ? precoAjustado : ''}
            </div>

            <div>
                <img class="imagem-orc" name="${codigo}" 
                    onclick="abrirImagem('${codigo}')" src="${imagem || logo}">
            </div>
            
            <div>
                ${editavel
                ? `<img src="imagens/cancel.png" 
                    onclick="removerItemOrcamento('${chave}')" 
                    style="width: 1.5rem;">`
                : ''
            }
            </div>
        `
        return celulas
    }

}

function atualizarQtde(chave, input) {

    const qtde = Number(input.value)
    const orcamento = baseOrcamento()
    const [codigoMaster, codigoSlave] = chave.includes('_')
        ? chave.split('_')
        : [chave, null]

    orcamento.esquema_composicoes ??= {}
    orcamento.esquema_composicoes[codigoMaster] ??= {}

    // Slave
    if (codigoSlave) {

        orcamento.esquema_composicoes[codigoMaster].agrupamento ??= {}
        orcamento.esquema_composicoes[codigoMaster].agrupamento[codigoSlave] ??= {}
        orcamento.esquema_composicoes[codigoMaster].agrupamento[codigoSlave].qtde = qtde

    } else { // Master
        orcamento.esquema_composicoes[codigoMaster].qtde = qtde
    }

    baseOrcamento(orcamento)

    // paginado;
    controles.criarOrcamento.base = Object.values(orcamento.esquema_composicoes)

    totalOrcamento()

}

async function totalOrcamento() {

    atualizarToolbar()

    if (!controles.criarOrcamento)
        return

    formatarLinhasOrcamento()
    calcularSubtotais()

}


function calcularSubtotais() {

    const totais = {
        BRUTO: 0,
        GERAL: 0
    }

    // Atualização estática, com dados do objeto;
    const base = controles?.criarOrcamento?.base || []

    for (const item of base) {

        // Item principal;
        const { tipo, custo, custo_original, qtde, agrupamento } = item

        // Bruto
        totais.BRUTO += ((custo_original || custo) * qtde)

        const total = custo * qtde
        totais[tipo] ??= 0
        totais[tipo] += total
        totais.GERAL += total

        // Agrupados;
        for (const item of Object.values(agrupamento || {})) {

            const { tipo, custo, custo_original, qtde } = item

            // Bruto
            totais.BRUTO += ((custo_original || custo) * qtde)

            const total = custo * qtde
            totais[tipo] ??= 0
            totais[tipo] += total
            totais.GERAL += total

        }

    }

    // Atualizar visualmente apenas;
    const blocos = [...document.querySelectorAll('div[id^="ORCA_"]')]
    blocos.forEach(bloco => {
        const linhas = [...bloco.querySelectorAll('.linha-orcamento')]

        let totalBloco = 0

        linhas.forEach(linha => {
            const valor = conversor(linha.querySelector('[name="unitario"]').textContent)
            const qtde = Number(linha.querySelector('[name="quantidade"]').value)
            const total = valor * qtde
            totalBloco += total

            linha.querySelector('[name="total"]').textContent = dinheiro(total)
        })

        const totalBlocoDiv = bloco.querySelector('.total-linha')
        if (totalBlocoDiv)
            totalBlocoDiv.querySelector('span').textContent = dinheiro(totalBloco)
    })

    const modeloToolbar = (tool, total) => `
        <div onclick="pesquisarEmOrcamentos({path: 'tipo', value: '${tool == 'GERAL' ? '' : tool}'})" id="toolbar_${tool}" style="background-color: ${coresTabelas(tool)}" class="menu-top">
            <span style="font-size: 0.6rem;">${tool}</span>
            <span style="font-size: 1rem;">${dinheiro(total)}</span>
        </div>
    `

    const dif = totais.GERAL - totais.BRUTO
    const sinal = dif == 0
        ? null
        : dif > 0
            ? 'acima'
            : 'abaixo'

    // Recorte usado apenas na tela Criar Orçamento;
    if (!document.getElementById('total-bruto'))
        return

    document.getElementById('total-bruto').textContent = dinheiro(totais.BRUTO)
    document.getElementById('diferenca-rs').innerHTML = !sinal
        ? 'Sem diferença'
        : `
        <div style="${horizontal}; gap: 5px;">
            <img src="imagens/${sinal}.png">
            <span>${dinheiro(dif)} (${((dif / totais.BRUTO) * 100).toFixed(1)} %)</span>
        </div>
    `
    document.getElementById('total_geral').textContent = dinheiro(totais.GERAL)

    const toolbar = Object.entries(totais)
        .filter(([tool,]) => tool !== 'BRUTO')
        .map(([tool, total]) => modeloToolbar(tool, total))
        .join('')

    const toolbarSuperior = document.querySelector('.toolbarSuperior')
    if (toolbarSuperior)
        toolbarSuperior.innerHTML = toolbar


    // Salvamento dos totais;
    const orcamento = baseOrcamento()
    orcamento.total_geral = totais.GERAL
    orcamento.total_bruto = totais.BRUTO
    orcamento.diferenca = dif
    baseOrcamento(orcamento)

}

async function pesquisarEmOrcamentos({ path, op = '=', value }) {

    controles.criarOrcamento.filtros = {
        ...controles.criarOrcamento.filtros,
        [path]: { op, value }
    }

    if (value == '')
        delete controles.criarOrcamento.filtros[path]

    await paginacao('criarOrcamento')

}

function formatarLinhasOrcamento() {

    // Cor do cabeçalho;
    const menuPaginacao = document.getElementById('paginacao_criarOrcamento')
    if (!menuPaginacao)
        return

    const topoTabela = menuPaginacao.closest('.topo-tabela')
    const filtro = controles?.criarOrcamento?.filtros?.tipo?.value || 'GERAL'
    topoTabela.style.backgroundColor = coresTabelas(filtro)

    // Quando não tiver pesquisa ou filtragem por tipo;
    document.querySelectorAll('#bodyOrcamento .linha-orcamento').forEach(linha => {
        const hierarquia = linha.dataset.hierarquia

        linha.style.backgroundColor = hierarquia === 'master'
            ? 'white'
            : '#fff8d3'

        linha.style.borderRadius = '0px'

        if (hierarquia === 'master') {
            linha.style.borderTopLeftRadius = '8px'
            linha.style.borderTopRightRadius = '8px'
        }

    })

    // Totais;
    document.querySelectorAll('.total-linha').forEach(el => {
        el.style.display = 'flex'
        el.style.backgroundColor = '#ffea81'
    })
}

async function removerItemOrcamento(chave) {

    overlayAguarde()
    const [codigoMaster, codigoSlave] = chave.includes('_')
        ? chave.split('_')
        : [chave, null]

    const orcamento = baseOrcamento()

    if (codigoSlave) {
        delete orcamento.esquema_composicoes[codigoMaster].agrupamento[codigoSlave]

    } else {
        delete orcamento.esquema_composicoes[codigoMaster]

    }

    baseOrcamento(orcamento)
    controles.criarOrcamento.base = Object.values(orcamento.esquema_composicoes)
    await paginacao('criarOrcamento')
    removerOverlay()
}

function gerarDadosComposicoes(esquema = {}) {
    const acc = {}

    const adicionar = (codigo, item = {}) => {
        const qtde = Number(item.qtde) || 0
        const custo = Number(item.custo) || 0

        if (!acc[codigo]) {
            acc[codigo] = {
                ...item,
                codigo,
                qtde: 0,
                _somaCusto: 0,
                _countCusto: 0
            }
        } else {
            for (const [chave, valor] of Object.entries(item)) {
                if (
                    chave !== 'qtde' &&
                    chave !== 'custo' &&
                    chave !== 'agrupamento' &&
                    (acc[codigo][chave] === undefined || acc[codigo][chave] === null || acc[codigo][chave] === '')
                ) {
                    acc[codigo][chave] = valor
                }
            }
        }

        acc[codigo].qtde += qtde
        acc[codigo]._somaCusto += custo
        acc[codigo]._countCusto++
    }

    for (const [codigoMaster, comp] of Object.entries(esquema || {})) {
        adicionar(codigoMaster, comp)

        for (const [codigoSlave, item] of Object.entries(comp.agrupamento || {})) {
            adicionar(codigoSlave, item)
        }
    }

    return Object.fromEntries(
        Object.entries(acc).map(([codigo, item]) => {
            const { _somaCusto, _countCusto, agrupamento, ...resto } = item

            return [
                codigo,
                {
                    ...resto,
                    codigo,
                    custo: _countCusto ? _somaCusto / _countCusto : 0
                }
            ]
        })
    )
}

async function enviarDadosOrcamento() {

    overlayAguarde()

    const orcamentoBase = baseOrcamento()

    // Unificador para dados_composições;
    orcamentoBase.dados_composicoes = gerarDadosComposicoes(orcamentoBase.esquema_composicoes || {})

    // Salvar o usuário na primeira vez apenas;
    if (!orcamentoBase.usuario)
        orcamentoBase.usuario = acesso.usuario

    if (!orcamentoBase.dados_orcam)
        return painelClientes()

    const dados_orcam = orcamentoBase.dados_orcam

    if (dados_orcam.omie_cliente == '')
        return popup({ mensagem: 'Cliente em branco' })

    if (dados_orcam.contrato == '')
        dados_orcam.contrato = 'sequencial'

    // Se totais diferentes: aprovação será necessária;
    orcamentoBase.aprovacao = orcamentoBase.total_bruto !== orcamentoBase.total_geral
        ? { status: 'pendente', usuario: acesso.usuario }
        : null

    if (!orcamentoBase.id)
        orcamentoBase.id = `ORCA_${crypto.randomUUID()}`

    const { success, contrato } = await enviar(`dados_orcamentos/${orcamentoBase.id}`, orcamentoBase) || {}

    if (success) {

        // Caso seja um orçamento vinculado ou troca de Ocorrência para ORC;
        if (orcamentoBase.origem) {

            let { idOrcamento, idOcorrencia } = orcamentoBase.origem || {}

            // Se existir idOrcamento, então é vinculado;
            if (idOrcamento) {
                const dados = {
                    data: new Date().toLocaleString(),
                    usuario: acesso.usuario
                }

                // Salvando o orçamento vinculado no master;
                await enviar(`dados_orcamentos/${idOrcamento}/vinculados/${orcamentoBase.id}`, dados)
            }

            // Criação da correção;
            const agora = new Date()
            const correcao = {
                data: agora.toLocaleString(),
                datas: {},
                descricao: `Orçamento criado ${contrato || ''}`,
                dtCorrecao: new Date().toISOString().slice(0, 10),
                equipamentos: {},
                executor: dados_orcam?.executor,
                tipoCorrecao: 'WiGZl',
                idOrcamento: orcamentoBase.id,
                usuario: acesso.usuario
            }

            // Salvamento da ocorrência, observar bifurcação (ORC ou G);
            // Se ORC, então este orçamento é vinculado;

            if (!idOcorrencia.includes('ORC')) {
                // Se G ou qualquer outro, então é substitutivo para ORC;
                await desvincularOcorrencia(idOcorrencia, contrato)
                idOcorrencia = contrato
            }

            // Salvar uma correção obrigatoriamente;
            await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${orcamentoBase.id}`, correcao)

            await telaOcorrencias()

            removerOverlay()

            return

        }

        popup({ tempo: 4, mensagem: 'Aguarde... redirecionando...', imagem: 'imagens/concluido.png' })

        // Limpeza do orçamento em edição;
        baseOrcamento(undefined, true)
        await telaOrcamentos()

        removerPopup()

        // GCS no título
        atualizarToolbar(true)

    } else {

        popup({ mensagem: 'Falha no salvamento, tente de novo em alguns minutos' })

    }

}

async function desvincularOcorrencia(id, contrato) {
    try {
        const resposta = await fetch(`${api}/desvincular-ocorrencia`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id,
                contrato,
                usuario: acesso.usuario
            })
        })

        const dados = await resposta.json()

        if (!resposta.ok || !dados.success)
            return popup({ mensagem: dados.mensagem || 'Erro na requisição' })

        return

    } catch (err) {
        popup({ mensagem: err.message || 'Erro de conexão com o servidor' })
    }
}

async function ativarChave(input, idOrcamento, chave) {

    // Tela de criação de orçamento, não precisa continuar, o salvar irá coletar a informação;
    if (!idOrcamento)
        return

    const ativo = input.checked
        ? 'S'
        : 'N'

    overlayAguarde()
    const resposta = await enviar(`dados_orcamentos/${idOrcamento}/${chave}`, ativo)
    if (resposta.mensagem) {
        input.checked = !ativo
        return popup({ mensagem: resposta.mensagem })
    }

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    orcamento[chave] = ativo

    const pHistorico = document.querySelector('.painel-historico')
    if (pHistorico)
        await abrirEsquema(idOrcamento)

    removerOverlay()

    await carregarToolbar()

}

function formatarTabela() {

    const tipo = controles?.composicoes_orcamento?.filtros?.tipo?.value || ''

    const menuPaginacao = document.getElementById('paginacao_composicoes_orcamento')

    const topoTabela = menuPaginacao.closest('.topo-tabela')

    topoTabela.style.backgroundColor = coresTabelas(tipo)

}

async function tabelaProdutosOrcamentos() {

    const toolbar = ['TODOS', ...esquemas.tipo]
        .map(op => {

            return `<label 
            class="menu-top" 
            style="background-color: ${coresTabelas(op)};" 
            onclick="filtrarPorComposicoes({path: 'tipo', value: '${op}'})">
                ${op}
            </label>`
        })
        .join('')

    const lpu = (document.getElementById('lpu').value).toLowerCase()

    const btnExtras = `
        <div class="tag-zerado">
            <input 
                checked="true" 
                onchange="filtrarPorComposicoes({path: 'snapshots.${lpu}', op: this.checked ? 'NOT_ZERO' : '' })" type="checkbox" style="width: 1.5rem; height: 1.5rem;">
            <span>Remover R$ 0,00</span>
        </div>`

    const colunas = {
        'Código': { chave: 'codigo' },
        'Descrição': { chave: 'descricao' },
        'Modelo': { chave: 'modelo' },
        'Unidade': { chave: 'unidade' },
        'Quantidade': {},
        'Valor': { chave: `snapshots.${lpu}` },
        'Imagem': {}
    }

    const pag = 'composicoes_orcamento'
    const tabela = await modTab({
        pag,
        colunas,
        funcaoAdicional: ['formatarTabela', 'totalOrcamento'],
        btnExtras,
        filtros: {
            [`snapshots.${lpu}`]: { op: 'NOT_ZERO' }
        },
        criarLinha: 'linhasComposicoesOrcamento',
        base: 'dados_composicoes',
        body: 'bodyComposicoesOrcamento'
    })

    const criarItem = `
        <div onclick="cadastrarItem()" style="${horizontal}; cursor: pointer; gap: 5px; color: white;">
            <img src="imagens/baixar.png">
            <span>Criar Item</span>
        </div>`

    const acumulado = `
        <div style="position: relative; display: flex; justify-content: center; width: 100%; margin-top: 30px; gap: 10px;">
            ${toolbar}
            ${permComposicoes.includes(acesso.permissao) ? criarItem : ''}
        </div>

        ${tabela}
        `

    document.getElementById('tabelaItens').innerHTML = acumulado

    await paginacao(pag)

}

async function filtrarPorComposicoes({ path, op = '=', value }) {

    controles.composicoes_orcamento.filtros ??= {}

    controles.composicoes_orcamento.filtros = {
        ...controles.composicoes_orcamento.filtros,
        [path]: { op: '=', op, value }
    }

    // Caso seja GERAL
    if (value == 'TODOS')
        delete controles.composicoes_orcamento.filtros[path]

    await paginacao('composicoes_orcamento')

}

function linhasComposicoesOrcamento(produto) {

    const { codigo } = produto

    const lpu = String(document.getElementById('lpu').value).toLocaleLowerCase()

    const agrupamentoON = Object.keys(produto?.agrupamento || {}).length > 0
        ? 'pos'
        : 'neg'

    const ativo = produto?.[lpu]?.ativo || ''
    const historico = produto?.[lpu]?.historico || {}
    const detalhes = historico?.[ativo] || {}
    const preco = detalhes?.valor || 0

    const sinalizacao = verificarData(detalhes?.data, codigo)
    const fabricante = produto?.fabricante
        ? `<b>Fabricante</b> ${produto?.fabricante || '--'}<br>`
        : ''

    const tds = `
        <td>
            <div class="campo-codigo-composicao">
                <span>${codigo}</span>
                <div class="composicao">
                    <img src="imagens/elo_${agrupamentoON}.png" onclick="verAgrupamento('${codigo}')">
                    ${moduloComposicoes ? `<img src="imagens/editar.png" onclick="cadastrarItem('${codigo}')">` : ''}
                </div>
            </div>
        </td>
        <td>
            <div style="${vertical}; text-align: left;">
                <b>Descrição</b>
                ${produto?.descricao || ''}<br>
                ${fabricante}
            </div>
        </td>
        <td>
            ${produto?.modelo || ''}
        </td>
        <td>${produto?.unidade || ''}</td>
        <td>
            <input id="prod_${codigo}" type="number" class="campo-valor" oninput="incluirItem('${codigo}', this.value)">
        </td>
        <td>
            <div style="${horizontal}; gap: 1px;">
                ${sinalizacao}
                <label class="campo-valor" style="width: max-content; background-color: ${preco > 0 ? '#4CAF50bf' : '#b36060bf'}">
                    ${dinheiro(preco)}
                </label>
            </div>
        </td>
        <td>
            <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 4rem;">
        </td>
        `

    return `<tr>${tds}</tr>`

}

function verificarData(data, codigo) {

    const lpu = String(document.getElementById('lpu').value).toLocaleLowerCase()
    if (!data) {
        return `<img onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" src="imagens/preco_neg.png">`
    }

    const [dt] = String(data).split(', ')
    const [dia, mes, ano] = (dt || '').split('/').map(Number)
    const dataRef = new Date(ano, mes - 1, dia)

    if (isNaN(dataRef)) {
        return `<img onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" src="imagens/preco_neg.png">`
    }

    const hoje = new Date()
    const diffDias = Math.floor((hoje - dataRef) / (1000 * 60 * 60 * 24))
    const imagem = diffDias > 30 ? 'preco_neg' : 'preco'

    return `<img onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" src="imagens/${imagem}.png">`
}

async function alterarValorUnitario(chave, campo) {

    overlayAguarde()
    const [codigoMaster, codigoSlave] = chave.includes('_')
        ? chave.split('_')
        : [chave, null]

    const produto = await recuperarDado('dados_composicoes', codigoSlave || codigoMaster) || {}
    const lpu = String(document.getElementById('lpu').value).toLowerCase()
    const ativo = produto?.[lpu]?.ativo || 0
    const historico = produto?.[lpu]?.historico || {}
    const precoOriginal = historico?.[ativo]?.valor || 0
    const { esquema_composicoes } = baseOrcamento()
    const qtde = codigoSlave
        ? esquema_composicoes[codigoMaster].agrupamento[codigoSlave].qtde
        : esquema_composicoes[codigoMaster].qtde

    const totalOriginal = campo == 'total'
        ? precoOriginal * qtde
        : precoOriginal

    const linhas = [
        {
            texto: 'Descrição',
            elemento: `<span>${produto.descricao}</span>`
        },
        {
            texto: 'Preço Original',
            elemento: `<label>${dinheiro(totalOriginal)}</label>`
        },
        {
            texto: 'Novo Valor',
            elemento: `<input class="campo-valor" id="novoValor" type="number">`
        }
    ]

    controles.criarOrcamento.alteracaoPreco = {
        qtde,
        campo,
        chave,
        precoOriginal
    }

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'confirmarNovoPreco()' }
    ]

    popup({ linhas, botoes, titulo: 'Ajuste de preço' })

}

async function confirmarNovoPreco() {

    overlayAguarde()

    const { chave, precoOriginal, campo, qtde } = controles.criarOrcamento.alteracaoPreco

    // verificar se é master ou slave;
    const [codigoMaster, codigoSlave] = chave.includes('_')
        ? chave.split('_')
        : [chave, null]

    const orcamento = baseOrcamento()
    let item = codigoSlave
        ? orcamento.esquema_composicoes[codigoMaster].agrupamento[codigoSlave]
        : orcamento.esquema_composicoes[codigoMaster]

    const valor = Number(document.getElementById('novoValor').value)

    item.custo_original = precoOriginal

    item.custo = campo == 'unitario'
        ? valor
        : valor / qtde

    // Verificação da alteração de valor;
    if (item.custo == precoOriginal) {

        delete item.custo_original

    }

    controles.criarOrcamento.base = Object.values(orcamento.esquema_composicoes)
    baseOrcamento(orcamento)
    await paginacao('criarOrcamento')
    removerPopup()

}


async function incluirItem(codigo, novaQuantidade) {

    overlayAguarde()

    const orcamentoBase = baseOrcamento()
    const dadosMaster = await recuperarDado('dados_composicoes', codigo) || {}
    const { agrupamento, descricao, tipo, unidade, imagem, snapshots } = dadosMaster
    const custo = snapshots?.[lpuATIVA]?.[0] || 0

    // Ordem
    const ordem = (orcamentoBase?.ordem || 0) + 1
    orcamentoBase.ordem = ordem

    orcamentoBase.esquema_composicoes ??= {}
    orcamentoBase.esquema_composicoes[codigo] ??= {}

    // garante o objeto de agrupamento;
    orcamentoBase.esquema_composicoes[codigo].agrupamento = {}

    // Slaves
    for (const [cod, dados] of Object.entries(agrupamento || {})) {

        const dadosSlave = await recuperarDado('dados_composicoes', cod) || {}
        const { descricao, unidade, tipo, imagem, snapshots } = dadosSlave
        const custo = snapshots?.[lpuATIVA]?.[0] || 0

        orcamentoBase.esquema_composicoes[codigo].agrupamento[cod] = {
            codigo: cod,
            qtde: dados.qtde * novaQuantidade,
            descricao,
            unidade,
            custo,
            tipo,
            imagem
        }
    }

    // Item principal;
    orcamentoBase.esquema_composicoes[codigo] = {
        ...orcamentoBase.esquema_composicoes[codigo],
        codigo,
        descricao,
        custo,
        tipo,
        imagem,
        unidade,
        qtde: novaQuantidade,
        ordem
    }

    baseOrcamento(orcamentoBase)
    controles.criarOrcamento.base = Object.values(orcamentoBase.esquema_composicoes)
    await paginacao('criarOrcamento')

    removerOverlay()

}
