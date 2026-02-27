let respCorrecao = null
const autE = ['adm', 'gerente', 'diretoria']

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

async function blocoAuxiliarFotos(fotos) {

    if (fotos) {

        const imagens = Object.entries(fotos)
            .map(([link,]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        const painel = `
            <div class="fotos">${imagens}</div>
            <div class="capturar" onclick="blocoAuxiliarFotos()">
                <img src="imagens/camera.png">
                <span>Abrir Câmera</span>
            </div>
        `
        return painel

    } else {

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
    const foto = `<img name="foto" id="${idFoto}" src="${canvas.toDataURL('image/png')}" class="foto" onclick="ampliarImagem(this, '${idFoto}')">`
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
        const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
        delete ocorrencia.correcoes[idCorrecao]

        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`)
        await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
    } else {
        await deletar(`dados_ocorrencias/${idOcorrencia}`)
        await deletarDB('dados_ocorrencias', idOcorrencia)
    }

    removerOverlay()

}

function uCorrecao(correcoes) {
    let maisRecente = null
    let tipo = null
    let dtBase = null
    let solucionado = false

    for (const { data, dtCorrecao, tipoCorrecao } of Object.values(correcoes)) {

        if (!data)
            continue

        const [d, h] = data.split(', ')
        const [dia, mes, ano] = d.split('/')
        const dateObj = new Date(`${ano}-${mes}-${dia}T${h}`)

        if (tipoCorrecao == 'WRuo2') {
            solucionado = true
            maisRecente = dateObj
            tipo = tipoCorrecao
            dtBase = dtCorrecao
            continue
        }

        if (!maisRecente || dateObj > maisRecente) {
            maisRecente = dateObj
            tipo = tipoCorrecao
            dtBase = dtCorrecao

        }
    }

    let dias = 0
    if (dtBase && !solucionado) {
        const dt = new Date(`${dtBase}T00:00:00`)
        const diff = dt.getTime() - Date.now()
        dias = Math.trunc(diff / (1000 * 60 * 60 * 24))
    }

    return { tipo, dias, dtCorrecao: dtBase }
}

async function carregarCorrecoes(ocorrencia) {

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
    const dadosCorrecao = ocorrencia?.correcoes || {}

    let divsCorrecoes = ''
    const aTec = acesso.permissao === 'técnico'

    const tabEquipamentos = (linhas) => {

        const tabela = `
            <div style="${vertical}">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            ${['Quantidade', 'Unidade', 'Descrição'].map(th => `<th>${th}</th>`).join('')}
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>`

        return linhas
            ? tabela
            : ''
    }

    for (const [idCorrecao, correcao] of Object.entries(dadosCorrecao).reverse()) {

        const { equipamentos } = correcao

        const respondida = Object
            .values(dadosCorrecao)
            .some(c => c.resposta == idCorrecao)

        if (aTec) {
            // Só mostrar correções criadas para ele;
            if (correcao.executor !== acesso.usuario)
                continue

            // Se já foi respondida, ignorar;
            if (respondida)
                continue
        }
   
        const { nome } = await recuperarDado('correcoes', correcao?.tipoCorrecao) || 'Não analisada'
        const estilo = nome == 'Solucionada'
            ? 'fin'
            : nome == 'Não analisada'
                ? 'na'
                : 'and'

        const imagens = Object.entries(correcao?.fotos || {})
            .map(([link,]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        const edicao = (correcao.usuario == acesso.usuario || autE.includes(acesso.permissao))
            ? `
                <button onclick="formularioCorrecao('${idOcorrencia}', '${idCorrecao}')">Editar</button>
                <button style="background-color: #B12425;" onclick="confirmarExclusao('${idOcorrencia}', '${idCorrecao}')">Excluir</button>
            `
            : ''

        // Se já foi respondida, não mostrar;
        const resposta = (!respondida && correcao.executor == acesso.usuario)
            ? `<button style="background-color: #3e8bff;" onclick="respCorrecao = '${idCorrecao}'; formularioCorrecao('${idOcorrencia}')">Responder</button>`
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

        const imagensExistentes = imagens !== ''
            ? `<div class="fotos" style="display: flex;">${imagens}</div>`
            : '<img src="imagens/img.png" style="width: 4rem;">'

        const linhasEquipamentos = Object.values(equipamentos || {})
            .map(e => {
                const { unidade, descricao, quantidade } = e || {}
                const tr = `
                    <tr>
                        <td>${quantidade || 0}</td>
                        <td>${unidade || 'UN'}</td>
                        <td>${descricao || ''}</td>
                    </tr>`
                return tr
            })
            .join('')

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
                    ${modelo('Executor', `<span>${correcao.executor}</span>`)}
                    ${modelo('Correção', `<span class="${estilo}">${nome}</span>`)}
                    ${modelo('Descrição', `<div style="white-space: pre-wrap;">${correcao.descricao}</div>`)}
                    ${modelo('Criado em', `<span>${correcao?.data || ''}</span>`)}
                    ${modelo('Equipamentos', tabEquipamentos(linhasEquipamentos))}

                </div>

                <div style="${horizontal}">

                    <div style="${horizontal}; gap: 2px; padding: 0.5rem;"> 
                        ${resposta}
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

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/dtCorrecao`, novaData.value)
    enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/datas_agendadas`, correcao.datas_agendadas)

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

    const btnExtras = `
    <div style="${vertical};" class="painel-filtros">
        <div id="filtros1" class="filtros"></div>
        <div id="filtros2" class="filtros"></div>
    </div>
    `
    const tabela = modTab({
        btnExtras,
        alinPag: vertical,
        base: 'dados_ocorrencias',
        pag: 'ocorrencias',
        body: 'bodyOcorrencias',
        criarLinha: 'criarLinhaOcorrencia'
    })

    const acumulado = `
        <div class="tela-ocorrencias">
            ${tabela}
        </div>`

    tela.innerHTML = acumulado


    // Filtros especiais para Técnico e Cliente;
    if (acesso.permissao == 'técnico') {

        controles.ocorrencias.filtros = {
            'snapshots.pendenteResposta': { op: 'includes', value: acesso.usuario },
            'correcoes.*.executor': { op: '=', value: acesso.usuario },
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

async function criarLinhaOcorrencia(ocorrencia) {

    const { id, anexos, usuario, snapshots } = ocorrencia
    const { sistema, prioridade, tipo, cliente, empresa } = snapshots || {}

    const divCorrecoes = await carregarCorrecoes(ocorrencia)

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

    const modeloCampos = (valor1, elemento) => {
        if (!elemento)
            return ''

        return `
        <div style="${horizontal}; width: 100%; gap: 0.5rem;">
            <label style="font-weight: bold; width: 30%; text-align: right;">${valor1}</label>
            <div style="text-align: justify; width: 70%; text-align: left;">${String(elemento).replace('\n', '<br>')}</div>
        </div>`
    }

    const partes = `
        <div class="div-linha">
            <div class="bloco-linha">
                <div style="${horizontal}; gap: 5px; padding: 5px; width: 100%;">
                    <span class="etiqueta-chamado">${id}</span>
                    ${btnEditar}
                    ${btnExclusao}
                    <img src="imagens/pdf.png" style="width: 2.5rem;" onclick="telaOS('${id}')">

                    <div style="border: solid 1px ${corAssinatura}; border-radius: 3px; padding: 2px; background-color: ${corAssinatura}52;" 
                    onclick="coletarAssinatura('${id}')">
                        <img src="imagens/assinatura.png" style="width: 1.5rem;">
                    </div>
                </div>
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

                <div id="anexos" style="${vertical};">
                    ${divAnexos}
                </div>
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

async function criarPesquisas() {

    const divF1 = document.querySelector('#filtros1')
    const divF2 = document.querySelector('#filtros2')

    const camposLivres = {
        'Chamado': { path: 'id' },
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
                style="width: 100%;" value="${valor}">

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
    }

    const filtros = []

    for (let [titulo, conf] of Object.entries(camposFechados)) {

        const { path } = conf

        const contagem = (titulo == 'Executor' && acesso.permissao == 'técnico')
            ? { [acesso.usuario]: {} }
            : {
                '': {},
                ...await contarPorCampo({ base: 'dados_ocorrencias', path })
            }

        const pesqAtiva = controles?.ocorrencias?.filtros?.[path]?.value

        const opcoes = Object.keys(contagem)
            .sort((a, b) => a.localeCompare(b))
            .map(o => `<option ${pesqAtiva == o ? 'selected' : ''}>${o}</option>`)

        filtros.push(`
            <div style="${vertical}; gap: 2px;">
                <span>${titulo}</span>
                <select onchange="pesquisarOcorrencias('${path}', this.value)">
                    ${opcoes}
                </select>
            </div>`
        )

    }

    // Filtro de atrasados;
    filtros.push(`
            <div style="${vertical}; gap: 2px;">
                <span>Atrasados</span>
                <select onchange="filtrarAtrasados(this)">
                    ${['', 'Sim', 'Não'].map(o => `<option>${o}</option>`).join('')}
                </select>
            </div>
        `)

    divF2.insertAdjacentHTML('beforeend', filtros.join(''))
}

async function pesquisarOcorrencias(path, valor) {

    if (!valor) {
        delete controles.ocorrencias.filtros[path]

    } else {
        controles.ocorrencias.filtros[path] = valor
            ? { op: 'includes', value: valor }
            : {}
    }

    await paginacao()

}

async function filtrarAtrasados(input) {

    const ativo = input.value != ''

    const novosFiltros = {
        'correcoes.*.tipoCorrecao': ativo
            ? { op: '!=', value: 'WRuo2' }
            : null,

        'correcoes.*.dtCorrecao': ativo
            ? {
                op: input.value == 'Sim' ? '<d' : '>=d',
                value: Date.now()
            }
            : null
    }

    controles.ocorrencias.filtros = {
        ...controles.ocorrencias.filtros,
        ...novosFiltros
    }

    await paginacao()
}


function ocultarParaTecs(correcoes = {}) {

    if (acesso.permissao !== 'técnico') return false

    if (Object.values(correcoes).some(c => c.tipoCorrecao === 'WRuo2'))
        return true

    let tudoRespondido = true
    let participou = false

    for (const [id, c] of Object.entries(correcoes)) {
        if (c.executor !== acesso.usuario) continue

        participou = true

        const respondida = Object
            .values(correcoes)
            .some(x => x.resposta === id)

        if (!respondida) {
            tudoRespondido = false
            break
        }
    }

    return participou && tudoRespondido
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
            'snapshots.pendenteResposta': { op: 'includes', value: acesso.usuario },
            'correcoes.*.tipoCorrecao': { op: '!=', value: 'WRuo2' },
            'correcoes.*.executor': { op: '=', value: acesso.usuario }
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

    controles.ocorrencias.filtros['snapshots.ultimaCorrecao'] =
        correcao === 'todos'
            ? {}
            : { op: '=', value: correcao }

    await telaOcorrencias()

}

async function formularioOcorrencia(idOcorrencia) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const { unidade = unidadeOrc, snapshots, anexos, fotos, descricao } = ocorrencia
    const { sistema, tipo, prioridade } = snapshots || {}

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
        { elemento: await blocoAuxiliarFotos(fotos || {}, true) }
    ]

    const botoes = [
        { img: 'concluido', texto: 'Salvar', funcao: idOcorrencia ? `salvarOcorrencia('${idOcorrencia}')` : 'salvarOcorrencia()' },
        { img: 'atualizar', texto: 'Atualizar', funcao: `atualizarGCS()` },
    ]

    const titulo = idOcorrencia ? 'Editar Ocorrência' : 'Criar Ocorrência'

    popup({ linhas, botoes, titulo })

    visibilidadeFotos()

    // Limpeza da variável para novos;
    unidadeOrc = null

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

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || ''
    const correcao = ocorrencia?.correcoes?.[idCorrecao] || {}

    const equipamentos = (
        await Promise.all(
            Object.values(correcao?.equipamentos || {})
                .map(equip => maisLabel(equip))
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

    controlesCxOpcoes.tipoCorrecao = {
        base: 'correcoes',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' }
        }
    }

    const { nome } = await recuperarDado('correcoes', correcao?.tipoCorrecao) || {}
    const executor = correcao?.executor
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
        { texto: 'Descrição', elemento: `<textarea style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" name="descricao" rows="7" class="campos">${correcao?.descricao || ''}</textarea>` },
        {
            elemento: `
            <div style="${vertical}; width: 100%; gap: 5px;">
                <div style="${horizontal}; gap: 1rem;">
                    <span>Peças Usadas na Correção</span>
                    <img src="imagens/baixar.png" onclick="maisLabel()">
                </div>
                <div style="${vertical}; width: 100%; gap: 2px;" id="equipamentos">
                    ${equipamentos}
                </div>
            </div>
            `
        },
        { elemento: `${await blocoAuxiliarFotos(correcao?.fotos || {}, true)}` },
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
        },
        { img: 'atualizar', texto: 'Atualizar', funcao: `atualizarGCS()` },
    ]

    popup({ linhas, botoes, titulo: 'Gerenciar Correção', autoDestruicao: ['executor', 'tipoCorrecao'] })

    visibilidadeFotos()

}

async function maisLabel({ codigo, descricao, quantidade } = {}) {

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

    const label = `
        <div class="borda-equipamento">
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
            <div name="equipamentos" style="${horizontal}; align-items: start; gap: 1rem;">
                <div style="${vertical};">
                    <label>Quantidade</label>
                    <input style="width: 7rem;" class="campos" type="number" value="${quantidade || ''}">
                </div>
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
    ocorrencia.correcoes[idCorrecao].equipamentos ??= {}

    const tipoCorrecao = obter('tipoCorrecao').id
    const dtCorrecao = obter('dtCorrecao').value

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

        const quantidade = Number(div.querySelector('input').value)

        ocorrencia.correcoes[idCorrecao].equipamentos[equip.id] = {
            codigo: equip.id,
            modelo,
            descricao,
            fabricante,
            quantidade,
            unidade
        }
    }

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, ocorrencia.correcoes[idCorrecao])
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

    if (!ocorrencia.fotos)
        ocorrencia.fotos = {}

    const imgs = document.querySelectorAll('.fotos img')

    if (imgs.length > 0) {
        for (const img of imgs) {
            if (img.dataset?.salvo === 'sim') continue
            const foto = await importarAnexos({ foto: img.src })
            const dados = foto[0]
            ocorrencia.fotos[dados.link] = dados
        }
    }

    const salvarLocal = async (id, dados) => {
        await inserirDados({ [id]: dados }, 'dados_ocorrencias')
    }

    if (idOcorrencia) {
        Object.assign(ocorrencia, novo)

        await salvarLocal(idOcorrencia, ocorrencia)
        enviar(`dados_ocorrencias/${idOcorrencia}`, ocorrencia)
        removerPopup()

    } else {

        try {
            const resposta = await enviar('dados_ocorrencias/0000', novo)

            if (resposta.mensagem) {
                popup({ mensagem: resposta.mensagem })
            } else {
                await salvarLocal(resposta.idOcorrencia, { ...novo, id: resposta.idOcorrencia })
            }

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

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (idCorrecao) { // Se correção
        delete ocorrencia.correcoes[idCorrecao].anexos[idAnexo]
        deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/anexos/${idAnexo}`)
    } else { // Se ocorrência
        delete ocorrencia.anexos[idAnexo]
        deletar(`dados_ocorrencias/${idOcorrencia}/anexos/${idAnexo}`)
    }

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    img.parentElement.remove()
    removerOverlay()

}