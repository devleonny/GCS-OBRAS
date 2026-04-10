async function daily() {

    const tabela = await modTab({
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
            'Detalhes': {}
        }
    })

    return tabela

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

    const tr = `
        <tr>
            <td>
                <div style="${vertical};gap: 1rem;">
                    <span>${usuario}</span>
                    <span style="color: #ff2022;">${id}</span>
                </div>
            </td>
            <td>${data}</td>
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

async function graficoMapaCalor() {

    const filtros = controles?.daily?.filtros || {}

    const contagem = await contarPorCampo({
        base: 'logs_rotas',
        filtros,
        path: 'data'
    })


    const mapaCalor = document.querySelector('.mapa-calor')
    const mesAtual = new Date().getMonth() + 1

    if (mapaCalor)
        mapaCalor.innerHTML = gerarMapaCalorMes(contagem, mesAtual, 2026)

}

function gerarMapaCalorMes(dados, mes, ano) {
    const diasNoMes = new Date(ano, mes, 0).getDate()
    const mapa = {}
    const horaInicio = 5
    const horaFim = 23
    let max = 0

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

        if (mapa[dia][horaNumero] > max)
            max = mapa[dia][horaNumero]
    }

    function cor(valor) {
        if (!valor || !max)
            return 'rgb(255,255,255)'

        const intensidade = valor / max
        const verdeAzul = Math.round(255 * (1 - intensidade))

        return `rgb(255, ${verdeAzul}, ${verdeAzul})`
    }

    const horas = Array.from({ length: horaFim - horaInicio + 1 }, (_, i) => {
        const hora = horaInicio + i
        return `<div class="heatmap-hora">${String(hora).padStart(2, '0')}h</div>`
    }).join('')

    const linhas = Array.from({ length: diasNoMes }, (_, i) => {
        const dia = i + 1

        const colunas = Array.from({ length: horaFim - horaInicio + 1 }, (_, j) => {
            const hora = horaInicio + j
            const valor = mapa?.[dia]?.[hora] || 0

            return `
                <div 
                    class="heatmap-cell"
                    title="${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano} ${String(hora).padStart(2, '0')}h = ${valor}"
                    style="background:${cor(valor)};">
                </div>
            `
        }).join('')

        return `
            <div class="heatmap-row">
                <div class="heatmap-dia">
                    ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}
                </div>
                ${colunas}
            </div>
        `
    }).join('')

    return `
        <div class="heatmap-container">
            <div class="heatmap-header">
                <div class="heatmap-dia"></div>
                ${horas}
            </div>
            ${linhas}
        </div>
    `
}