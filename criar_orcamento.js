let filtrosPagina = {}
let pagina;
let dados_composicoes = {}
let tabelaAtiva;
const avisoHTML = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>
    `

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

async function exibirTabelaAgrupamentos() {
    let orcamento_v2 = baseOrcamento()
    let lpu = String(orcamento_v2.lpu_ativa || 'lpu hope').toLowerCase()
    let dadosComposicoes = await recuperarDados('dados_composicoes') || {}
    let permissoes = ['adm', 'log', 'editor', 'gerente', 'diretor']
    let moduloComposicoes = permissoes.includes(acesso.permissao)

    let tabelas = { TODOS: { linhas: '' } }
    let ocultarZerados = JSON.parse(localStorage.getItem('ocultarZerados'))
    if (ocultarZerados == null) ocultarZerados = true

    for (let codigo in dadosComposicoes) {
        let produto = dadosComposicoes[codigo]

        if (!produto.agrupamentos || Object.keys(produto.agrupamentos).length === 0) continue

        if (!tabelas[produto.tipo]) tabelas[produto.tipo] = { linhas: '' }

        let preco = 0
        let ativo = 0
        let historico = 0

        if (produto[lpu] && produto[lpu].ativo && produto[lpu].historico) {
            ativo = produto[lpu].ativo
            historico = produto[lpu].historico
            preco = historico[ativo]?.valor || 0
        }

        if (preco == 0 && ocultarZerados) continue

        if (produto.status != "INATIVO") {
            let quantidadeAtual = orcamento_v2.dados_composicoes?.[codigo]?.qtde || ''

            let td_quantidade = `
                <input type="number" class="campoValor" oninput="incluirItem('${codigo}', this.value)" value="${quantidadeAtual}">
            `
            let opcoes = ''
            esquemas.sistema.forEach(op => {
                opcoes += `<option ${produto?.sistema == op ? 'selected' : ''}>${op}</option>`
            })

            let indicadorOrcamento = quantidadeAtual ?
                `<div style="display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 0.8em; color: #4CAF50;">(Qtde: ${quantidadeAtual})</span>
                </div>` : ''

            let linha = `
                <tr style="${quantidadeAtual ? 'background-color: #f0f8f0;' : ''}">
                    <td style="white-space: nowrap;">${codigo}</td>
                    <td style="position: relative;">
                        <div style="display: flex; justify-content: start; align-items: center; gap: 10px;">
                            ${moduloComposicoes ? `<img src="imagens/editar.png" style="width: 1.5vw; cursor: pointer;" onclick="cadastrar_editar_item('${codigo}')">` : ''}
                            ${moduloComposicoes ? `<img src="imagens/construcao.png" style="width: 1.5vw; cursor: pointer;" onclick="abrir_agrupamentos('${codigo}')">` : ''}
                            <div style="display: flex; flex-direction: column;">
                                <label>${produto.descricao}</label>
                                ${indicadorOrcamento}
                            </div>
                        </div>
                        <img src="gifs/lampada.gif" style="position: absolute; top: 3px; right: 1vw; width: 1.5vw; cursor: pointer;" onclick="mostrarDetalhesAgrupamento('${codigo}')" title="Ver detalhes do agrupamento">
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
                        <label ${moduloComposicoes ? `onclick="abrir_historico_de_precos('${codigo}', '${lpu}')"` : ''} class="labelAprovacao" style="background-color: ${preco > 0 ? 'green' : '#B12425'}">${dinheiro(preco)}</label>
                    </td>
                    <td style="text-align: center;">
                        <img src="${produto?.imagem || logo}" style="width: 5vw; cursor: pointer;" onclick="ampliar_especial(this, '${codigo}')">
                    </td>
                </tr>
            `

            tabelas[produto.tipo].linhas += linha
            tabelas.TODOS.linhas += linha
        }
    }

    let colunas = ['Código', 'Descrição', 'Fabricante', 'Modelo', 'Sistema', 'Quantidade', 'Unidade', 'Valor', 'Imagem *Ilustrativa']
    let ths = ''
    let tsh = ''
    colunas.forEach((col, i) => {
        ths += `<th style="color: white;">${col}</th>`
        tsh += `
        <th style="background-color: white; border-radius: 0px;">
            <div style="position: relative;">
                <input style="text-align: left;" oninput="pesquisarProdutosAgrupamentos(${i}, this)">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
            </div>
        </th>
        `
    })

    let tabelasHTML = ''
    let toolbar = ''
    let temItens = false

    for (let tabela in tabelas) {
        if (tabelas[tabela].linhas !== '') {
            temItens = true
            break
        }
    }

    if (!temItens) {
        tabelas.TODOS.linhas = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <img src="gifs/lampada.gif" style="width: 60px; height: 60px; opacity: 0.5;">
                        <p style="font-size: 1.2em; margin: 0;">Nenhum produto com agrupamentos encontrado</p>
                        <p style="color: #999; margin: 0;">
                            ${ocultarZerados ? 'Produtos zerados estão ocultos. Desmarque "Ocultar produtos zerados" para ver todos os itens.' : 'Adicione agrupamentos aos produtos para visualizá-los aqui'}
                        </p>
                    </div>
                </td>
            </tr>
        `
    }

    for (let tabela in tabelas) {
        toolbar += `
            <label class="menu_top" style="background-color: ${coresTabelas(tabela)};" onclick="alterarTabelaAgrupamentos('${tabela}')">${tabela}</label>`

        tabelasHTML += `
            <table id="agrup_${tabela}" style="display: none;" class="tabela">
                <thead style="background-color: ${coresTabelas(tabela)}; position: sticky; top: 0; z-index: 10;">
                    <tr>${ths}</tr>
                </thead>
                <thead style="position: sticky; z-index: 9; background-color: white;">
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
            <img src="imagens/atualizar_2.png" style="width: 30px; cursor: pointer; filter: brightness(0) saturate(100%);">
            <label style="cursor: pointer;">Atualizar</label>
        </div>`

    if (moduloComposicoes) {
        botoes += `
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center;"
            onclick="cadastrar_editar_item()">
            <img src="imagens/add.png" style="width: 30px; cursor: pointer; filter: brightness(0) saturate(100%);">
            <label style="cursor: pointer;">Criar Item</label>
        </div>`
    }

    botoes += `
        <div style="display: flex; align-items: center; justify-content: center; gap: 2px; background-color: #fff; margin: 3px; border-radius: 3px;">
            <input onchange="ocultarZerados(this.checked)" type="checkbox" style="width: 3vw; cursor: pointer;" ${ocultarZerados ? 'checked' : ''}>
            <label style="padding-right: 2vw;">Ocultar produtos zerados</label>
        </div>
    `

    let totalItensComAgrupamentos = Object.values(dadosComposicoes).filter(produto =>
        produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0
    ).length

    let itensNoOrcamento = 0
    if (orcamento_v2.dados_composicoes) {
        for (let codigo in orcamento_v2.dados_composicoes) {
            let produto = dadosComposicoes[codigo]
            if (produto && produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0) {
                itensNoOrcamento++
            }
        }
    }

    let estatisticas = `
        <div style="display: flex; gap: 20px; justify-content: center; align-items: center; margin: 10px 0;">
            <div style="text-align: center;">
                <div style="font-size: 1.5em; font-weight: bold;">${totalItensComAgrupamentos}</div>
                <div style="font-size: 0.9em;">Total de itens com Agrupamentos</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.5em; font-weight: bold; color: #4CAF50;">${itensNoOrcamento}</div>
                <div style="font-size: 0.9em;">No Orçamento Atual</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.5em; font-weight: bold; color: #FFA500;">${temItens ? Object.keys(tabelas).length - 1 : 0}</div>
                <div style="font-size: 0.9em;">Tipos Disponíveis</div>
            </div>
        </div>
    `

    let conteudoPopup = `
        <div style="max-width: 90vw; overflow-y: auto; padding: 0.5vw; background-color: #d2d2d2;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #4CAF50;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <h2 style="margin: 0; color: #4CAF50;">Produtos com Agrupamentos</h2>
                </div>
            </div>
            
            ${estatisticas}
            
            <div style="position: relative; display: flex; justify-content: center; width: 100%; margin-top: 30px; gap: 10px;">
                ${toolbar}
                ${botoes}
            </div>

            <div style="height: 700px; overflow: auto;">
                ${tabelasHTML}
            </div>
        </div>
    `

    openPopup_v2(conteudoPopup, 'Produtos com Agrupamentos')

    let primeiraTabelaComDados = Object.keys(tabelas)[0] || 'TODOS'
    alterarTabelaAgrupamentos(primeiraTabelaComDados)
}

function alterarTabelaAgrupamentos(tabela) {
    let tables = document.querySelectorAll('[id^="agrup_"]')

    tables.forEach(tab => tab.style.display = 'none')

    let tabelaElement = document.getElementById(`agrup_${tabela}`)
    if (tabelaElement) tabelaElement.style.display = 'table'
}

function pesquisarProdutosAgrupamentos(col, elemento) {
    if (!filtrosPagina.agrupamentos) filtrosPagina.agrupamentos = {}

    let tabelaAtiva = null
    let tables = document.querySelectorAll('[id^="agrup_"]')
    tables.forEach(tab => {
        if (tab.style.display === 'table') tabelaAtiva = tab.id
    })

    if (tabelaAtiva) pesquisar_generico(col, elemento.value, filtrosPagina.agrupamentos, tabelaAtiva)
}

async function mostrarAgrupamentos(codigo) {
    let dadosComposicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dadosComposicoes[codigo]
    let orcamento_v2 = baseOrcamento()

    if (!produto || !produto.agrupamentos || Object.keys(produto.agrupamentos).length === 0) {
        openPopup_v2(`
            <div style="text-align: center; padding: 20px;">
                <p>Este produto não possui agrupamentos configurados.</p>
            </div>
        `, 'Agrupamentos')
        return
    }

    let linhas = ''

    for (let [codigoItem, qtdeAgrupamento] of Object.entries(produto.agrupamentos)) {
        let itemAgrupamento = dadosComposicoes[codigoItem]
        if (!itemAgrupamento) continue

        linhas += `
            <tr>
                <td style="white-space: nowrap;">${codigoItem}</td>
                <td>${itemAgrupamento.descricao || 'N/A'}</td>
                <td style="text-align: center;">${qtdeAgrupamento}</td>
            </tr>
        `
    }

    let conteudoPopup = `
        <div style="max-width: 85vw; overflow-y: auto;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #4CAF50;">
                <img src="gifs/lampada.gif" style="width: 30px; height: 30px;">
                <h3 style="margin: 0; color: #4CAF50;">Agrupamentos - ${codigo}</h3>
            </div>
            
            <div style="margin-bottom: 15px;">
                <p><strong>Produto Principal:</strong> ${produto.descricao}</p>
            </div>

            <table class="tabela" style="width: 100%;">
                <thead style="background-color: #4CAF50;">
                    <tr>
                        <th style="color: white;">Código</th>
                        <th style="color: white;">Descrição</th>
                        <th style="color: white;">Qtde Kit</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `

    openPopup_v2(conteudoPopup, 'Agrupamentos do Produto')
}

function calcularTotalAgrupamento(codigo, qtdeAvulsa, qtdeKit, preco) {
    qtdeAvulsa = parseFloat(qtdeAvulsa) || 0
    let qtdeTotal = qtdeKit + qtdeAvulsa
    let valorTotal = preco * qtdeTotal

    document.getElementById(`total_${codigo}`).textContent = qtdeTotal

    let valorTotalElement = document.getElementById(`valorTotal_${codigo}`)
    if (valorTotalElement) {
        valorTotalElement.innerHTML = `<label class="labelAprovacao" style="background-color: ${preco > 0 ? 'green' : '#B12425'}">${dinheiro(valorTotal)}</label>`
    }

    calcularTotalKitGeral()
}

function calcularTotalKitGeral() {
    let totalGeral = 0
    let tabela = document.querySelector('.tabela tbody')
    if (!tabela) return

    let linhas = tabela.querySelectorAll('tr')
    linhas.forEach(linha => {
        let tds = linha.querySelectorAll('td')
        let valorTotalTexto = tds[6].querySelector('label').textContent
        let valorTotal = parseFloat(valorTotalTexto.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0
        totalGeral += valorTotal
    })

    let totalElement = document.getElementById('totalKitGeral')
    if (totalElement) {
        totalElement.textContent = dinheiro(totalGeral)
    }
}

async function adicionarItemAgrupamento(codigoItem, codigoPai) {
    let linhas = document.querySelectorAll('tbody tr')
    let linhaItem = null

    linhas.forEach(linha => {
        let primeiraTd = linha.querySelector('td:first-child')
        if (primeiraTd && primeiraTd.textContent.trim() === codigoItem) {
            linhaItem = linha
        }
    })

    if (!linhaItem) return

    let tds = linhaItem.querySelectorAll('td')
    let qtdeTotal = parseFloat(tds[4].textContent) || 0

    if (qtdeTotal <= 0) {
        openPopup_v2(avisoHTML('Quantidade deve ser maior que zero!', 'AVISO', true))
        return
    }

    await incluirItemComPai(codigoItem, qtdeTotal, codigoPai)

    openPopup_v2(`
        <div style="text-align: center; padding: 20px;">
            <img src="imagens/concluido.png" style="width: 50px;">
            <p>Item ${codigoItem} adicionado com quantidade ${qtdeTotal}!</p>
        </div>
    `, 'Sucesso')
}

async function adicionarTodoAgrupamento(codigoPrincipal) {
    let dadosComposicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dadosComposicoes[codigoPrincipal]

    if (!produto || !produto.agrupamentos) return

    let itensAdicionados = 0
    let linhas = document.querySelectorAll('tbody tr')

    for (let linha of linhas) {
        let tds = linha.querySelectorAll('td')
        let codigoItem = tds[0].textContent.trim()
        let qtdeAvulsa = parseFloat(tds[3].querySelector('input').value) || 0
        let qtdeKit = parseFloat(tds[2].textContent) || 0
        let qtdeTotal = qtdeKit + qtdeAvulsa

        if (qtdeTotal > 0) {
            await incluirItem(codigoItem, qtdeTotal)
            itensAdicionados++
        }
    }

    openPopup_v2(`
        <div style="text-align: center; padding: 20px;">
            <img src="imagens/concluido.png" style="width: 50px;">
            <p>${itensAdicionados} itens do kit foram adicionados ao orçamento!</p>
        </div>
    `, 'Kit Adicionado')
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

atualizar_precos()

async function atualizar_precos() {
    let orcamento_v2 = baseOrcamento()

    let modalidade = orcamento_v2.lpu_ativa

    if (modalidade !== 'MODALIDADE LIVRE') {
        await atualizarOpcoesLPU()
    } else {
        carregar_layout_modalidade_livre()
    }
}

verificar_modalidade_livre()

async function verificar_modalidade_livre() {
    let mostrar = await servicos('livre')
    document.getElementById('mod_livre').style.display = mostrar ? 'flex' : 'none'
}

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
    location.href = 'criar_orcamento.html'
    remover_popup()
}

async function atualizarOpcoesLPU() {
    dados_composicoes = await recuperarDados('dados_composicoes') || {}

    return new Promise((resolve, reject) => {

        try {
            let LPUS = [];
            let orcamento_v2 = baseOrcamento()
            let lpu = document.getElementById('lpu')
            LPUS = [
                ...new Set(
                    Object.values(dados_composicoes)
                        .flatMap(obj => Object.keys(obj))
                        .filter(key => key.toLowerCase().includes('lpu'))
                        .map(key => key.toUpperCase())
                )
            ];

            let opcoes = ''
            LPUS.forEach(lpu => {
                opcoes += `<option>${lpu}</option>`
            })

            lpu.innerHTML = opcoes

            let selectLpu = document.getElementById('lpu')

            if (orcamento_v2.lpu_ativa) {
                selectLpu.value = orcamento_v2.lpu_ativa
            }

            if (selectLpu.value !== '') {
                orcamento_v2.lpu_ativa = selectLpu.value
                baseOrcamento(orcamento_v2)
            }

            tabelaProdutos()
            carregarTabelas()
            resolve()
        } catch {
            reject()
            openPopup_v2(avisoHTML('Houve um erro ao carregar'), 'ALERTA')
        }
    })
}

function alterarTabelaLPU(tabelaLPU) {
    document.getElementById('lpu').value = tabelaLPU
    var orcamento_v2 = baseOrcamento()
    orcamento_v2.lpu_ativa = tabelaLPU
    baseOrcamento(orcamento_v2)
    tabelaProdutos()
    carregarTabelas()
}

async function filtroTabela(filtro) {
    localStorage.setItem('padraoFiltro', filtro)
    await carregarTabelas()
}

async function carregarTabelas() {
    let baseComposicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento_v2 = baseOrcamento()
    let carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR'
    let divTabelas = document.getElementById('tabelas')
    let tabelas = {}
    let toolbarSuperior = ''
    let stringsTabelas = ''
    let dadosComposicoes = orcamento_v2.dados_composicoes
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

            ${carrefour ? '' :
                `<td>
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
                <img onclick="ampliar_especial(this, '${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
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
                    <th style="color: white;">${orcamento_v2.lpu_ativa}</th>
                    <th style="color: white;">Medida</th>
                    <th style="color: white;">Quantidade</th>
                    <th style="color: white;">Custo Unitário</th>
                    ${!carrefour ? '<th style="color: white;">Desconto</th>' : ''}
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
    let orcamento_v2 = baseOrcamento()

    if (orcamento_v2.dados_composicoes[codigo]) {
        let produto = dados_composicoes[codigo]
        let temAgrupamentos = produto && produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0

        let itensFilhos = []

        if (temAgrupamentos) {
            for (let codigoFilho in produto.agrupamentos) {
                if (orcamento_v2.dados_composicoes[codigoFilho]) {
                    let itemFilho = orcamento_v2.dados_composicoes[codigoFilho]

                    if (itemFilho.historico_agrupamentos) {
                        let quantidadeDoPai = itemFilho.historico_agrupamentos
                            .filter(hist => hist.item_pai === codigo)
                            .reduce((total, hist) => total + hist.quantidade, 0)

                        if (quantidadeDoPai > 0) {
                            itensFilhos.push({
                                codigo: codigoFilho,
                                descricao: itemFilho.descricao,
                                qtde: itemFilho.qtde,
                                qtdeDoPai: quantidadeDoPai
                            })
                        }
                    }
                }
            }
            await confirmarExclusaoCompleta(codigo, img)
            await removerInfluenciaDoPai(codigo)
        } else {
            for (let codigoItem in orcamento_v2.dados_composicoes) {
                let item = orcamento_v2.dados_composicoes[codigoItem]
                if (item.historico_agrupamentos) {
                    let temEsteComooPai = item.historico_agrupamentos.some(hist => hist.item_pai === codigo)
                    if (temEsteComooPai) {
                        let quantidadeDoPai = item.historico_agrupamentos
                            .filter(hist => hist.item_pai === codigo)
                            .reduce((total, hist) => total + hist.quantidade, 0)

                        itensFilhos.push({
                            codigo: codigoItem,
                            descricao: item.descricao,
                            qtde: item.qtde,
                            qtdeDoPai: quantidadeDoPai
                        })
                    }
                }
            }
        }

        if (itensFilhos.length > 0) {
            let listaFilhos = itensFilhos.map(item =>
                `<li>${item.codigo} - ${item.descricao} (Qtde atual: ${item.qtde}, do pai: ${item.qtdeDoPai})</li>`
            ).join('')

            let item = orcamento_v2.dados_composicoes[codigo]
            let tipo = item.tipo
            delete orcamento_v2.dados_composicoes[codigo]


            let tipoItem = temAgrupamentos ? 'kit com agrupamentos' : 'item pai'

            openPopup_v2(`
                <div style="padding: 20px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <img src="gifs/alerta.gif" style="width: 40px;">
                        <h3 style="margin: 0; color: #B12425;">Atenção!</h3>
                    </div>
                    
                    <p>O ${tipoItem} <strong>${codigo}</strong> possui ${itensFilhos.length} item(ns) filho(s):</p>
                    
                    <ul style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0;">
                        ${listaFilhos}
                    </ul>
                </div>
            `, 'Itens excluídos')

            return
        }

        delete orcamento_v2.dados_composicoes[codigo]
        baseOrcamento(orcamento_v2)

        try {
            if (img && img.parentElement && img.parentElement.parentElement) {
                img.parentElement.parentElement.remove()
            } else {
                let linhaItem = encontrarLinhaItem(codigo)
                if (linhaItem) {
                    linhaItem.remove()
                }
            }
        } catch (error) {
            console.error('Erro ao remover linha da interface:', error)
        }

        await total()
    }
}

function itemExisteNoOrcamento(codigo) {
    let orcamento_v2 = baseOrcamento()
    let existe = orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo]
    return existe
}


function itemExisteNaInterface(codigo) {
    return encontrarLinhaItem(codigo) !== null
}

async function confirmarExclusaoCompleta(codigoPai, img) {
    let orcamento_v2 = baseOrcamento()
    let itensAfetados = []

    for (let codigoItem in orcamento_v2.dados_composicoes) {
        let item = orcamento_v2.dados_composicoes[codigoItem]

        if (item.historico_agrupamentos) {
            let agrupamentosDoPai = item.historico_agrupamentos.filter(hist => hist.item_pai === codigoPai)

            img.parentElement.parentElement.remove() // Equivalente a tr;

            if (agrupamentosDoPai.length > 0) {
                let quantidadeRemover = agrupamentosDoPai.reduce((total, hist) => total + hist.quantidade, 0)
                let quantidadeAtual = parseFloat(item.qtde) || 0
                let novaQuantidade = quantidadeAtual - quantidadeRemover

                if (novaQuantidade <= 0) {
                    delete orcamento_v2.dados_composicoes[codigoItem]
                    itensAfetados.push(`${codigoItem} (removido completamente)`)

                    let linhaFilho = encontrarLinhaItem(codigoItem)
                    if (linhaFilho) {
                        linhaFilho.remove()
                    }
                } else {
                    item.qtde = novaQuantidade

                    item.historico_agrupamentos = item.historico_agrupamentos.filter(hist => hist.item_pai !== codigoPai)

                    if (item.historico_agrupamentos.length === 0) {
                        delete item.historico_agrupamentos
                    }

                    itensAfetados.push(`${codigoItem} (quantidade: ${quantidadeAtual} → ${novaQuantidade})`)

                    atualizarQuantidadeInterface(codigoItem, novaQuantidade)
                }
            }
        }
    }

    delete orcamento_v2.dados_composicoes[codigoPai]
    itensAfetados.push(`${codigoPai} (item pai removido)`)

    try {
        if (img && img.parentElement && img.parentElement.parentElement) {
            img.parentElement.parentElement.remove()
        } else {
            let linhaPai = encontrarLinhaItem(codigoPai)
            if (linhaPai) {
                linhaPai.remove()
            }
        }
    } catch (error) {
        console.error('Erro ao remover linha do pai:', error)
    }

    baseOrcamento(orcamento_v2)
    await total()

    let listaAfetados = itensAfetados.map(item => `<li>${item}</li>`).join('')

    openPopup_v2(`
        <div style="padding: 20px;">
            <div style="text-align: center; margin-bottom: 15px;">
                <img src="imagens/concluido.png" style="width: 50px;">
                <h3 style="color: #4CAF50;">Exclusão Concluída</h3>
            </div>
            <p><strong>Itens afetados:</strong></p>
            <ul style="background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
                ${listaAfetados}
            </ul>
        </div>
    `, 'Resultado da Exclusão')
}

function mostrarHistoricoAgrupamentos(codigo) {
    let orcamento_v2 = baseOrcamento()
    let item = orcamento_v2.dados_composicoes[codigo]

    if (!item || !item.historico_agrupamentos) {
        openPopup_v2(`
            <div style="text-align: center; padding: 20px;">
                <p>Este item não possui histórico de agrupamentos.</p>
            </div>
        `, 'Histórico de Agrupamentos')
        return
    }

    let linhas = item.historico_agrupamentos.map(hist => `
        <tr>
            <td>${hist.item_pai}</td>
            <td>${hist.quantidade}</td>
            <td>${new Date(hist.data_adicao).toLocaleString('pt-BR')}</td>
        </tr>
    `).join('')

    let conteudo = `
        <div style="padding: 20px;">
            <h3>Histórico de Agrupamentos - ${codigo}</h3>
            <p><strong>Quantidade Total:</strong> ${item.qtde}</p>
            
            <table class="tabela" style="width: 100%; margin-top: 15px;">
                <thead style="background-color: #4CAF50;">
                    <tr>
                        <th style="color: white;">Item Pai</th>
                        <th style="color: white;">Quantidade</th>
                        <th style="color: white;">Data de Adição</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `

    openPopup_v2(conteudo, 'Histórico de Agrupamentos')
}

function encontrarLinhaItem(codigo) {
    let tabelas = document.querySelectorAll('[id^="linhas_"]')

    for (let tabela of tabelas) {
        let linhas = tabela.querySelectorAll('tr')
        for (let linha of linhas) {
            let primeiraCelula = linha.querySelector('td')
            if (primeiraCelula && primeiraCelula.textContent.trim() === codigo) {
                return linha
            }
        }
    }
    return null
}

function atualizarVisualizacaoItem(codigo) {
    let linha = encontrarLinhaItem(codigo)
    if (!linha) return

    let tdDescricao = linha.querySelector('td:nth-child(2)')
    if (tdDescricao) {
        let item = baseOrcamento().dados_composicoes[codigo]
        if (item) {
            tdDescricao.innerHTML = item.descricao || 'N/A'
        }
    }
}

async function incluirItemComPai(codigo, novaQuantidade, codigoPai) {
    let orcamento_v2 = baseOrcamento()
    let produto = dados_composicoes[codigo]

    if (!orcamento_v2.dados_composicoes) {
        orcamento_v2.dados_composicoes = {}
    }

    if (orcamento_v2.dados_composicoes[codigo]) {

        let quantidadeAtual = parseFloat(orcamento_v2.dados_composicoes[codigo].qtde) || 0
        let novaQuantidadeTotal = quantidadeAtual + parseFloat(novaQuantidade)

        orcamento_v2.dados_composicoes[codigo].qtde = novaQuantidadeTotal

        if (!orcamento_v2.dados_composicoes[codigo].historico_agrupamentos) {
            orcamento_v2.dados_composicoes[codigo].historico_agrupamentos = []
        }

        orcamento_v2.dados_composicoes[codigo].historico_agrupamentos.push({
            item_pai: codigoPai,
            quantidade: parseFloat(novaQuantidade),
            data_adicao: new Date().toISOString()
        })

        atualizarQuantidadeInterface(codigo, novaQuantidadeTotal)

        baseOrcamento(orcamento_v2)
        await total()
        return
    }

    await incluirItem(codigo, novaQuantidade)

    orcamento_v2 = baseOrcamento()

    if (orcamento_v2.dados_composicoes[codigo]) {
        orcamento_v2.dados_composicoes[codigo].historico_agrupamentos = [{
            item_pai: codigoPai,
            quantidade: parseFloat(novaQuantidade),
            data_adicao: new Date().toISOString()
        }]

        baseOrcamento(orcamento_v2)
    }
}

function atualizarQuantidadeInterface(codigo, novaQuantidade) {
    let linha = encontrarLinhaItem(codigo)
    if (linha) {
        let orcamento_v2 = baseOrcamento()
        let acrescimo = orcamento_v2.lpu_ativa !== 'LPU CARREFOUR' ? 0 : 1
        let celulas = linha.querySelectorAll('td')
        let inputQuantidade = celulas[3 + acrescimo]?.querySelector('input')

        if (inputQuantidade) {
            inputQuantidade.value = novaQuantidade
        }
    }
}

async function enviar_dados() {
    let orcamento_v2 = baseOrcamento()

    if (!orcamento_v2.dados_orcam) {
        return openPopup_v2(avisoHTML('Preencha os dados do Cliente'), 'ALERTA')
    }

    let dados_orcam = orcamento_v2.dados_orcam;
    let chamado = dados_orcam.contrato

    if (dados_orcam.cliente_selecionado === '') {
        return openPopup_v2(avisoHTML('Cliente em branco'), 'ALERTA')
    }

    if (chamado === '') {
        return openPopup_v2(avisoHTML('Chamado em branco'), 'ALERTA')
    }

    let existente = await verificar_chamado_existente(chamado, orcamento_v2.id, false)

    if (chamado !== 'sequencial' && existente?.situacao) {
        return openPopup_v2(avisoHTML('Chamado já Existente'), 'ALERTA')
    }

    if (chamado.slice(0, 1) !== 'D' && chamado !== 'sequencial' && chamado.slice(0, 3) !== 'ORC') {
        return openPopup_v2(avisoHTML('Chamado deve começar com D'), 'ALERTA')
    }

    if (dados_orcam.estado === '') {
        return openPopup_v2(avisoHTML('Estado em branco'), 'ALERTA')
    }

    if (dados_orcam.cnpj === '') {
        return openPopup_v2(avisoHTML('CNPJ em branco'), 'ALERTA')
    }

    if (orcamento_v2.total_desconto > 0 || orcamento_v2.alterado) {
        orcamento_v2.aprovacao = {
            status: 'pendente',
            usuario: acesso.usuario
        }
    }

    if (orcamento_v2.dados_orcam.contrato == 'sequencial') {
        let sequencial = await verificar_chamado_existente(undefined, undefined, true)
        orcamento_v2.dados_orcam.contrato = `ORC_${sequencial.proximo}`
    }

    if (!orcamento_v2.id) {
        orcamento_v2.id = 'ORCA_' + unicoID();
    }

    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
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
    if (aguarde) aguarde.remove()
}

async function ocultarZerados(ocultar) {
    localStorage.setItem('ocultarZerados', JSON.stringify(ocultar))

    let tabelaAgrupamentos = document.querySelector('[id^="agrup_"]')
    if (tabelaAgrupamentos) {
        await exibirTabelaAgrupamentos()
    } else {
        await tabelaProdutos()
    }
}

async function tabelaProdutos() {
    let permissoes = ['adm', 'log', 'editor', 'gerente', 'diretoria', 'coordenacao']
    let moduloComposicoes = permissoes.includes(acesso.permissao)

    let tabelas = { TODOS: { linhas: '' } }

    let ocultarZerados = JSON.parse(localStorage.getItem('ocultarZerados'))

    if (ocultarZerados == null) ocultarZerados = true

    let tabela_itens = document.getElementById('tabela_itens')
    let orcamento_v2 = baseOrcamento()

    if (tabela_itens) {

        dados_composicoes = await recuperarDados('dados_composicoes') || {}
        if (Object.keys(dados_composicoes) == 0) {
            await recuperarComposicoes()
        }

        for (codigo in dados_composicoes) {
            let produto = dados_composicoes[codigo]

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
                lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
            }

            if (produto[lpu] && produto[lpu].ativo && produto[lpu].historico) {
                ativo = produto[lpu].ativo
                historico = produto[lpu].historico
                preco = historico[ativo]?.valor || 0
            }

            if (preco == 0 && ocultarZerados) continue

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
                                <img src="${produto?.imagem || logo}" style="width: 5vw; cursor: pointer;" onclick="ampliar_especial(this, '${codigo}')">
                            </td>
                        </tr>
                    `

                tabelas[produto.tipo].linhas += linha
                tabelas.TODOS.linhas += linha
            }
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

        botoes += `
            <div style="display: flex; align-items: center; justify-content: center; gap: 2px; background-color: #d2d2d2; margin: 3px; border-radius: 3px;">
                <input onchange="ocultarZerados(this.checked)" type="checkbox" style="width: 3vw; cursor: pointer;" ${ocultarZerados ? 'checked' : ''}>
                <label style="padding-right: 2vw;">Ocultar produtos zerados</label>
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

async function gerenciarAgrupamentos(codigo) {
    let orcamento_v2 = baseOrcamento()
    let composicoesOrcamento = orcamento_v2?.dados_composicoes || {}
    let dadosComposicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dadosComposicoes[codigo]
    let linhas = ''
    let lpu = String(document.getElementById('lpu').value).toLocaleLowerCase()

    let kitCompletoOrdenado = [
        [codigo, composicoesOrcamento[codigo].qtde],
        ...Object.entries(produto.agrupamentos)
    ];

    for (let [agrup, qtdeOriginal] of kitCompletoOrdenado) {
        let preco = 0;
        if (dadosComposicoes[agrup] && dadosComposicoes[agrup][lpu]?.historico && dadosComposicoes[agrup][lpu]?.ativo) {
            let ativo = dadosComposicoes[agrup][lpu].ativo;
            let historico = dadosComposicoes[agrup][lpu].historico;
            preco = historico[ativo].valor;
        }

        let qtde = composicoesOrcamento?.[agrup]?.qtde || 0;

        linhas += `
            <tr>
                <td>${agrup}</td>
                <td>${dadosComposicoes[agrup].descricao}</td>
                <td>
                    <div style="display: flex; justify-content: center; align-items: center; gap: 1vw;">
                        <input class="campoValor" type="number" oninput="totalAgrupamentos('${agrup}', this.value)" value="${qtde}">
                        ${agrup == codigo ? `<img src="imagens/construcao.png" style="width: 3vw;">` : `<label class="numero">${qtdeOriginal}</label>`}
                    </div>
                </td>
                <td>
                    <label class="labelAprovacao" style="background-color: ${preco > 0 ? 'green' : '#B12425'}">${dinheiro(preco)}</label>
                </td>
                <td><label></label></td>
                <td>
                    <img src="${dadosComposicoes[agrup]?.imagem || logo}" style="width: 3vw;">
                </td>
            </tr>
            `;
    }
}

async function total() {
    dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let orcamento_v2 = baseOrcamento()
    let lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
    let carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR'
    let totais = { GERAL: { valor: 0, bruto: 0 } }
    let divTabelas = document.getElementById('tabelas')
    let tables = divTabelas.querySelectorAll('table')
    let padraoFiltro = localStorage.getItem('padraoFiltro')
    let estado = orcamento_v2?.dados_orcam?.estado || false
    let avisoDesconto = 0
    let totalAcrescido = 0
    let descontoAcumulado = 0

    if (!orcamento_v2.dados_composicoes) orcamento_v2.dados_composicoes = {}

    for (let codigo in orcamento_v2.dados_composicoes) {
        let inputAtual = encontrarInputQuantidade(codigo)

        if (inputAtual) {
            let quantidadeAtual = parseFloat(inputAtual.value) || 0
            let quantidadeSalva = orcamento_v2.dados_composicoes[codigo].qtde || 0

            if (quantidadeAtual !== quantidadeSalva) {
                orcamento_v2.dados_composicoes[codigo].qtde = quantidadeAtual

                let produto = dados_composicoes[codigo]
                if (produto && produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0) {

                    try {
                        await atualizarQuantidadesFilhos(codigo, quantidadeAtual)
                    } catch (error) {
                        console.error(`❌ Erro ao atualizar filhos do pai ${codigo}:`, error)
                    }
                } else {
                    let item = orcamento_v2.dados_composicoes[codigo]
                    if (item.quantidade_calculada !== undefined) {
                        let novaQuantidadeExtra = quantidadeAtual - item.quantidade_calculada
                        if (novaQuantidadeExtra < 0) novaQuantidadeExtra = 0

                        item.quantidade_extra = novaQuantidadeExtra
                    }
                }
            }
        }
    }

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
            let acrescimo = carrefour ? 1 : 0
            let valorUnitario = 0
            let total = 0
            let precos = { custo: 0, lucro: 0 }
            let descricao = dados_composicoes[codigo].descricao
            let tipo = dados_composicoes[codigo].tipo
            let icmsSaida = 0

            if (!orcamento_v2.dados_composicoes[codigo]) {
                orcamento_v2.dados_composicoes[codigo] = {}
            }

            let itemSalvo = orcamento_v2.dados_composicoes[codigo]
            itemSalvo.codigo = codigo
            tds[1].textContent = dados_composicoes[codigo].descricao

            if (dados_composicoes[codigo].agrupamentos) {
                let img = `<img 
                                src="gifs/lampada.gif" 
                                onclick="lancarTodosAgrupamentos('${codigo}')"
                                style="position: absolute; top: 3px; right: 3px; width: 1.5vw; cursor: pointer;" 
                                >`
                tds[1].insertAdjacentHTML('beforeend', img)
            }

            if (carrefour && dados_composicoes[codigo] && dados_composicoes[codigo].substituto && dados_composicoes[codigo].substituto !== '') {
                codigo = dados_composicoes[codigo].substituto == '' ? codigo : dados_composicoes[codigo].substituto
            }

            let produto = dados_composicoes?.[codigo] || {}
            let ativo = produto?.[lpu]?.ativo || 0
            let historico = produto?.[lpu]?.historico || {}
            precos = historico[ativo]
            valorUnitario = historico?.[ativo]?.valor || 0
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
            let valorTotSemICMS = valorLiqSemICMS * quantidade

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
        let diferencaPorcentagem = diferencaDinheiro == 0 ? 0 : (diferencaDinheiro / totais.GERAL.valor * 100).toFixed(2)

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
    totalAcrescido > 0 ? orcamento_v2.total_acrescido = totalAcrescido : delete orcamento_v2.total_acrescido
    descontoAcumulado > 0 ? orcamento_v2.total_desconto = descontoAcumulado : delete orcamento_v2.total_desconto
    orcamento_v2.total_geral = totais.GERAL.valor
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

    if (avisoDesconto != 0) {
        let avisos = {
            1: 'Preencha os dados do Cliente antes de aplicar descontos',
            2: 'Desconto ultrapassa o permitido',
            3: 'Atualize os valores no ITEM [ICMS Creditado, Custo de Compra...]'
        }

        openPopup_v2(avisoHTML(avisos[avisoDesconto]), 'AVISO')
    }

}

async function alterarValorUnitario(codigo) {

    let produto = dados_composicoes[codigo]
    let lpu = String(document.getElementById('lpu').value).toLowerCase()

    if (lpu == 'lpu carrefour') return openPopup_v2(mensagem('Carrefour não permite mudanças de valores'), 'AVISO')

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

    openPopup_v2(acumulado, 'ALTERAR PREÇO')

}

async function confirmarNovoPreco(codigo, precoOriginal, operacao) {

    let orcamento = baseOrcamento()
    let item = orcamento.dados_composicoes[codigo]

    if (operacao == 'incluir') {
        let valor = Number(document.getElementById('novoValor').value)

        if (precoOriginal >= valor) return openPopup_v2(avisoHTML('O valor precisa ser maior que o Original'), 'AVISO', true)
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
    remover_popup()
}

async function incluirItemOld(codigo, novaQuantidade) {
    let orcamento_v2 = baseOrcamento()
    let carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR'
    let produto = dados_composicoes[codigo]

    let opcoes = ''
    esquemas.sistema.forEach(op => {
        opcoes += `<option ${produto?.sistema == op ? 'selected' : ''}>${op}</option>`
    })

    let linha = `
        <tr>
            <td>${codigo}</td>
            <td style="position: relative;"></td>
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
                <img onclick="ampliar_especial(this, '${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
            </td>
            <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${codigo}', this)" style="cursor: pointer; width: 2vw;"></td>
        </tr>
    `

    if (itemExistenteOld(produto.tipo, codigo, novaQuantidade)) {

        let tbody = document.getElementById(`linhas_${produto.tipo}`)

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

function itemExistenteOld(tipo, codigo, quantidade) {
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

async function atualizarQuantidadesFilhos(codigoPai, novaQuantidadePai) {
    let orcamento_v2 = baseOrcamento()
    let produtoPai = dados_composicoes[codigoPai]

    if (!produtoPai || !produtoPai.agrupamentos) return

    for (let codigoFilho in produtoPai.agrupamentos) {
        let quantidadeBase = produtoPai.agrupamentos[codigoFilho]
        let quantidadeCalculadaDoPai = quantidadeBase * parseFloat(novaQuantidadePai)

        if (itemExisteNoOrcamento(codigoFilho)) {

            if (quantidadeCalculadaDoPai <= 0) {
                let quantidadeExtra = orcamento_v2.dados_composicoes[codigoFilho].quantidade_extra || 0

                if (quantidadeExtra > 0) {
                    orcamento_v2.dados_composicoes[codigoFilho].quantidade_calculada = 0
                    orcamento_v2.dados_composicoes[codigoFilho].qtde = quantidadeExtra

                    let inputFilho = encontrarInputQuantidade(codigoFilho)
                    if (inputFilho) {
                        inputFilho.value = quantidadeExtra
                    }
                } else {
                    delete orcamento_v2.dados_composicoes[codigoFilho]
                    let linhaFilho = encontrarLinhaItem(codigoFilho)
                    if (linhaFilho) {
                        linhaFilho.remove()
                    }
                }
            } else {
                let itemFilho = orcamento_v2.dados_composicoes[codigoFilho]

                let quantidadeExtra = itemFilho.quantidade_extra || 0

                let novaQuantidadeTotal = quantidadeCalculadaDoPai + quantidadeExtra

                itemFilho.quantidade_calculada = quantidadeCalculadaDoPai
                itemFilho.quantidade_extra = quantidadeExtra
                itemFilho.qtde = novaQuantidadeTotal

                let inputFilho = encontrarInputQuantidade(codigoFilho)
                if (inputFilho) {
                    inputFilho.value = novaQuantidadeTotal
                }
            }
        } else {
            continue
        }
    }

    baseOrcamento(orcamento_v2)
}

async function removerInfluenciaDoPai(codigoPai) {
    let orcamento_v2 = baseOrcamento();
    let produtoPai = dados_composicoes[codigoPai];

    if (!produtoPai || !produtoPai.agrupamentos) return;

    for (let codigoFilho in produtoPai.agrupamentos) {
        if (itemExisteNoOrcamento(codigoFilho)) {
            let itemFilho = orcamento_v2.dados_composicoes[codigoFilho];
            let quantidadeExtra = itemFilho.quantidade_extra || 0;

            let quantidadeBase = produtoPai.agrupamentos[codigoFilho];
            let quantidadePaiAtual = orcamento_v2.dados_composicoes[codigoPai]?.qtde || 0;
            let quantidadeDoPai = quantidadeBase * quantidadePaiAtual;

            let novaQuantidade = (parseFloat(itemFilho.qtde) || 0) - quantidadeDoPai;

            if (novaQuantidade > 0) {
                itemFilho.qtde = novaQuantidade;
                itemFilho.quantidade_calculada = 0;
                let inputFilho = encontrarInputQuantidade(codigoFilho);
                if (inputFilho) inputFilho.value = novaQuantidade;
            } else {
                delete orcamento_v2.dados_composicoes[codigoFilho];
                let linhaFilho = encontrarLinhaItem(codigoFilho);
                if (linhaFilho) linhaFilho.remove();
            }
        }
    }

    baseOrcamento(orcamento_v2);

    await total();
}

function encontrarInputQuantidade(codigo) {
    let tabelas = document.querySelectorAll('[id^="linhas_"]')

    for (let tabela of tabelas) {
        let linhas = tabela.querySelectorAll('tr')
        for (let linha of linhas) {
            let primeiraCelula = linha.querySelector('td')
            if (primeiraCelula && primeiraCelula.textContent.trim() === codigo) {
                let orcamento_v2 = baseOrcamento()
                let acrescimo = orcamento_v2.lpu_ativa !== 'LPU CARREFOUR' ? 0 : 1
                let celulas = linha.querySelectorAll('td')
                let inputQuantidade = celulas[3 + acrescimo]?.querySelector('input[type="number"]')
                return inputQuantidade
            }
        }
    }
    return null
}

async function exibirTabelaAgrupamentosLancar(codigoPai, qtdePai) {
    let dadosComposicoes = await recuperarDados('dados_composicoes') || {};
    let produtoPai = dadosComposicoes[codigoPai];
    let lpu = String(baseOrcamento().lpu_ativa || 'lpu hope').toLowerCase();
    let linhas = '';
    let filhos = Object.entries(produtoPai.agrupamentos);

    let inputPai = encontrarInputQuantidade(codigoPai);
    let quantidadePai = inputPai ? parseFloat(inputPai.value) || 0 : (qtdePai || 0);

    filhos.forEach(([codigoFilho, qtdeBase]) => {
        let prodFilho = dadosComposicoes[codigoFilho];
        let preco = 0;
        if (prodFilho[lpu] && prodFilho[lpu].ativo && prodFilho[lpu].historico) {
            let ativo = prodFilho[lpu].ativo;
            let historico = prodFilho[lpu].historico;
            preco = historico[ativo]?.valor || 0;
        }
        let qtdeTotal = qtdeBase * quantidadePai;
        linhas += `
            <tr data-codigofilho="${codigoFilho}">
                <td style="font-weight:600; color:#444;">${codigoFilho}</td>
                <td>
                    <span style="font-weight:500;">${prodFilho.descricao}</span>
                    <span style="background:#e3f1ff; color:#24729d; border-radius:3px; padding:2px 8px; font-size:0.85em; margin-left:8px;">
                        Pai: <b>${codigoPai}</b>
                    </span>
                </td>
                <td style="text-align:center; color:#888;">${qtdeBase}</td>
                <td style="text-align:center; font-weight:600;">${qtdeTotal}</td>
                <td style="text-align:right;">${dinheiro(preco)}</td>
                <td style="text-align:right; font-weight:600;">${dinheiro(preco * qtdeTotal)}</td>
            </tr>
        `;
    });

    let popup = `
        <div style="max-width:700px; margin:auto;">
            <h2 style="color:#24729d; font-size:1.4em; margin-bottom:18px; text-align:center;">
                Itens Agrupados de <span style="color:#4CAF50;">${codigoPai}</span>
            </h2>
            <table style="width:100%; border-collapse:separate; border-spacing:0 6px; background:#fff; border-radius:8px; box-shadow:0 2px 8px #0001;">
                <thead>
                    <tr style="background:#f5f7fa;">
                        <th style="padding:8px 6px; color:#24729d; font-size:1em; border-radius:8px 0 0 0;">Código</th>
                        <th style="padding:8px 6px; color:#24729d;">Descrição</th>
                        <th style="padding:8px 6px; color:#24729d;">Qtde Base</th>
                        <th style="padding:8px 6px; color:#24729d;">Qtde Total</th>
                        <th style="padding:8px 6px; color:#24729d;">Valor Unit.</th>
                        <th style="padding:8px 6px; color:#24729d; border-radius:0 8px 0 0;">Valor Total</th>
                    </tr>
                </thead>
                <tbody id="agrupamentos-body">
                    ${linhas}
                </tbody>
            </table>
            <div style="text-align:right; margin-top:24px;">
                <button onclick="lancarTodosAgrupamentos('${codigoPai}')"
                    style="background:#4CAF50; color:white; padding:12px 32px; border:none; border-radius:5px; font-size:1.1em; font-weight:600; box-shadow:0 2px 8px #0002; cursor:pointer; transition:background 0.2s;">
                    Lançar todos os itens agrupados
                </button>
            </div>
        </div>
    `;
    openPopup_v2(popup, 'Agrupamentos');
}

async function lancarTodosAgrupamentos(codigoPai) {
    let dadosComposicoes = await recuperarDados('dados_composicoes') || {};
    let produtoPai = dadosComposicoes[codigoPai];
    if (!produtoPai || !produtoPai.agrupamentos) return;

    let orcamento_v2 = baseOrcamento();
    let quantidadePai = orcamento_v2.dados_composicoes?.[codigoPai]?.qtde || 0;

    let count = 0;
    for (let codigoFilho in produtoPai.agrupamentos) {
        let qtdeBase = produtoPai.agrupamentos[codigoFilho];
        let qtdeTotal = qtdeBase * quantidadePai;
        if (qtdeTotal > 0) {
            await incluirItemComPai(codigoFilho, qtdeTotal, codigoPai);
            count++;
        }
    }
    await carregarTabelas();
    openPopup_v2(`<div style="padding:20px;text-align:center;"><img src="imagens/concluido.png" style="width:50px;"><p>${count} itens agrupados lançados!</p></div>`, 'Sucesso');
}

async function incluirItem(codigo, novaQuantidade) {
    let orcamento_v2 = baseOrcamento()
    let carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR'
    let produto = dados_composicoes[codigo]

    if (orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo]) {
        await atualizarQuantidadesFilhos(codigo, novaQuantidade)
    }

    if (produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0) {
        let itensLancados = Object.keys(produto.agrupamentos).map(codigoFilho => {
            let qtde = produto.agrupamentos[codigoFilho] * parseFloat(novaQuantidade)
            let descricaoFilho = dados_composicoes[codigoFilho]?.descricao || codigoFilho
            return `<li>${codigoFilho} - ${descricaoFilho} (Qtde: ${qtde})</li>`
        }).join('')

        openPopup_v2(`
            <div style="padding: 20px;">
                <div style="text-align: center; margin-bottom: 15px;">
                    <img src="gifs/lampada.gif" style="width: 50px;">
                    <h3 style="color: #4CAF50;">Agrupamento Lançado!</h3>
                </div>
                <p>O item <strong>${codigo}</strong> (${produto.descricao}) foi adicionado com seus agrupamentos:</p>
                <ul style="background-color: #f5f5f5; padding: 10px; border-radius: 5px; margin: 10px 0;">
                    ${itensLancados}
                </ul>
                <p style="font-size: 0.9em; color: #666;">
                    <strong>Dica:</strong> Ao remover o item pai, as quantidades dos itens filhos serão reduzidas automaticamente.
                </p>
            </div>
        `, 'Agrupamento Adicionado', false, 4000)
    }

    let opcoes = ''
    esquemas.sistema.forEach(op => {
        opcoes += `<option ${produto?.sistema == op ? 'selected' : ''}>${op}</option>`
    })

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
                <img onclick="ampliar_especial(this, '${codigo}')" src="${produto?.imagem || logo}" style="width: 3vw; cursor: pointer;">
            </td>
            <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${codigo}', this)" style="cursor: pointer; width: 2vw;"></td>
        </tr>
    `

    if (itemExistente(produto.tipo, codigo, novaQuantidade)) {

        let tbody = document.getElementById(`linhas_${produto.tipo}`)

        if (!tbody) { // Lançamento do 1º Item de cada tipo;

            if (!orcamento_v2.dados_composicoes) {
                orcamento_v2.dados_composicoes = {}
            }

            orcamento_v2.dados_composicoes[codigo] = {
                codigo: codigo,
                qtde: parseFloat(novaQuantidade),
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
    mostrarTabela(produto.tipo)
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

            let inputQuantidade = tds[3 + acrescimo].querySelector('input')
            let novaQuantidadeTotal = parseFloat(quantidade)

            inputQuantidade.value = novaQuantidadeTotal

            if (orcamento_v2.dados_composicoes[codigo]) {
                orcamento_v2.dados_composicoes[codigo].qtde = novaQuantidadeTotal
                baseOrcamento(orcamento_v2)
            }
        }
    })

    return incluir
}

function mostrarDetalhesAgrupamento(codigo) {
    let produto = dados_composicoes[codigo]

    if (!produto || !produto.agrupamentos || Object.keys(produto.agrupamentos).length === 0) {
        openPopup_v2(`
            <div style="text-align: center; padding: 20px;">
                <p>Este item não possui agrupamentos.</p>
            </div>
        `, 'Detalhes do Agrupamento')
        return
    }

    let linhas = Object.entries(produto.agrupamentos).map(([codigoFilho, quantidade]) => {
        let descricaoFilho = dados_composicoes[codigoFilho]?.descricao || 'N/A'
        return `
            <tr>
                <td>${codigoFilho}</td>
                <td>${descricaoFilho}</td>
                <td style="text-align: center;">${quantidade}</td>
            </tr>
        `
    }).join('')

    let conteudo = `
        <div style="padding: 20px;">
            <h3>Agrupamentos do Item: ${codigo}</h3>
            <p><strong>Descrição:</strong> ${produto.descricao}</p>
            
            <table class="tabela" style="width: 100%; margin-top: 15px;">
                <thead style="background-color: #4CAF50;">
                    <tr>
                        <th style="color: white;">Código</th>
                        <th style="color: white;">Descrição</th>
                        <th style="color: white;">Quantidade</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
        </div>
    `

    openPopup_v2(conteudo, 'Detalhes do Agrupamento')
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

async function carregarClientes(textarea) {
    let dados_clientes = await recuperarDados('dados_clientes') || {};
    let pesquisa = String(textarea.value).replace(/[./-]/g, '').toLowerCase()
    let opcoes = ''
    let div = document.getElementById('div_sugestoes')
    if (div) div.remove()

    for (cnpj in dados_clientes) {
        var cliente = dados_clientes[cnpj]
        let nome = cliente.nome.toLowerCase()
        let cnpj_sem_format = cnpj.replace(/[./-]/g, '')

        if (nome.includes(pesquisa) || cnpj_sem_format.includes(pesquisa)) {
            opcoes += `
            <div onclick="selecionarCliente('${cnpj}', '${cliente.nome}')" class="autocomplete-item" style="text-align: left; padding: 0px; gap: 0px; display: flex; flex-direction: column; align-items: start; justify-content: start; padding: 2px; border-bottom: solid 1px #d2d2d2;">
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

    let posicao = textarea.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let div_sugestoes = `
        <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
            ${opcoes}
        </div>
    `
    document.body.insertAdjacentHTML('beforeend', div_sugestoes)
}

async function selecionarCliente(cnpj, nome) {
    let dados_clientes = await recuperarDados('dados_clientes') || {};
    let cliente = dados_clientes[cnpj]

    document.getElementById('cnpj').textContent = cnpj
    document.getElementById('cep').textContent = cliente.cep
    document.getElementById('bairro').textContent = cliente.bairro
    document.getElementById('cidade').textContent = cliente.cidade
    document.getElementById('estado').textContent = cliente.estado

    document.getElementById('div_sugestoes').remove()

    let textarea = document.getElementById('cliente_selecionado')
    textarea.value = nome
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
    let dados_vendedores = {
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

    let vendedores = Object.keys(dados_vendedores)

    let select = document.getElementById('vendedor')

    select.addEventListener('change', function () {
        atualizar_dados_vendedores()
        salvar_preenchido()
    })

    vendedores.forEach(function (vend_) {
        var option = document.createElement('option')
        option.textContent = vend_
        select.appendChild(option)
    })

    let dados_acesso = JSON.parse(localStorage.getItem('acesso'))

    document.getElementById('analista').textContent = dados_acesso.nome_completo
    document.getElementById('email_analista').textContent = dados_acesso.email
    document.getElementById('telefone_analista').textContent = dados_acesso.telefone

    atualizar_dados_vendedores()
}

function atualizar_dados_vendedores() {
    let dados_vendedores = JSON.parse(localStorage.getItem('vendedores'))
    let vendedor = document.getElementById('vendedor').value
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
    let orcamento_v2 = baseOrcamento()

    if (orcamento_v2.levantamentos) {
        delete orcamento_v2.levantamentos[chave]

        baseOrcamento(orcamento_v2)
    }
}

function painel_clientes() {
    let orcamento_v2 = baseOrcamento()
    let dados_orcam = orcamento_v2?.dados_orcam || {}
    let levantamentos = ''

    let dados_pagamentos = ["--", "15 dias", "30 dias", "45 dias", "60 dias", "75 dias", "90 dias", "120 dias", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]
    let condicoes = ''
    dados_pagamentos.forEach(pag => {
        condicoes += `
            <option ${dados_orcam?.condicoes == pag ? 'selected' : ''}>${pag}</option>
        `
    })

    for (chave in orcamento_v2?.levantamentos || {}) {
        let levantamento = orcamento_v2.levantamentos[chave]
        levantamentos += criarAnexoVisual(levantamento.nome, levantamento.link, `excluir_levantamento('${chave}')`)
    }

    let modelo = (valor1, valor2, idElemento) => {
        return `
            <div class="linha">
                <label>${valor1}</label>
                <div style="display: flex; 
                align-items: center; 
                justify-content: end; 
                gap: 5px; 
                width: 65%; 
                margin-right: 10px;" 
                ${idElemento ? `id="${idElemento}"` : ''}>${valor2 ? valor2 : ''}</div>
            </div>
        `
    }

    let acumulado = `

    <div style="background-color: #d2d2d2; padding: 10px; width: 30vw;">

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

        <div style="display: flex; flex-direction: column; gap: 5px; justify-content: center; align-items: start; border-radius: 3px; margin: 5px;">

            <label style="font-size: 1.5vw;">Dados do Cliente</label>

            ${modelo('Chamado', `<input id="contrato" style="display: ${dados_orcam?.contrato == 'sequencial' ? 'none' : ''};" placeholder="nº do Chamado" onchange="salvar_preenchido()" value="${dados_orcam?.contrato || ''}">
                <input id="chamado_off" style="width: 2vw; height: 2vw; cursor: pointer;" type="checkbox"
                        onchange="salvar_preenchido()" ${dados_orcam?.contrato == 'sequencial' ? 'checked' : ''}>
                <label style="white-space: nowrap;">Sem Chamado</label>`)}
            ${modelo('Cliente', `<textarea class="autocomplete-input" id="cliente_selecionado" placeholder="Nome do Cliente" oninput="carregarClientes(this)">${dados_orcam?.cliente_selecionado || ''}</textarea>`)}
            ${modelo('CNPJ/CPF', dados_orcam?.cnpj, 'cnpj')}
            ${modelo('Endereço', dados_orcam?.bairro, 'bairro')}
            ${modelo('CEP', dados_orcam?.cep, 'cep')}
            ${modelo('Cidade', dados_orcam?.cidade, 'cidade')}
            ${modelo('Estado', dados_orcam?.estado, 'estado')}
            ${modelo('Tipo de Frete', `<select id="tipo_de_frete" onchange="salvar_preenchido()">
                    <option ${dados_orcam?.tipo_de_frete == '--' ? 'selected' : ''}>--</option>
                    <option ${dados_orcam?.tipo_de_frete == 'CIF' ? 'selected' : ''}>CIF</option>
                    <option ${dados_orcam?.tipo_de_frete == 'FOB' ? 'selected' : ''}>FOB</option>
                </select>`, 'estado')}
            ${modelo('Transportadora', `<input type="text" id="transportadora" oninput="salvar_preenchido()" value="${dados_orcam?.transportadora || '--'}">`)}
            ${modelo('Considerações', `<div style="display: flex; flex-direction: column; align-items: start; justify-content: center; width: 100%;">
                    <textarea id="consideracoes" oninput="salvar_preenchido()" rows="5" style="resize: none; width: 100%; font-size: 1.0vw;"
                    placeholder="Escopo do orçamento">${dados_orcam?.consideracoes || ''}</textarea>

                    <div class="contorno_botoes" style="background-color: #222;">
                        <img src="imagens/anexo2.png" style="width: 1.5vw;">
                        <label style="width: 100%;" for="adicionar_levantamento">Anexar levantamento
                            <input type="file" id="adicionar_levantamento" style="display: none;"
                                onchange="salvar_levantamento()">
                        </label>
                    </div>

                    ${levantamentos}
                </div>
                `)}
            ${modelo('Pagamento',
        `<select id="condicoes" oninput="salvar_preenchido()">
                    ${condicoes}
                </select>`)}
            ${modelo('Garantia', `<input id="garantia" oninput="salvar_preenchido()" value="${dados_orcam?.garantia || 'Conforme tratativa Comercial'}">`)}

            <label style="font-size: 1.5vw;">Dados do Analista</label>
            ${modelo('Analista', dados_orcam?.analista, 'analista')}
            ${modelo('E-mail', dados_orcam?.email_analista, 'email_analista')}
            ${modelo('Telefone', dados_orcam?.telefone_analista, 'telefone_analista')}

            <label style="font-size: 1.5vw;">Dados do Vendedor</label>
            ${modelo('Vendedor', `<select style="text-align: center; width: 100%;" id="vendedor" oninput="salvar_preenchido()"></select>`)}
            ${modelo('E-mail', '', 'email_vendedor')}
            ${modelo('Telefone', '', 'telefone_vendedor')}

            <label style="font-size: 1.5vw;">Quem emite essa nota?</label>

            ${modelo('Empresa', `<select style="text-align: center; width: 100%;" id="emissor" oninput="salvar_preenchido()">
                    <option ${dados_orcam?.emissor == 'AC SOLUÇÕES' ? 'selected' : ''}>AC SOLUÇÕES</option>
                    <option ${dados_orcam?.emissor == 'HNW' ? 'selected' : ''}>HNW</option>
                    <option ${dados_orcam?.emissor == 'HNK' ? 'selected' : ''}>HNK</option>
                </select>`)}
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

document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('btnTabelaAgrupamentos');
    if (btn) {
        btn.addEventListener('click', exibirTabelaAgrupamentosLancarGlobal);
    }
});

async function exibirTabelaAgrupamentosLancarGlobal() {
    let orcamento_v2 = baseOrcamento();
    let dadosComposicoes = await recuperarDados('dados_composicoes') || {};
    let linhas = '';
    let filhosAgrupados = [];

    for (let codigoPai in orcamento_v2.dados_composicoes) {
        let produtoPai = dadosComposicoes[codigoPai];
        let quantidadePai = orcamento_v2.dados_composicoes[codigoPai]?.qtde || 0;
        if (!produtoPai || !produtoPai.agrupamentos) continue;

        for (let [codigoFilho, qtdeBase] of Object.entries(produtoPai.agrupamentos)) {
            let prodFilho = dadosComposicoes[codigoFilho];
            if (!prodFilho) continue;
            let lpu = String(baseOrcamento().lpu_ativa || 'lpu hope').toLowerCase();
            let preco = 0;
            if (prodFilho[lpu] && prodFilho[lpu].ativo && prodFilho[lpu].historico) {
                let ativo = prodFilho[lpu].ativo;
                let historico = prodFilho[lpu].historico;
                preco = historico[ativo]?.valor || 0;
            }
            let qtdeTotal = qtdeBase * quantidadePai;

            filhosAgrupados.push({
                codigoFilho,
                descricaoFilho: prodFilho.descricao,
                codigoPai,
                descricaoPai: produtoPai.descricao,
                qtdeBase,
                qtdeTotal,
                preco
            });
        }
    }

    if (filhosAgrupados.length === 0) {
        openPopup_v2('<div style="padding:20px;text-align:center;">Nenhum item agrupado encontrado no orçamento.</div>', 'Itens Agrupados');
        return;
    }

    let totalGeral = 0;
    filhosAgrupados.forEach(item => {
        const tipoFilho = dadosComposicoes[item.codigoFilho]?.tipo || '';
        const tipoPai = dadosComposicoes[item.codigoPai]?.tipo || '';
        const corTipoFilho = coresTabelas(tipoFilho);
        const corTipoPai = coresTabelas(tipoPai);
        const valorTotal = item.preco * item.qtdeTotal;
        totalGeral += valorTotal;
        linhas += `
            <tr data-codigofilho="${item.codigoFilho}" data-codigopai="${item.codigoPai}">
                <td style="font-weight:600; color:#fff; background:${corTipoPai};">
                    ${item.codigoPai}
                </td>
                <td>
                    <span style="font-weight:500;">${item.descricaoPai}</span>
                </td>
                <td style="text-align:center;" >
                    <span style="
                        color:#fff;
                        background:${corTipoFilho};
                        border-radius:3px;
                        padding:2px 10px;
                        font-size:0.98em;
                        font-weight:600;
                        display:inline-block;
                        min-width:60px;
                    ">
                        ${item.codigoFilho}
                    </span>
                </td>
                <td>
                    <span style="font-weight:500;">${item.descricaoFilho}</span>
                </td>
                <td style="text-align:center; color:#888;">${item.qtdeBase}</td>
                <td style="text-align:center; font-weight:600;" class="qtde-total">${item.qtdeTotal}</td>
                <td style="text-align:right;">${dinheiro(item.preco)}</td>
                <td style="text-align:right; font-weight:600;">${dinheiro(valorTotal)}</td>
            </tr>
        `;
    });

    let popup = `
        <div style="margin:auto; background:#fff; border-radius:14px; box-shadow:0 2px 16px #0002; padding:32px 24px;">
            <h2 style="color:#222; font-size:1.4em; margin-bottom:24px; text-align:center; letter-spacing:1px;">
                Agrupamentos
            </h2>
            <div style="overflow-x:auto;">
            <table style="
                width:100%;
                border-collapse:separate;
                border-spacing:0;
                font-family:'Poppins',sans-serif;
                font-size:1em;
                background:#f9fafb;
                border-radius:10px;
                overflow:hidden;
            ">
                <thead>
                    <tr style="background:#f0f4f8;">
                        <th style="padding:12px 8px; color:#222; font-weight:600; border-bottom:2px solid #e3e8ee;">Código Pai</th>
                        <th style="padding:12px 8px; color:#222; font-weight:600; border-bottom:2px solid #e3e8ee;">Descrição Pai</th>
                        <th style="padding:12px 8px; color:#222; font-weight:600; border-bottom:2px solid #e3e8ee;">Código Filho</th>
                        <th style="padding:12px 8px; color:#222; font-weight:600; border-bottom:2px solid #e3e8ee;">Descrição Filho</th>
                        <th style="padding:12px 8px; color:#222; font-weight:600; border-bottom:2px solid #e3e8ee;">Qtde Base</th>
                        <th style="padding:12px 8px; color:#222; font-weight:600; border-bottom:2px solid #e3e8ee;">Qtde Total</th>
                        <th style="padding:12px 8px; color:#222; font-weight:600; border-bottom:2px solid #e3e8ee;">Valor Unit.</th>
                        <th style="padding:12px 8px; color:#222; font-weight:600; border-bottom:2px solid #e3e8ee;">Valor Total</th>
                    </tr>
                </thead>
                <tbody id="agrupamentos-body">
                    ${linhas}
                </tbody>
            </table>
            </div>
            <div style="margin-top:18px; text-align:right;">
                <span style="
                    background:#f0f4f8;
                    color:#222;
                    font-size:1.18em;
                    font-weight:700;
                    border-radius:6px;
                    padding:10px 28px;
                    box-shadow:0 1px 6px #0001;
                    display:inline-block;
                    margin-bottom:10px;
                ">
                    Total Geral: ${dinheiro(totalGeral)}
                </span>
            </div>
        </div>
    `;
    openPopup_v2(popup, 'Itens Agrupados');
}

async function lancarTodosAgrupamentosGlobal() {
    let tbody = document.getElementById('agrupamentos-body');
    let trs = tbody.querySelectorAll('tr');
    let count = 0;
    for (let tr of trs) {
        let codigoFilho = tr.getAttribute('data-codigofilho');
        let codigoPai = tr.getAttribute('data-codigopai');
        let qtdeTotal = parseFloat(tr.querySelector('.qtde-total').textContent) || 0;
        if (qtdeTotal > 0) {
            await incluirItemComPai(codigoFilho, qtdeTotal, codigoPai);
            count++;
        }
    }
    remover_popup();
    await carregarTabelas();
    openPopup_v2(`<div style="padding:20px;text-align:center;"><img src="imagens/concluido.png" style="width:50px;"><p>${count} itens agrupados lançados!</p></div>`, 'Sucesso');
}