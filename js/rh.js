let pastaAberta = {}
const obrigatorios = [
    'ASO',
    'PTA',
    'NR 06 - EPI',
    'RECEBIMENTO - EPI',
    'NR 10',
    'NR 35'
]


const modeloRH = (valor1, elemento, funcao) => {
    return `
    <div style="${horizontal}; justify-content: space-between; width: 100%; margin-left: 5px;">
        <label>${valor1}:</label>
        ${elemento}
        ${funcao ? `<img onclick="${funcao}" src="imagens/concluido.png" style="display: none; width: 1.5vw;">` : ''}
    </div>`
}

async function telaRH() {

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

    controles.rh.filtros ??= {}

    const hoje = new Date().toLocaleDateString()

    if (tempo == 'atrasados') {
        controles.rh.filtros['snapshots.validade'] = { op: '<=d', value: hoje }

    } else if (tempo == 'proximo') {

        const dias60 = 60 * 24 * 60 * 60 * 1000
        controles.rh.filtros['snapshots.validade'] = [
            { op: '<=d', value: new Date(Date.now() + dias60).toLocaleDateString() },
            { op: '>=d', value: hoje }
        ]

    } else {
        delete controles.rh.filtros['snapshots.validade']
    }

    await paginacao()

}

async function criarPastinhas() {

    const cidadesDB = await contarPorCampo({
        base: 'documentos',
        path: 'snapshots.cidade'
    })

    const cidades = Object.keys(cidadesDB)
        .filter(c => c !== 'todos' && c !== 'EM BRANCO')

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

    overlayAguarde()

    const local = document.getElementById(cidade)

    if (pastaAberta[cidade]) {
        delete pastaAberta[cidade]
        if (local) local.innerHTML = ''
        removerOverlay()
        return
    }

    pastaAberta[cidade] ??= []

    const funcionarios = Object.keys(await contarPorCampo({
        base: 'documentos',
        path: 'snapshots.nome',
        filtros: { 'snapshots.cidade': { op: '=', value: cidade } }
    }))
        .filter(c => c !== 'todos')
        .sort((a, b) => a.localeCompare(b))

    const pastinhas = []

    for (const c of funcionarios) {

        const docs = Object.keys(await contarPorCampo({
            base: 'documentos',
            path: 'doc',
            filtros: {
                'snapshots.nome': {
                    op: '=',
                    value: c
                }
            }
        }))

        const docsFaltantes = obrigatorios
            .filter(o => !docs.includes(o))
            .map(o => `<span class="docs-faltantes">${o}</span>`)
            .join('')

        pastinhas.push(`
            <div style="${vertical}; width: 100%;">
                <div class="btnPessoas" style="flex-direction: column; align-items: start;" onclick="documentosPorFuncionario('${c}', '${cidade}')">
                    <div style="${horizontal}; gap: 3px;">
                        <img src="imagens/pasta.png">
                        <span>${c}</span>
                    </div>
                    <div class="bloco-etiquetas-rh">${docsFaltantes}</div>
                </div>
                <div id="${c}" style="${vertical}; align-items: start; margin-left: 2rem; width: 90%;"></div>
            </div>`)
    }

    if (local)
        local.innerHTML = pastinhas.join('')

    removerOverlay()

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

    const { doc, anexo, snapshots, local, clinica, id } = documento || {}
    const { cidade, nome, realizado, prazo, validade, validadeData } = snapshots || {}

    const tempoExpiracao = expiraEm(validade)
    const a = (typeof anexo === 'object' && anexo) ? anexo : {}
    const temAnexo = !!a.link

    const tds = `
        <td>
            <img src="imagens/pesquisar2.png" onclick="incluirDocumento('${id}')">
        </td>
        <td>${nome || ''}</td>
        <td>${cidade || ''}</td>
        <td>
            ${clinica || ''}<br>
            <b>${local || ''}</b>
        </td>
        <td>${realizado}</td>
        <td>${validade}</td>
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

function expiraEm(dtValidade) {

    if (!dtValidade) 
        return { dias: 0, icone: 'gifs/interrogacao.gif', status: 'Desconhecido', validade: '' };

    let validade;
    
    // Suporta data BR (DD/MM/AAAA) ou ISO do banco (YYYY-MM-DDTHH...)
    if (typeof dtValidade === 'string' && dtValidade.includes('/')) {
        const [dia, mes, ano] = dtValidade.split(' ')[0].split('/');
        validade = new Date(ano, mes - 1, dia);
    } else {
        validade = new Date(dtValidade);
    }

    const hoje = new Date();

    // Zera as horas para comparar só os dias
    validade.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);

    // Calcula a diferença em dias
    const dias = Math.round((validade - hoje) / (1000 * 60 * 60 * 24));

    // Formata retorno (DD/MM/AAAA)
    const dd = String(validade.getDate()).padStart(2, '0');
    const mm = String(validade.getMonth() + 1).padStart(2, '0');
    const aa = validade.getFullYear();
    const dataValidade = isNaN(validade.getTime()) ? '' : `${dd}/${mm}/${aa}`;

    // Regras de Status
    let icone = 'gifs/interrogacao.gif';
    let status = 'Desconhecido';

    if (dias < 0) {
        icone = 'imagens/offline.png';
        status = 'Vencido';
    } else if (dias <= 30) {
        icone = 'imagens/pendente.png';
        status = 'Próximo';
    } else {
        icone = 'imagens/online.png';
        status = 'Ativo';
    }

    return { dias: isNaN(dias) ? 0 : dias, icone, status, validade: dataValidade };
}

async function incluirDocumento(id) {

    const { local, doc, clinica, funcionario, snapshots, realizado } = await recuperarDado('documentos', id) || {}

    controlesCxOpcoes.funcionario = {
        base: 'dados_clientes_ac',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' },
            'Estado': { chave: 'estado' },
            'Cidade': { chave: 'cidade' }
        }
    }

    const docs = [
        'ASO',
        'PTA',
        'NR 01',
        'NR 05 - CIPA',
        'NR 06 - EPI',
        'RECEBIMENTO - EPI',
        'NR 10',
        'NR 35'
    ]
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
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirDocumento('${id}')` }
    ]

    popup({ mensagem: 'Deseja excluir o documento?', botoes, removerAnteriores: true })

}

async function excluirDocumento(id) {

    await deletar(`documentos/${id}`)

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

async function salvarDocumento(id = crypto.randomUUID()) {

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

    await enviar(`documentos/${id}`, atualizado)

    removerPopup()
}
