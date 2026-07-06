let chartMapaCalor = null

async function daily() {

    overlayAguarde()

    const { criadores } = await recuperarDado('vw_opcoes_filtros', 1) || {}

    const dropdownUsuarios = montarDropdownCheckbox({
        titulo: 'Usuários',
        pag: 'daily',
        path: 'usuario',
        opcoes: criadores || []
    })

    const tabela = await modTab({
        btnExtras: dropdownUsuarios,
        base: 'logs_rotas',
        pag: 'daily',
        body: 'bodyDaily',
        funcaoAdicional: ['graficoMapaCalor'],
        criarLinha: 'linDaily',
        filtros: {
            'rota': { op: '!=', value: '/acesso' }
        },
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Data': { chave: 'data', tipoPesquisa: 'data' },
            'Tabela': { chave: 'body.caminho' },
            'Detalhes': {}
        }
    })

    tela.innerHTML = `
        <div class="daily">
            ${tabela}
            <div class="mapa-calor">
                <h2>Dias x Horários de maior uso do GCS</h2>
            </div>
        </div>
    `
    await paginacao()

    removerOverlay()

}

function resumirValor(body) {
    const { valor, caminho } = body || {}

    if (!valor)
        return ''

    if (valor === 'string')
        return valor

    if (caminho.includes('/tags'))
        return 'Alterou a tag'

    if (caminho.includes('postit/'))
        return ''

    if (caminho.includes('historico/') && valor?.justificativa == 'ok')
        return 'Aprovou um pagamento'

    const candidatos = [
        valor,
        valor.para,
        valor.titulo,
        valor.nome,
        valor.descricao,
        valor.comentario,
        valor.pedido,
        valor.contrato,
        valor.chamado,
        valor.codigo
    ].filter(v => typeof v === 'string' || typeof v === 'number')

    const principal = candidatos.find(v => String(v).trim())
    if (principal)
        return String(principal).trim()

    return ''
}

function traducaoLog({ body, rota }) {

    const { caminho = '' } = body || {}
    const partes = caminho.split('/')
    const tabela = inicialMaiuscula(partes[0])

    let traducao = ''

    if (rota == '/salvar') {

        traducao = `Editou • ${tabela}`

    } else if (rota == '/deletar') {

        traducao = `Apagou • ${tabela}`

    } else if (rota == '/excel') {

        traducao = `Baixou um relatório em Excel`

    }

    return traducao || rota

}

function linDaily(dados) {

    const { id, usuario, data, body } = dados || {}

    const traducao = traducaoLog(dados)
    const valorResumido = resumirValor(body)
    const tabela = inicialMaiuscula(body?.caminho?.split('/')?.[0] || '')

    const tr = `
        <tr>
            <td>
                <div style="${vertical};gap: 1rem;">
                    <span>${usuario}</span>
                    <span style="color: #ff2022;">${id}</span>
                </div>
            </td>
            <td>${data}</td>
            <td>${tabela}</td>
            <td>    
                <div style="${vertical}; gap: 1rem;">
                    <span><b>${traducao}</b></span>
                    <div style="white-space: pre-wrap;">${valorResumido}</div>
                </div>
            </td>
        </tr>
    `

    return tr

}

function obterMesAnoFiltroDaily() {
    const filtrosData = controles?.daily?.filtros?.data || []
    const hoje = new Date()

    let dataInicial = null
    let dataFinal = null

    for (const item of filtrosData) {
        if (!item?.value) continue

        if (item.op === '>=d') dataInicial = item.value
        if (item.op === '<=d') dataFinal = item.value
    }

    const dataBase = dataInicial || dataFinal

    if (!dataBase) {
        return {
            mes: hoje.getMonth() + 1,
            ano: hoje.getFullYear(),
            dataInicial: null,
            dataFinal: null
        }
    }

    const [ano, mes] = String(dataBase).split('-').map(Number)

    return {
        mes,
        ano,
        dataInicial,
        dataFinal
    }
}

async function graficoMapaCalor() {
    const filtros = controles?.daily?.filtros || {}
    const { mes, ano, dataInicial, dataFinal } = obterMesAnoFiltroDaily()

    const contagem = await contarPorCampo({
        base: 'logs_rotas',
        filtros,
        path: 'data'
    })

    const mapaCalor = document.querySelector('.mapa-calor')
    if (!mapaCalor) return

    const titulo = mapaCalor.querySelector('h2')
    if (titulo) {
        titulo.textContent = dataInicial || dataFinal
            ? `Dias x Horários de maior uso do GCS (${dataInicial || '...'} até ${dataFinal || '...'})`
            : 'Dias x Horários de maior uso do GCS'
    }

    if (!document.getElementById('chart-mapa-calor')) {
        mapaCalor.insertAdjacentHTML('beforeend', `<div id="chart-mapa-calor"></div>`)
    }

    const series = montarSeriesMapaCalor(contagem, mes, ano)
    const ranges = criarFaixasCor(series)

    if (chartMapaCalor) chartMapaCalor.destroy()

    chartMapaCalor = new ApexCharts(
        document.querySelector('#chart-mapa-calor'),
        {
            chart: {
                type: 'heatmap',
                height: 220 + (series.length * 12),
                toolbar: { show: false }
            },
            series,
            dataLabels: {
                enabled: false
            },
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0,
                    colorScale: { ranges }
                }
            },
            stroke: {
                width: 1,
                colors: ['#ddd']
            },
            xaxis: {
                type: 'category',
                categories: Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, '0')}h`),
                labels: { rotate: 0 }
            },
            yaxis: {
                reversed: true
            },
            tooltip: {
                y: {
                    formatter: value => value || 0
                }
            },
            legend: {
                show: false
            }
        }
    )

    chartMapaCalor.render()
}

function criarFaixasCor(series) {
    const valores = series
        .flatMap(linha => linha.data.map(p => Number(p.y || 0)))
        .filter(v => v > 0)

    if (!valores.length) {
        return [
            {
                from: 0,
                to: 0,
                color: '#ffffff',
                name: 'Sem dados'
            }
        ]
    }

    const min = Math.min(...valores)
    const max = Math.max(...valores)

    if (min === max) {
        return [
            {
                from: 0,
                to: 0,
                color: '#ffffff',
                name: '0'
            },
            {
                from: min,
                to: max,
                color: '#ff0000',
                name: String(max)
            }
        ]
    }

    const faixas = 6
    const passo = (max - min) / faixas

    const ranges = [
        {
            from: 0,
            to: 0,
            color: '#ffffff',
            name: '0'
        }
    ]

    for (let i = 0; i < faixas; i++) {
        const from = i === 0 ? min : (min + passo * i)
        const to = i === faixas - 1 ? max : (min + passo * (i + 1))

        const intensidade = (i + 1) / faixas
        const verdeAzul = Math.round(255 * (1 - intensidade))

        ranges.push({
            from,
            to,
            color: `rgb(255, ${verdeAzul}, ${verdeAzul})`,
            name: `${Math.round(from)} - ${Math.round(to)}`
        })
    }

    return ranges
}

function montarSeriesMapaCalor(dados, mes, ano) {
    const diasNoMes = new Date(ano, mes, 0).getDate()
    const horaInicio = 5
    const horaFim = 23
    const mapa = {}

    for (const [dataHora, qtde] of Object.entries(dados || {})) {
        if (!dataHora)
            continue

        const [data = '', hora = ''] = String(dataHora).split(', ')
        const [dia, mesRegistro, anoRegistro] = data.split('/').map(Number)
        const horaNumero = Number((hora.split(':')[0] || 0))

        if (
            !dia ||
            !mesRegistro ||
            !anoRegistro ||
            Number.isNaN(horaNumero) ||
            mesRegistro !== mes ||
            anoRegistro !== ano ||
            horaNumero < horaInicio ||
            horaNumero > horaFim
        ) continue

        mapa[dia] ??= {}
        mapa[dia][horaNumero] = (mapa[dia][horaNumero] || 0) + Number(qtde || 0)
    }

    return Array.from({ length: diasNoMes }, (_, i) => {
        const dia = i + 1

        return {
            name: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`,
            data: Array.from({ length: horaFim - horaInicio + 1 }, (_, j) => {
                const hora = horaInicio + j
                return {
                    x: `${String(hora).padStart(2, '0')}h`,
                    y: mapa?.[dia]?.[hora] || 0
                }
            })
        }
    })
}

function criarFaixasCor(series) {
    const valores = series.flatMap(linha => linha.data.map(p => p.y))
    const max = Math.max(...valores, 0)

    if (max <= 0) {
        return [{
            from: 0,
            to: 0,
            color: '#ffffff',
            name: 'Sem dados'
        }]
    }

    const faixas = 6
    const passo = Math.ceil(max / faixas)

    return Array.from({ length: faixas }, (_, i) => {
        const from = i * passo
        const to = i === faixas - 1 ? max : ((i + 1) * passo) - 1
        const intensidade = (i + 1) / faixas
        const verdeAzul = Math.round(255 * (1 - intensidade))

        return {
            from,
            to,
            color: `rgb(255, ${verdeAzul}, ${verdeAzul})`,
            name: `${from} - ${to}`
        }
    })
}