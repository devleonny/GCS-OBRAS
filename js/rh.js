let pastaAberta = {}
const regrasDocs = {
    'ASO': 365,
    'NR 35': 730,
    'PTA': 365,
    'NR 06 - EPI': 365,
    'NR 10': 730
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
        'Editar': {},
        'Nome': { chave: 'snapshots.nome' },
        'Cidade': { chave: 'snapshots.cidade' },
        'Clínica': { chave: 'clinica' },
        'Realizado': { chave: 'snapshots.realizado' },
        'Validade': { chave: 'snapshots.validade' },
        'Dif/Dias': {},
        'Arquivo': { chave: 'doc' }
    }

    const btnExtras = `
    <div style="${horizontal}; gap: 2px;">
        <button onclick="filtrarPorTempo('atrasados')">Atrasados</button>
        <button onclick="filtrarPorTempo('proximo')">Venc. Próximo (60d)</button>
        <button onclick="filtrarPorTempo()">Todos</button>
    </div>
    `

    const tabela = await modTab({
        btnExtras,
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

async function filtrarPorTempo(tempo) {

    let filtros = {}

    if (tempo == 'atrasados') {
        filtros = {
            'snapshots.validade': { op: '<=d', value: Date.now() }
        }

    } else if (tempo == 'proximo') {

        const dias60 = 60 * 24 * 60 * 60 * 1000
        filtros = {
            'snapshots.validade': [
                { op: '<=d', value: Date.now() + dias60 },
                { op: '>=d', value: Date.now() }
            ]
        }

    }

    controles.rh.filtros = filtros

    await paginacao()

}

async function criarPastinhas() {

    const cidadesDB = await contarPorCampo({
        base: 'documentos',
        path: 'snapshots.cidade'
    })

    const cidades = Object.keys(cidadesDB)
        .filter(c => c !== 'todos')

    const container = document.querySelector('.esquema-cidades')

    const cidadesDOM = [...container.children]
        .map(el => el.dataset.cidade)

    // remover cidades que não existem mais
    cidadesDOM.forEach(cidade => {
        if (!cidades.includes(cidade)) {
            const el = container.querySelector(`[data-cidade="${cidade}"]`)
            if (el) el.remove()
            delete pastaAberta[cidade]
        }
    })

    // adicionar novas cidades
    cidades.forEach(cidade => {
        if (!cidadesDOM.includes(cidade)) {

            const div = document.createElement('div')
            div.dataset.cidade = cidade
            div.style = `${vertical}; width: 100%;`

            div.innerHTML = `
                <div class="btnPessoas" onclick="funcionariosPorCidade('${cidade}')">
                    <img src="imagens/pasta.png">
                    <span>${cidade}</span>
                </div>
                <div id="${cidade}" style="${vertical}; align-items: start; margin-left: 2rem; width: 90%;"></div>
            `

            container.appendChild(div)
        }
    })

}


async function funcionariosPorCidade(cidade) {

    const local = document.getElementById(cidade)

    if (pastaAberta[cidade]) {
        delete pastaAberta[cidade]
        if (local) local.innerHTML = ''
        return
    }

    pastaAberta[cidade] ??= []

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
                    <div class="btnPessoas" onclick="documentosPorFuncionario('${c}', '${cidade}')">
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

async function documentosPorFuncionario(funcionario, cidade) {

    const local = document.getElementById(funcionario)
    if (pastaAberta[cidade].includes(funcionario)) {
        pastaAberta[cidade] = pastaAberta[cidade]
            .filter(f => f != funcionario)

        if (local) local.innerHTML = ''
        return
    }

    pastaAberta[cidade].push(funcionario)

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

    const { realizado, doc, anexo, snapshots, local, clinica, id } = documento || {}
    const tempoExpiracao = expiraEm(realizado, doc)
    const a = (typeof anexo === 'object' && anexo) ? anexo : {}
    const temAnexo = !!a.link

    const dt = (data) => {
        if (!data) return '--'
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    const tds = `
        <td>
            <img src="imagens/pesquisar2.png" onclick="incluirDocumento('${id}')">
        </td>
        <td>${snapshots.nome || ''}</td>
        <td>${snapshots.cidade || ''}</td>
        <td>
            ${clinica || ''}<br>
            <b>${local || ''}</b>
        </td>
        <td>${snapshots.realizado}</td>
        <td>${snapshots.validade}</td>
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
                    <div
                        style="background-color: ${temAnexo ? 'green' : 'red'};"
                        class="direita"
                        title="${anexo?.nome || ''}"
                        ${temAnexo ? `onclick="abrirArquivo('${anexo.link}')"` : ''}>
                        ${temAnexo ? 'Ver' : 'Ausente'}
                    </div>
                </div>
            </div>
        </td>`

    return `<tr>${tds}</tr>`
}

function expiraEm(dt, doc) {

    const prazo = regrasDocs[doc] || 0

    const dataBase = new Date(dt)
    const hoje = new Date()

    dataBase.setHours(0, 0, 0, 0)
    hoje.setHours(0, 0, 0, 0)

    // data de validade
    const validade = new Date(dataBase)
    validade.setDate(validade.getDate() + prazo)

    const diferencaMs = validade - hoje
    const dias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24))

    // formatação dd/mm/aaaa
    const dd = String(validade.getDate()).padStart(2, '0')
    const mm = String(validade.getMonth() + 1).padStart(2, '0')
    const aa = validade.getFullYear()
    const dataValidade = isNaN(dd)
        ? ''
        : `${dd}/${mm}/${aa}`

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

    return {
        dias: isNaN(dias) ? 0 : dias,
        icone,
        status,
        validade: dataValidade
    }
}

async function incluirDocumento(id) {

    const { local, doc, clinica, funcionario, snapshots, realizado } = await recuperarDado('documentos', id) || {}

    controlesCxOpcoes.funcionario = {
        base: 'dados_clientes',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' },
            'Estado': { chave: 'estado' },
            'Cidade': { chave: 'cidade' }
        }
    }

    const docs = Object.keys(regrasDocs)
        .sort((a, b) => a.localeCompare(b))
        .map(d => `<option ${doc == d ? 'selected' : ''}>${d}</option>`)
        .join('')

    const linhas = [
        {
            texto: 'Anexo',
            elemento: `<input name="anexo" type="file">`
        },
        {
            texto: 'Funcionário',
            elemento: `
            <span 
            ${funcionario ? `id="${funcionario}"` : ''} 
            class="opcoes" 
            name="funcionario" 
            onclick="cxOpcoes('funcionario')">
                ${snapshots?.nome || 'Selecionar'}
            </span>`
        },
        {
            texto: 'Doc',
            elemento: `<select name="doc">${docs}</select>`
        },
        {
            texto: 'realizado',
            elemento: `<input name="realizado" value="${realizado || ''}" type="date">`
        },
        {
            texto: 'Clínica',
            elemento: `<textarea name="clinica">${clinica || ''}</textarea>`
        },
        {
            texto: 'Local da Clínica',
            elemento: `<textarea name="local">${local || ''}</textarea>`
        }

    ]

    const funcao = id
        ? `salvarDocumento('${id}')`
        : `salvarDocumento()`

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    if (id)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirDocumento('${id}')` })

    popup({ botoes, linhas, titulo: 'Incluir Documento' })

}

function confirmarExcluirDocumento(id) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirDocumento('${id}')` }
    ]

    popup({ mensagem: 'Deseja excluir o documento?', botoes, nra: false })

}

async function excluirDocumento(id) {

    await deletarDB('documentos', id)
    deletar(`documentos/${id}`)

}

async function verificarDoc(funcionario, doc) {

    const exsitente = await pesquisarDB({
        base: 'documentos',
        filtros: {
            'funcionario': { op: '=', value: funcionario },
            'doc': { op: '=', value: doc }
        }
    })

    return exsitente

}

async function salvarDocumento(id = unicoID()) {

    overlayAguarde()

    const obVal = (n) => {
        const painel = document.querySelector('.painel-padrao')
        const elemento = painel.querySelector(`[name="${n}"]`)
        return elemento ? elemento : null
    }

    const input = obVal('anexo')
    // Anexos retornados numa lista [{}, {}], 
    // só retorna 1, porque é o limite para este formulário;
    const anexoAPI = await importarAnexos({ input })
    const funcionario = obVal('funcionario')?.id
    const doc = obVal('doc')

    if (!doc?.value)
        return popup({ mensagem: 'Selecione o tipo de exame' })

    if (!funcionario)
        return popup({ mensagem: 'Escolha um funcionário' })

    // Se existir algum documento para este funcionário do mesmo tipo, substituir;
    const existente = await verificarDoc(Number(funcionario), doc.value)
    const resultados = existente?.resultados || []
    if (resultados.length)
        id = existente.resultados[0].id

    if (resultados.length > 1) {
        for (let i = 1; i < resultados.length; i++)
            await excluirDocumento(resultados[i].id)
    }

    const { usuario, anexo } = await recuperarDado('documentos', id) || {}

    const campos = ['doc', 'realizado', 'clinica', 'local']

    const atualizado = {
        id,
        funcionario: Number(funcionario),
        usuario: usuario || acesso.usuario,
        anexo: anexoAPI?.[0] ?? anexo ?? {},
        ...Object.fromEntries(
            campos.map(n => [n, obVal(n)?.value || ''])
        )
    }

    await inserirDados({ [id]: atualizado }, 'documentos')
    enviar(`documentos/${id}`, atualizado)

    removerPopup()
}
