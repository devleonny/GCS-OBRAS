let filtrosPagina = {}
let pagina
let modo
let moduloComposicoes = {}
let tabelaAtiva
let tipoAtivo = 'TODOS'
let titulo = null
let memoriaFiltro = null
let lpuATIVA = null
let paginaComposicoes = 1
let totalPaginas = null
const porPagina = 100

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

    popup(`
        <div style="display: flex; gap: 1vw; align-items: center; padding: 2vw; background-color: #d2d2d2;">
            <label>Tem certeza que deseja apagar o Orçamento?</label>
            ${botao('Confirmar', `confirmarExclusaoOrcamento()`, 'green')}
        </div>
        `, 'Alerta')

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
                    <label style="font-size: 1em;">Tabela de preço</label>
                    <select id="lpu" onchange="alterarTabelaLPU(this.value)"
                        style="background-color: white; border-radius: 3px; padding: 5px;">
                    </select>

                </div>

                <div id="desconto_total"></div>

                <div style="${vertical}; gap: 3px;">
                    <span>LEGENDAS</span>
                    <hr style="width: 100%;">
                    ${modelo('Preço Atualizado', 'preco')}
                    ${modelo('Preço Desatualizado', 'preco_neg')}
                    ${modelo('Juntar itens', 'elo')}
                    ${modelo('Aumentar o preço', 'ajustar')}
                </div>

            </div>

            <br>

            <div id="tabelas"></div>
            <div id="tabelaItens"></div>

        </div>

    </div>

    <div id="orcamento_livre"></div>
    `

    dados_clientes = await recuperarDados('dados_clientes') || {}

    const orcamentoPadrao = document.getElementById('orcamento_padrao')
    if (!orcamentoPadrao) tela.innerHTML = acumulado

    criarMenus('criarOrcamentos')
    await atualizarOpcoesLPU()
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

            ${modelo('Chamado Original', `
            <span class="opcoes"
                name="orcamento"
                ${idMaster ? `id="${idMaster}"` : ''}
                onclick="cxOpcoes('orcamento', 'dados_orcamentos', ['dados_orcam/contrato', 'dados_orcam/analista', 'total_geral[dinheiro]'], 'incluirMaster()')">
                    ${orcamentoMaster?.dados_orcam?.contrato || 'Selecione'}
            </span>
            <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="removerMaster()">
            `)}

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

    const acumulado = `
        <div style="${horizontal}; background-color: #d2d2d2; padding: 2rem;">
            <span>Deseja excluir a <b>${revisao}</b>?
            <button onclick="confirmarExclusaoRevisao()">Confirmar</button>
        </div>
    `
    popup(acumulado, 'Tem certeza?', true)
}

function confirmarExclusaoRevisao() {
    const revisao = document.querySelector('[name="revisao"]').value
    const orcamento = baseOrcamento()

    delete orcamento.revisoes.historico[revisao]

    const revisoes = Object.keys(orcamento.revisoes?.historico || {})
        .map(r => Number(r.replace('R', '')))
        .sort((a, b) => a - b)

    // determina a nova revisão ativa
    const numAtual = Number(revisao.replace('R', ''))
    let anterior = revisoes
        .filter(n => n < numAtual)
        .pop()

    // se não houver anterior, tenta próxima; se não houver nenhuma, zera
    if (!anterior) anterior = revisoes.find(n => n > numAtual)
    orcamento.revisoes.atual = anterior ? `R${anterior}` : null

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

    const codsRevisoes = Object.keys(orcamento.revisoes.historico)
        .map(r => Number(r.replace('R', '')))
        .sort((a, b) => a - b)

    let proximoNumero = 1
    for (const n of codsRevisoes) {
        if (n !== proximoNumero) break
        proximoNumero++
    }

    const numeroRevisao = `R${proximoNumero}`

    orcamento.revisoes.atual = numeroRevisao
    orcamento.revisoes.historico[numeroRevisao] = orcamento.esquema_composicoes

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

    dados_composicoes = await recuperarDados('dados_composicoes') || {}

    let orcamentoBase = baseOrcamento() || {}
    const LPUS = [
        ...new Set(
            Object.values(dados_composicoes)
                .filter(produto => produto.origem == origem) // filtra os objetos primeiro
                .flatMap(obj =>
                    Object.keys(obj)
                        .filter(key => key.toLowerCase().includes('lpu')) // só chaves "lpu"
                        .map(key => key.toUpperCase()) // já deixa maiúsculo
                )
        )
    ];

    const lpu = document.getElementById('lpu')
    if (lpu) lpu.innerHTML = LPUS.map(lpu => `<option ${orcamentoBase?.lpu_ativa == lpu ? 'selected' : ''}>${lpu}</option>`).join('')

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

    dados_composicoes = await recuperarDados('dados_composicoes')
    let orcamentoBase = baseOrcamento()

    if (!orcamentoBase.esquema_composicoes) orcamentoBase.esquema_composicoes = orcamentoBase?.dados_composicoes || {}
    const esquemaComposicoes = orcamentoBase.esquema_composicoes
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

    const ordenado = Object.entries(esquemaComposicoes)
        .sort(([_, a], [__, b]) => {
            const ta = a.ordem ?? 0
            const tb = b.ordem ?? 0
            return ta - tb
        })

    lpuATIVA = String(orcamentoBase.lpu_ativa).toLowerCase()

    for (const [codigoMaster, produto] of ordenado) {
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

async function pesquisarNoOrcamento() {

    const termoPesquisa = document.getElementById('termoPesquisa')
    const termo = termoPesquisa.value.trim().toLowerCase()
    const bodyOrcamento = document.getElementById('bodyOrcamento')
    const linhas = bodyOrcamento.querySelectorAll('.linha-orcamento')
    filtrarPorTipo()
    document.querySelectorAll('.total-linha').forEach(el => el.style.display = 'none')

    linhas.forEach(linha => {
        const texto = linha.textContent.toLowerCase()
        const corresponde = termo && texto.includes(termo)
        linha.style.display = (!termo || corresponde) ? '' : 'none'
        linha.style.backgroundColor = 'white'
        linha.style.borderRadius = '8px'
    })

    if (termoPesquisa.value == '') await totalOrcamento()

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
            <img class="imagem-orc" name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 3rem; cursor: pointer;">
        </div>
        
        <div>
            <img src="imagens/cancel.png" onclick="removerItemOrcamento({ codigo: '${codigo}', codigoMaster: ${codigoMaster}})" style="cursor: pointer; width: 1.5rem; border-radius: 3px;">
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
        <div class="total-linha">
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
    if (prod) prod.value = ''

    const idLinha = codigoMaster ? `${codigoMaster}_${codigo}` : `ORCA_${codigo}`
    const linha = document.getElementById(idLinha)
    if (linha) linha.remove()

    baseOrcamento(orcamentoBase)

    await totalOrcamento()

}

async function enviarDadosOrcamento() {

    overlayAguarde()

    // esquema → dados_composicoes
    await converterEsquema()

    let orcamentoBase = baseOrcamento()
    orcamentoBase.origem = origem

    // Salvar o usuário na primeira vez apenas;
    if (!orcamentoBase.usuario) orcamentoBase.usuario = acesso.usuario

    if (!orcamentoBase.dados_orcam) {
        return popup(mensagem('Preencha os dados do Cliente'), 'Alerta')
    }

    const dados_orcam = orcamentoBase.dados_orcam;

    if (dados_orcam.cliente_selecionado === '') return popup(mensagem('Cliente em branco'), 'Alerta')

    if (dados_orcam.contrato === '') return popup(mensagem('Chamado em branco'), 'Alerta')

    if (orcamentoBase.total_desconto > 0) {
        orcamentoBase.aprovacao = {
            status: 'pendente',
            usuario: acesso.usuario
        }
    }

    if (!orcamentoBase.id) orcamentoBase.id = 'ORCA_' + unicoID();

    const resposta = await enviar(`dados_orcamentos/${orcamentoBase.id}`, orcamentoBase)

    if (resposta.sucesso) {

        delete orcamentoBase.dados_orcam.contrato

        popup(mensagem('Aguarde... redirecionando...', 'imagens/concluido.png'), 'Processando...')

        baseOrcamento(undefined, true)
        await telaOrcamentos(true)

        if (orcamentoBase.hierarquia) {
            await vincularAPI({ idMaster: orcamentoBase.hierarquia, idSlave: orcamentoBase.id })
        }

        removerPopup()

        atualizarToolbar(true) // GCS no título

    } else {
        popup(mensagem('Falha no salvamento, tente de novo em alguns minutos'), 'Alerta', true)
    }

}

async function ativarChamado(input, idOrcamento) {

    if (idOrcamento) {
        const resposta = await enviar(`dados_orcamentos/${idOrcamento}/chamado`, input.checked)
        if (resposta.mensagem) popup(mensagem(resposta.mensagem), 'Alerta', true)

        const linha = document.getElementById(idOrcamento)
        if (linha) linha.dataset.chamado = input.checked ? 'S' : 'N'
        filtrarOrcamentos()
        return
    }

    const orcamento = baseOrcamento()
    orcamento.chamado = input.checked
    baseOrcamento(orcamento)

}

async function recuperarComposicoesOrcamento() {

    await sincronizarDados('dados_composicoes')
    dados_composicoes = await recuperarDados('dados_composicoes')
    await tabelaProdutosOrcamentos()

}

async function tabelaProdutosOrcamentos(dadosFiltrados) {

    if (!dadosFiltrados && Object.keys(filtrosPagina).length > 0) return pesquisarProdutos()

    const cor = coresTabelas(null)
    let permissoes = ['adm', 'log', 'editor', 'gerente', 'diretoria', 'coordenacao']
    moduloComposicoes = permissoes.includes(acesso.permissao)
    const colunas = ['codigo', 'descricao', 'unidade', 'quantidade', 'valor', 'imagem']
    const colLiberadas = ['codigo', 'descricao', 'unidade']
    let ths = ''
    let tsh = ''

    colunas.forEach((col, i) => {
        const borda = `border: solid 1px ${cor}db;`
        ths += `
        <th style="padding: 0.5rem; ${borda}">
            <div style="${horizontal}; color: white; justify-content: space-between; width: 100%; gap: 1rem;">
                <span>${col}</span>
                <img onclick="filtrarAAZ('${i}', 'bodyComposicoes')" src="imagens/down.png" style="width: 1rem;">
            </div>
        </th>
        `
        tsh += `
        <th name="th_${col}" style="color: black; text-align: left; padding: 8px; background-color: white; ${borda};" 
            onkeydown="if (event.key === 'Enter') { event.preventDefault(); pesquisarProdutos('${col}', this.textContent.trim()) }"
            contentEditable="${colLiberadas.includes(col)}">
        </th>`
    })

    const toolbar = ['TODOS', ...esquemas.tipo]
        .map(op => `<label class="menu-top" style="background-color: ${coresTabelas(op)};" onclick="pesquisarProdutos('tipo', '${op}')">${op}</label>`)
        .join('')

    const btn = (img, funcao, texto) => `
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
            onclick="${funcao}">
            <img src="imagens/${img}.png" style="width: 1.7rem; cursor: pointer;">
            <label style="color: white; cursor: pointer;">${texto}</label>
        </div>
    `

    const botoes = `

        ${btn('atualizar_2', 'recuperarComposicoesOrcamento()', 'Atualizar')}

        ${moduloComposicoes
            ? btn('add', 'cadastrarItem()', 'Criar Item')
            : ''}
        `

    const acumulado = `
        <div style="position: relative; display: flex; justify-content: center; width: 100%; margin-top: 30px; gap: 10px;">
            ${toolbar}
            ${botoes}
        </div>

        <div style="${vertical};" id="tabela_composicoes">
            <div class="topo-tabela" style="border: none; background-color: ${cor};">
                <div style="${horizontal}; justify-content: start; gap: 2rem; color: white;">
                    <div class="paginacao">
                        <img src="imagens/seta.png" id="btnAnterior" onclick="paginaAnterior()">
                        <span id="paginacaoInfo"></span>
                        <img src="imagens/seta.png" style="transform: rotate(180deg);" id="btnProxima" onclick="proximaPagina()">
                    </div>

                    <span>Dê um <b>ENTER</b> para pesquisar</span>

                </div>
            </div>
            <div class="div-tabela" style="max-height: max-content;">
                <table class="tabela">
                    <thead style="background-color: ${cor}; box-shadow: none;">
                        <tr>${ths}</tr>
                        <tr>${tsh}</tr>
                    </thead>
                    <tbody id="bodyComposicoes"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
        `
    const bodyComposicoes = document.getElementById('bodyComposicoes')
    if (!bodyComposicoes) {
        dados_composicoes = await recuperarDados('dados_composicoes') || {}
        document.getElementById('tabelaItens').innerHTML = acumulado
    }

    dadosFiltrados = dadosFiltrados || dados_composicoes

    const orcamentoBase = baseOrcamento()
    const omie_cliente = orcamentoBase?.dados_orcam?.omie_cliente || ''
    const cliente = dados_clientes?.[omie_cliente] || {}
    const estado = cliente?.estado || null
    const composicoesOrcamento = orcamentoBase?.esquema_composicoes || {}
    const lpu = String(orcamentoBase.lpu_ativa).toLocaleLowerCase()

    // Carregamentos dos itens && filtragem inicial;
    for (const [codigo, produto] of Object.entries(dadosFiltrados)) {
        const ativo = produto?.[lpu]?.ativo || ''
        const historico = produto?.[lpu]?.historico || {}
        const detalhes = historico?.[ativo] || {}
        const preco = detalhes?.valor || 0
        const itemValidoBoticario = preco !== 0 || produto.preco_estado

        const remover =
            origem !== produto.origem ||
            !produto.tipo ||
            (lpu.includes('boticario') && !itemValidoBoticario)

        if (remover) delete dadosFiltrados[codigo]
    }

    const chaves = Object.keys(dadosFiltrados)
    const inicio = (paginaComposicoes - 1) * porPagina
    const fim = inicio + porPagina
    const grupo = chaves.slice(inicio, fim)

    document.getElementById('bodyComposicoes').innerHTML = '' // limpa antes de renderizar

    for (const codigo of grupo) {
        const produto = dadosFiltrados[codigo]
        const qtdeOrcada = composicoesOrcamento?.[codigo]?.qtde || ''
        linhasComposicoesOrcamento({ codigo, produto, qtdeOrcada })
    }

    atualizarControlesPaginacao(chaves.length)

}

function linhasComposicoesOrcamento({ codigo, produto, qtdeOrcada }) {

    const agrupamentoON = Object.keys(produto?.agrupamento || {}).length > 0 ? 'pos' : 'neg'

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
                ${produto?.descricao || '--'}<br>
                <b>Fabricante</b>
                ${produto?.fabricante || '--'}<br>
                <b>Modelo</b>
                ${produto?.modelo || '--'}<br>
            </div>
        </td>
        <td>${produto.unidade}</td>
        <td>
            <input id="prod_${codigo}" value="${qtdeOrcada}" type="number" class="campoValor" oninput="incluirItem('${codigo}', this.value)">
        </td>
        <td></td>
        <td>
            <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 5vw; cursor: pointer;">
        </td>
        `

    const trExistente = document.getElementById(`COMP_${codigo}`)
    if (trExistente) return trExistente.innerHTML = tds
    const linha = `
        <tr data-tipo="${produto.tipo}"
        id="COMP_${codigo}">
            ${tds}
        </tr>
    `
    document.getElementById('bodyComposicoes').insertAdjacentHTML('beforeend', linha)

}

function proximaPagina() {
    if (paginaComposicoes < totalPaginas) {
        paginaComposicoes++
        pesquisarProdutos()
    }
}

function paginaAnterior() {
    if (paginaComposicoes > 1) {
        paginaComposicoes--
        pesquisarProdutos()
    }
}

function atualizarControlesPaginacao(total) {
    totalPaginas = Math.ceil(total / porPagina)
    const info = document.getElementById('paginacaoInfo')
    const btnAnt = document.getElementById('btnAnterior')
    const btnProx = document.getElementById('btnProxima')

    info.textContent = `Página ${paginaComposicoes} de ${totalPaginas || 1}`
    btnAnt.disabled = paginaComposicoes <= 1
    btnProx.disabled = paginaComposicoes >= totalPaginas
}

async function pesquisarProdutos(chave, pesquisa) {

    if (chave === 'tipo') {
        pesquisa = pesquisa === 'TODOS' ? '' : pesquisa
        tipoAtivo = pesquisa
        const cor = coresTabelas(pesquisa)
        const topoTabela = document.querySelector('.topo-tabela')
        const tabelaComposicoes = document.getElementById('tabela_composicoes')
        const theadComposicoes = tabelaComposicoes.querySelector('thead')
        theadComposicoes.style.backgroundColor = cor
        topoTabela.style.backgroundColor = cor

        const ths = theadComposicoes.querySelectorAll('th')
        ths.forEach(th => th.style.border = `1px solid ${cor}db`)
    }

    // Só atualiza filtros se chave e pesquisa forem informados
    if (chave && pesquisa != null) {
        paginaComposicoes = 1

        const pesquisaNormalizada = pesquisa
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ç/g, 'c')
            .toLowerCase()
            .trim()

        if (pesquisaNormalizada) {
            filtrosPagina[chave] = pesquisaNormalizada
        } else {
            delete filtrosPagina[chave]
        }
    }

    // Aplica os filtros existentes
    const filtrosAtivos = Object.entries(filtrosPagina).filter(([_, termo]) => termo)
    if (filtrosAtivos.length === 0)
        return await tabelaProdutosOrcamentos()

    // Atualiza os campos visuais com os filtros ativos
    for (const [coluna, termo] of filtrosAtivos) {
        const th = document.querySelector(`[name="th_${coluna}"]`)
        if (th) th.textContent = termo
    }

    const dadosFiltrados = {}

    for (const [codigo, produto] of Object.entries(dados_composicoes)) {
        const corresponde = filtrosAtivos.every(([coluna, termo]) => {
            const valor = String(produto[coluna] || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/ç/g, 'c')
                .toLowerCase()
            return valor.includes(termo)
        })

        if (corresponde) dadosFiltrados[codigo] = produto
    }

    await tabelaProdutosOrcamentos(dadosFiltrados)
}

async function converterEsquema() {

    return new Promise(resolve => {

        let orcamento = baseOrcamento()

        const copiaEsquema = JSON.parse(JSON.stringify(orcamento.esquema_composicoes || {}))
        let totaisSlaves = {}
        let composicoes = {}

        for (const [codigo, dados] of Object.entries(copiaEsquema)) {

            for (const [codigoSlave, dadosSlave] of Object.entries(dados.agrupamento || {})) {

                if (!totaisSlaves[codigoSlave]) totaisSlaves[codigoSlave] = { total: 0, qtde: 0, desconto: 0 }

                const item = totaisSlaves[codigoSlave]

                if (dadosSlave.tipo_desconto) {
                    const desconto = dadosSlave.tipo_desconto.toLowerCase() === 'dinheiro'
                        ? dadosSlave.desconto
                        : ((dadosSlave.desconto / 100) * dadosSlave.custo) * dadosSlave.qtde
                    item.desconto += desconto || 0
                }

                item.qtde += dadosSlave.qtde
                item.total += (dadosSlave.custo * dadosSlave.qtde)

                composicoes[codigoSlave] = dadosSlave
            }

            composicoes[codigo] = { ...dados }
            delete composicoes[codigo].agrupamento
        }

        // aplica o desconto acumulado em dinheiro nos itens principais
        for (const [codigo, dados] of Object.entries(totaisSlaves)) {
            const item = composicoes[codigo]
            if (!item) continue

            item.custo = dados.total / dados.qtde
            item.qtde = dados.qtde
            item.tipo_desconto = 'Dinheiro'
            item.desconto = dados.desconto
        }

        orcamento.dados_composicoes = composicoes
        baseOrcamento(orcamento)
        resolve()
    })
}

function verificarData(data, codigo) {
    if (!data) return ''

    const [dt] = String(data).split(', ')
    const [dia, mes, ano] = dt.split('/').map(Number)
    const dataRef = new Date(ano, mes - 1, dia)

    const hoje = new Date()
    const diffDias = Math.floor((hoje - dataRef) / (1000 * 60 * 60 * 24))

    const elemento = `<img onclick="abrirHistoricoPrecos('${codigo}', '${lpuATIVA}')" src="imagens/${diffDias > 30 ? 'preco_neg' : 'preco'}.png" style="width: 1.5rem;">`

    return elemento
}

async function moverItem({ codigoAmover, codigoMaster }) {

    const orcamento = baseOrcamento()
    const composicoes = orcamento?.esquema_composicoes || {}
    let tempComposicoes = {}

    for (const [codigo, produto] of Object.entries(composicoes)) {
        if (codigoAmover == codigo) continue
        if (codigoMaster == codigo) continue
        if (composicoes?.[codigo]?.agrupamento?.[codigoAmover]) continue

        tempComposicoes[codigo] = {
            ...produto,
            qt: `Quantidade: ${produto.qtde}`,
            cd: `Código: ${codigo}`
        }
    }

    await inserirDados(tempComposicoes, 'tempComposicoes', true)

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 2rem;">

            <span>Escolha para quem este item irá:</span>

            <hr style="width: 100%;">

            <div style="${horizontal}; gap: 2rem;">
                <span class="opcoes" name="produto" onclick="cxOpcoes('produto', 'tempComposicoes', ['descricao', 'qt', 'cd'])">Selecione</span>
                <img onclick="confirmarMoverItem({codigoAmover: ${codigoAmover}, codigoMaster: ${codigoMaster}})" src="imagens/concluido.png" style="width: 2rem; cursor: pointer;">
            </div>
        </div>
    `

    popup(acumulado, 'Mover Item', true)

}

async function confirmarMoverItem({ codigoAmover, codigoMaster }) {

    overlayAguarde()

    let orcamento = baseOrcamento()

    if (codigoMaster) { // Item atualmente em outro master;

        const produtoAmover = orcamento.esquema_composicoes[codigoMaster].agrupamento[codigoAmover]
        const codigoDestino = document.querySelector('[name="produto"]')

        if (!codigoDestino) return

        orcamento.esquema_composicoes[codigoDestino.id].agrupamento[codigoAmover] = produtoAmover
        delete orcamento.esquema_composicoes[codigoMaster].agrupamento[codigoAmover]

        removerItemOrcamento({ codigo: codigoAmover, codigoMaster })

    } else { // Item master que vai se tornar slave;

        const produtoAmover = orcamento.esquema_composicoes[codigoAmover]
        const codigoDestino = document.querySelector('[name="produto"]')

        if (!codigoDestino) return

        if (!orcamento.esquema_composicoes[codigoDestino.id].agrupamento) orcamento.esquema_composicoes[codigoDestino.id].agrupamento = {}

        orcamento.esquema_composicoes[codigoDestino.id].agrupamento[codigoAmover] = produtoAmover
        delete orcamento.esquema_composicoes[codigoAmover]

        removerItemOrcamento({ codigo: codigoAmover })

    }

    const prod = document.getElementById(`prod_${codigoAmover}`)
    if (prod) prod.value = ''

    baseOrcamento(orcamento)

    await carregarTabelasOrcamento()

    removerPopup()

}

async function totalOrcamento() {

    atualizarToolbar()

    let orcamentoBase = baseOrcamento()
    const lpu = String(orcamentoBase.lpu_ativa).toLowerCase()
    let totais = { GERAL: { valor: 0, bruto: 0 } }
    let avisoDesconto = 0
    let totalAcrescido = 0
    let descontoAcumulado = 0
    let statusCotacao = false
    const cliente = dados_clientes?.[orcamentoBase.dados_orcam?.omie_cliente] || ''
    const estado = cliente.estado || false

    if (!orcamentoBase.esquema_composicoes) orcamentoBase.esquema_composicoes = {}

    const bodyOrcamento = document.getElementById('bodyOrcamento')
    if (!bodyOrcamento) return

    const subTotais = document.querySelectorAll('.total-linha')
    subTotais.forEach(divTotal => {
        divTotal.querySelector('span').textContent = ''
    })

    const linhas = bodyOrcamento.querySelectorAll('.linha-orcamento')

    for (const linha of linhas) {

        const codigo = linha.dataset.codigo
        const hierarquia = linha.dataset.hierarquia
        let itemSalvo = {}

        linha.style.backgroundColor = hierarquia == 'master' ? 'white' : '#fff8d3'
        linha.style.borderTopLeftRadius = '0px'
        linha.style.borderTopRightRadius = '0px'
        linha.style.borderBottomLeftRadius = '0px'
        linha.style.borderBottomRightRadius = '0px'
        let qtdeFilhos = 0
        let codigoMaster = null

        if (hierarquia == 'master') {
            if (!orcamentoBase.esquema_composicoes[codigo]) orcamentoBase.esquema_composicoes[codigo] = {}
            itemSalvo = orcamentoBase.esquema_composicoes[codigo]
            qtdeFilhos = Object.keys(itemSalvo?.agrupamento || {}).length

            if (qtdeFilhos == 0) {
                linha.style.borderBottomLeftRadius = '8px'
                linha.style.borderBottomRightRadius = '8px'
            }

            linha.style.borderTopLeftRadius = '8px'
            linha.style.borderTopRightRadius = '8px'

        } else {
            const cods = String(linha.id).split('_')
            codigoMaster = cods[0]
            if (!orcamentoBase.esquema_composicoes[codigoMaster].agrupamento) orcamentoBase.esquema_composicoes[codigoMaster].agrupamento = {}
            itemSalvo = orcamentoBase.esquema_composicoes[codigoMaster].agrupamento[codigo]
        }

        const elo = linha.querySelector('[name="elo"]')
        elo.innerHTML = `<img onclick="moverItem({codigoAmover: ${codigo}, codigoMaster: ${codigoMaster}})" src="imagens/elo.png" style="cursor: pointer; width: 1.5rem;">`

        itemSalvo.codigo = codigo
        const refProduto = dados_composicoes?.[codigo] || itemSalvo
        const boticario = refProduto.preco_estado && lpu.includes('boticario')

        linha.dataset.tipo = refProduto.tipo

        if (!totais[refProduto.tipo]) totais[refProduto.tipo] = { valor: 0 }

        const ativo = refProduto?.[lpu]?.ativo || 0
        const historico = refProduto?.[lpu]?.historico || {}
        const precos = historico[ativo] || { custo: 0, lucro: 0 }

        let valorUnitario = 0

        // Caso esse item tenha preços por estado;
        if (boticario) {

            valorUnitario = refProduto.preco_estado[estado] || 0

        } else {

            valorUnitario = historico?.[ativo]?.valor || 0

        }

        if (itemSalvo.alterado) valorUnitario = itemSalvo.custo

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
        divDesconto.style.display = (itemSalvo.custo_original || boticario) ? 'none' : 'flex'

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

            const icmsSaida = precos?.icms_creditado == 4 ? 4 : estado == 'BA' ? 20.5 : 12
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

        tipoDesconto.classList = desconto == 0 ? 'desconto_off' : 'desconto_on'
        valorDesconto.classList = desconto == 0 ? 'desconto_off' : 'desconto_on'

        // Incremento dos itens com valores acrescidos para informar no escopo do orçamento;
        let diferencaAcrescida = totalLinha - (itemSalvo.custo_original * quantidade)
        if (itemSalvo.custo_original) totalAcrescido += diferencaAcrescida

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
        el('descVD').style.display = vendaDiretaAtiva ? 'flex' : 'none'
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

        const linhaMaster = document.getElementById(`ORCA_${codigoMaster || codigo}`)
        const totalBlocoDiv = linhaMaster.querySelector('.total-linha')
        if (hierarquia == 'master') totalBlocoDiv.style.display = qtdeFilhos == 0 ? 'none' : 'flex'
        const totalBloco = totalBlocoDiv.querySelector('span')
        totalBloco.innerHTML = dinheiro(conversor(totalBloco.textContent) + totalLinha)

        itemSalvo.descricao = refProduto.descricao
        itemSalvo.unidade = refProduto?.unidade || 'UN'
        itemSalvo.qtde = quantidade
        itemSalvo.custo = valorUnitario
        itemSalvo.tipo = refProduto.tipo
        itemSalvo.imagem = imagem

        // Refletir a quantidade na tabela de baixo;
        const inputProduto = document.getElementById(`prod_${codigo}`)
        if (inputProduto && hierarquia == 'master') inputProduto.value = quantidade

    }

    // Caso tenha algum item com preço desatualizado;
    if (!orcamentoBase.status) orcamentoBase.status = {}
    if (statusCotacao) {
        orcamentoBase.status.atual = 'COTAÇÃO'
    } else {
        delete orcamentoBase.status.atual
    }

    // Caso tenha algum item com preço desatualizado;
    if (!orcamentoBase.status) orcamentoBase.status = {}
    if (statusCotacao) {
        orcamentoBase.status.atual = 'COTAÇÃO'
    } else {
        delete orcamentoBase.status.atual
    }

    const painel_desconto = document.getElementById('desconto_total')
    const diferencaDinheiro = totais.GERAL.valor - totais.GERAL.bruto
    const diferencaPorcentagem = diferencaDinheiro == 0 ? 0 : (diferencaDinheiro / totais.GERAL.bruto * 100).toFixed(2)

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
    totalAcrescido > 0 ? orcamentoBase.total_acrescido = totalAcrescido : delete orcamentoBase.total_acrescido
    descontoAcumulado > 0 ? orcamentoBase.total_desconto = descontoAcumulado : delete orcamentoBase.total_desconto
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
            filtrarPorTipo()
        }
    }

    // Visibilidade Tabela;
    const tabelas = document.getElementById('tabelas')
    const quieto = document.querySelector('.quieto')
    if (quieto) quieto.remove()

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
            1: 'Preencha os dados do Cliente antes de aplicar descontos',
            2: 'Desconto ultrapassa o permitido',
            3: 'Atualize os valores no ITEM [ICMS Creditado, Custo de Compra...]'
        }

        popup(mensagem(avisos[avisoDesconto]), 'Alerta')
    }

    await tabelaProdutosOrcamentos()
}

async function filtrarPorTipo(tipo) {

    tipo = tipo || 'GERAL'
    memoriaFiltro = tipo

    const divOrcamento = document.getElementById('bodyOrcamento')
    const linhas = divOrcamento.querySelectorAll('.linha-orcamento')
    document.getElementById('theadOrcamento').style.backgroundColor = coresTabelas(tipo)
    document.querySelectorAll('.total-linha').forEach(el => el.style.display = 'none')

    for (const linha of linhas) {

        linha.style.display = (tipo == 'GERAL' || linha.dataset.tipo == tipo) ? '' : 'none'
        linha.style.backgroundColor = 'white'

        linha.style.borderRadius = '8px'

        linha.querySelector('[name=tipo]').textContent = tipo == 'GERAL' ? linha.dataset.tipo : ''

        const hierarquia = linha.dataset.hierarquia
        let infoMaster = ''
        if (hierarquia == 'slave' && tipo !== 'GERAL') {
            const [codMaster,] = String(linha.id).split('_')
            const prodMaster = dados_composicoes?.[codMaster] || {}
            infoMaster = `
                <div style="${horizontal}; gap: 3px;">
                    <img src="imagens/link.png" style="width: 1.5rem;">
                    <span>${prodMaster.descricao}</span>
                </div>
            `
        } else {
            infoMaster = ''
        }

        linha.querySelector('[name="master"]').innerHTML = infoMaster

    }

    if (tipo == 'GERAL') await totalOrcamento()

}

async function alterarValorUnitario({ codigo, codigoMaster }) {

    const produto = dados_composicoes[codigo]
    const lpu = String(document.getElementById('lpu').value).toLowerCase()

    if (lpu == 'lpu carrefour') return popup(mensagem('Carrefour não permite mudanças de valores'), 'AVISO')

    const ativo = produto?.[lpu]?.ativo || 0
    const historico = produto?.[lpu]?.historico || {}
    const precoOriginal = historico?.[ativo]?.valor || 0

    const acumulado = `
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

    popup(acumulado, 'Aumentar o preço')

}

async function confirmarNovoPreco({ codigo, codigoMaster, precoOriginal, operacao }) {

    // verificar se é master ou slave;
    let orcamento = baseOrcamento()
    let item = codigoMaster
        ? orcamento.esquema_composicoes[codigoMaster].agrupamento[codigo]
        : orcamento.esquema_composicoes[codigo]

    if (operacao == 'incluir') {
        let valor = Number(document.getElementById('novoValor').value)

        if (precoOriginal >= valor) return popup(mensagem('O valor precisa ser maior que o Original'), 'AVISO', true)
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
    let orcamentoBase = baseOrcamento()
    const produto = dados_composicoes[codigo]
    let agrupamento = orcamentoBase?.esquema_composicoes?.[codigo]?.agrupamento || {}

    // Ajustes dos agrupamentos;
    for (const [cod, dados] of Object.entries(produto?.agrupamento || {})) {
        agrupamento[cod] = {
            qtde: dados.qtde * novaQuantidade,
        }
    }

    if (!orcamentoBase.esquema_composicoes) orcamentoBase.esquema_composicoes = {}

    // Inclusão do item;
    orcamentoBase.esquema_composicoes[codigo] = {
        ordem: Date.now(),
        agrupamento,
        qtde: novaQuantidade
    }

    baseOrcamento(orcamentoBase)

    await carregarTabelasOrcamento()
}