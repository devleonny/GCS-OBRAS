let memoriaFiltro = 'GERAL'
let lpuATIVA = null
const formatacao = {}

const metaforas = [
    "Um monitor sem imagens para exibir",
    "Um sistema de vigilância sem olhos",
    "Uma rede sem nós conectados",
    "Uma central de segurança em silêncio",
    "Uma câmera sem ângulos para vigiar",
    "Um gravador sem arquivos para armazenar",
    "Um mapa sem áreas para monitorar",
    "Uma sala de controle sem alertas",
    "Um software sem dados para processar",
    "Uma instalação sem cabos para ligar",
    "Um alarme sem disparo",
    "Um servidor sem logs de acesso",
    "Um banco de dados sem registros",
    "Uma cerca virtual sem perímetro",
    "Um sensor sem movimento detectado",
    "Um sistema de monitoramento sem eventos",
    "Uma interface sem transmissões ao vivo",
    "Uma tela de múltiplas câmeras em branco",
    "Um painel de controle sem notificações",
    "Uma infraestrutura sem dispositivos ativos"
]

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

    mostrarMenus(false)

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
                    <label style="font-size: 1em;">Tabela de preço</label>
                    <select id="lpu" onchange="alterarTabelaLPU(this.value)"
                        style="background-color: white; border-radius: 3px; padding: 5px;">
                    </select>

                </div>

                <div id="desconto_total"></div>

                <div style="${vertical}; gap: 3px; margin-right: 0.5rem;">
                    <span>LEGENDAS</span>
                    <hr style="width: 100%;">
                    ${modelo('Preço Atualizado', 'preco')}
                    ${modelo('Preço Desatualizado', 'preco_neg')}
                    ${modelo('Juntar itens', 'elo')}
                    ${modelo('Aumentar o preço', 'ajustar')}
                    <div id="chavePrecos"></div>
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
    if (!orcamentoPadrao) tela.innerHTML = acumulado

    criarMenus('criarOrcamentos')
    carregarResposta()
    await manterPrecos()

}

async function manterPrecos(verificacao = true) {


    if (verificacao) {
        const orcamento = baseOrcamento()

        const painel = document.querySelector('.painel-manter-precos')
        if (painel)
            return

        // Se tiver respondido, pode passar;
        if (orcamento?.manter_precos || !orcamento?.id) {
            return await atualizarOpcoesLPU()
        }

    }

    const modelo = (img, acao, texto, cor) => `
        <div style="${horizontal}; gap: 0.5rem;">
            <img src="imagens/${img}.png">
            <button style="background-color: ${cor || ''}" onclick="removerPopup(); manterPrecosAntigos('${acao}')">${texto}</button>
        </div>`

    const elemento = `
        <div class="painel-manter-precos">

            <p style="text-align: left;">
                Decida se quer editar este orçamento considerando <br>
                os preços de <strong>quando o orçamento foi feito</strong>, <br>
                ou se prefere atualizar tudo: <br>
            </p>
            
            ${modelo('atualizados', 'N', 'Atualizar os Preços')}
            ${modelo('atrasado', 'S', 'Manter os preços antigos', '#e74642')}

        </div>
        `

    popup({ elemento, titulo: 'Manter Preços' })

}

function carregarResposta() {

    const orcamento = baseOrcamento()
    const manterPrecos = orcamento?.manter_precos == 'S'
    const chavePrecos = document.getElementById('chavePrecos')

    const texto = manterPrecos
        ? 'Preços Antigos'
        : 'Preços Atualizados'

    const img = manterPrecos
        ? 'atrasado'
        : 'atualizados'

    chavePrecos.innerHTML = `
        <div style="${horizontal}; gap: 1rem;">
            <img ${orcamento?.id ? `onclick="manterPrecos(false)"` : ''} src="imagens/${img}.png">
            <span style="text-align: left;">${texto}</span>
        </div>
    `
}

async function manterPrecosAntigos(resposta) {

    orcamento = baseOrcamento()

    if (resposta == 'S')
        orcamento = await recuperarDado('dados_orcamentos', orcamento.id)

    orcamento.manter_precos = resposta

    baseOrcamento(orcamento)

    await atualizarOpcoesLPU()

    carregarResposta()

}

async function atualizarToolbar(remover) {

    titulo = document.querySelector('[name="titulo"]')

    if (remover) return titulo.textContent = 'GCS'

    const orcamentoBase = baseOrcamento()
    const edicao = orcamentoBase?.dados_orcam?.contrato == 'sequencial' || (orcamentoBase && orcamentoBase?.dados_orcam?.contrato)
    const contrato = orcamentoBase?.dados_orcam?.contrato == 'sequencial' ? 'Código a definir...' : orcamentoBase?.dados_orcam?.contrato

    const idMaster = orcamentoBase?.hierarquia
    const orcamentoMaster = await recuperarDado('dados_orcamentos', idMaster)

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

    titulo.innerHTML = `
        <div style="${horizontal}; gap: 0.5rem;">
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

    if (!orcamento?.revisoes?.historico?.[revisao]) return

    delete orcamento.revisoes.historico[revisao]
    const chavesRevisoes = Object.keys(orcamento?.revisoes?.historico || {})
    const RX = chavesRevisoes[0]
    orcamento.esquema_composicoes = orcamento?.revisoes?.historico?.[RX] || {}
    orcamento.revisoes.atual = RX

    revisao.innerHTML = chavesRevisoes.map(r => `<option ${r == RX ? 'selected' : ''}>${r}</option>`).join('')

    baseOrcamento(orcamento)

    atualizarToolbar()
    reiniciarLinhas()
    removerPopup()
}


async function alterarRevisao() {
    const revisao = document.querySelector('[name="revisao"]').value

    const orcamento = baseOrcamento()
    orcamento.revisoes.atual = revisao
    orcamento.esquema_composicoes = orcamento.revisoes.historico[revisao]

    baseOrcamento(orcamento)

    await reiniciarLinhas()
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
    orcamento.revisoes.historico[numeroRevisao] =
        structuredClone(orcamento.esquema_composicoes)

    baseOrcamento(orcamento)
    await atualizarToolbar()
}

async function reiniciarLinhas() {

    // Resetar as linhas;
    const bodyOrcamento = document.getElementById('bodyOrcamento')
    if (bodyOrcamento) bodyOrcamento.innerHTML = ''

    await carregarTabelasOrcamento()

}

async function incluirMaster() {

    const spanOrcamento = document.querySelector('[name="orcamento"]')
    const orcamentoREF = await recuperarDado('dados_orcamentos', spanOrcamento.id)
    const orcamento = baseOrcamento()

    orcamento.dados_orcam ??= {}
    orcamento.dados_orcam.omie_cliente = orcamentoREF.dados_orcam.omie_cliente
    orcamento.dados_orcam.contrato = 'sequencial'
    orcamento.hierarquia = spanOrcamento.id

    baseOrcamento(orcamento)

}

function removerMaster() {

    const spanOrcamento = document.querySelector('[name="orcamento"]')
    spanOrcamento.textContent = 'Selecione'
    spanOrcamento.removeAttribute('id')

    const orcamento = baseOrcamento()

    delete orcamento.dados_orcam.contrato
    delete orcamento.dados_orcam.omie_cliente
    delete orcamento.hierarquia

    baseOrcamento(orcamento)

}

async function atualizarOpcoesLPU() {

    let orcamentoBase = baseOrcamento() || {}

    const lpu = document.getElementById('lpu')
    if (lpu) {
        lpu.innerHTML = LPUS
            .sort((a, b) => {
                if (a === 'lpu hope') return -1
                if (b === 'lpu hope') return 1
                return a.localeCompare(b)
            })
            .map(lpu => `<option ${orcamentoBase?.lpu_ativa == lpu ? 'selected' : ''}>${lpu.toUpperCase()}</option>`)
            .join('')

    }

    orcamentoBase.lpu_ativa = lpu.value
    baseOrcamento(orcamentoBase)

    await tabelaProdutosOrcamentos()
    await carregarTabelasOrcamento()

}

async function alterarTabelaLPU(tabelaLPU) {
    document.getElementById('lpu').value = tabelaLPU
    let orcamentoBase = baseOrcamento()
    orcamentoBase.lpu_ativa = tabelaLPU
    baseOrcamento(orcamentoBase)
    await tabelaProdutosOrcamentos()
    await carregarTabelasOrcamento()

}

async function carregarTabelasOrcamento() {

    let orcamentoBase = baseOrcamento()

    const esquemaComposicoes = orcamentoBase?.esquema_composicoes || orcamentoBase.dados_composicoes || {}
    const colunas = ['Código', 'Descrição', 'Medida', 'Quantidade', 'Custo Unitário', 'Desconto', 'Valor total', 'Imagem', 'Remover']
    const divTabelas = document.getElementById('tabelas')
    const bodyOrcamento = document.getElementById('bodyOrcamento')

    if (!bodyOrcamento) divTabelas.innerHTML = `
        <div style="${horizontal}; margin-left; 1rem;">
            <div class="pesquisa-orcamento">
                <input id="termoPesquisa" oninput="pesquisarNoOrcamento()" placeholder="Pesquisar">
                <img src="imagens/pesquisar4.png" style="width: 1.5rem; padding: 0.5rem;"> 
            </div>
            <div class="toolbarSuperior"></div> 
        </div>
        <div class="tabela-orcamento">

            <div style="
            text-align: center;
            border-bottom-left-radius: 8px; 
            border-bottom-right-radius: 8px; 
            border-top-left-radius: 8px; 
            background-color: ${coresTabelas()}; 
            color: white;" 
            id="theadOrcamento" 
            class="linha-orcamento">
                ${colunas.map(op => `<span style="padding: 2px;">${op}</span>`).join('')}
            </div>

            <div id="bodyOrcamento"></div>

        </div>
    `
    // Salvando o orçamento com o esquema;
    baseOrcamento(orcamentoBase)

    lpuATIVA = String(orcamentoBase.lpu_ativa).toLowerCase()

    for (const [codigoMaster, produto] of Object.entries(esquemaComposicoes)) {
        carregarLinhaOrcamento(codigoMaster, produto)

        for (const [codigoSlave, produtoSlave] of Object.entries(produto?.agrupamento || {})) {
            carregarLinhaOrcamento(codigoSlave, produtoSlave, codigoMaster)
        }
    }

    await totalOrcamento()

    // Recuperar filtros ou pesquisas;
    const termoPesquisa = document.getElementById('termoPesquisa')

    if (termoPesquisa.value != '') {
        pesquisarNoOrcamento()
    } else {
        filtrarPorTipo(memoriaFiltro)
    }

}

function carregarLinhaOrcamento(codigo, produto, codigoMaster) {

    const opcoes = ['Dinheiro', 'Porcentagem', 'Venda Direta']
        .map(op => `<option ${produto?.tipo_desconto == op ? 'selected' : ''}>${op}</option>`).join('')

    const celulas = `
        <div style="${horizontal}; padding: 0.5rem; gap: 0.5rem;">
            <div name="elo"></div>
            <span>${codigo}</span>
        </div>

        <div style="${vertical}">
            <span name="descricao">${produto?.descricao || 'N/A'}</span>
            <b><span name="tipo" style="font-size: 0.7rem"></span></b>
            <div name="descVD" style="${horizontal}; display: none; gap: 2px;">
                <textarea placeholder="CNPJ" oninput="totalOrcamento()" name="cnpj">${produto?.cnpj || ''}</textarea>
                <textarea placeholder="RAZÃO SOCIAL" oninput="totalOrcamento()" name="razaoSocial">${produto?.razaoSocial || ''}</textarea>
            </div>
            <div name="master"></div>
        </div>

        <div name="medida">${produto?.unidade || 'UN'}</div>

        <div>
            <input name="quantidade" oninput="totalOrcamento()" type="number" class="campoValor" value="${produto.qtde}">
        </div>

        <div style="${horizontal}; gap: 3px;">
            <div name="status"></div>
            <span name="unitario" onclick="abrirHistoricoPrecos('${codigo}', '${lpuATIVA}')" class="valor-orcamento"></span>
            <img onclick="alterarValorUnitario({codigo: ${codigo}, codigoMaster: ${codigoMaster}})" src="imagens/ajustar.png" style="cursor: pointer; width: 1.5rem;">
        </div>

        <div>
            <div style="${vertical}; gap: 1px;" name="divDesconto">
                <select onchange="totalOrcamento()" style="padding: 5px; border-top-left-radius: 5px; border-top-right-radius: 5px;">
                    ${opcoes}
                </select>
                <input 
                type="number" 
                oninput="totalOrcamento()" 
                style="padding-bottom: 5px; padding-top: 5px; border-bottom-left-radius: 5px; border-bottom-right-radius: 5px;" 
                value="${produto?.desconto || ''}">
            </div>
        </div>

        <div>
            <span name="total" class="valor-orcamento">
        </div>

        <div>
            <img class="imagem-orc" name="${codigo}" 
                onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}">
        </div>
        
        <div>
            <img src="imagens/cancel.png" 
                onclick="removerItemOrcamento({ codigo: '${codigo}', codigoMaster: ${codigoMaster}})" 
                style="width: 1.5rem;">
        </div>
    `

    if (codigoMaster) {
        const linhaSlave = document.getElementById(`${codigoMaster}_${codigo}`)
        if (linhaSlave) return linhaSlave.innerHTML = celulas

        const master = document.getElementById(`ORCA_${codigoMaster}`)
        const bloco = master.querySelector(`[name="${codigoMaster}_associado"]`)

        return bloco.insertAdjacentHTML('beforeend', `
            <div data-hierarquia="slave" data-tipo="${produto.tipo}" data-codigo="${codigo}" class="linha-orcamento" id="${codigoMaster}_${codigo}">
                ${celulas}
            </div>`)
    }

    const blocoLinha = `
        <div data-hierarquia="master" class="linha-orcamento" data-tipo="${produto.tipo}" data-codigo="${codigo}">${celulas}</div>
        <div class="linha-bloco" name="${codigo}_associado"></div>
        <div class="total-linha" data-tipo>
            <span name="totalBloco"></span>
        </div>
    `

    const divExistente = document.getElementById(`ORCA_${codigo}`)
    if (divExistente) {
        const linha = divExistente.querySelector('.linha-orcamento')
        linha.innerHTML = celulas
        return
    }

    const linha = `
        <div id="ORCA_${codigo}" style="${vertical};">
            ${blocoLinha}
        </div>
    `
    document.getElementById('bodyOrcamento').insertAdjacentHTML('beforeend', linha)
}

async function removerItemOrcamento({ codigo, codigoMaster }) {

    let orcamentoBase = baseOrcamento()
    let id = `ORCA_${codigo}`

    if (codigoMaster) {
        delete orcamentoBase.esquema_composicoes[codigoMaster].agrupamento[codigo]
        id = `${codigoMaster}_${codigo}`
    } else {
        delete orcamentoBase.esquema_composicoes[codigo]
    }

    const prod = document.getElementById(`prod_${codigo}`)
    if (prod)
        prod.value = ''

    const idLinha = codigoMaster
        ? `${codigoMaster}_${codigo}`
        : `ORCA_${codigo}`

    const linha = document.getElementById(idLinha)
    if (linha)
        linha.remove()

    baseOrcamento(orcamentoBase)

    await totalOrcamento()

}

async function enviarDadosOrcamento() {

    overlayAguarde()

    // Esquema → dados_composicoes;
    await converterEsquema()

    let orcamentoBase = baseOrcamento()

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

    if (orcamentoBase.total_desconto > 0) {
        orcamentoBase.aprovacao = {
            status: 'pendente',
            usuario: acesso.usuario
        }
    }

    if (!orcamentoBase.id)
        orcamentoBase.id = 'ORCA_' + unicoID()

    const resposta = await enviar(`dados_orcamentos/${orcamentoBase.id}`, orcamentoBase)

    if (resposta.success) {

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

async function ativarChamado(input, idOrcamento) {

    // Tela de criação de orçamento, não precisa continuar, o salvar irá coletar a informação;
    if (!idOrcamento)
        return

    const ativo = input.checked
        ? 'S'
        : 'N'

    overlayAguarde()
    const resposta = await enviar(`dados_orcamentos/${idOrcamento}/chamado`, ativo)
    if (resposta.mensagem) {
        input.checked = !ativo
        return popup({ mensagem: resposta.mensagem })
    }

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    orcamento.chamado = ativo

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    const pHistorico = document.querySelector('.painel-historico')
    if (pHistorico)
        await abrirEsquema(idOrcamento)

    removerOverlay()

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

            const filtros = op !== 'TODOS'
                ? `{op:'=', value: '${op}'}`
                : '{}'

            return `<label 
            class="menu-top" 
            style="background-color: ${coresTabelas(op)};" 
            onclick="controles.composicoes_orcamento.filtros.tipo = ${filtros}; paginacao()">
                ${op}
            </label>`
        })
        .join('')

    const lpu = (document.getElementById('lpu').value).toLowerCase()
    const btnExtras = `
        <div class="tag-zerado">
            <input 
                checked="true" 
                onchange="controles.composicoes_orcamento.filtros = this.checked ? {'snapshots.${lpu}': {op:'NOT_ZERO'}} : {}; paginacao();" type="checkbox" style="width: 1.5rem; height: 1.5rem;">
            <span>Remover R$ 0,00</span>
        </div>`

    const colunas = {
        'Código': { chave: 'codigo' },
        'Descrição': { chave: 'descricao' },
        'Modelo': { chave: 'modelo' },
        'Unidade': { chave: 'unidade' },
        'Quantidade': {},
        'Valor': {},
        'Imagem': {}
    }
    const pag = 'composicoes_orcamento'
    const tabela = modTab({
        pag,
        colunas,
        funcaoAdicional: ['formatarTabela', 'totalOrcamento'],
        btnExtras,
        filtros: { [`snapshots.${lpu}`]: { op: 'NOT_ZERO' } },
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
            <input id="prod_${codigo}" type="number" class="campoValor" oninput="incluirItem('${codigo}', this.value)">
        </td>
        <td>
            <div style="${horizontal}; gap: 1px;">
                ${sinalizacao}
                <label class="label-estoque" style="width: max-content; background-color: ${preco > 0 ? '#4CAF50bf' : '#b36060bf'}">
                    ${dinheiro(preco)}
                </label>
            </div>
        </td>
        <td>
            <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 4rem;">
        </td>
        `

    return `
        <tr data-tipo="${produto.tipo}"
        data-ts="${produto?.timestamp || 0}"
        data-id="${codigo}">
            ${tds}
        </tr>`

}


async function converterEsquema() {

    const orcamento = baseOrcamento()
    const origem = JSON.parse(JSON.stringify(orcamento.esquema_composicoes || {}))

    orcamento.dados_composicoes = {}

    function acumular(codigo, item) {

        if (!orcamento.dados_composicoes[codigo]) {
            orcamento.dados_composicoes[codigo] = {
                ...item,
                qtde: 0,
                desconto: 0,
                tipo_desconto: 'dinheiro'
            }
        }

        const destino = orcamento.dados_composicoes[codigo]

        destino.qtde += item.qtde

        // desconto
        if (item.desconto) {
            if (item.tipo_desconto === 'Porcentagem') {
                destino.desconto += (item.custo * item.qtde) * (item.desconto / 100)
            } else {
                destino.desconto += item.desconto
            }
        }
    }

    for (const [codigoMaster, master] of Object.entries(origem)) {

        const m = { ...master }
        delete m.agrupamento
        acumular(codigoMaster, m)

        for (const [codigoSlave, slave] of Object.entries(master.agrupamento || {})) {
            acumular(codigoSlave, slave)
        }
    }

    baseOrcamento(orcamento)
}

function verificarData(data, codigo) {

    const lpu = String(document.getElementById('lpu').value).toLocaleLowerCase()
    if (!data) {
        return `<img onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" src="imagens/preco_neg.png" style="width: 1.5rem;">`
    }

    const [dt] = String(data).split(', ')
    const [dia, mes, ano] = (dt || '').split('/').map(Number)
    const dataRef = new Date(ano, mes - 1, dia)

    if (isNaN(dataRef)) {
        return `<img onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" src="imagens/preco_neg.png" style="width: 1.5rem;">`
    }

    const hoje = new Date()
    const diffDias = Math.floor((hoje - dataRef) / (1000 * 60 * 60 * 24))
    const imagem = diffDias > 30 ? 'preco_neg' : 'preco'

    return `<img onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" src="imagens/${imagem}.png" style="width: 1.5rem;">`
}

async function totalOrcamento() {

    atualizarToolbar()

    const orcamentoBase = baseOrcamento()
    const precosAntigos = orcamentoBase?.manter_precos == 'S'
    const lpu = String(orcamentoBase.lpu_ativa).toLowerCase()
    let totais = { GERAL: { valor: 0, bruto: 0 } }
    let avisoDesconto = 0
    let totalAcrescido = 0
    let descontoAcumulado = 0

    const { estado } = await recuperarDado('dados_clientes', orcamentoBase.dados_orcam?.omie_cliente) || {}

    orcamentoBase.esquema_composicoes ??= {}

    const bodyOrcamento = document.getElementById('bodyOrcamento')
    if (!bodyOrcamento)
        return

    const linhas = bodyOrcamento.querySelectorAll('.linha-orcamento')

    for (const linha of linhas) {

        const codigo = linha.dataset.codigo
        const hierarquia = linha.dataset.hierarquia
        let itemSalvo = {}
        let codigoMaster = null

        if (hierarquia == 'master') {
            orcamentoBase.esquema_composicoes[codigo] ??= {}
            itemSalvo = orcamentoBase.esquema_composicoes[codigo]

        } else {
            const cods = String(linha.id).split('_')
            codigoMaster = cods[0]
            orcamentoBase.esquema_composicoes[codigoMaster].agrupamento ??= {}
            itemSalvo = orcamentoBase.esquema_composicoes[codigoMaster].agrupamento[codigo]
        }

        itemSalvo.codigo = codigo
        const refProduto = await recuperarDado('dados_composicoes', codigo) || itemSalvo

        linha.dataset.tipo = refProduto.tipo

        totais[refProduto.tipo] ??= { valor: 0 }

        const ativo = refProduto?.[lpu]?.ativo || 0
        const historico = refProduto?.[lpu]?.historico || {}
        const precos = historico[ativo] || { custo: 0, lucro: 0 }

        // SE PREÇO ALTERADO > SE MANTER ANTIGOS;
        const valorUnitario = (itemSalvo.alterado || (precosAntigos && itemSalvo.custo))
            ? itemSalvo.custo
            : historico?.[ativo]?.valor || 0

        const quantidade = Number(linha.querySelector('[name="quantidade"]').value)

        let totalLinha = valorUnitario * quantidade
        let desconto = 0
        let tipoDesconto;
        let valorDesconto;

        const divDesconto = linha.querySelector('[name="divDesconto"]')
        tipoDesconto = divDesconto.querySelector('select')
        valorDesconto = divDesconto.querySelector('input')

        if (itemSalvo.custo_original) {
            valorDesconto.value = ''
            desconto = 0
        }

        // Aqui a possibilidade de desconto é tirada do usuário nas situações:
        divDesconto.style.display = itemSalvo.custo_original
            ? 'none'
            : 'flex'

        if (tipoDesconto.value == 'Venda Direta' || valorDesconto.value != '') {

            itemSalvo.desconto = Number(valorDesconto.value)
            itemSalvo.tipo_desconto = tipoDesconto.value

            if (tipoDesconto.value == 'Comissão') {

                desconto = Number(valorDesconto.value) * (-1)

            } else if (tipoDesconto.value == 'Porcentagem') {

                if (valorDesconto.value < 0) {
                    valorDesconto.value = 0
                } else if (valorDesconto.value > 100) {
                    valorDesconto.value = 100
                }

                desconto = valorDesconto.value / 100 * totalLinha

            } else {

                if (valorDesconto.value < 0) {
                    valorDesconto.value = 0
                } else if (valorDesconto.value > totalLinha) {
                    valorDesconto.value = totalLinha
                }

                desconto = Number(valorDesconto.value)
            }

            const icmsSaida = precos?.icms_creditado == 4
                ? 4
                : estado == 'BA'
                    ? 20.5
                    : 12

            const dadosCalculo = {
                custo: precos.custo,
                valor: precos.valor - desconto / quantidade,
                icms_creditado: precos.icms_creditado,
                icmsSaida,
                modalidadeCalculo: refProduto.tipo
            }

            const resultado = calcular(undefined, dadosCalculo)

            if (!estado) {
                valorDesconto.value = ''
                avisoDesconto = 1 // Preencher os dados da empresa;

            } else if (acesso.permissao == 'adm' || acesso.permissao == 'diretoria' || tipoDesconto.value == 'Venda Direta') {
                // Liberado;

            } else if (resultado.lucroPorcentagem < 10) {
                valorDesconto.value = ''
                avisoDesconto = 2 // Lucro mínimo atingido (10%);

            } else if (isNaN(resultado.lucroLiquido)) {
                valorDesconto.value = ''
                avisoDesconto = 3 // ICMS creditado não registrado;
            }

            desconto = avisoDesconto > 0 ? 0 : desconto // Retorna ao zero, caso tenha algum valor de erro;

            itemSalvo.lucroLiquido = resultado.lucroLiquido
            itemSalvo.lucroPorcentagem = resultado.lucroPorcentagem

        } else {
            delete itemSalvo.desconto
            delete itemSalvo.tipo_desconto
        }

        tipoDesconto.classList = desconto == 0
            ? 'desconto_off'
            : 'desconto_on'
        valorDesconto.classList = desconto == 0
            ? 'desconto_off'
            : 'desconto_on'

        // Incremento dos itens com valores acrescidos para informar no escopo do orçamento;
        let diferencaAcrescida = totalLinha - (itemSalvo.custo_original * quantidade)
        if (itemSalvo.custo_original)
            totalAcrescido += diferencaAcrescida

        totais.GERAL.bruto += itemSalvo.custo_original ? totalLinha - diferencaAcrescida : totalLinha // Valor bruto sem desconto;
        totalLinha = totalLinha - desconto
        totais.GERAL.valor += totalLinha
        descontoAcumulado += desconto

        // Soma por Tipo
        totais[refProduto.tipo].valor += totalLinha

        const el = (id) => {
            const elemento = linha.querySelector(`[name="${id}"]`)
            return elemento
        }

        const vendaDiretaAtiva = tipoDesconto.value == 'Venda Direta'
        el('descVD').style.display = vendaDiretaAtiva
            ? 'flex'
            : 'none'

        if (vendaDiretaAtiva) {
            itemSalvo.cnpj = el('cnpj').value
            itemSalvo.razaoSocial = el('razaoSocial').value
        } else {
            el('cnpj').value = ''
            el('razaoSocial').value = ''
            delete itemSalvo.cnpj
            delete itemSalvo.razaoSocial
        }

        el('descricao').innerHTML = `<span>${refProduto.descricao}</span>`
        el('medida').textContent = refProduto?.unidade || 'UN'
        el('status').innerHTML = verificarData(precos?.data, codigo)
        el('unitario').textContent = dinheiro(valorUnitario)
        el('total').style.color = totalLinha <= 0 ? 'red' : '#151749'
        el('total').textContent = dinheiro(totalLinha)

        // o campo name é usado para outra mecânica;
        const imagem = refProduto?.imagem || logo
        linha.querySelector('.imagem-orc').src = imagem

        itemSalvo.descricao = refProduto.descricao
        itemSalvo.unidade = refProduto?.unidade || 'UN'
        itemSalvo.qtde = quantidade
        itemSalvo.custo = valorUnitario
        itemSalvo.tipo = refProduto.tipo
        itemSalvo.imagem = imagem

        // Refletir a quantidade na tabela de baixo;
        const inputProduto = document.getElementById(`prod_${codigo}`)
        if (inputProduto && hierarquia == 'master')
            inputProduto.value = quantidade

    }

    const painel_desconto = document.getElementById('desconto_total')
    const diferencaDinheiro = totais.GERAL.valor - totais.GERAL.bruto
    const diferencaPorcentagem = diferencaDinheiro == 0
        ? 0
        : (diferencaDinheiro / totais.GERAL.bruto * 100).toFixed(2)

    painel_desconto.innerHTML = `
        <div class="resumo">
            <label>RESUMO</label>
            <hr style="width: 100%;">
            <label><b>Total Bruto</b></label>
            <label>${dinheiro(totais.GERAL.bruto)}</label>
            <label><b>Diferença R$</b></label>
            <label>${dinheiro(diferencaDinheiro)}</label>
            <label><b>Diferença %</b></label>
            <label id="diferenca">${diferencaPorcentagem}%</label>
            <input style="display: none" value="${diferencaPorcentagem}">
        </div>`

    // Informações complementares do orçamento;
    totalAcrescido > 0
        ? orcamentoBase.total_acrescido = totalAcrescido
        : delete orcamentoBase.total_acrescido

    descontoAcumulado > 0
        ? orcamentoBase.total_desconto = descontoAcumulado
        : delete orcamentoBase.total_desconto

    orcamentoBase.total_geral = totais.GERAL.valor
    orcamentoBase.total_bruto = totais.GERAL.bruto

    // Salvar a revisão, se existirem;
    const selectRevisao = document.querySelector('[name="revisao"]')
    if (selectRevisao && selectRevisao.value !== '' && orcamentoBase.revisoes) {
        const revisao = selectRevisao.value
        orcamentoBase.revisoes.historico[revisao] = orcamentoBase.esquema_composicoes
    }

    baseOrcamento(orcamentoBase)

    document.getElementById('total_geral').textContent = dinheiro(totais.GERAL.valor)

    const toolbarSuperior = document.querySelector('.toolbarSuperior')
    for (const [tabela, dados] of Object.entries(totais)) {
        const id = `toolbar_${tabela}`
        const toolbar = `
            <span style="font-size: 0.6rem;">${tabela}</span>
            <span style="font-size: 1rem;">${dinheiro(dados.valor)}</span>
        `
        const toolbarTipo = document.getElementById(id)
        if (toolbarTipo) {
            toolbarTipo.innerHTML = toolbar
            continue
        }

        toolbarSuperior.insertAdjacentHTML('beforeend',
            `<div onclick="filtrarPorTipo('${tabela}')" id="${id}" data-tipo="${tabela}" style="background-color: ${coresTabelas(tabela)}" class="menu-top">
                ${toolbar}
            </div>`
        )
    }

    // Remover toolbars inativas;
    const divs = toolbarSuperior.querySelectorAll('div')
    for (const div of divs) {
        const tipo = div.dataset.tipo
        if (!totais[tipo]) {
            div.remove()
        }
    }

    // Visibilidade Tabela;
    const tabelas = document.getElementById('tabelas')
    const quieto = document.querySelector('.quieto')
    if (quieto)
        quieto.remove()

    if (Object.keys(orcamentoBase.esquema_composicoes).length == 0) {
        // Mensagem aleatório de boas vindas;
        const aleatorio = Math.floor(Math.random() * metaforas.length)
        tabelas.insertAdjacentHTML(
            'beforebegin',
            `<div class="quieto">
                <label class="novo_titulo">${metaforas[aleatorio]}</label>
            </div>`)
        tabelas.style.display = 'none'
    } else {
        tabelas.style.display = ''
    }

    if (avisoDesconto != 0) {
        const avisos = {
            2: 'Desconto ultrapassa o permitido',
            3: 'Atualize os valores no ITEM [ICMS Creditado, Custo de Compra...]'
        }

        if (avisoDesconto == 1) {
            painelClientes()
        } else {
            popup({ mensagem: avisos[avisoDesconto] })
        }
    }

    formatarLinhasOrcamento()
    calcularSubtotais()

}

function calcularSubtotais() {
    const blocos = document.querySelectorAll('#bodyOrcamento > div[id^="ORCA_"]')

    blocos.forEach(bloco => {
        const linhas = bloco.querySelectorAll('.linha-orcamento')
        let totalBloco = 0

        linhas.forEach(linha => {
            const valor = linha.querySelector('[name="total"]')
            if (valor) {
                totalBloco += conversor(valor.textContent)
            }
        })

        const totalBlocoDiv = bloco.querySelector('.total-linha')
        if (totalBlocoDiv) {
            totalBlocoDiv.querySelector('span').textContent = dinheiro(totalBloco)
        }
    })
}

async function pesquisarNoOrcamento() {

    const termoPesquisa = document.getElementById('termoPesquisa')
    const termo = termoPesquisa.value.trim().toLowerCase()
    const bodyOrcamento = document.getElementById('bodyOrcamento')
    const linhas = bodyOrcamento.querySelectorAll('.linha-orcamento')

    linhas.forEach(linha => {
        const texto = linha.textContent.toLowerCase()
        const corresponde = termo && texto.includes(termo)
        linha.style.display = (!termo || corresponde) ? '' : 'none'
    })

    formatacao.pesquisa = termoPesquisa.value !== ''
        ? 'S'
        : 'N'

    formatarLinhasOrcamento()

}

function filtrarPorTipo(tipo) {

    // Zerar a pesquisa;
    formatacao.pesquisa = 'N'
    document.getElementById('termoPesquisa').value = ''

    memoriaFiltro = tipo

    document.querySelectorAll('#bodyOrcamento [data-tipo]').forEach(linha => {
        const tipoLinha = linha.dataset.tipo
        const corresponde = !tipo || tipoLinha === tipo || tipo == 'GERAL'
        linha.style.display = corresponde
            ? ''
            : 'none'
    })

    formatacao.tipo = tipo !== 'GERAL'
        ? 'S'
        : 'N'

    formatarLinhasOrcamento()
}

function formatarLinhasOrcamento() {

    // Cor do cabeçalho;
    const theadOrcamento = document.getElementById('theadOrcamento')
    theadOrcamento.style.backgroundColor = coresTabelas(formatacao.pesquisa == 'S' ? 'GERAL' : memoriaFiltro)

    // Mostrar ou ocultar subtotais;
    document.querySelectorAll('.total-linha').forEach(el => el.style.display = 'none')

    if (formatacao.pesquisa == 'S') {

        document.querySelectorAll('#bodyOrcamento .linha-orcamento').forEach(el => {
            el.style.borderRadius = '8px'
            el.style.backgroundColor = 'white'
        })

        return
    }

    if (formatacao.tipo == 'S') {

        bodyOrcamento.querySelectorAll('#bodyOrcamento [data-tipo]').forEach(linha => {
            linha.style.backgroundColor = 'white'

            const tipoLinha = linha.dataset.tipo
            if (tipoLinha)
                linha.style.borderRadius = '0px'
        })

        return
    }


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

async function alterarValorUnitario({ codigo, codigoMaster }) {

    const produto = await recuperarDado('dados_composicoes', codigo)
    const lpu = String(document.getElementById('lpu').value).toLowerCase()
    const ativo = produto?.[lpu]?.ativo || 0
    const historico = produto?.[lpu]?.historico || {}
    const precoOriginal = historico?.[ativo]?.valor || 0

    const elemento = `
    <div style="width: 35vw; background-color: #d2d2d2; display: flex; align-items: center; justify-content: center; padding: 2vw; gap: 10px;">
        <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
            <label style="font-size: 1.2vw;"><strong>Descrição</strong></label>
            <label style="font-size: 0.9vw; text-align: left;">${produto.descricao}</label>
            <label style="font-size: 1.2vw;"><strong>Preço Original</strong></label>
            <label style="font-size: 0.9vw;">${dinheiro(precoOriginal)}</label>
            <br>
            <label style="font-size: 1.2vw;"><strong>Novo Valor</strong></label>
            <input class="campoValor" id="novoValor" type="number">
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <label onclick="confirmarNovoPreco({codigo: ${codigo}, codigoMaster: ${codigoMaster}, precoOriginal: ${precoOriginal}, operacao: 'remover'})" style="text-align: left; text-decoration: underline; cursor: pointer;">Deseja retornar ao preço original?</label>
            <hr style="width: 100%;">
            <label style="text-align: left;">Serão aceitos valores maiores que o preço original</label>
            <button style="background-color: green;" onclick="confirmarNovoPreco({codigo: ${codigo}, codigoMaster: ${codigoMaster}, precoOriginal: ${precoOriginal}, operacao: 'incluir'})">Confirmar</button>
        </div>
    </div>
    `

    popup({ elemento, titulo: 'Aumentar o preço' })

}

async function confirmarNovoPreco({ codigo, codigoMaster, precoOriginal, operacao }) {

    // verificar se é master ou slave;
    let orcamento = baseOrcamento()
    let item = codigoMaster
        ? orcamento.esquema_composicoes[codigoMaster].agrupamento[codigo]
        : orcamento.esquema_composicoes[codigo]

    if (operacao == 'incluir') {
        let valor = Number(document.getElementById('novoValor').value)

        if (precoOriginal >= valor)
            return popup({ mensagem: 'O valor precisa ser maior que o Original' })

        item.custo_original = precoOriginal
        item.custo = valor
        item.alterado = true

    } else if (operacao == 'remover') {
        delete item.custo_original
        delete item.alterado
    }

    baseOrcamento(orcamento)
    await totalOrcamento()
    removerPopup()

}


async function incluirItem(codigo, novaQuantidade) {
    const orcamentoBase = baseOrcamento()
    const dadosMaster = await recuperarDado('dados_composicoes', codigo) || {}
    const { agrupamento, descricao, tipo, unidade, imagem } = dadosMaster

    orcamentoBase.esquema_composicoes ??= {}
    orcamentoBase.esquema_composicoes[codigo] ??= {}

    // garante o objeto de agrupamento
    orcamentoBase.esquema_composicoes[codigo].agrupamento = {}

    // Slaves
    for (const [cod, dados] of Object.entries(agrupamento || {})) {

        const dadosSlave = await recuperarDado('dados_composicoes', cod) || {}
        const { descricao, unidade, tipo, custo, imagem } = dadosSlave

        orcamentoBase.esquema_composicoes[codigo].agrupamento[cod] = {
            qtde: dados.qtde * novaQuantidade,
            descricao,
            unidade,
            tipo,
            custo,
            imagem
        }
    }

    // Item principal
    orcamentoBase.esquema_composicoes[codigo] = {
        ...orcamentoBase.esquema_composicoes[codigo],
        descricao,
        tipo,
        imagem,
        unidade,
        qtde: novaQuantidade
    }

    baseOrcamento(orcamentoBase)

    await carregarTabelasOrcamento()
}
