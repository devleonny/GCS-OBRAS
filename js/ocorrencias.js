const autE = ['adm', 'gerente', 'diretoria']

const tabEquipamentos = (equipamentos, idOcorrencia, idCorrecao) => {

    const linhasEquipamentos = Object.values(equipamentos || {})
        .map(e => {
            const { codigo, unidade, serie, descricao, origem, quantidade } = e || {}
            const tr = `
                <tr>
                    <td>${codigo}</td>
                    <td>${serie || ''}</td>
                    <td>${origem || ''}</td>
                    <td>${quantidade || 0}</td>
                    <td>${unidade || 'UN'}</td>
                    <td>${descricao || ''}</td>
                </tr>`
            return tr
        })
        .join('')

    const btn = idCorrecao
        ? `<button onclick="criarOrcamentoVinculado('${idOcorrencia}', '${idCorrecao}')">Criar um orçamento com esses itens</button>`
        : ''

    const tabela = `
        <div style="${vertical}">
            <div class="topo-tabela">
                <span style="font-size: 1rem; color: white;">Listagem de Peças e/ou Equipamentos</span>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        ${['Código', 'Nº série', 'Origem', 'Quantidade', 'Unidade', 'Descrição'].map(th => `<th>${th}</th>`).join('')}
                    </thead>
                    <tbody>${linhasEquipamentos}</tbody>
                </table>
            </div>
            <div class="rodape-tabela">
                ${btn}
            </div>
        </div>`

    return linhasEquipamentos
        ? tabela
        : ''
}

function pararCam() {
    const cameraDiv = document.querySelector('.cameraDiv');
    if (cameraDiv) cameraDiv.style.display = 'none'

    try {
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
        const video = document.getElementById('video');
        if (!video) return
        video.srcObject = null;
    } catch (err) {
        popup({ mensagem: `Falha no plugin: ${err}` })
    }
}

async function excluirFoto(idFoto, idOcorrencia, idCorrecao) {

    overlayAguarde()

    if (idCorrecao) {
        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/fotos/${idFoto}`)

    } else if (idOcorrencia) {
        await deletar(`dados_ocorrencias/${idOcorrencia}/fotos/${idFoto}`)

    }

    const blocoFt = document.getElementById(`bloco-foto-${idFoto}`)
    if (blocoFt)
        blocoFt.remove()

    removerOverlay()

}

async function blocoAuxiliarFotos(fotos, idOcorrencia, idCorrecao) {

    const imagens = Object.entries(fotos || {})
        .map(([link,]) => {

            const fExcluir = !idOcorrencia
                ? ''
                : `excluirFoto('${link}', '${idOcorrencia}'${idCorrecao ? `, '${idCorrecao}'` : ''})`

            return `
                    <div style="position: relative;" id="bloco-foto-${link}">
                        <img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">
                        <img onclick="${fExcluir}" src="imagens/cancel.png" style="width: 1.5rem; position: absolute; top: 3px; right: 3px;">
                    </div>
                    `
        })
        .join('')

    const painel = `
            <div class="fotos">${imagens}</div>
            <div class="capturar" onclick="auxiliarRegistroFoto()">
                <img src="imagens/camera.png">
                <span>Abrir Câmera</span>
            </div>
        `
    return painel

}

async function auxiliarRegistroFoto() {

    const elemento = `
        <div style="${vertical}; gap: 3px; background-color: #d2d2d2;">
            <div class="capturar" style="position: fixed; bottom: 10px; left: 10px; z-index: 10003;" onclick="tirarFoto()">
                <img src="imagens/camera.png">
                <span>Capturar Imagem</span>
            </div>

            <div class="cameraDiv">
                <video autoplay playsinline></video>
                <canvas style="display: none;"></canvas>
            </div>
        </div>
        `
    popup({ elemento })
    await abrirCamera()

}

async function abrirCamera() {
    const cameraDiv = document.querySelector('.cameraDiv')
    const video = cameraDiv.querySelector('video')

    setInterval(pararCam, 1 * 60 * 1000) // 1 minuto;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
        })
        video.srcObject = stream
        cameraDiv.style.display = 'flex'

    } catch (err) {
        popup({ mensagem: err.message || 'Erro ao acessar a câmera' })
    }
}

function visibilidadeFotos() {
    const fotos = document.querySelector('.fotos')
    const qtd = fotos.querySelectorAll('img')
    fotos.style.display = qtd.length == 0 ? 'none' : 'grid'
}

async function tirarFoto() {

    const fotos = document.querySelector('.fotos')
    const cameraDiv = document.querySelector('.cameraDiv')
    const canvas = cameraDiv.querySelector('canvas')
    const video = cameraDiv.querySelector('video')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    const idFoto = ID5digitos()
    const foto = `<img name="foto" data-salvo="não" id="${idFoto}" src="${canvas.toDataURL('image/png')}" class="foto" onclick="ampliarImagem(this, '${idFoto}')">`
    fotos.insertAdjacentHTML('beforeend', foto)

    removerPopup()
    visibilidadeFotos()

}

function removerImagem(id) {
    removerPopup()
    const img = document.getElementById(id)
    if (img) img.remove()

    visibilidadeFotos()
}

function ampliarImagem(img) {

    const elemento = `
        <div style="position: relative; background-color: #d2d2d2;">
            <img style="width: 95%;" src="${img.src}">
        </div>
    `

    popup({ elemento })

}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '-'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

function confirmarExclusao(idOcorrencia, idCorrecao) {

    const botoes = [
        {
            texto: 'Confirmar',
            img: 'concluido',
            funcao: idCorrecao
                ? `excluirOcorrenciaCorrecao('${idOcorrencia}', '${idCorrecao}')`
                : `excluirOcorrenciaCorrecao('${idOcorrencia}')`
        }
    ]

    popup({ botoes, mensagem: 'Você tem certeza que deseja excluir?' })
}

async function excluirOcorrenciaCorrecao(idOcorrencia, idCorrecao) {

    removerPopup()
    overlayAguarde()

    if (idCorrecao) {
        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`)
    } else {
        await deletar(`dados_ocorrencias/${idOcorrencia}`)
    }

    removerOverlay()

}

function uCorrecao(correcoes = {}) {
    let maisRecente = null
    let selecionada = null
    let solucionado = false

    for (const [idCorrecao, item] of Object.entries(correcoes)) {
        const { data, tipoCorrecao } = item || {}
        if (!data) continue

        const [d, h] = String(data).split(', ')
        if (!d || !h) continue

        const [dia, mes, ano] = d.split('/')
        if (!dia || !mes || !ano) continue

        const dateObj = new Date(`${ano}-${mes}-${dia}T${h}`)
        if (Number.isNaN(dateObj.getTime())) continue

        if (tipoCorrecao === 'WRuo2') {
            selecionada = { id: idCorrecao, ...item }
            maisRecente = dateObj
            solucionado = true
            continue
        }

        if (!solucionado && (!maisRecente || dateObj > maisRecente)) {
            maisRecente = dateObj
            selecionada = { id: idCorrecao, ...item }
        }
    }

    if (!selecionada) return null

    let dias = 0
    if (selecionada.dtCorrecao && !solucionado) {
        const dt = new Date(`${selecionada.dtCorrecao}T00:00:00`)
        if (!Number.isNaN(dt.getTime())) {
            const diff = dt.getTime() - Date.now()
            dias = Math.trunc(diff / (1000 * 60 * 60 * 24))
        }
    }

    return {
        ...selecionada,
        dias
    }
}

function carregarCorrecoes(ocorrencia) {

    const modelo = (valor1, valor2) => {

        if (!valor2)
            return ''

        return `
        <div style="${horizontal}; gap: 1rem; margin-bottom: 5px; width: 100%;">
            <label style="width: 30%; text-align: right;"><b>${valor1}</b></label>
            <div style="width: 70%; text-align: left;">${valor2}</div>
        </div>`
    }

    const idOcorrencia = ocorrencia.id
    const { correcoes } = ocorrencia || {}

    let divsCorrecoes = ''
    const aTec = acesso.permissao === 'técnico'

    // Organizado com a última correção primeiro;
    const correcoesOrganizadas = Object.entries(correcoes || {})
        .sort(([, a], [, b]) => toTimestamp(b.data) - toTimestamp(a.data))

    for (const [idCorrecao, correcao] of correcoesOrganizadas) {

        const { equipamentos, idOrcamento, tipoCorrecaoNome } = correcao

        if (aTec) {
            // Só mostrar correções criadas para ele;
            if (correcao.executor !== acesso.usuario)
                continue
        }

        const edicao = (correcao.usuario == acesso.usuario || autE.includes(acesso.permissao))
            ? `
                <button onclick="formularioCorrecao('${idOcorrencia}', '${idCorrecao}')">Editar</button>
                <button style="background-color: #B12425;" onclick="confirmarExclusao('${idOcorrencia}', '${idCorrecao}')">Excluir</button>
            `
            : ''

        const agendamentos = (correcao?.datas_agendadas || []).reverse()
            .map(data => {
                const [ano, mes, dia] = data ? data.split('-') : ['-', '-', '-']
                return `<span>${dia}/${mes}/${ano}</span>`
            })
            .join('')

        const imgR = (correcao.usuario == acesso.usuario || autE.includes(acesso.permissao))
            ? `<button onclick="reagendarCorrecao('${idOcorrencia}', '${idCorrecao}')" style="background-color: #249f41; color: white;">Reagendar</button>`
            : ''

        const anexos = Object
            .entries(correcao?.anexos || {})
            .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo(this, '${idAnexo}', '${idOcorrencia}', '${idCorrecao}')`))
            .join('')

        const imagens = Object.entries(correcao?.fotos || {})
            .map(([link,]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        const imagensExistentes = imagens !== ''
            ? `<div class="fotos" style="display: flex;">${imagens}</div>`
            : '<img src="imagens/img.png" style="width: 4rem;">'

        const estilo = tipoCorrecaoNome == 'Solucionada'
            ? 'fin'
            : tipoCorrecaoNome == 'Não analisada'
                ? 'na'
                : 'and'

        const pdfOrcamento = idOrcamento
            ? modelo('Orçamento', `<img src="imagens/pdf.png" onclick="irPdf('${idOrcamento}')">`)
            : ''

        divsCorrecoes += `
            <div class="detalhes-correcoes-1">

                <div style="${vertical}; width: 90%; padding: 0.5rem;">
                    ${modelo('Data Limite Execução', `
                        <div style="${horizontal}; justify-content: start; gap: 1rem;">
                            <span>${dtFormatada(correcao?.dtCorrecao)}</span>
                            ${imgR}
                        </div>
                        <div class="agendamentos">${agendamentos}</div>
                        `)}
                    ${modelo('Solicitante', `<span>${correcao.usuario}</span>`)}
                    ${modelo('Executor', `<span>${correcao?.executor || ''}</span>`)}
                    ${modelo('Técnico', `<span>${correcao?.tecnico || ''}</span>`)}
                    ${modelo('Correção', `<span class="${estilo}">${tipoCorrecaoNome || 'Sem status'}</span>`)}
                    ${pdfOrcamento}
                    ${modelo('Descrição', `<div style="white-space: pre-wrap;">${correcao.descricao}</div>`)}
                    ${modelo('Criado em', `<span>${correcao?.data || ''}</span>`)}
                    ${tabEquipamentos(equipamentos, idOcorrencia, idCorrecao)}
                    
                </div>

                <div style="${horizontal}">

                    <div style="${horizontal}; gap: 2px; padding: 0.5rem;"> 
                        ${edicao}
                    </div>

                    <div style="${vertical}; padding: 0.5rem;">
                        ${imagensExistentes}
                        <div id="anexos" style="${vertical};">
                            ${anexos}
                        </div>
                    </div>
                </div>
            </div>`
    }

    const acumulado = `
        <button style="background-color: #e47a00;" onclick="formularioCorrecao('${idOcorrencia}')">Incluir Correção</button>
        <div class="detalhamento-correcoes">
            ${divsCorrecoes}
        </div>
    `

    return { correcoes: acumulado, vazio: divsCorrecoes == '' }

}

function reagendarCorrecao(idOcorrencia, idCorrecao) {

    const linhas = [
        {
            texto: 'Defina uma nova data',
            elemento: `<input id="dt_reag" oninput="bloqAnterior(this)" type="date">`
        }
    ]

    const botoes = [
        { img: 'concluido', texto: 'Salvar', funcao: `salvarDataCorrecao('${idOcorrencia}', '${idCorrecao}')` }
    ]

    popup({ linhas, botoes, titulo: 'Reagendar' })

}

async function salvarDataCorrecao(idOcorrencia, idCorrecao) {

    const novaData = document.getElementById('dt_reag')
    if (!novaData) return

    overlayAguarde()

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const correcao = ocorrencia.correcoes[idCorrecao]
    correcao.datas_agendadas ??= []
    correcao.datas_agendadas.push(correcao.dtCorrecao)
    correcao.dtCorrecao = novaData.value

    await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/dtCorrecao`, novaData.value)
    await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/datas_agendadas`, correcao.datas_agendadas)

    removerPopup()

}

function visibilidadeFiltros(painel, mostrar) {
    painel.style.display = mostrar
        ? 'none'
        : ''
}

async function telaOcorrencias() {

    mostrarMenus(false)

    const empresaAtiva = await recuperarDado('empresas', acesso?.empresa)
    titulo.innerHTML = empresaAtiva?.nome || 'Desatualizado'

    const mapa = criarMapa()
    const btnExtras = `
    <div style="${vertical};" class="painel-filtros">
        <div id="filtros1" class="filtros"></div>
        <div id="filtros2" class="filtros"></div>
    </div>
    ${mapa}
    `
    const tabela = await modTab({
        btnExtras,
        alinPag: vertical,
        funcaoAdicional: ['contadoresMapaOcorrencias'],
        base: 'dados_ocorrencias',
        pag: 'ocorrencias',
        body: 'bodyOcorrencias',
        criarLinha: 'criarLinhaOcorrencia',
        substituicoes: [
            {
                path: 'correcoes.*.tipoCorrecao',
                tabela: 'correcoes',
                campoBusca: 'id',
                retorno: 'nome',
                destino: 'correcoes.*.tipoCorrecaoNome'
            }
        ]
    })

    const acumulado = `
        <div class="tela-ocorrencias">
            ${tabela}
        </div>`

    tela.innerHTML = acumulado

    // Filtros especiais para Técnico e Cliente;
    if (acesso.permissao == 'técnico') {

        controles.ocorrencias.filtros = {
            'snapshots.ultimoExecutor': { op: '=', value: acesso.usuario },
            'correcoes.*.tipoCorrecao': { op: '!=', value: 'WRuo2' }
        }

    } else if (acesso.permissao == 'cliente') {

        controles.ocorrencias.filtros = {
            'snapshots.cliente.empresa': { op: '=', value: acesso?.empresa },
        }

    }

    await paginacao()

    criarPesquisas()

}


async function contadoresMapaOcorrencias() {

    const dados = await contarPorCampo({
        base: 'dados_ocorrencias',
        filtros: controles?.ocorrencias?.filtros || {},
        path: 'snapshots.cliente.estado'
    })

    auxMapa(dados)

}

function criarLinhaOcorrencia(ocorrencia) {

    const { id, fotos, anexos, usuario, id_antigo, snapshots, equipamentos } = ocorrencia || {}
    const { sistema, prioridade, tipo, cliente, empresa } = snapshots || {}

    const imagens = Object.entries(fotos || {})
        .map(([link,]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
        .join('')

    const imagensExistentes = imagens !== ''
        ? `<div class="fotos" style="display: flex;">${imagens}</div>`
        : '<img src="imagens/img.png" style="width: 4rem;">'

    const divCorrecoes = carregarCorrecoes(ocorrencia)

    const corAssinatura = ocorrencia.assinatura
        ? '#008000'
        : '#d30000'
    const criador = ocorrencia?.usuario || 'Em branco'
    const descricao = ocorrencia?.descricao || 'Em branco'
    const podeGerenciar = autE.includes(acesso.permissao) || usuario == acesso.usuario
    const divAnexos = Object
        .entries(anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, podeGerenciar ? `removerAnexo(this, '${idAnexo}', '${id}')` : false))
        .join('')

    const btnExclusao = podeGerenciar
        ? botaoImg('fechar', `confirmarExclusao('${id}')`)
        : ''

    const btnEditar = podeGerenciar
        ? botaoImg('lapis', `formularioOcorrencia('${id}')`)
        : ''

    const btnOS = `<div class="botaoImg" onclick="telaOS('${id}')"><span>OS</span></div>`

    const btnORC = (!['cliente', 'técnico'].includes(acesso.permissao) && id.includes('ORC_'))
        ? botaoImg('pesquisar5', `verDetalhesOrc('${id}')`)
        : ''

    const modeloCampos = (valor1, elemento, livre) => {
        if (!elemento)
            return ''

        const valor2 = livre
            ? elemento
            : String(elemento).replace('\n', '<br>')

        return `
        <div style="${horizontal}; width: 100%; gap: 0.5rem;">
            <label style="font-weight: bold; width: 20%; text-align: right;">${valor1}</label>
            <div style="text-align: justify; width: 80%; text-align: left;">${valor2}</div>
        </div>
        `
    }

    const existeAntigo = id_antigo
        ? modeloCampos('ID Antigo', `<span class="etiqueta-chamado">${id_antigo}</span>`, true)
        : ''

    const criarOrcamento = !['cliente', 'técnico'].includes(acesso.permissao) // Apenas autorizados;
        ? `<button onclick="criarOrcamentoVinculado('${id}')">Criar orçamento</button>`
        : ''

    const partes = `
        <div class="div-linha">
            <div class="bloco-linha">
                <div style="${horizontal}; gap: 5px; padding: 5px; width: 100%;">

                    <span class="etiqueta-chamado">${id}</span>
                    ${btnEditar}
                    ${btnExclusao}
                    ${btnOS}
                    ${btnORC}

                    <div style="border: solid 1px ${corAssinatura}; border-radius: 3px; padding: 2px; background-color: ${corAssinatura}52;" 
                    onclick="coletarAssinatura('${id}')">
                        <img src="imagens/assinatura.png" style="width: 1.5rem;">
                    </div>
                    ${criarOrcamento}
                </div>
                ${modeloCampos('', 'AC SOLUÇÕES')}
                ${existeAntigo}
                ${modeloCampos('Unidade', cliente?.nome)}
                ${modeloCampos('Endereço', cliente?.endereco)}
                ${modeloCampos('Bairro', cliente?.bairro)}
                ${modeloCampos('Cidade', cliente?.cidade)}
                ${modeloCampos('Descrição', descricao)}
                ${modeloCampos('Criado por', criador)}
                ${modeloCampos('Data Registro', ocorrencia?.dataRegistro || '')}
                ${modeloCampos('Empresa', empresa)}
                ${modeloCampos('Tipo', tipo)}
                ${modeloCampos('Sistema', sistema)}
                ${modeloCampos('Prioridade', prioridade)}

                ${modeloCampos('Equipamentos', tabEquipamentos(equipamentos || {}))}

                ${modeloCampos(
        'Anexos',
        divAnexos
            ? `<div id="anexos" style="${vertical};">
                    ${divAnexos || 'Sem anexos'}
                </div>`
            : 'Sem anexos')}

            ${modeloCampos('Fotos', imagens ? imagensExistentes : 'Sem Imagens')}

            </div>

            <div class="bloco-linha">
                ${divCorrecoes.correcoes}
            </div>
        </div>`

    return `
        <tr>
            <td>${partes}</td>
        </tr>`

}

async function verDetalhesOrc(idOcorrencia) {
    overlayAguarde()

    const pesquisa = await pesquisarDB({
        base: 'dados_orcamentos',
        filtros: {
            'dados_orcam.contrato': { op: '=', value: idOcorrencia }
        }
    })

    const idOrcamento = pesquisa?.resultados?.[0]?.id
    if (idOrcamento)
        await abrirAtalhos(idOrcamento)

    removerOverlay()

}

async function verPdfOrcamento(idOcorrencia) {

    overlayAguarde()

    const pesquisa = await pesquisarDB({
        base: 'dados_orcamentos',
        filtros: {
            'dados_orcam.contrato': { op: '=', value: idOcorrencia }
        }
    })

    const idOrcamento = pesquisa?.resultados?.[0]?.id

    if (idOrcamento)
        await irPdf(idOrcamento)

    removerOverlay()

}

async function criarOrcamentoVinculado(idOcorrencia, idCorrecao) {

    overlayAguarde()

    const orcamento = await pesquisarDB({
        base: 'dados_orcamentos',
        filtros: {
            'dados_orcam.contrato': { op: '=', value: idOcorrencia }
        }
    })

    if (orcamento.resultados.length > 1)
        return popup({ mensagem: `Por alguma razão existem dois orçamentos com este número <b>${idOcorrencia}</b>, fale com o suporte.` })

    if (!orcamento.resultados.length && idOcorrencia.includes('ORC_'))
        return popup({ mensagem: `Não existe orçamento com este número <b>${idOcorrencia}</b>, vincule esta ocorrência a um orçamento antes.` })

    const { unidade, snapshots, correcoes } = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}

    const equipamentos = correcoes?.[idCorrecao]?.equipamentos || {}

    const dados_composicoes = Object.fromEntries(
        Object.entries(equipamentos).map(([chave, dados]) => {
            return [
                chave,
                {
                    ...dados,
                    qtde: dados.quantidade
                }
            ]
        })
    )

    // Chave provisória para vínculo posterior;
    const empresa = snapshots?.empresa

    baseOrcamento({
        dados_composicoes,
        lpu_ativa:
            empresa == 'BOTICARIO'
                ? 'LPU BOTICARIO'
                : empresa == 'ASSAÍ'
                    ? 'LPU ASSAÍ'
                    : 'LPU HOPE',
        dados_orcam: {
            contrato: 'sequencial',
            omie_cliente: unidade,
            analista: acesso?.nome_completo || '',
            email_analista: acesso?.email || '',
            telefone: acesso?.telefone || ''
        },
        origem: {
            idOrcamento: orcamento?.resultados?.[0]?.id,
            idOcorrencia
        }
    })

    await telaCriarOrcamento()

    removerOverlay()

}

async function voltarOcorrencias() {

    carregarMenus()
    auxPendencias()
    await telaOcorrencias()

}

function regrasAtuais(path) {
    const atual = controles?.ocorrencias?.filtros?.[path]

    if (!atual)
        return []

    return Array.isArray(atual)
        ? [...atual]
        : [atual]
}

function valoresMarcados(path) {
    const atual = regrasAtuais(path)

    const grupo = atual.find(r => r?.modo === 'OR' && r?.origem === 'dropdown')

    return (grupo?.regras || []).map(r => r.value)
}

function opcoesDropdownValidas(opcoes = []) {
    return opcoes
        .filter(o => o && o !== 'todos')
        .sort((a, b) => a.localeCompare(b))
}

function tudoMarcado(path, opcoes = []) {
    const validas = opcoesDropdownValidas(opcoes)
    const marcados = valoresMarcados(path)

    return validas.length > 0 && validas.every(o => marcados.includes(o))
}

async function alternarTodosDropdown(path, opcoes = []) {
    const regras = regrasAtuais(path)
    const outrasRegras = regras.filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'))
    const validas = opcoesDropdownValidas(opcoes)

    if (validas.length === 0)
        return

    const marcarTudo = !tudoMarcado(path, opcoes)

    if (marcarTudo) {
        outrasRegras.push({
            modo: 'OR',
            origem: 'dropdown',
            regras: validas.map(value => ({
                op: '=',
                value
            }))
        })
    }

    if (outrasRegras.length === 0) {
        delete controles.ocorrencias.filtros[path]
    } else if (outrasRegras.length === 1) {
        controles.ocorrencias.filtros[path] = outrasRegras[0]
    } else {
        controles.ocorrencias.filtros[path] = outrasRegras
    }

    const drop = document.querySelector(`.filtro-dropdown[data-path="${path}"]`)
    if (drop) {
        const checks = drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')
        const marcar = marcarTudo

        checks.forEach(input => {
            input.checked = marcar
        })

        const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]')
        if (checkTodos)
            checkTodos.checked = marcar
    }

    atualizarLabelDropdown(path)
    await paginacao()
}

async function alternarFiltroDropdown(path, valor, marcado) {
    let regras = regrasAtuais(path)

    const grupoAtual = regras.find(r => r?.modo === 'OR' && r?.origem === 'dropdown')
    const outrasRegras = regras.filter(r => !(r?.modo === 'OR' && r?.origem === 'dropdown'))

    let regrasDropdown = [...(grupoAtual?.regras || [])]
        .filter(r => r.value !== valor)

    if (marcado) {
        regrasDropdown.push({
            op: '=',
            value: valor
        })
    }

    if (regrasDropdown.length > 0) {
        outrasRegras.push({
            modo: 'OR',
            origem: 'dropdown',
            regras: regrasDropdown
        })
    }

    if (outrasRegras.length === 0) {
        delete controles.ocorrencias.filtros[path]
    } else if (outrasRegras.length === 1) {
        controles.ocorrencias.filtros[path] = outrasRegras[0]
    } else {
        controles.ocorrencias.filtros[path] = outrasRegras
    }

    const drop = document.querySelector(`.filtro-dropdown[data-path="${path}"]`)
    if (drop) {
        const opcoes = [...drop.querySelectorAll('input[type="checkbox"][data-item="opcao"]')]
            .map(input => input.value)

        const checkTodos = drop.querySelector('input[type="checkbox"][data-item="todos"]')
        if (checkTodos)
            checkTodos.checked = tudoMarcado(path, opcoes)
    }

    atualizarLabelDropdown(path)
    await paginacao()
}

function toggleDropdown(botao) {
    const drop = botao.closest('.filtro-dropdown')
    const menu = drop.querySelector('.dropdown-menu')
    const aberto = menu.dataset.aberto === 'S'

    document.querySelectorAll('.filtro-dropdown .dropdown-menu').forEach(m => {
        m.style.display = 'none'
        m.dataset.aberto = 'N'
    })

    if (!aberto) {
        menu.style.display = 'block'
        menu.dataset.aberto = 'S'
    }
}

function labelDropdown(path) {
    const marcados = valoresMarcados(path)

    if (marcados.length === 0)
        return 'Selecionar'

    if (marcados.length === 1)
        return marcados[0]

    return `${marcados.length} selecionados`
}

function atualizarLabelDropdown(path) {
    const drop = document.querySelector(`.filtro-dropdown[data-path="${path}"]`)
    if (!drop)
        return

    const label = drop.querySelector('.dropdown-label')
    if (!label)
        return

    label.textContent = labelDropdown(path)
}

function montarDropdownCheckbox({ titulo, path, opcoes = [] }) {
    const validas = opcoesDropdownValidas(opcoes)
    const marcados = valoresMarcados(path)
    const todosAtivos = tudoMarcado(path, validas)

    const itens = validas
        .map(o => `
            <label class="dropdown-item">
                <input
                    type="checkbox"
                    data-item="opcao"
                    value="${o}"
                    ${marcados.includes(o) ? 'checked' : ''}
                    onchange="alternarFiltroDropdown('${path}', ${JSON.stringify(o).replace(/"/g, '&quot;')}, this.checked)">
                <span>${o}</span>
            </label>
        `)
        .join('')

    return `
        <div style="${vertical}; gap: 2px;">
            <span style="color: white;">${titulo}</span>
            <div class="filtro-dropdown" data-path="${path}">
                <div class="filtro-dropdown-botao" onclick="toggleDropdown(this)">
                    <span class="dropdown-label">${labelDropdown(path)}</span>
                    <span>▾</span>
                </div>
                <div class="dropdown-menu" data-aberto="N">
                    <label class="dropdown-item" style="border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 6px;">
                        <input
                            type="checkbox"
                            data-item="todos"
                            ${todosAtivos ? 'checked' : ''}
                            onchange="alternarTodosDropdown('${path}', ${JSON.stringify(validas).replace(/"/g, '&quot;')})">
                        <span>Todos</span>
                    </label>

                    ${itens || '<span>Nenhuma opção</span>'}
                </div>
            </div>
        </div>
    `
}

async function criarPesquisas() {

    const divF1 = document.querySelector('#filtros1')
    const divF2 = document.querySelector('#filtros2')

    const camposLivres = {
        'Chamado': { path: 'snapshots.contrato' },
        'Nº Série': { path: 'equipamentos.*.serie' },
        'Cidade': { path: 'snapshots.cliente.cidade' },
        'Descricao': { path: 'descricao' },
        'Unidade': { path: 'snapshots.cliente.nome' },
    }

    for (const [titulo, campo] of Object.entries(camposLivres)) {

        const { path } = campo

        const valor = controles?.ocorrencias?.filtros?.[path]?.value || ''

        const pesquisa = `
        <div class="pesquisa">
            <input
                onkeydown="if (event.key === 'Enter') pesquisarOcorrencias('${path}', this.value)"
                placeholder="${titulo}"
                id="campo_${path}"
                style="width: 100%;" 
                value="${valor}">

            <img src="imagens/pesquisar4.png">
        </div>`

        divF1.insertAdjacentHTML('beforeend', pesquisa)

    }

    const camposFechados = {
        'Criador': { path: 'usuario' },
        'Tipo': { path: 'snapshots.tipo' },
        'Sistema': { path: 'snapshots.sistema' },
        'Prioridade': { path: 'snapshots.prioridade' },
        'Última Correção': { path: 'snapshots.ultimaCorrecao' },
        'Executor': { path: 'correcoes.*.executor' },
        'Estado': { path: 'snapshots.cliente.estado' },
        'Empresa': { path: 'snapshots.empresa' },
    }

    if (acesso.permissao == 'cliente')
        delete camposFechados.Empresa

    const filtros = []

    controlesCxOpcoes.filtros = {
        base: 'filtros',
        funcaoAdicional: ['definirFiltroGrupo'],
        retornar: ['nome'],
        colunas: {
            'nome': { chave: 'nome' }
        }
    }

    const nome = controles?.ocorrencias?.nomeFiltro || 'Selecionar'
    const idFiltro = controles?.ocorrencias?.idFiltro

    const funcao = ['diretoria', 'adm'].includes(acesso.permissao)
        ? `<img src="imagens/pesquisar.png" onclick="formFiltro(${idFiltro ? `'${idFiltro}'` : ''})">`
        : `<img src="imagens/limpar.png" onclick="limparFiltroOcorrencias()">`

    filtros.push(`
        <div style="${vertical}; gap: 2px;">
            <div style="${horizontal}; gap: 3px;">
                <span style="color: white;">Filtros</span>
                ${funcao}
            </div>
            <span  ${idFiltro ? `id="${idFiltro}"` : ''} style="padding: 0 10px 0 10px;" class="filtro-dropdown-botao" name="filtros" onclick="cxOpcoes('filtros')">${nome}</span>
        </div>
        `)

    for (const [titulo, conf] of Object.entries(camposFechados)) {
        const { path } = conf

        const contagem = (titulo == 'Executor' && acesso.permissao == 'técnico')
            ? { [acesso.usuario]: {} }
            : {
                '': {},
                ...await contarPorCampo({ base: 'dados_ocorrencias', path })
            }

        filtros.push(
            montarDropdownCheckbox({
                titulo,
                path,
                opcoes: Object.keys(contagem)
            })
        )
    }

    // Filtro de atrasados;
    filtros.push(`
            <div style="${vertical}; gap: 2px;">
                <span style="color: white;">Atrasados</span>
                <select onchange="filtrarAtrasados(this)">
                    ${['', 'Sim', 'Não'].map(o => `<option>${o}</option>`).join('')}
                </select>
            </div>
        `)

    // Filtros de data;
    const fTempo = ['De', 'Até']
    fTempo.forEach(t => {

        filtros.push(`
            <div style="${vertical}; gap: 2px;">
                <span style="color: white;">${t}</span>
                <input type="date" data-operador="${t}" onchange="filtrarPorData(this)">
            </div>
        `)

    })

    divF2.insertAdjacentHTML('beforeend', filtros.join(''))
}

async function formFiltro(id) {

    const { nome } = await recuperarDado('filtros', id) || {}

    const linhas = [
        {
            texto: 'Nome do Filtro',
            elemento: `<textarea name="nome">${nome || ''}</textarea>`
        }
    ]

    const botoes = [
        {
            img: 'concluido',
            texto: 'Salvar',
            funcao: id
                ? `salvarFiltro('${id}')`
                : 'salvarFiltro()'
        }]

    if (id) {
        botoes.push(
            {
                img: 'cancel',
                texto: 'Excluir',
                funcao: `confirmarExcluirFiltro('${id}')`
            },
            {
                img: 'limpar',
                texto: 'Limpar',
                funcao: 'limparFiltroOcorrencias()'
            }
        )
    }

    popup({ botoes, linhas, titulo: 'Grupo de filtros' })

}

async function confirmarExcluirFiltro(id) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirFiltroOcorrencias('${id}')` }
    ]

    popup({ mensagem: 'Tem certeza?', botoes, nra: false })

}

async function excluirFiltroOcorrencias(id) {

    await deletarDB('filtros', id)
    deletar(`filtros/${id}`)

    await limparFiltroOcorrencias()
}

async function limparFiltroOcorrencias() {

    delete controles.ocorrencias.nomeFiltro
    delete controles.ocorrencias.idFiltro
    delete controles.ocorrencias.filtros

    document.querySelector('#filtros1').innerHTML = ''
    document.querySelector('#filtros2').innerHTML = ''

    removerPopup()

    await criarPesquisas()
    await paginacao()

}

async function salvarFiltro(id = crypto.randomUUID()) {

    overlayAguarde()

    const nome = document.querySelector('[name="nome"]').value || 'Sem nome'

    const filtro = {
        id,
        nome,
        filtro: controles?.ocorrencias?.filtros || {}
    }

    await enviar(`filtros/${id}`, filtro)

    await definirFiltroGrupo()

    removerPopup()

}

async function definirFiltroGrupo() {
    const span = document.querySelector('[name="filtros"]')
    const id = span?.id
    if (!id) return

    const { filtro, nome } = await recuperarDado('filtros', id) || {}
    if (!filtro) return

    controles.ocorrencias.nomeFiltro = nome
    controles.ocorrencias.idFiltro = id
    controles.ocorrencias.filtros = structuredClone(filtro)

    document.querySelector('#filtros1').innerHTML = ''
    document.querySelector('#filtros2').innerHTML = ''

    await criarPesquisas()
    span.textContent = nome || 'Selecionar'

    await paginacao()
}

function listaRegras(path) {
    const atual = controles.ocorrencias.filtros[path]

    if (!atual)
        return []

    return Array.isArray(atual)
        ? [...atual]
        : [atual]
}

function salvarRegras(path, regras) {
    if (!regras.length) {
        delete controles.ocorrencias.filtros[path]
        return
    }

    controles.ocorrencias.filtros[path] = regras.length === 1
        ? regras[0]
        : regras
}

async function filtrarPorData(input) {
    const path = 'snapshots.dtCorrecao'
    const tipo = input.dataset.operador === 'De' ? 'de' : 'ate'
    const op = tipo === 'de' ? '>=d' : '<=d'
    const value = input.value
    const origem = `data_${tipo}`

    let regras = listaRegras(path)
        .filter(regra => regra.origem !== origem)

    if (value)
        regras.push({ op, value, origem })

    salvarRegras(path, regras)
    await paginacao()
}

async function pesquisarOcorrencias(path, valor) {
    if (!valor) {
        delete controles.ocorrencias.filtros[path]
    } else {
        controles.ocorrencias.filtros[path] = {
            op: 'includes',
            value: valor
        }
    }

    const campo = document.getElementById(`campo_${path}`)
    if (campo)
        campo.value = valor

    await paginacao()
}

async function filtrarAtrasados(input) {
    const ativo = input.value
    const hoje = new Date().toLocaleDateString()

    let regrasStatus = listaRegras('snapshots.ultimaCorrecao')
        .filter(regra => regra.origem !== 'atrasados_status')

    let regrasData = listaRegras('snapshots.dtCorrecao')
        .filter(regra => regra.origem !== 'atrasados_data')

    if (ativo) {
        regrasStatus.push({
            op: '!=',
            value: 'Solucionada',
            origem: 'atrasados_status'
        })

        regrasData.push({
            op: ativo == 'Sim' ? '<d' : '>=d',
            value: hoje,
            origem: 'atrasados_data'
        })
    }

    salvarRegras('snapshots.ultimaCorrecao', regrasStatus)
    salvarRegras('snapshots.dtCorrecao', regrasData)

    await paginacao()
}

async function auxPendencias() {

    const divPendencias = document.querySelector('.painel-pendencias')
    if (!divPendencias)
        return

    controles.ocorrencias ??= {}
    controles.ocorrencias.filtros ??= {}

    let filtros = {}

    if (acesso.permissao == 'técnico') {
        filtros = {
            'correcoes.*.tipoCorrecao': { op: '!=', value: 'WRuo2' },
            'snapshots.ultimoExecutor': { op: '=', value: acesso.usuario }
        }

    } else if (acesso.permissao == 'cliente') {

        filtros = {
            'snapshots.cliente.empresa': { op: '=', value: acesso?.empresa }
        }

    }

    const contadores = await contarPorCampo({
        base: 'dados_ocorrencias',
        filtros,
        path: 'snapshots.ultimaCorrecao'
    })


    const ordemFinal = ['Solucionada', 'todos']

    const etiquetas = Object
        .entries(contadores)
        .sort((a, b) => {
            const [nomeA] = a
            const [nomeB] = b

            const priA = ordemFinal.includes(nomeA)
            const priB = ordemFinal.includes(nomeB)

            if (priA && !priB) return 1
            if (!priA && priB) return -1

            return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' })
        })
        .map(([correcao, total]) => {

            const cor =
                correcao === 'Solucionada'
                    ? '#3c9f15'
                    : correcao === 'todos'
                        ? '#004cff'
                        : '#b12425'

            return `
            <div class="pill" onclick="atalhoAuxiliar('${correcao}')">
                <span class="pill-a" style="background: ${cor};">${total}</span>
                <span class="pill-b">${inicialMaiuscula(correcao)}</span>
            </div>`
        })
        .join('')

    divPendencias.innerHTML = etiquetas

}

async function atalhoAuxiliar(correcao) {

    if (correcao == 'todos')
        return await telaOcorrencias()

    controles.ocorrencias.filtros = {
        'snapshots.ultimaCorrecao': {
            modo: 'OR',
            origem: 'dropdown',
            regras: [
                { op: '=', value: correcao }
            ]
        }
    }

    await telaOcorrencias()

}

async function formularioOcorrencia(idOcorrencia) {

    overlayAguarde()

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const { unidade = unidadeOrc, snapshots, anexos, fotos, descricao } = ocorrencia
    const { sistema, tipo, prioridade } = snapshots || {}

    const equipamentos = (
        await Promise.all(
            Object.values(ocorrencia?.equipamentos || {})
                .map(equip => maisLabel(equip))
        )
    ).join('')

    const cliente = unidade
        ? await recuperarDado('dados_clientes', unidade)
        : snapshots?.cliente || {}

    const a = Object
        .entries(anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')`))
        .join('')


    let filtros = {}
    if (acesso.permissao == 'cliente') {
        filtros = {
            'empresa': { op: '=', value: acesso?.empresa }
        }
    }

    // Campo Unidade;
    controlesCxOpcoes.unidade = {
        base: 'dados_clientes',
        retornar: ['nome'],
        filtros,
        colunas: {
            'Nome': { chave: 'nome' },
            'CNPJ': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' },
            'Endereço': { chave: 'endereco' },
        }
    }

    // Campos Simples;
    Object.entries({
        'tipo': 'tipos',
        'sistema': 'sistemas',
        'prioridade': 'prioridades'
    }).forEach(([n, base]) => {

        controlesCxOpcoes[n] = {
            base,
            retornar: ['nome'],
            colunas: {
                'Nome': { chave: 'nome' }
            }
        }

    })

    const linhas = [
        {
            texto: 'Unidade de Manutenção',
            elemento: `<span ${unidade ? `id="${unidade}"` : ''} 
                class="campos" name="unidade" onclick="cxOpcoes('unidade')">
                ${cliente.nome || 'Selecione'}
            </span>`
        },
        {
            texto: 'Sistema',
            elemento: `<span ${ocorrencia.unidade ? `id="${ocorrencia.unidade}"` : ''} 
            class="campos" name="sistema" onclick="cxOpcoes('sistema')">
                ${sistema || 'Selecione'}
            </span>`
        },
        {
            texto: 'Prioridade',
            elemento: `<span ${ocorrencia.prioridade ? `id="${ocorrencia.prioridade}"` : ''} 
            class="campos" name="prioridade" onclick="cxOpcoes('prioridade')">
                ${prioridade || 'Selecione'}
            </span>`
        },
        {
            texto: 'Tipo',
            elemento: `<span ${ocorrencia.tipo ? `id="${ocorrencia.tipo}"` : ''} 
            class="campos" name="tipo" onclick="cxOpcoes('tipo')">
                ${tipo || 'Selecione'}
            </span>`
        },
        {
            texto: 'Descrição',
            elemento: `<textarea rows="7" 
            style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" 
            name="descricao" class="campos">${descricao || ''}</textarea>`
        },
        {
            elemento: `
            <div style="${vertical}; width: 100%; gap: 5px;">
                <div style="${horizontal}; gap: 1rem;">
                    <span>Registro de peças ou equipamentos</span>
                    <img src="imagens/baixar.png" onclick="maisLabel()">
                </div>
                <div style="${vertical}; width: 100%; gap: 2px;" id="equipamentos">
                    ${equipamentos}
                </div>
            </div>
            `
        },
        {
            texto: 'Anexos',
            elemento: `
            <div style="${vertical}; gap: 3px;">
                <input name="anexos" type="file" multiple>
                <div id="anexos" style="${vertical};">
                    ${a}
                </div>
            </div>
            `
        },
        {
            elemento: await blocoAuxiliarFotos(fotos, idOcorrencia)
        }
    ]

    const botoes = [
        { img: 'concluido', texto: 'Salvar', funcao: idOcorrencia ? `salvarOcorrencia('${idOcorrencia}')` : 'salvarOcorrencia()' },
    ]

    const titulo = idOcorrencia ? 'Editar Ocorrência' : 'Criar Ocorrência'

    popup({ linhas, botoes, titulo })

    visibilidadeFotos()

    // Limpeza da variável para novos;
    unidadeOrc = null

    removerOverlay()

}

function bloqAnterior(input) {
    if (input.type !== 'date' || !input.value) return

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const valor = new Date(input.value)
    valor.setHours(0, 0, 0, 0)

    if (valor < hoje) {
        input.valueAsDate = hoje
    }
}

async function formularioCorrecao(idOcorrencia, idCorrecao) {

    overlayAguarde()

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || ''
    const correcao = ocorrencia?.correcoes?.[idCorrecao] || {}

    const equipamentos = (
        await Promise.all(
            Object.values(correcao?.equipamentos || {})
                .map(equip => maisLabel({ ...equip, formulario: 'correcao' }))
        )
    ).join('')

    controlesCxOpcoes.executor = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Nome': { chave: 'usuario' },
            'Permissão': { chave: 'permissao' },
            'Setor': { chave: 'setor' }
        }
    }

    controlesCxOpcoes.tecnico = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Nome': { chave: 'usuario' },
            'Permissão': { chave: 'permissao' },
            'Setor': { chave: 'setor' }
        }
    }

    controlesCxOpcoes.tipoCorrecao = {
        base: 'correcoes',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' }
        }
    }

    const { nome } = await recuperarDado('correcoes', correcao?.tipoCorrecao) || {}
    const { executor, tecnico } = correcao

    const linhas = [
        {
            texto: 'Data Limite Execução',
            elemento: `<input name="dtCorrecao" type="date" value="${correcao?.dtCorrecao || ''}">`
        },
        {
            texto: 'Status da Correção',
            elemento: `<span 
                class="campos" ${correcao?.tipoCorrecao ? `id="${correcao?.tipoCorrecao}"` : ''} 
                name="tipoCorrecao" onclick="cxOpcoes('tipoCorrecao')">
                    ${nome || 'Selecione'}
                </span>`
        },
        {
            texto: 'Quem fará a atividade?',
            elemento: `<span class="campos" ${executor ? `id="${executor}"` : ''} name="executor" onclick="cxOpcoes('executor')">${executor || 'Selecione'}</span>`
        },
        {
            texto: 'Técnico',
            elemento: `<span class="campos" ${tecnico ? `id="${tecnico}"` : ''} name="tecnico" onclick="cxOpcoes('tecnico')">${tecnico || 'Selecione'}</span>`
        },
        {
            texto: 'Descrição',
            elemento: `<textarea 
                    style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" 
                    name="descricao" 
                    rows="7" 
                    class="campos">${correcao?.descricao || ''}</textarea>`
        },
        {
            elemento: `
            <div style="${vertical}; width: 100%; gap: 5px;">
                <div style="${horizontal}; gap: 1rem;">
                    <span>Peças Usadas na Correção</span>
                    <img src="imagens/baixar.png" onclick="maisLabel({formulario: 'correcao'})">
                </div>
                <div style="${vertical}; width: 100%; gap: 2px;" id="equipamentos">
                    ${equipamentos}
                </div>
            </div>
            `
        },
        {
            elemento: `${await blocoAuxiliarFotos(correcao?.fotos, idOcorrencia, idCorrecao)}`
        },
        {
            texto: 'Anexos',
            elemento: `
            <div style="${vertical}; gap: 5px;">
                <input name="anexos" type="file" multiple>
                <div id="anexos" style="${vertical};">
                    ${Object
                    .entries(correcao?.anexos || {})
                    .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo(this, '${idAnexo}', '${idOcorrencia}', '${idCorrecao}')`))
                    .join('')
                }
                </div>
            </div>
            `
        }
    ]

    const botoes = [
        {
            img: 'concluido',
            texto: 'Salvar',
            funcao: idCorrecao
                ? `salvarCorrecao('${idOcorrencia}', '${idCorrecao}')`
                : `salvarCorrecao('${idOcorrencia}')`
        }
    ]

    popup({ linhas, botoes, titulo: 'Gerenciar Correção', autoDestruicao: ['executor', 'tecnico', 'tipoCorrecao'] })

    visibilidadeFotos()

    removerOverlay()

}

async function maisLabel({ codigo, descricao, quantidade, origem, serie, formulario } = {}) {

    const div = document.getElementById('equipamentos')
    const temporario = ID5digitos()

    controlesCxOpcoes[temporario] = {
        base: 'dados_composicoes',
        retornar: ['descricao'],
        filtros: {
            'tipo': { op: '!=', value: 'SERVIÇO' }
        },
        colunas: {
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao' },
            'Unidade': { chave: 'unidade' },
            'Modelo': { chave: 'modelo' },
            'Fabricante': { chave: 'fabricante' }
        }
    }

    const divOrigem = formulario == 'correcao'
        ? `
            <div style="${vertical};">
                <label>Origem</label>
                ${['Kit', 'Parceiro', 'Matriz', 'Compra Região'].map(o => `
                    <div style="${horizontal}; gap: 1rem;">
                        <input name="origem_${temporario}" data-origem="${o}" type="radio" ${origem == o ? 'checked' : ''}>
                        <label style="text-align: left;">${o}</label>
                    </div>
                    `).join('')}
            </div>
        `
        : ''

    const label = `
        <div class="borda-equipamento">
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
            <div name="equipamentos" style="${horizontal}; align-items: start; gap: 1rem;">
                <div style="${vertical};">
                    <label>Quantidade</label>
                    <input id="quantidade" style="width: 7rem;" class="campos" type="number" value="${quantidade || ''}">
                </div>
                <div style="${vertical};">
                    <label>Nº série</label>
                    <input id="serie" style="width: 7rem;" class="campos" value="${serie || ''}">
                </div>

                ${divOrigem}

                <div style="${vertical};">
                    <label>Descrição</label>
                    <span 
                        class="campos" 
                        name="${temporario}" ${codigo ? `id="${codigo}"` : ''} 
                        onclick="cxOpcoes('${temporario}')">${descricao || 'Selecione'}</span>
                </div>

            </div>
        </div>`

    if (codigo)
        return label

    div.insertAdjacentHTML('beforeend', label)
}

async function salvarCorrecao(idOcorrencia, idCorrecao = ID5digitos()) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    ocorrencia.correcoes ??= {}
    ocorrencia.correcoes[idCorrecao] ??= {}
    ocorrencia.correcoes[idCorrecao].datas ??= {}
    ocorrencia.correcoes[idCorrecao].fotos ??= {}
    // Equipamentos deve começar zerado;
    ocorrencia.correcoes[idCorrecao].equipamentos = {}

    const tipoCorrecao = obter('tipoCorrecao').id
    const dtCorrecao = obter('dtCorrecao').value

    if (!tipoCorrecao)
        return popup({ mensagem: 'Defina um status para a correção' })

    if (tipoCorrecao == 'WRuo2' && !ocorrencia.assinatura && acesso.permissao == 'técnico') {
        coletarAssinatura(idOcorrencia)
        return
    }

    overlayAguarde()

    if (!tipoCorrecao || !dtCorrecao)
        return popup({ mensagem: 'Não deixe em branco <b>Data Limite</b> ou o <b>Tipo de Correção</b>' })

    ocorrencia.correcoes[idCorrecao] = {
        ...ocorrencia.correcoes[idCorrecao],
        dtCorrecao,
        tecnico: obter('tecnico').id,
        executor: obter('executor').id,
        usuario: acesso.usuario,
        tipoCorrecao,
        descricao: obter('descricao').value
    }

    // Data: Se existir, mantém;
    if (!ocorrencia.correcoes[idCorrecao].data)
        ocorrencia.correcoes[idCorrecao].data = new Date().toLocaleString()

    // Localização;
    const geoPermitido = localStorage.getItem('geo_permitido') === '1'

    const local = geoPermitido
        ? await capturarLocalizacao()
        : { latitude: null, longitude: null }

    const data = new Date().getTime()
    ocorrencia.correcoes[idCorrecao].datas[data] = {
        latitude: local.latitude,
        longitude: local.longitude
    }

    const input = obter('anexos')
    const anexos = await anexosOcorrencias(input)

    ocorrencia.correcoes[idCorrecao].anexos = {
        ...ocorrencia.correcoes[idCorrecao].anexos,
        ...anexos
    }

    // Fotos;
    const fotos = document.querySelector('.fotos')
    const imgs = fotos.querySelectorAll('img') || []

    for (const img of imgs) {
        if (img.dataset && img.dataset.salvo == 'sim') continue
        const foto = await importarAnexos({ foto: img.src })
        ocorrencia.correcoes[idCorrecao].fotos[foto[0].link] = foto[0]
    }

    // Equipamentos
    const divs = document.querySelectorAll('[name="equipamentos"]')

    for (const div of divs) {
        const equip = div.querySelector('span')

        if (!equip?.id)
            continue

        const { unidade, modelo, descricao, fabricante } = await recuperarDado('dados_composicoes', equip.id)

        const quantidade = Number(div.querySelector('#quantidade').value)
        const serie = div.querySelector('#serie').value
        const origem = div.querySelector('input[name^="origem_"]:checked')?.dataset.origem || ''

        ocorrencia.correcoes[idCorrecao].equipamentos[equip.id] = {
            codigo: equip.id,
            modelo,
            origem,
            serie,
            descricao,
            fabricante,
            quantidade,
            unidade
        }
    }

    await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, ocorrencia.correcoes[idCorrecao])
    removerPopup()

}

function obter(name) {
    const elemento = document.querySelector(`[name=${name}]`)
    return elemento
}

async function salvarOcorrencia(idOcorrencia) {

    overlayAguarde()

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const input = obter('anexos')
    const anexos = await anexosOcorrencias(input)
    const novo = {
        equipamentos: {},
        unidade: Number(obter('unidade')?.id),
        sistema: obter('sistema')?.id || '',
        prioridade: obter('prioridade')?.id || '',
        tipo: obter('tipo')?.id || '',
        descricao: obter('descricao')?.value || '',
        dataRegistro: new Date().toLocaleString('pt-BR'),
        usuario: acesso.usuario,
        anexos: {
            ...ocorrencia.anexos,
            ...anexos
        }
    }

    // Equipamentos
    const divs = document.querySelectorAll('[name="equipamentos"]')

    for (const div of divs) {

        const equip = div.querySelector('span')

        if (!equip?.id)
            continue

        const { unidade, modelo, descricao, fabricante } = await recuperarDado('dados_composicoes', equip.id)

        const quantidade = Number(div.querySelector('#quantidade').value)
        const serie = div.querySelector('#serie').value

        novo.equipamentos[equip.id] = {
            codigo: equip.id,
            modelo,
            serie,
            descricao,
            fabricante,
            quantidade,
            unidade
        }
    }

    ocorrencia.fotos ??= {}

    const imgs = [...document.querySelectorAll('.fotos img')]
        .filter(i => i.dataset.salvo == 'não')

    if (imgs.length > 0) {
        for (const img of imgs) {
            const foto = await importarAnexos({ foto: img.src })
            const dados = foto[0]
            ocorrencia.fotos[dados.link] = dados
        }
    }

    if (idOcorrencia) {
        Object.assign(ocorrencia, novo)

        await enviar(`dados_ocorrencias/${idOcorrencia}`, ocorrencia)
        removerPopup()

    } else {

        try {
            const resposta = await enviar('dados_ocorrencias/0000', novo)

            if (resposta.mensagem)
                return popup({ mensagem: resposta.mensagem })

            removerPopup()

        } catch (err) {
            popup({ mensagem: err.mensagem || 'Falha ao salvar a ocorrência, fale com o Suporte!' })
        }
    }

}

async function anexosOcorrencias(input) {
    const anexos = await importarAnexos({ input }) || []
    const objeto = {}
    anexos.forEach(anexo => {
        const idAnexo = ID5digitos()
        objeto[idAnexo] = anexo
    })

    return objeto
}

async function removerAnexo(img, idAnexo, idOcorrencia, idCorrecao) {

    overlayAguarde()

    if (idCorrecao) { // Se correção
        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/anexos/${idAnexo}`)
    } else { // Se ocorrência
        await deletar(`dados_ocorrencias/${idOcorrencia}/anexos/${idAnexo}`)
    }

    img.parentElement.remove()
    removerOverlay()

}