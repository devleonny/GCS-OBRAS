let filtrosPagina = {}
let pagina;
let modo;
let dados_composicoes = {}
let moduloComposicoes = {}
let tabelaAtiva;
let tipoAtivo = 'TODOS'
let draggedRow = null;

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
        'SERVIÇO': 'green',
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
    await criarOrcamento()
}

async function criarOrcamento() {

    modo = ''
    const acumulado = `
    <div class="contornoTela">

        <div id="orcamento_padrao" style="width: 100%;">

            <div id="menu_superior">

                <img src="imagens/GrupoCostaSilva.png" style="width: 10vw;">

                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">

                    <div style="display: flex; align-items: center; justify-content: left; gap: 10px;">
                        <div style="display: flex; flex-direction: column; justify-content: center; align-items: start; border-radius: 3px;">
                            <label style="white-space: nowrap; margin-right: 2vw; font-size: 1.5vw;">GERAL</label>
                            <label style="white-space: nowrap; font-size: 2vw;" id="total_geral"></label>
                        </div>

                        <img src="imagens/direita.png">

                        <div
                            style="cursor: pointer; display: flex; flex-direction: column; align-items: start; justify-content: center; gap: 10px; border-radius: 3px; padding: 5px;">
                            <label style="font-size: 1em;">Tabela de preço</label>
                            <select id="lpu" onchange="alterarTabelaLPU(this.value)"
                                style="width: 15vw; background-color: white; border-radius: 3px; padding: 5px; color: #222;">
                            </select>
                        </div>
                    </div>

                </div>

                <div id="desconto_total"></div>

            </div>

            <br>

            <div id="tabelas"></div>
            <div id="tabelaItens"></div>

        </div>

    </div>

    <div id="orcamento_livre"></div>
    `

    dados_clientes = await recuperarDados('dados_clientes') || {}
    tela.innerHTML = acumulado
    criarMenus('criarOrcamentos')
    await atualizarPrecos()
}

async function atualizarPrecos() {

    overlayAguarde()

    await sincronizarDados('dados_composicoes')

    removerOverlay()

    const orcamentoBase = baseOrcamento()

    if (orcamentoBase?.lpu_ativa == 'MODALIDADE LIVRE') return await carregar_layout_modalidade_livre()

    if (orcamentoBase?.id && orcamentoBase?.edicaoAntigos == undefined) {

        return popup(`
            <div style="width: 40vw; background-color: #d2d2d2; padding: 2vw; flex-direction: column; display: flex; gap: 5px;">

                <p style="text-align: left;">
                    A partir de agora você pode decidir se quer editar este orçamento 
                    considerando os preços de <strong>quando o orçamento foi feito</strong>, ou se prefere atualizar 
                    os preços dos produtos com base na tabela atual:
                </p>

                ${botao('Atualizar os preços', `removerPopup(); manterPrecosAntigos(false)`, 'green')}

                ${botao('Manter os preços antigos', `removerPopup(); manterPrecosAntigos(true)`, '')}

                 <p style="text-align: left;">
                    Se quiser manter os preços antigos, mas quer atualizar determinados itens, escolha <strong>Manter os preços antigos</strong>
                    e altere o preço individualmente clicando no ícone <img src="imagens/atrasado.png" style="width: 1.5vw;">
                 </p>

            </div>
            `, 'Alerta')
    }

    await atualizarOpcoesLPU()

}

async function manterPrecosAntigos(resposta) {

    let orcamentoBase = baseOrcamento()
    dados_composicoes = await recuperarDados('dados_composicoes')
    const lpu = String(orcamentoBase.lpu_ativa).toLocaleLowerCase()

    for ([codigo, produto] of Object.entries(orcamentoBase.dados_composicoes)) {

        const precos = dados_composicoes?.[codigo]?.[lpu] || { ativo: 0, historico: { 0: { valor: 0 } } }
        const ativo = precos.ativo
        const historico = precos.historico
        const preco = historico[ativo].valor

        if (produto.custo !== preco) produto.antigo = resposta
    }

    orcamentoBase.edicaoAntigos = resposta

    baseOrcamento(orcamentoBase)

    await atualizarOpcoesLPU()

}

function reabrirOrcamento() {
    let orcamentoBase = baseOrcamento()

    if (orcamentoBase.id) {
        localStorage.setItem('reabrirOrcamento', JSON.stringify(orcamentoBase.id))
    }
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

    let lpu = document.getElementById('lpu')
    if (lpu) lpu.innerHTML = LPUS.map(lpu => `<option ${orcamentoBase?.lpu_ativa == lpu ? 'selected' : ''}>${lpu}</option>`).join('')

    orcamentoBase.lpu_ativa = lpu.value
    baseOrcamento(orcamentoBase)

    await tabelaProdutosOrcamentos()
    await carregarTabelasOrcameneto()

}

async function alterarTabelaLPU(tabelaLPU) {
    document.getElementById('lpu').value = tabelaLPU
    let orcamentoBase = baseOrcamento()
    orcamentoBase.lpu_ativa = tabelaLPU
    baseOrcamento(orcamentoBase)
    await tabelaProdutosOrcamentos()
    await carregarTabelasOrcameneto()
}

async function carregarTabelasOrcameneto() {

    dados_composicoes = await recuperarDados('dados_composicoes')
    const orcamentoBase = baseOrcamento()
    const dadosComposicoes = orcamentoBase?.dados_composicoes || {}
    const divTabelas = document.getElementById('tabelas')

    const tabela = `
        <div>
            <table class="tabela-orcamento">
                <thead id="theadOrcamento" style="background-color: ${coresTabelas()};">
                    <th>Código</th>
                    <th>Descrição</th>
                    <th>Medida</th>
                    <th>Quantidade</th>
                    <th>Custo Unitário</th>
                    <th>Desconto</th>
                    <th>Valor total</th>
                    <th>Imagem</th>
                    <th>Remover</th>
                </thead>
                <tbody id="bodyOrcamento"></tbody>
            </table>
        </div>
        `

    divTabelas.innerHTML = `
        <div class="toolbarSuperior"></div>
        ${tabela}`

    Object.entries(dadosComposicoes)
        .sort(([, a], [, b]) => (a.ordem ?? Infinity) - (b.ordem ?? Infinity))
        .forEach(([codigo, produto]) => {
            carregarLinhaOrcamento(codigo, produto);
        });

    await totalOrcamento()

}

function carregarLinhaOrcamento(codigo, produto) {

    const opcoes = ['Dinheiro', 'Porcentagem', 'Venda Direta']
        .map(op => `<option ${produto?.tipo_desconto == op ? 'selected' : ''}>${op}</option>`).join('')

    const tds = `
        <td>${codigo}</td>
        <td>${produto?.descricao || 'N/A'}</td>
        <td>${produto?.unidade || 'UN'}</td>
        <td>
            <input oninput="totalOrcamento()" type="number" class="campoValor" value="${produto.qtde}">
        </td>
        <td></td>
        <td>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                <select onchange="totalOrcamento()" style="padding: 5px; border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">
                    ${opcoes}
                </select>
                <input type="number" oninput="totalOrcamento()" style="padding-bottom: 5px; padding-top: 5px; border-bottom-left-radius: 3px; border-bottom-right-radius: 3px;" value="${produto?.desconto || ''}">
            </div>
        </td>
        <td></td>
        <td>
            <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
        </td>
        <td>
            <img src="imagens/excluir.png" onclick="removerItemOrcamento('${codigo}', this)" style="cursor: pointer; width: 2vw;">
        </td>
    `

    const trExistente = document.getElementById(`ORCA_${codigo}`)
    if (trExistente) return trExistente.innerHTML = tds

    const linha = `
        <tr draggable="true" 
            ondragstart="iniciarArraste(event)"
            ondragover="permitirSoltar(event)"
            ondrop="soltar(event)"
            id="ORCA_${codigo}"
            data-tipo="${produto.tipo}"
            data-codigo="${codigo}">
            ${tds}
        </tr>
    `
    document.getElementById('bodyOrcamento').insertAdjacentHTML('beforeend', linha)
}

function iniciarArraste(e) {
    e.dataTransfer.setData("text/plain", e.target.id);
}

function soltar(e) {
    e.preventDefault();
    const linhaId = e.dataTransfer.getData("text/plain");
    const linhaArrastada = document.getElementById(linhaId);
    const linhaDestino = e.currentTarget;

    const tbody = document.getElementById('bodyOrcamento');
    tbody.insertBefore(linhaArrastada, linhaDestino);
    totalOrcamento()
}

function permitirSoltar(e) {
    e.preventDefault();
}

async function removerItemOrcamento(codigo, img) {

    let orcamentoBase = baseOrcamento()
    delete orcamentoBase.dados_composicoes[codigo]
    baseOrcamento(orcamentoBase)

    img.parentElement.parentElement.remove()

    const prod = document.getElementById(`prod_${codigo}`)
    if (prod) prod.value = ''

    await totalOrcamento()

}

async function enviarDadosOrcamento() {
    let orcamentoBase = baseOrcamento()
    orcamentoBase.origem = origem

    if (!orcamentoBase.dados_orcam) {
        return popup(mensagem('Preencha os dados do Cliente'), 'Alerta')
    }

    const dados_orcam = orcamentoBase.dados_orcam;

    if (dados_orcam.cliente_selecionado === '') return popup(mensagem('Cliente em branco'), 'Alerta')

    if (dados_orcam.contrato === '') return popup(mensagem('Chamado em branco'), 'Alerta')

    if (dados_orcam.contrato == 'sequencial') {
        const resposta = await proxORC({ sequencial: true })
        if(resposta.err) return popup(mensagem(resposta.err), 'Alerta', true)
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

async function recuperarComposicoesOrcamento() {

    await sincronizarDados('dados_composicoes')
    await tabelaProdutosOrcamentos()

}

async function tabelaProdutosOrcamentos() {

    let permissoes = ['adm', 'log', 'editor', 'gerente', 'diretoria', 'coordenacao']
    moduloComposicoes = permissoes.includes(acesso.permissao)
    let colunas = ['Código', 'Descrição', 'Sistema', 'Unidade', 'Quantidade', 'Valor', 'Imagem']
    let ths = ''
    let tsh = ''

    colunas.forEach((col, i) => {
        ths += `<th style="color: white;">${col}</th>`
        tsh += `<th style="text-align: left; color: #222; padding: 8px; background-color: #dedede;" oninput="pesquisarProdutos(${i}, this.textContent)" contentEditable="true"></th>`
    })

    const toolbar = ['TODOS', ...esquemas.tipo]
        .map(op => `<label class="menu_top" style="background-color: ${coresTabelas(op)};" onclick="filtrarTabelaComposicao('${op}')">${op}</label>`)
        .join('')

    const tabela = `
        <table class="tabela-orcamento">
            <thead id="theadComposicoes" style="background-color: ${coresTabelas(null)};">
                <tr>${ths}</tr>
                <tr>${tsh}</tr>
            </thead>
            <tbody id="bodyComposicoes"></tbody>
        </table>
    `

    const botoes = `
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
            onclick="recuperarComposicoesOrcamento()">
            <img src="imagens/atualizar_2.png" style="width: 2vw; cursor: pointer;">
            <label style="color: white; cursor: pointer; font-size: 1.0vw;">Atualizar</label>
        </div>

        ${moduloComposicoes
            ? `<div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
            onclick="cadastrarItem()">
            <img src="imagens/add.png" style="width: 2vw; cursor: pointer;">
            <label style="color: white; cursor: pointer; font-size: 1.0vw;">Criar Item</label>
        </div>`
            : ''}
        `

    const acumulado = `
        <div style="position: relative; display: flex; justify-content: center; width: 100%; margin-top: 30px; gap: 10px;">
            ${toolbar}
            ${botoes}
        </div>

        <div class="bloco-itens">
            ${tabela}
        </div>
        `
    const bodyComposicoes = document.getElementById('bodyComposicoes')
    if (!bodyComposicoes) document.getElementById('tabelaItens').innerHTML = acumulado

    // Carregamentos dos itens;
    const orcamentoBase = baseOrcamento()
    const composicoesOrcamento = orcamentoBase.dados_composicoes || {}

    dados_composicoes = await recuperarDados('dados_composicoes') || {}
    for (const [codigo, produto] of Object.entries(dados_composicoes)) {
        const lpu = String(orcamentoBase.lpu_ativa).toLocaleLowerCase()
        const qtdeOrcada = composicoesOrcamento?.[codigo]?.qtde || ''
        linhasComposicoesOrcamento(codigo, produto, qtdeOrcada, lpu)
    }

}

function filtrarTabelaComposicao(tipo) {

    tipoAtivo = tipo
    const tbody = document.getElementById('bodyComposicoes')
    const trs = tbody.querySelectorAll('tr')
    const theadComposicoes = document.getElementById('theadComposicoes')
    theadComposicoes.style.backgroundColor = coresTabelas(tipo)

    for (const tr of trs) {
        tr.style.display = (tipo == 'TODOS' || tr.dataset.tipo == tipo) ? 'table-row' : 'none'
    }

}

function pesquisarProdutos(colunaPesq, pesquisa) {

    filtrosPagina[colunaPesq] = pesquisa.toLowerCase();

    const tbody = document.getElementById('bodyComposicoes');
    const trs = tbody.querySelectorAll('tr');

    for (const tr of trs) {
        const tds = tr.querySelectorAll('td');
        let mostrarLinha = true;

        for (const [col, texto] of Object.entries(filtrosPagina)) {
            const input = tds[col].querySelector('input, textarea, select');
            const conteudoCelula = input ? input.value : tds[col].textContent;
            const textoCampo = String(conteudoCelula).toLowerCase()
            const textoFiltro = String(texto).toLowerCase()

            if (!textoCampo.includes(textoFiltro)) {
                mostrarLinha = false;
                break;
            }
        }

        const tipoTabela = (tipoAtivo == 'TODOS' || tr.dataset.tipo == tipoAtivo)
        tr.style.display = (tipoTabela && mostrarLinha) ? '' : 'none';
    }
}

function linhasComposicoesOrcamento(codigo, produto, qtdeOrcada, lpu) {

    if (origem !== produto.origem) return
    if (!produto.tipo) return

    let preco = 0
    let ativo = 0
    let historico = 0

    if (produto[lpu] && produto[lpu].ativo && produto[lpu].historico) {
        ativo = produto[lpu].ativo
        historico = produto[lpu].historico
        preco = historico[ativo]?.valor || 0
    }

    if (produto.status == "INATIVO") return

    const opcoes = esquemas.sistema
        .map(op => `<option ${produto?.sistema == op ? 'selected' : ''}>${op}</option>`)
        .join('')

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
            <td>
                <select class="opcoesSelect" onchange="alterarChave('${codigo}', 'sistema', this)">
                    ${opcoes}
                </select>
            </td>
            <td>${produto.unidade}</td>
            <td>
                <input id="prod_${codigo}" value="${qtdeOrcada}" type="number" class="campoValor" oninput="incluirItem('${codigo}', this.value)">
            </td>
            <td>
                <label ${moduloComposicoes ? `onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')"` : ''} class="label-estoque" style="background-color: ${preco > 0 ? '#4CAF50bf' : '#b36060bf'}">${dinheiro(preco)}</label>
            </td>
            <td>
                <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 5vw; cursor: pointer;">
            </td>
        `

    const trExistente = document.getElementById(codigo)
    if (trExistente) return trExistente.innerHTML = tds
    const linha = `
        <tr 
        data-tipo="${produto.tipo}"
        id="${codigo}">
            ${tds}
        </tr>
    `
    document.getElementById('bodyComposicoes').insertAdjacentHTML('beforeend', linha)

}

async function totalOrcamento() {

    let orcamentoBase = baseOrcamento()
    let lpu = String(orcamentoBase.lpu_ativa).toLowerCase()
    const carrefour = orcamentoBase.lpu_ativa == 'LPU CARREFOUR'
    let totais = { GERAL: { valor: 0, bruto: 0 } }
    let avisoDesconto = 0
    let totalAcrescido = 0
    let descontoAcumulado = 0

    let cliente = dados_clientes?.[orcamentoBase.dados_orcam?.omie_cliente] || ''
    let estado = cliente.estado || false

    if (!orcamentoBase.dados_composicoes) orcamentoBase.dados_composicoes = {}

    const bodyOrcamento = document.getElementById('bodyOrcamento')
    const trs = bodyOrcamento.querySelectorAll('tr')

    let ordem = 1
    for (const tr of trs) {

        const tds = tr.querySelectorAll('td')
        let codigo = tr.dataset.codigo

        if (!orcamentoBase.dados_composicoes[codigo]) orcamentoBase.dados_composicoes[codigo] = {}

        let refProduto = dados_composicoes[codigo]

        if (!totais[refProduto.tipo]) totais[refProduto.tipo] = { valor: 0 }

        let valorUnitario = 0
        let total = 0

        // Caso o item não exista, traga os dados dele no orçamento;
        if (!refProduto) refProduto = orcamentoBase.dados_composicoes[codigo]

        let icmsSaida = 0
        let itemSalvo = orcamentoBase.dados_composicoes[codigo]
        itemSalvo.codigo = codigo

        // Ordem
        itemSalvo.ordem = ordem
        ordem++

        // ATUALIZAÇÃO DE INFORMAÇÕES DA COLUNA 4 EM DIANTE
        if (carrefour) {
            if (refProduto.substituto && refProduto.substituto !== '') {
                codigo = refProduto.substituto == '' ? codigo : refProduto.substituto
            }

            tds[1].textContent = `
            <td>
                <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
                    <img src="imagens/carrefour.png" style="width: 3vw;">
                    <label>${refProduto.descricaocarrefour}</label>
                </div>
            </td>`
        }

        let precos = { custo: 0, lucro: 0 }
        const ativo = refProduto?.[lpu]?.ativo || 0
        const historico = refProduto?.[lpu]?.historico || {}
        precos = historico[ativo]

        // Caso o itemSalvo.antigo exista, então não se deve mexer no valor dele;
        valorUnitario = itemSalvo.antigo ? itemSalvo.custo : historico?.[ativo]?.valor || 0

        icmsSaida = precos?.icms_creditado == 4 ? 4 : estado == 'BA' ? 20.5 : 12

        if (itemSalvo.alterado) valorUnitario = itemSalvo.custo

        const quantidade = Number(tds[3].querySelector('input').value)

        valorUnitario += total
        let totalLinha = valorUnitario * quantidade
        let desconto = 0
        let tipoDesconto;
        let valorDesconto;

        let divDesconto = tds[5].querySelector('div')
        tipoDesconto = divDesconto.querySelector('select')
        valorDesconto = divDesconto.querySelector('input')

        if (itemSalvo.custo_original) {
            valorDesconto.value = ''
            desconto = 0
        }

        divDesconto.style.display = itemSalvo.custo_original ? 'none' : 'flex'

        if (valorDesconto.value != '') {

            if (tipoDesconto.value == 'Porcentagem') {

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

        const imagem = refProduto?.imagem || logo
        const icmsSaidaDecimal = icmsSaida / 100
        const valorLiqSemICMS = valorUnitario - (valorUnitario * icmsSaidaDecimal)
        const valorTotSemICMS = totalLinha - (totalLinha * icmsSaidaDecimal)

        const labelValores = (valor, semIcms, percentual, unitario) => {
            let labelICMS = ''
            if (refProduto.tipo == 'VENDA' && estado) labelICMS = `<label style="white-space: nowrap;">SEM ICMS ${dinheiro(semIcms)} [ ${percentual}% ]</label>`
            return `
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 5px;">
                        <label ${valor > 0 ? 'class="input_valor">' : `class="label-estoque" style="background-color: #b36060bf">`} ${dinheiro(valor)}</label>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                            ${(unitario && itemSalvo.antigo !== undefined) ? `<img onclick="gerenciarPrecoAntigo('${codigo}')" src="imagens/atrasado.png" style="cursor: pointer; width: 1.5vw;">` : ''}
                            ${unitario ? `<img onclick="alterarValorUnitario('${codigo}')" src="imagens/ajustar.png" style="cursor: pointer; width: 1.5vw;">` : ''}
                        </div>
                    </div>
                    ${labelICMS}
                </div>
                `
        }

        tds[1].textContent = refProduto.descricao
        tds[2].textContent = refProduto?.unidade || 'UN'
        tds[4].innerHTML = labelValores(valorUnitario, valorLiqSemICMS, icmsSaida, true)
        tds[6].innerHTML = labelValores(totalLinha, valorTotSemICMS, icmsSaida)

        itemSalvo.descricao = refProduto.descricao
        itemSalvo.unidade = refProduto?.unidade || 'UN'
        if (carrefour) itemSalvo.descricaocarrefour = refProduto.descricaocarrefour
        itemSalvo.qtde = quantidade
        itemSalvo.custo = valorUnitario
        itemSalvo.tipo = refProduto.tipo
        itemSalvo.imagem = imagem

        // Refletir a quantidade na tabela de baixo;
        const inputProduto = document.getElementById(`prod_${codigo}`)
        if (inputProduto) inputProduto.value = quantidade

        if (!carrefour && Number(valorDesconto.value) !== 0) {
            itemSalvo.tipo_desconto = tipoDesconto.value
            itemSalvo.desconto = Number(valorDesconto.value)
        } else {
            delete itemSalvo.tipo_desconto
            delete itemSalvo.desconto
        }
    }

    const painel_desconto = document.getElementById('desconto_total')
    const diferencaDinheiro = totais.GERAL.valor - totais.GERAL.bruto
    const diferencaPorcentagem = diferencaDinheiro == 0 ? 0 : (diferencaDinheiro / totais.GERAL.bruto * 100).toFixed(2)

    painel_desconto.innerHTML = `
        <div class="resumo">
            <label>RESUMO</label>
            <hr style="width: 100%;">
            <label>total Bruto</label>
            <label style="font-size: 1.5vw;">${dinheiro(totais.GERAL.bruto)}</label>
            <label>Diferença R$</label>
            <label style="font-size: 1.5vw;">${dinheiro(diferencaDinheiro)}</label>
            <label>Diferença %</label>
            <label style="font-size: 1.5vw;" id="diferenca">${diferencaPorcentagem}%</label>
            <input style="display: none" value="${diferencaPorcentagem}">
        </div>`

    // Informações complementares do orçamento;
    totalAcrescido > 0 ? orcamentoBase.total_acrescido = totalAcrescido : delete orcamentoBase.total_acrescido
    descontoAcumulado > 0 ? orcamentoBase.total_desconto = descontoAcumulado : delete orcamentoBase.total_desconto
    orcamentoBase.total_geral = totais.GERAL.valor
    orcamentoBase.total_bruto = totais.GERAL.bruto

    baseOrcamento(orcamentoBase)

    document.getElementById('total_geral').textContent = dinheiro(totais.GERAL.valor)
    const toolbarSuperior = document.querySelector('.toolbarSuperior')
    for (const [tabela, dados] of Object.entries(totais)) {
        const id = `toolbar_${tabela}`
        const toolbar = `
            <span>${tabela}</span>
            <span style="font-size: 0.9rem;">${dinheiro(dados.valor)}</span>
        `
        const toolbarTipo = document.getElementById(id)
        if (toolbarTipo) {
            toolbarTipo.innerHTML = toolbar
            continue
        }

        toolbarSuperior.insertAdjacentHTML('beforeend',
            `<div onclick="filtrarOrcamento(this)" id="${id}" data-tipo="${tabela}" style="background-color: ${coresTabelas(tabela)}" class="menu_top">
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
            filtrarOrcamento({ dataset: { tipo: 'GERAL' } })
        }
    }

    // Visibilidade Tabela;
    const tabelas = document.getElementById('tabelas')
    const quieto = document.querySelector('.quieto')
    if (quieto) quieto.remove()

    if (Object.keys(orcamentoBase.dados_composicoes).length == 0) {
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

}

function filtrarOrcamento(div) {
    const tipo = div.dataset.tipo
    const tbody = document.getElementById('bodyOrcamento')
    const trs = tbody.querySelectorAll('tr')
    document.getElementById('theadOrcamento').style.backgroundColor = coresTabelas(tipo)

    for (const tr of trs) {
        tr.style.display = (tipo == 'GERAL' || tr.dataset.tipo == tipo) ? 'table-row' : 'none'
    }

}

async function gerenciarPrecoAntigo(codigo) {

    const orcamentoBase = baseOrcamento()
    const produto = orcamentoBase.dados_composicoes[codigo]

    let acumulado = `
        <div style="padding: 2vw; background-color: #d2d2d2; display: flex; justify-content: center; align-items: center; gap: 2vw;">

            <img src="${produto.imagem}" style="width: 10vw; border-radius: 2px;">

            <div style="display: flex; flex-direction: column; justify-content: start; align-items: start; gap: 5px;">
                <label>${produto.descricao}</label>

                ${botao('Atualizar preço?', `alterarPrecoAntigo('${codigo}', false)`, 'green')}
                ${botao('Recuperar o preço antigo?', `alterarPrecoAntigo('${codigo}', true)`)}
            </div>

        </div>
    `

    popup(acumulado, 'GERENCIAR PREÇO')
}

async function alterarPrecoAntigo(codigo, resposta) {

    overlayAguarde()
    let orcamentoBase = baseOrcamento()

    if (resposta) {

        const dados_orcamentos = await recuperarDados('dados_orcamentos')
        const composicoes = dados_orcamentos[orcamentoBase.id].dados_composicoes
        orcamentoBase.dados_composicoes[codigo].custo = composicoes[codigo].custo

    }

    orcamentoBase.dados_composicoes[codigo].antigo = resposta

    baseOrcamento(orcamentoBase)

    await totalOrcamento()

    removerPopup()

}

async function alterarValorUnitario(codigo) {

    let produto = dados_composicoes[codigo]
    let lpu = String(document.getElementById('lpu').value).toLowerCase()

    if (lpu == 'lpu carrefour') return popup(mensagem('Carrefour não permite mudanças de valores'), 'AVISO')

    let ativo = produto?.[lpu]?.ativo || 0
    let historico = produto?.[lpu]?.historico || {}
    let precoOriginal = historico?.[ativo]?.valor || 0

    let acumulado = `
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
            <label onclick="confirmarNovoPreco('${codigo}', ${precoOriginal}, 'remover')" style="text-align: left; text-decoration: underline; cursor: pointer;">Deseja retornar ao preço original?</label>
            <hr style="width: 100%;">
            <label style="text-align: left;">Serão aceitos valores maiores que o preço original</label>
            <button style="background-color: green;" onclick="confirmarNovoPreco('${codigo}', ${precoOriginal}, 'incluir')">Confirmar</button>
        </div>
    </div>
    `

    popup(acumulado, 'ALTERAR PREÇO')

}

async function confirmarNovoPreco(codigo, precoOriginal, operacao) {

    let orcamento = baseOrcamento()
    let item = orcamento.dados_composicoes[codigo]

    if (operacao == 'incluir') {
        let valor = Number(document.getElementById('novoValor').value)

        if (precoOriginal >= valor) return popup(mensagem('O valor precisa ser maior que o Original'), 'AVISO', true)
        orcamento.alterado = true
        item.custo_original = precoOriginal
        item.custo = valor
        item.alterado = true

    } else if (operacao == 'remover') {
        delete orcamento.alterado
        delete item.custo_original
        delete item.alterado
    }

    baseOrcamento(orcamento)
    await totalOrcamento()
    removerPopup()
}

async function incluirItem(codigo, novaQuantidade) {
    let orcamentoBase = baseOrcamento()
    let carrefour = orcamentoBase.lpu_ativa == 'LPU CARREFOUR'
    let produto = dados_composicoes[codigo]

    let linha = `
        <tr>
            <td>${codigo}</td>
            <td style="position: relative;">
                ${produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0 ?
            `<div style="display: flex; align-items: center; gap: 5px;">
                        <img src="gifs/lampada.gif" style="width: 15px;" title="Item com agrupamentos">
                        <span>${produto?.descricao || 'N/A'}</span>
                    </div>
                    <div style="font-size: 0.8em; color: #4CAF50; font-style: italic;">
                        Kit com ${Object.keys(produto.agrupamentos).length} itens
                    </div>`
            :
            `${produto?.descricao || 'N/A'}`
        }
            </td>
            ${carrefour ? `<td></td>` : ''}
            <td style="text-align: center;">${produto?.unidade}</td>
            <td style="text-align: center;">
                <input oninput="totalOrcamento()" type="number" class="campoValor" value="${novaQuantidade}">
            </td>
            <td style="position: relative;"></td>

            ${!carrefour ?
            `<td>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                    <select onchange="totalOrcamento()" class="desconto-cima">
                        <option>Porcentagem</option>
                        <option>Dinheiro</option>
                    </select>
                    <input type="number" oninput="totalOrcamento()" class="desconto-baixo" value="${produto?.desconto || ''}">
                </div>
            </td>` : ''}

            <td></td>
            <td style="text-align: center;">
                <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
            </td>
            <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItemOrcamento('${codigo}', this)" style="cursor: pointer; width: 2vw;"></td>
        </tr>
    `

    if (itemExistente(produto.tipo, codigo, novaQuantidade)) {

        let tbody = document.getElementById(`linhas_${produto.tipo}`)

        if (!tbody) { // Lançamento do 1º Item de cada tipo;

            if (!orcamentoBase.dados_composicoes) {
                orcamentoBase.dados_composicoes = {}
            }

            orcamentoBase.dados_composicoes[codigo] = {
                codigo: codigo,
                qtde: parseFloat(novaQuantidade),
                tipo: produto?.tipo,
                unidade: produto?.unidade || 'UN',
                custo: 0,
                descricao: produto?.descricao
            }

            baseOrcamento(orcamentoBase)
            return carregarTabelasOrcameneto()

        } else {
            tbody.insertAdjacentHTML('beforeend', linha)
        }
    }

    await totalOrcamento()
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

            let inputQuantidade = tds[3 + acrescimo].querySelector('input')
            let novaQuantidadetotal = parseFloat(quantidade)

            inputQuantidade.value = novaQuantidadetotal

            if (orcamentoBase.dados_composicoes[codigo]) {
                orcamentoBase.dados_composicoes[codigo].qtde = novaQuantidadetotal
                baseOrcamento(orcamentoBase)
            }
        }
    })

    return incluir
}

function excluir_levantamento(chave) {
    let orcamentoBase = baseOrcamento()

    if (orcamentoBase.levantamentos) {
        delete orcamentoBase.levantamentos[chave]

        baseOrcamento(orcamentoBase)
    }
}
