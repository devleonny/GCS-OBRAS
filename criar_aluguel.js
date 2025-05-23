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

function apagar_orçamento() {

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; margin: 2vw;">
            <label>Tem certeza que deseja apagar o Orçamento?</label>
            <button onclick="confirmar_exclusao()" style="background-color: green;">Confirmar</button>
        </div>
        `, 'Atenção')

}

let metaforas = [
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

function fechar_ir_orcamentos() {
    location.href = 'orcamentos.html'
}

function orcamento_que_deve_voltar() {

    let orcamento_v2 = baseOrcamento()

    if (orcamento_v2.id) {
        localStorage.setItem('orcamento_que_deve_voltar', JSON.stringify(orcamento_v2.id))
    }

}

function confirmar_exclusao() {

    baseOrcamento(undefined, true)
    location.href = 'criar_aluguel.html'
    remover_popup()

}

iniciarScripts()

async function iniciarScripts() {
    await carregarTabelas()
    await tabelaProdutos()
}

async function carregarTabelas() {

    let orcamento_v2 = baseOrcamento()
    let divTabelas = document.getElementById('tabelas')
    let tabelas = {}
    let toolbarSuperior = ''
    let stringsTabelas = ''
    let dadosComposicoes = orcamento_v2.dados_composicoes

    document.getElementById('lpu').value = orcamento_v2?.periodo || 'DIA'

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
                <input oninput="total()" type="number" class="campoValor" value="${produto?.custo || ''}">
            </td>
            <td>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                    <select onchange="total()" style="padding: 5px; border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">
                        <option ${produto?.tipo_desconto == 'Porcentagem' ? 'selected' : ''}>Porcentagem</option>
                        <option ${produto?.tipo_desconto == 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    </select>
                    <input type="number" oninput="total()" style="padding-bottom: 5px; padding-top: 5px; border-bottom-left-radius: 3px; border-bottom-right-radius: 3px;" value="${produto?.desconto || ''}">
                </div>
            </td>
            <td>
                <label></label>
            </td>
            <td style="text-align: center;">
                <img onclick="ampliar_especial(this, '${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
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
            <table id="cabecalho_${tabela}" class="tabela" style="table-layout: auto; width: 100%; background-color: ${coresTabelas(tabela)};">
                <thead id="thead_${tabela}">
                    <th style="color: white;">Código</th>
                    <th style="color: white;">${orcamento_v2.lpu_ativa}</th>
                    <th style="color: white;">Medida</th>
                    <th style="color: white;">Quantidade</th>
                    <th style="color: white;">Custo Unitário</th>
                    <th style="color: white;">Desconto</th>
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
    if (orcamento_v2.desconto_geral) {
        desconto_geral.value = orcamento_v2.desconto_geral
    }

    if (orcamento_v2.tipo_de_desconto) {
        desconto_geral.previousElementSibling.value = orcamento_v2.tipo_de_desconto
    }

    await total()

    mostrarTabela(Object.keys(tabelas)[0])
}

function atualizarPeriodo(periodo) {
    let orcamento_v2 = baseOrcamento()
    orcamento_v2.periodo = periodo
    baseOrcamento(orcamento_v2)
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

    let orcamento_v2 = baseOrcamento()

    if (orcamento_v2.dados_composicoes[codigo]) {

        delete orcamento_v2.dados_composicoes[codigo]

        baseOrcamento(orcamento_v2)

        img.parentElement.parentElement.remove() // Equivalente a tr

        await total()
    }

}

async function enviar_dados() {

    let orcamento_v2 = baseOrcamento()

    if (!orcamento_v2.dados_orcam) {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Preencha os dados do Cliente</label>
            </div>
        `);
    }

    let dados_orcam = orcamento_v2.dados_orcam;
    let chamado = dados_orcam.contrato

    if (dados_orcam.cliente_selecionado === '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Cliente em branco</label>
            </div>
        `);
    }

    if (chamado === '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado em branco</label>
            </div>
        `);
    }

    let existente = await verificar_chamado_existente(chamado, orcamento_v2.id, false)

    if (chamado !== 'sequencial' && existente?.situacao) {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado já Existente</label>
            </div>
        `)
    }

    if (chamado.slice(0, 1) !== 'D' && chamado !== 'sequencial' && chamado.slice(0, 3) !== 'ORC') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado deve começar com D</label>
            </div>
        `);
    }

    if (dados_orcam.estado === '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Estado em branco</label>
            </div>
        `);
    }

    if (dados_orcam.cnpj === '') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>CNPJ em branco</label>
            </div>
        `);
    }

    let desconto_porcentagem = document.getElementById('desconto_porcentagem')
    if (desconto_porcentagem && Number(desconto_porcentagem.value) > 0) {
        if (!(orcamento_v2.aprovacao && orcamento_v2.aprovacao.status === 'aprovado')) {
            return autorizar_desconto();
        }
    }

    if (orcamento_v2.dados_composicoes_orcamento || orcamento_v2.dados_composicoes_orcamento === null) {
        delete orcamento_v2.dados_composicoes_orcamento;
    }

    orcamento_v2.tabela = 'orcamentos';

    if (orcamento_v2.dados_orcam.contrato == 'sequencial') {
        let sequencial = await verificar_chamado_existente(undefined, undefined, true)
        orcamento_v2.dados_orcam.contrato = `ORC_${sequencial.proximo}`
    }

    if (!orcamento_v2.id) {
        orcamento_v2.id = 'ORCA_' + unicoID();
    }

    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="imagens/concluido.png" style="width: 3vw; height: 3vw;">
            <label>Aguarde... redirecionando...</label>
        </div>
    `)

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_orcamentos[orcamento_v2.id] = orcamento_v2
    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    await enviar(`dados_orcamentos/${orcamento_v2.id}`, orcamento_v2);

    baseOrcamento(undefined, true)
    location.href = 'orcamentos.html';

}

async function autorizar_desconto(reaprovacao) {
    let orcamento_v2 = baseOrcamento()

    if (!orcamento_v2.aprovacao) {
        orcamento_v2.aprovacao = {}
    }

    orcamento_v2.aprovacao.id = orcamento_v2.aprovacao.id || gerar_id_5_digitos();
    let id = orcamento_v2.aprovacao.id;

    let dados = {
        desconto_porcentagem: document.getElementById('desconto_porcentagem').value,
        total_sem_desconto: document.getElementById('total_sem_desconto').textContent,
        desconto_dinheiro: document.getElementById('desconto_dinheiro').textContent,
        total_geral: document.getElementById('total_geral').textContent
    }

    let mensagem = `
        <img src="gifs/loading.gif" style="width: 5vw;">
        <label>Algum Gerente deve autorizar este desconto... </label>
    `
    if (!reaprovacao && (orcamento_v2.aprovacao.status && orcamento_v2.aprovacao.status == 'reprovado')) {
        mensagem = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                <img src="imagens/cancel.png" style="width: 3vw;">
                <div style="display: flex; align-items: center; justify-content: start; gap: 5px; flex-direction: column;">
                    <label>Solicitação reprovada</label>
                    <label>${orcamento_v2.aprovacao.justificativa}</label>
                </div>
            </div>

            <hr style="width: 100%;">
            
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                <label>Tentar de novo?</label> 
                <button style="background-color: #4CAF50;" onclick="autorizar_desconto(true)">Sim</button>
            </div>
        </div>
        `
    } else {

        await enviar(`aprovacoes/${id}`, dados)
        baseOrcamento(orcamento_v2)
    }

    openPopup_v2(`
            <div id="aguardando_aprovacao" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                ${mensagem}
            </div>
        `)

}

function pesquisarProdutos(col, elemento) {

    if (!filtrosPagina[pagina]) {
        filtrosPagina[pagina] = {}
    }

    pesquisar_generico(col, elemento.value, filtrosPagina[pagina], `compos_${pagina}`)
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
                                <img src="${produto?.imagem || logo}" style="width: 5vw; cursor: pointer;" onclick="ampliar_especial(this, '${codigo}')">
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
            <table id="compos_${tabela}" style="display: none; background-color: ${coresTabelas(tabela)};" class="tabela">
                <thead>
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

async function total() {

    let orcamento_v2 = baseOrcamento()
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let desconto_acumulado = 0
    let totais = { GERAL: { valor: 0, exibir: 'none', bruto: 0 } }
    let divTabelas = document.getElementById('tabelas')
    let tables = divTabelas.querySelectorAll('table')

    orcamento_v2.lpu_ativa = modo // Salvando no mesmo local que as LPUs, para mostrar na tabela geral;

    if (!orcamento_v2.dados_composicoes) {
        orcamento_v2.dados_composicoes = {}
    }

    tables.forEach(tab => {
        let nomeTabela = String(tab.id).split('_')[1]
        totais[nomeTabela] = { valor: 0, exibir: 'none' }
    })

    if (orcamento_v2.dados_composicoes) {
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
                let tdDesconto = tds[5]
                let tdTotal = tds[6].querySelector('label')

                let valorUnitario = Number(tdCusto.value)
                let quantidade = Number(tdQuantidade.value)
                let descricao = dados_composicoes[codigo].descricao
                let tipo = dados_composicoes[codigo].tipo
                let totalLinha = valorUnitario * quantidade

                // Desconto;
                let desconto = 0
                let valorDesconto
                let tipoDesconto

                tipoDesconto = tdDesconto.querySelector('select')
                valorDesconto = tdDesconto.querySelector('input')

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

                if (desconto == 0) {
                    tipoDesconto.classList = 'desconto_off'
                    valorDesconto.classList = 'desconto_off'
                } else {
                    tipoDesconto.classList = 'desconto_on'
                    valorDesconto.classList = 'desconto_on'
                }

                // Valor bruto sem desconto;
                totais.GERAL.bruto += totalLinha
                totalLinha = totalLinha - desconto
                desconto_acumulado += desconto

                if (!totais[modo]) {
                    totais[modo] = { valor: 0, exibir: 'none' }
                }

                totais[modo].valor += totalLinha
                totais.GERAL.valor += totalLinha

                // Inclusão dos dados atualizados nas tds
                tdDescricao.textContent = dados_composicoes[codigo].descricao
                tdCusto.value = valorUnitario

                totalLinha > 0 ? tdTotal.classList = 'input_valor' : tdTotal.classList = 'label_zerada'
                tdTotal.textContent = dinheiro(totalLinha)

                // Salvamento dos itens no Orcamento
                if (!orcamento_v2.dados_composicoes[codigo]) {
                    orcamento_v2.dados_composicoes[codigo] = {}
                }

                let itemSalvo = orcamento_v2.dados_composicoes[codigo]
                itemSalvo.codigo = codigo
                itemSalvo.descricao = descricao
                itemSalvo.qtde = quantidade
                itemSalvo.custo = valorUnitario
                itemSalvo.tipo = modo // Salvar como 'ALUGUEL' para que as próximas tabelas sejam configuradas de acordo;

                if (Number(valorDesconto.value) !== 0) {
                    itemSalvo.tipoDesconto = tipoDesconto.value
                    itemSalvo.desconto = Number(valorDesconto.value)
                } else {
                    delete itemSalvo.tipoDesconto
                    delete itemSalvo.desconto
                }

            })
        }
    }

    let desconto_calculo = 0;
    let desconto_geral = document.getElementById('desconto_geral')
    let tipo_de_desconto = desconto_geral.previousElementSibling

    if (desconto_geral.value !== '') {
        orcamento_v2.desconto_geral = conversor(Number(desconto_geral.value))
        orcamento_v2.tipo_de_desconto = tipo_de_desconto.value
    } else {
        delete orcamento_v2.desconto_geral
        delete orcamento_v2.tipo_de_desconto
    }

    for (tot in totais) {

        if (tot !== 'GERAL') {

            let divTotal = document.getElementById(`total_${tot}`)
            if (divTotal) {
                divTotal.textContent = dinheiro(totais[tot].valor)
            }

        } else {

            if (desconto_geral.value !== '') { // 29
                if (tipo_de_desconto.value == 'Porcentagem') {

                    if (desconto_geral.value < 0) {
                        desconto_geral.value = 0
                    } else if (desconto_geral.value > 100) {
                        desconto_geral.value = 100
                    }

                    desconto_calculo = (desconto_geral.value / 100) * totais[tot].valor

                } else {

                    if (desconto_geral.value < 0) {
                        //desconto_geral.value = 0
                    } else if (desconto_geral.value > totais[tot].valor) {
                        //desconto_geral.value = totais[tot].valor
                    }

                    desconto_calculo = Number(desconto_geral.value)

                }
            }
        }
    }

    let desconto_geral_linhas = desconto_acumulado + desconto_calculo
    document.getElementById(`total_geral`).textContent = dinheiro(totais.GERAL.valor - desconto_calculo)

    let painel_desconto = document.getElementById('desconto_total')

    desconto_geral.parentElement.parentElement.style.display = 'flex'

    if (desconto_geral_linhas > totais.GERAL.valor) {
        desconto_geral_linhas = totais.GERAL.valor
    }

    let desc_porc = desconto_geral_linhas == 0 ? 0 : (desconto_geral_linhas / totais.GERAL.bruto * 100).toFixed(2)

    painel_desconto.innerHTML = `
            <div class="resumo">
                <label>RESUMO</label>
                <hr style="width: 100%;">
                <label>Total sem Desconto</label>
                <label style="font-size: 1.5vw;" id="total_sem_desconto">${dinheiro(totais.GERAL.bruto)}</label>
                <br>
                <label>Desconto R$</label>
                <label style="font-size: 1.5vw;" id="desconto_dinheiro">${dinheiro(desconto_geral_linhas)}</label>
                <br>
                <label>Desconto %</label>
                <label style="font-size: 1.5vw;">${desc_porc}%</label>
                <input style="display: none" id="desconto_porcentagem" value="${desc_porc}">
            </div>
        `

    orcamento_v2.total_geral = dinheiro(totais.GERAL.valor - desconto_calculo)
    orcamento_v2.total_bruto = totais.GERAL.bruto

    baseOrcamento(orcamento_v2)

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

    if (orcamento_v2.dados_composicoes && Object.keys(orcamento_v2.dados_composicoes).length > 0) {
        document.getElementById('toolbarSuperior').style.display = 'flex'
    } else {
        tabelas.insertAdjacentHTML('afterbegin', quieto)
    }

}

async function incluirItem(codigo, novaQuantidade) {
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento_v2 = baseOrcamento()
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
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;">
                    <select onchange="total()" style="padding: 5px; border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">
                        <option>Porcentagem</option>
                        <option>Dinheiro</option>
                    </select>
                    <input type="number" oninput="total()" style="padding-bottom: 5px; padding-top: 5px; border-bottom-left-radius: 3px; border-bottom-right-radius: 3px;" value="${produto?.desconto || ''}">
                </div>
            </td>
            <td>
                <label></label>
            </td>
            <td style="text-align: center;">
                <img onclick="ampliar_especial(this, '${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
            </td>
            <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${codigo}', this)" style="cursor: pointer; width: 2vw;"></td>
        </tr>
    `

    if (itemExistente(modo, codigo, novaQuantidade)) {

        let tbody = document.getElementById(`linhas_${modo}`)

        if (!tbody) { // Lançamento do 1º Item de cada tipo;

            if (!orcamento_v2.dados_composicoes) {
                orcamento_v2.dados_composicoes = {}
            }

            orcamento_v2.dados_composicoes[codigo] = {
                codigo: codigo,
                qtde: novaQuantidade,
                tipo: produto?.tipo,
                unidade: produto?.unidade || 'UN',
                custo: 0,
                descricao: produto?.descricao
            }

            baseOrcamento(orcamento_v2)
            return carregarTabelas()

        } else {
            tbody.insertAdjacentHTML('beforeend', linha)
        }
    }

    await total()
}

function itemExistente(tipo, codigo, quantidade) {

    let incluir = true
    let orcamento_v2 = baseOrcamento()
    let linhas = document.getElementById(`linhas_${tipo}`)
    if (!linhas) return incluir
    let trs = linhas.querySelectorAll('tr')

    trs.forEach(tr => {

        let tds = tr.querySelectorAll('td')
        let acrescimo = orcamento_v2.lpu_ativa !== 'LPU CARREFOUR' ? 0 : 1

        if (tds[0].textContent == codigo) {

            incluir = false
            tds[3 + acrescimo].querySelector('input').value = quantidade

        }

    })

    return incluir

}

function alterar_input_tabela(codigo) {
    let tabela_itens = document.getElementById('tabela_itens')

    if (tabela_itens) {
        let orcamento_v2 = baseOrcamento()
        let table = tabela_itens.querySelector('table')
        let tbody = table.querySelector('tbody')
        let trs = tbody.querySelectorAll('tr')

        trs.forEach(tr => {

            let tds = tr.querySelectorAll('td')
            let cod = tds[0].textContent

            if (cod == codigo && orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo]) {

                let td_quantidade = `
                <input type="number" class="campoValor" oninput="incluirItem('${codigo}', this.value)">
                `
                tds[5].innerHTML = td_quantidade

            }

        })

    }

}

async function carregar_clientes(textarea) {

    let div = textarea.nextElementSibling;
    let dados_clientes = await recuperarDados('dados_clientes') || {};
    let pesquisa = String(textarea.value).replace(/[.-]/g, '').toLowerCase()
    let opcoes = ''
    div.innerHTML = ''

    for (cnpj in dados_clientes) {
        var cliente = dados_clientes[cnpj]
        let nome = cliente.nome.toLowerCase()
        let cnpj_sem_format = cnpj.replace(/[.-]/g, '')

        if (nome.includes(pesquisa) || cnpj_sem_format.includes(pesquisa)) {
            opcoes += `
            <div onclick="selecionar_cliente('${cnpj}', '${cliente.nome}', this)" class="autocomplete-item" style="text-align: left; padding: 0px; gap: 0px; display: flex; flex-direction: column; align-items: start; justify-content: start; padding: 2px; border-bottom: solid 1px #d2d2d2;">
                <label style="width: 90%; font-size: 0.8vw;">${cliente.nome}</label>
                <label style="width: 90%; font-size: 0.7vw;"><strong>${cnpj}</strong></label>
            </div>
        `}
    }

    if (pesquisa == '') {
        document.getElementById('cnpj').textContent = '...'
        document.getElementById('cnpj').textContent = '...'
        document.getElementById('cep').textContent = '...'
        document.getElementById('bairro').textContent = '...'
        document.getElementById('cidade').textContent = '...'
        document.getElementById('estado').textContent = '...'
        return
    }

    div.innerHTML = opcoes

}

async function selecionar_cliente(cnpj, nome, div_opcao) {

    let dados_clientes = await recuperarDados('dados_clientes') || {};
    let cliente = dados_clientes[cnpj]

    document.getElementById('cnpj').textContent = cnpj
    document.getElementById('cep').textContent = cliente.cep
    document.getElementById('bairro').textContent = cliente.bairro
    document.getElementById('cidade').textContent = cliente.cidade
    document.getElementById('estado').textContent = cliente.estado

    let div = div_opcao.parentElement
    let textarea = div.previousElementSibling

    textarea.value = nome

    div.innerHTML = ''

    salvar_preenchido()

}

function limpar_campos() {
    openPopup_v2(`
        <div style="gap: 10px; display: flex; align-items: center; flex-direction: column;">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <label>Deseja limpar campos?</label>
            </div>
            <label onclick="executar_limpar_campos()" class="contorno_botoes" style="background-color: #B12425;">Confirmar</label>
        </div>`)
}

function executar_limpar_campos() {

    document.getElementById('cnpj').value = ''
    document.getElementById('cliente_selecionado').value = ''
    document.getElementById('consideracoes').value = ''
    document.getElementById('tipo_de_frete').value = ''
    document.getElementById('transportadora').value = ''

    // Limpar campos de texto (textContent)
    document.getElementById('cep').textContent = ''
    document.getElementById('estado').textContent = ''
    document.getElementById('cidade').textContent = ''
    document.getElementById('bairro').textContent = ''

    salvar_preenchido();
    remover_popup();
}

function pagina_adicionar() {
    salvar_preenchido()
    window.location.href = 'criar_orcamento.html'
}

function vendedores_analistas() {
    var dados_vendedores = {
        'GRUPO COSTA SILVA': {
            email: 'comercial@acsolucoesintegradas.com.br',
            telefone: '(71) 3901-3655'
        },
        'Sérgio Bergamini': {
            email: 'sergio.bergamini@acsolucoesintegradas.com.br',
            telefone: '(11) 98938-2759'
        },
        'Fernando Queiroz': {
            email: 'fernando.queiroz@acsolucoesintegradas.com.br',
            telefone: '(11) 99442-8826'
        }
    }

    var vendedores = Object.keys(dados_vendedores)

    var select = document.getElementById('vendedor')

    select.addEventListener('change', function () {
        atualizar_dados_vendedores()
        salvar_preenchido()
    })

    vendedores.forEach(function (vend_) {
        var option = document.createElement('option')
        option.textContent = vend_
        select.appendChild(option)
    })

    var dados_acesso = JSON.parse(localStorage.getItem('acesso'))

    document.getElementById('analista').textContent = dados_acesso.nome_completo
    document.getElementById('email_analista').textContent = dados_acesso.email
    document.getElementById('telefone_analista').textContent = dados_acesso.telefone

    atualizar_dados_vendedores()

}

function atualizar_dados_vendedores() {

    var dados_vendedores = JSON.parse(localStorage.getItem('vendedores'))
    var vendedor = document.getElementById('vendedor').value
    document.getElementById('email_vendedor').textContent = dados_vendedores[vendedor]['email']
    document.getElementById('telefone_vendedor').textContent = dados_vendedores[vendedor]['telefone']

}

async function salvar_preenchido() {

    let orcamento_v2 = baseOrcamento()

    let dados_analista = {
        email: document.getElementById('email_analista').textContent,
        nome: document.getElementById('analista').textContent,
        telefone: document.getElementById('telefone_analista').textContent
    };

    if (orcamento_v2.id) {
        dados_analista.email = orcamento_v2.dados_orcam.email_analista;
        dados_analista.telefone = orcamento_v2.dados_orcam.telefone_analista;
        dados_analista.nome = orcamento_v2.dados_orcam.analista;
    }

    if (!orcamento_v2.dados_orcam) {
        orcamento_v2.dados_orcam = {}
    }

    let contrato = document.getElementById('contrato')
    let checkbox = document.getElementById('chamado_off')

    if (checkbox.checked) {
        orcamento_v2.dados_orcam.contrato = 'sequencial'
        contrato.style.display = 'none'

    } else if (contrato.value == 'sequencial' || orcamento_v2.dados_orcam?.contrato == 'sequencial') {
        orcamento_v2.dados_orcam.contrato = ''
        contrato.value = ''
        contrato.style.display = 'block'

    } else {
        orcamento_v2.dados_orcam.contrato = contrato.value
        contrato.style.display = 'block'
    }

    orcamento_v2.dados_orcam = {
        ...orcamento_v2.dados_orcam,
        analista: dados_analista.nome,
        estado: document.getElementById('estado').textContent,
        bairro: document.getElementById('bairro').textContent,
        cep: document.getElementById('cep').textContent,
        cidade: document.getElementById('cidade').textContent,
        cliente_selecionado: document.getElementById('cliente_selecionado').value,
        cnpj: document.getElementById('cnpj').textContent,
        condicoes: document.getElementById('condicoes').value,
        consideracoes: document.getElementById('consideracoes').value,
        data: new Date(),
        email_analista: dados_analista.email,
        email_vendedor: document.getElementById('email_vendedor').textContent,
        garantia: document.getElementById('garantia').value,
        telefone_analista: dados_analista.telefone,
        transportadora: document.getElementById('transportadora').value,
        telefone_vendedor: document.getElementById('telefone_vendedor').textContent,
        tipo_de_frete: document.getElementById('tipo_de_frete').value,
        vendedor: document.getElementById('vendedor').value,
        emissor: document.getElementById('emissor').value
    };

    baseOrcamento(orcamento_v2)

    if (orcamento_v2.lpu_ativa === 'MODALIDADE LIVRE') {
        total_v2();
    } else {
        await total();
    }

}

function tipo_elemento(element) {
    if ('value' in element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT')) {
        return 'value';
    }
    return 'textContent';
}

function excluir_levantamento(chave) {
    var orcamento_v2 = baseOrcamento()

    if (orcamento_v2.levantamentos) {

        delete orcamento_v2.levantamentos[chave]

        baseOrcamento(orcamento_v2)

    }
}

function painel_clientes() {

    let orcamento_v2 = baseOrcamento()
    let dados_orcam = orcamento_v2?.dados_orcam || {}
    let levantamentos = ''

    let dados_pagamentos = ["A definir", "15 dias", "30 dias", "60 dias", "75 dias", "90 dias", "120 dias", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]
    let condicoes = ''
    dados_pagamentos.forEach(pag => {
        condicoes += `
            <option ${dados_orcam?.condicoes == pag ? 'selected' : ''}>${pag}</option>
        `
    })

    for (chave in orcamento_v2?.levantamentos || {}) {
        var levantamento = orcamento_v2.levantamentos[chave]

        levantamentos += criarAnexoVisual(levantamento.nome, levantamento.link, `excluir_levantamento('${chave}')`)

    }

    let acumulado = `

    <div style="background-color: #d2d2d2; padding: 10px;">
        <div style="display: flex; justify-content: start; align-items: center;">
            <div style="display: flex; flex-direction: column; gap: 10px; align-items: left; margin: 5px;">

                <div id="acompanhamento_dados_clientes" class="btn" onclick="recuperar_clientes()">
                    <img src="imagens/omie.png">
                    <label style="cursor: pointer;">Atualizar OMIE Clientes</label>
                </div>

            </div>

            <div onclick="limpar_campos()" class="btn">
                <img src="imagens/limpar.png" style="width: 2vw;">
                <label style="cursor: pointer;">Limpar Campos</label>
            </div>
        </div>

        <div
            style="display: flex; flex-direction: column; gap: 5px; justify-content: center; align-items: start; border-radius: 3px; margin: 5px;">
            <label style="font-size: 1.5vw;">Dados do Cliente</label>
            <div class="linha">

                <label>nº do Chamado</label>
                <div style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 2px; flex-direction: column;">
                    <input id="contrato" style="display: ${dados_orcam?.contrato == 'sequencial' ? 'none' : ''};" placeholder="nº do Chamado" onchange="salvar_preenchido()" value="${dados_orcam?.contrato || ''}">

                    <div style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 2px;">
                        <input id="chamado_off" style="width: max-content; cursor: pointer;" type="checkbox"
                            onchange="salvar_preenchido()" ${dados_orcam?.contrato == 'sequencial' ? 'checked' : ''}>
                        <label style="width: max-content;">Sem Chamado</label>
                    </div>
                </div>
            </div>

            <div class="linha">
                <label>Cliente</label>
                <div class="autocomplete-container">
                    <textarea style="width: 100%; font-size: 1.0vw;" class="autocomplete-input" id="cliente_selecionado"
                        placeholder="Escreva o nome do Cliente..." oninput="carregar_clientes(this)">${dados_orcam?.cliente_selecionado || ''}</textarea>
                    <div class="autocomplete-list"></div>
                </div>
            </div>

            <div class="linha">
                <label>CNPJ/CPF</label>
                <label id="cnpj">${dados_orcam?.cnpj || '...'}</label>
            </div>
            <div class="linha">
                <label>CEP</label>
                <label id="cep">${dados_orcam?.cep || '...'}</label>
            </div>
            <div class="linha">
                <label>Endereço</label>
                <label id="bairro">${dados_orcam?.bairro || '...'}</label>
            </div>
            <div class="linha">
                <label>Cidade</label>
                <label id="cidade">${dados_orcam?.cidade || '...'}</label>
            </div>
            <div class="linha">
                <label>Estado</label>
                <label id="estado">${dados_orcam?.estado || '...'}</label>
            </div>
            <div class="linha">
                <label>Tipo de Frete</label>
                <select id="tipo_de_frete" onchange="salvar_preenchido()">
                    <option ${dados_orcam?.tipo_de_frete == '--' ? 'selected' : ''}>--</option>
                    <option ${dados_orcam?.tipo_de_frete == 'CIF' ? 'selected' : ''}>CIF</option>
                    <option ${dados_orcam?.tipo_de_frete == 'FOB' ? 'selected' : ''}>FOB</option>
                </select>
            </div>
            <div class="linha">
                <label>Transportadora</label>
                <input type="text" id="transportadora" placeholder="Transportadora" oninput="salvar_preenchido()" value="${dados_orcam?.transportadora || ''}">
            </div>
            <div class="linha">
                <label>Considerações</label>
                <div style="display: flex; flex-direction: column; align-items: start; justify-content: space-between;">
                    <textarea id="consideracoes" oninput="salvar_preenchido()" rows="5" style="width: 100%; font-size: 1.0vw;"
                        placeholder="Escopo do orçamento...">${dados_orcam?.consideracoes || ''}</textarea>

                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                        <div class="contorno_botoes" style="background-color: #222; width: 100%;">
                            <img src="imagens/anexo2.png" style="width: 15px;">
                            <label style="width: 100%;" for="adicionar_levantamento">Anexar levantamento
                                <input type="file" id="adicionar_levantamento" style="display: none;"
                                    onchange="salvar_levantamento()">
                            </label>
                        </div>
                        <div>
                            ${levantamentos}
                        </div>
                    </div>
                </div>
            </div>
            <div class="linha">
                <label>Condições de Pagamento</label>
                <select id="condicoes" oninput="salvar_preenchido()">
                    ${condicoes}
                </select>
            </div>

            <div class="linha">
                <label>Garantia</label>
                <input id="garantia" placeholder="1 Ano" oninput="salvar_preenchido()" value="${dados_orcam?.garantia || ''}">
            </div>

            <label style="font-size: 1.5vw;">Dados do Analista</label>
            <div class="linha">
                <label>Analista</label>
                <label id="analista">${dados_orcam?.analista || ''}</label>
            </div>

            <div class="linha">
                <label>E-mail</label>
                <label style="width: 70%;" id="email_analista">${dados_orcam?.email_analista || ''}</label>
            </div>

            <div class="linha">
                <label>Telefone</label>
                <label id="telefone_analista">${dados_orcam?.telefone_analista || ''}</label>
            </div>

            <label style="font-size: 1.5vw;">Dados do Vendedor</label>
            <div class="linha">
                <label>Vendedor</label>
                <select style="text-align: center; width: 100%;" id="vendedor" oninput="salvar_preenchido()">
                </select>
            </div>
            <div class="linha">
                <label>E-mail</label>
                <label style="width: 70%;" id="email_vendedor"></label>
            </div>
            <div class="linha">
                <label>Telefone</label>
                <label id="telefone_vendedor"></label>
            </div>

            <label style="font-size: 1.5vw;">Quem emite essa nota?</label>
            <div class="linha">
                <label>Empresa</label>
                <select style="text-align: center; width: 100%;" id="emissor" oninput="salvar_preenchido()">
                    <option ${dados_orcam?.emissor == 'AC SOLUÇÕES' ? 'selected' : ''}>AC SOLUÇÕES</option>
                    <option ${dados_orcam?.emissor == 'HNW' ? 'selected' : ''}>HNW</option>
                    <option ${dados_orcam?.emissor == 'HNK' ? 'selected' : ''}>HNK</option>
                </select>
            </div>

        </div>

        <div style="width: 100%; display: flex; gap: 10px; align-items: end; justify-content: right; margin-top: 5vh;">
            <label><strong>Data de criação</strong> ou <strong>Alteração</strong></label>
            <label id="data">${new Date(dados_orcam?.data || new Date()).toLocaleDateString('pt-BR')}</label>
        </div>
    </div>
    `

    openPopup_v2(acumulado, 'Dados do Cliente')

    vendedores_analistas()

}