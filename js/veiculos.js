let filtroVeiculos = {}
let motoristas = {}
let veiculos = {}
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

async function atualizarDadosVeiculos() {

    const tabelas = [
        'departamentos_AC', // Referência;
        'dados_orcamentos',
        'motoristas',
        'dados_clientes',
        'veiculos',
        'custo_veiculos'
    ]

    for (const tabela of tabelas) await sincronizarDados(tabela)
    await auxDepartamentos() // Resgatar dados do orçamento no objeto departamentos;

    await telaVeiculos()
}

async function telaVeiculos() {

    overlayAguarde()

    dados_clientes = await recuperarDados('dados_clientes') || {}
    departamentos = await recuperarDados('departamentos_AC') || {}
    veiculos = await recuperarDados('veiculos') || {}
    motoristas = await recuperarDados('motoristas') || {}
    const custo_veiculos = await recuperarDados('custo_veiculos') || {}

    // Objeto genérico auxiliar para o form de custos;
    let tempMotoristas = {}
    for (const omie of Object.keys(motoristas)) {
        const cliente = dados_clientes[omie] || {}
        tempMotoristas[omie] = {
            nome: cliente.nome || '???',
            cidade: cliente.cidade || '???'
        }
    }

    await inserirDados(tempMotoristas, 'tempMotoristas')

    let ths = '', tsh = ''
    const colunas = ['Usuário & Data', 'Veículo', 'Data Pagamento', 'Valor', 'Realizado', 'Cartão', 'Comentário', 'Departamentos', 'Editar']
        .map((coluna, i) => {

            if (coluna == 'Editar' || coluna == 'Anexos') {
                tsh += '<th style="background-color: white;"></th>'
            } else if (coluna == 'Data Pagamento') {
                tsh += `
                    <th style="background-color: white;">
                        <div class="datas-cab">
                            <input style="width: max-content;" class="etiquetas" onchange="pesquisarEmVeiculos()" type="date" name="inicio">
                            <input style="width: max-content;" class="etiquetas" onchange="pesquisarEmVeiculos()" type="date" name="fim">
                        </div>
                    </th>
                `
            } else {
                tsh += `<th contentEditable="true" style="text-align: left; background-color: white;" oninput="pesquisarEmVeiculos({coluna: ${i}, texto: this.textContent})"></th>`
            }

            ths += `<th>${coluna}</th>`
        })

    const acumulado = `
        <div class="tela-veiculos">
            <div style="${vertical}; width: 100%;">
                <div class="painelBotoes">
                    <div class="total-tabela">
                        <label>Total de pagamento <b>Realizado</b> • </label>
                        <span name="total">--</span>
                    </div>
                    ${acesso.permissao == 'adm' ? `<div id="viabilidade"></div>` : ''}
                </div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            <tr>${ths}</tr>
                            <tr>${tsh}</tr>
                        </thead>
                        <tbody id="bodyVeiculos"></tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
    `
    const telaVeiculos = document.querySelector('.tela-veiculos')
    if (!telaVeiculos) tela.innerHTML = acumulado

    criarMenus('veiculos')

    removerOverlay()

    for (const [idCusto, custo] of Object.entries(custo_veiculos)) {
        const nome = dados_clientes[custo.motorista].nome
        const veiculo = veiculos[custo.veiculo]
        criarLinhaVeiculo({ custo, nome, veiculo, idCusto })
    }

    pesquisarEmVeiculos()
}

const pesquisa = (campo) => `
    <div style="${horizontal}; background-color: white; border-radius: 3px; padding: 0.5rem; margin: 0.5rem;">
        <input style="border: none; border-radius: 15px;" oninput="pesquisarBotoes(this, '${campo}')" placeholder="Pesquisar ${campo}">
        <img src="imagens/pesquisar4.png" style="width: 1.5rem;">
    </div>
`

function auxMotoristas() {

    const linhas = Object.entries(motoristas)
        .map(([idMotorista, motorista]) =>
            `<div class="diVeiculos" onclick="novoMotorista('${idMotorista}')">
                <img src="imagens/${veiculos?.[motorista.veiculo]?.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5vw;">

                <div style="${vertical}">
                    <label name="motorista">${dados_clientes?.[idMotorista]?.nome || ''}</label>
                    <label><strong>${veiculos?.[motorista.veiculo]?.modelo || ''}</strong> ${veiculos?.[motorista.veiculo]?.placa || 'Sem veículo'}</label>
                </div>
            </div>
            `)
        .join('')

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">
            
            <div style="${vertical}">
                <div class="painelBotoes">
                    ${pesquisa('motorista')}
                    <button onclick="novoMotorista()">Adicionar</button>
                </div>
                <div id="motorista" class="fundoPainelLateral">${linhas}</div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
    `

    popup(acumulado, 'Motoristas', true)
}

function auxVeiculos() {

    const linhas = Object.entries(veiculos)
        .map(([idVeiculo, veiculo]) => `
            <div class="diVeiculos" onclick="novoVeiculo('${idVeiculo}')">
                <img src="imagens/${veiculo.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5rem;">

                <div style="${vertical}">
                    <label name="veículo"><strong>${veiculo.modelo}</strong></label>
                    <label name="veículo">${veiculo.placa}</label>
                    <label name="veículo">${veiculo.status}</label>
                </div>
            </div>
            `)
        .join('')

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">
            <div class="painelBotoes">
                ${pesquisa('veículo')}
                <button onclick="novoVeiculo()">Adicionar</button>
            </div>
            <div id="veículo" class="fundoPainelLateral">${linhas}</div>
            <div class="rodape-tabela"></div>
        </div>
    `

    popup(acumulado, 'Veículos', true)
}

function criarLinhaVeiculo({ custo, nome, veiculo, idCusto }) {

    function conversorData(data) {

        if (!data) return ''

        let [ano, mes, dia] = data.split('-')
        let dataFormatada = `${dia}/${mes}/${ano}`

        return dataFormatada
    }

    const editavel = acesso.permissao == 'adm' || acesso.setor == 'FINANCEIRO'

    const deps = Object.entries(custo?.distribuicao || {})
        .map(([codDep, km]) => {
            const dep = departamentos?.[codDep] || {}
            const porcentagem = km / custo.km
            const valor = custo.realizado ? porcentagem * custo.realizado : ''
            return `
            <div style="${horizontal}; gap: 2px;">
                <div class="etiquetas"
                name="departamento"
                data-valor="${valor}"
                data-codigo="${codDep}">
                    <span>${dep?.descricao || 'Desatualizado...'}</span>
                    <span style="text-align: left;">${dep?.cliente?.nome || ''}</span>
                </div>
            </div>
            `
        }).join('')

    const tds = `
        <td style="text-align: left;">
            <div style="${vertical}">
                <label><strong>${custo.usuario}</strong></label>
                <label>${custo.data}</label>
            </div>
        </td>

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
            <div style="${vertical}; gap: 1px;">${deps}</div>
        </td>

        <td>
            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <img src="imagens/pesquisar2.png" style="width: 1.5vw; cursor: pointer;" onclick="painelAtalhos('${idCusto}')">
            </div>
        </td>`

    const tr = document.getElementById(idCusto)
    if (tr) return tr.innerHTML = tds
    document.getElementById('bodyVeiculos').insertAdjacentHTML('beforeend', `<tr id="${idCusto}">${tds}</tr>`)
}

function viabilidadeOmie() {

    const viabilidade = document.getElementById('viabilidade')
    if (!viabilidade) return

    let possibilidade = true
    totalDepartamentos = {}

    const linhas = document.querySelectorAll('#bodyVeiculos tr')
    for (const linha of linhas) {

        if (linha.style.display == 'none') continue

        const deps = linha.querySelectorAll('[name="departamento"]')

        if (deps.length == 0) possibilidade = false

        for (const dep of deps) {
            const codigo = Number(dep.dataset.codigo)

            totalDepartamentos[codigo] ??= 0
            totalDepartamentos[codigo] += Number(dep.dataset.valor)
        }

    }

    viabilidade.innerHTML = `
        <div ${possibilidade ? `onclick="criarPagamentoVeiculo()"` : ''} class="etiquetas" style="flex-direction: row; align-items: center; gap: 0.5rem; margin: 0.5rem;">
            <img src="imagens/${possibilidade ? 'concluido' : 'proibido'}.png">
            <span>Criar pagamento no Omie</span>
        </div>
    `
}

async function criarPagamentoVeiculo() {

    let totalDeps = 0
    const deps = Object.entries(totalDepartamentos)
        .map(([codigo, total]) => {
            const dep = departamentos?.[codigo] || {}
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

    const form = new formulario({ linhas, botoes, titulo: 'Criar pagamento no Omie' })
    form.abrirFormulario()

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

    if (!taxa || !inpData) return popup(mensagem('Preencha a data e/ou o valor da taxa'), 'Campo ausente', true)
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
    if(!distribuicao[6689610735]) {
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
    if (resposta.mensagem) return popup(mensagem(resposta.mensagem), 'Alerta', true)

    removerPopup()
    popup(mensagem('Realizado com sucesso', 'imagens/concluido.png'), 'Enviado', true)

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

function pesquisarEmVeiculos({ coluna, texto } = {}) {

    const inicio = document.querySelector('[name="inicio"]').value
    const fim = document.querySelector('[name="fim"]').value

    const dtInicio = inicio ? new Date(...inicio.split('-').map((v, i) => i === 1 ? v - 1 : v)) : null
    const dtFinal = fim ? new Date(...fim.split('-').map((v, i) => i === 1 ? v - 1 : v)) : null

    if (coluna !== undefined && coluna !== null) {
        filtroVeiculos[coluna] = String(texto).toLowerCase()
    }

    const trs = document.querySelectorAll('#bodyVeiculos tr')
    let total = 0

    for (const tr of trs) {
        const tds = tr.querySelectorAll('td')
        let mostrarLinha = true

        // filtros de texto
        for (const [col, filtroTexto] of Object.entries(filtroVeiculos)) {
            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input, textarea, select') || tds[col].textContent
                let conteudo = element.value ? element.value : element
                let texto_campo = String(conteudo).toLowerCase().replace('.', '')

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false
                    break
                }
            }
        }

        // filtro de data
        const dataPagamento = tds[2].querySelector('[name="datas"]').value
        if (dataPagamento && dtInicio && dtFinal) {
            const dataConvertida = new Date(...dataPagamento.split('-').map((v, i) => i === 1 ? v - 1 : v))

            if (dataConvertida < dtInicio || dataConvertida > dtFinal) {
                mostrarLinha = false
            }
        }

        tr.style.display = mostrarLinha ? '' : 'none'

        if (mostrarLinha) {
            total += Number(tr.querySelector('[name="valores"]').value) || 0
        }
    }

    document.querySelector('[name="total"]').textContent = dinheiro(total)
    viabilidadeOmie()
}

async function painelAtalhos(idCusto) {

    const custo = await recuperarDado('custo_veiculos', idCusto)

    const acumulado = `
    <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 1rem;">
        ${modeloBotoes('duplicar', 'Duplicar Pagamento', `painelValores('${idCusto}', true)`)}
        ${modeloBotoes('editar', 'Editar Pagamento', `painelValores('${idCusto}')`)}
        ${(acesso.permissao == 'adm' || acesso.usuario == custo.usuario) ? modeloBotoes('cancel', 'Excluir Pagamento', `painelExcluir('${idCusto}')`) : ''}
    </div>
    `
    popup(acumulado, 'Atalhos')
}

function pesquisarBotoes(input, modalidade) {
    const container = document.getElementById(modalidade)
    const termo = input.value.toLowerCase()
    const divs = container.querySelectorAll('div')

    for (let div of divs) {
        const labels = div.querySelectorAll(`[name="${modalidade}"]`)
        let tdsTermos = '';

        for (let label of labels) {
            tdsTermos += ' ' + label.textContent.toLowerCase()
        }

        const visivel = tdsTermos.includes(termo) || termo === ''
        div.style.display = visivel ? 'flex' : 'none'
    }
}

function painelExcluir(idCusto) {

    const acumulado = `
    <div style="${horizontal}; gap: 1rem; padding: 1rem; background-color: #d2d2d2;">
        <label>Deseja excluir este lançamento?</label>
        <button onclick="excluirCusto('${idCusto}')">Confirmar</button>
    </div>
    `

    popup(acumulado, 'Tem certeza?')
}

async function excluirCusto(idCusto) {

    removerPopup()
    overlayAguarde()
    await deletarDB('custo_veiculos', idCusto)
    deletar(`custo_veiculos/${idCusto}`)
    const linha = document.getElementById(idCusto)
    if (linha) linha.remove()
    removerOverlay()

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
        { texto: 'Salvar', img: 'concluido', funcao: !idCusto ? `salvarValores()` : duplicar ? `salvarValores(false)` : `salvarValores('${idCusto}')` },
        { texto: 'Atualizar', img: 'atualizar3', funcao: `atualizarDadosVeiculos()` },
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Gerenciar Custo' })
    form.abrirFormulario()

    for (const [codigo, km] of Object.entries(custo.distribuicao || {})) {
        const descricao = departamentos?.[codigo]?.cliente?.nome || 'Desatualizado...'
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
    document.getElementById('litros').value = Math.ceil(totalKM / kml)

    const ct = document.getElementById('custo_total')

    ct.value = Math.ceil(valor / 10) * 10
}


async function salvarValores(idCusto) {

    overlayAguarde()

    const idMotorista = document.querySelector('[name="nameMotorista"]').id
    const motorista = await recuperarDado('motoristas', idMotorista)
    idCusto = idCusto || ID5digitos()

    const custo_total = obterValores('custo_total')
    const data_pagamento = obterValores('data_pagamento')

    if (!motorista) return popup(mensagem(`Preencha o motorista`), 'Alerta', true)
    if (custo_total == '') return popup(mensagem(`Preencha o valor do pagamento`), 'Alerta', true)
    if (data_pagamento == '') return popup(mensagem(`Preencha a data de pagamento`), 'Alerta', true)

    const distribuicao = {}
    const linhas = document.querySelectorAll('#distribuicao tr')

    for (const linha of linhas) {
        const tds = linha.querySelectorAll('td')
        const span = tds[0].querySelector('span')

        if (!span.id) return popup(mensagem('Departamento em branco'), 'Alerta', true)

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

    const veiculo = veiculos[idVeiculo]
    const opcoes = ['Locado', 'Devolvido']
        .map(op => `<option ${veiculo?.status == op ? 'selected' : ''}>${op}</opcoes>`)
        .join('')
    const funcao = idVeiculo ? `salvarVeiculo('${idVeiculo}')` : 'salvarVeiculo()'

    const linhas = [
        { texto: 'Placa', elemento: `<input value="${veiculo?.placa || ''}" id="placa" placeholder="Placa">` },
        { texto: 'Modelo', elemento: `<input value="${veiculo?.modelo || ''}" id="modelo" placeholder="Modelo">` },
        { texto: 'Final do Cartão', elemento: `<input value="${veiculo?.cartao || ''}" id="cartao" placeholder="Final do Cartão">` },
        { texto: 'Status', elemento: `<select id="status">${opcoes}</select>` },
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Gerenciar Veículo' })
    form.abrirFormulario()

}

function obterValores(id) {
    const elemento = document.getElementById(id);
    const tipo = elemento.type;

    if (tipo === "number") return Number(elemento.value);

    return elemento.value;
}

async function salvarVeiculo(idVeiculo) {

    overlayAguarde()
    let veiculos = await recuperarDados('veiculos') || {}
    idVeiculo = idVeiculo || ID5digitos()
    let veiculo = {
        modelo: obterValores('modelo'),
        placa: obterValores('placa'),
        status: obterValores('status'),
        cartao: obterValores('cartao')
    }

    veiculos[idVeiculo] = veiculo

    enviar(`veiculos/${idVeiculo}`, veiculo)
    await inserirDados(veiculos, 'veiculos')
    await telaVeiculos()

    removerPopup()
    removerOverlay()
}

async function dadosVeiculo() {

    const idVeiculo = document.querySelector('[name="nameVeiculo"]')
    if (!idVeiculo) return
    const veiculo = await recuperarDado('veiculos', idVeiculo.id)

    const acumulado = `
        <div class="contorno-destaque">
            <img src="imagens/veiculo.png" style="width: 3rem;">
            <div style="display: flex; justify-content: start; align-items: start; flex-direction: column;">
                ${labelDupla('Final do Cartão', veiculo?.cartao || 'Não informado')}
                ${labelDupla('Modelo', veiculo?.modelo)}
                ${labelDupla('Placa', veiculo?.placa)}
                ${labelDupla('Status', veiculo?.status)}
            </div>
        </div>
    `

    const div = document.getElementById('dados_veiculos')
    div.innerHTML = veiculo ? acumulado : ''

}

async function novoMotorista(idMotorista) {

    const cliente = await recuperarDado('dados_clientes', idMotorista)
    const motorista = await recuperarDado('motoristas', idMotorista) || {}
    const idVeiculo = motorista?.veiculo || ''
    const veiculo = veiculos?.[idVeiculo] || {}

    const linhas = [
        {
            texto: 'Motorista', elemento: `
                <span ${idMotorista ? `id="${idMotorista}"` : ''} name="nameMotorista" class="opcoes" onclick="cxOpcoes('nameMotorista', 'dados_clientes', ['nome', 'cidade'])">
                    ${cliente?.nome || 'Selecione'}
                </span>
            `},
        {
            texto: 'Veículo', elemento: `
                <div style="${horizontal}; gap: 5px;">
                    <span ${idVeiculo ? `id="${idVeiculo}"` : ''} name="nameVeiculo" class="opcoes" onclick="cxOpcoes('nameVeiculo', 'veiculos', ['placa', 'modelo'], 'dadosVeiculo()')">
                        ${veiculo?.placa || 'Selecione'}
                    </span>
                    <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="removerVeiculo()">
                </div>
            `}
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'salvarMotorista()' }
    ]

    if (idMotorista) botoes.push({ texto: 'Excluir', img: 'cancel', funcao: 'confirmarExcluirItem()' })

    const form = new formulario({ linhas, botoes, titulo: 'Gerenciar Motorista' })
    form.abrirFormulario()

}

function removerVeiculo() {
    const idVeiculo = document.querySelector('[name="nameVeiculo"]')
    idVeiculo.textContent = 'Selecione'
    idVeiculo.removeAttribute('id')
}

function confirmarExcluirItem() {

    const acumulado = `
        <div style="${horizontal}; background-color: #d2d2d2; padding: 2rem;">
            <span>Tem certeza que deseja remover o item?</span>
            <button onclick="excluirItem()">Confirmar</button>
        </div>
    `

    popup(acumulado, 'Pense bem... não é tarde demais... ainda...', true)
}

async function excluirItem() {

    const idMotorista = document.querySelector('[name="nameMotorista"]').id
    if (!idMotorista) return

    removerPopup()
    overlayAguarde()

    deletarDB('motoristas', idMotorista)
    deletar(`motoristas/${idMotorista}`)

    await telaVeiculos()

}

async function salvarMotorista() {

    overlayAguarde()
    const idMotorista = document.querySelector('[name="nameMotorista"]').id
    if (!idMotorista) return popup(mensagem('Escolha um motorista'), 'AVISO', true)

    const idVeiculo = document.querySelector('[name="nameVeiculo"]').id || null
    const motorista = {
        veiculo: idVeiculo
    }

    enviar(`motoristas/${idMotorista}`, motorista)
    await inserirDados({ [idMotorista]: motorista }, 'motoristas')

    await telaVeiculos()
    removerPopup()
    removerOverlay()
}

async function removerAnexo(idCusto, idAnexo, img) {

    let custo_veiculos = await recuperarDados('custo_veiculos')
    let custo = custo_veiculos[idCusto]

    delete custo.anexos[idAnexo]

    deletar(`custo_veiculos/${idCusto}/anexos/${idAnexo}`)
    await inserirDados(custo_veiculos, 'custo_veiculos')

    img.parentElement.remove()
}

async function salvarAnexoCusto(input) {

    let dadosAnexos = await importarAnexos(input)
    let custo_veiculos = await recuperarDados('custo_veiculos')
    let idCusto = input.id
    let custo = custo_veiculos[idCusto]

    if (!custo.anexos) custo.anexos = {}

    dadosAnexos.forEach(anexo => {
        let idAnexo = ID5digitos()
        custo.anexos[idAnexo] = anexo
        input.nextElementSibling.insertAdjacentHTML('afterend', criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo('${idCusto}', '${idAnexo}', this)`))
        enviar(`custo_veiculos/${idCusto}/anexos/${idAnexo}`, anexo)
    })

    await inserirDados(custo_veiculos, 'custo_veiculos')

}

async function veiculosExcel() {

    const tabela = document.querySelector('.tabela')
    if (!tabela) return popup(mensagem('Tabela não encontrada'), 'Alerta', true)

    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('Dados')

    // Captura cabeçalho
    const cabecalhos = [...tabela.querySelectorAll('thead th')].map(th => th.innerText.trim())
    planilha.addRow(cabecalhos)

    // Captura linhas
    const linhas = tabela.querySelectorAll('tbody tr')
    linhas.forEach(tr => {
        const dados = [...tr.querySelectorAll('td')].map(td => td.innerText.trim())
        planilha.addRow(dados)
    })

    // Gera o arquivo Excel
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `veiculos.xlsx`
    link.click()

}