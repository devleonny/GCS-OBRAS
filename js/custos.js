async function painelCustos(id) {

    removerPopup() // Atalhos;
    overlayAguarde()

    criarMenus('custos')

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const { dados_orcam, snapshots, total_geral } = orcamento
    const { pagamentos = 0, fretes = 0, abastecimentos = 0, notas } = snapshots?.custos || {}

    // Salvo localmente;
    controles.orcamento ??= {}
    controles.orcamento.save = orcamento

    // Velocímetro
    const totalCusto = pagamentos + fretes + abastecimentos
    const porcentagem = Number(((totalCusto / total_geral) * 100).toFixed(1))
    const resumo = criarVelocimetroHTML({ rotulo: 'Custos', limite: 40, valor: porcentagem })

    const omieCliente = dados_orcam?.omie_cliente || ''
    const { cliente, cidade } = snapshots || {}

    const dados = Object.entries({
        cliente,
        cidade,
        centro_de_custo: dados_orcam?.contrato
    })
        .map(([campo, valor]) => `<span style="white-space: pre-wrap;"><b>${inicialMaiuscula(campo)}</b>\n${valor || ''}</span>`)
        .join('')


    const esquema = [
        {
            titulo: 'Total do Orçamento',
            id: 't-orcamento',
            funcao: `tabOrcamentoCusto()`
        },
        {
            titulo: 'Pagamentos Solicitados',
            id: 't-pagamentos',
            funcao: `tabPagamentosCusto()`
        },
        {
            titulo: 'Abastecimento',
            id: 't-abastecimento',
            funcao: `tabVeiculosCusto()`
        },
        {
            titulo: 'Fretes',
            id: 't-fretes',
            funcao: `tabFretesCusto()`
        },
        {
            titulo: 'Notas',
            id: 't-notas',
            funcao: `tabNotasCusto()`
        }
    ]

    const toolbar = esquema
        .map(({ titulo, id, funcao }) => {

            return `
            <div onclick="${funcao}" class="balao-checklist">
                <label>${titulo}</label>
                <div id="${id}" style="font-size: 1.4rem;">
                    <img src="gifs/loading.gif" style="width: 5rem">
                </div>
            </div>
        `
        })
        .join('')

    const elemento = `
        <div class="painel-custos">

            <h2>Resumo de Custos</h2>
            <div class="toolbar-checklist">

                <div style="${vertical}">${dados}</div>

                <div style="${horizontal}; gap: 0.5rem;">
                    <div style="width: 300px;">${resumo}</div>
                    <div class="resultados">
                        
                        <div onclick="inicioCustos()" class="balao-checklist">
                            <label>Início</label>
                        </div>
                        ${toolbar}
                        <img src="imagens/GrupoCostaSilva.png" style="width: 7rem;">
                    </div>
                    
                </div>

            </div>

            <hr>
            <h2>Detalhamento</h2>
            <div class="painel-custos-tabelas"></div>

        </div>
    `

    tela.innerHTML = elemento

    removerOverlay()

    await inicioCustos()

    await carregarTotaisCusto(id)

}

// TABELAS
async function inicioCustos() {

    const painel = document.querySelector('.painel-custos-tabelas')

    painel.innerHTML = `
        <div class="custos-inicial">
            <div class="painel-custos-lateral">
                <img src="gifs/loading.gif" style="width: 5rem;">
            </div>
            <div style="${vertical};">

                <div style="${horizontal}; gap: 1rem;">
                    <button onclick="mostrarGrafico('pizza')">Gráfico de Pizza</button>
                    <button onclick="mostrarGrafico('tempo')">Linha do Tempo</button>
                </div>

                <div class="grafico-box">
                    <canvas id="grafico-categorias"></canvas>
                </div>

                <div class="grafico-box">
                    <canvas id="grafico-linha-tempo"></canvas>
                </div>
            </div>
        </div>
    `

    await somaPorCategoria()

    mostrarGrafico('pizza')
}

function mostrarGrafico(tipo) {
    const boxes = document.querySelectorAll('.grafico-box')

    boxes.forEach(b => b.style.display = 'none')

    boxes[tipo == 'pizza' ? 0 : 1].style.display = 'flex'
}

async function somaPorCategoria() {

    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato

    const contagens = await contarPorCampo({
        base: 'lista_pagamentos',
        filtros: {
            'departamento': { op: '=', value: contrato }
        },
        explode: { path: 'snapshots.categorias' },
        modo: 'somaAgrupada',
        campoSoma: 'valor',
        path: 'categoria'
    })

    const blocoCategoria = (nome, valor) => {

        return `
        <div class="bloco-categoria">
            <span>${dinheiro(valor)}</span>
            <label>${nome}</label>
        </div>
        `
    }

    const painelLateral = document.querySelector('.painel-custos-lateral')

    const blocos = Object.entries(contagens)
        .filter(([categoria,]) => categoria !== 'todos' && categoria !== 'total')
        .sort(([a,], [b,]) => a.localeCompare(b))
        .map(([categoria, valor]) => blocoCategoria(categoria, valor))
        .join('')

    if (painelLateral)
        painelLateral.innerHTML = blocos

    graficoRosca({
        dados: contagens,
        elemento: '#grafico-categorias'
    })

    const porData = await contarPorCampo({
        base: 'lista_pagamentos',
        explode: { path: 'snapshots.departamentos' },
        filtros: {
            'departamento': { op: '=', value: contrato }
        },
        modo: 'somaAgrupada',
        campoSoma: 'valor',
        path: 'data_vencimento'
    })

    criarGraficoLinhaTempo({
        elemento: '#grafico-linha-tempo',
        dados: porData,
        rotulo: 'Custos por data'
    })

}

async function tabOrcamentoCusto() {

    const { esquema_composicoes, dados_composicoes } = controles.orcamento.save || {}

    const pag = 'criarOrcamento'
    const tabela = await modTab({
        base: Object.values(esquema_composicoes || dados_composicoes || {}),
        pag,
        nude: true,
        scroll: true,
        editavel: false,
        funcaoAdicional: ['formatarLinhasOrcamento', 'calcularSubtotais'],
        body: 'bodyOrcamento',
        criarLinha: 'carregarLinhaOrcamento',
        colunas: {}
    })

    const painel = document.querySelector('.painel-custos-tabelas')

    painel.innerHTML = tabela

    await paginacao(pag)

}

async function tabPagamentosCusto() {

    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato

    const pag = 'custosPagamentos'
    const tabela = await modTab({
        pag,
        body: 'bodyCustosPagamentos',
        criarLinha: 'criarLinhaCustoPagamento',
        base: 'lista_pagamentos',
        explode: { path: 'snapshots.categorias' },
        filtros: {
            'departamento': { op: '=', value: contrato },
            'param.*.codigo_tipo_documento': { op: '!=', value: 'CTE' },
        },
        colunas: {
            'Data': { chave: 'param.*.data_previsao', tipoPesquisa: 'data' },
            'Valor': { chave: 'descricao' },
            'Categoria': { chave: 'categoria' },
            'Status': { chave: 'status', tipoPesquisa: 'select' },
            'Solicitante': { chave: 'criado' },
            'Recebedor': { chave: 'snapshots.cliente' },
            'Observação': { chave: 'param.*.observacao' },
            'Ações': {}
        }
    })

    const painel = document.querySelector('.painel-custos-tabelas')

    painel.innerHTML = tabela

    await paginacao(pag)

}

async function tabVeiculosCusto() {

    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato

    const pag = 'custo-veiculos'
    const tabela = await modTab({
        pag,
        body: 'bodyVeiculos',
        base: 'custo_veiculos',
        criarLinha: 'criarLinhaCustoVeiculo',
        filtros: {
            'snapshots.departamentos.*.departamento': { op: '=', value: contrato }
        },
        colunas: {
            'Data Pagamento': { chave: 'data_pagamento', tipoPesquisa: 'data' },
            'Comentário': { chave: 'comentario' },
            'Realizado': { chave: 'snapshots.realizado' },
            'Criado por': { chave: 'usuario' },
            'Motorista': { chave: 'snapshots.motoristas' },
            'Ações': {}
        }
    })

    const painel = document.querySelector('.painel-custos-tabelas')

    painel.innerHTML = tabela

    await paginacao(pag)

}

async function tabFretesCusto() {

    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato

    const pag = 'custosFretes'

    const tabela = await modTab({
        pag,
        body: 'bodyCustosFretes',
        criarLinha: 'criarLinhaCustoPagamento',
        base: 'lista_pagamentos',
        explode: { path: 'snapshots.categorias' },
        filtros: {
            'departamento': { op: '=', value: contrato },
            'param.*.codigo_tipo_documento': { op: '=', value: 'CTE' },
        },
        colunas: {
            'Data': { chave: 'param.*.data_previsao', tipoPesquisa: 'data' },
            'Valor': { chave: 'descricao' },
            'Categoria': { chave: 'categoria' },
            'Status': { chave: 'status', tipoPesquisa: 'select' },
            'Solicitante': { chave: 'criado' },
            'Recebedor': {},
            'Observação': {},
            'Ações': {}
        }
    })

    const painel = document.querySelector('.painel-custos-tabelas')

    painel.innerHTML = tabela

    await paginacao(pag)

}

async function tabNotasCusto() {

    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato

    const pag = 'notas'
    const tabela = await modTab({
        base: 'notas',
        filtros: {
            'departamento': { op: '=', value: contrato }
        },
        explode: { path: 'snapshots.departamentos' },
        pag,
        funcaoAdicional: [],
        body: 'bodyNotas',
        criarLinha: 'criarLinhaNotas',
        colunas: {
            'NF': { chave: 'nNota' },
            'Tipo': { chave: 'categoria', tipoPesquisa: 'select' },
            'Valor': { chave: 'valor' },
            'Data Emissão': { chave: 'dEmiInicial' },
            'Hora Emissão': { chave: 'hEmiInicial' },
            'Ver DANFE': {}
        }
    })

    const painel = document.querySelector('.painel-custos-tabelas')

    painel.innerHTML = tabela

    await paginacao(pag)

}


// LINHAS
async function criarLinhaCustoVeiculo(combustivel) {

    const { id, data_pagamento, comentario, realizado, usuario, snapshots } = combustivel || {}
    const { dados_orcam } = controles.orcamento.save || {}
    const contrato = dados_orcam?.contrato
    const departamento = (snapshots?.departamentos || [])
        .filter(d => d.departamento == contrato)

    const dMotoristas = (snapshots?.motoristas || [])
        .join('\n')

    const tr = `
        <tr>
            <td>${new Date(data_pagamento).toLocaleDateString()}</td>
            <td>${comentario}</td>
            <td>${dinheiro(departamento?.[0]?.valor || 0)}</td>
            <td>${usuario}</td>
            <td>${dMotoristas}</td>
            <td>
                <img src="imagens/pesquisar2.png" onclick="painelAtalhos('${id}')">
            </td>
        </tr>
    `

    return tr
}

async function criarLinhaCustoPagamento(pagamento) {

    const { dados_orcam } = controles?.orcamento?.save || {}
    const { criado, param, status, snapshots, valor, categoria } = pagamento || {}
    const { data_previsao, observacao } = param?.[0] || {}

    const cliente = snapshots?.cliente || ''
    const contrato = dados_orcam?.contrato

    const imagem = iconePagamento(status)

    const tds = `
        <td>${data_previsao || ''}</td>
        <td style="white-space: nowrap;">${dinheiro(valor)}</td>
        <td>${categoria}</td>
        <td>
            <div style="${horizontal}; justify-content: start; gap: 1rem;">
                <img src="${imagem}">
                <span>${status || ''}</span>
            </div>
        </td>
        <td>${criado || ''}</td>
        <td>${cliente || ''}</td>
        <td>
            <div style="white-space: pre-wrap;">${observacao || ''}</div>
        </td>
        <td>
            <img src="imagens/pesquisar2.png" onclick="abrirDetalhesPagamentos('${pagamento.id}')">
        </td>
        `

    return `<tr>${tds}</tr>`

}

async function criarLinhaNotas(nota) {

    const { codOmie, nNota, valor, app, categoria, dEmiInicial, hEmiInicial } = nota || {}

    return `
        <tr>
            <td>${nNota}</td>
            <td>${categoria}</td>
            <td>${dinheiro(valor)}</td>
            <td>${dEmiInicial}</td>
            <td>${hEmiInicial}</td>
            <td>
                <div class="balaoNF" onclick="abrirDANFE('${codOmie}', '${categoria}', '${app}')">
                    <div class="balao1">
                        <label>${nNota}</label>
                        <label><b>${categoria}</b></label>
                    </div>
                    <div class="balao2">PDF</div>
                </div>
            </td>
        </tr>
    `

}


// CARREGAR TOTAIS
async function carregarTotaisCusto() {

    const { dados_orcam, snapshots, total_geral } = controles.orcamento.save || {}

    atualizar('t-orcamento', dinheiro(total_geral))

    const filtro = { op: 'includes', value: dados_orcam?.contrato }

    const somaPagamentos = await contarPorCampo({
        base: 'lista_pagamentos',
        filtros: {
            'departamento': filtro,
            'param.*.codigo_tipo_documento': { op: '!=', value: 'CTE' },
        },
        explode: { path: 'snapshots.categorias' },
        path: 'valor',
        modo: 'soma'
    })

    atualizar('t-pagamentos', dinheiro(somaPagamentos.total))

    const somaFretes = await contarPorCampo({
        base: 'lista_pagamentos',
        filtros: {
            'param.*.codigo_tipo_documento': { op: '=', value: 'CTE' },
            'departamento': filtro
        },
        explode: { path: 'snapshots.departamentos' },
        path: 'valor',
        modo: 'soma'
    })

    atualizar('t-fretes', dinheiro(somaFretes.total))

    const somaCombustiveis = await contarPorCampo({
        base: 'custo_veiculos',
        filtros: {
            'departamento': filtro
        },
        explode: { path: 'snapshots.departamentos' },
        path: 'valor',
        modo: 'soma'
    })

    atualizar('t-abastecimento', dinheiro(somaCombustiveis.total))

    // NOTAS
    const somaNotas = await contarPorCampo({
        base: 'notas',
        filtros: {
            'departamento': filtro
        },
        explode: { path: 'snapshots.departamentos' },
        path: 'valor',
        modo: 'soma'
    })

    atualizar('t-notas', dinheiro(somaNotas.total))

    function atualizar(id, valor) {
        const ele = document.getElementById(id)
        if (ele)
            ele.textContent = valor
    }

}


function graficoRosca({ dados, elemento }) {

    const labels = []
    const valores = []

    for (const [chave, valor] of Object.entries(dados)) {
        if (chave === 'total' || chave === 'todos') continue

        labels.push(chave)
        valores.push(Number(valor) || 0)
    }

    const ctx = typeof elemento === 'string'
        ? document.querySelector(elemento)
        : elemento

    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: valores
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    })
}

function criarGraficoLinhaTempo({
    elemento,
    dados = {},
    rotulo = 'Valores',
    corLinha = '#2563eb',
    corFundo = 'rgba(37, 99, 235, 0.15)',
    mostrarArea = true,
    tensaoLinha = 0.25,
    altura = '320px'
} = {}) {

    const entradasOrdenadas = Object.entries(dados)
        .map(([dataTexto, valor]) => {
            const [dia, mes, ano] = dataTexto.split('/');

            return {
                dataTexto,
                valor: Number(valor) || 0,
                ordem: new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime()
            };
        })
        .filter(item => !Number.isNaN(item.ordem))
        .sort((a, b) => a.ordem - b.ordem)

    const labels = entradasOrdenadas.map(item => item.dataTexto)
    const valores = entradasOrdenadas.map(item => item.valor)

    const ctx = typeof elemento === 'string'
        ? document.querySelector(elemento)
        : elemento

    const graficoAnterior = Chart.getChart(ctx)
    if (graficoAnterior) {
        graficoAnterior.destroy()
    }

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: rotulo,
                data: valores,
                borderColor: corLinha,
                backgroundColor: corFundo,
                fill: mostrarArea,
                tension: tensaoLinha,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Data'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Valor'
                    }
                }
            }
        }
    })
}