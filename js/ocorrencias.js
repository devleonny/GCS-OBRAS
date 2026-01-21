let opVal = {
    criador: new Set(),
    tipo: new Set(),
    sistema: new Set(),
    prioridade: new Set(),
    ultima_correcao: new Set(),
    executor: new Set(),
    reagendado: new Set(),
    atrasado: new Set(),
}

let respCorrecao = null
const autE = ['adm', 'gerente', 'diretoria']
let filtrosAtivos = {}

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
            .map(([link, foto]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
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

        delete dados_ocorrencias[idOcorrencia].correcoes[idCorrecao]
        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`)
        await inserirDados({ [idOcorrencia]: dados_ocorrencias[idOcorrencia] }, 'dados_ocorrencias')
    } else {

        await deletar(`dados_ocorrencias/${idOcorrencia}`)
        await deletarDB('dados_ocorrencias', idOcorrencia)
    }

    await telaOcorrencias()

    removerOverlay()

}

function criarLinhaOcorrencia(idOcorrencia, ocorrencia) {

    const divCorrecoes = carregarCorrecoes(idOcorrencia)

    const btnExclusao = autE.includes(acesso.permissao)
        ? botaoImg('fechar', `confirmarExclusao('${idOcorrencia}')`)
        : ''
    const btnEditar = autE.includes(acesso.permissao)
        ? botaoImg('lapis', `formularioOcorrencia('${idOcorrencia}')`)
        : ''

    const corAssinatura = ocorrencia.assinatura ? '#008000' : '#d30000'
    const cliente = dados_clientes?.[ocorrencia?.unidade] || {}
    const tipo = tipos?.[ocorrencia?.tipo]?.nome || 'Em branco'
    const sistema = sistemas?.[ocorrencia?.sistema]?.nome || 'Em branco'
    const prioridade = prioridades?.[ocorrencia?.prioridade]?.nome || 'Em branco'
    const criador = ocorrencia?.usuario || 'Em branco'
    const descricao = ocorrencia?.descricao || 'Em branco'
    const unidade = cliente?.nome || 'Em branco'
    const cidade = cliente?.cidade || 'Em branco'
    const empresa = empresas[cliente?.empresa]?.nome || 'Em branco'

    const modeloCampos = (valor1, elemento) => `
        <div style="${horizontal}; width: 100%; gap: 0.5rem;">
            <label style="font-weight: bold; width: 30%; text-align: right;">${valor1}</label>
            <div style="text-align: justify; width: 70%; text-align: left;">${elemento.replace('\n', '<br>')}</div>
        </div>`

    const partes = `
        <div class="div-linha">
            <div class="bloco-linha">
                <div style="${horizontal}; gap: 5px; padding: 5px; width: 100%;">
                    <span class="etiqueta-chamado">${idOcorrencia}</span>
                    ${btnEditar}
                    ${btnExclusao}
                    <img src="imagens/pdf.png" style="width: 2.5rem;" onclick="telaOS('${idOcorrencia}')">

                    <div style="border: solid 1px ${corAssinatura}; border-radius: 3px; padding: 2px; background-color: ${corAssinatura}52;" onclick="coletarAssinatura('${idOcorrencia}')">
                        <img src="imagens/assinatura.png" style="width: 1.5rem;">
                    </div>
                </div>
                ${modeloCampos('Unidade', unidade)}
                ${modeloCampos('Endereço', cliente?.bairro || '...')}
                ${modeloCampos('Cidade', cidade)}
                ${modeloCampos('Descrição', descricao)}
                ${modeloCampos('Criado por', criador)}
                ${modeloCampos('Data Registro', ocorrencia?.dataRegistro || '')}
                ${modeloCampos('Empresa', empresa)}
                ${modeloCampos('Tipo', tipo)}
                ${modeloCampos('Sistema', sistema)}
                ${modeloCampos('Prioridade', prioridade)}
            </div>

            <div class="bloco-linha">
                ${divCorrecoes}
            </div>
        </div>`

    return partes

}

function uCorrecao(correcoes) {
    let maisRecente = null
    let tipo = null
    let dtBase = null
    let solucionado = false

    for (const { data, dtCorrecao, tipoCorrecao } of Object.values(correcoes)) {

        if (!data) continue

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

    return { tipo, dias }
}

function carregarCorrecoes(idOcorrencia) {

    const modelo = (valor1, valor2) => `
        <div style="${horizontal}; gap: 1rem; margin-bottom: 5px; width: 100%;">
            <label style="width: 30%; text-align: right;"><b>${valor1}</b></label>
            <div style="width: 70%; text-align: left;">${valor2}</div>
        </div>`

    const ocorrencia = dados_ocorrencias?.[idOcorrencia]
    const dadosCorrecao = ocorrencia?.correcoes || {}

    let divsCorrecoes = ''
    const aTec = acesso.permissao === 'técnico'

    for (const [idCorrecao, correcao] of Object.entries(dadosCorrecao).reverse()) {

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

        const status = correcoes?.[correcao?.tipoCorrecao]?.nome || 'Não analisada'
        const estilo = status == 'Solucionada'
            ? 'fin'
            : status == 'Não analisada'
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
                    ${modelo('Correção', `<span class="${estilo}">${status}</span>`)}
                    ${modelo('Descrição', `<div style="white-space: pre-wrap;">${correcao.descricao}</div>`)}
                    ${modelo('Criado em', `<span>${correcao?.data || 'S/D'}</span>`)}
                </div>

                <div style="${horizontal}">

                    <div style="${horizontal}; gap: 2px; padding: 0.5rem;"> 
                        ${resposta}
                        ${edicao}
                    </div>

                    <div style="${vertical}; padding: 0.5rem;">
                        ${imagens !== ''
                ? `<div class="fotos" style="display: flex;">${imagens}</div>`
                : '<img src="imagens/img.png" style="width: 4rem;">'}
                        <div id="anexos" style="${vertical};">
                            ${anexos}
                        </div>
                    </div>
                </div>
            </div>`
    }

    const acumulado = `
        ${botao('Incluir Correção', `formularioCorrecao('${idOcorrencia}')`, '#e47a00')}
        <div class="detalhamento-correcoes">
            ${divsCorrecoes}
        </div>
    `

    return acumulado

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

    const ocorrencia = dados_ocorrencias[idOcorrencia]
    const correcao = ocorrencia.correcoes[idCorrecao]
    correcao.datas_agendadas ??= []
    correcao.datas_agendadas.push(correcao.dtCorrecao)
    correcao.dtCorrecao = novaData.value

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/dtCorrecao`, novaData.value)
    enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}/datas_agendadas`, correcao.datas_agendadas)

    removerPopup()
    await telaOcorrencias()

}

async function filtrarPorCampo(campo, valor) {

    if (!valor || !valor.trim()) {
        delete filtrosAtivos[campo]
    } else {
        filtrosAtivos[campo] = valor.trim()
    }

    localStorage.setItem('filtrosAtivos', JSON.stringify(filtrosAtivos))
    renderizarPagina(1)
}

function passaFiltros(idOcorrencia, ocorrencia, filtros) {

    const { usuario, tipo, prioridade, sistema } = ocorrencia

    if (ocultarParaTecs(ocorrencia.correcoes || {})) return false

    
    const oCorrecoes = Object.values(ocorrencia.correcoes || {})
    const uc = uCorrecao(oCorrecoes)
    const executores = oCorrecoes.map(c => c.executor)
    oCorrecoes.forEach(c => {
        opVal.executor.add(c.executor || 'Em branco')
    })

    const reagendado = oCorrecoes
        .some(c => c.datas_agendadas)

    const nUltimaCorrecao = correcoes?.[uc.tipo]?.nome || 'Não analisada'
    const nTipo = tipos?.[tipo]?.nome || 'Em branco'
    const nSistema = sistemas?.[sistema]?.nome || 'Em branco'
    const nPrioridade = prioridades?.[prioridade]?.nome || 'Em branco'
    const nReagendado = reagendado ? 'Sim' : 'Não'
    const nAtrasado = uc?.dias < 0 ? 'Sim' : 'Não'

    opVal.criador.add(usuario)
    opVal.tipo.add(nTipo)
    opVal.sistema.add(nSistema)
    opVal.prioridade.add(nPrioridade)
    opVal.ultima_correcao.add(nUltimaCorrecao)
    opVal.reagendado.add(nReagendado)
    opVal.atrasado.add(nAtrasado)

    for (const [campo, termo] of Object.entries(filtros)) {
        if (!termo) continue

        let valor

        switch (campo) {
            case 'criador': valor = usuario; break
            case 'tipo': valor = nTipo; break
            case 'sistema': valor = nSistema; break
            case 'prioridade': valor = nPrioridade; break
            case 'ultima_correcao': valor = nUltimaCorrecao; break
            case 'reagendado': valor = nReagendado; break
            case 'atrasado': valor = nAtrasado; break
            case 'executor': valor = executores; break

            case 'chamado': valor = idOcorrencia; break
            case 'cidade': valor = dados_clientes?.[ocorrencia.unidade]?.cidade; break
            case 'unidade': valor = dados_clientes?.[ocorrencia.unidade]?.nome; break
            case 'descricao': valor = ocorrencia.descricao; break
            case 'empresa':
                const cli = dados_clientes?.[ocorrencia.unidade]
                valor = empresas?.[cli?.empresa]?.nome
                break
            default:
                valor = ocorrencia[campo]
        }

        if (!valor) return false

        if (Array.isArray(valor)) {
            if (!valor.some(v => v?.toString().toLowerCase().includes(termo.toLowerCase())))
                return false
        } else {

            if (campo == 'ultima_correcao' && (valor !== termo))
                return false

            if (!valor.toString().toLowerCase().includes(termo.toLowerCase()))
                return false
        }
    }

    return true
}

async function limparFiltros() {
    filtrosAtivos = {}
    filtrarPorCampo()
    criarPesquisas()
}

function parseDataBR(data) {
    if (!data) return 0

    const [d, t] = data.split(', ')
    const [dia, mes, ano] = d.split('/')
    return new Date(`${ano}-${mes}-${dia}T${t || '00:00:00'}`).getTime()
}

async function renderizarPagina(pagina) {

    const base = Object
        .entries(dados_ocorrencias)
        .filter(([id, o]) => passaFiltros(id, o, filtrosAtivos))
        .sort(([, a], [, b]) =>
            parseDataBR(b.dataRegistro) - parseDataBR(a.dataRegistro)
        )

    const totalPaginas = Math.max(
        1,
        Math.ceil(base.length / limitePorPagina)
    )

    paginaAtual = Math.min(Math.max(pagina, 1), totalPaginas)

    const inicio = (paginaAtual - 1) * limitePorPagina
    const fim = inicio + limitePorPagina

    const fatia = base.slice(inicio, fim)

    const tabela = document.querySelector('.tabela1')
    tabela.innerHTML = ''
    listas = {}

    const contador = document.getElementById('contador')
    if (contador) contador.textContent = base.length

    if (fatia.length === 0) {
        tabela.innerHTML = `
            <div onclick="limparFiltros()" class="sem-resultados">
                <img src="gifs/offline.gif">
                •
                <span>Sem resultados</span> 
                •
                <span>Limpar</span>
            </div>`

        renderizarPaginacao(0)
        return
    }

    // render HTML somente do que passou
    for (const [id, ocorrencia] of fatia) {
        const html = criarLinhaOcorrencia(id, ocorrencia)
        if (html) tabela.insertAdjacentHTML('beforeend', html)
    }

    // popular selects (como antes)
    for (const [, ocorrencia] of base) {
        const cliente = dados_clientes?.[ocorrencia.unidade] || {}
        const empresa = empresas?.[cliente.empresa]?.nome

        const map = {
            criador: ocorrencia.usuario,
            tipo: tipos?.[ocorrencia.tipo]?.nome,
            sistema: sistemas?.[ocorrencia.sistema]?.nome,
            prioridade: prioridades?.[ocorrencia.prioridade]?.nome,
            empresa
        }

        for (const [k, v] of Object.entries(map)) {
            if (!v) continue
            (listas[k] ??= new Set()).add(v)
        }
    }

    renderizarPaginacao(base.length)
}

function renderizarPaginacao(total) {

    const totalPaginas = Math.ceil(total / limitePorPagina)

    document.querySelector('.paginacao-ocorrencias').innerHTML =
        total == 0
            ? ''
            : `
                <div style="${vertical}; align-items: center; gap: 3px;">
                    <div style="${horizontal}; gap: 0.5rem;">
                        <img src="imagens/esq.png" onclick="renderizarPagina(${paginaAtual - 1})">
                        <img src="imagens/dir.png" onclick="renderizarPagina(${paginaAtual + 1})">
                    </div>
                    <span style="white-space: nowrap;">${paginaAtual} de ${totalPaginas}</span>
                </div>`

}

async function telaOcorrencias() {

    if (app == 'GCS') return telaInicial()

    mostrarMenus(false)

    filtrosAtivos = JSON.parse(localStorage.getItem('filtrosAtivos')) || {}

    empresas = await recuperarDados('empresas')
    sistemas = await recuperarDados('sistemas')
    tipos = await recuperarDados('tipos')
    prioridades = await recuperarDados('prioridades')
    correcoes = await recuperarDados('correcoes')
    dados_clientes = await recuperarDados('dados_clientes')
    dados_ocorrencias = await recuperarDados('dados_ocorrencias')

    const empresaAtiva = empresas[acesso?.empresa]?.nome || 'Desatualizado'
    titulo.innerHTML = empresaAtiva

    const acumulado = `
        <div class="tela-ocorrencias">
            <div class="painelBotoes">
                <div class="topo-ocorrencias">
                    <div style="${vertical};">
                        <div class="paginacao-ocorrencias"></div>
                        <span id="contador"></span>
                    </div>
                    <div class="filtros"></div>
                </div>
            </div>

            <div class="tabela1" style="height: max-content; max-height: 65vh;"></div>

            <div class="rodape-tabela"></div>
        </div>
    `

    telaInterna.innerHTML = acumulado

    await renderizarPagina(1)

    auxPendencias()
    criarPesquisas()

}

function criarPesquisas() {

    const divFiltros = document.querySelector('.filtros')

    const modeloPesquisa = (campo) => `
        <div class="pesquisa">
            <input
                id="${campo}"
                value="${filtrosAtivos?.[campo] || ''}"
                onkeydown="if (event.key === 'Enter') filtrarPorCampo('${campo}', this.value)"
                placeholder="${inicialMaiuscula(campo)}"
                style="width: 100%;">
            <img src="imagens/pesquisar4.png">
        </div>`

    const camposLivres = ['chamado', 'cidade', 'descricao', 'unidade']

    for (const campo of camposLivres) {

        const pesqAtiva = document.getElementById(campo)
        if (pesqAtiva) {
            pesqAtiva.value = filtrosAtivos[campo] || ''
            continue
        }

        divFiltros.insertAdjacentHTML('beforeend', modeloPesquisa(campo))

    }

    for (let [campo, opcoes] of Object.entries(opVal)) {

        opcoes = [...opcoes].sort((a, b) => a.localeCompare(b))

        const existente = document.getElementById(`select_${campo}`)
        const ops = ['', ...opcoes].map(op => `<option ${op == filtrosAtivos?.[campo] ? 'selected' : ''}>${op}</option>`).join('')
        const filtro = `
            <div id="select_${campo}" style="${vertical}; gap: 2px;">
                <span>${inicialMaiuscula(campo)}</span>
                <select onchange="filtrarPorCampo('${campo}', this.value)">${ops}</select>
            </div>`

        if (existente) {
            existente.querySelector('select').innerHTML = ops
            continue
        }

        divFiltros.insertAdjacentHTML('beforeend', filtro)

    }
}

async function atalho(uc) {

    filtrosAtivos = {}
    filtrosAtivos.ultima_correcao = uc == 'Todos' ? '' : uc
    localStorage.setItem('filtrosAtivos', JSON.stringify(filtrosAtivos))

    await telaOcorrencias()
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


function auxPendencias() {

    const contadores = { Todos: 0 }

    for (const ocorrencia of Object.values(dados_ocorrencias)) {

        const oCorrecoes = ocorrencia.correcoes || {}
        if (ocultarParaTecs(oCorrecoes)) continue


        const uc = uCorrecao(oCorrecoes)
        const nome = correcoes?.[uc.tipo]?.nome || 'Não analisada'

        contadores[nome] ??= 0
        contadores[nome]++
        contadores.Todos++
    }

    const divPendencias = document.querySelector('.painel-pendencias')
    const ordemFinal = ['Solucionada', 'Todos']

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
                    : correcao === 'Todos'
                        ? '#004cff'
                        : '#b12425'

            return `
            <div class="pill" onclick="atalho('${correcao}')">
                <span class="pill-a" style="background: ${cor};">${total}</span>
                <span class="pill-b">${correcao}</span>
            </div>`
        })
        .join('')

    divPendencias.innerHTML = etiquetas

}

async function atualizarOcorrencias(resetar = false) {

    if (emAtualizacao) return

    if (!tela) {
        await telaPrincipal()
        await atualizarOcorrencias()
        return
    }

    mostrarMenus(true)

    emAtualizacao = true
    sincronizarApp()
    const status = { total: 10, atual: 1 }

    sincronizarApp(status)

    status.atual++

    const basesAuxiliares = [
        'dados_setores',
        'empresas',
        'dados_composicoes',
        'dados_clientes',
        'dados_ocorrencias',
        'sistemas',
        'prioridades',
        'correcoes',
        'tipos'
    ]

    const bCli = ['dados_clientes', 'dados_ocorrencias']

    for (const base of basesAuxiliares) {

        sincronizarApp(status)

        const filtro = (bCli.includes(base) && acesso.permissao == 'cliente')
            ? { empresa: acesso.empresa }
            : (base == 'dados_ocorrencias' && acesso.permissao == 'técnico')
                ? { executor: acesso.usuario, tipoCorrecao: '!WRuo2' } // Diferente de Solucionado;
                : {}

        await sincronizarDados({ base, filtro, resetar })
        status.atual++

        // A tabela é a primeira: atualiza os dados da empresa atual antes da tabela de clientes;
        if (base == 'dados_setores') {

            acesso = await recuperarDado('dados_setores', acesso.usuario)
            localStorage.setItem('acesso', JSON.stringify(acesso))

        }

    }

    sincronizarApp({ remover: true })

    emAtualizacao = false

    dados_setores = await recuperarDados('dados_setores')
    empresas = await recuperarDados('empresas')
    dados_composicoes = await recuperarDados('dados_composicoes')
    dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    dados_clientes = await recuperarDados('dados_clientes')
    sistemas = await recuperarDados('sistemas')
    prioridades = await recuperarDados('prioridades')
    correcoes = await recuperarDados('correcoes')
    tipos = await recuperarDados('tipos')

    if (app == 'GCS') return

    const tOcorrencias = document.querySelector('.tela-ocorrencias')
    if (tOcorrencias) {
        await telaOcorrencias()
    }

    carregarMenus()
    await criarElementosIniciais()
    auxPendencias() // Atualizar os tópicos do menu lateral;
}

function sincronizarApp({ atual, total, remover } = {}) {

    const progresso = document.querySelector('.progresso')

    if (remover) {

        setTimeout(async () => {
            const loader = document.querySelector('.circular-loader')
            if (loader) loader.remove()
            return
        }, 1000)

        return removerOverlay()

    } else if (atual) {

        if (!progresso) return overlayAguarde()

        const circumference = 2 * Math.PI * 50;
        const percent = (atual / total) * 100;
        const offset = circumference - (circumference * percent / 100);
        progressCircle.style.strokeDasharray = circumference;
        progressCircle.style.strokeDashoffset = offset;
        percentageText.textContent = `${percent.toFixed(0)}%`;

        return

    } else {

        const carregamentoHTML = `
            <div class="circular-loader">
                <svg>
                    <circle class="bg" cx="60" cy="60" r="50"></circle>
                    <circle class="progress" cx="60" cy="60" r="50"></circle>
                </svg>
                <div class="percentage">0%</div>
            </div>
        `

        if (!progresso) return
        progresso.innerHTML = carregamentoHTML

        progressCircle = document.querySelector('.circular-loader .progress');
        percentageText = document.querySelector('.circular-loader .percentage');
    }

}

async function formularioOcorrencia(idOcorrencia) {

    const ocorrencia = dados_ocorrencias[idOcorrencia] || {}
    const { unidade = unidadeOrc, tipo, sistema, prioridade, anexos, fotos, descricao } = ocorrencia
    const nUnidade = dados_clientes[unidade]?.nome
    const nSistema = sistemas[sistema]?.nome
    const nPrioridade = prioridades[prioridade]?.nome
    const nTipo = tipos[tipo]?.nome
    const a = Object
        .entries(anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')`))
        .join('')

    const linhas = [
        {
            texto: 'Unidade de Manutenção',
            elemento: `<span ${unidade ? `id="${unidade}"` : ''} 
                class="campos" name="unidade" onclick="cxOpcoes('unidade', 'dados_clientes', ['nome', 'cidade', 'endereco', 'cnpj'])">
                ${nUnidade || 'Selecione'}
            </span>`
        },
        {
            texto: 'Sistema',
            elemento: `<span ${sistema ? `id="${sistema}"` : ''} 
            class="campos" name="sistema" onclick="cxOpcoes('sistema', 'sistemas', ['nome'])">
                ${nSistema || 'Selecione'}
            </span>`
        },
        {
            texto: 'Prioridade',
            elemento: `<span ${prioridade ? `id="${prioridade}"` : ''} 
            class="campos" name="prioridade" onclick="cxOpcoes('prioridade', 'prioridades', ['nome'])">
                ${nPrioridade || 'Selecione'}
            </span>`
        },
        {
            texto: 'Tipo',
            elemento: `<span ${tipo ? `id="${tipo}"` : ''} 
            class="campos" name="tipo" onclick="cxOpcoes('tipo', 'tipos', ['nome'])">
                ${nTipo || 'Selecione'}
            </span>`
        },
        {
            texto: 'Descrição',
            elemento: `<textarea rows="7" style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" name="descricao" class="campos">${descricao || ''}</textarea>`
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
        { img: 'atualizar', texto: 'Atualizar', funcao: `atualizarOcorrencias()` },
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

    const ocorrencia = dados_ocorrencias[idOcorrencia]
    const correcao = ocorrencia?.correcoes?.[idCorrecao] || {}

    const equipamentos = (
        await Promise.all(
            Object.values(correcao?.equipamentos || {})
                .map(equip => maisLabel(equip))
        )
    ).join('')

    const tipoCorrecao = correcoes[correcao?.tipoCorrecao]?.nome
    const executor = correcao?.executor
    const linhas = [
        {
            texto: 'Data Limite Execução',
            elemento: `<input oninput="bloqAnterior(this)" name="dtCorrecao" type="date" value="${correcao?.dtCorrecao || ''}">`
        },
        {
            texto: 'Status da Correção',
            elemento: `<span class="campos" ${correcao?.tipoCorrecao ? `id="${correcao?.tipoCorrecao}"` : ''} name="tipoCorrecao" onclick="cxOpcoes('tipoCorrecao', 'correcoes', ['nome'])">${tipoCorrecao || 'Selecione'}</span>`
        },
        {
            texto: 'Quem fará a atividade?',
            elemento: `<span class="campos" ${executor ? `id="${executor}"` : ''} name="executor" onclick="cxOpcoes('executor', 'dados_setores', ['usuario'])">${executor || 'Selecione'}</span>`
        },
        { texto: 'Descrição', elemento: `<textarea style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" name="descricao" rows="7" class="campos">${correcao?.descricao || ''}</textarea>` },
        {
            texto: 'Equipamentos usados',
            elemento: `
            <img src="imagens/baixar.png" onclick="maisLabel()">
            <div style="${vertical}; gap: 2px;" id="equipamentos">
                ${equipamentos}
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
        { img: 'atualizar', texto: 'Atualizar', funcao: `atualizarOcorrencias()` },
    ]

    popup({ linhas, botoes, titulo: 'Gerenciar Correção' })

    visibilidadeFotos()

}

async function maisLabel({ codigo, quantidade, unidade } = {}) {

    const div = document.getElementById('equipamentos')
    const opcoes = ['UND', 'METRO', 'CX']
        .map(op => `<option ${unidade == op ? `selected` : ''}>${op}</option>`)
        .join('')
    const temporario = ID5digitos()
    let nome = 'Selecionar'
    if (codigo) {
        const produto = await recuperarDado('dados_composicoes', codigo)
        nome = produto.descricao
    }

    const label = `
        <div style="${horizontal}; gap: 5px;">
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
            <div name="equipamentos" style="${vertical}; gap: 5px;">
                <span class="campos" name="${temporario}" ${codigo ? `id="${codigo}"` : ''} onclick="cxOpcoes('${temporario}', 'dados_composicoes', ['descricao', 'tipo', 'marca', 'fabricante'])">${nome}</span>
                <div style="${horizontal}; gap: 5px; width: 100%;">
                    <input style="width: 100%;" class="campos" type="number" value="${quantidade || ''}">
                    <select class="campos">${opcoes}</select>
                </div>
            </div>
        </div> 
    `
    if (codigo) return label

    div.insertAdjacentHTML('beforeend', label)
}

async function salvarCorrecao(idOcorrencia, idCorrecao = ID5digitos()) {

    const ocorrencia = dados_ocorrencias[idOcorrencia]
    ocorrencia.correcoes ??= {}
    ocorrencia.correcoes[idCorrecao] ??= {}

    let correcao = ocorrencia.correcoes[idCorrecao]
    const tipoCorrecao = obter('tipoCorrecao').id
    const dtCorrecao = obter('dtCorrecao').value

    if (tipoCorrecao == 'WRuo2' && !ocorrencia.assinatura && acesso.permissao == 'técnico') {
        coletarAssinatura(idOcorrencia)
        return
    }

    overlayAguarde()

    if (!tipoCorrecao || !dtCorrecao)
        return popup({ mensagem: 'Não deixe em branco <b>Data Limite</b> ou o <b>Tipo de Correção</b>' })

    Object.assign(correcao, {
        dtCorrecao,
        executor: obter('executor').id,
        data: new Date().toLocaleString(),
        usuario: acesso.usuario,
        tipoCorrecao,
        descricao: obter('descricao').value
    })

    const geoPermitido = localStorage.getItem('geo_permitido') === '1'

    const local = geoPermitido ? await capturarLocalizacao() : { latitude: null, longitude: null }

    if (!correcao.datas) correcao.datas = {}
    const data = new Date().getTime()
    correcao.datas[data] = {
        latitude: local.latitude,
        longitude: local.longitude
    }

    const input = obter('anexos')
    const anexos = await anexosOcorrencias(input)

    correcao.anexos = {
        ...correcao.anexos,
        ...anexos
    }

    const fotos = document.querySelector('.fotos')
    const imgs = fotos.querySelectorAll('img')
    if (imgs.length > 0) {
        if (!correcao.fotos) correcao.fotos = {}
        for (const img of imgs) {
            if (img.dataset && img.dataset.salvo == 'sim') continue
            const foto = await importarAnexos({ foto: img.src })
            correcao.fotos[foto[0].link] = foto[0]
        }
    }

    const divs = document.querySelectorAll('[name="equipamentos"]')
    correcao.equipamentos = {}

    for (const div of divs) {

        const idEquip = div.querySelector('span').id
        const quantidade = Number(div.querySelector('input').value)
        const unidade = div.querySelector('select').value
        correcao.equipamentos[idEquip] = {
            codigo: idEquip,
            quantidade,
            unidade
        }
    }

    if (respCorrecao) correcao.resposta = respCorrecao
    respCorrecao = null

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
    await telaOcorrencias()
    enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, correcao)
    enviar(`dados_ocorrencias/${idOcorrencia}/tipoCorrecao`, correcao.tipoCorrecao)
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
        unidade: obter('unidade')?.id || '',
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

    if (!ocorrencia.fotos) ocorrencia.fotos = {}

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
        await telaOcorrencias()
        enviar(`dados_ocorrencias/${idOcorrencia}`, ocorrencia)
        removerPopup()

    } else {

        try {
            const resposta = await enviar('dados_ocorrencias/0000', novo)

            if (resposta.mensagem) {
                popup({ mensagem: resposta.mensagem })
            } else {
                await salvarLocal(resposta.idOcorrencia, novo)
                await telaOcorrencias()
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
    await telaOcorrencias()

    img.parentElement.remove()
    removerOverlay()

}