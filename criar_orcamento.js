let filtrosPagina = {}
let pagina;
let dados_composicoes = {}
let tabelaAtiva;

function coresTabelas(tabela) {
    let coresTabelas = {
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
        <div style="display: flex; flex-direction: column; align-items: center; margin: 2vw;">
            <label>Tem certeza que deseja apagar o Orçamento?</label>
            <button onclick="confirmarExclusao()" style="background-color: green;">Confirmar</button>
        </div>
        `, 'Atenção')

}

atualizarPrecos()

async function atualizarPrecos() {
    let orcamentoBase = baseOrcamento()

    let modalidade = orcamentoBase.lpu_ativa

    if (modalidade == 'MODALIDADE LIVRE') return await carregar_layout_modalidade_livre()

    if (orcamentoBase.id) {

        popup(`
            <div style="background-color: #d2d2d2; padding: 2vw; flex-direction: column; display: flex; gap: 5px;">

                <label>Você quer manter os valores antigos deste orçamento ou deseja atualizar tudo?</label>

                ${botao('Atualizar os preços', `removerPopup(); atualizarOpcoesLPU()`, 'green')}

                ${botao('Manter os preços antigos', `removerPopup(); manterPrecosAntigos()`, '')}

            </div>
            `, 'ATENÇÃO')
    }

}

async function manterPrecosAntigos() {

    let orcamentoBase = baseOrcamento()

    for ([codigo, produto] of Object.entries(orcamentoBase.dados_composicoes)) {
        produto.antigo = true
    }

    baseOrcamento(orcamentoBase)

    await atualizarOpcoesLPU()

}

function fecharIrOrcamento() {
    location.href = 'orcamentos.html'
}

function reabrirOrcamento() {
    let orcamentoBase = baseOrcamento()

    if (orcamentoBase.id) {
        localStorage.setItem('reabrirOrcamento', JSON.stringify(orcamentoBase.id))
    }
}

function confirmarExclusao() {
    baseOrcamento(undefined, true)
    location.href = 'criar_orcamento.html'
    removerPopup()
}

async function atualizarOpcoesLPU() {

    dados_composicoes = await recuperarDados('dados_composicoes') || {}

    let LPUS = [];
    let orcamentoBase = baseOrcamento()
    LPUS = [
        ...new Set(
            Object.values(dados_composicoes)
                .flatMap(obj => Object.keys(obj))
                .filter(key => key.toLowerCase().includes('lpu'))
                .map(key => key.toUpperCase())
        )
    ]

    let lpu = document.getElementById('lpu')

    if (lpu.value !== '') {
        orcamentoBase.lpu_ativa = lpu.value
        baseOrcamento(orcamentoBase)
    }

    if (lpu) lpu.innerHTML = LPUS.map(lpu => `<option ${orcamentoBase?.lpu_ativa == lpu ? 'selected' : ''}>${lpu}</option>`).join('')

    await tabelaProdutos()
    await carregarTabelas()

}

async function alterarTabelaLPU(tabelaLPU) {
    document.getElementById('lpu').value = tabelaLPU
    let orcamentoBase = baseOrcamento()
    orcamentoBase.lpu_ativa = tabelaLPU
    baseOrcamento(orcamentoBase)
    await tabelaProdutos()
    await carregarTabelas()
}

async function filtroTabela(filtro) {
    localStorage.setItem('padraoFiltro', filtro)
    await carregarTabelas()
}

async function carregarTabelas() {
    let baseComposicoes = await recuperarDados('dados_composicoes') || {}
    let orcamentoBase = baseOrcamento()
    let carrefour = orcamentoBase.lpu_ativa == 'LPU CARREFOUR'
    let divTabelas = document.getElementById('tabelas')
    let tabelas = {}
    let toolbarSuperior = ''
    let stringsTabelas = ''
    let dadosComposicoes = orcamentoBase.dados_composicoes
    let padraoFiltro = localStorage.getItem('padraoFiltro')

    if (padraoFiltro == null) {
        padraoFiltro = 'tipo'
        localStorage.setItem('padraoFiltro', 'tipo')
    }

    document.getElementById(`filtro${padraoFiltro}`).checked = true

    for (codigo in dadosComposicoes) {
        let produto = dadosComposicoes[codigo]

        let opcoes = ''
        esquemas.sistema.forEach(op => {
            opcoes += `<option ${produto?.sistema == op ? 'selected' : ''}>${op}</option>`
        })

        let linha = `
        <tr>
            <td>${codigo}</td>
            <td style="position: relative;">${produto?.descricao || 'N/A'}</td>
            ${carrefour ? '<td></td>' : ''}
            <td style="text-align: center;">${produto?.unidade || 'UN'}</td>
            <td style="text-align: center;">
                <input oninput="total()" type="number" class="campoValor" value="${produto.qtde}">
            </td>
            <td style="position: relative;"></td>

            ${carrefour
                ? ''
                : `
                <td>
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                        <select onchange="total()" style="padding: 5px; border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">
                            <option ${produto?.tipo_desconto == 'Porcentagem' ? 'selected' : ''}>Porcentagem</option>
                            <option ${produto?.tipo_desconto == 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                        </select>
                        <input type="number" oninput="total()" style="padding-bottom: 5px; padding-top: 5px; border-bottom-left-radius: 3px; border-bottom-right-radius: 3px;" value="${produto?.desconto || ''}">
                    </div>
                </td>
                `}
            <td></td>
            <td style="text-align: center;">
                <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
            </td>
            <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${codigo}', this)" style="cursor: pointer; width: 2vw;"></td>
        </tr>
        `
        let chave = baseComposicoes[codigo]?.[padraoFiltro] || 'SEM CLASSIFICAÇÃO'
        if (!tabelas[chave]) {
            tabelas[chave] = { linhas: '' }
        }

        tabelas[chave].linhas += linha
    }

    for (let tabela in tabelas) {

        toolbarSuperior += `
            <div id="toolbar_${tabela}" onclick="mostrarTabela('${tabela}')" class="toolbar" style="background-color: ${coresTabelas(tabela)};">
                <label style="position: absolute; top: 0; margin-right: 5px; font-size: 0.8vw;">${tabela}</label>
                <label id="total_${tabela}" style="font-size: 1.5vw; padding-top: 2vh;">R$ -- </label>
            </div>
        `

        stringsTabelas += `
        <div id="${tabela}" style="display: none; width: 100%;">
            <table id="cabecalho_${tabela}" class="tabela" style="table-layout: auto; width: 100%;">
                <thead id="thead_${tabela}" style="background-color: ${coresTabelas(tabela)};">
                    <th style="color: white;">Código</th>
                    ${carrefour ? '<th style="color: white;">Item Original</th>' : ''}
                    <th style="color: white;">${orcamentoBase.lpu_ativa}</th>
                    <th style="color: white;">Medida</th>
                    <th style="color: white;">Quantidade</th>
                    <th style="color: white;">Custo Unitário</th>
                    ${!carrefour ? `<th style="color: white;">Desconto</th>` : ''}
                    <th style="color: white;">Valor Total</th>
                    <th style="color: white;">Imagem *Ilustrativa</th>
                    <th style="color: white;">Remover</th>
                </thead>
                <tbody id="linhas_${tabela}">
                    ${tabelas[tabela].linhas}
                </tbody>
            </table>
        </div>
        `
    }

    divTabelas.innerHTML = `
        <div id="toolbarSuperior" style="display: none; justify-content: right; width: 100%;">
            ${toolbarSuperior}
        </div>
        ${stringsTabelas}`


    await total()
    mostrarTabela(Object.keys(tabelas)[0])
}

function mostrarTabela(tabela) {
    if (tabela) tabelaAtiva = tabela
    let divTabelas = document.getElementById('tabelas')
    let tabelas = divTabelas.querySelectorAll('table')

    if (!document.getElementById(tabela)) { // Caso a tabela não exista, passa para a próxima;

        if (!tabelas[0]) return // Quer dizer que não existe nenhuma tabela;
        tabelaAtiva = String(tabelas[0].id).split('_')[1]

    }

    tabelas.forEach(tab => {
        tab.parentElement.style.display = 'none'
    })

    let displayTabela = document.getElementById(tabelaAtiva)
    displayTabela.style.display == 'none' ? displayTabela.style.display = 'flex' : ''

    let toolbarSuperior = document.getElementById('toolbarSuperior')
    let divs = toolbarSuperior.querySelectorAll('div')

    divs.forEach(div => {
        div.style.opacity = '0.7'
    })

    document.getElementById(`toolbar_${tabelaAtiva}`).style.opacity = '1'
}

async function removerItem(codigo, img) {

    let orcamentoBase = baseOrcamento()
    delete orcamentoBase.dados_composicoes[codigo]
    baseOrcamento(orcamentoBase)

    img.parentElement.parentElement.remove()

    await total()

}

async function enviarDados() {
    let orcamentoBase = baseOrcamento()

    if (!orcamentoBase.dados_orcam) {
        return popup(avisoHTML('Preencha os dados do Cliente'), 'ALERTA')
    }

    let dados_orcam = orcamentoBase.dados_orcam;
    let chamado = dados_orcam.contrato

    if (dados_orcam.cliente_selecionado === '') {
        return popup(avisoHTML('Cliente em branco'), 'ALERTA')
    }

    if (chamado === '') {
        return popup(avisoHTML('Chamado em branco'), 'ALERTA')
    }

    let existente = await verificar_chamado_existente(chamado, orcamentoBase.id, false)

    if (chamado !== 'sequencial' && existente?.situacao) {
        return popup(avisoHTML('Chamado já Existente'), 'ALERTA')
    }

    if (chamado.slice(0, 1) !== 'D' && chamado !== 'sequencial' && chamado.slice(0, 3) !== 'ORC') {
        return popup(avisoHTML('Chamado deve começar com D'), 'ALERTA')
    }

    if (dados_orcam.estado === '') {
        return popup(avisoHTML('Estado em branco'), 'ALERTA')
    }

    if (dados_orcam.cnpj === '') {
        return popup(avisoHTML('CNPJ em branco'), 'ALERTA')
    }

    if (orcamentoBase.total_desconto > 0 || orcamentoBase.alterado) {
        orcamentoBase.aprovacao = {
            status: 'pendente',
            usuario: acesso.usuario
        }
    }

    if (orcamentoBase.dados_orcam.contrato == 'sequencial') {
        let sequencial = await verificar_chamado_existente(undefined, undefined, true)
        orcamentoBase.dados_orcam.contrato = `ORC_${sequencial.proximo}`
    }

    if (!orcamentoBase.id) {
        orcamentoBase.id = 'ORCA_' + unicoID();
    }

    popup(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
            <img src="imagens/concluido.png" style="width: 2vw;">
            <label>Aguarde... redirecionando...</label>
        </div>
    `, 'Processando...')

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_orcamentos[orcamentoBase.id] = orcamentoBase
    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${orcamentoBase.id}`, orcamentoBase);

    baseOrcamento(undefined, true)
    location.href = 'orcamentos.html';
}

function pesquisarProdutos(col, elemento) {
    if (!filtrosPagina[pagina]) {
        filtrosPagina[pagina] = {}
    }

    pesquisar_generico(col, elemento.value, filtrosPagina[pagina], `compos_${pagina}`)
}

async function recuperarComposicoes() {

    await sincronizarDados('dados_composicoes')
    await tabelaProdutos()

}

async function ocultarZerados(ocultar) {
    localStorage.setItem('ocultarZerados', JSON.stringify(ocultar))
    await tabelaProdutos()
}

async function tabelaProdutos() {
    let permissoes = ['adm', 'log', 'editor', 'gerente', 'diretoria', 'coordenacao']
    let moduloComposicoes = permissoes.includes(acesso.permissao)

    let tabelas = { TODOS: { linhas: '' } }

    let ocultarZerados = JSON.parse(localStorage.getItem('ocultarZerados'))

    if (ocultarZerados == null) ocultarZerados = true

    let tabela_itens = document.getElementById('tabela_itens')
    let orcamentoBase = baseOrcamento()

    if (tabela_itens) {

        dados_composicoes = await recuperarDados('dados_composicoes') || {}

        if (Object.keys(dados_composicoes) == 0) await recuperarComposicoes()

        for ([codigo, produto] of Object.entries(dados_composicoes)) {

            if (!produto.tipo) continue

            if (!tabelas[produto.tipo]) {
                tabelas[produto.tipo] = { linhas: '' }
            }

            let preco = 0
            let ativo = 0
            let historico = 0
            let lpu;

            if (document.getElementById('lpu')) {
                lpu = String(document.getElementById('lpu').value).toLowerCase()
            } else {
                lpu = String(orcamentoBase.lpu_ativa).toLowerCase()
            }

            if (produto[lpu] && produto[lpu].ativo && produto[lpu].historico) {
                ativo = produto[lpu].ativo
                historico = produto[lpu].historico
                preco = historico[ativo]?.valor || 0
            }

            if (preco == 0 && ocultarZerados) continue

            if (produto.status == "INATIVO") continue

            let td_quantidade = `
                    <input type="number" class="campoValor" oninput="incluirItem('${codigo}', this.value)">
                    `
            let opcoes = esquemas.sistema.map(op => `
                    <option ${produto?.sistema == op ? 'selected' : ''}>${op}</option>`)
                .join('')

            let linha = `
                    <tr id="tr_${codigo}">
                        <td style="white-space: nowrap;">${codigo}</td>
                        <td style="position: relative;">
                            <div style="display: flex; justify-content: start; align-items: center; gap: 10px;">
                                ${moduloComposicoes ? `<img src="imagens/editar.png" style="width: 1.5vw; cursor: pointer;" onclick="cadastrar_editar_item('${codigo}')">` : ''}
                                ${moduloComposicoes ? `<img src="imagens/excluir.png" style="width: 1.5vw; cursor: pointer;" onclick="confirmarExclusao_item('${codigo}')">` : ''}
                                <label style="text-align: left;">${produto.descricao}</label>
                            </div>
                            ${(produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0) ? `<img src="gifs/lampada.gif" onclick="mostrarAgrupamentos('${codigo}')" style="position: absolute; top: 3px; right: 1vw; width: 1.5vw; cursor: pointer;">` : ''}
                        </td>
                        <td>${produto.fabricante}</td>
                        <td>${produto.modelo}</td>
                        <td>
                            <select class="opcoesSelect" onchange="alterarChave('${codigo}', 'sistema', this)">
                                ${opcoes}
                            </select>
                        </td>
                        <td style="text-align: center;">${td_quantidade}</td>
                        <td>${produto.unidade}</td>
                        <td style="white-space: nowrap;">
                            <label ${moduloComposicoes ? `onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')"` : ''} class="labelAprovacao" style="background-color: ${preco > 0 ? 'green' : '#B12425'}">${dinheiro(preco)}</label>
                        </td>
                        <td style="text-align: center;">
                            <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 5vw; cursor: pointer;">
                        </td>
                    </tr>
                `

            tabelas[produto.tipo].linhas += linha
            tabelas.TODOS.linhas += linha

        }

        let colunas = ['Código', 'Descrição', 'Fabricante', 'Modelo', 'Sistema', 'Quantidade', 'Unidade', 'Valor', 'Imagem *Ilustrativa']
        let ths = ''
        let tsh = ''
        colunas.forEach((col, i) => {
            ths += `<th style="color: white;">${col}</th>`
            tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="position: relative;">
                    <input style="text-align: left;" oninput="pesquisarProdutos(${i}, this)">
                    <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                </div>
            </th>
            `
        })

        let tabelasHTML = ''
        let toolbar = ''

        for (let tabela in tabelas) {

            toolbar += `
                <label class="menu_top" style="background-color: ${coresTabelas(tabela)};" onclick="alterarTabela('${tabela}')">${tabela}</label>`

            tabelasHTML += `
                <table id="compos_${tabela}" style="display: none;" class="tabela">
                    <thead style="background-color: ${coresTabelas(tabela)};">
                        <tr>${ths}</tr>
                        <tr>${tsh}</tr>
                    </thead>
                    <tbody>
                        ${tabelas[tabela].linhas}
                    </tbody>
                </table>
            `
        }

        let botoes = `
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
                onclick="recuperarComposicoes()">
                <img src="imagens/atualizar_2.png" style="width: 2vw; cursor: pointer;">
                <label style="color: white; cursor: pointer; font-size: 1.0vw;">Atualizar</label>
            </div>`

        if (moduloComposicoes) {
            botoes += `
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
                onclick="cadastrar_editar_item()">
                <img src="imagens/add.png" style="width: 2vw; cursor: pointer;">
                <label style="color: white; cursor: pointer; font-size: 1.0vw;">Criar Item</label>
            </div>`
        }

        botoes += `
            <div style="display: flex; align-items: center; justify-content: center; gap: 2px; background-color: #d2d2d2; margin: 3px; border-radius: 3px;">
                <input onchange="ocultarZerados(this.checked)" type="checkbox" style="width: 3vw; cursor: pointer;" ${ocultarZerados ? 'checked' : ''}>
                <label style="padding-right: 2vw; font-size: 1.0vw;">Ocultar produtos zerados</label>
            </div>
            `

        let acumulado = `
        <div style="position: relative; display: flex; justify-content: center; width: 100%; margin-top: 30px; gap: 10px;">
            ${toolbar}
            ${botoes}
        </div>

        <div style="height: 700px; overflow: auto;">
            ${tabelasHTML}
        </div>
        `
        tabela_itens.innerHTML = acumulado
    }

    alterarTabela('TODOS')
}

function alterarTabela(tabela) {
    let tabela_itens = document.getElementById('tabela_itens')
    let tables = tabela_itens.querySelectorAll('table')

    pagina = tabela

    tables.forEach(tab => {
        tab.style.display = 'none'
    })

    document.getElementById(`compos_${tabela}`).style.display = 'table-row'
}

async function total() {

    let dados_clientes = await recuperarDados('dados_clientes') || {}
    dados_composicoes = await recuperarDados('dados_composicoes') || {}

    let orcamentoBase = baseOrcamento()
    let lpu = String(orcamentoBase.lpu_ativa).toLowerCase()
    let carrefour = orcamentoBase.lpu_ativa == 'LPU CARREFOUR'
    let totais = { GERAL: { valor: 0, bruto: 0 } }
    let divTabelas = document.getElementById('tabelas')
    let tables = divTabelas.querySelectorAll('table')
    let padraoFiltro = localStorage.getItem('padraoFiltro')
    let avisoDesconto = 0
    let totalAcrescido = 0
    let descontoAcumulado = 0

    let cliente = dados_clientes?.[orcamentoBase.dados_orcam?.omie_cliente] || ''
    let estado = cliente.estado || false

    if (!orcamentoBase.dados_composicoes) orcamentoBase.dados_composicoes = {}

    tables.forEach(tab => {
        let nomeTabela = String(tab.id).split('_')[1]
        totais[nomeTabela] = { valor: 0 }
    })

    for (let tabela in totais) {

        if (tabela == 'GERAL') continue

        let tbody = document.getElementById(`linhas_${tabela}`)
        if (!tbody) continue

        let trs = tbody.querySelectorAll('tr')

        for (tr of trs) {

            let tds = tr.querySelectorAll('td')
            let codigo = tds[0].textContent

            if (!orcamentoBase.dados_composicoes[codigo]) {
                orcamentoBase.dados_composicoes[codigo] = {}
            }

            let acrescimo = carrefour ? 1 : 0
            let valorUnitario = 0
            let total = 0
            let precos = { custo: 0, lucro: 0 }

            if (!dados_composicoes[codigo]) {
                dados_composicoes[codigo] = {
                    descricao: orcamentoBase.dados_composicoes[codigo]?.descricao || 'N/A',
                    tipo: orcamentoBase.dados_composicoes[codigo]?.tipo
                }
            }

            let descricao = dados_composicoes[codigo].descricao
            let tipo = dados_composicoes[codigo].tipo
            let icmsSaida = 0

            let itemSalvo = orcamentoBase.dados_composicoes[codigo]
            itemSalvo.codigo = codigo
            tds[1].textContent = dados_composicoes[codigo].descricao

            if (carrefour && dados_composicoes[codigo] && dados_composicoes[codigo].substituto && dados_composicoes[codigo].substituto !== '') {
                codigo = dados_composicoes[codigo].substituto == '' ? codigo : dados_composicoes[codigo].substituto
            }

            let produto = dados_composicoes?.[codigo] || {}
            let ativo = produto?.[lpu]?.ativo || 0
            let historico = produto?.[lpu]?.historico || {}
            precos = historico[ativo]

            // Caso o itemSalvo.antigo exista, então não se deve mexer no valor dele;
            valorUnitario = itemSalvo.antigo ? itemSalvo.custo : historico?.[ativo]?.valor || 0

            icmsSaida = precos?.icms_creditado == 4 ? 4 : estado == 'BA' ? 20.5 : 12

            if (itemSalvo.alterado) valorUnitario = itemSalvo.custo

            let quantidade = Number(tds[3 + acrescimo].querySelector('input').value)

            valorUnitario += total
            let totalLinha = valorUnitario * quantidade

            let desconto = 0
            let tipoDesconto
            let valorDesconto

            if (!carrefour) {
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

                    let dadosCalculo = {
                        custo: precos.custo,
                        valor: precos.valor - desconto / quantidade,
                        icms_creditado: precos.icms_creditado,
                        icmsSaida,
                        modalidadeCalculo: tipo
                    }

                    let resultado = calcular(undefined, dadosCalculo)

                    if (!estado) {
                        valorDesconto.value = ''
                        avisoDesconto = 1 // Preencher os dados da empresa;

                    } else if (acesso.permissao == 'adm' || acesso.permissao == 'diretoria') {
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
                descontoAcumulado += desconto
            }

            let filtro = dados_composicoes[codigo]?.[padraoFiltro] || 'SEM CLASSIFICAÇÃO'

            if (!totais[filtro]) totais[filtro] = { valor: 0 }

            totais[filtro].valor += totalLinha
            totais.GERAL.valor += totalLinha

            // ATUALIZAÇÃO DE INFORMAÇÕES DA COLUNA 4 EM DIANTE
            let descricaocarrefour = dados_composicoes[codigo].descricaocarrefour
            if (carrefour) {
                tds[2].innerHTML = `
                    <td>
                        <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
                            <img src="imagens/carrefour.png" style="width: 3vw;">
                            <label>${descricaocarrefour}</label>
                        </div>
                    </td>`
            }

            let icmsSaidaDecimal = icmsSaida / 100
            let valorLiqSemICMS = valorUnitario - (valorUnitario * icmsSaidaDecimal)
            let valorTotSemICMS = totalLinha - (totalLinha * icmsSaidaDecimal)

            let labelValores = (valor, semIcms, percentual, unitario) => {
                let labelICMS = ''
                if (tipo == 'VENDA' && estado) labelICMS = `<label style="white-space: nowrap;">SEM ICMS ${dinheiro(semIcms)} [ ${percentual}% ]</label>`
                return `
                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 5px;">
                            <label ${valor > 0 ? 'class="input_valor">' : `class="labelAprovacao" style="background-color: #B12425">`} ${dinheiro(valor)}</label>
                            ${unitario ? `<img onclick="alterarValorUnitario('${codigo}')" src="imagens/ajustar.png" style="cursor: pointer; width: 1.5vw;">` : ''}
                        </div>
                        ${labelICMS}
                    </div>
                    `
            }

            tds[4 + acrescimo].innerHTML = labelValores(valorUnitario, valorLiqSemICMS, icmsSaida, true)

            if (carrefour) { acrescimo = 0 }
            tds[6 + acrescimo].innerHTML = labelValores(totalLinha, valorTotSemICMS, icmsSaida)

            let imagem = dados_composicoes[codigo]?.imagem || logo

            itemSalvo.descricao = descricao
            itemSalvo.unidade = dados_composicoes[codigo]?.unidade || 'UN'
            itemSalvo.descricaocarrefour = descricaocarrefour
            itemSalvo.qtde = quantidade
            itemSalvo.custo = valorUnitario
            itemSalvo.tipo = tipo
            itemSalvo.imagem = imagem

            if (!carrefour && Number(valorDesconto.value) !== 0) {
                itemSalvo.tipo_desconto = tipoDesconto.value
                itemSalvo.desconto = Number(valorDesconto.value)
            } else {
                delete itemSalvo.tipo_desconto
                delete itemSalvo.desconto
            }
        }
    }

    // Inclusão dos totais em cada local;
    for ([campo, objeto] of Object.entries(totais)) {

        if (campo == 'GERAL') {
            document.getElementById(`total_geral`).textContent = dinheiro(totais.GERAL.valor)
        } else {

            let divTotal = document.getElementById(`total_${campo}`)
            if (divTotal) {
                divTotal.textContent = dinheiro(objeto.valor)
            }

            let trsTamanho = document.getElementById(`linhas_${campo}`).querySelectorAll('tr').length
            if (trsTamanho == 0) {
                document.getElementById(campo).remove()
                document.getElementById(`toolbar_${campo}`).remove()
                mostrarTabela()
            }
        }
    }

    let painel_desconto = document.getElementById('desconto_total')
    if (!carrefour) {

        let diferencaDinheiro = totais.GERAL.valor - totais.GERAL.bruto
        let diferencaPorcentagem = diferencaDinheiro == 0 ? 0 : (diferencaDinheiro / totais.GERAL.bruto * 100).toFixed(2)

        painel_desconto.innerHTML = `
            <div class="resumo">
                <label>RESUMO</label>
                <hr style="width: 90%;">
                <label>Total Bruto</label>
                <label style="font-size: 1.5vw;">${dinheiro(totais.GERAL.bruto)}</label>
                <label>Diferença R$</label>
                <label style="font-size: 1.5vw;">${dinheiro(diferencaDinheiro)}</label>
                <label>Diferença %</label>
                <label style="font-size: 1.5vw;" id="diferenca">${diferencaPorcentagem}%</label>
                <input style="display: none" value="${diferencaPorcentagem}">
            </div>`
    } else {
        painel_desconto.innerHTML = ''
    }

    // Informações complementares do orçamento;
    totalAcrescido > 0 ? orcamentoBase.total_acrescido = totalAcrescido : delete orcamentoBase.total_acrescido
    descontoAcumulado > 0 ? orcamentoBase.total_desconto = descontoAcumulado : delete orcamentoBase.total_desconto
    orcamentoBase.total_geral = totais.GERAL.valor
    orcamentoBase.total_bruto = totais.GERAL.bruto

    baseOrcamento(orcamentoBase)

    // Mensagem aleatório de boas vindas;
    let aleatorio = Math.floor(Math.random() * metaforas.length)
    let quieto = `
        <div id="quieto" style="display: flex; justify-content: center; align-items: center; width: 100%; padding: 5vw;">
            <label class="novo_titulo">${metaforas[aleatorio]}</label>
        </div>
    `
    let tabelas = document.getElementById('tabelas')
    let divQuieto = document.getElementById('quieto')
    if (divQuieto) divQuieto.remove()
    if (orcamentoBase.dados_composicoes && Object.keys(orcamentoBase.dados_composicoes).length > 0) {
        document.getElementById('toolbarSuperior').style.display = 'flex'
    } else {
        tabelas.insertAdjacentHTML('afterbegin', quieto)
    }

    if (avisoDesconto != 0) {
        let avisos = {
            1: 'Preencha os dados do Cliente antes de aplicar descontos',
            2: 'Desconto ultrapassa o permitido',
            3: 'Atualize os valores no ITEM [ICMS Creditado, Custo de Compra...]'
        }

        popup(avisoHTML(avisos[avisoDesconto]), 'AVISO')
    }

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

        if (precoOriginal >= valor) return popup(avisoHTML('O valor precisa ser maior que o Original'), 'AVISO', true)
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
    await total()
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
                <input oninput="total()" type="number" class="campoValor" value="${novaQuantidade}">
            </td>
            <td style="position: relative;"></td>

            ${!carrefour ?
            `<td>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                    <select onchange="total()" style="padding: 5px; border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">
                        <option>Porcentagem</option>
                        <option>Dinheiro</option>
                    </select>
                    <input type="number" oninput="total()" style="padding-bottom: 5px; padding-top: 5px; border-bottom-left-radius: 3px; border-bottom-right-radius: 3px;" value="${produto?.desconto || ''}">
                </div>
            </td>` : ''}

            <td></td>
            <td style="text-align: center;">
                <img name="${codigo}" onclick="abrirImagem('${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
            </td>
            <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${codigo}', this)" style="cursor: pointer; width: 2vw;"></td>
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
            return carregarTabelas()

        } else {
            tbody.insertAdjacentHTML('beforeend', linha)
        }
    }

    await total()
    mostrarTabela(produto.tipo)
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
            let novaQuantidadeTotal = parseFloat(quantidade)

            inputQuantidade.value = novaQuantidadeTotal

            if (orcamentoBase.dados_composicoes[codigo]) {
                orcamentoBase.dados_composicoes[codigo].qtde = novaQuantidadeTotal
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
