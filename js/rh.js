let pastasRH = []
let obrigatoriosRH = []
const pastasAbertasRH = new Set()
let consultaPastasRH = 0

const modeloRH = (valor1, elemento, funcao) => {
    return `
    <div style="${horizontal}; justify-content: space-between; width: 100%; margin-left: 5px;">
        <label>${valor1}:</label>
        ${elemento}
        ${funcao ? `<img onclick="${funcao}" src="imagens/concluido.png" style="display: none; width: 1.5vw;">` : ''}
    </div>`
}

async function telaRH() {

    try {

        const colunas = {
            'Editar': {},
            'Arquivo': { chave: 'doc' },
            'Foto': {},
            'Nome': { chave: 'nome_cargo', op: 'includes' },
            'Cidade': { chave: 'cidade' },
            'Clínica': { chave: 'clinica' },
            'Realizado': { chave: 'realizado' },
            'Validade': { chave: 'validade' },
            'Dif/Dias': {}
        }

        const btnExtras = `
            <div style="${horizontal}; gap: 2px;">
                <button type="button" class="rh-filtro-tempo rh-adicionar" onclick="incluirDocumento()">Documento</button>
                <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo('atrasados')">Atrasados</button>
                <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo('proximo')">Venc. Próximo (60d)</button>
                <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo()">Todos</button>
            </div>
            `
        const pag = 'rh'
        const tabela = await modTab({
            btnExtras,
            pag,
            body: 'bodyDocumentos',
            funcaoAdicional: ['criarPastinhas'],
            base: 'vw_documentos',
            colunas,
            criarLinha: 'criarLinhaRH'
        })

        const acumulado = `
            <div class="tela-rh">
                <div class="esquema-cidades"></div>
                <div class="pagina-conteudo">
                <div class="cabecalho-pagina"><h2>Documentos Salvos</h2></div>
                ${tabela}
            </div>
            </div>
        `

        tela.innerHTML = acumulado

        await paginacao(pag)

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir documentos RH: Fale com o suporte.' })
    }

}

async function atalhoDocumentos(idCliente = null) {

    const colunas = {
        'Editar': {},
        'Arquivo': { chave: 'doc' },
        'Foto': {},
        'Nome': { chave: 'nome_cargo', op: 'includes' },
        'Cidade': { chave: 'cidade' },
        'Clínica': { chave: 'clinica' },
        'Realizado': { chave: 'realizado' },
        'Validade': { chave: 'validade' },
        'Dif/Dias': {}
    }

    const btnExtras = `
    <div style="${horizontal}; gap: 2px;">
        <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo('atrasados')">Atrasados</button>
        <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo('proximo')">Venc. Próximo (60d)</button>
        <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo()">Todos</button>
    </div>
    `

    const pag = 'rh'

    const filtros = idCliente
        ? {
            funcionario: { op: '=', value: idCliente }
        }
        : {}

    const tabela = await modTab({
        btnExtras,
        pag,
        body: 'bodyDocumentos',
        filtros,
        funcaoAdicional: ['criarPastinhas'],
        base: 'vw_documentos',
        colunas,
        criarLinha: 'criarLinhaRH'
    })

    const elemento = `
        <div style="padding: 0.5rem;">
            ${tabela}
        </div>
    `

    popup({ elemento, titulo: 'Documentos' })

    await paginacao(pag)

}

async function filtrarPorTempo(tempo) {

    controles.rh.filtros ??= {}

    const hoje = dataServidor().toLocaleDateString()

    if (tempo == 'atrasados') {
        controles.rh.filtros['validade'] = { op: '<=d', value: hoje }

    } else if (tempo == 'proximo') {

        const dias60 = 60 * 24 * 60 * 60 * 1000
        controles.rh.filtros['validade'] = [
            { op: '<=d', value: new Date(agoraServidor() + dias60).toLocaleDateString() },
            { op: '>=d', value: hoje }
        ]

    } else {
        delete controles.rh.filtros['validade']
    }

    await paginacao()

}

async function criarPastinhas() {
    const container = document.querySelector('.esquema-cidades')
    if (!container) return
    const consulta = ++consultaPastasRH
    try {
        const estados = []
        let pagina = 1
        let paginas = 1
        do {
            const resposta = await pesquisarDB({
                base: 'vw_rh_pastas', pagina,
                ordenar: { path: 'id', direcao: 'ASC' }
            })
            estados.push(...(resposta.resultados || []))
            paginas = Number(resposta.paginas) || 1
            pagina++
        } while (pagina <= paginas)
        const regras = []
        pagina = 1
        paginas = 1
        do {
            const resposta = await pesquisarDB({ base: 'rh_documentos_regras', pagina })
            regras.push(...(resposta.resultados || []))
            paginas = Number(resposta.paginas) || 1
            pagina++
        } while (pagina <= paginas)
        if (consulta !== consultaPastasRH || !container.isConnected) return
        const padrao = ['ASO', 'PTA', 'NR 06 - EPI', 'RECEBIMENTO - EPI', 'NR 10', 'NR 35']
        obrigatoriosRH = regras.filter(regra => Object.hasOwn(regra, 'obrigatorio')
            ? ['true', 't', '1', 'sim'].includes(String(regra.obrigatorio).toLowerCase())
            : padrao.includes(regra.id)).map(regra => regra.id).sort((a, b) => a.localeCompare(b))
        pastasRH = estados
        renderizarPastasRH(container)
    } catch (erro) {
        if (consulta !== consultaPastasRH || !container.isConnected) return
        console.error('Erro ao carregar pastas do RH:', erro)
        container.innerHTML = '<button type="button" onclick="criarPastinhas()">Falha ao carregar pastas. Tentar novamente</button>'
    }
}

function chavePastaRH(estado, funcionario) {
    return JSON.stringify(funcionario === undefined ? [estado.id] : [estado.id, funcionario.id])
}

function renderizarPastasRH(container = document.querySelector('.esquema-cidades')) {
    if (!container) return
    const quantidade = valor => new Intl.NumberFormat('pt-BR').format(Number(valor) || 0)
    const totalFuncionarios = pastasRH.reduce((soma, estado) => soma + Number(estado.quantidade_funcionarios || 0), 0)
    const totalDocumentos = pastasRH.reduce((soma, estado) => soma + Number(estado.quantidade_documentos || 0), 0)
    const cabecalho = `<div class="rh-pastas-resumo">
        <h3>Documentos por estado</h3>
        <div class="rh-pastas-totais"><span><strong>${quantidade(totalFuncionarios)}</strong> funcionários</span><span><strong>${quantidade(totalDocumentos)}</strong> documentos</span></div>
        <div class="rh-obrigatorios"><strong>Documentos obrigatórios</strong>
            <div class="rh-lista-tags">${obrigatoriosRH.map(doc => '<span class="rh-tag-obrigatorio">' + escaparAtributo(doc) + '</span>').join('') || '<span>Nenhum definido.</span>'}</div>
            <small>As pendências abaixo indicam documentos ainda não registrados.</small>
        </div>
    </div>`
    const pastas = pastasRH.map((estado, indiceEstado) => {
        const aberta = pastasAbertasRH.has(chavePastaRH(estado))
        const funcionarios = (estado.funcionarios || []).map((funcionario, indiceFuncionario) => {
            const expandido = pastasAbertasRH.has(chavePastaRH(estado, funcionario))
            const faltantes = funcionario.documentos_faltantes || []
            const documentos = (funcionario.documentos || []).map((doc, indiceDoc) => `
                <button type="button" class="rh-documento-item"
                    data-estado="${indiceEstado}" data-funcionario="${indiceFuncionario}" data-doc="${indiceDoc}"
                    onclick="abrirDoc(this.dataset.estado, this.dataset.funcionario, this.dataset.doc)">
                    <span class="rh-documento-nome">${escaparAtributo(doc.doc || 'Sem tipo')}</span>
                    <span class="rh-contagem">${quantidade(doc.quantidade)} registro(s)</span>
                    <span aria-hidden="true">↗</span>
                </button>`).join('')
            return `<div class="rh-funcionario">
                <button type="button" class="rh-pasta-gatilho rh-funcionario-gatilho" aria-expanded="${expandido}"
                    data-estado="${indiceEstado}" data-funcionario="${indiceFuncionario}" onclick="alternarPastaRH(this)">
                    <span class="rh-chevron" aria-hidden="true">›</span>
                    <span class="rh-pasta-textos"><strong>${escaparAtributo(funcionario.nome || 'Sem nome')}</strong>
                        ${funcionario.cargo ? '<small>' + escaparAtributo(funcionario.cargo) + '</small>' : ''}
                        <small>${quantidade(funcionario.quantidade_documentos)} documentos</small>
                        <span class="rh-lista-tags">${faltantes.length
                            ? '<span class="rh-pendencia-titulo">Faltam:</span>' + faltantes.map(doc => '<span class="docs-faltantes">' + escaparAtributo(doc) + '</span>').join('')
                            : '<span class="rh-sem-pendencias">Obrigatórios registrados</span>'}</span>
                    </span>
                </button>
                <div class="rh-documentos-lista" ${expandido ? '' : 'hidden'}>${documentos || '<small>Nenhum documento.</small>'}</div>
            </div>`
        }).join('')
        return `<section class="rh-estado">
            <button type="button" class="rh-pasta-gatilho rh-estado-gatilho" aria-expanded="${aberta}"
                data-estado="${indiceEstado}" onclick="alternarPastaRH(this)">
                <span class="rh-chevron" aria-hidden="true">›</span>
                <span class="rh-pasta-textos"><span>${escaparAtributo(estado.id || '')}</span>
                    <small>${quantidade(estado.quantidade_funcionarios)} funcionários · ${quantidade(estado.quantidade_documentos)} documentos</small>
                </span>
            </button>
            <div class="rh-funcionarios-lista" ${aberta ? '' : 'hidden'}>${funcionarios}</div>
        </section>`
    }).join('')
    container.innerHTML = cabecalho + '<div class="rh-estados-lista">' + (pastas || '<span>Nenhum documento encontrado.</span>') + '</div>'
}

function alternarPastaRH(elemento) {
    const estado = pastasRH[Number(elemento.dataset.estado)]
    if (!estado) return
    const funcionario = elemento.dataset.funcionario === undefined
        ? undefined : estado.funcionarios?.[Number(elemento.dataset.funcionario)]
    const chave = chavePastaRH(estado, funcionario)
    const aberta = !pastasAbertasRH.has(chave)
    if (aberta) pastasAbertasRH.add(chave)
    else pastasAbertasRH.delete(chave)
    elemento.setAttribute('aria-expanded', String(aberta))
    elemento.nextElementSibling.hidden = !aberta
}

function abrirDoc(indiceEstado, indiceFuncionario, indiceDoc) {
    const doc = pastasRH[Number(indiceEstado)]?.funcionarios?.[Number(indiceFuncionario)]?.documentos?.[Number(indiceDoc)]
    const links = [...new Set((doc?.registros || []).map(registro => registro.anexo?.link).filter(Boolean))]
    if (!links.length) return popup({ mensagem: 'Este documento não possui anexo.' })
    for (const link of links) abrirArquivo(link)
}

function criarLinhaRH(documento) {

    const { doc, anexo, local, clinica, id, funcionario, cidade, nome_cargo, foto, realizado, validade } = documento || {}
    const [nome, cargo] = Array.isArray(nome_cargo) ? nome_cargo : []

    const tempoExpiracao = expiraEm(validade)
    const a = (typeof anexo === 'object' && anexo) ? anexo : {}
    const temAnexo = !!a.link

    const tds = `
        <td>
            <img src="imagens/pesquisar.svg" onclick="incluirDocumento('${id}')">
        </td>
        <td>
            <div class="rh-arquivo">
                <div class="rh-arquivo-pilula ${temAnexo ? 'com-anexo' : 'sem-anexo'}">
                    <span class="rh-arquivo-tipo" title="${escaparAtributo(doc || '')}">${escaparAtributo(doc || '--')}</span>
                    ${temAnexo
                        ? `<button type="button" class="rh-arquivo-acao" title="${escaparAtributo(a.nome || '')}"
                            data-link="${escaparAtributo(a.link)}" onclick="abrirArquivo(this.dataset.link)">Ver</button>`
                        : '<span class="rh-arquivo-acao">Ausente</span>'}
                </div>
                ${assinaturaRH(a)}
            </div>
        </td>
        <td>${funcionario ? `<button type="button" title="Abrir cadastro do funcionário" aria-label="Abrir cadastro do funcionário"
            data-funcionario="${escaparAtributo(funcionario)}" onclick="formularioCliente(Number(this.dataset.funcionario))"
            style="padding: 0; border: none; background: transparent; cursor: pointer;">
            <img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(foto))}" alt="" loading="lazy"
                onerror="this.onerror = null; this.src = logo">
        </button>` : `<img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(foto))}" alt="" loading="lazy"
            onerror="this.onerror = null; this.src = logo">`}</td>
        <td>
            <div style="${vertical}; align-items: start; text-align: left; gap: 3px;">
                <span>${escaparAtributo(nome || '')}</span>
                ${cargo ? `<strong>${escaparAtributo(cargo)}</strong>` : ''}
            </div>
        </td>
        <td>${cidade || ''}</td>
        <td>
            ${clinica || ''}<br>
            <b>${local || ''}</b>
        </td>
        <td>${realizado || ''}</td>
        <td>${validade || ''}</td>
        <td>
            <div style="${horizontal}; justify-content: left; gap: 5px;">
                <img src="${tempoExpiracao.icone}" style="width: 1.2rem;">
                <label>${tempoExpiracao.dias}</label>
            </div>
        </td>`

    return `<tr>${tds}</tr>`
}

// Resultado gravado pelo servidor (SCRIPTS/assinaturas_digitais.js) depois do upload.
// Assinatura escaneada ou desenhada é só imagem: aparece como "Sem assinatura digital".
const SITUACOES_ASSINATURA_RH = {
    assinado: { classe: 'ok', texto: 'Digital' },
    invalida: { classe: 'erro', texto: 'Inválida', detalhe: 'O arquivo foi alterado depois de assinado: a assinatura não confere.' },
    sem_assinatura: { classe: 'alerta', texto: 'Sem assinatura digital', detalhe: 'O PDF não tem assinatura digital. Se há assinatura, ela é escaneada ou desenhada.' },
    invalidada: { classe: 'erro', texto: 'Assinatura invalidada', detalhe: 'O PDF foi assinado, mas depois foi salvo de novo por outro programa (ex.: aberto no navegador e salvo, ou "imprimir em PDF") e as assinaturas perderam a validade. Envie o arquivo original assinado.' },
    nao_pdf: { classe: 'neutro', texto: 'Não é PDF', detalhe: 'Só PDFs podem ter assinatura digital.' },
    arquivo_ausente: { classe: 'neutro', texto: 'Não verificado', detalhe: 'O arquivo não foi encontrado no servidor.' },
    erro: { classe: 'neutro', texto: 'Não verificado', detalhe: 'Não foi possível ler o PDF (protegido por senha ou corrompido).' }
}

// Nomes vêm do certificado em maiúsculas: "MARIA DA SILVA" vira "Maria da Silva".
function nomeAssinanteRH(nome) {
    if (!String(nome || '').trim()) return 'Assinante não identificado'
    return String(nome).toLowerCase()
        .replace(/(^|\s)(\p{L})/gu, (_, espaco, letra) => espaco + letra.toUpperCase())
        .replace(/ (Da|De|Do|Das|Dos|E) /g, parte => parte.toLowerCase())
}

// Quem assinou, um por linha com ✓ (ou ✗ se a assinatura não confere), cortado com … pelo CSS;
// os detalhes ficam no title. Selo só quando há algo a avisar (sem assinatura, inválida...).
function assinaturaRH(anexo) {
    if (!anexo?.link) return ''

    const resultado = anexo.assinatura_digital
    if (!resultado)
        return '<div class="rh-assinatura neutro" title="Ainda não verificado"><span class="rh-assinatura-selo">Verificando...</span></div>'

    const situacao = SITUACOES_ASSINATURA_RH[resultado.situacao] || SITUACOES_ASSINATURA_RH.erro
    const assinaturas = resultado.assinaturas || []
    const linhas = assinaturas.map(a => {
        const data = a.data && !Number.isNaN(new Date(a.data).getTime()) ? new Date(a.data).toLocaleString('pt-BR') : ''
        const origem = a.origem === 'outro' ? 'outro certificado' : a.origem
        return `${a.confere ? '✓' : '✗'} ${nomeAssinanteRH(a.nome)}${origem ? ` (${origem})` : ''}${data ? ' em ' + data : ''}`
    })
    if (situacao.detalhe) linhas.unshift(situacao.detalhe)
    if (resultado.alterado_depois) linhas.push('Atenção: o arquivo recebeu alterações depois da última assinatura.')

    const selo = resultado.alterado_depois && situacao.classe === 'ok'
        ? { classe: 'alerta', texto: 'Alterado após assinar' }
        : situacao.classe === 'ok' ? null : situacao
    const nomes = assinaturas.map(a => `
        <span class="rh-assinante ${a.confere ? 'confere' : 'nao-confere'}">
            <span class="rh-assinante-marca" aria-hidden="true">${a.confere ? '✓' : '✗'}</span>
            <span class="rh-assinante-nome">${escaparAtributo(nomeAssinanteRH(a.nome))}</span>
        </span>`).join('')

    return `<div class="rh-assinatura ${selo?.classe || 'ok'}" title="${escaparAtributo(linhas.join('\n'))}">
        ${selo ? `<span class="rh-assinatura-selo">${selo.texto}</span>` : ''}
        ${nomes}
    </div>`
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

    const hoje = dataServidor();

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

// Área pontilhada do anexo: o arquivo solto vai para o próprio <input name="anexo">, que é o que
// salvarDocumento lê. Um arquivo por documento (fica o primeiro, se vierem vários).
function soltarAnexoRH(event, area) {
    event.preventDefault()
    area.classList.remove('arrastando')

    const arquivo = event.dataTransfer?.files?.[0]
    if (!arquivo) return

    const input = area.querySelector('input[type="file"]')
    const transferencia = new DataTransfer()
    transferencia.items.add(arquivo)
    input.files = transferencia.files
    mostrarAnexoRH(input)
}

function mostrarAnexoRH(input) {
    const area = input.closest('.rh-anexo-area')
    const texto = area?.querySelector('.rh-anexo-texto')
    const arquivo = input.files?.[0]
    if (!texto) return

    area.classList.toggle('com-arquivo', !!arquivo)
    texto.innerHTML = arquivo
        ? `<b>${escaparAtributo(arquivo.name)}</b><small>Clique ou arraste outro para trocar</small>`
        : 'Arraste o arquivo aqui ou <u>clique para escolher</u>'
}

async function incluirDocumento(id) {

    const { local, doc, clinica, funcionario, realizado, anexo } = await recuperarDado('documentos', id) || {}
    const { nome } = funcionario ? await recuperarDado('clientes', funcionario) || {} : {}
    const dataOriginal = String(realizado || '').trim()
    const dataBR = dataOriginal.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    const dataFormulario = dataBR
        ? `${dataBR[3]}-${dataBR[2]}-${dataBR[1]}`
        : dataOriginal.slice(0, 10)

    controlesCxOpcoes.funcionario = {
        base: 'clientes',
        retornar: ['nome'],
        filtros: {
            usuario: { op: 'NOT_EMPTY' }
        },
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Nome': { chave: 'nome' },
            'Estado': { chave: 'estado' },
            'Cidade': { chave: 'cidade' }
        }
    }

    controlesCxOpcoes.doc = {
        base: 'rh_documentos_regras',
        retornar: ['id'],
        colunas: {
            'Documento': { chave: 'id' }
        }
    }

    const linhas = [
        {
            texto: 'Anexo',
            elemento: `
                <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0;">
                    ${anexo?.link ? `
                        <button type="button" data-link="${escaparAtributo(anexo.link)}"
                            onclick="abrirArquivo(this.dataset.link)" style="white-space: normal; overflow-wrap: anywhere;">
                            Ver anexo: ${escaparAtributo(anexo.nome || 'Arquivo anexado')}
                        </button>
                        <small>Selecione outro arquivo para substituir o anexo atual.</small>
                    ` : id ? '<small>Este documento não possui anexo.</small>' : ''}
                    <label class="rh-anexo-area" data-soltar-arquivo="soltarAnexoRH"
                        ondragenter="event.preventDefault(); this.classList.add('arrastando')"
                        ondragover="event.preventDefault()"
                        ondragleave="if (!this.contains(event.relatedTarget)) this.classList.remove('arrastando')"
                        ondrop="soltarAnexoRH(event, this)">
                        <input name="anexo" type="file" aria-label="Selecionar anexo" onchange="mostrarAnexoRH(this)">
                        <span class="rh-anexo-icone" aria-hidden="true">⇪</span>
                        <span class="rh-anexo-texto">Arraste o arquivo aqui ou <u>clique para escolher</u></span>
                    </label>
                </div>`
        },
        {
            texto: 'Funcionário',
            elemento: `
            <div style="${horizontal}; gap: 3px;">
                <span 
                ${funcionario ? `id="${funcionario}"` : ''} 
                class="opcoes" 
                name="funcionario" 
                onclick="cxOpcoes('funcionario')">
                    ${escaparAtributo(nome || 'Selecionar')}
                </span>
                <img onclick="formularioCliente()" src="imagens/baixar.png">
            </div>
            `
        },
        {
            texto: 'Doc',
            elemento: `<span ${doc ? `id="${escaparAtributo(doc)}"` : ''} class="opcoes" name="doc" onclick="cxOpcoes('doc')">${escaparAtributo(doc || 'Selecionar')}</span>`
        },
        {
            texto: 'realizado',
            elemento: `<input name="realizado" value="${escaparAtributo(dataFormulario)}" type="date">`
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
        base: 'vw_documentos',
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
    const doc = obVal('doc')?.id

    if (!doc)
        return popup({ mensagem: 'Selecione o tipo de exame' })

    if (!funcionario)
        return popup({ mensagem: 'Escolha um funcionário' })

    // Se existir algum documento para este funcionário do mesmo tipo, substituir;
    const existente = await verificarDoc(Number(funcionario), doc)
    const resultados = existente?.resultados || []
    if (resultados.length)
        id = existente.resultados[0].id

    if (resultados.length > 1) {
        for (let i = 1; i < resultados.length; i++)
            await excluirDocumento(resultados[i].id)
    }

    const { usuario, anexo } = await recuperarDado('documentos', id) || {}

    const campos = ['realizado', 'clinica', 'local']

    const atualizado = {
        id,
        funcionario: Number(funcionario),
        doc,
        usuario: usuario || acesso.usuario,
        anexo: anexoAPI?.[0] ?? anexo ?? {},
        ...Object.fromEntries(
            campos.map(n => [n, obVal(n)?.value || ''])
        )
    }

    await enviar(`documentos/${id}`, atualizado)

    removerPopup()
}
