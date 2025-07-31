let filtrosPagina = {}
let pagina;
let modo = 'ALUGUEL'

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
    location.href = 'criar_aluguel.html'
    removerPopup()

}

iniciarScripts()

async function iniciarScripts() {
    await carregarTabelas()
    await tabelaProdutos()
}

async function carregarTabelas() {

    let orcamentoBase = baseOrcamento()
    let divTabelas = document.getElementById('tabelas')
    let tabelas = {}
    let toolbarSuperior = ''
    let stringsTabelas = ''
    let dadosComposicoes = orcamentoBase.dados_composicoes

    document.getElementById('lpu').value = orcamentoBase?.periodo || 'DIA'
    document.getElementById('quantidadePeriodo').value = orcamentoBase?.quantidadePeriodo || ''

    for (codigo in dadosComposicoes) {

        let produto = dadosComposicoes[codigo]
        let linha = `
        <tr>
            <td>${codigo}</td>
            <td style="position: relative;">${produto?.descricao || 'N/A'}</td>
            <td style="text-align: center;">${produto?.unidade || 'UN'}</td>
            <td>
                <input oninput="total()" type="number" class="campoValor" value="${produto?.qtde || ''}">
            </td>
            <td>
                <input oninput="total(this)" type="number" class="campoValor" value="${produto?.custo || ''}">
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
        if (!tabelas[modo]) {
            tabelas[modo] = { linhas: '' }
        }

        tabelas[modo].linhas += linha
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
                    <th style="color: white;">${orcamentoBase.lpu_ativa}</th>
                    <th style="color: white;">Medida</th>
                    <th style="color: white;">Quantidade</th>
                    <th style="color: white;">Custo Unitário Locação</th>
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

    let desconto_geral = document.getElementById('desconto_geral')
    if (orcamentoBase.desconto_geral) {
        desconto_geral.value = orcamentoBase.desconto_geral
    }

    if (orcamentoBase.tipo_de_desconto) {
        desconto_geral.previousElementSibling.value = orcamentoBase.tipo_de_desconto
    }

    await total()

    mostrarTabela(Object.keys(tabelas)[0])
}

function atualizarPeriodo(periodo) {
    let orcamentoBase = baseOrcamento()
    orcamentoBase.periodo = periodo
    baseOrcamento(orcamentoBase)
}

function mostrarTabela(tabela) {

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
    `)

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

    pesquisarGenerico(col, elemento.value, filtrosPagina[pagina], `compos_${pagina}`)
}

async function recuperarComposicoes() {

    overlayAguarde()

    let nuvem = await receber('dados_composicoes')
    await inserirDados(nuvem, 'dados_composicoes')
    await tabelaProdutos()

    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }
}

async function tabelaProdutos() {

    let moduloComposicoes = (
        acesso.permissao == 'adm' ||
        acesso.permissao == 'log' ||
        acesso.permissao == 'editor' ||
        acesso.permissao == 'gerente' ||
        acesso.permissao == 'diretor'
    )

    let tabelas = {}

    let tabela_itens = document.getElementById('tabela_itens')

    if (tabela_itens) {

        let dados_composicoes = await recuperarDados('dados_composicoes') || {}
        if (Object.keys(dados_composicoes) == 0) {
            await recuperarComposicoes()
        }

        for (codigo in dados_composicoes) {
            let produto = dados_composicoes[codigo]

            if (!tabelas[modo]) {
                tabelas[modo] = { linhas: '' }
            }

            if (produto.status != "INATIVO") {

                let td_quantidade = `
                    <input type="number" class="campoValor" oninput="incluirItem('${codigo}', this.value)">
                    `
                let opcoes = ''
                esquemas.sistema.forEach(op => {
                    opcoes += `<option ${produto?.sistema == op ? 'selected' : ''}>${op}</option>`
                })
                let linha = `
                        <tr>
                            <td style="white-space: nowrap;">${codigo}</td>
                            <td style="position: relative;">
                                <div style="display: flex; justify-content: start; align-items: center; gap: 10px;">
                                    ${moduloComposicoes ? `<img src="imagens/editar.png" style="width: 1.5vw; cursor: pointer;" onclick="cadastrar_editar_item('${codigo}')">` : ''}
                                    ${moduloComposicoes ? `<img src="imagens/construcao.png" style="width: 1.5vw; cursor: pointer;" onclick="abrir_agrupamentos('${codigo}')">` : ''}
                                    <label>${produto.descricao}</label>
                                </div>
                                ${(produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0) ? `<img src="gifs/lampada.gif" style="position: absolute; top: 3px; right: 1vw; width: 1.5vw; cursor: pointer;">` : ''}
                            </td>
                            <td>${produto.fabricante}</td>
                            <td>${produto.modelo}</td>
                            <td>
                                <select class="opcoesSelect" onchange="alterarChave('${codigo}', 'sistema', this)">
                                    ${opcoes}
                                </select>
                            </td>
                            <td style="text-align: center;">${td_quantidade}</td>
                            <td style="text-align: center;">
                                <img src="${produto?.imagem || logo}" style="width: 5vw; cursor: pointer;" onclick="abrirImagem(this, '${codigo}')">
                            </td>
                        </tr>
                    `
                tabelas[modo].linhas += linha
            }
        }

        let colunas = ['Código', 'Descrição', 'Fabricante', 'Modelo', 'Sistema', 'Quantidade', 'Imagem *Ilustrativa']
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
            <table id="compos_${tabela}" style="display: none; resizable" class="tabela">
                <thead style="background-color: ${coresTabelas(tabela)};">
                    ${ths}
                </thead>
                <thead>
                    ${tsh}
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
                <img src="imagens/atualizar_2.png" style="width: 30px; cursor: pointer;">
                <label style="color: white; cursor: pointer;">Atualizar</label>
            </div>`

        if (moduloComposicoes) {
            botoes += `
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
                onclick="cadastrar_editar_item()">
                <img src="imagens/add.png" style="width: 30px; cursor: pointer;">
                <label style="color: white; cursor: pointer;">Criar Item</label>
            </div>`
        }

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

    alterarTabela(modo)

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

async function total(inputDigitado) {

    let orcamentoBase = baseOrcamento()
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let desconto_acumulado = 0
    let totais = { GERAL: { valor: 0, exibir: 'none', bruto: 0 } }
    let divTabelas = document.getElementById('tabelas')
    let tables = divTabelas.querySelectorAll('table')
    let quantidadePeriodo = document.getElementById('quantidadePeriodo').value

    orcamentoBase.lpu_ativa = modo // Salvando no mesmo local que as LPUs, para mostrar na tabela geral;
    orcamentoBase.quantidadePeriodo = quantidadePeriodo

    if (!orcamentoBase.dados_composicoes) {
        orcamentoBase.dados_composicoes = {}
    }

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
                if (!orcamentoBase.dados_composicoes[codigo]) {
                    orcamentoBase.dados_composicoes[codigo] = {}
                }

                let itemSalvo = orcamentoBase.dados_composicoes[codigo]
                itemSalvo.codigo = codigo
                itemSalvo.descricao = descricao
                itemSalvo.qtde = quantidade
                itemSalvo.custo = valorUnitario
                itemSalvo.tipo = modo // Salvar como 'ALUGUEL' para que as próximas tabelas sejam configuradas de acordo;

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

}

async function incluirItem(codigo, novaQuantidade) {
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
            return carregarTabelas()

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

function excluir_levantamento(chave) {
    var orcamentoBase = baseOrcamento()

    if (orcamentoBase.levantamentos) {

        delete orcamentoBase.levantamentos[chave]

        baseOrcamento(orcamentoBase)

    }
}
