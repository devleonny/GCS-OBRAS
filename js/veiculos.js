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
async function telaVeiculos() {

    try {

        overlayAguarde()

        const colunas = {
            'Usuário': { chave: 'usuario' },
            'Motorista': { chave: 'veiculo.snapshots.motoristas' },
            'Data Pagamento': { chave: 'data_pagamento', tipoPesquisa: 'data' },
            'Marcador': {},
            'Valor': { chave: 'custo_total' },
            'Realizado': { chave: 'realizado' },
            'Cartão': { chave: 'veiculo.cartao' },
            'Departamentos': { chave: 'snapshots.departamentos' },
            'Editar': {}
        }

        const btnExtras = (acesso.permissao == 'adm' || acesso.setor == 'FINANCEIRO')
            ? `<div id="viabilidade"></div>`
            : ''

        const tabela = await modTab({
            pag: 'custoVeiculos',
            detalhes: true,
            btnExtras,
            body: 'bodyCustoVeiculos',
            base: 'custo_veiculos',
            colunas,
            criarLinha: 'criarLinhaCusto',
            substituicoes: [
                {
                    path: 'veiculo.motoristas.*.id',
                    tabela: 'clientes',
                    campoBusca: 'id',
                    retorno: 'nome',
                    destino: 'veiculo.motoristas.*.nomeMotorista'
                }
            ]
        })

        tela.innerHTML = `
            <div class="pagina-conteudo">
                <div class="cabecalho-pagina"><h2>Combustíveis</h2></div>
                ${tabela}
            </div>
        `

        await paginacao()

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir tabela de Combustíveis: Fale com o suporte.' })
    }

}

async function auxVeiculos() {

    const colunas = {
        'Cartão': { chave: 'cartao' },
        'Motoristas': { chave: 'snapshots.motoristas' },
        'Modelo': { chave: 'modelo' },
        'Placa': { chave: 'placa' },
        'Status': { chave: 'status' },
        'Editar': {}
    }

    const btnExtras = `<img src="imagens/baixar.png" onclick="novoVeiculo()">`

    const tabela = await modTab({
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

    const { snapshots } = veiculo || {}

    return `
    <tr>
        <td>${veiculo?.cartao || 'Sem cartão'}</td>
        <td>
            ${(snapshots?.motoristas || []).join('<br>')}
        </td>
        <td>
            <label name="veículo">${veiculo?.modelo || ''}</label>
        </td>
        <td>
            <label name="veículo">${veiculo?.placa || ''}</label>
        </td>
        <td>
            <div style="${horizontal}; justify-content: left; gap: 1rem;">
                <img src="imagens/${veiculo.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5rem;">
                <label name="veículo">${veiculo.status}</label>
            </div>
        </td>
        <td>
            <img src="imagens/pesquisar.svg" onclick="novoVeiculo('${veiculo.id}')">
        </td>
    </tr>
    `

}

async function criarLinhaCusto(custo) {

    const { veiculo, id, usuario, data_pagamento, comentario, data, realizado, custo_total, distribuicao = {} } = custo
    const { cartao, placa, modelo, motoristas, status } = veiculo || {}
    const editavel = acesso.permissao == 'adm' || acesso.setor == 'FINANCEIRO'

    const nomes = (motoristas || [])
        .filter(m => m.nomeMotorista)
        .map(m => `<b>${m?.nomeMotorista || ''}</b>`)
        .join('<br>')

    const deps = []

    for (const dados of Object.values(distribuicao || {})) {

        const { km, nomeDepartamento, departamento } = dados || {}
        const departamentoEstavel = String(departamento || nomeDepartamento || '')

        const porcentagem = km / custo.km
        const valor = realizado
            ? porcentagem * realizado
            : ''

        deps.push(`
            <div style="${horizontal}; gap: 2px;">
                <div class="tag-pendencias pagamento-balao pagamento-balao-departamento"
                name="departamento"
                data-departamento="${escaparAtributo(departamentoEstavel)}"
                data-valor="${valor}"
                data-codigo="${escaparAtributo(departamentoEstavel)}">
                    <span>${escaparAtributo(departamentoEstavel || '...')}</span>
                </div>
            </div>`)
    }

    const tds = `
        <td>${usuario}</td>

        <td>
            <div style="${horizontal}; justify-content: start; gap: 0.5rem; width: 300px;">
                <img src="imagens/${status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1rem;">
                <div style="${vertical}; text-align: left;">
                    <label>${nomes || ''}</label>
                    <label>${placa || ''}</label>
                    <label>${modelo || ''}</label>
                </div>
            </div>
        </td>

        <td>
            <label>${conversorData(data_pagamento)}</label>
        </td>

        <td style="text-align: center;">
            <input type="checkbox" name="marcador" onchange="viabilidadeOmie()" style="width: 2rem; height: 2rem;">
        </td>

        <td>
            <label style="white-space: nowrap;" name="valido">${dinheiro(custo_total)}</label>
        </td>

        <td>
            <div style="${horizontal}; gap: 2px;">
                <span>R$</span>
                <input oninput="mostrarBtn(this)" class="realizado" type="number" value="${realizado || ''}" ${editavel ? '' : 'readOnly'}>
                <img onclick="atualizarRealizado(this, '${id}')" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
            </div>
        </td>

        <td>${cartao || ''}</td>


        <td>
            <div style="${vertical}; gap: 1px;">${deps.join('')}</div>
        </td>

        <td>
            <img src="imagens/pesquisar.svg" onclick="painelAtalhos('${id}')">
        </td>`

    const detalhes = `
        <div class="veiculo-detalhes">
            <div><strong>Data de Registro</strong><span>${escaparAtributo(data || 'Sem data')}</span></div>
            <div><strong>Comentário</strong><span>${escaparAtributo(comentario || 'Sem comentário')}</span></div>
        </div>
    `

    return { linha: `<tr>${tds}</tr>`, detalhes }
}

function viabilidadeOmie() {

    const viabilidade = document.getElementById('viabilidade')
    if (!viabilidade) return

    let possibilidade = true
    totalDepartamentos = {}
    let total = 0

    const linhas = document.querySelectorAll('#bodyCustoVeiculos tr:not(.tabela-linha-detalhes)')
    for (const linha of linhas) {

        const deps = linha.querySelectorAll('[name="departamento"]')

        const marcador = linha.querySelector('[name="marcador"]').checked

        if (!marcador)
            continue

        if (deps.length == 0)
            possibilidade = false

        for (const dep of deps) {
            const departamento = dep.dataset.departamento
            const valor = Number(dep.dataset.valor)

            if (valor == 0)
                continue

            totalDepartamentos[departamento] ??= 0
            totalDepartamentos[departamento] += valor

            total += valor
        }

    }

    if (total == 0)
        possibilidade = false

    viabilidade.innerHTML = `
        <div ${possibilidade ? `onclick="criarPagamentoVeiculo()"` : ''} 
            class="botao-criar-pagamento">
            <img src="imagens/${possibilidade ? 'concluido' : 'proibido'}.png">
            <span>Criar pagamento</span>
            <span style="white-space: nowrap;">${dinheiro(total)}</span>
        </div>
    `
}

async function criarPagamentoVeiculo() {

    let totalDeps = 0

    const deps = []

    for (const [descricao, valor] of Object.entries(totalDepartamentos)) {

        totalDeps += valor
        deps.push(`
            <div class="tag-pendencias pagamento-balao pagamento-veiculo-resumo">
                <span>${escaparAtributo(descricao || 'Desatualizado...')}</span>
                <strong>${dinheiro(valor)}</strong>
            </div>`)
    }

    const linhas = [
        { texto: 'App', elemento: `<select id="app">${['AC', 'IAC'].map(op => `<option>${op}</option>`).join('')}</select>` },
        {
            texto: 'Taxa', elemento: `
                <div class="campo-moeda-combustivel">
                    <span>R$</span>
                    <input id="taxa" oninput="somarTaxa(this)" type="number">
                </div>`
        },
        { texto: 'Valor', elemento: `<span id="total" data-total="${totalDeps}">${dinheiro(totalDeps)}</span>` },
        { texto: 'Data', elemento: `<input id="data" type="date">` },
        { texto: 'Observação', elemento: `<textarea id="observacao"></textarea>` },
        { texto: 'Departamentos', elemento: `<div style="${vertical}; gap: 1px;">${deps.join('')}</div>` }
    ]

    const botoes = [
        { img: 'salvo', funcao: 'salvarPagamentoVeiculo()', texto: 'Criar pagamento' }
    ]

    popup({ linhas, botoes, titulo: 'Criar pagamento' })

}

async function salvarPagamentoVeiculo() {
    const el = (id) => {
        const elem = document.getElementById(id)
        return elem.value
    }

    const app = el('app')
    const observacao = el('observacao')
    const taxa = Number(el('taxa'))
    const inpData = el('data')

    if (!Number.isFinite(taxa) || taxa < 0 || !inpData)
        return popup({ mensagem: 'Preencha a data e/ou o valor da taxa' })

    overlayAguarde()

    try {
        const dt = (data) => {
            const [ano, mes, dia] = data.split('-')
            return `${dia}/${mes}/${ano}`
        }

        const data = dt(inpData)
        const idPagamento = crypto.randomUUID()

        const valoresPorDepartamento = { ...totalDepartamentos }
        valoresPorDepartamento.EMPRESA = Number(valoresPorDepartamento.EMPRESA || 0) + taxa

        const itensDistribuicao = Object.entries(valoresPorDepartamento).map(([departamento, valor]) => ({
            cCodDep: String(departamento),
            nValDep: Number(valor || 0)
        }))

        const distribuicaoAgrupada = {}
        let totalGeral = 0

        for (const item of itensDistribuicao) {
            const { cCodDep, nValDep } = item

            if (!distribuicaoAgrupada[cCodDep]) {
                distribuicaoAgrupada[cCodDep] = { cCodDep, nValDep: 0 }
            }

            distribuicaoAgrupada[cCodDep].nValDep += nValDep
            totalGeral += nValDep
        }

        const distribuicao = Object.values(distribuicaoAgrupada)

        const codigoCategoria = 'Combustível'

        const codigoCliente = 6066446384

        const pagamento = {
            app,
            status: 'Aprovado por fin',
            criado: acesso.usuario,
            data_registro: new Date().toLocaleString(),
            param_estavel: {
                codigo_cliente_fornecedor: codigoCliente,
                chave_pix: '',
                data_vencimento: data,
                data_previsao: data,
                distribuicao,
                observacao,
                valor_documento: totalGeral,
                categorias: [{ codigo_categoria: codigoCategoria, valor: totalGeral }]
            },
            snapshots: {
                cliente: 'TICKET LOG',
                valor: totalGeral,
                categorias: [{ categoria: codigoCategoria, valor: totalGeral }],
                departamentos: distribuicao.map(({ cCodDep, nValDep }) => ({
                    departamento: cCodDep,
                    valor: nValDep
                }))
            }
        }

        const resultado = await enviar(`lista_pagamentos/${idPagamento}`, pagamento)
        if (!resultado?.success)
            throw new Error(resultado?.mensagem || 'Falha ao criar pagamento')

        removerPopup()
        popup({ mensagem: 'Lançado no GCS', imagem: 'imagens/concluido.png' })

    } catch (err) {
        removerPopup()
        popup({ mensagem: err.message || 'Erro ao criar pagamento' })
    } finally {
        removerOverlay()
    }
}

function somarTaxa(input) {
    const elemTotal = document.getElementById('total')
    const total = Number(elemTotal.dataset.total)
    elemTotal.innerHTML = dinheiro(total + Number(input.value || 0))
}

async function atualizarRealizado(img, idCusto) {

    const input = img.previousElementSibling
    const realizado = Number(input.value)

    img.style.display = 'none'

    await enviar(`custo_veiculos/${idCusto}/realizado`, realizado)

}

async function painelAtalhos(idCusto) {

    const { usuario } = await recuperarDado('custo_veiculos', idCusto)

    const botoes = [
        { texto: 'Duplicar Pagamento', img: 'duplicar', funcao: `painelValores('${idCusto}', true)` },
        { texto: 'Editar Pagamento', img: 'editar', funcao: `painelValores('${idCusto}')` },
    ]

    if ((acesso.permissao == 'adm' || acesso.usuario == usuario))
        botoes.push({ texto: 'Excluir Pagamento', img: 'cancel', funcao: `painelExcluir('${idCusto}')` })

    popup({ botoes, mensagem: 'Escolha uma opção', titulo: 'Atalhos' })
}

function painelExcluir(idCusto) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', fechar: true, funcao: `excluirCusto('${idCusto}')` }
    ]

    popup({ botoes, mensagem: 'Deseja excluir este lançamento?', removerAnteriores: true })
}

async function excluirCusto(idCusto) {

    await deletar(`custo_veiculos/${idCusto}`)

}

async function painelValores(idCusto, duplicar) {

    const custo = await recuperarDado('custo_veiculos', idCusto) || {}
    const { veiculo } = custo || {}
    const motoristas = Array.isArray(veiculo?.snapshots?.motoristas)
        ? veiculo.snapshots.motoristas
        : []

    const termos = [
        veiculo?.cartao,
        ...motoristas,
        veiculo?.placa,
        veiculo?.modelo
    ].filter(Boolean)

    const distribuicaoVisual = `
        <div class="distribuicao-combustivel">
            <div class="distribuicao-combustivel-topo">
                <span>Divisão dos quilômetros por departamento</span>
                <button type="button" onclick="linDist()">+ Adicionar departamento</button>
            </div>
            <div id="distribuicao" class="distribuicao-combustivel-lista vazio"></div>
        </div>
    `

    const linhas = [
        { texto: 'Comentário', elemento: `<textarea rows="5" style="padding: 0.5rem;" id="comentario">${custo?.comentario || ''}</textarea>` },
        { texto: 'Data Pagamento', elemento: `<input id="data_pagamento" type="date" value="${custo?.data_pagamento || ''}">` },
        { texto: 'KM/L', elemento: `<input oninput="calcularValorCombustivel()" value="${custo?.kml || ''}" type="number" id="kml" type="number">` },
        {
            texto: 'Valor Combustível', elemento: `
                <div class="campo-moeda-combustivel">
                    <span>R$</span>
                    <input oninput="calcularValorCombustivel()" value="${custo?.combustivel || ''}" type="number" id="combustivel">
                </div>`
        },
        { texto: 'Distribuição', elemento: distribuicaoVisual },
        {
            texto: 'Total KM', elemento: `
            <div style="${horizontal}; gap: 0.5rem;">
                <input value="${custo?.km || ''}" style="width: 5rem;" id="km" readOnly>
                km 
            </div>
            ` },
        { texto: 'Litros', elemento: `<input value="${custo?.litros || ''}" style="width: 5rem;" id="litros" readOnly>` },
        {
            texto: 'Custo Total',
            elemento: `
            <div style="${horizontal}; gap: 0.5rem;">
                R$ 
                <input value="${custo?.custo_total || ''}" id="custo_total" type="number">
            </div>
            ` },
        {
            texto: 'Motorista & Veículo',
            elemento: `
                <span ${veiculo?.id ? `id="${veiculo?.id}"` : ''}
                    class="opcoes"
                    name="veiculo"
                    onclick="cxOpcoes('veiculo')">
                        ${veiculo?.id ? termos.join('<br>') : 'Selecionar'}
                </span>`
        }

    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: (!idCusto || duplicar) ? `salvarValores()` : `salvarValores('${idCusto}')` }
    ]

    popup({ linhas, botoes, titulo: 'Gerenciar Custo' })

    // Controles;
    controlesCxOpcoes.veiculo = {
        base: 'veiculos',
        retornar: ['cartao', 'snapshots.motoristas', 'placa', 'modelo'],
        colunas: {
            'Final do Cartão': { chave: 'cartao' },
            'Placa': { chave: 'placa' },
            'Modelo': { chave: 'modelo' },
            'Motoristas': { chave: 'snapshots.motoristas' }
        }
    }

    for (const [codigo, { km }] of Object.entries(custo.distribuicao || {})) {
        linDist({ codigo, km, descricao: codigo })
    }

}

function linDist({ descricao, codigo, km } = {}) {

    const lista = document.getElementById('distribuicao')
    if (!lista) return
    const chave = crypto.randomUUID()
    lista.classList.remove('vazio')

    lista.insertAdjacentHTML('beforeend', `
        <div class="distribuicao-combustivel-item">
            <div class="distribuicao-combustivel-campo departamento">
                <label>Departamento</label>
                <span 
                class="opcoes" 
                name="${chave}" 
                    data-campo="departamento"
                ${codigo ? `id="${escaparAtributo(String(codigo))}"` : ''}
                onclick="cxOpcoes('${chave}')">
                    ${escaparAtributo(descricao || 'Selecione')}
                </span>
            </div>
            <div class="distribuicao-combustivel-campo km">
                <label>KM</label>
                <input value="${km || ''}" min="0" step="0.01" oninput="calcularValorCombustivel()" name="km" type="number" placeholder="0">
            </div>
            <span class="close"
                onclick="removerDistribuicaoCombustivel(this)"
                role="button" tabindex="0" aria-label="Remover departamento">&times;</span>
        </div>`
    )

    controlesCxOpcoes[chave] = {
        base: 'mesc_departamentos',
        retornar: ['id'],
        colunas: {
            'Descrição': { chave: 'id' }
        }
    }

}

function removerDistribuicaoCombustivel(botao) {
    const lista = document.getElementById('distribuicao')
    botao.closest('.distribuicao-combustivel-item')?.remove()
    lista?.classList.toggle('vazio', !lista.querySelector('.distribuicao-combustivel-item'))
    calcularValorCombustivel()
}

function calcularValorCombustivel() {
    const linhas = document.querySelectorAll('#distribuicao .distribuicao-combustivel-item')
    const kml = Number(document.getElementById('kml').value)
    const combustivel = Number(document.getElementById('combustivel').value)

    let totalKM = 0

    for (const linha of linhas) {
        const km = Number(linha.querySelector('[name="km"]').value)
        totalKM += km
    }

    const calculoValido = kml > 0 && combustivel > 0
    const litros = calculoValido ? totalKM / kml : 0
    const valor = litros * combustivel

    document.getElementById('km').value = totalKM
    document.getElementById('litros').value = totalKM ? Math.ceil(litros) : 0

    const ct = document.getElementById('custo_total')

    ct.value = valor ? Math.ceil(valor / 10) * 10 : 0
}


async function salvarValores(idCusto = crypto.randomUUID()) {

    overlayAguarde()

    const painel = document.querySelector('.painel-padrao')
    const idVeiculo = painel.querySelector('[name="veiculo"]').id
    const veiculo = await recuperarDado('veiculos', idVeiculo)
    const { usuario } = await recuperarDado('custo_veiculos', idCusto) || {}

    const custo_total = obterValores('custo_total')
    const data_pagamento = obterValores('data_pagamento')

    if (!idVeiculo)
        return popup({ mensagem: `Preencha o Veículo` })

    if (custo_total == '')
        return popup({ mensagem: `Preencha o valor do pagamento` })

    if (data_pagamento == '')
        return popup({ mensagem: `Preencha a data de pagamento` })

    const distribuicao = {}
    const linhas = document.querySelectorAll('#distribuicao .distribuicao-combustivel-item')

    for (const linha of linhas) {
        const span = linha.querySelector('[data-campo="departamento"]')

        if (!span.id)
            return popup({ mensagem: 'Departamento em branco' })

        const departamento = span.id
        const km = Number(linha.querySelector('[name="km"]').value)

        if (km == 0)
            return popup({ mensagem: 'KM não pode ser 0' })

        distribuicao[departamento] ??= {
            departamento,
            km: 0
        }

        distribuicao[departamento].km += km
    }

    if (!Object.keys(distribuicao).length)
        return popup({ mensagem: `Preencha pelo menos 1 departamento` })

    const dados = {
        id: idCusto,
        distribuicao,
        veiculo,
        categoria: 'Combustível',
        custo_total,
        combustivel: obterValores('combustivel'),
        kml: obterValores('kml'),
        comentario: obterValores('comentario'),
        data_pagamento,
        data: new Date().toLocaleString(),
        km: obterValores('km'),
        litros: obterValores('litros'),
        usuario: usuario || acesso.usuario
    }

    await enviar(`custo_veiculos/${idCusto}`, dados)

    removerPopup()
}

async function novoVeiculo(idVeiculo) {

    overlayAguarde()

    const veiculo = await recuperarDado('veiculos', idVeiculo) || {}

    const opcoes = ['Locado', 'Devolvido']
        .map(op => `<option ${veiculo?.status == op ? 'selected' : ''}>${op}</opcoes>`)
        .join('')

    const motoristas = []

    for (const { id } of (veiculo.motoristas || [])) {
        const motorista = await recuperarDado('clientes', id)
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

    const botoes = [
        {
            texto: 'Salvar',
            img: 'concluido',
            funcao: idVeiculo
                ? `salvarVeiculo('${idVeiculo}')`
                : 'salvarVeiculo()'
        }
    ]

    if (acesso.permissao == 'adm' && idVeiculo)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirVeiculo('${idVeiculo}')` })

    popup({ linhas, botoes, titulo: 'Gerenciar Veículo' })

}

function confirmarExcluirVeiculo(idVeiculo) {

    const botoes = [
        {
            fechar: true,
            texto: 'Confirmar',
            img: 'concluido',
            funcao: `excluirVeiculo('${idVeiculo}')`
        }
    ]

    popup({ mensagem: 'Excluir Veículo', botoes, removerAnteriores: true })
}

async function excluirVeiculo(idVeiculo) {

    await deletar(`veiculos/${idVeiculo}`)

}

function adicionarMotorista({ id, nome } = {}) {

    const div = document.querySelector('.motoristas')
    const aleatorio = id || crypto.randomUUID()
    const label = `
        <div style="${horizontal}; gap: 1rem;">
            <span 
            class="opcoes"
            ${id ? `id="${aleatorio}"` : ''}
            name="${aleatorio}"
            onclick="cxOpcoes('${aleatorio}')">
                ${nome || 'Selecione'}
            </span>
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
        </div>
    `

    // Controles;
    controlesCxOpcoes[aleatorio] = {
        base: 'clientes',
        retornar: ['nome'],
        filtros: {
            usuario: { op: 'NOT_EMPTY' }
        },
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Matrícula': { chave: 'matricula' },
            'Nome': { chave: 'nome' },
            'Estado': { chave: 'estado' },
            'Cidade': { chave: 'cidade' }
        }
    }

    if (id)
        return label

    div.insertAdjacentHTML('beforeend', label)
}

function obterValores(id) {
    const elemento = document.getElementById(id);
    const tipo = elemento.type;

    if (tipo === "number")
        return Number(elemento.value);

    return elemento.value;
}

async function salvarVeiculo(idVeiculo = crypto.randomUUID()) {

    overlayAguarde()

    const motoristas = [...document.querySelectorAll('.motoristas span')]
        .filter(m => m.id)
        .map(m => ({ id: Number(m.id) }))

    const veiculo = {
        id: idVeiculo,
        modelo: obterValores('modelo'),
        placa: obterValores('placa'),
        status: obterValores('status'),
        cartao: obterValores('cartao'),
        motoristas
    }

    await enviar(`veiculos/${idVeiculo}`, veiculo)

    removerPopup()
}
