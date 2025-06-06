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

    // Buscar TODOS os produtos com agrupamentos (não apenas os do orçamento)
    for (let codigo in dadosComposicoes) {
        let produto = dadosComposicoes[codigo]

        // Verificar se o produto tem agrupamentos
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
            // Verificar se o item já está no orçamento para mostrar quantidade atual
            let quantidadeAtual = orcamento_v2.dados_composicoes?.[codigo]?.qtde || ''

            let td_quantidade = `
                <input type="number" class="campoValor" oninput="incluirItem('${codigo}', this.value)" value="${quantidadeAtual}">
            `
            let opcoes = ''
            esquemas.sistema.forEach(op => {
                opcoes += `<option ${produto?.sistema == op ? 'selected' : ''}>${op}</option>`
            })

            // Indicador visual se o item já está no orçamento
            let indicadorOrcamento = quantidadeAtual ?
                `<div style="display: flex; align-items: center; gap: 5px;">
                    <img src="imagens/check.png" style="width: 12px;" title="Item já está no orçamento">
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
                        <label ${moduloComposicoes ? `onclick="abrir_historico_de_precos('${codigo}', '${lpu}')"` : ''} class="${preco != 0 ? 'valor_preenchido' : 'valor_zero'}">${dinheiro(preco)}</label>
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

    // Sempre exibir a tabela, mesmo se não houver itens
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

    // Verificar se há pelo menos uma tabela com conteúdo
    for (let tabela in tabelas) {
        if (tabelas[tabela].linhas !== '') {
            temItens = true
            break
        }
    }

    // Se não tem itens, criar uma mensagem informativa
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

    // Adicionar estatísticas
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
        <div style="display: flex; gap: 20px; justify-content: center; align-items: center; background-color: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; margin: 10px 0;">
            <div style="text-align: center; color: white;">
                <div style="font-size: 1.5em; font-weight: bold;">${totalItensComAgrupamentos}</div>
                <div style="font-size: 0.9em;">Total de itens com Agrupamentos</div>
            </div>
            <div style="text-align: center; color: white;">
                <div style="font-size: 1.5em; font-weight: bold; color: #4CAF50;">${itensNoOrcamento}</div>
                <div style="font-size: 0.9em;">No Orçamento Atual</div>
            </div>
            <div style="text-align: center; color: white;">
                <div style="font-size: 1.5em; font-weight: bold; color: #FFA500;">${temItens ? Object.keys(tabelas).length - 1 : 0}</div>
                <div style="font-size: 0.9em;">Tipos Disponíveis</div>
            </div>
        </div>
    `

    let conteudoPopup = `
        <div style="max-width: 90vw; overflow-y: auto; background-color: rgb(21, 23, 73);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #4CAF50;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="gifs/lampada.gif" style="width: 30px; height: 30px;">
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

    // Sempre mostrar a primeira tabela disponível
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

    // Atualizar quantidade total
    document.getElementById(`total_${codigo}`).textContent = qtdeTotal

    // Atualizar valor total da linha
    let valorTotalElement = document.getElementById(`valorTotal_${codigo}`)
    if (valorTotalElement) {
        let estiloPreco = preco == 0 ? 'valor_zero' : 'valor_preenchido'
        valorTotalElement.innerHTML = `<label class="${estiloPreco}">${dinheiro(valorTotal)}</label>`
    }

    // Recalcular total geral
    calcularTotalKitGeral()
}

function calcularTotalKitGeral() {
    let totalGeral = 0
    let tabela = document.querySelector('.tabela tbody')
    if (!tabela) return

    let linhas = tabela.querySelectorAll('tr')
    linhas.forEach(linha => {
        let tds = linha.querySelectorAll('td')
        // Pegar o valor total da coluna "Valor Total" (índice 6)
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
    // Encontrar a linha do item específico
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

        await atualizarOpcoesLPU() // Já carrega as tabelas do Orcamento_V2

    } else {

        carregar_layout_modalidade_livre()

    }

}

// Modalidade Livre ativação remota;
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

// Modificar a função removerItem para detectar se é um item com agrupamentos
async function removerItem(codigo, img) {
    let orcamento_v2 = baseOrcamento()

    if (orcamento_v2.dados_composicoes[codigo]) {
        let produto = dados_composicoes[codigo]
        let temAgrupamentos = produto && produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0

        // Verificar se este item é pai de outros itens (através de agrupamentos OU histórico)
        let itensFilhos = []

        if (temAgrupamentos) {
            // Se tem agrupamentos, verificar quais itens filhos existem no orçamento
            for (let codigoFilho in produto.agrupamentos) {
                if (orcamento_v2.dados_composicoes[codigoFilho]) {
                    let itemFilho = orcamento_v2.dados_composicoes[codigoFilho]

                    // Verificar se este item filho tem este código como pai no histórico
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
            // Verificação original para itens que não têm agrupamentos mas podem ser pais
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

        // Se tem filhos, perguntar se quer excluir todos
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

        // Se não tem filhos, excluir normalmente
        delete orcamento_v2.dados_composicoes[codigo]
        baseOrcamento(orcamento_v2)

        // Verificação de segurança para remover a linha
        try {
            if (img && img.parentElement && img.parentElement.parentElement) {
                img.parentElement.parentElement.remove()
            } else {
                // Fallback: encontrar e remover a linha pelo código
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

// Função auxiliar melhorada para verificar existência
function itemExisteNoOrcamento(codigo) {
    let orcamento_v2 = baseOrcamento()
    let existe = orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo]
    return existe
}


// Função para verificar se um item existe na interface
function itemExisteNaInterface(codigo) {
    return encontrarLinhaItem(codigo) !== null
}

// Corrigir a função confirmarExclusaoCompleta para receber o parâmetro img
async function confirmarExclusaoCompleta(codigoPai, img) {
    let orcamento_v2 = baseOrcamento()
    let itensAfetados = []

    console.log('Iniciando exclusão completa para:', codigoPai)

    // Encontrar e processar todos os itens filhos
    for (let codigoItem in orcamento_v2.dados_composicoes) {
        let item = orcamento_v2.dados_composicoes[codigoItem]

        if (item.historico_agrupamentos) {
            // Filtrar apenas os agrupamentos deste pai específico
            let agrupamentosDoPai = item.historico_agrupamentos.filter(hist => hist.item_pai === codigoPai)

            img.parentElement.parentElement.remove() // Equivalente a tr;

            if (agrupamentosDoPai.length > 0) {
                // Calcular quantidade total a ser removida deste pai
                let quantidadeRemover = agrupamentosDoPai.reduce((total, hist) => total + hist.quantidade, 0)
                let quantidadeAtual = parseFloat(item.qtde) || 0
                let novaQuantidade = quantidadeAtual - quantidadeRemover

                console.log(`Item ${codigoItem}: atual=${quantidadeAtual}, remover=${quantidadeRemover}, nova=${novaQuantidade}`)

                if (novaQuantidade <= 0) {
                    // Se a quantidade ficar zero ou negativa, remover o item completamente
                    delete orcamento_v2.dados_composicoes[codigoItem]
                    itensAfetados.push(`${codigoItem} (removido completamente)`)

                    let linhaFilho = encontrarLinhaItem(codigoItem)
                    if (linhaFilho) {
                        linhaFilho.remove()
                    }
                } else {
                    // Manter o item mas reduzir a quantidade
                    item.qtde = novaQuantidade

                    // Remover apenas os históricos deste pai
                    item.historico_agrupamentos = item.historico_agrupamentos.filter(hist => hist.item_pai !== codigoPai)

                    // Se não sobrou nenhum histórico de agrupamento, limpar a propriedade
                    if (item.historico_agrupamentos.length === 0) {
                        delete item.historico_agrupamentos
                    }

                    itensAfetados.push(`${codigoItem} (quantidade: ${quantidadeAtual} → ${novaQuantidade})`)

                    // Atualizar quantidade na interface
                    atualizarQuantidadeInterface(codigoItem, novaQuantidade)
                }
            }
        }
    }

    // Excluir o item pai
    delete orcamento_v2.dados_composicoes[codigoPai]
    itensAfetados.push(`${codigoPai} (item pai removido)`)

    // Remover linha do pai da interface
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

// Função para mostrar detalhes do histórico de agrupamentos (opcional - para debug/informação)
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

// Função auxiliar para encontrar linha de um item
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

// Função auxiliar para atualizar a visualização de um item (remover indicação de agrupamento)
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

// Corrigir a função incluirItemComPai para garantir que o histórico seja salvo
async function incluirItemComPai(codigo, novaQuantidade, codigoPai) {
    let orcamento_v2 = baseOrcamento()
    let produto = dados_composicoes[codigo]

    if (!orcamento_v2.dados_composicoes) {
        orcamento_v2.dados_composicoes = {}
    }

    console.log(`Adicionando item ${codigo}, quantidade ${novaQuantidade}, pai ${codigoPai}`)

    // Verificar se o item já existe
    if (orcamento_v2.dados_composicoes[codigo]) {
        console.log('Item já existe, somando quantidade')

        // Item já existe - somar a quantidade
        let quantidadeAtual = parseFloat(orcamento_v2.dados_composicoes[codigo].qtde) || 0
        let novaQuantidadeTotal = quantidadeAtual + parseFloat(novaQuantidade)

        orcamento_v2.dados_composicoes[codigo].qtde = novaQuantidadeTotal

        // Adicionar o histórico de agrupamentos para controle de remoção
        if (!orcamento_v2.dados_composicoes[codigo].historico_agrupamentos) {
            orcamento_v2.dados_composicoes[codigo].historico_agrupamentos = []
        }

        orcamento_v2.dados_composicoes[codigo].historico_agrupamentos.push({
            item_pai: codigoPai,
            quantidade: parseFloat(novaQuantidade),
            data_adicao: new Date().toISOString()
        })

        console.log('Histórico atualizado:', orcamento_v2.dados_composicoes[codigo].historico_agrupamentos)

        // Atualizar a quantidade na interface
        atualizarQuantidadeInterface(codigo, novaQuantidadeTotal)

        baseOrcamento(orcamento_v2)
        await total()
        return
    }

    console.log('Item não existe, criando novo')

    // Item não existe - usar a função incluirItem original mas com histórico
    await incluirItem(codigo, novaQuantidade)

    // Depois de incluir, adicionar o histórico
    orcamento_v2 = baseOrcamento() // Recarregar para pegar as mudanças do incluirItem

    if (orcamento_v2.dados_composicoes[codigo]) {
        orcamento_v2.dados_composicoes[codigo].historico_agrupamentos = [{
            item_pai: codigoPai,
            quantidade: parseFloat(novaQuantidade),
            data_adicao: new Date().toISOString()
        }]

        console.log('Histórico criado para novo item:', orcamento_v2.dados_composicoes[codigo].historico_agrupamentos)

        baseOrcamento(orcamento_v2)
    }
}

// Função auxiliar para atualizar quantidade na interface
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
        orcamento: orcamento_v2,
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
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2vw;">
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                <img src="imagens/cancel.png" style="width: 3vw;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 5px; flex-direction: column;">
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

async function ocultarZerados(ocultar) {
    localStorage.setItem('ocultarZerados', JSON.stringify(ocultar))

    // Verificar se a tabela de agrupamentos está aberta
    let tabelaAgrupamentos = document.querySelector('[id^="agrup_"]')
    if (tabelaAgrupamentos) {
        // Se a tabela de agrupamentos está aberta, recarregar ela
        await exibirTabelaAgrupamentos()
    } else {
        // Senão, recarregar a tabela normal
        await tabelaProdutos()
    }
}

async function tabelaProdutos() {

    let permissoes = ['adm', 'log', 'editor', 'gerente', 'diretor']
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
                                <label ${moduloComposicoes ? `onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')"` : ''} class="${preco != 0 ? 'valor_preenchido' : 'valor_zero'}">${dinheiro(preco)}</label>
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

        let estilo = preco == 0 ? 'label_zerada' : 'input_valor';
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
                    <label class="${estilo}">${dinheiro(preco)}</label>
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
    let orcamento_v2 = baseOrcamento()
    let lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
    let carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR'
    let desconto_acumulado = 0
    let totais = { GERAL: { valor: 0, bruto: 0 } }
    let divTabelas = document.getElementById('tabelas')
    let tables = divTabelas.querySelectorAll('table')
    let padraoFiltro = localStorage.getItem('padraoFiltro')
    let estado = orcamento_v2?.dados_orcam?.estado || false
    let avisoDesconto = 0

    // Detectar mudanças de quantidade
    if (orcamento_v2.dados_composicoes) {
        for (let codigo in orcamento_v2.dados_composicoes) {
            let inputAtual = encontrarInputQuantidade(codigo)

            if (inputAtual) {
                let quantidadeAtual = parseFloat(inputAtual.value) || 0
                let quantidadeSalva = orcamento_v2.dados_composicoes[codigo].qtde || 0

                // Se a quantidade mudou
                if (quantidadeAtual !== quantidadeSalva) {
                    orcamento_v2.dados_composicoes[codigo].qtde = quantidadeAtual

                    // Verificar se este item tem agrupamentos (é um pai)
                    let produto = dados_composicoes[codigo]
                    if (produto && produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0) {
                        console.log(`${codigo} é um item PAI - verificando filhos...`)

                        try {
                            await atualizarQuantidadesFilhos(codigo, quantidadeAtual)
                            console.log(`✅ Filhos do pai ${codigo} atualizados com sucesso`)
                        } catch (error) {
                            console.error(`❌ Erro ao atualizar filhos do pai ${codigo}:`, error)
                            // Não travar o programa - continuar processamento
                        }
                    } else {
                        // É um item filho - calcular nova quantidade extra
                        let item = orcamento_v2.dados_composicoes[codigo]
                        if (item.quantidade_calculada !== undefined) {
                            let novaQuantidadeExtra = quantidadeAtual - item.quantidade_calculada
                            if (novaQuantidadeExtra < 0) novaQuantidadeExtra = 0

                            item.quantidade_extra = novaQuantidadeExtra
                            console.log(`Item filho ${codigo}: calculado=${item.quantidade_calculada}, total=${quantidadeAtual}, extra=${novaQuantidadeExtra}`)
                        }
                    }
                }
            }
        }
    }

    if (!orcamento_v2.dados_composicoes) {
        orcamento_v2.dados_composicoes = {}
    }

    tables.forEach(tab => {
        let nomeTabela = String(tab.id).split('_')[1]
        totais[nomeTabela] = { valor: 0 }
    })

    if (orcamento_v2.dados_composicoes) {
        for (let tabela in totais) {

            if (tabela == 'GERAL') continue

            let tbody = document.getElementById(`linhas_${tabela}`)
            if (!tbody) continue

            let trs = tbody.querySelectorAll('tr')

            for (tr of trs) {

                let tds = tr.querySelectorAll('td')
                let codigo = tds[0].textContent
                let acrescimo = carrefour ? 1 : 0 // Quantidade correspondente a mais 1 coluna: CARREFOUR;
                let valor_unitario = 0
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
                                onclick="mostrarAgrupamentos('${codigo}')"
                                style="position: absolute; top: 3px; right: 3px; width: 1.5vw; cursor: pointer;" 
                                >`
                    tds[1].insertAdjacentHTML('beforeend', img) // Não precisa de acréscimo;
                }

                // Substitui a referência do código para o item que substitui ele; Então a partir daqui, tudo será do substituto;
                if (carrefour && dados_composicoes[codigo] && dados_composicoes[codigo].substituto && dados_composicoes[codigo].substituto !== '') {
                    codigo = dados_composicoes[codigo].substituto == '' ? codigo : dados_composicoes[codigo].substituto
                }

                let descricaocarrefour = dados_composicoes[codigo].descricaocarrefour

                if (dados_composicoes[codigo] && dados_composicoes[codigo][lpu] && dados_composicoes[codigo][lpu].ativo !== undefined) {

                    let ativo = dados_composicoes[codigo][lpu].ativo
                    let historico = dados_composicoes[codigo][lpu].historico
                    precos = historico[ativo]
                    valor_unitario = precos.valor
                    icmsSaida = precos?.icms_creditado == 4 ? 4 : estado == 'BA' ? 20.5 : 12
                }

                let quantidade = Number(tds[3 + acrescimo].querySelector('input').value)

                valor_unitario += total // Somando ao total do agrupamento, caso exista;
                let total_linha = valor_unitario * quantidade

                // Desconto;
                let desconto = 0
                let valor_desconto
                let tipo_desconto

                if (!carrefour) {

                    tipo_desconto = tds[5 + acrescimo].querySelector('select')
                    valor_desconto = tds[5 + acrescimo].querySelector('input')

                    if (valor_desconto.value != '') {

                        if (tipo_desconto.value == 'Porcentagem') {
                            if (valor_desconto.value < 0) {
                                valor_desconto.value = 0
                            } else if (valor_desconto.value > 100) {
                                valor_desconto.value = 100
                            }

                            desconto = valor_desconto.value / 100 * total_linha

                        } else {
                            if (valor_desconto.value < 0) {
                                valor_desconto.value = 0
                            } else if (valor_desconto.value > total_linha) {
                                valor_desconto.value = total_linha
                            }

                            desconto = Number(valor_desconto.value)
                        }

                        // Verificar a viabilidade do desconto;
                        let dadosCalculo = {
                            custo: precos.custo,
                            valor: precos.valor - desconto / quantidade,
                            icms_creditado: precos.icms_creditado,
                            icmsSaida,
                            modalidadeCalculo: tipo
                        }

                        let resultado = calcular(undefined, dadosCalculo)

                        if (!estado) {
                            valor_desconto.value = ''
                            avisoDesconto = 1 // Preencher os dados da empresa;

                        } else if (resultado.lucroPorcentagem < 10) {
                            valor_desconto.value = ''
                            desconto = 0
                            avisoDesconto = 2 // Lucro mínimo atingido (10%);

                        } else if (isNaN(resultado.lucroLiquido)) {
                            valor_desconto.value = ''
                            desconto = 0
                            avisoDesconto = 3 // ICMS creditado não registrado;
                        }

                        itemSalvo.lucroLiquido = resultado.lucroLiquido
                        itemSalvo.lucroPorcentagem = resultado.lucroPorcentagem
                    }

                    tipo_desconto.classList = desconto == 0 ? 'desconto_off' : 'desconto_on'
                    valor_desconto.classList = desconto == 0 ? 'desconto_off' : 'desconto_on'

                    totais.GERAL.bruto += total_linha // Valor bruto sem desconto;
                    total_linha = total_linha - desconto
                    desconto_acumulado += desconto

                }

                let filtro = dados_composicoes[codigo]?.[padraoFiltro] || 'SEM CLASSIFICAÇÃO'

                if (!totais[filtro]) {
                    totais[filtro] = { valor: 0 }
                }

                totais[filtro].valor += total_linha
                totais.GERAL.valor += total_linha

                // ATUALIZAÇÃO DE INFORMAÇÕES DA COLUNA 4 EM DIANTE
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
                let valorLiqSemICMS = valor_unitario - (valor_unitario * icmsSaidaDecimal)
                let valorTotSemICMS = valorLiqSemICMS * quantidade

                let labelValores = (valor, semIcms, percentual) => {
                    let labelICMS = ''
                    if(tipo == 'VENDA' && estado) labelICMS = `<label style="white-space: nowrap;">SEM ICMS ${dinheiro(semIcms)} [ ${percentual}% ]</label>`
                    return `
                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                        <label class="${valor == 0 ? 'label_zerada' : 'input_valor'}"> ${dinheiro(valor)}</label>
                        ${labelICMS}
                    </div>
                    `
                }

                tds[4 + acrescimo].innerHTML = labelValores(valor_unitario, valorLiqSemICMS, icmsSaida)

                if (carrefour) { acrescimo = 0 }
                tds[6 + acrescimo].innerHTML = labelValores(total_linha, valorTotSemICMS, icmsSaida)

                let imagem = dados_composicoes[codigo]?.imagem || logo

                itemSalvo.descricao = descricao
                itemSalvo.unidade = dados_composicoes[codigo]?.unidade || 'UN'
                itemSalvo.descricaocarrefour = descricaocarrefour
                itemSalvo.qtde = quantidade
                itemSalvo.custo = valor_unitario
                itemSalvo.tipo = tipo
                itemSalvo.imagem = imagem

                if (!carrefour && Number(valor_desconto.value) !== 0) {
                    itemSalvo.tipo_desconto = tipo_desconto.value
                    itemSalvo.desconto = Number(valor_desconto.value)
                } else {
                    delete itemSalvo.tipo_desconto
                    delete itemSalvo.desconto
                }

            }
        }
    }

    let desconto_calculo = 0;
    for ([campo, objeto] of Object.entries(totais)) {

        if (campo == 'GERAL') continue

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

    let desconto_geral_linhas = desconto_acumulado + desconto_calculo
    document.getElementById(`total_geral`).textContent = dinheiro(totais.GERAL.valor - desconto_calculo)

    let painel_desconto = document.getElementById('desconto_total')
    if (!carrefour) {

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
    } else {
        painel_desconto.innerHTML = ''
    }

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

    if (avisoDesconto != 0) {
        let avisos = {
            1: 'Preencha os dados do Cliente antes de aplicar descontos',
            2: 'Desconto ultrapassa o permitido',
            3: 'Atualize os valores no ITEM [ICMS Creditado, Custo de Compra...]'
        }

        openPopup_v2(avisoHTML(avisos[avisoDesconto]), 'AVISO')
    }

}

// Função modificada para só processar filhos que ainda existem no orçamento
async function atualizarQuantidadesFilhos(codigoPai, novaQuantidadePai) {
    let orcamento_v2 = baseOrcamento()
    let produtoPai = dados_composicoes[codigoPai]

    // Verificar se tem agrupamentos
    if (!produtoPai || !produtoPai.agrupamentos) return

    console.log(`Atualizando filhos do pai ${codigoPai} para quantidade ${novaQuantidadePai}`)

    // Para cada filho no agrupamento
    for (let codigoFilho in produtoPai.agrupamentos) {
        let quantidadeBase = produtoPai.agrupamentos[codigoFilho]
        let quantidadeCalculadaDoPai = quantidadeBase * parseFloat(novaQuantidadePai)

        console.log(`Verificando filho ${codigoFilho}: base=${quantidadeBase} × pai=${novaQuantidadePai} = ${quantidadeCalculadaDoPai}`)

        // VERIFICAÇÃO PRINCIPAL: Só processar se o filho AINDA EXISTE no orçamento
        if (itemExisteNoOrcamento(codigoFilho)) {
            console.log(`✅ Filho ${codigoFilho} existe no orçamento - processando`)

            if (quantidadeCalculadaDoPai <= 0) {
                // Se a quantidade calculada for zero, manter apenas o extra do usuário
                let quantidadeExtra = orcamento_v2.dados_composicoes[codigoFilho].quantidade_extra || 0

                if (quantidadeExtra > 0) {
                    orcamento_v2.dados_composicoes[codigoFilho].quantidade_calculada = 0
                    orcamento_v2.dados_composicoes[codigoFilho].qtde = quantidadeExtra

                    let inputFilho = encontrarInputQuantidade(codigoFilho)
                    if (inputFilho) {
                        inputFilho.value = quantidadeExtra
                        console.log(`Filho ${codigoFilho}: mantido apenas extra=${quantidadeExtra}`)
                    }
                } else {
                    // Remover se não tem nem calculado nem extra
                    delete orcamento_v2.dados_composicoes[codigoFilho]
                    let linhaFilho = encontrarLinhaItem(codigoFilho)
                    if (linhaFilho) {
                        linhaFilho.remove()
                    }
                    console.log(`Filho ${codigoFilho}: removido completamente`)
                }
            } else {
                let itemFilho = orcamento_v2.dados_composicoes[codigoFilho]

                // Manter a quantidade extra que já existia
                let quantidadeExtra = itemFilho.quantidade_extra || 0

                // Nova quantidade total = quantidade calculada do pai + quantidade extra preservada
                let novaQuantidadeTotal = quantidadeCalculadaDoPai + quantidadeExtra

                // Salvar as informações
                itemFilho.quantidade_calculada = quantidadeCalculadaDoPai
                itemFilho.quantidade_extra = quantidadeExtra
                itemFilho.qtde = novaQuantidadeTotal

                // Atualizar o input na interface
                let inputFilho = encontrarInputQuantidade(codigoFilho)
                if (inputFilho) {
                    inputFilho.value = novaQuantidadeTotal
                    console.log(`Filho ${codigoFilho}: calculado=${quantidadeCalculadaDoPai} + extra=${quantidadeExtra} = total=${novaQuantidadeTotal}`)
                }
            }
        } else {
            // ITEM FILHO NÃO EXISTE MAIS - PULAR COMPLETAMENTE
            console.log(`❌ Filho ${codigoFilho} NÃO existe no orçamento - PULANDO (foi excluído pelo usuário)`)
            // Não fazer nada - simplesmente ignorar este filho
            continue
        }
    }

    // Salvar mudanças
    baseOrcamento(orcamento_v2)
}

// Função modificada com verificações de existência
async function removerInfluenciaDoPai(codigoPai) {
    let orcamento_v2 = baseOrcamento()
    let produtoPai = dados_composicoes[codigoPai]

    // Verificar se tem agrupamentos
    if (!produtoPai || !produtoPai.agrupamentos) return

    console.log(`Removendo influência do pai ${codigoPai}`)

    // Para cada filho no agrupamento
    for (let codigoFilho in produtoPai.agrupamentos) {

        // VERIFICAÇÃO: Se o filho ainda existe no orçamento
        if (itemExisteNoOrcamento(codigoFilho)) {
            let itemFilho = orcamento_v2.dados_composicoes[codigoFilho]
            let quantidadeExtra = itemFilho.quantidade_extra || 0

            console.log(`Filho ${codigoFilho}: tinha calculado=${itemFilho.quantidade_calculada || 0}, extra=${quantidadeExtra}`)

            if (quantidadeExtra > 0) {
                // Se tem quantidade extra, manter apenas ela
                itemFilho.qtde = quantidadeExtra
                itemFilho.quantidade_calculada = 0

                // VERIFICAÇÃO: Se o input ainda existe na interface
                let inputFilho = encontrarInputQuantidade(codigoFilho)
                if (inputFilho) {
                    inputFilho.value = quantidadeExtra
                    console.log(`Filho ${codigoFilho}: mantido apenas extra=${quantidadeExtra}`)
                } else {
                    console.log(`AVISO: Input do filho ${codigoFilho} não encontrado, mas dados atualizados`)
                }
            } else {
                // Se não tem quantidade extra, remover completamente
                delete orcamento_v2.dados_composicoes[codigoFilho]

                // VERIFICAÇÃO: Se a linha ainda existe na interface
                let linhaFilho = encontrarLinhaItem(codigoFilho)
                if (linhaFilho) {
                    linhaFilho.remove()
                    console.log(`Filho ${codigoFilho}: removido completamente`)
                } else {
                    console.log(`Filho ${codigoFilho}: removido dos dados (linha já não existia na interface)`)
                }
            }
        } else {
            console.log(`Filho ${codigoFilho}: já não existe no orçamento - pulando`)
        }
    }

    // Salvar mudanças
    baseOrcamento(orcamento_v2)

    // Recalcular totais
    await total()
}

// Função para encontrar o input de quantidade de um item específico
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

// Modificar a função incluirItem para lançar agrupamentos automaticamente
async function incluirItem(codigo, novaQuantidade) {
    let orcamento_v2 = baseOrcamento()
    let carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR'
    let produto = dados_composicoes[codigo]

    if (orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[codigo]) {
        await atualizarQuantidadesFilhos(codigo, novaQuantidade)
    }

    // Verificar se o produto tem agrupamentos
    if (produto.agrupamentos && Object.keys(produto.agrupamentos).length > 0) {
        console.log(`Item ${codigo} tem agrupamentos:`, produto.agrupamentos)

        // Lançar automaticamente os itens do agrupamento
        for (let codigoFilho in produto.agrupamentos) {
            let quantidadeFilho = produto.agrupamentos[codigoFilho] * parseFloat(novaQuantidade)
            console.log(`Lançando item filho: ${codigoFilho}, quantidade: ${quantidadeFilho}`)

            await incluirItemComPai(codigoFilho, quantidadeFilho, codigo)
        }

        // Mostrar notificação dos itens lançados
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
        `, 'Agrupamento Adicionado', false, 4000) // Auto-fechar em 4 segundos
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

// Modificar a função itemExistente para lidar com agrupamentos
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

            // Se o item já existe, somar a quantidade
            let inputQuantidade = tds[3 + acrescimo].querySelector('input')
            let quantidadeAtual = parseFloat(inputQuantidade.value) || 0
            let novaQuantidadeTotal = quantidadeAtual + parseFloat(quantidade)

            inputQuantidade.value = novaQuantidadeTotal

            // Atualizar no orçamento também
            if (orcamento_v2.dados_composicoes[codigo]) {
                orcamento_v2.dados_composicoes[codigo].qtde = novaQuantidadeTotal
                baseOrcamento(orcamento_v2)
            }
        }
    })

    return incluir
}

// Continuação da função mostrarDetalhesAgrupamento
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
        <div style="gap: 10px; display: flex; align-items: center; flex-direction: column; padding: 2vw;">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <label>Deseja limpar campos?</label>
            </div>
            <label onclick="executar_limpar_campos()" class="contorno_botoes" style="background-color: #B12425;">Confirmar</label>
        </div>`, 'AVISO', true)
}

async function executar_limpar_campos() {

    overlayAguarde()
    let orcamento = baseOrcamento()
    delete orcamento.dados_orcam
    baseOrcamento(orcamento)
    remover_popup();
    await total()
    await painel_clientes()

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
