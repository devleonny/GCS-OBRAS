let lpuATIVA = null
let observadorResumoOrcamento = null

function acompanharCabecalhoOrcamento() {
    observadorResumoOrcamento?.disconnect()
    const resumo = document.getElementById('orcamento-resumo-fixo')
    const cabecalho = document.querySelector('#orcamento_padrao .menu-superior')
    if (!resumo || !cabecalho) return
    observadorResumoOrcamento = new IntersectionObserver(([entrada]) => {
        resumo.hidden = entrada.boundingClientRect.bottom > (entrada.rootBounds?.top || 0)
    }, { root: cabecalho.closest('.tela'), threshold: [0, 1] })
    observadorResumoOrcamento.observe(cabecalho)
}

// Item avulso (ex.: "1-AVULSO"): criado fora do catálogo, com preço próprio. O código não é uma
// composição de verdade, então nada aqui busca preço ou histórico dele em dados_composicoes.
const ehItemAvulso = item => item?.avulso === true || /AVULSO/i.test(String(item?.codigo ?? ''))

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

    if (!LPUS) {
        const { lpus } = await recuperarDado('mvw_lpus', 1) || {}
        LPUS = lpus
    }

    modo = ''

    const modelo = (texto, img) => `
        <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/${img}.png" style="width: 1.7rem;">
            <span>${texto}</span>
        </div>
    `

    const acumulado = `
    <div class="contorno-tela-criar-orcamento">

        <div id="orcamento_padrao" style="width: 100%;">

            <div id="orcamento-resumo-fixo" class="orcamento-resumo-fixo" hidden>
                <div class="orcamento-resumo-valor">
                    <span>Total geral do orçamento</span>
                    <strong id="orcamento-total-fixo">${dinheiro(baseOrcamento()?.total_geral || 0)}</strong>
                </div>
                <div id="orcamento-diferenca-fixa" class="orcamento-resumo-valor orcamento-resumo-diferenca" hidden></div>
                <button type="button" class="orcamento-botao-subir" onclick="document.querySelector('#orcamento_padrao .menu-superior')?.scrollIntoView({ behavior: 'smooth', block: 'start' })">↑ Subir</button>
            </div>
            <div class="menu-superior">

                <div class="orcamento-atalho-composicoes">
                    <button type="button" onclick="document.getElementById('tabelaItens')?.scrollIntoView({ behavior: 'smooth', block: 'start' })">Ir para Composições ↓</button>
                </div>

                <div style="${vertical}">

                    <label style="font-size: 0.9rem;">TOTAL GERAL</label>
                    <div style="font-size: 1.4rem;" id="total_geral"></div>
                    
                    <div style="${horizontal}; gap: 1rem;">
                        <img src="imagens/alerta.png">
                        <span>Alterar a tabela removerá seus <b>descontos/acréscimos</b></span>
                    </div>

                    <div style="${horizontal}; gap: 1rem;">
                        <label style="font-size: 1em;">Tabela de preço</label>
                        <select id="lpu" onchange="alterarTabelaLPU(this.value)">
                        </select>
                    </div>

                </div>

                <div class="resumo">
                    <label>RESUMO</label>
                    <hr>
                    <label><b>Total Bruto</b></label>
                    <div id="total-bruto"></div>
                    <label><b>Diferença</b></label>
                    <div id="diferenca-rs"></div>
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

    acompanharCabecalhoOrcamento()
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

    try {
        await atualizarOpcoesLPU()
        await carregarTabelasOrcamento(resposta)
    } finally {
        removerOverlay()
    }

    // O catálogo carrega depois, sem bloquear a edição do orçamento já exibido.
    await tabelaProdutosOrcamentos()

}

async function atualizarToolbar() {

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

            <img src="imagens/avanco.png" style="width: 1.5rem;">
            
            <div style="${horizontal}; gap: 5px; cursor: pointer;" onclick="clonarOrcamento()">
                <img src="gifs/copiar.gif">
                <span>Clonar Orçamento</span>
            </div>

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

function campoComposicoesRevisao(orcamento) {
    return orcamento.lpu_ativa === 'ALUGUEL' ? 'dados_composicoes' : 'esquema_composicoes'
}

function sincronizarRevisaoAtual(orcamento) {
    const atual = orcamento?.revisoes?.atual
    if (atual && Object.hasOwn(orcamento.revisoes.historico || {}, atual))
        orcamento.revisoes.historico[atual] = structuredClone(orcamento[campoComposicoesRevisao(orcamento)] || {})
}

async function atualizarTabelaRevisao() {
    const orcamento = baseOrcamento()
    if (orcamento.lpu_ativa === 'ALUGUEL') {
        document.getElementById('tabelas').innerHTML = ''
        await carregarTabelasAluguel()
    } else {
        controles.criarOrcamento.base = Object.values(orcamento.esquema_composicoes || {})
        await paginacao('criarOrcamento')
        calcularSubtotais()
    }
    await atualizarToolbar()
}

async function confirmarExclusaoRevisao() {
    const revisao = document.querySelector('[name="revisao"]').value
    const orcamento = baseOrcamento()
    orcamento.revisoes ??= {}

    if (!orcamento?.revisoes?.historico?.[revisao])
        return

    delete orcamento.revisoes.historico[revisao]
    const chavesRevisoes = Object.keys(orcamento?.revisoes?.historico || {})
    const RX = chavesRevisoes[0]
    if (RX) {
        orcamento[campoComposicoesRevisao(orcamento)] = structuredClone(orcamento.revisoes.historico[RX])
        orcamento.revisoes.atual = RX
    } else {
        delete orcamento.revisoes.atual
    }

    baseOrcamento(orcamento)

    removerPopup()
    await atualizarTabelaRevisao()
}


async function alterarRevisao() {
    const revisao = document.querySelector('[name="revisao"]').value

    const orcamento = baseOrcamento()
    if (!Object.hasOwn(orcamento.revisoes?.historico || {}, revisao)) return
    sincronizarRevisaoAtual(orcamento)
    orcamento[campoComposicoesRevisao(orcamento)] = structuredClone(orcamento.revisoes.historico[revisao])
    orcamento.revisoes.atual = revisao

    baseOrcamento(orcamento)

    await atualizarTabelaRevisao()

}

async function salvarRevisao() {
    const orcamento = baseOrcamento()

    orcamento.revisoes ??= {}
    orcamento.revisoes.historico ??= {}
    sincronizarRevisaoAtual(orcamento)

    const numeros = Object.keys(orcamento.revisoes.historico)
        .filter(r => /^R\d+$/.test(r))
        .map(r => Number(r.slice(1)))

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

function clonarOrcamento() {

    try {

        controlesCxOpcoes.orcamento = {
            base: 'dados_orcamentos',
            retornar: ['dados_orcam.contrato'],
            colunas: {
                'Número do Orçamento': { chave: 'dados_orcam.contrato' },
                'Valor': { chave: 'snapshots.valor.1' },
                'Cidade': { chave: 'snapshots.cidade' },
                'Cliente': { chave: 'snapshots.cliente' }
            }
        }

        const linhas = [
            {
                texto: 'Escolha o orçamento',
                elemento: `<span class="opcoes" name="orcamento" onclick="cxOpcoes('orcamento')">Selecione</span>`
            }
        ]

        const botoes = [
            {
                texto: 'Clonar',
                img: 'gifs/copiar.gif',
                funcao: 'confirmarClonagem()'
            }
        ]

        popup({
            linhas,
            botoes
        })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falhou: Fale com o suporte.' })
    }

}

async function confirmarClonagem() {

    try {

        const idOrcamento = document.querySelector('[name="orcamento"]')?.id

        if (!idOrcamento)
            return popup({ mensagem: 'Escolha um orçamento' })

        const oClone = await recuperarDado('dados_orcamentos', idOrcamento) || {}

        const { dados_composicoes, esquema_composicoes } = oClone

        const orcamento = {
            ...baseOrcamento(),
            dados_composicoes,
            esquema_composicoes
        }

        baseOrcamento(orcamento)

        removerTodosPopups()

        await telaCriarOrcamento()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao clonar o orçamento: Fale com o suporte.' })
    }

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

    //await pesquisarRequisicoes()

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

    let itensOrcamento = Object.values(orcamentoBase?.esquema_composicoes || orcamentoBase.dados_composicoes || {})
    if (resposta === 'N' && itensOrcamento.length) {
        const dados = await pesquisarDB({ base: itensOrcamento, limite: itensOrcamento.length, pagina: 1, filtros: {}, substituicoes: substituicoes(lpuATIVA) })
        if (!Array.isArray(dados?.resultados) || dados.resultados.length !== itensOrcamento.length)
            throw new Error('Falha ao atualizar os precos do orcamento.')

        // Avulsos mantêm o preço do orçamento: se houver no catálogo uma composição com o
        // mesmo código (ex.: "1-AVULSO"), o preço dela não pode substituir o do item.
        const originais = new Map(itensOrcamento.map(item => [String(item.codigo), item]))
        itensOrcamento = dados.resultados.map(item => {
            const original = originais.get(String(item.codigo))
            if (!original) return item

            if (ehItemAvulso(original)) return original
            if (!item.agrupamento) return item

            const agrupamento = Object.fromEntries(Object.entries(item.agrupamento || {})
                .map(([codigo, filho]) => [codigo, ehItemAvulso(filho) ? original.agrupamento?.[codigo] || filho : filho]))
            return { ...item, agrupamento }
        })
    }
    const pag = 'criarOrcamento'
    const tabelaOrcamento = await modTab({
        base: itensOrcamento,
        consultarDados: pesquisarItensOrcamentoLocal,
        pag,
        limite: 9999,
        filtros: {},
        priBase: resposta,
        substituicoes: [],
        scroll: false,
        nude: true,
        editavel: true,
        funcaoAdicional: ['totalOrcamento'],
        body: 'bodyOrcamento',
        criarLinha: 'carregarLinhaOrcamento'
    })

    document.getElementById('tabelas').innerHTML = `
        
        <div style="display: flex; align-items: center; justify-content: center; margin-left: 1rem; gap: 1rem;">

            <div class="pesquisa-orcamento">
                <input oninput="pesquisarEmOrcamentos({path: 'codigo', op: 'includes', value: this.value})" placeholder="Código">
                <img src="imagens/pesquisar4.png" style="width: 1.5rem; padding: 0.5rem;"> 
            </div>
            <div class="pesquisa-orcamento">
                <input oninput="pesquisarEmOrcamentos({path: 'descricao', op: 'includes', value: this.value})" placeholder="Descrição">
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
    const { requisicoesExistentes } = controles?.criarOrcamento || {}

    if (produto._chaveOrcamento) {
        return `<tr><td style="padding: 0;"><div class="orcamento-item-plano">
            ${produto._cabecalhoPlano ? '<div class="orcamento-colunas"><label>Código</label><label>Descrição / Origem</label><label>Unidade</label><label>Quantidade</label><label>Valor unitário</label><label>Total</label><label>Ajuste</label><label>Imagem</label><label></label></div>' : ''}
            <div class="linha-orcamento" data-hierarquia="${produto._grupoOrigem ? 'slave' : 'master'}">${criarLinha(produto)}</div>
        </div></td></tr>`
    }

    const linhaSlave = Object.values(agrupamento || {})
        .map(produto => {

            return `
                <div data-hierarquia="slave" data-codigo="${produto.codigo}" class="linha-orcamento" id="${codigoMaster}_${produto.codigo}">
                    ${criarLinha(produto)}
                </div>
            `
        })
        .join('')

    const celulasMaster = produto.principal_removido ? '' : criarLinha(produto)

    const linha = `
        <tr>
            <td style="padding: 0px;">
                <div id="ORCA_${codigoMaster}" class="orcamento-item-bloco" style="${vertical};">
                    <div class="orcamento-item-cabecalho">
                        <div><strong>${produto.principal_removido ? 'Grupo' : 'Item'} ${escaparAtributo(codigoMaster)}</strong>
                        ${produto.principal_removido ? `<span class="orcamento-grupo-simbolico">Principal removido · componentes mantidos</span><span>${escaparAtributo(produto.descricao || '')}</span>` : ''}</div>
                        ${produto.principal_removido && editavel ? `<button type="button" class="orcamento-restaurar" data-codigo="${escaparAtributo(codigoMaster)}" onclick="restaurarPrincipalOrcamento(this.dataset.codigo)">Restaurar principal</button>` : ''}
                        <label>${linhaSlave ? `Composição · ${Object.keys(agrupamento || {}).length} componentes` : 'Item individual'}</label>
                    </div>
                    <div class="orcamento-colunas"><label>Código</label><label>Descrição</label><label>Unidade</label><label>Quantidade</label><label>Valor unitário</label><label>Total</label><label>Ajuste</label><label>Imagem</label><label></label></div>
                    ${produto.principal_removido ? '' : `<div data-hierarquia="master" class="linha-orcamento" data-codigo="${codigoMaster}">${celulasMaster}</div>`}
                    <div class="linha-bloco">${linhaSlave}</div>
                    <div class="total-linha">
                        <label>Subtotal do item</label>
                        <span name="totalBloco"></span>
                    </div>
                </div>
            </td>
        </tr>
    `
    return linha

    function criarLinha(produto) {

        const {
            codigo,
            tipo,
            qtde,
            cnpj,
            custo,
            razaoSocial,
            custo_original,
            descricao,
            unidade,
            imagem
        } = produto || {}
        const total = custo * qtde
        const chave = produto._chaveOrcamento || (codigoMaster !== codigo
            ? `${codigoMaster}_${codigo}`
            : codigo)

        const qtdeReq = requisicoesExistentes?.[codigo]
        const bloqReq = qtdeReq && qtde >= qtdeReq

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
                ${produto._grupoOrigem ? `<small class="orcamento-origem">Componente do grupo ${escaparAtributo(produto._grupoOrigem)}</small>` : ''}
                <b><span name="tipo" style="font-size: 0.7rem">${tipo}</span></b>
                <div name="descVD" style="${horizontal}; display: none; gap: 2px;">
                    <textarea placeholder="CNPJ" oninput="totalOrcamento()" name="cnpj">${cnpj || ''}</textarea>
                    <textarea placeholder="RAZÃO SOCIAL" oninput="totalOrcamento()" name="razaoSocial">${razaoSocial || ''}</textarea>
                </div>
                <div name="master"></div>
            </div>

            <div name="medida">${unidade || 'UN'}</div>

            <div>
                <input name="quantidade" ${bloqReq ? 'readOnly' : ''} oninput="atualizarQtde('${chave}', this)" type="number" value="${qtde}" ${editavel ? '' : 'readOnly'}>
            </div>

            <div style="${horizontal}; justify-content: start; gap: 1rem;">
                ${editavel ? `<img onclick="alterarValorUnitario('${chave}', 'unitario')" src="imagens/ajustar.png" style="width: 1.5rem;">` : ''}
                ${ehItemAvulso(produto)
                ? `<span name="unitario" class="valor-orcamento" title="Item avulso: preço próprio do orçamento, sem histórico no catálogo">${dinheiro(custo || '')}</span>`
                : `<span name="unitario" onclick="abrirHistoricoPrecos('${codigo}', '${lpuATIVA}')" class="valor-orcamento">${dinheiro(custo || '')}</span>`}
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
                    onclick="abrirImagem('${codigo}')" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo" src="${imagem || logo}">
            </div>
            
            <div>
                ${editavel
                ? `<img src="imagens/fechar.png" 
                    onclick="removerItemOrcamento('${chave}')" 
                    style="display: ${bloqReq ? 'none' : 'block'}; width: 1.5rem;">`
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

function sincronizarQuantidadesCatalogo() {
    const esquema = baseOrcamento()?.esquema_composicoes || {}
    document.querySelectorAll('#tabelaItens input[id^="prod_"]').forEach(input => {
        // Preserva a digitação em andamento enquanto a consulta de inclusão termina.
        if (input === document.activeElement) return
        const item = esquema[input.id.slice(5)]
        input.value = item && !item.principal_removido ? item.qtde ?? '' : ''
    })
}

async function totalOrcamento() {

    atualizarToolbar()

    if (!controles.criarOrcamento)
        return

    formatarLinhasOrcamento()
    calcularSubtotais()
    sincronizarQuantidadesCatalogo()

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
        if (!item.principal_removido) {
        totais.BRUTO += ((custo_original || custo) * qtde)

        const total = custo * qtde
        totais[tipo] ??= 0
        totais[tipo] += total
        totais.GERAL += total
        }

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
    document.querySelectorAll('.orcamento-item-plano .linha-orcamento').forEach(linha => {
        const valor = conversor(linha.querySelector('[name="unitario"]').textContent)
        const quantidade = Number(linha.querySelector('[name="quantidade"]').value)
        linha.querySelector('[name="total"]').innerHTML = dinheiro(valor * quantidade)
    })
    const blocos = [...document.querySelectorAll('div[id^="ORCA_"]')]
    blocos.forEach(bloco => {
        const linhas = [...bloco.querySelectorAll('.linha-orcamento')]

        let totalBloco = 0

        linhas.forEach(linha => {
            const valor = conversor(linha.querySelector('[name="unitario"]').textContent)
            const qtde = Number(linha.querySelector('[name="quantidade"]').value)
            const total = valor * qtde
            totalBloco += total

            linha.querySelector('[name="total"]').innerHTML = dinheiro(total)
        })

        const totalBlocoDiv = bloco.querySelector('.total-linha')
        if (totalBlocoDiv)
            totalBlocoDiv.querySelector('span').innerHTML = dinheiro(totalBloco)
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

    document.getElementById('total-bruto').innerHTML = dinheiro(totais.BRUTO)
    document.getElementById('diferenca-rs').innerHTML = !sinal
        ? 'Sem diferença'
        : `
        <div style="${horizontal}; gap: 5px;">
            <img src="imagens/${sinal}.png">
            <span>${dinheiro(dif)} (${((dif / totais.BRUTO) * 100).toFixed(1)} %)</span>
        </div>
    `
    document.getElementById('total_geral').innerHTML = dinheiro(totais.GERAL)
    const totalFixo = document.getElementById('orcamento-total-fixo')
    if (totalFixo) totalFixo.innerHTML = dinheiro(totais.GERAL)
    const diferencaFixa = document.getElementById('orcamento-diferenca-fixa')
    if (diferencaFixa) {
        const diferencaCentavos = Math.round(dif * 100)
        const percentual = totais.BRUTO > 0
            ? `${(Math.abs(dif) / totais.BRUTO * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
            : null
        diferencaFixa.hidden = diferencaCentavos === 0
        diferencaFixa.innerHTML = diferencaCentavos === 0 ? '' : `
            <span>${diferencaCentavos > 0 ? 'Acréscimo' : 'Desconto'}${percentual ? ` (${percentual})` : ''}</span>
            <strong>${dinheiro(Math.abs(diferencaCentavos) / 100)}</strong>`
    }

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
    baseOrcamento(orcamento)

}

function pesquisarItensOrcamentoLocal({ base = [], filtros = {}, ordenar, pagina = 1, limite = 9999 }) {
    const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    const campo = (item, path) => path.split('.').reduce((valor, chave) => valor?.[chave], item)
    const corresponde = item => Object.entries(filtros).every(([path, filtro]) => {
        const esperado = normalizar(filtro.original ?? filtro.value)
        const atual = normalizar(campo(item, path))
        if (filtro.op === 'includes') return atual.includes(esperado)
        if (filtro.op === '!=') return atual !== esperado
        return atual === esperado
    })
    const exibirPlano = ['tipo', 'codigo', 'descricao'].some(path =>
        String(filtros[path]?.original ?? filtros[path]?.value ?? '').trim() !== '')
    const candidatos = exibirPlano ? base.flatMap(item => {
        const linhas = []
        if (!item.principal_removido)
            linhas.push({ ...item, id: `principal:${item.codigo}`, _chaveOrcamento: String(item.codigo) })
        for (const [codigo, filho] of Object.entries(item.agrupamento || {}))
            linhas.push({ ...filho, id: `componente:${item.codigo}:${codigo}`,
                _chaveOrcamento: `${item.codigo}_${codigo}`, _grupoOrigem: String(item.codigo) })
        return linhas
    }) : base
    const resultados = candidatos.filter(item => corresponde(item) || (!exibirPlano && Object.values(item.agrupamento || {}).some(corresponde)))
    if (ordenar?.path) resultados.sort((a, b) => normalizar(campo(a, ordenar.path)).localeCompare(normalizar(campo(b, ordenar.path)), 'pt-BR', { numeric: true }) * (ordenar.direcao === 'desc' ? -1 : 1))
    const visiveis = resultados.slice((pagina - 1) * limite, pagina * limite)
    if (exibirPlano && visiveis.length) visiveis[0]._cabecalhoPlano = true
    return { resultados: visiveis, total: resultados.length, paginas: Math.max(1, Math.ceil(resultados.length / limite)) }
}

async function pesquisarEmOrcamentos({ path, op = '=', value }) {
    controles.criarOrcamento.pagina = 1

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
    topoTabela.style.background = coresTabelas(filtro)

    // Quando não tiver pesquisa ou filtragem por tipo;
    document.querySelectorAll('#bodyOrcamento .linha-orcamento').forEach(linha => {
        const hierarquia = linha.dataset.hierarquia

        linha.style.backgroundColor = hierarquia === 'master'
            ? 'white'
            : '#fff8d3'

        linha.style.borderRadius = '0px'

        if (hierarquia === 'master' && !linha.closest('.orcamento-item-plano')) {
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
    try {
        const [codigoMaster, codigoSlave] = chave.includes('_') ? chave.split('_') : [chave, null]
        const orcamento = baseOrcamento()
        const principal = orcamento.esquema_composicoes?.[codigoMaster]
        if (!principal) return
        if (codigoSlave) {
            delete principal.agrupamento[codigoSlave]
            if (principal.principal_removido && !Object.keys(principal.agrupamento).length)
                delete orcamento.esquema_composicoes[codigoMaster]
        } else if (Object.keys(principal.agrupamento || {}).length) {
            principal.principal_removido = true
        } else {
            delete orcamento.esquema_composicoes[codigoMaster]
        }
        baseOrcamento(orcamento)
        controles.criarOrcamento.base = Object.values(orcamento.esquema_composicoes)
        await paginacao('criarOrcamento')
    } finally { removerOverlay() }
}

async function restaurarPrincipalOrcamento(codigo, mostrarOverlay = true) {
    const orcamento = baseOrcamento()
    const principal = orcamento.esquema_composicoes?.[codigo]
    if (!principal?.principal_removido) return
    delete principal.principal_removido
    baseOrcamento(orcamento)
    controles.criarOrcamento.base = Object.values(orcamento.esquema_composicoes)
    if (mostrarOverlay) overlayAguarde()
    try { await paginacao('criarOrcamento') }
    finally { if (mostrarOverlay) removerOverlay() }
}

function gerarDadosComposicoes(esquema = {}) {
    const acc = {}

    const adicionar = (codigo, item = {}) => {
        const qtde = Number(item.qtde) || 0
        const custo = Number(item.custo) || 0
        const custoOriginal = Number(item.custo_original || custo) || 0

        if (!acc[codigo]) {
            acc[codigo] = {
                ...item,
                codigo,
                qtde: 0,
                _somaCusto: 0,
                _somaCustoOriginal: 0,
                _temCustoOriginal: false
            }
        } else {
            for (const [chave, valor] of Object.entries(item)) {
                if (
                    chave !== 'qtde' &&
                    chave !== 'custo' &&
                    chave !== 'custo_original' &&
                    chave !== 'agrupamento' &&
                    (acc[codigo][chave] === undefined || acc[codigo][chave] === null || acc[codigo][chave] === '')
                ) {
                    acc[codigo][chave] = valor
                }
            }
        }

        acc[codigo].qtde += qtde
        acc[codigo]._somaCusto += custo * qtde
        acc[codigo]._somaCustoOriginal += custoOriginal * qtde
        acc[codigo]._temCustoOriginal ||= Boolean(item.custo_original)
    }

    for (const [codigoMaster, comp] of Object.entries(esquema || {})) {
        if (!comp.principal_removido) adicionar(codigoMaster, comp)

        for (const [codigoSlave, item] of Object.entries(comp.agrupamento || {})) {
            adicionar(codigoSlave, item)
        }
    }

    return Object.fromEntries(
        Object.entries(acc).map(([codigo, item]) => {
            const { _somaCusto, _somaCustoOriginal, _temCustoOriginal, custo_original, agrupamento, principal_removido, ...resto } = item

            return [
                codigo,
                {
                    ...resto,
                    codigo,
                    custo: item.qtde ? _somaCusto / item.qtde : 0,
                    ...(_temCustoOriginal ? { custo_original: item.qtde ? _somaCustoOriginal / item.qtde : 0 } : {})
                }
            ]
        })
    )
}

async function enviarDadosPrincipal() {

    const { lpu_ativa } = baseOrcamento()

    if (lpu_ativa == 'ALUGUEL')
        await enviarDadosAluguel()
    else
        await enviarDadosOrcamento()

}

async function enviarDadosOrcamento() {

    try {
        // Releia a sess?o: a vari?vel global pode estar desatualizada.
        const acesso = JSON.parse(localStorage.getItem('acesso'))

        if (!acesso?.token || !acesso?.usuario) {
            popup({ mensagem: 'Sess?o indispon?vel. Fa?a login novamente antes de salvar. O or?amento em edi??o foi mantido.' })
            return
        }

    overlayAguarde()

        const orcamentoBase = baseOrcamento()

        const { dados_orcam } = orcamentoBase || {}
        sincronizarRevisaoAtual(orcamentoBase)

        // Salvar o usuário na primeira vez apenas;
        if (!orcamentoBase.usuario)
            orcamentoBase.usuario = acesso.usuario

        if (!orcamentoBase.dados_orcam)
            return painelClientes()

        if (dados_orcam.omie_cliente == '')
            return popup({ mensagem: 'Cliente em branco' })

        if (dados_orcam.contrato == '')
            dados_orcam.contrato = 'sequencial'

        // Se tiver desconto: total bruto > total_geral: aprovação será necessária;
        orcamentoBase.aprovacao = orcamentoBase.total_bruto > orcamentoBase.total_geral
            ? { status: 'pendente', usuario: acesso.usuario }
            : null

        // Unificador para dados_composições;
        orcamentoBase.dados_composicoes = gerarDadosComposicoes(orcamentoBase.esquema_composicoes || {})

        const { origem, ...orcamentoFinal } = orcamentoBase // Origem não precisa continuar no objeto;
        if (!orcamentoBase?.id)
            orcamentoBase.id = crypto.randomUUID()

        const { success } = await enviar(`dados_orcamentos/${orcamentoBase.id}`, orcamentoFinal) || {}

        if (success) {

            const { dados_orcam } = await recuperarDado('dados_orcamentos', orcamentoBase.id) || {}

            if (!dados_orcam)
                return popup({ mensagem: 'Não foi possível recuperar o ORC_ORÇAMENTO: Fale com o suporte.' })

            const { contrato } = dados_orcam || {}

            if (contrato == 'sequencial')
                return popup({ mensagem: 'ORC_sequencial detectado: Fale com o suporte.' })

            // Caso seja um orçamento vinculado ou troca de Ocorrência para ORC;
            if (orcamentoBase.origem) {

                let { idOrcamento, idOcorrencia } = orcamentoBase.origem || {}

                // Se existir idOrcamento, então é vinculado;
                if (idOrcamento) {
                    const vinculo = await enviarVinculo({ slave: contrato, master: idOcorrencia })
                    // Aviso flutuante: o fluxo segue e troca de tela, um popup seria fechado.
                    if (!vinculo?.success)
                        balaoNotificacao({ imagem: 'imagens/alerta.png', texto: `Orçamento salvo, mas não vinculado: ${vinculo?.mensagem}`, tempo: 15 })
                }

                // Correção principal da criação do orçamento, vem com o ID do orçamento;
                const dataRegistro = dataServidor()
                const correcoes = {
                    [orcamentoBase.id]: {
                        data: dataRegistro.toLocaleString(),
                        datas: {},
                        descricao: `Orçamento criado ${contrato || ''}`,
                        dtCorrecao: dataServidor().toISOString().slice(0, 10),
                        tipoCorrecao: 'WiGZl',
                        usuario: acesso.usuario
                    }
                }

                // Correção para Logística;
                if (['LPU FERRAMENTAS', 'LPU PEÇAS'].includes(orcamentoBase.lpu_ativa)) {

                    const dataMais1s = new Date(dataRegistro.getTime() + 1000)

                    const idLog = crypto.randomUUID()

                    correcoes[idLog] = {
                        aba: idLog,
                        data: dataMais1s.toLocaleString(),
                        datas: {},
                        descricao: `Requisição de materiais para o Funcionário`,
                        dtCorrecao: dataServidor().toISOString().slice(0, 10),
                        setor: ['LOGÍSTICA'],
                        tipoCorrecao: '4Zmd3',
                        usuario: acesso.usuario
                    }

                }

                // Salvamento da ocorrência, observar bifurcação (ORC ou G);
                // Se ORC, então este orçamento é vinculado;

                if (!idOcorrencia.includes('ORC')) {
                    // Se G ou qualquer outro, então é substitutivo para ORC;
                    // Sem a troca, as correções iriam para um chamado que não existe.
                    if (!await desvincularOcorrencia(idOcorrencia, contrato))
                        return
                    idOcorrencia = contrato
                }

                // Salvar uma correção obrigatoriamente;
                for (const [idCorrecao, correcao] of Object.entries(correcoes))
                    await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, correcao)

                await telaOcorrencias()

                removerOverlay()

            } else {

                popup({ tempo: 4, mensagem: 'Aguarde... redirecionando...', imagem: 'imagens/concluido.png' })

                // Limpeza do orçamento em edição;
                baseOrcamento(undefined, true)
                await telaOrcamentos()

            }

            criarMenus('inicial')

        } else {

            popup({ mensagem: 'Falha no salvamento, tente de novo em alguns minutos' })

        }
    } catch (erro) {
        console.error('Erro ao salvar or?amento:', erro)
        popup({ mensagem: 'N?o foi poss?vel concluir o salvamento. O or?amento em edi??o foi mantido. Confira sua sess?o e tente novamente.' })
    } finally {
        removerOverlay()
    }
}

// Retorna true quando o chamado passou a usar o número do orçamento.
async function desvincularOcorrencia(id, contrato) {
    try {
        const { token } = JSON.parse(localStorage.getItem('acesso')) || {}
        const resposta = await fetch(`${api}/desvincular-ocorrencia`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                id,
                contrato,
                usuario: acesso.usuario
            })
        })

        const dados = await resposta.json().catch(() => ({}))

        if (!resposta.ok || !dados.success) {
            popup({ mensagem: `Orçamento ${contrato} salvo, mas o chamado não foi atualizado: ${dados.mensagem || 'Erro na requisição'}` })
            return false
        }

        return true

    } catch (err) {
        popup({ mensagem: err.message || 'Erro de conexão com o servidor' })
        return false
    }
}

function formatarTabela() {

    const tipo = controles?.composicoes_orcamento?.filtros?.tipo?.value || ''

    const menuPaginacao = document.getElementById('paginacao_composicoes_orcamento')

    const topoTabela = menuPaginacao.closest('.topo-tabela')

    topoTabela.style.background = coresTabelas(tipo)

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
        alturaMinima: '60dvh',
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
    const itemOrcamento = baseOrcamento()?.esquema_composicoes?.[codigo]
    const quantidadeOrcamento = itemOrcamento && !itemOrcamento.principal_removido
        ? itemOrcamento.qtde ?? ''
        : ''

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
            <input id="prod_${codigo}" type="number" value="${escaparAtributo(quantidadeOrcamento)}" oninput="incluirItem('${codigo}', this.value, this)">
        </td>
        <td>
            <div style="${horizontal}; justify-content: space-between; gap:">
                
                <label class="campo-valor ${preco > 0 ? 'verde' : 'vermelho' }">${dinheiro(preco)}</label>
                ${sinalizacao}

            </div>
        </td>
        <td>
            <img name="${codigo}" onclick="abrirImagem('${codigo}')" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo" src="${produto?.imagem || logo}" style="width: 4rem;">
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

    const hoje = dataServidor()
    const diffDias = Math.floor((hoje - dataRef) / (1000 * 60 * 60 * 24))
    const imagem = diffDias > 30 ? 'preco_neg' : 'preco'

    return `<img onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" src="imagens/${imagem}.png">`
}

async function alterarValorUnitario(chave, campo) {

    overlayAguarde()
    const [codigoMaster, codigoSlave] = chave.includes('_')
        ? chave.split('_')
        : [chave, null]

    const { esquema_composicoes } = baseOrcamento()
    const itemOrcamento = codigoSlave
        ? esquema_composicoes[codigoMaster]?.agrupamento?.[codigoSlave]
        : esquema_composicoes[codigoMaster]
    const avulso = ehItemAvulso(itemOrcamento)

    // Avulso não tem preço de catálogo: o "original" é o preço com que ele entrou no orçamento.
    const produto = avulso ? { descricao: itemOrcamento.descricao } : await recuperarDado('dados_composicoes', codigoSlave || codigoMaster) || {}
    const lpu = String(document.getElementById('lpu').value).toLowerCase()
    const ativo = produto?.[lpu]?.ativo || 0
    const historico = produto?.[lpu]?.historico || {}
    const precoOriginal = avulso
        ? Number(itemOrcamento.custo_original ?? itemOrcamento.custo) || 0
        : historico?.[ativo]?.valor || 0
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
            elemento: `<input id="novoValor" type="number">`
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


const consultasQuantidadeOrcamento = new Map()

async function preservarPosicaoCatalogo(atualizar, codigo, disparador) {
    try {
        return await atualizar()
    } finally {
        // Rola o painel da aplicação e a página até o fim após atualizar o orçamento.
        requestAnimationFrame(() => {
            const catalogo = document.getElementById('tabelaItens')
            for (let painel = catalogo?.parentElement; painel; painel = painel.parentElement)
                painel.scrollTop = painel.scrollHeight
            if (document.scrollingElement)
                document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight
        })
    }
}

async function incluirItem(codigo, novaQuantidade, disparador) {
    const consulta = Symbol()
    consultasQuantidadeOrcamento.set(codigo, consulta)
    if (String(novaQuantidade).trim() === '') return
    novaQuantidade = Number(novaQuantidade)
    if (!Number.isFinite(novaQuantidade) || novaQuantidade < 0) return
    const atual = baseOrcamento().esquema_composicoes?.[codigo]
    if (atual?.principal_removido) {
        atual.qtde = novaQuantidade
        const orcamento = baseOrcamento()
        orcamento.esquema_composicoes[codigo] = atual
        baseOrcamento(orcamento)
        await preservarPosicaoCatalogo(() => restaurarPrincipalOrcamento(codigo, false), codigo, disparador)
        return
    }
    try {
        const dadosMaster = await recuperarDado('dados_composicoes', codigo) || {}
        const { agrupamento, descricao, tipo, unidade, imagem, snapshots } = dadosMaster
        const custo = snapshots?.[lpuATIVA]?.[0] || 0
        const filhos = {}
        for (const [cod, dados] of Object.entries(agrupamento || {})) {
            const filho = await recuperarDado('dados_composicoes', cod) || {}
            filhos[cod] = {
                codigo: cod, qtde: dados.qtde * novaQuantidade,
                descricao: filho.descricao, unidade: filho.unidade,
                custo: filho.snapshots?.[lpuATIVA]?.[0] || 0, tipo: filho.tipo, imagem: filho.imagem
            }
        }
        // Uma resposta antiga nunca substitui a quantidade digitada mais recentemente.
        if (consultasQuantidadeOrcamento.get(codigo) !== consulta) return
        const orcamento = baseOrcamento()
        orcamento.esquema_composicoes ??= {}
        orcamento.esquema_composicoes[codigo] = {
            ...orcamento.esquema_composicoes[codigo], codigo, descricao, custo, tipo, imagem, unidade,
            qtde: novaQuantidade, agrupamento: filhos
        }
        baseOrcamento(orcamento)
        controles.criarOrcamento.base = Object.values(orcamento.esquema_composicoes)
        await preservarPosicaoCatalogo(() => paginacao('criarOrcamento'), codigo, disparador)
    } catch (erro) {
        if (consultasQuantidadeOrcamento.get(codigo) === consulta)
            popup({ mensagem: erro.message || 'Falha ao atualizar quantidade.' })
    }
}

async function pesquisarRequisicoes() {

    const { dados_orcam } = baseOrcamento()
    const contrato = dados_orcam?.contrato

    if (!contrato)
        return

    controles.criarOrcamento ??= {}

    // Primeira vez que é carregado;
    if (!controles.criarOrcamento?.requisicoesExistentes) {

        const requisicoes = await pesquisarDB({
            base: 'requisicoes',
            filtros: {
                departamento: { op: 'includes', value: contrato }
            }
        })

        const quantidadesProdutos = {}

        for (const { requisicao } of requisicoes.resultados) {

            for (const [codigo, { qtde_enviar }] of Object.entries(requisicao)) {

                quantidadesProdutos[codigo] ??= 0
                quantidadesProdutos[codigo] += qtde_enviar

            }

        }

        controles.criarOrcamento.requisicoesExistentes = quantidadesProdutos

    }

}
