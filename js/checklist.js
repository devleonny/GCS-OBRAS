let quantidadeGeral = 0
let quantidadeRealizadoGeral = 0
let previsao = 0
let diasUnicos = []
let tecnicos = {}
let progressoPonderado = 0
let quantidadeItem = 0
let quantidadeRealizadoItem = 0
let finalizados = 0
let filtroChecklist = {}
let filtroRelatorioChecklist = {}

async function telaChecklist() {

    tecnicos = {}

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    let ths = ''
    let pesquisa = ''
    const colunas = ['', 'Serviços', 'Quantidade', 'Serviço Executado', '% Conclusão', 'Diferença', 'Média do Serviço <br> Soma / dia trabalhado', 'Percentual de rendimento', 'Previsão de finalização']

    let i = 0
    for (const op of colunas) {

        if (op == '') {
            ths += `<th><input type="checkbox" onclick="marcarItensChecklist(this)"></th>`
            pesquisa += `<th style="background-color: white;"></th>`

        } else {
            pesquisa += `<th style="background-color: white; text-align: left;" contentEditable="true" oninput="pesquisarGenerico('${i}', this.textContent, filtroChecklist, 'bodyChecklist')"></th>`
            ths += `
            <th>
                <div style="${horizontal}; justify-content: space-between; width: 100%; gap: 10px;">
                    <span>${op}</span>
                    <img src="imagens/aaz.png" style="width: 1rem;" onclick="filtrarAAZ(${i}, 'bodyChecklist')"> 
                </div>
            </th>`
        }

        i++

    }

    const modelo = (texto, elemento) => `
        <div style="${vertical}; gap: 3px;">
            <label>${texto}</label>
            ${elemento}
        </div>
    `

    const btn = (texto, funcao) => `
        <button style="background-color: #4673b3; width: 100%;" onclick="${funcao}">${texto}</button> 
    `

    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">

            <div class="toolbar-checklist">

                <div style="${horizontal}; gap: 0.5rem;">

                    <img onclick="atualizarChecklist()" src="imagens/atualizar3.png" style="width: 2rem;">

                    <div style="${vertical};">
                        ${btn('Remover Itens Selecionados', 'removerItensEmMassa()')}
                        ${btn('Ver Itens Removidos', 'verItensRemovidos()')}
                    </div>

                    <div style="${vertical};">
                        ${btn('Serviço Avulso', 'adicionarServicoAvulso()')}
                        ${btn('Relatório', 'relatorioChecklist()')}
                    </div>

                </div>

                ${modelo('Porcentagem de Conclusão', `<div id="porcentagem"></div>`)}

                <div style="${horizontal}; gap: 10px;">
                    ${modelo('Total de Serviços', `<span id="geral"></span>`)}
                    ${modelo('Dias decorridos', `<span id="diasTotais"></span>`)}
                    ${modelo('Previsão de Conclusão', `<span id="previsao"></span>`)}
                </div>

            </div>

            <div id="tabelaCheklist" style="${vertical};">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${ths}</tr>
                            <tr>${pesquisa}</tr>
                        </thead>
                        <tbody id="bodyChecklist"></tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>

        </div>
    `

    const omieCliente = orcamento?.dados_orcam?.omie_cliente || false
    const cliente = await recuperarDado('dados_clientes', omieCliente)
    const titulo = `Checklist - ${orcamento?.dados_orcam?.contrato || '--'} - ${cliente?.nome || '--'}`

    const tabelaCheklist = document.getElementById('tabelaCheklist')
    if (!tabelaCheklist) popup(acumulado, titulo, true)

    // Reset 
    quantidadeGeral = 0
    finalizados = 0
    diasUnicos = []

    const mesclado = {
        ...orcamento?.dados_composicoes || {},
        ...orcamento?.checklist?.avulso || {}
    }

    for (const [codigo, produto] of Object.entries(mesclado)) {
        if (produto?.tipo == 'VENDA') continue

        const check = orcamento?.checklist?.itens?.[codigo] || {}
        carregarLinhaChecklist(codigo, produto, check)

        for (const [id, dados] of Object.entries(check)) {

            if (id == 'removido') continue

            for (const idTec of dados?.tecnicos || []) {
                const tecnico = dados_clientes?.[idTec] || {}
                tecnicos[idTec] = tecnico?.nome || 'Desatualizado...'
            }

        }
    }

    // Relatório geral
    document.getElementById('geral').textContent = quantidadeGeral
    const porcetagemFinal = Number(((finalizados / quantidadeGeral) * 100).toFixed(1))
    document.getElementById('porcentagem').innerHTML = divPorcentagem(porcetagemFinal)
    document.getElementById('diasTotais').textContent = diasUnicos.length
    document.getElementById('previsao').textContent = diasUnicos.length == 0 ? `-- dias` : `${((diasUnicos.length * 100) / porcetagemFinal).toFixed(0)} dias`

    if (!orcamento.checklist) orcamento.checklist = {}
    orcamento.checklist.andamento = porcetagemFinal
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await telaOrcamentos(true)
    enviar(`dados_orcamentos/${id_orcam}/checklist/andamento`, porcetagemFinal)

}

async function relatorioChecklist() {

    let ths = ''
    let pesquisa = ''

    const colunas = ['Data', 'Descrição', 'Quantidade', 'Técnicos']
        .map((op, i) => { 

            ths += `<th>${op}</th>`
            pesquisa += `<th style="background-color: white; text-align: left;" contentEditable="true" oninput="pesquisarGenerico('${i}', this.textContent, filtroRelatorioChecklist, 'relatorioChecklist')"></th>`

        })

    const acumulado = `
    
        <div style="background-color: #d2d2d2; padding: 2rem;">

            <div style="${horizontal}; gap: 1rem;">
                ${modelo('De', `<input name="de" onchange="gerarRelatorioChecklist()" type="date">`)}
                ${modelo('Até', `<input name="ate" onchange="gerarRelatorioChecklist()" type="date">`)}
            </div>

            <hr style="width: 100%;">

            <div id="tabelaCheklist" style="${vertical};">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${ths}</tr>
                            <tr>${pesquisa}</tr>
                        </thead>
                        <tbody id="relatorioChecklist"></tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>

        </div>

    `

    popup(acumulado, 'Relatório Diário', true)

}

async function gerarRelatorioChecklist() {

    const tbody = document.getElementById('relatorioChecklist')
    let de = document.querySelector('[name="de"]').value
    let ate = document.querySelector('[name="ate"]').value

    if (!de || !ate) return

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const itens = orcamento?.checklist?.itens || {}
    const dados_clientes = await recuperarDados('dados_clientes')

    const dt = (data) => {
        const [ano, mes, dia] = data.split('-')
        return new Date(ano, mes - 1, dia)
    }

    de = dt(de)
    ate = dt(ate)

    tbody.innerHTML = ''

    for (const [codigo, lancamentos] of Object.entries(itens)) {

        const descricao = orcamento.dados_composicoes[codigo].descricao

        for (const [idLancamento, dados] of Object.entries(lancamentos)) {
            const dataLancamento = dt(dados.data)
            if (dataLancamento >= de && dataLancamento <= ate) {

                const tecnicos = (dados.tecnicos || [])
                    .map(codTec => `<span>${dados_clientes?.[codTec]?.nome || '...'}</span>`)
                    .join('')
            
                tbody.insertAdjacentHTML('beforeend', `
                    <tr>
                        <td>${dataLancamento.toLocaleDateString('pt-BR')}</td>
                        <td>${descricao}</td>
                        <td>${dados.quantidade}</td>
                        <td>
                            <div style="${vertical}">
                                ${tecnicos}
                            </div>
                        </td>
                    </tr>
                `)
            }
        }
    }
}

async function atualizarChecklist() {
    await sincronizarDados('dados_orcamentos')
    await telaChecklist()
}

async function adicionarServicoAvulso() {

    const acumulado = `
        <div style="${horizontal}; gap: 10px; background-color: #d2d2d2; padding: 2vw;">
            ${modelo('Descrição', `<input name="descricao" style="padding: 5px; border-radius: 3px;">`)}
            ${modelo('Quantidade', `<input name="qtde" type="number" style="padding: 5px; border-radius: 3px;">`)}
            <img src="imagens/concluido.png" style="width: 2rem;" onclick="salvarAvulso()">
        </div>
    `

    popup(acumulado, 'Incluir Serviço', true)
}

async function salvarAvulso() {

    const qtde = Number(document.querySelector('[name="qtde"]').value)
    const descricao = document.querySelector('[name="descricao"]').value

    if (!qtde || !descricao) return popup(mensagem('Não deixe campos em Branco'), 'Alerta', true)

    overlayAguarde()
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.checklist) orcamento.checklist = {}
    if (!orcamento.checklist.avulso) orcamento.checklist.avulso = {}

    const codigo = ID5digitos()
    const dados = { qtde, descricao, usuario: acesso.usuario, data: new Date().toLocaleString() }
    orcamento.checklist.avulso[codigo] = dados

    enviar(`dados_orcamentos/${id_orcam}/checklist/avulso/${codigo}`, dados)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    await telaChecklist()
    removerPopup()
}

async function verItensRemovidos() {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let itens = ''

    for (const [codigo, dados] of Object.entries(orcamento?.checklist?.itens || {})) {

        if (!dados.removido) continue

        const descricao = orcamento?.dados_composicoes?.[codigo]?.descricao || orcamento?.checklist?.avulso?.[codigo]?.descricao || '...'

        itens += `
            <div style="${horizontal}; gap: 10px;">
                <img onclick="recuperarItem('${codigo}', this)" src="imagens/atualizar3.png" style="width: 1.2rem;">
                <span>${descricao}</span> 
            </div>
        `
    }

    const acumulado = `
        <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 2vw; min-width: 30vw;">

            ${itens}

        </div>
    
    `

    popup(acumulado, 'Itens Removidos', true)

}

async function recuperarItem(codigo, img) {

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    delete orcamento.checklist.itens[codigo].removido

    deletar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/removido`)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()

    img.closest('div').remove()

}

async function removerItensEmMassa() {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]:checked')

    if (itensChecklist.length == 0) return

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.checklist) orcamento.checklist = {}
    if (!orcamento.checklist.itens) orcamento.checklist.itens = {}

    for (const check of itensChecklist) {

        const tr = check.closest('tr')
        const codigo = tr.dataset.codigo

        if (!orcamento.checklist.itens[codigo]) orcamento.checklist.itens[codigo] = {}
        const dados = { usuario: acesso.usuario, data: new Date().toLocaleString() }
        orcamento.checklist.itens[codigo].removido = dados

        enviar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/removido`, dados)

    }

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    removerOverlay()
    await telaChecklist()
}

function marcarItensChecklist(input) {

    const itensChecklist = document.querySelectorAll('[name="itensChecklist"]')

    for (const check of itensChecklist) {
        const tr = check.closest('tr')
        check.checked = tr.style.display !== 'none' && input.checked
    }

}

function carregarLinhaChecklist(codigo, produto, check) {

    if (check.removido) {
        const linha = document.getElementById(`check_${codigo}`)
        if (linha) linha.remove()
        return
    }

    let quantidade = 0

    for (const [id, dados] of Object.entries(check)) {

        quantidade += isNaN(dados.quantidade) ? 0 : dados.quantidade
        if (!diasUnicos.includes(dados.data)) diasUnicos.push(dados.data)

    }

    const avulso = produto.tipo ? '' : '<span><b>[Avulso]</b></span>'
    const diferenca = produto.qtde - quantidade
    const mediaDia = quantidade == 0 ? 0 : Number((quantidade / diasUnicos.length).toFixed(0))
    const cor = (quantidade > 0 && quantidade < produto.qtde) ? '#f59c27bf' : quantidade == 0 ? '#b36060bf' : '#4CAF50bf'
    const percRendDiario = mediaDia == 0 ? 0 : ((mediaDia / produto.qtde) * 100).toFixed(0)
    const prevFinalizacao = mediaDia == 0 ? 0 : (produto.qtde / mediaDia).toFixed(0)

    // Relatório
    finalizados += quantidade / produto.qtde
    quantidadeRealizadoGeral += quantidade
    quantidadeGeral++

    const tds = `
        <td><input name="itensChecklist" type="checkbox"></td>
        <td style="text-align: right;">${produto.descricao} ${avulso}</td>
        <td>${produto.qtde}</td>
        <td style="background-color: ${cor}; cursor: pointer;" onclick="registrarChecklist('${codigo}')">${quantidade}</td>
        <td>${divPorcentagem(((quantidade / produto.qtde) * 100).toFixed(1))}</td>
        <td>${diferenca}</td>
        <td>${mediaDia}</td>
        <td>${percRendDiario}%</td>
        <td>${prevFinalizacao} ${prevFinalizacao == 1 ? 'dia' : 'dias'}</td>
    `

    const trExistente = document.getElementById(`check_${codigo}`)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('bodyChecklist').insertAdjacentHTML('beforeend', `<tr data-codigo="${codigo}" id="check_${codigo}">${tds}</tr>`)

}

async function duplicarLancamento(idLancamento, codigo) {

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const lancamento = orcamento?.checklist?.itens?.[codigo]?.[idLancamento] || {}

    document.querySelector('[name="quantidade"]').value = lancamento.quantidade
    document.querySelector('[name="data"]').value = lancamento.data

    for (const codTec of lancamento.tecnicos) {
        const tecnico = await recuperarDado('dados_clientes', codTec)
        maisTecnico(codTec, tecnico.nome)
    }

}

async function registrarChecklist(codigo) {

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const itens = orcamento?.checklist?.itens?.[codigo] || {}

    const data = (data) => {
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    let linhas = ''

    // Bloqueio por excesso de quantidade;
    quantidadeRealizadoItem = 0
    quantidadeItem = orcamento?.dados_composicoes?.[codigo]?.qtde || orcamento?.checklist?.avulso?.[codigo].qtde || 0

    for (const [idLancamento, dados] of Object.entries(itens)) {

        quantidadeRealizadoItem += dados.quantidade

        const nomesTecnicos = (dados?.tecnicos || [])
            .map(idTec => `<span>${tecnicos[idTec]}</span>`)
            .join('')

        linhas += `
        <tr>
            <td><img onclick="duplicarLancamento('${idLancamento}', '${codigo}')" src="imagens/duplicar.png" style="width: 2rem;"></td>
            <td>${data(dados.data)}</td>
            <td>${dados.quantidade}</td>
            <td>
                <div style="${vertical}">
                    ${nomesTecnicos}
                </div>
            </td>
            <td><img src="imagens/cancel.png" style="width: 1.5rem;" onclick="removerChecklist('${codigo}', '${idLancamento}')"></td>
        </tr>`
    }

    const botoesTecnicos = Object.entries(tecnicos)
        .map(([cod, nome]) => `<button onclick="maisTecnico('${cod}', '${nome}')">${nome || 'Desatualizado...'}</button>`)
        .join('')

    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">

            <span><b>Quantidade Orçada:</b> ${quantidadeItem}</span>

            ${botoesTecnicos}

            <hr style="width: 100%;">

            <div class="form-checklist">
                <img src="imagens/baixar.png" style="width: 1.5rem;" onclick="maisTecnico()">
                <div id="blocoTecnicos" style="${vertical};"></div>

                <input name="quantidade" type="number">
                <input name="data" type="date">
                <img src="imagens/concluido.png" style="width: 1.5rem;" onclick="salvarQuantidade('${codigo}')">
            </div>
            
            <hr style="width: 100%;">

            <div style="${vertical}; width: 100%;">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${['Duplicar', 'Data', 'Quantidade', 'Técnico', 'Excluir'].map(op => `<th>${op}</th>`).join('')}</tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>
            
        </div>
    `

    popup(acumulado, 'Registrar', true)
}

function maisTecnico(cod, nome) {
    const blocoTecnicos = document.getElementById('blocoTecnicos')
    cod = cod || ID5digitos()
    nome = nome || 'Selecione'

    if (document.getElementById(cod)) return

    const modelo = `
        <div style="${horizontal}; gap: 5px;">
            <span class="opcoes" id="${cod}" name="${cod}" onclick="cxOpcoes('${cod}', 'dados_clientes', ['nome', 'cnpj', 'cidade'])">${nome}</span>
            <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="this.parentElement.remove()">
        </div>
    `

    blocoTecnicos.insertAdjacentHTML('beforeend', modelo)
}

async function salvarQuantidade(codigo) {

    overlayAguarde()

    const tecnicos = []
    const blocoTecnicos = document.getElementById('blocoTecnicos')
    const spanTecnicos = blocoTecnicos.querySelectorAll('span')

    for (const span of spanTecnicos) if (!tecnicos.includes(span.id)) tecnicos.push(span.id)

    const quantidade = Number(document.querySelector('[name="quantidade"]').value)
    const data = document.querySelector('[name="data"]').value

    if ((quantidadeRealizadoItem + quantidade) > quantidadeItem) return popup(mensagem('Não é possível exceder a quantidade orçada'), 'Alerta', true)

    if (!tecnicos.length || !quantidade || !data) return popup(mensagem('Preencha todos os campos'), 'Alerta', true)

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.checklist) orcamento.checklist = {}
    if (!orcamento.checklist.itens) orcamento.checklist.itens = {}
    if (!orcamento.checklist.itens[codigo]) orcamento.checklist.itens[codigo] = {}

    const dados = { quantidade, tecnicos, data }
    const idLancamento = ID5digitos()

    orcamento.checklist.itens[codigo][idLancamento] = dados

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()

    removerPopup()

    enviar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/${idLancamento}`, dados)

}

async function removerChecklist(codigo, idLancamento) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    delete orcamento.checklist.itens[codigo][idLancamento]

    deletar(`dados_orcamentos/${id_orcam}/checklist/itens/${codigo}/${idLancamento}`)

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()
    removerPopup()
    await registrarChecklist(codigo)

    removerOverlay()

}

function calculadoraChecklist() {

    const bodyChecklist = document.getElementById('bodyChecklist')
    const trs = bodyChecklist.querySelectorAll('tr')

    for (const tr of trs) {
        const tds = document.querySelectorAll('td')

        const qtdeOrcamento = conversor(tds[1].textContent)
        const qtdeRealizada = conversor(tds[2].textContent)

        tds[3].textContent = conversor(qtdeOrcamento - qtdeRealizada)

    }

}

function criarCalendário() {

    const ths = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        .map(op => `<th>${op}</th>`)
        .join('')


    const tabela = `
        <table>
            <thead>${ths}</thead>
            <tbody></tbody>
        </table>
    `

    return tabela

}