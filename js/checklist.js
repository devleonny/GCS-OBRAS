async function telaChecklist() {

    id_orcam = 'ORCA_9270e7d1-751a-4cd9-ba66-42479ee167e5'

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    let ths = ''
    let pesquisa = ''
    const colunas = ['Serviços', 'Quantidade', 'Serviço Executado', 'Diferença', 'Média do Serviço <br> Soma / dia trabalhado', 'Percentual de rendimento', 'Previsão de finalização']
        .forEach(op => {
            ths += `<th>${op}</th>`
        })

    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">

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

    const tabelaCheklist = document.getElementById('tabelaCheklist')
    if (!tabelaCheklist) popup(acumulado, 'Checklist', true)

    for (const [codigo, produto] of Object.entries(orcamento?.dados_composicoes || {})) {
        if (produto.tipo == 'VENDA') continue

        const check = orcamento?.checklist?.itens?.[codigo] || {}
        carregarLinhaChecklist(codigo, produto, check)

    }

}

function carregarLinhaChecklist(codigo, produto, check) {

    let quantidade = 0
    let diasUnicos = []

    for (const [id, dados] of Object.entries(check)) {
        quantidade += dados.quantidade
        if (!diasUnicos.includes(dados.data)) diasUnicos.push(dados.data)
    }

    const diferenca = produto.qtde - quantidade
    const mediaDia = quantidade == 0 ? 0 : Number((quantidade / diasUnicos.length).toFixed(0))
    const cor = (quantidade > 0 && quantidade < produto.qtde) ? '#f59c27bf' : quantidade == 0 ? '#b36060bf' : '#4CAF50bf'
    const percRendDiario = mediaDia == 0 ? 0 : ((mediaDia / produto.qtde) * 100).toFixed(0)
    const prevFinalizacao = mediaDia == 0 ? 0 : (produto.qtde / mediaDia).toFixed(0)

    const tds = `
        <td style="text-align: right;">${produto.descricao}</td>
        <td>${produto.qtde}</td>
        <td style="background-color: ${cor}; cursor: pointer;" onclick="registrarChecklist('${codigo}')">${quantidade}</td>
        <td>${diferenca}</td>
        <td>${mediaDia}</td>
        <td>${percRendDiario}%</td>
        <td>${prevFinalizacao} ${prevFinalizacao == 1 ? 'dia' : 'dias'}</td>
    `

    const trExistente = document.getElementById(`check_${codigo}`)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('bodyChecklist').insertAdjacentHTML('beforeend', `<tr id="check_${codigo}">${tds}</tr>`)

}

async function registrarChecklist(codigo) {

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const itens = orcamento?.checklist?.itens?.[codigo] || {}

    const linhas = Object.entries(itens)
        .map(([idLancamento, dados]) => `
        <tr>
            <td>${dados.data}</td>
            <td>${dados.quantidade}</td>
            <td>${dados.tecnico}</td>
            <td><img src="imagens/cancel.png" style="width: 1.5rem;" onclick="removerChecklist('${codigo}', '${idLancamento}', this)"></td>
        </tr>`)
        .join('')

    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">

            <div class="form-checklist">
                <span class="opcoes" name="tecnico" onclick="cxOpcoes('tecnico', 'dados_clientes', ['nome', 'cnpj', 'cidade'])">Selecione</span>
                <input name="quantidade" type="number">
                <input name="data" type="date">
                <img src="imagens/concluido.png" style="width: 2vw" onclick="salvarQuantidade('${codigo}')">
            </div>
            
            <hr style="width: 100%;">

            <div style="${vertical}; width: 100%;">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${['Data', 'Quantidade', 'Técnico', 'Excluir'].map(op => `<th>${op}</th>`).join('')}</tr>
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

async function salvarQuantidade(codigo) {

    overlayAguarde()

    const tecnico = document.querySelector('[name="tecnico"]').id
    const quantidade = Number(document.querySelector('[name="quantidade"]').value)
    const data = document.querySelector('[name="data"]').value

    if (!tecnico || !quantidade || !data) return popup(mensagem('Preencha todos os campos'), 'Alerta', true)

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.checklist) orcamento.checklist = {}
    if (!orcamento.checklist.itens) orcamento.checklist.itens = {}
    if (!orcamento.checklist.itens[codigo]) orcamento.checklist.itens[codigo] = {}

    const dados = { quantidade, tecnico, data }
    const idLancamento = ID5digitos()

    orcamento.checklist.itens[codigo][idLancamento] = dados

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    await telaChecklist()

    removerPopup()
    await registrarChecklist(codigo)

}

async function removerChecklist(codigo, idLancamento, img) {

    overlayAguarde()

    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    delete orcamento.checklist.itens[codigo][idLancamento]

    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')

    img.closest('tr').remove()

    await telaChecklist()

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