async function painelCustos(contrato) {

    try {

        overlayAguarde()

        const {
            total_pagamentos,
            total_geral,
            cidade,
            cliente
        } = await recuperarDado('mvw_custos_cc', contrato) || {}

        // Velocímetro
        const porcentagem = Number(((total_pagamentos / total_geral) * 100).toFixed(1))
        const velocimetro = total_geral
            ? `<div class="checklist-indicador" style="width: 300px;">${criarVelocimetroHTML({ rotulo: 'Custos', limite: 40, valor: porcentagem })}</div>`
            : ''

        const dados =
            (!cliente && !cidade)
                ? ''
                : Object.entries({
                    cliente,
                    cidade
                })
                    .map(([campo, valor]) => `<span style="white-space: pre-wrap;"><b>${inicialMaiuscula(campo)}</b>\n${valor || ''}</span>`)
                    .join('')


        const esquema = [
            {
                titulo: 'Início',
                funcao: `inicioCustos('${contrato}')`
            },
            {
                titulo: 'Total do Orçamento',
                valor: total_geral,
                indicador: true
            },
            {
                titulo: 'Pagamentos Solicitados',
                valor: total_pagamentos,
                funcao: `tabPagamentosCusto('${contrato}')`,
                indicador: true
            },
            {
                titulo: 'Abastecimento',
                id: 't-abastecimento',
                valor: 0,
                indicador: true
            },
            {
                titulo: 'Fretes',
                valor: 0,
                indicador: true
            },
            {
                titulo: 'Notas',
                valor: 0,
                indicador: true
            }
        ]

        const baloes = esquema
            .filter(e => e.indicador && e.valor)
            .map(({ valor, titulo }) => `
                <div class="checklist-indicador" style="width: 300px;">
                    <label>${dinheiro(valor)}</label>
                    <span>${titulo}</span>
                </div>`)
            .join('')

        const toolbar = esquema
            .filter(e => e.funcao)
            .map(({ titulo, funcao }) => {
                return `<span onclick="toggleAbas(this); ${funcao || ''}">${titulo}</span>`
            })
            .join('')

        const elemento = `
            <div class="painel-geral-checklist">

                <div class="toolbar-checklist">${toolbar}</div>

                <div class="painel-atras-checklist">

                    ${tituloChecklist('Resumo de Custos')}

                    <div style="display: flex; gap: 5px;">  

                        <div class="checklist-cabecalho">
                            <span class="tag-pendencias">${contrato}</span>
                            ${dados}
                        </div>

                        ${velocimetro}

                        <div style="display: flex; flex-wrap: wrap; gap: 5px;">${baloes}</div>

                    </div>

                    <div style="border-top: solid 1px #ffffff6e; width: 100%; margin: 0.5rem;"></div>

                    <div class="painel-custos-tabelas"></div>

                </div>
                
            </div>
        `

        popup({ elemento })

        removerOverlay()

        await inicioCustos(contrato)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir custos: Fale com o suporte.' })
    }

}

function toggleAbas(span) {

    [...document.querySelectorAll('.toolbar-checklist span')].map(span => span.style.opacity = 0.5)

    if (span)
        span.style.opacity = 1

}

async function inicioCustos(contrato) {

    const painel = document.querySelector('.painel-custos-tabelas')

    painel.innerHTML = `

        <div style="${vertical}; gap: 5px;">

            ${tituloChecklist('Valores por Categoria e Gráficos')}

            <div class="custos-inicial">

                <div class="painel-custos-lateral">
                    <img src="gifs/loading.gif" style="width: 5rem;">
                </div>

                <div style="${vertical}">
                    <div class="toolbar-checklist">
                        <span onclick="toggleAbas(this); mostrarGrafico('pizza')">Gráfico de Pizza</span>
                        <span onclick="toggleAbas(this); mostrarGrafico('tempo')">Linha do Tempo</span>
                    </div>

                    <div class="grafico-box">
                        <canvas id="grafico-categorias"></canvas>
                    </div>

                    <div class="grafico-box">
                        <canvas id="grafico-linha-tempo"></canvas>
                    </div>
                </div>

            </div>

        </div>
    `

    await somaPorCategoria(contrato)

}

function mostrarGrafico(tipo) {
    const boxes = document.querySelectorAll('.grafico-box')

    boxes.forEach(b => b.style.display = 'none')

    boxes[tipo == 'pizza' ? 0 : 1].style.display = 'flex'
}

async function somaPorCategoria(contrato) {

    const { categorias, valores_por_data } = await recuperarDado('mvw_custos_cc', contrato) || {}

    const blocoCategoria = (nome, valor) => {

        return `
            <div class="checklist-indicador">
                <label>${dinheiro(valor)}</label>
                <span>${nome}</span>
            </div>
        `
    }

    const painelLateral = document.querySelector('.painel-custos-lateral')

    const blocos = (categorias || [])
        .sort((a, b) => b.total - a.total)
        .map(({ categoria, total }) => blocoCategoria(categoria, total))
        .join('')

    if (painelLateral)
        painelLateral.innerHTML = blocos

    graficoRosca({
        dados: categorias,
        elemento: '#grafico-categorias'
    })

    criarGraficoLinhaTempo({
        elemento: '#grafico-linha-tempo',
        dados: valores_por_data,
        rotulo: 'Custos por data'
    })

    mostrarGrafico('pizza')

}

async function tabPagamentosCusto(contrato) {

    try {

        overlayAguarde()

        const pag = 'custosPagamentos'
        const tabela = await modTab({
            pag,
            body: 'bodyCustosPagamentos',
            criarLinha: 'criarLinhaCustoPagamento',
            base: 'lista_pagamentos',
            explode: { path: 'snapshots.categorias' },
            filtros: {
                'snapshots.categorias.*.departamento': { op: '=', value: contrato },
                'param.*.codigo_tipo_documento': { op: '!=', value: 'CTE' },
            },
            colunas: {
                'Data': { chave: 'param.*.data_previsao', tipoPesquisa: 'data' },
                'Valor': { chave: 'descricao' },
                'Categoria': { chave: 'categoria' },
                'Status': { chave: 'status' },
                'Solicitante': { chave: 'criado' },
                'Recebedor': { chave: 'snapshots.cliente' },
                'Observação': { chave: 'param.*.observacao' },
                'Ações': {}
            }
        })

        const painel = document.querySelector('.painel-custos-tabelas')

        painel.innerHTML = tabela

        await paginacao(pag)

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir detalhamento: Fale com o suporte.' })
    }

}

async function criarLinhaCustoPagamento(pagamento) {

    const { criado, param, status, snapshots, valor, categoria } = pagamento || {}
    const { data_previsao, observacao } = param?.[0] || {}

    const cliente = snapshots?.cliente || ''

    const imagem = iconePagamento(status)

    const tds = `
        <td>${data_previsao || ''}</td>
        <td style="white-space: nowrap;">${dinheiro(valor)}</td>
        <td>
            <span class="etiquetas">${categoria}</span>
        </td>
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

function graficoRosca({ dados = [], elemento }) {
    const canvas = typeof elemento === 'string'
        ? document.querySelector(elemento)
        : elemento

    if (!canvas) return

    Chart.getChart(canvas)?.destroy()

    const labels = (dados || []).map(item => String(item.categoria ?? ''))
    const valores = (dados || []).map(item => Number(item.total) || 0)

    const contexto = canvas.getContext('2d')
    const fonte = Chart.defaults.font.family

    contexto.font = `12px ${fonte}`

    const maiorTexto = Math.max(
        0,
        ...labels.map(texto => contexto.measureText(texto).width)
    )

    const larguraLegenda = Math.ceil(maiorTexto + 70)
    const largura = Math.max(700, 360 + larguraLegenda, larguraLegenda * 2)
    const altura = Math.max(360, labels.length * 26 + 40)

    Object.assign(canvas.parentElement.style, {
        position: 'relative',
        width: `${largura}px`,
        minWidth: `${largura}px`,
        maxWidth: 'none',
        height: `${altura}px`,
        maxHeight: 'none',
        flexShrink: '0'
    })

    return new Chart(canvas, {
        type: 'doughnut',
        plugins: [porcentagensRosca],
        data: {
            labels,
            datasets: [{
                data: valores
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 14,
                        boxHeight: 14,
                        padding: 14,
                        font: {
                            size: 12,
                            family: fonte
                        }
                    }
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
} = {}) {

    const entradasOrdenadas = (dados || [])
        .map(({ data_vencimento, total }) => {
            const [dia, mes, ano] = data_vencimento.split('/')

            return {
                dataTexto: data_vencimento,
                valor: Number(total) || 0,
                ordem: new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime()
            }
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

const porcentagensRosca = {
    id: 'porcentagensRosca',

    afterDatasetsDraw(chart) {
        const { ctx } = chart
        const dataset = chart.data.datasets[0]
        const meta = chart.getDatasetMeta(0)

        if (!dataset || !chart.isDatasetVisible(0)) return

        const total = dataset.data.reduce((soma, valor, indice) => {
            return chart.getDataVisibility(indice)
                ? soma + Math.abs(Number(valor) || 0)
                : soma
        }, 0)

        if (!total) return

        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `bold 16px ${Chart.defaults.font.family}`
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'

        meta.data.forEach((arco, indice) => {
            if (!chart.getDataVisibility(indice)) return

            const valor = Math.abs(Number(dataset.data[indice]) || 0)
            const porcentagem = valor / total * 100

            if (porcentagem < 4) return

            const texto = `${porcentagem.toLocaleString('pt-BR', {
                maximumFractionDigits: 1
            })}%`

            const { x, y } = arco.tooltipPosition()

            ctx.strokeText(texto, x, y)
            ctx.fillText(texto, x, y)
        })

        ctx.restore()
    }
}