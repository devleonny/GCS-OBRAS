let filtroVeiculos = {}
let totalDepartamentos = {}

const modeloLabel = (valor1, elemento) => `
<div style="text-align: left; width: 100%; display: flex; align-items: start; justify-content: start; flex-direction: column; gap: 5px;">
    <label>${valor1}</label>
    ${elemento}
</div>
`
const labelDupla = (valor1, valor2) => `
    <div style="display: flex; flex-direction: column; align-items: start;">
        <label style="font-size: 0.7vw;"><strong>${valor1}</strong></label>
        <label style="font-size: 0.9vw;">${valor2}</label>
    </div>
`
const botaoVeiculos = (valor1, funcao, cor) => `
    <div class="botoes" style="background-color: ${cor};" onclick="${funcao}">
        <label>${valor1}</label>
    </div>
`
const categorias = {
    'Combustível': 'combustivel',
    'Pedágio': 'pedagio',
    'Multas': 'multas',
    'Custos Extras': 'extras'
}

async function telaVeiculos() {

    mostrarMenus(false)

    const colunas = {
        'Usuário': { chave: 'usuario' },
        'Data de Registro': { chave: 'data' },
        'Veículo': {},
        'Data Pagamento': {},
        'Valor': {},
        'Realizado': {},
        'Cartão': {},
        'Comentário': { chave: 'comentario' },
        'Departamentos': {},
        'Editar': {}
    }

    const btnExtras = (acesso.permissao == 'adm' || acesso.setor == 'FINANCEIRO')
        ? `<div id="viabilidade"></div>`
        : ''

    const tabela = await modTab({
        pag: 'custoVeiculos',
        funcaoAdicional: ['viabilidadeOmie'],
        btnExtras,
        body: 'bodyCustoVeiculos',
        base: 'custo_veiculos',
        colunas,
        criarLinha: 'criarLinhaCusto'
    })

    const acumulado = `
        <div class="tela-veiculos">
            ${tabela}
        </div>`

    tela.innerHTML = acumulado

    await paginacao()

    criarMenus('veiculos')

}

async function auxVeiculos() {

    const colunas = {
        'Cartão': { chave: 'cartao' },
        'Motoristas': {},
        'Modelo': { chave: 'modelo' },
        'Placa': { chave: 'placa' },
        'Status': { chave: 'placa' },
        'Editar': {}
    }

    const btnExtras = `<img src="imagens/baixar.png" onclick="novoVeiculo()">`

    const tabela = modTab({
        btnExtras,
        pag: 'veiculos',
        body: 'bodyVeiculos',
        colunas,
        base: 'veiculos',
        criarLinha: 'criarLinhaVeiculo'
    })

    const elemento = `
        <div style="${vertical}; padding: 1rem;">
            ${tabela}
        </div>`

    popup({ elemento, titulo: 'Veículos' })
    await paginacao()
}

async function criarLinhaVeiculo(veiculo) {

    const motoristas = []

    for (const id of (veiculo.motoristas || [])) {
        const motorista = await recuperarDado('dados_clientes', id)
        if (!motorista)
            continue
        motoristas.push(motorista.nome)
    }

    return `
    <tr>
        <td>${veiculo?.cartao || 'Sem cartão'}</td>
        <td>
            ${motoristas.join('<br>')}
        </td>
        <td>
            <label name="veículo">${veiculo?.modelo || 'Modelo não informado'}</label>
        </td>
        <td>
            <label name="veículo">${veiculo?.placa || 'Placa não informada'}</label>
        </td>
        <td>
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/${veiculo.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5rem;">
                <label name="veículo">${veiculo.status}</label>
            </div>
        </td>
        <td>
            <img src="imagens/pesquisar2.png" onclick="novoVeiculo('${veiculo.id}')">
        </td>
    </tr>
    `

}

async function criarLinhaCusto(custo) {

    const { nome, veiculo } = custo
    const idCusto = custo.id

    function conversorData(data) {

        if (!data) return ''

        let [ano, mes, dia] = data.split('-')
        let dataFormatada = `${dia}/${mes}/${ano}`

        return dataFormatada
    }

    const editavel = acesso.permissao == 'adm' || acesso.setor == 'FINANCEIRO'

    const deps = []

    for (const [codDep, km] of Object.entries(custo?.distribuicao || {})) {

        const dep = await recuperarDado('departamentos_AC', codDep) || {}
        const porcentagem = km / custo.km
        const valor = custo.realizado ? porcentagem * custo.realizado : ''
        deps.push(`
            <div style="${horizontal}; gap: 2px;">
                <div class="etiquetas"
                name="departamento"
                data-valor="${valor}"
                data-codigo="${codDep}">
                    <span>${dep?.descricao || codDep || 'Desatualizado...'}</span>
                    <span style="text-align: left;">${dep?.cliente?.nome || ''}</span>
                </div>
            </div>`)
    }

    const tds = `
        <td>${custo.usuario}</td>
        <td>${custo.data}</td>

        <td>
            <div style="${horizontal}; justify-content: start; gap: 0.5rem; width: 300px;">
                <img src="imagens/${veiculo?.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1rem;">
                <div style="${vertical}; text-align: left;">
                    <label>${nome}</label>
                    <label>${veiculo?.placa || '...'}</label>
                    <label>${veiculo?.modelo || '...'}</label>
                </div>
            </div>
        </td>

        <td>
            <input name="datas" style="display: none" value="${custo.data_pagamento}">
            <label>${conversorData(custo.data_pagamento)}</label>
        </td>

        <td>
            <label style="white-space: nowrap;">${dinheiro(custo.custo_total)}</label>
        </td>

        <td>
            <input type="number" name="valores" style="display: none" value="${custo?.realizado || 0}">
            <div style="${horizontal}; gap: 2px;">
                <span>R$</span>
                <input oninput="mostrarBtn(this)" class="realizado" type="number" value="${custo?.realizado || ''}" ${editavel ? '' : 'readOnly'}>
                <img onclick="atualizarRealizado(this)" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
            </div>
        </td>

        <td>${veiculo?.cartao || 'Não informado'}</td>

        <td style="text-align: start; width: 400px;">${custo?.comentario || ''}</td>

        <td>
            <div style="${vertical}; gap: 1px;">${deps.join('')}</div>
        </td>

        <td>
            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <img src="imagens/pesquisar2.png" onclick="painelAtalhos('${idCusto}')">
            </div>
        </td>`

    return `<tr>${tds}</tr>`
}

function viabilidadeOmie() {

    const viabilidade = document.getElementById('viabilidade')
    if (!viabilidade) return

    let possibilidade = true
    totalDepartamentos = {}
    let total = 0

    const linhas = document.querySelectorAll('#bodyCustoVeiculos tr')
    for (const linha of linhas) {

        if (linha.style.display == 'none') continue

        const deps = linha.querySelectorAll('[name="departamento"]')

        if (deps.length == 0) possibilidade = false

        for (const dep of deps) {
            const valor = Number(dep.dataset.valor)
            if (valor == 0) continue
            const codigo = Number(dep.dataset.codigo)

            totalDepartamentos[codigo] ??= 0
            totalDepartamentos[codigo] += valor
            total += valor
        }

    }

    if (total == 0)
        possibilidade = false

    viabilidade.innerHTML = `
        <div ${possibilidade ? `onclick="criarPagamentoVeiculo()"` : ''} class="etiquetas" style="flex-direction: row; align-items: center; gap: 0.5rem; margin: 0.5rem;">
            <img src="imagens/${possibilidade ? 'concluido' : 'proibido'}.png">
            <span>Criar pagamento no Omie</span>
            <span style="white-space: nowrap;">${dinheiro(total)}</span>
        </div>
    `
}

async function criarPagamentoVeiculo() {

    let totalDeps = 0
    const deps = Object.entries(totalDepartamentos)
        .map(([codigo, total]) => {
            const dep = db.departamentos_AC?.[codigo] || {}
            totalDeps += total
            return `
            <div class="etiquetas" style="flex-direction: row; gap: 0.5rem;">
                <span>${dep.descricao || 'Desatualizado...'}</span>
                <span>${dinheiro(total)}</span>
            </div>`
        }).join('')

    const linhas = [
        { texto: 'App', elemento: `<select id="app">${['AC', 'IAC'].map(op => `<option>${op}</option>`).join('')}</select>` },
        { texto: 'Taxa', elemento: `R$ <input id="taxa" oninput="somarTaxa(this)" type="number">` },
        { texto: 'Valor', elemento: `<span id="total" data-total="${totalDeps}">${dinheiro(totalDeps)}</span>` },
        { texto: 'Data', elemento: `<input id="data" type="date">` },
        { texto: 'Observação', elemento: `<textarea id="observacao"></textarea>` },
        { texto: 'Departamentos', elemento: `<div style="${vertical}; gap: 1px;">${deps}</div>` }
    ]

    const botoes = [
        { img: 'salvo', funcao: 'enviarOmie()', texto: 'Enviar/Omie' }
    ]

    popup({ linhas, botoes, titulo: 'Criar pagamento no Omie' })

}

async function enviarOmie() {

    const el = (id) => {
        const elem = document.getElementById(id)
        return elem.value
    }

    let totalGeral = 0
    const app = el('app')
    const observacao = el('observacao')
    const taxa = Number(el('taxa'))
    const inpData = el('data')

    if (!taxa || !inpData)
        return popup({ mensagem: 'Preencha a data e/ou o valor da taxa' })

    overlayAguarde()

    const dt = (data) => {
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    const data = dt(inpData)
    const idPagamento = unicoID()

    const distribuicao = {}
    for (let [cCodDep, nValDep] of Object.entries(totalDepartamentos)) {

        cCodDep = Number(cCodDep) // Em número;

        if (!distribuicao[cCodDep]) {
            distribuicao[cCodDep] = { cCodDep, nValDep }
        } else {
            distribuicao[cCodDep].nValDep += nValDep
        }

        totalGeral += nValDep
    }

    // Salvamento da taxa > Código dep EMPRESA; 
    totalGeral += taxa
    if (!distribuicao[6689610735]) {
        distribuicao[6689610735] = { cCodDep: 6689610735, nValDep: taxa }
    } else {
        distribuicao[6689610735].nValDep += taxa
    }

    const pagamento = {
        app,
        param: [{
            codigo_cliente_fornecedor: 6066446384,
            codigo_lancamento_integracao: idPagamento,
            data_vencimento: data,
            data_previsao: data,
            distribuicao: Object.values(distribuicao),
            observacao,
            valor_documento: totalGeral,
            categorias: [
                {
                    codigo_categoria: '2.03.97',
                    percentual: 100
                }
            ]
        }]
    }

    const resposta = await lancarPagamento({ pagamento, dataFixa: true })
    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    removerPopup()
    popup({ tempo: 5, mensagem: 'Realizado com successo', imagem: 'imagens/concluido.png' })

}

function somarTaxa(input) {
    const elemTotal = document.getElementById('total')
    const total = Number(elemTotal.dataset.total)
    elemTotal.textContent = dinheiro(total + Number(input.value))
}

async function atualizarRealizado(img) {

    const input = img.previousElementSibling
    const realizado = Number(input.value)
    const tr = input.closest('tr')
    const idCusto = tr.id
    const custo = await recuperarDado('custo_veiculos', idCusto)
    custo.realizado = realizado

    img.style.display = 'none'

    enviar(`custo_veiculos/${idCusto}/realizado`, realizado)
    await inserirDados({ [idCusto]: custo }, 'custo_veiculos')

}

async function painelAtalhos(idCusto) {

    const custo = db.custo_veiculos[idCusto]

    const botoes = [
        { texto: 'Duplicar Pagamento', img: 'duplicar', funcao: `painelValores('${idCusto}', true)` },
        { texto: 'Editar Pagamento', img: 'editar', funcao: `painelValores('${idCusto}')` },
    ]

    if ((acesso.permissao == 'adm' || acesso.usuario == custo.usuario))
        botoes.push({ texto: 'Excluir Pagamento', img: 'cancel', funcao: `painelExcluir('${idCusto}')` })

    popup({ botoes, mensagem: 'Escolha uma opção', titulo: 'Atalhos' })
}

function painelExcluir(idCusto) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirCusto('${idCusto}')` }
    ]

    popup({ botoes, mensagem: 'Deseja excluir este lançamento?', nra: false })
}

async function excluirCusto(idCusto) {

    await deletarDB('custo_veiculos', idCusto)
    deletar(`custo_veiculos/${idCusto}`)

}

async function painelValores(idCusto, duplicar) {

    const custo = await recuperarDado('custo_veiculos', idCusto) || {}
    const motorista = await recuperarDado('dados_clientes', custo?.motorista)

    const tabela = `
        <div style="${vertical}">
            <div class="topo-tabela">
                <button onclick="linDist()">Incluir</button>
            </div>
            <div class="div-tabela">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <th>Departamento</th>
                        <th>KM</th>
                        <th></th>
                    </thead>
                    <tbody id="distribuicao"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    const linhas = [
        { texto: 'Comentário', elemento: `<textarea rows="5" style="padding: 0.5rem;" id="comentario">${custo?.comentario || ''}</textarea>` },
        { texto: 'Data Pagamento', elemento: `<input id="data_pagamento" type="date" value="${custo?.data_pagamento || ''}">` },
        { texto: 'KM/L', elemento: `<input oninput="calcularValorCombustivel()" value="${custo?.kml || ''}" type="number" id="kml" type="number">` },
        { texto: 'Valor Combustível', elemento: `R$ <input  oninput="calcularValorCombustivel()" value="${custo?.combustivel || ''}" type="number" id="combustivel" type="number">` },
        { texto: 'Distribuição', elemento: tabela },
        { texto: 'Total KM', elemento: `<input value="${custo?.km || ''}" style="width: 5rem;" id="km" readOnly> km` },
        { texto: 'Litros', elemento: `<input value="${custo?.litros || ''}" style="width: 5rem;" id="litros" readOnly>` },
        { texto: 'Custo Total', elemento: `R$ <input value="${custo?.custo_total || ''}" type="number" id="custo_total" type="number">` },
        {
            texto: 'Motorista', elemento: `
            <span ${custo?.motorista ? `id="${custo?.motorista}"` : ''} class="opcoes" name="nameMotorista" onclick="cxOpcoes('nameMotorista', 'tempMotoristas', ['nome', 'cidade'])">
                ${motorista?.nome || 'Selecione'}
            </span>
            `}
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: (!idCusto || duplicar) ? `salvarValores()` : `salvarValores('${idCusto}')` },
        { texto: 'Atualizar', img: 'atualizar', funcao: `atualizarGCS()` },
    ]

    popup({ linhas, botoes, titulo: 'Gerenciar Custo' })

    for (const [codigo, km] of Object.entries(custo.distribuicao || {})) {
        const descricao = db.departamentos_AC?.[codigo]?.cliente?.nome || 'Desatualizado...'
        linDist({ codigo, km, descricao })
    }

}

function linDist({ descricao, codigo, km } = {}) {
    const tbody = document.getElementById('distribuicao')

    const chave = ID5digitos()

    tbody.insertAdjacentHTML('beforeend', `
        <tr>
            <td>
                <span 
                class="opcoes" 
                name="${chave}" 
                ${codigo ? `id="${codigo}"` : ''}
                onclick="cxOpcoes('${chave}', 'departamentos_AC', ['cliente/nome', 'descricao', 'cliente/cidade', 'cliente/cnpj'])">
                    ${descricao || 'Selecione'}
                </span>
            </td>
            <td>
                <input value="${km || ''}" style="width: 5rem;" oninput="calcularValorCombustivel()" name="km" type="number">
            </td>
            <td>
                <img onclick="this.closest('tr').remove(); calcularValorCombustivel()" src="imagens/cancel.png" style="width: 1.5rem;">
            </td>
        </tr>`
    )
}

function calcularValorCombustivel() {
    const linhas = document.querySelectorAll('#distribuicao tr')
    const kml = Number(document.getElementById('kml').value)
    const combustivel = Number(document.getElementById('combustivel').value)

    let totalKM = 0

    for (const linha of linhas) {
        const km = Number(linha.querySelector('[name="km"]').value)
        totalKM += km
    }

    const valor = (totalKM / kml) * combustivel

    document.getElementById('km').value = totalKM
    document.getElementById('litros').value = totalKM ? Math.ceil(totalKM / kml) : 0

    const ct = document.getElementById('custo_total')

    ct.value = valor ? Math.ceil(valor / 10) * 10 : 0
}


async function salvarValores(idCusto = ID5digitos()) {

    overlayAguarde()

    const idMotorista = document.querySelector('[name="nameMotorista"]').id
    const motorista = await recuperarDado('motoristas', idMotorista)
    const custo_total = obterValores('custo_total')
    const data_pagamento = obterValores('data_pagamento')

    if (!motorista)
        return popup({ mensagem: `Preencha o motorista` })

    if (custo_total == '')
        return popup({ mensagem: `Preencha o valor do pagamento` })

    if (data_pagamento == '')
        return popup({ mensagem: `Preencha a data de pagamento` })

    const distribuicao = {}
    const linhas = document.querySelectorAll('#distribuicao tr')

    for (const linha of linhas) {
        const tds = linha.querySelectorAll('td')
        const span = tds[0].querySelector('span')

        if (!span.id)
            return popup({ mensagem: 'Departamento em branco' })

        const dep = span.id
        const km = Number(linha.querySelector('[name="km"]').value)
        if (!distribuicao[dep]) distribuicao[dep] = 0
        distribuicao[dep] += km
    }

    const dados = {
        distribuicao,
        motorista: idMotorista,
        veiculo: motorista.veiculo,
        categoria: 'Combustível',
        custo_total,
        combustivel: obterValores('combustivel'),
        kml: obterValores('kml'),
        comentario: obterValores('comentario'),
        data_pagamento,
        data: new Date().toLocaleString(),
        usuario: acesso.usuario,
        km: obterValores('km'),
        litros: obterValores('litros')
    }

    enviar(`custo_veiculos/${idCusto}`, dados)
    await inserirDados({ [idCusto]: dados }, 'custo_veiculos')
    await telaVeiculos()

    removerPopup()
}

async function novoVeiculo(idVeiculo) {

    const veiculo = await recuperarDado('veiculos', idVeiculo) || {}
    const opcoes = ['Locado', 'Devolvido']
        .map(op => `<option ${veiculo?.status == op ? 'selected' : ''}>${op}</opcoes>`)
        .join('')

    const motoristas = []

    for (const id of (veiculo.motoristas || [])) {
        const motorista = await recuperarDado('dados_clientes', id)
        motoristas.push(adicionarMotorista(motorista))
    }

    const linhas = [
        { texto: 'Placa', elemento: `<input value="${veiculo?.placa || ''}" id="placa" placeholder="Placa">` },
        { texto: 'Modelo', elemento: `<input value="${veiculo?.modelo || ''}" id="modelo" placeholder="Modelo">` },
        { texto: 'Final do Cartão', elemento: `<input value="${veiculo?.cartao || ''}" id="cartao" placeholder="Final do Cartão">` },
        { texto: 'Status', elemento: `<select id="status">${opcoes}</select>` },
        {
            texto: `<div style="${horizontal}; gap: 1rem;"><span>Motoristas</span> <img src="imagens/baixar.png" onclick="adicionarMotorista()"></div>`,
            elemento: `
            <div class="motoristas">
                ${motoristas.join('')}
            </div>`
        }
    ]
    const funcao = idVeiculo ? `salvarVeiculo('${idVeiculo}')` : 'salvarVeiculo()'
    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    popup({ linhas, botoes, titulo: 'Gerenciar Veículo' })

}

function adicionarMotorista({ id, nome } = {}) {

    const div = document.querySelector('.motoristas')
    const aleatorio = id || ID5digitos()
    const label = `<span class="opcoes" ${id ? `id="${aleatorio}"` : ''} name="${aleatorio}" onclick="cxOpcoes('${aleatorio}', 'dados_clientes', ['nome', 'cidade'])">${nome || 'Selecione'}</span>`
    if (id)
        return label

    div.insertAdjacentHTML('beforeend', label)
}

function obterValores(id) {
    const elemento = document.getElementById(id);
    const tipo = elemento.type;

    if (tipo === "number") return Number(elemento.value);

    return elemento.value;
}

async function salvarVeiculo(idVeiculo = ID5digitos()) {

    overlayAguarde()

    const motoristas = [...document.querySelectorAll('.motoristas span')]
        .filter(m => m.id)
        .map(m => Number(m.id))

    const veiculo = {
        id: idVeiculo,
        modelo: obterValores('modelo'),
        placa: obterValores('placa'),
        status: obterValores('status'),
        cartao: obterValores('cartao'),
        motoristas
    }

    enviar(`veiculos/${idVeiculo}`, veiculo)
    await inserirDados({ [idVeiculo]: veiculo }, 'veiculos')

    removerPopup()
}
