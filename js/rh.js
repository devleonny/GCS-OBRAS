const pastaAberta = {
    cidade: null,
    funcionario: null
}

const modeloRH = (valor1, elemento, funcao) => {
    return `
    <div style="${horizontal}; justify-content: space-between; width: 100%; margin-left: 5px;">
        <label>${valor1}:</label>
        ${elemento}
        ${funcao ? `<img onclick="${funcao}" src="imagens/concluido.png" style="display: none; width: 1.5vw;">` : ''}
    </div>`
}

async function telaRH() {

    mostrarMenus(false)

    criarMenus('rh')

    const colunas = {
        'Nome': { chave: 'snapshots.nome' },
        'Cidade': { chave: 'snapshots.cidade' },
        'Clínica': { chave: 'clinica' },
        'Validade': { chave: 'snapshots.validade' },
        'Expiração': {},
        'Arquivo': { chave: 'doc' }
    }

    const tabela = await modTab({
        pag: 'rh',
        body: 'bodyDocumentos',
        funcaoAdicional: ['criarPastinhas'],
        base: 'documentos',
        colunas,
        criarLinha: 'criarLinhaRH'
    })

    const acumulado = `
        <div class="tela-rh">
            <div class="esquema-cidades"></div>
            <div class="tabela-documentos">${tabela}</div>
        </div>
    `

    tela.innerHTML = acumulado

    await paginacao()

}

async function criarPastinhas() {

    const cidades = await contarPorCampo({ base: 'documentos', path: 'snapshots.cidade' })

    const pastasCidade = Object.keys(cidades)
        .filter(c => c != 'todos')
        .map(c => {

            return `
                <div style="${vertical}; width: 100%;">
                    <div class="btnPessoas" onclick="funcionariosPorCidade('${c}')">
                        <img src="imagens/pasta.png">
                        <span>${c}</span>
                    </div>
                    <div id="${c}" style="${vertical}; align-items: start; margin-left: 2rem; width: 90%;"></div>
                </div>
            `
        })
        .join('')

    const esqCidades = document.querySelector('.esquema-cidades')
    esqCidades.innerHTML = pastasCidade

    if (pastaAberta.cidade) {
        funcionariosPorCidade(pastaAberta.cidade)

        if (pastaAberta.funcionario)
            documentosPorFuncionario(pastaAberta.funcionario)

        return
    }

}

async function funcionariosPorCidade(cidade) {

    const local = document.getElementById(cidade)

    // se clicou na mesma cidade → fecha
    if (pastaAberta.cidade === cidade) {
        pastaAberta.cidade = null
        pastaAberta.funcionario = null
        if (local) local.innerHTML = ''
        return
    }

    // abre nova cidade
    pastaAberta.cidade = cidade
    pastaAberta.funcionario = null

    const funcionarios = await contarPorCampo({
        base: 'documentos',
        path: 'snapshots.nome',
        filtros: { 'snapshots.cidade': { op: '=', value: cidade } }
    })

    const pastinhas = Object.keys(funcionarios)
        .filter(c => c != 'todos')
        .map(c => {

            return `
                <div style="${vertical}; width: 100%;">
                    <div class="btnPessoas" onclick="documentosPorFuncionario('${c}')">
                        <img src="imagens/pasta.png">
                        <span>${c}</span>
                    </div>
                    <div id="${c}" style="${vertical}; align-items: start; margin-left: 2rem; width: 90%;"></div>
                </div>`
        })
        .join('')


    if (local)
        local.innerHTML = pastinhas

}

async function documentosPorFuncionario(funcionario) {

    const local = document.getElementById(funcionario)
    if (pastaAberta.funcionario === funcionario) {
        pastaAberta.funcionario = null
        if (local) local.innerHTML = ''
        return
    }

    pastaAberta.funcionario = funcionario
    const funcionarios = await contarPorCampo({
        base: 'documentos',
        path: 'doc',
        filtros: { 'snapshots.nome': { op: '=', value: funcionario } }
    })

    const pastinhas = Object.keys(funcionarios)
        .filter(c => c != 'todos')
        .map(c => {

            return `
                <div style="${vertical}; width: 100%;">
                    <div class="btnPessoas" onclick="abrirDoc('${funcionario}', '${c}')">
                        <img src="imagens/pasta.png">
                        <span>${c}</span>
                    </div>
                </div>`
        })
        .join('')


    if (local)
        local.innerHTML = pastinhas

}

async function abrirDoc(funcionario, doc) {

    const docs = await pesquisarDB({
        base: 'documentos',
        path: 'doc',
        filtros: {
            'snapshots.nome': { op: '=', value: funcionario },
            'doc': { op: '=', value: doc },
        }
    })

    for (const doc of (docs.resultados || [])) {
        const link = doc?.anexo?.link
        if (link)
            abrirArquivo(doc.anexo.link)
    }

}

function criarLinhaRH(documento) {

    const { validade, doc, anexo, snapshots, local, clinica } = documento || {}
    const tempoExpiracao = expiraEm(validade)

    const dt = (data) => {
        if (!data) return '--'
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    const tds = `
        <td>${snapshots.nome || ''}</td>
        <td>${snapshots.cidade || ''}</td>
        <td>
            ${clinica || '--'}<br>
            <b>${local || ''}</b>
        </td>
        <td>${dt(validade)}</td>
        <td>
            <div style="${horizontal}; justify-content: left; gap: 5px;">
                <img src="${tempoExpiracao.icone}" style="width: 1.2rem;">
                <label>${tempoExpiracao.dias}</label>
            </div>
        </td>
        <td>
            <div style="${horizontal}; justify-content: start; gap: 5px;">
                <div class="capsula">
                    <div class="esquerda">
                        ${doc || '--'}
                    </div>
                    <div class="direita" title="${anexo.nome}" onclick="abrirArquivo('${anexo.link}')">
                        Ver
                    </div>
                </div>
            </div>
        </td>`

    return `<tr>${tds}</tr>`
}

function expiraEm(dataString) {

    let dias = '--'

    if (dataString !== '--') {

        const dataInformada = new Date(dataString)
        const hoje = new Date()

        dataInformada.setHours(0, 0, 0, 0)
        hoje.setHours(0, 0, 0, 0)

        const diferencaMs = dataInformada - hoje
        dias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24))

    } else {
        dias = dataString
    }

    let icone = 'gifs/interrogacao.gif'
    let status = 'Desconhecido'
    if (dias < 30) {
        icone = 'imagens/offline.png'
        status = 'Vencido'
    } else if (dias < 60) {
        icone = 'imagens/pendente.png'
        status = 'Próximo'
    } else if (dias >= 60) {
        icone = 'imagens/online.png'
        status = 'Ativo'
    }

    return { dias, icone, status }
}
