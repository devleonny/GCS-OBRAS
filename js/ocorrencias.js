const autE = ['adm', 'gerente', 'diretoria']

const formatacaoTipoCorrecao = (tipoCorrecaoNome) => {

    const estilo = tipoCorrecaoNome == 'SOLUCIONADA'
        ? 'fin'
        : tipoCorrecaoNome == 'CANCELADO'
            ? 'na'
            : 'and'

    const label = `<span class="${estilo}">${tipoCorrecaoNome}</span>`

    return label
}

const padraoCor = (st) => {
    switch (st) {
        case 'CANCELADO':
            return '#b12425'
        case 'todos':
            return '#004cff'
        case 'SOLUCIONADA':
            return '#3c9f15'
        default:
            return '#bd8315'
    }
}

const tabEquipamentos = (equipamentos, idOcorrencia, idCorrecao) => {

    const linhasEquipamentos = Object.values(equipamentos || {})
        .map(e => {
            const { codigo, unidade, serie, descricao, origem, quantidade } = e || {}

            const series = Array.isArray(serie)
                ? serie
                : [serie]

            const tr = `
                <tr>
                    <td>${codigo}</td>
                    <td>
                        <div style="white-space: pre-wrap;">${series.join('\n') || ''}</div>
                    </td>
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

    const idFoto = crypto.randomUUID()
    const src = canvas.toDataURL('image/png')
    const foto = `<img name="foto" data-salvo="não" id="${idFoto}" src="${src}" class="foto" onclick="ampliarImagem(this, '${idFoto}')">`

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

function carregarCorrecoes(ocorrencia) {

    const modelo = (valor1, valor2) => {

        if (!valor2)
            return ''

        return `
        <div style="${horizontal}; align-items: start; gap: 1rem; margin-bottom: 5px; width: 100%;">
            <label style="width: 30%; text-align: right;"><b>${valor1}</b></label>
            <div style="width: 70%; text-align: left;">${valor2}</div>
        </div>`
    }

    const idOcorrencia = ocorrencia.id
    const { correcoes, snapshots } = ocorrencia || {}
    const { abas } = snapshots || {}
    const divsCorrecoesPorAba = { geral: [] }

    // Organizado com a última correção primeiro;
    const correcoesOrganizadas = Object.entries(correcoes || {})
        .sort(([, a], [, b]) => toTimestamp(b.data) - toTimestamp(a.data))

    for (const [idCorrecao, correcao] of correcoesOrganizadas) {

        const {
            aba = 'geral',
            equipamentos,
            idOrcamento,
            data,
            tecnico,
            descricao = '',
            datas_agendadas,
            datas_agendadas_final,
            tipoCorrecaoNome,
            localizacao,
            usuario,
            autorizacao,
            dtCorrecao,
            dtCorrecaoFinal,
            executor = []
        } = correcao

        const listaExecutores = Array.isArray(executor)
            ? executor.join(', ')
            : executor

        const edicao = (usuario == acesso.usuario || autE.includes(acesso.permissao))
            ? `
                <button onclick="formularioCorrecao('${idOcorrencia}', '${idCorrecao}')">Editar</button>
                <button style="background-color: #B12425;" onclick="confirmarExclusao('${idOcorrencia}', '${idCorrecao}')">Excluir</button>
            `
            : ''

        const agendamentos = (datas_agendadas || []).reverse()
            .map(data => {
                const [ano, mes, dia] = data ? data.split('-') : ['-', '-', '-']
                return `<span class="riscado">${dia}/${mes}/${ano}</span>`
            })
            .join('')

        const agendamentosFinais = (datas_agendadas_final || []).reverse()
            .map(data => {
                const [ano, mes, dia] = data ? data.split('-') : ['-', '-', '-']
                return `<span class="riscado">${dia}/${mes}/${ano}</span>`
            })
            .join('')

        const imgR = (usuario == acesso.usuario || autE.includes(acesso.permissao))
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

        const labelTipoCorrecao = formatacaoTipoCorrecao(tipoCorrecaoNome)

        const dtCorrecaoFinalformatada = dtCorrecaoFinal
            ? dtFormatada(dtCorrecaoFinal)
            : null

        // Organização por aba;
        divsCorrecoesPorAba[aba] ??= []

        divsCorrecoesPorAba[aba].push(`
            <div class="detalhes-correcoes-1">

                <div style="${vertical}; width: 90%; padding: 0.5rem;">
                    ${modelo('Código de Autorização', autorizacao)}
                    ${modelo('Data Inicial de Execução', `
                        <div style="${horizontal}; align-items: start; justify-content: start; gap: 1rem;">
                            <div class="agendamentos">
                                <span style="font-weight: bold;">${dtFormatada(dtCorrecao)}</span>
                                ${agendamentos}
                            </div>
                            ${imgR}
                        </div>
                        `)}
                    ${modelo('Data Final de Execução', `
                        <div style="${horizontal}; justify-content: start; gap: 1rem;">
                            <span style="font-weight: bold;">${dtFormatada(dtCorrecaoFinal || dtCorrecao)}</span>
                        </div>
                        <div class="agendamentos">${agendamentosFinais}</div>
                        `)}
                    ${modelo('Solicitante', `<span>${usuario || ''}</span>`)}
                    ${modelo('Executores', `<span>${listaExecutores || ''}</span>`)}
                    ${modelo('Técnicos', `<span>${tecnico ? tecnico.join(', ') : ''}</span>`)}
                    ${modelo('Correção', labelTipoCorrecao)}
                    ${modelo('Descrição', `<div style="white-space: pre-wrap;">${descricao || ''}</div>`)}
                    ${modelo('Criado em', `<span>${data || ''}</span>`)}
                    ${tabEquipamentos(equipamentos, idOcorrencia, idCorrecao)}
                    
                </div>

                <div style="${horizontal}">

                    <div style="${horizontal}; gap: 2px; padding: 0.5rem;"> 
                        ${edicao}
                        <img 
                            src="imagens/anexo.png"
                            style="cursor:pointer;"
                            onclick="document.getElementById('inputArquivos_${idCorrecao}').click()">
                        <input
                            type="file"
                            id="inputArquivos_${idCorrecao}"
                            multiple
                            style="display:none;"
                            onchange="salvarAnexosCorrecoes(this, '${idOcorrencia}', '${idCorrecao}')">
                    </div>

                    <div style="${vertical}; padding: 0.5rem;">
                        ${imagensExistentes}
                        <div id="anexos" style="flex-wrap: wrap; display: flex; gap: 2px;">
                            ${anexos}
                        </div>
                    </div>
                </div>
            </div>`
        )
    }

    const abasHTML = [... new Set(Object.values(correcoes || {})
        .map(c => {
            const aba = c?.aba || 'geral'
            const st = abas?.[aba]?.nome
            return `<div 
                id="aba_${idOcorrencia}_${aba}" 
                onclick="exibirAba('${idOcorrencia}', '${aba}')" 
                style="opacity: ${aba == 'geral' ? 1 : 0.5};"
                class="aba-correcao">${formatacaoTipoCorrecao(st)}</div>`
        })
    )]

    const detalhamentos = Object.entries(divsCorrecoesPorAba)
        .map(([aba, corrHTML]) => abaCorrecao({ idOcorrencia, aba, corrHTML }))

    const acumulado = `
        
        <div class="toolbar-correcao">
            <button class="botao-trilho" onclick="scrollAbas(-120, '${idOcorrencia}')">◀</button>

            <div class="toolbar-janela" id="janela_${idOcorrencia}">
                <div class="toolbar-trilho" id="toolbarAbas">
                    ${abasHTML.join('')}
                    ${correcoes ? `<button onclick="formularioCorrecao('${idOcorrencia}', null, 'S')">Novo fluxo</button>` : ''}
                </div>
            </div>

            <button class="botao-trilho" onclick="scrollAbas(120, '${idOcorrencia}')">▶</button>
        </div>

        <div style="width: 100%;" id="detalhamento_${idOcorrencia}">
            ${detalhamentos.join('')}
        </div>

    `

    return { correcoes: acumulado }

}

function scrollAbas(valor, id) {

    const janela = document.querySelector(`#janela_${id}`)
    janela.scrollBy({
        left: valor,
        behavior: 'smooth'
    })
}

function exibirAba(idOcorrencia, aba) {

    const detalhamentos = [...document.querySelectorAll(`[id^="${idOcorrencia}_"]`)]

    for (const det of detalhamentos)
        det.style.display = 'none'

    const abas = [...document.querySelectorAll(`[id^="aba_${idOcorrencia}_"]`)]

    for (const aba of abas)
        aba.style.opacity = 0.5

    document.getElementById(`${idOcorrencia}_${aba}`).style.display = ''
    document.getElementById(`aba_${idOcorrencia}_${aba}`).style.opacity = 1

}

function abaCorrecao({ idOcorrencia, aba = crypto.randomUUID(), corrHTML = [] }) {

    const btnCorrecao = acesso.permissao !== 'cliente'
        ? `<button class="botao-correcao" onclick="formularioCorrecao('${idOcorrencia}', null, '${aba}')">Incluir Correção</button>`
        : ''

    const elemento = `
        <div class="detalhamento-correcoes" style="display: ${aba == 'geral' ? '' : 'none'}" id="${idOcorrencia}_${aba}">
            ${btnCorrecao}
            ${corrHTML.join('')}
        </div>`

    return elemento
}

async function salvarAnexosCorrecoes(input, idOcorrencia, idCorrecao) {

    try {

        overlayAguarde()

        if (!input || !input.files || input.files.length === 0)
            return

        const anexos = await importarAnexos({ input })

        const emMassa = anexos.map(async (anexo) => {

            enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/anexos/${crypto.randomUUID()}`, anexo)

        })

        await Promise.all(emMassa)

        removerOverlay()

    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao anexas arquivos, tente novamente em breve' })
    }

}

async function reagendarCorrecao(idOcorrencia, idCorrecao) {

    overlayAguarde()

    const { correcoes, snapshots } = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const { dtCorrecao, dtCorrecaoFinal, tecnico } = correcoes[idCorrecao] || {}
    const estado = snapshots?.cliente?.estado || 'N'

    const linhas = [
        {
            texto: 'Data inícial de Execução',
            elemento: `<input onchange="verificarConflitos()" name="dtCorrecao" type="date" value="${dtCorrecao || ''}">`
        },
        {
            texto: 'Data Final de Execução',
            elemento: `<input onchange="verificarConflitos()" name="dtCorrecaoFinal" type="date" value="${dtCorrecaoFinal || ''}">`
        },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/reagendar.png" onclick="telaAgenda({ flutuante: true, filtros: {estado: '${estado}'} })">
                <img src="imagens/baixar.png" onclick="maisUsuario([undefined], 'tecnicos')">
                <span>Técnicos</span>
            </div>
            `,
            elemento: '<div class="tecnicos"></div>'
        },
    ]

    const botoes = [
        { img: 'concluido', texto: 'Salvar', funcao: `salvarDataCorrecao('${idOcorrencia}', '${idCorrecao}')` }
    ]

    popup({ linhas, botoes, titulo: 'Reagendar' })

    await maisUsuario(tecnico, 'tecnicos')
    await verificarConflitos()

}

function listasIguais(a, b) {
    const setA = new Set(a)
    const setB = new Set(b)

    if (setA.size !== setB.size) return false

    for (const item of setA) {
        if (!setB.has(item)) return false
    }

    return true
}

async function salvarDataCorrecao(idOcorrencia, idCorrecao) {

    const dtCorrecao = document.querySelector('[name="dtCorrecao"]').value
    const dtCorrecaoFinal = document.querySelector('[name="dtCorrecaoFinal"]').value
    if (!dtCorrecao || !dtCorrecaoFinal)
        return popup({ mensagem: 'Não deixe datas em branco' })

    overlayAguarde()

    if (conflitoAgenda())
        return

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const correcao = ocorrencia.correcoes[idCorrecao]
    let alterado = false

    // Técnicos;
    const tecnicos = [...document.querySelectorAll('.tecnicos span')]
        .filter(span => span.id)
        .map(span => span.id)

    if (!listasIguais(tecnicos, correcao.tecnico)) {
        correcao.tecnico = tecnicos
        alterado = true
    }

    // Inicial;
    if (dtCorrecao !== correcao.dtCorrecao) {
        correcao.datas_agendadas ??= []
        correcao.datas_agendadas.push(correcao.dtCorrecao)
        correcao.dtCorrecao = dtCorrecao
        alterado = true
    }

    // Final;
    if (dtCorrecaoFinal !== correcao.dtCorrecaoFinal) {
        correcao.datas_agendadas_final ??= []
        correcao.datas_agendadas_final.push(correcao.dtCorrecaoFinal)
        correcao.dtCorrecaoFinal = dtCorrecaoFinal
        alterado = true
    }

    if (alterado)
        await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, correcao)

    removerPopup()

}

function visibilidadeFiltros(painel, mostrar) {
    painel.style.display = mostrar
        ? 'none'
        : ''
}

function visibilidadePesquisas() {
    const painel = document.querySelector('.painel-filtros')
    if (!painel) return

    const oculto = painel.classList.toggle('visibilidade')
    localStorage.setItem('painel_filtros_oculto', oculto ? 'sim' : 'nao')
}

function lembrarVisibilidadePesquisas() {
    const painel = document.querySelector('.painel-filtros')
    if (!painel) return

    const oculto = localStorage.getItem('painel_filtros_oculto') === 'sim'
    painel.classList.toggle('visibilidade', oculto)
}

async function telaOcorrencias() {

    overlayAguarde()

    const empresaAtiva = await recuperarDado('empresas', acesso?.empresa)
    titulo.innerHTML = empresaAtiva?.nome || 'Desatualizado'

    const mapa = criarMapa()
    const btnExtras = `
    <div class="painel-filtros">
        <div id="filtros1" class="filtros"></div>
        <div id="filtros2" class="filtros"></div>
    </div>
    ${mapa}
    <img src="imagens/olho.png" onclick="visibilidadePesquisas()">
    `
    const tabela = await modTab({
        btnExtras,
        alinPag: vertical,
        funcaoAdicional: ['contadoresMapaOcorrencias'],
        base: 'dados_ocorrencias',
        pag: 'ocorrencias',
        body: 'bodyOcorrencias',
        criarLinha: 'criarLinhaOcorrencia',
        relacionados: [
            {
                path: 'id',
                campoBusca: 'dados_orcam.contrato',
                tabela: 'dados_orcamentos',
                destino: 'orcamento',
                tipo: 'objeto',
                camposRetorno: ['dados_orcam']
            },
            {
                path: 'id',
                campoBusca: 'contrato',
                tabela: 'vw_orcamentos_vinculados',
                destino: 'vinculados',
                tipo: 'objeto',
                camposRetorno: ['contratos_vinculados']
            }
        ],
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

    lembrarVisibilidadePesquisas()

    await paginacao('ocorrencias')

    removerOverlay()

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

async function abrirAtalhosContrato(contrato) {

    overlayAguarde()

    const orcs = await pesquisarDB({
        base: 'dados_orcamentos',
        filtros: {
            'dados_orcam.contrato': { op: 'includes', value: contrato }
        }
    })

    if (!orcs.resultados.length)
        return popup({ mensagem: 'Sem orçamento, ou orçamento excluído: verifique com o suporte ou crie um orçamento' })

    const { id } = orcs.resultados[0] // Primeiro;

    await abrirAtalhos(id)

}

function criarLinhaOcorrencia(ocorrencia) {

    const {
        id,
        fotos,
        correcoes,
        anexos,
        usuario,
        id_antigo,
        snapshots,
        equipamentos,
        vinculados,
        orcamento
    } = ocorrencia || {}

    const { dados_orcam } = orcamento || {}

    const {
        sistema,
        prioridade,
        tipo,
        cliente,
        empresa
    } = snapshots || {}

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
    const tec1 = dados_orcam?.tecnico?.[0]
    const btsFP = tec1
        ? `<div class="botaoImg" onclick="abrirResumo('${tec1}')"><span>SALDOS</span></div>`
        : ''

    const modeloCampos = (valor1, valor2) => {
        if (!valor2)
            return ''

        return `
        <div style="${horizontal}; width: 100%; gap: 0.5rem;">
            <label style="font-weight: bold; width: 20%; text-align: right;">${valor1}</label>
            <div style="text-align: justify; width: 80%; text-align: left;">${valor2}</div>
        </div>
        `
    }

    const existeAntigo = id_antigo
        ? modeloCampos('ID Antigo', `<span class="etiqueta-chamado">${id_antigo}</span>`)
        : ''

    // Apenas autorizados;
    const apenasAutorizados = !['cliente', 'técnico'].includes(acesso.permissao)

    const criarOrcamento = apenasAutorizados
        ? `<button onclick="criarOrcamentoVinculado('${id}')">Criar orçamento</button>`
        : ''

    const spanNumOrcs = [id, vinculados?.contratos_vinculados || []].flat()
        .map(c => {

            const chave = c !== id
                ? `${id}.${c}`
                : c

            const btns = apenasAutorizados
                ? `
                    <img src="imagens/pesquisar.png" onclick="abrirAtalhosContrato('${c}')">
                    <img src="imagens/pasta2.png" onclick="abrirEsquemaOcorrencias('${chave}')">
                `
                : ''

            return `
                <div class="etiqueta-chamado">
                    ${btns}
                    <span>${c}</span>
                </div>
                `

        })
        .join('<img src="imagens/link2.png">')

    const blocoPrincipal = `
        <div class="linha-orcamentos">
            ${btnEditar}
            ${btnExclusao}
            ${btnOS}
            ${btsFP}

            <div style="border: solid 1px ${corAssinatura}; border-radius: 3px; padding: 2px; background-color: ${corAssinatura}52;" 
            onclick="coletarAssinatura('${id}')">
                <img src="imagens/assinatura.png" style="width: 1.5rem;">
            </div>
        </div>

        ${modeloCampos('', 'AC SOLUÇÕES')}
        ${existeAntigo}
        ${modeloCampos('Unidade', cliente?.nome)}
        ${modeloCampos('Endereço', cliente?.endereco)}
        ${modeloCampos('Bairro', cliente?.bairro)}
        ${modeloCampos('Cidade', cliente?.cidade)}
        ${modeloCampos('Descrição', `<div style="white-space: pre-wrap;">${descricao}</div>`)}
        ${modeloCampos('Criado por', criador)}
        ${modeloCampos('Data Registro', ocorrencia?.data_registro || '')}
        ${modeloCampos('Empresa', empresa)}
        ${modeloCampos('Tipo', tipo)}
        ${modeloCampos('Sistema', sistema)}
        ${modeloCampos('Prioridade', prioridade)}
        ${modeloCampos('Equipamentos', tabEquipamentos(equipamentos || {}))}
        ${modeloCampos('Anexos', divAnexos ? `<div id="anexos" style="${vertical};">${divAnexos || 'Sem anexos'}</div>` : 'Sem anexos')}
        ${modeloCampos('Fotos', imagens ? imagensExistentes : 'Sem Imagens')}
    `

    const partes = `
        <div id="${id}" class="div-linha">

            <div class="bloco-linha">

                <div class="linha-orcamentos">
                    <img onclick="abrirEsquemaOcorrencias('${id}', true)" src="imagens/home.png">
                    ${spanNumOrcs}
                    ${criarOrcamento}
                </div>

                <div class="bloco-principal">${blocoPrincipal}</div>
                <div class="bloco-st"></div>

            </div>

            <div id="correcoes" class="bloco-linha">
                ${divCorrecoes.correcoes}
            </div>
        </div>`

    return `
        <tr>
            <td>${partes}</td>
        </tr>`

}

async function abrirEsquemaOcorrencias(chave, principal) {

    const { permissao } = JSON.parse(localStorage.getItem('acesso')) || {}

    if (['cliente', 'técnico'].includes(permissao))
        return

    const [id, orc] = chave.includes('.')
        ? chave.split('.')
        : [chave, null]

    const bloco = document.getElementById(id)

    if (!bloco)
        return

    const blocoPrincipal = bloco.querySelector('.bloco-principal')
    const blocoStatus = bloco.querySelector('.bloco-st')
    const linhaCorrecoes = bloco.querySelector('#correcoes')

    if (blocoPrincipal)
        blocoPrincipal.style.display = principal ? 'flex' : 'none'

    if (linhaCorrecoes)
        linhaCorrecoes.style.display = principal ? 'flex' : 'none'

    blocoStatus.style.display = principal ? 'none' : 'flex'

    if (principal) {
        blocoStatus.innerHTML = ''
        return
    }

    const slots = Object.keys(esquemaBtnStatus)
        .map(c => {

            const botoes = esquemaBtnStatus[c]
                .map(({ titulo, cor, funcao }) => {

                    return `
                        <button
                        style="background-color: ${cor};" 
                        onclick="${funcao}">
                            ${titulo}
                        </button>`
                })
                .join('')

            return `
            <div style="${vertical}; gap: 2px;">
                ${botoes}
                <div id="${c}"></div>
            </div>
            `
        })
        .join('')

    const elemento = `
        <div class="barra-status">
            ${slots}
        </div>
    `

    blocoStatus.innerHTML = elemento

    carregarTabStatus(id, orc)
}

async function carregarTabStatus(id, orc) {
    const local = document.getElementById(id)

    // Verificar se existe outra tela de status ativa;
    const ativo = controles?.ocorrencias?.ativo

    if (ativo && ativo !== id)
        await abrirEsquemaOcorrencias(ativo, true)

    controles.ocorrencias.ativo = id

    // Mapeia o array esquemaBtnStatus para um array de Promises
    const promessasTabs = Object.keys(esquemaBtnStatus).map(async (t) => {

        // Padrão;
        const dados = {
            base: t,
            body: `body${t}`,
            pag: t,
            filtros: {
                departamento: { op: 'includes', value: orc ? orc : id }
            },
            criarLinha: `lin${inicialMaiuscula(t)}`
        }

        if (t == 'levantamentos' || t == 'finalizado') {
            dados.base = 'anexos'
            dados.criarLinha = 'linAnexos'
            dados.filtros.origem = {
                op: '=',
                value: t == 'levantamentos'
                    ? 'LEVANTAMENTO'
                    : 'FINALIZADO'
            }
        }

        const tabela = await modTab(dados)

        const bloco = local.querySelector(`#${t}`)
        if (bloco) {
            bloco.innerHTML = tabela
        }

        await paginacao(t)
    })

    // Aguarda todas as abas carregarem e renderizarem simultaneamente
    await Promise.all(promessasTabs)
}

async function linPedidos(ped) {

    const {
        id,
        data,
        comentario,
        executor,
        empresa,
        pagamento,
        pedido,
        tipo,
        valor,
        anexos,
        fotos,
        autorizado_por
    } = ped

    const tabela = 'pedidos'
    const cor = '#4CAF50'

    const excluir = (executor == acesso.usuario || acesso.permissao == 'adm')
        ? `<span 
            class="close" 
            style="font-size: 1.2rem; position: absolute; top: 5px; right: 15px;" 
            onclick="apagarGenerico('${id}', 'pedidos')">&times;</span>`
        : ''

    const bloco = `
        <div class="bloco-status" style="border: 1px solid ${cor};">

            <div class="bloco-status-interno" style="background-color: ${cor}1f;">

                ${excluir}
                ${labelDestaque('Executor', executor)}
                ${labelDestaque('Data', data)}
                ${labelDestaque('Comentário', comentario)}
                ${labelDestaque('Empresa a faturar', empresa)}
                ${labelDestaque('Pagamento', pagamento)}
                ${labelDestaque('Pedido', pedido)}
                ${labelDestaque('Autorizado por', autorizado_por)}
                ${labelDestaque('Valor', dinheiro(valor || 0))}
                ${labelDestaque('Tipo', tipo)}
                ${botaoAnexoStatus({ id, tabela, cor })}
                ${botaoFotoStatus({ id, tabela, cor })}
                ${botaoEditarStatus({ id, cor, funcao: `painelAdicionarPedido('${id}')` })}

                <br>

                ${blocoAnexosCompleto({ id, tabela, anexos })}
                ${blocoFotosCompleto({ id, tabela, fotos })}

            </div>

        </div>
    `

    return `
        <tr>
            <td>${bloco}</td>
        </tr>
    `

}

async function linRequisicoes(req) {

    const {
        data,
        comentario,
        avulso = 'N',
        id,
        executor,
        fotos,
        anexos,
        total_requisicao,
        volumes,
        transportadora,
        snapshots
    } = req

    const cor = '#B12425'
    const tabela = 'requisicoes'
    const { pedido } = await recuperarDado('pedidos', req?.pedido) || {}

    const excluir = (executor == acesso.usuario || acesso.permissao == 'adm')
        ? `<span 
            class="close" 
            style="font-size: 1.2rem; position: absolute; top: 5px; right: 15px;" 
            onclick="apagarGenerico('${id}', 'requisicoes')">&times;</span>`
        : ''

    const bloco = `
        <div class="bloco-status" style="border: 1px solid ${cor};">

            <div class="bloco-status-interno" style="background-color: ${cor}1f;">
                ${excluir}
                ${avulso == 'S' ? '<span><b>REQ AVULSA</b></span>' : ''}
                ${labelDestaque('Executor', executor)}
                ${labelDestaque('Data', data)}
                ${labelDestaque('Comentário', comentario)}
                ${labelDestaque('Nº Pedido', pedido)}
                ${labelDestaque('Total Requisição', dinheiro(total_requisicao))}
                ${labelDestaque('Transportadora', transportadora)}
                ${labelDestaque('Volumes', volumes)}
                ${botaoAnexoStatus({ id, tabela, cor })}
                ${botaoFotoStatus({ id, tabela, cor })}
                ${botaoEditarStatus({ id, cor, funcao: `formularioRequisicao('${id}')` })}

                <div style="background-color: ${cor};" 
                    class="contorno-botoes" onclick="gerarPdfRequisicao('${id}', true)">
                    <img src="imagens/pdfw.png" style="width: 1.5rem;">
                    <label>Visualizar</label>
                </div>

                <div style="background-color: ${cor}"
                    class="contorno-botoes" 
                    onclick="gerarPdfRequisicao('${id}')">
                    <img src="imagens/pdfw.png" style="width: 1.5rem;">
                    <label>Baixar PDF</label>
                </div>

                <br>

                ${blocoAnexosCompleto({ id, tabela, anexos })}
                ${blocoFotosCompleto({ id, tabela, fotos })}

            </div>

        </div>`

    return `
    <tr>
        <td>${bloco}</td>
    </tr>
    `

}

async function linNotas(nota) {

    const {
        id,
        data,
        comentario,
        executor,
        n_nota,
        total,
        app,
        categoria,
        d_emi_inicial,
        anexos,
        fotos
    } = nota

    const cor = '#ff4500'
    const tabela = 'notas'
    const excluir = (executor == acesso.usuario || acesso.permissao == 'adm')
        ? `<span 
            class="close" 
            style="font-size: 1.2rem; position: absolute; top: 5px; right: 15px;" 
            onclick="apagarGenerico('${id}', 'notas')">&times;</span>`
        : ''

    const bloco = `
        <div class="bloco-status" style="border: 1px solid ${cor};">

            <div class="bloco-status-interno" style="background-color: ${cor}1f;">

                ${excluir}
                ${labelDestaque('Executor', executor || 'Integração')}
                ${labelDestaque('Data', data)}
                ${labelDestaque('Comentário', comentario)}
                ${labelDestaque('Nota', n_nota)}
                ${labelDestaque('Tipo', categoria)}
                ${labelDestaque('Valor', dinheiro(total))}
                ${labelDestaque('Data Emissão', d_emi_inicial)}
                ${botaoAnexoStatus({ id, tabela: 'notas', cor })}
                ${botaoFotoStatus({ id, tabela, cor })}
                ${botaoEditarStatus({ id, cor, funcao: `adicionarNotaAvulsa('${id}')` })}

                <br>

                ${pdfDanfe({ categoria, n_nota, id, total })}

                <br>

                ${blocoAnexosCompleto({ id, tabela, anexos })}
                ${blocoFotosCompleto({ id, tabela, fotos })}

            </div>

        </div>
    `

    return `
        <tr>
            <td>${bloco}</td>
        </tr>
    `

}

async function linParceiros(par) {

    const {
        id,
        data,
        comentario,
        executor,
        itens,
        margem,
        tecnicos,
        anexos,
        fotos,
        totais
    } = par

    const cor = '#0062d5'
    const tabela = 'parceiros'
    const excluir = (executor == acesso.usuario || acesso.permissao == 'adm')
        ? `<span 
            class="close" 
            style="font-size: 1.2rem; position: absolute; top: 5px; right: 15px;" 
            onclick="apagarGenerico('${id}', 'parceiros')">&times;</span>`
        : ''

    const bloco = `
        <div class="bloco-status" style="border: 1px solid ${cor};">

            <div class="bloco-status-interno" style="background-color: ${cor}1f;">

                ${excluir}
                ${labelDestaque('Executor', executor)}
                ${labelDestaque('Data', data)}
                ${labelDestaque('Comentário', comentario)}
                ${labelDestaque('Total Parceiro', dinheiro(totais?.parceiro))}
                ${labelDestaque('Magem Disponível', dinheiro(totais?.margem))}
                ${labelDestaque('Desvio', dinheiro(totais?.desvio))}
                ${botaoAnexoStatus({ id, tabela: 'parceiros', cor })}
                ${botaoFotoStatus({ id, tabela, cor })}
                ${botaoEditarStatus({ id, cor, funcao: `formularioParceiro('${id}')` })}

                <div style="background-color: ${cor}" 
                    class="contorno-botoes" 
                    onclick="gerarPdfParceiro('${id}', true)">
                    <img src="imagens/pdfw.png" style="width: 1.5rem;">
                    <label>Visualizar</label>
                </div>

                <div style="background-color: ${cor}" 
                    class="contorno-botoes" 
                    onclick="gerarPdfParceiro('${id}')">
                    <img src="imagens/pdfw.png" style="width: 1.5rem;">
                    <label>Baixar PDF</label>
                </div>

                <br>

                ${blocoAnexosCompleto({ id, tabela, anexos })}
                ${blocoFotosCompleto({ id, tabela, fotos })}

            </div>

        </div>
    `

    return `
        <tr>
            <td>${bloco}</td>
        </tr>
    `

}

async function linMateriais(mat) {

    const {
        id,
        data,
        comentario,
        executor,
        rastreio,
        transportadora,
        data_saida,
        previsao,
        anexos,
        fotos
    } = mat

    const cor = '#b17724'
    const tabela = 'materiais'
    const excluir = (executor == acesso.usuario || acesso.permissao == 'adm')
        ? `<span 
            class="close" 
            style="font-size: 1.2rem; position: absolute; top: 5px; right: 15px;" 
            onclick="apagarGenerico('${id}', 'materiais')">&times;</span>`
        : ''

    const bloco = `
        <div class="bloco-status" style="border: 1px solid ${cor};">

            <div class="bloco-status-interno" style="background-color: ${cor}1f;">

                ${excluir}
                ${labelDestaque('Executor', executor)}
                ${labelDestaque('Data', data)}
                ${labelDestaque('Comentário', comentario)}
                ${labelDestaque('Rastreio', rastreio)}
                ${labelDestaque('Transportadora', transportadora)}
                ${labelDestaque('Data de Saída', conversorData(data_saida))}
                ${labelDestaque('Data de Entrega', conversorData(previsao))}
                ${botaoAnexoStatus({ id, tabela: 'materiais', cor })}
                ${botaoFotoStatus({ id, tabela, cor })}
                ${botaoEditarStatus({ id, cor, funcao: `envioMaterial('${id}')` })}

                <br>

                ${blocoAnexosCompleto({ id, tabela, anexos })}
                ${blocoFotosCompleto({ id, tabela, fotos })}

            </div>

        </div>
    `

    return `
        <tr>
            <td>${bloco}</td>
        </tr>
    `

}

async function linAnexos(doc) {

    const {
        id,
        link,
        formato,
        nome
    } = doc || {}

    return `
    <tr>
        <td>
            ${criarAnexoVisual(nome, link, `confirmarExclusaoDocAdicional('${id}')`)}
        </td>
    </tr>
`

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
        return popup({ mensagem: `Não existe orçamento com este número <b>${idOcorrencia}</b>, o orçamento ${idOcorrencia} deve ter sido excluído.` })

    const { unidade, snapshots, correcoes } = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}

    // Chave provisória para vínculo posterior;
    const empresa = snapshots?.empresa

    const lpu_ativa = empresa == 'BOTICARIO'
        ? 'LPU BOTICARIO'
        : empresa == 'ASSAÍ'
            ? 'LPU ASSAÍ'
            : 'LPU HOPE'

    // Equipamentos;
    const equipamentos = correcoes?.[idCorrecao]?.equipamentos || {}

    const dados_composicoes = {}

    for (const [chave, { quantidade }] of Object.entries(equipamentos)) {
        const { tipo, descricao, snapshots } = await recuperarDado('dados_composicoes', chave) || {}

        const custo = snapshots?.[lpu_ativa.toLowerCase()]?.[0] || 0

        dados_composicoes[chave] = {
            tipo,
            custo,
            descricao,
            codigo: chave,
            qtde: quantidade
        }
    }

    baseOrcamento({
        dados_composicoes,
        lpu_ativa,
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

    criarMenus('inicial') // Resetar o menu;
    auxPendencias()
    await telaOcorrencias()

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
        'Autorização': { path: 'correcoes.*.autorizacao' }
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
        'Criador': { chave: 'criadores', path: 'usuario' }, // Chave na tabela ref de opções;
        'Tipo': { chave: 'tipos', path: 'snapshots.tipo' },
        'Sistema': { chave: 'sistemas', path: 'snapshots.sistema' },
        'Prioridade': { chave: 'prioridades', path: 'snapshots.prioridade' },
        'Última Correção': { chave: 'ultima_correcao', path: 'snapshots.ultimaCorrecao.*.nome', explode: { path: 'snapshots.ultimaCorrecao' } },
        'Executor': { op: 'includes', chave: 'executores', path: 'snapshots.ultimaCorrecao.*.executor', explode: { path: 'snapshots.ultimaCorrecao' } },
        'Estado': { chave: 'estados', path: 'snapshots.cliente.estado' },
        'Empresa': { chave: 'empresas', path: 'snapshots.empresa' }
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

    // Exlusão;
    if (!['cliente', 'tecnico'].includes(acesso.permissao)) {
        const nome = controles?.ocorrencias?.nomeFiltro || 'Selecionar'
        const idFiltro = controles?.ocorrencias?.idFiltro

        const funcao = ['diretoria', 'adm'].includes(acesso.permissao)
            ? `<img src="imagens/pesquisar.png" onclick="formFiltro(${idFiltro ? `'${idFiltro}'` : ''})">`
            : `<img src="imagens/limpar.png" onclick="limparFiltroOcorrencias()">`

        filtros.push(`
        <div class="campo-pesquisa">
            <div style="${horizontal}; gap: 3px;">
                <span style="color: white;">Filtros</span>
                ${funcao}
            </div>
            <span  ${idFiltro ? `id="${idFiltro}"` : ''} style="padding: 0 10px 0 10px;" class="filtro-dropdown-botao" name="filtros" onclick="cxOpcoes('filtros')">${nome}</span>
        </div>`
        )
    }

    const listagens = await recuperarDado('vw_opcoes_filtros', 1) || {}

    const emMassa = Object.entries(camposFechados)
        .map(([titulo, conf]) => {

            return montarDropdownCheckbox({
                op: conf?.op || '=',
                pag: 'ocorrencias',
                titulo,
                path: conf.path,
                opcoes: listagens?.[conf?.chave] || []
            })

        })

    filtros.push(emMassa)

    // Filtro de autorizados e atrasados;

    filtros.push(`
            <div class="campo-pesquisa">
                <span style="color: white;">Autorização</span>
                <select onchange="filtrarAutorizados(this)">
                    ${['', 'Sim', 'Não'].map(o => `<option>${o}</option>`).join('')}
                </select>
            </div>
        `)

    filtros.push(`
            <div class="campo-pesquisa">
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
            <div class="campo-pesquisa">
                <span style="color: white;">${t}</span>
                <input type="date" data-operador="${t}" onchange="filtrarPorData(this)">
            </div>
        `)

    })

    divF2.insertAdjacentHTML('beforeend', filtros.flat().join(''))
}

async function filtrarAutorizados(select) {

    controles.ocorrencias.filtros = {
        ...controles.ocorrencias.filtros,
        'snapshots.autorizacao': { op: '=', value: select.value }
    }

    if (!select.value)
        delete controles.ocorrencias.filtros['snapshots.autorizacao']

    await paginacao('ocorrencias')

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
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirFiltroOcorrencias('${id}')` }
    ]

    popup({ mensagem: 'Tem certeza?', botoes, removerAnteriores: true })

}

async function excluirFiltroOcorrencias(id) {

    await deletar(`filtros/${id}`)
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

    controles.ocorrencias.filtros ??= {}
    const atual = controles.ocorrencias.filtros?.[path]

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
    const path = 'snapshots.ultimaCorrecao.*.dtCorrecao'
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

    controles.ocorrencias.filtros ??= {}

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

    let regrasStatus = listaRegras('snapshots.ultimaCorrecao.*.nome')
        .filter(regra => regra.origem !== 'atrasados_status')

    let regrasData = listaRegras('snapshots.ultimaCorrecao.*.dtCorrecao')
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

    salvarRegras('snapshots.ultimaCorrecao.*.nome', regrasStatus)
    salvarRegras('snapshots.ultimaCorrecao.*.dtCorrecao', regrasData)

    await paginacao()
}


async function auxPendencias() {
    const divPendencias = document.querySelector('.painel-pendencias')
    if (!divPendencias)
        return

    controles.ocorrencias ??= {}
    controles.ocorrencias.filtros ??= {}

    const ordemFinal = ['CANCELADO', 'SOLUCIONADA', 'TODOS']

    if (!['cliente', 'técnico'].includes(acesso.permissao)) {
        const esquema = {
            'FUNCIONÁRIOS': 'f7aec8c1-ce57-40f8-9ea1-c032c3971a9f',
            'PARCEIROS': 'c0bfd4a8-6bca-40e7-a71b-5990630f4b19'
        }

        const [contadores, ctg, ctgFluxo, ctgEmpresa] = await Promise.all([
            contarPorCampo({
                base: 'dados_ocorrencias',
                explode: { path: 'snapshots.ultimaCorrecao' },
                path: 'nome'
            }),
            contarPorCampo({
                filtros: {
                    tipo: {
                        modo: 'OR',
                        regras: [
                            { op: '=', value: 'f7aec8c1-ce57-40f8-9ea1-c032c3971a9f' },
                            { op: '=', value: 'c0bfd4a8-6bca-40e7-a71b-5990630f4b19' },
                        ]
                    }
                },
                base: 'dados_ocorrencias',
                path: 'tipo'
            }),
            contarPorCampo({
                base: 'dados_ocorrencias',
                path: 'prioridade',
                filtros: {
                    prioridade: { op: '=', value: 'lauka' }
                }
            }),
            contarPorCampo({
                base: 'dados_ocorrencias',
                path: 'snapshots.empresa',
                filtros: { 'snapshots.empresa': { op: '=', value: 'SAVEGNAGO' } }
            })
        ])

        const etiquetas = Object
            .entries(contadores || {})
            .sort((a, b) => {
                const [nomeA] = a
                const [nomeB] = b

                const priA = ordemFinal.includes(nomeA)
                const priB = ordemFinal.includes(nomeB)

                if (priA && !priB) return 1
                if (!priA && priB) return -1

                return nomeA.localeCompare(nomeB)
            })
            .map(([correcao, total]) => {
                const cor = padraoCor(correcao)

                return `
                <div class="pill" onclick="atalhoAuxiliar('${correcao}')">
                    <span class="pill-a" style="background: ${cor};">${total}</span>
                    <span class="pill-b">${correcao.toUpperCase()}</span>
                </div>`
            })

        etiquetas.push('<br>')

        for (const [titulo, cod] of Object.entries(esquema)) {
            etiquetas.push(`
                <div class="pill" onclick="atalhoTipo('${cod}')">
                    <span class="pill-a" style="background: #5E35B1;">${ctg?.[cod] || 0}</span>
                    <span class="pill-b">${titulo}</span>
                </div>
            `)
        }

        etiquetas.push(`
            <br>
            <div class="pill" onclick="atalhoContagemFluxo()">
                <span class="pill-a" style="background: #5E35B1;">${ctgFluxo?.lauka || 0}</span>
                <span class="pill-b">CONTAGEM DE FLUXO</span>
            </div>
        `)

        etiquetas.push(`
            <br>
            <div class="pill" onclick="()">
                <span class="pill-a" style="background: #5E35B1;">${ctgEmpresa?.['SAVEGNAGO'] || 0}</span>
                <span class="pill-b">SAVEGNAGO</span>
            </div>
        `)

        divPendencias.innerHTML = etiquetas.join('')
        return
    }

    const contadores = await contarPorCampo({
        base: 'dados_ocorrencias',
        explode: { path: 'snapshots.ultimaCorrecao' },
        path: 'nome'
    })

    const etiquetas = Object
        .entries(contadores || {})
        .sort((a, b) => {
            const [nomeA] = a
            const [nomeB] = b

            const priA = ordemFinal.includes(nomeA)
            const priB = ordemFinal.includes(nomeB)

            if (priA && !priB) return 1
            if (!priA && priB) return -1

            return nomeA.localeCompare(nomeB)
        })
        .map(([correcao, total]) => {
            const cor = padraoCor(correcao)

            return `
            <div class="pill" onclick="atalhoAuxiliar('${correcao}')">
                <span class="pill-a" style="background: ${cor};">${total}</span>
                <span class="pill-b">${correcao.toUpperCase()}</span>
            </div>`
        })

    divPendencias.innerHTML = etiquetas.join('')
}

async function atalhoContagemFluxo() {

    controles.ocorrencias.filtros.prioridade = {
        op: '=', value: 'lauka'
    }

    if (document.querySelector('.tela-ocorrencias'))
        await paginacao()
    else
        await telaOcorrencias()

}

async function atalhoTipo(cod) {

    controles.ocorrencias.filtros.tipo = { op: '=', value: cod }

    if (document.querySelector('.tela-ocorrencias'))
        await paginacao()
    else
        await telaOcorrencias()

}

async function atalhoAuxiliar(correcao) {

    let filtros = {}

    if (correcao !== 'todos') {

        filtros = {
            'snapshots.ultimaCorrecao.*.nome': {
                modo: 'OR',
                origem: 'dropdown',
                regras: [
                    { op: '=', value: correcao }
                ]
            }
        }
    }

    controles.ocorrencias.filtros = filtros

    if (document.querySelector('.tela-ocorrencias'))
        await paginacao()
    else
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
        ? await recuperarDado('clientes', unidade)
        : snapshots?.cliente || {}

    const a = Object
        .entries(anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')`))
        .join('')

    // Campo Unidade;
    controlesCxOpcoes.unidade = {
        base: 'clientes',
        filtros: {
            'app': { op: '=', value: 'AC' }
        },
        retornar: ['nome'],
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
            name="descricao">${descricao || ''}</textarea>`
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

async function formularioCorrecao(idOcorrencia, idCorrecao, novoFluxo = null) {

    overlayAguarde()

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || ''
    const correcao = ocorrencia?.correcoes?.[idCorrecao] || {}
    const estado = ocorrencia?.snapshots?.cliente?.estado || 'N'

    const equipamentos = (
        await Promise.all(
            Object.values(correcao?.equipamentos || {})
                .map(equip => maisLabel({ ...equip, formulario: 'correcao' }))
        )
    ).join('')

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
    const { executor, tecnico, garantia, autorizacao } = correcao

    const linhas = [
        ...(novoFluxo
            ? [{
                elemento: `
                    <div style="${horizontal}; gap: 1rem;" id="novoFluxo" data-aba="${novoFluxo}">
                        <img src="imagens/alerta.png">
                        <span>Múltiplas ocorrências</span>
                    </div>
                    `
            }]
            : []
        ),
        {
            texto: 'Em GARANTIA',
            elemento: `<input name="garantia" type="checkbox" style="width: 2rem; height: 2rem;" ${garantia == 'S' ? 'checked' : ''}>`
        },
        {
            texto: 'Código de autorização',
            elemento: `<textarea name="autorizacao">${autorizacao || ''}</textarea>`
        },
        {
            texto: 'Data Início Execução',
            elemento: `<input name="dtCorrecao" onchange="verificarConflitos()" type="date" value="${correcao?.dtCorrecao || ''}">`
        },
        {
            texto: 'Data Final Execução',
            elemento: `<input name="dtCorrecaoFinal" onchange="verificarConflitos()" type="date" value="${correcao?.dtCorrecaoFinal || ''}">`
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
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/baixar.png" onclick="maisUsuario([undefined], 'executores')">
                <span>Executores</span>
            </div>
            `,
            elemento: '<div class="executores"></div>'
        },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/reagendar.png" onclick="telaAgenda({ flutuante: true, filtros: {estado: '${estado}'} })">
                <img src="imagens/baixar.png" onclick="maisUsuario([undefined], 'tecnicos')">
                <span>Técnicos</span>
            </div>
            `,
            elemento: '<div class="tecnicos"></div>'
        },
        {
            texto: 'Descrição',
            elemento: `<textarea 
                    style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" 
                    name="descricao" 
                    rows="7">${correcao?.descricao || ''}</textarea>`
        },
        {
            elemento: `
            <div style="${vertical}; width: 100%; gap: 5px;">
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" onclick="maisLabel({formulario: 'correcao'})">
                    <span>Peças Usadas na Correção</span>
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

    await maisUsuario(executor, 'executores')
    await maisUsuario(tecnico, 'tecnicos')
    await verificarConflitos()
    await verificarSaldos()

    visibilidadeFotos()

    removerOverlay()

}

async function maisUsuario(usuarios, campo) {

    if (typeof usuarios === 'string' && usuarios)
        usuarios = [usuarios]

    const area = document.querySelector(`.${campo}`)

    if (!area)
        return

    const spans = []

    for (const usuario of (usuarios || [])) {
        const nomeControle = crypto.randomUUID()

        controlesCxOpcoes[nomeControle] = {
            base: 'dados_setores',
            retornar: ['usuario'],
            funcaoAdicional: campo == 'tecnicos'
                ? 'verificarConflitos'
                : null,
            colunas: {
                'Nome': { chave: 'usuario' },
                'Permissão': { chave: 'permissao' },
                'Setor': { chave: 'setor' }
            }
        }

        spans.push(`
            <div style="${horizontal}; gap: 0.5rem;">
                <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="this.parentElement.remove()">
                <span
                    class="campos"
                    ${usuario ? `id="${usuario}"` : ''}
                    name="${nomeControle}"
                    onclick="cxOpcoes('${nomeControle}')">${usuario || 'Selecione'}</span>
            </div>
        `)
    }

    area.insertAdjacentHTML('beforeend', spans.join(''))

}

async function filtrarEquipamentos(select) {
    const lpu = String(select.value).toLowerCase()
    controles.cxOpcoes.filtros ??= {}

    const filtros = Object.fromEntries(
        Object.entries(controles.cxOpcoes.filtros)
            .filter(([chave]) => !chave.includes('lpu'))
    )

    controles.cxOpcoes.filtros = {
        ...filtros,
        [`snapshots.${lpu}.0`]: { op: '!=', value: 0 }
    }

    await paginacao('cxOpcoes')
}

async function maisLabel({ codigo, descricao, quantidade, origem, serie, formulario } = {}) {

    const div = document.getElementById('equipamentos')
    const temporario = crypto.randomUUID()

    const btnExtras = acesso.permissao !== 'cliente'
        ? `<select class="opcoes" onchange="filtrarEquipamentos(this)"><option></option>${LPUS.map(lpu => `<option>${lpu}</option>`).join('')}</select>`
        : null

    controlesCxOpcoes[temporario] = {
        base: 'dados_composicoes',
        retornar: ['descricao'],
        btnExtras,
        funcaoAdicional: ['verificarSaldos'],
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

    const series = (Array.isArray(serie) ? serie : [serie])
        .map(s => `<input name="serie" value="${s || ''}">`)
        .join('')

    const divOrigem = formulario == 'correcao'
        ? `
            <div style="${vertical};">
                <label>Origem</label>
                ${['Kit', 'Ferramentas', 'Parceiro', 'Matriz', 'Compra Região'].map(o => `
                    <div style="${horizontal}; gap: 1rem;">
                        <input onchange="verificarSaldos()" name="origem_${temporario}" data-origem="${o}" type="radio" ${origem == o ? 'checked' : ''}>
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
                    <input id="quantidade" data-codigo="${codigo}" data-anterior="${quantidade || 0}" oninput="multiplicarCampoSerie(this); verificarSaldos()" style="width: 7rem;" class="campos" type="number" value="${quantidade || ''}">
                </div>
                <div style="${vertical};">
                    <label>Nº série</label>
                    <div class="container-series">
                        ${series}
                    </div>
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

    if (div)
        div.insertAdjacentHTML('beforeend', label)
}

function multiplicarCampoSerie(input) {
    const bloco = input.closest('.borda-equipamento')
    const container = bloco.querySelector('.container-series')
    if (!container) return

    const qtdeAtual = Number(input.value) || 0
    const inputs = [...container.querySelectorAll('input')]
    const qtdeInputs = inputs.length

    // adicionar
    if (qtdeAtual > qtdeInputs) {
        for (let i = qtdeInputs; i < qtdeAtual; i++) {
            const novo = document.createElement('input')
            novo.name = 'serie'
            container.appendChild(novo)
        }
    }

    // remover
    if (qtdeAtual < qtdeInputs) {
        for (let i = qtdeInputs; i > qtdeAtual; i--) {
            container.lastElementChild?.remove()
        }
    }
}

async function verificarConflitos() {

    const dtCorrecao = document.querySelector('[name="dtCorrecao"]')?.value
    const dtCorrecaoFinal = document.querySelector('[name="dtCorrecaoFinal"]')?.value

    const alerta = (funcao, tecnico) => `<img src="gifs/alerta.gif" name="alerta" data-tecnico="${tecnico}" onclick="${funcao}">`

    for (const img of [...document.querySelectorAll('[name="alerta"]')])
        img.remove()

    if (!dtCorrecao)
        return

    const inicioNovo = dtCorrecao
    const fimNovo = dtCorrecaoFinal || dtCorrecao

    const tecs = [...document.querySelectorAll('.tecnicos span')]
        .filter(span => span.id)
        .map(async (span) => {

            const tecnico = span.id

            const pesquisa = await pesquisarDB({
                base: 'vw_tecnicos',
                filtros: {
                    ultimaCorrecao: {
                        op: '!=',
                        value: 'SOLUCIONADA'
                    },
                    tecnico: {
                        op: '=',
                        value: tecnico
                    },
                    dtCorrecao: {
                        op: '<=d',
                        value: fimNovo
                    },
                    dtCorrecaoFinal: {
                        op: '>=d',
                        value: inicioNovo
                    }
                }
            })

            const dtCorrecaoMaisAntiga = obterDataMaisAntiga(pesquisa.resultados) // Retorna null para resultados vazios;

            if (dtCorrecaoMaisAntiga) {
                const funcao = `telaAgenda(
                    {
                        flutuante: true,
                        filtros: {
                            tecnico: '${tecnico}',
                            dtCorrecao: '${dtCorrecaoMaisAntiga}'}
                    })`
                span.parentElement.insertAdjacentHTML('beforeend', alerta(funcao, tecnico))
            }

        })

    await Promise.all(tecs)

}

function obterDataMaisAntiga(array) {

    const datasValidas = array
        .map(item => item.dtCorrecao)
        .filter(data => data)

    if (datasValidas.length === 0) return null

    const dataMaisAntiga = datasValidas.reduce((antiga, atual) => {
        return (atual < antiga)
            ? atual
            : antiga
    });

    return dataMaisAntiga
}

function removerAlertas(identificador) {
    removerPopup()
    for (const img of [...document.querySelectorAll(`[name="${identificador}"]`)])
        img.remove()
}

function conflitoAgenda() {

    const tecsConflitos = [...document.querySelectorAll('[name="alerta"]')]
        .map(img => img.dataset.tecnico)

    if (tecsConflitos.length > 0) {
        const concordancia = tecsConflitos.length > 1
            ? 'os técnicos'
            : 'o ténico'

        popup({
            titulo: 'Conflito de agenda',
            botoes: [
                { texto: 'Estou ciente', img: 'concluido', funcao: `removerAlertas('alerta')` }
            ],
            mensagem: `Existem outros agendamentos para ${concordancia} ${tecsConflitos.join(', ')} nessas datas, tem certeza que deseja agendar?`
        })
    }

    return tecsConflitos.length > 0

}

function conflitoKit() {

    const pecasConflito = [...document.querySelectorAll('[name="alerta-saldo"]')]
        .map(img => img.dataset.descricao)

    if (pecasConflito.length > 0) {
        popup({
            titulo: 'Técnico sem saldo',
            botoes: [
                { texto: 'Estou ciente', img: 'concluido', funcao: `removerAlertas('alerta-saldo')` }
            ],
            mensagem: `O técnico não possui saldo de algumas peças, confirmar mesmo assim?`
        })
    }

    return pecasConflito.length > 0

}

async function verificarSaldos() {
    for (const img of [...document.querySelectorAll('[name="alerta-saldo"]')])
        img.remove()

    const tecnicos = [...document.querySelectorAll('.tecnicos span')]
        .filter(span => span.id)
        .map(span => span.id)

    if (!tecnicos.length)
        return

    const tecnicoNum1 = tecnicos[0]

    const pesquisa = await pesquisarDB({
        base: 'vw_tecnicos_saldo',
        filtros: {
            origem: { op: '=', value: 'Kit' },
            tecnico: { op: 'includes', value: tecnicoNum1 }
        }
    })

    const saldoPecas = Object.fromEntries(
        (pesquisa.resultados || []).map(peca => [peca.codigo, peca])
    )

    const divs = [...document.querySelectorAll('[name="equipamentos"]')]

    for (const div of divs) {
        const equip = div.querySelector('span')
        const codigo = equip?.id || ''
        const origem = div.querySelector('input[name^="origem_"]:checked')?.dataset.origem || ''
        const inputQuantidade = div.querySelector('#quantidade')

        const quantidade = Number(inputQuantidade?.value) || 0
        // Se o código for diferente, então desconsidere o saldo anterior;
        const codigoAnterior = inputQuantidade?.dataset?.codigo || 0
        const quantidadeAnterior = codigoAnterior !== codigo
            ? 0
            : Number(inputQuantidade?.dataset.anterior) || 0

        const itemSaldo = saldoPecas[codigo]
        const saldoItem = Number(itemSaldo?.saldo_atual) || 0

        const saldo = saldoItem + quantidadeAnterior
        const saldoDisponivel = saldo - quantidade

        if (origem === 'Kit' && quantidade > 0 && saldoDisponivel < 0) {
            const alerta = `<img src="gifs/alerta.gif" data-descricao="${equip.textContent}" name="alerta-saldo" onclick="verSaldoTecnico('${tecnicoNum1}')">`
            div.insertAdjacentHTML('beforeend', alerta)
        }
    }
}

async function verSaldoTecnico(tecnico) {

    popup({
        elemento: `
        <div class="painel-saldos-flutuante">
            <div id="painel_resumo"></div>
        </div>
        `
    })

    await telaSaldoPecas(tecnico)

}

async function salvarCorrecao(idOcorrencia, idCorrecao = crypto.randomUUID()) {

    overlayAguarde()

    if (conflitoAgenda())
        return

    if (conflitoKit())
        return

    const tipoCorrecao = obter('tipoCorrecao').id
    const dtCorrecao = obter('dtCorrecao').value
    const dtCorrecaoFinal = obter('dtCorrecaoFinal').value

    if (!tipoCorrecao)
        return popup({ mensagem: 'Defina um <b>status</b> para a correção' })

    if (!dtCorrecao)
        return popup({ mensagem: 'Não deixe em branco <b>Data Limite</b>' })

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    if (tipoCorrecao == 'WRuo2' && !ocorrencia.assinatura && acesso.permissao == 'técnico') {
        coletarAssinatura(idOcorrencia)
        return
    }

    const equipamentos = {}
    const fotos = {}
    const input = obter('anexos')
    const anexos = await anexosOcorrencias(input)

    // Fotos;
    const divFotos = document.querySelector('.fotos')
    const imgs = divFotos.querySelectorAll('img') || []

    for (const img of imgs) {
        if (img.dataset && img.dataset.salvo == 'sim') continue
        const foto = await importarAnexos({ foto: img.src })
        fotos[foto[0].link] = foto[0]
    }

    // Técnicos;
    const tecnico = [...document.querySelectorAll('.tecnicos span')]
        .filter(span => span.id)
        .map(span => span.id)

    if (tecnico.length == 0 && Object.keys(equipamentos).length > 0)
        return popup({ mensagem: 'Quando existirem equipamentos, selecione pelo menos 1 Técnico' })

    // Equipamentos
    const divs = [...document.querySelectorAll('[name="equipamentos"]')]

    const emMassa = divs
        .filter(div => div.querySelector('span')?.id)
        .map(async (div) => {

            const equip = div.querySelector('span')
            const { unidade, modelo, descricao, fabricante } = await recuperarDado('dados_composicoes', equip.id)
            const inputQuantidade = div.querySelector('#quantidade')
            const quantidade = Number(inputQuantidade.value)
            const serie = [...div.querySelectorAll('[name="serie"]')]
                .map(input => input.value)
            const origem = div.querySelector('input[name^="origem_"]:checked')?.dataset.origem || ''
            const codigo = equip.id

            equipamentos[codigo] = {
                codigo,
                modelo,
                origem,
                serie,
                descricao,
                fabricante,
                quantidade,
                unidade
            }

        })

    await Promise.all(emMassa)

    // Executores;
    const executor = [...document.querySelectorAll('.executores span')]
        .filter(span => span.id)
        .map(span => span.id)

    if (executor.length == 0)
        return popup({ mensagem: 'Selecione pelo menos 1 executor' })

    const garantia = obter('garantia').checked ? 'S' : 'N'
    const correcao = ocorrencia?.correcoes?.[idCorrecao] || {}
    const atualizado = {
        ...correcao,
        garantia,
        autorizacao: obter('autorizacao').value || '',
        fotos: {
            ...fotos,
            ...correcao?.fotos,
        },
        equipamentos,
        data: new Date().toLocaleString(),
        anexos: {
            ...anexos,
            ...correcao?.anexos
        },
        dtCorrecao,
        dtCorrecaoFinal,
        tecnico,
        executor,
        usuario: correcao.usuario || acesso.usuario,
        tipoCorrecao,
        descricao: obter('descricao').value
    }

    // Novo fluxo, se existir;
    const novoFluxo = document.getElementById('novoFluxo')
    if (novoFluxo)
        atualizado.aba = novoFluxo.dataset.aba == 'S'
            ? crypto.randomUUID()
            : novoFluxo.dataset.aba

    await enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, atualizado)
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
        data_registro: new Date().toLocaleString('pt-BR'),
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
        const serie = [...div.querySelectorAll('[name="serie"]')]
            .map(input => input.value)

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

            removerTodosPopups()

            const painelHistorico = document.querySelector('.painel-historico')
            if (painelHistorico)
                await telaOcorrencias()


        } catch (err) {
            popup({ mensagem: err.mensagem || 'Falha ao salvar a ocorrência, fale com o Suporte!' })
        }
    }

}

async function anexosOcorrencias(input) {
    const anexos = await importarAnexos({ input }) || []
    const objeto = {}
    anexos.forEach(anexo => {
        const idAnexo = crypto.randomUUID()
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