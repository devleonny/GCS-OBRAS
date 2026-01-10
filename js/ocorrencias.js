let opcoesValidas = {
    solicitante: new Set(),
    executor: new Set(),
    tipoCorrecao: new Set(),
    finalizado: new Set()
}
const autE = ['adm', 'gerente', 'diretoria']
let emAtualizacao = false
let paginaAtual = 1
const LIMITE = 100
let filtrosAtivos = {}
let listaOcorrencias = {}
let recorteOcorrencias = {}
let listas = {}
let oAtual = { idCorrecao: null, idOcorrencia: null }

const labelBotao = (name, nomebase, id, nome) => {
    return `
        <label 
        class="campos" 
        name="${name}"
        ${id ? `id="${id}"` : ''} onclick="cxOpcoes('${name}', '${nomebase}')">
            ${nome ? nome : 'Selecione'} 
        </label>
        `
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
        popup(mensagem(`Falha no plugin: ${err}`))
    }
}

async function blocoAuxiliarFotos(fotos) {

    if (fotos) {

        const imagens = Object.entries(fotos)
            .map(([link, foto]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/GCS/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        const painel = `
            <div class="fotos">${imagens}</div>
            <div class="capturar" onclick="blocoAuxiliarFotos()">
                <img src="imagens/camera.png" class="olho">
                <span>Abrir Câmera</span>
            </div>
        `
        return painel

    } else {

        const popupCamera = `
            <div style="${vertical}; gap: 3px; background-color: #d2d2d2;">
                <div class="capturar" style="position: fixed; bottom: 10px; left: 10px; z-index: 10003;" onclick="tirarFoto()">
                    <img src="imagens/camera.png" class="olho">
                    <span>Capturar Imagem</span>
                </div>

                <div class="cameraDiv">
                    <video autoplay playsinline></video>
                    <canvas style="display: none;"></canvas>
                </div>
            </div>
            `
        popup(popupCamera, 'Captura', true)
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
        popup(mensagem('Erro ao acessar a câmera: ' + err.message), 'Alerta', true)
    }
}

function visibilidadeFotos() {
    const fotos = document.querySelector('.fotos')
    const qtd = fotos.querySelectorAll('img')
    fotos.style.display = qtd.length == 0 ? 'none' : 'grid'
}

async function tirarFoto() {

    const fotos = document.querySelector('.fotos')
    const cameraDiv = document.querySelector('.cameraDiv');
    const canvas = cameraDiv.querySelector('canvas');
    const video = cameraDiv.querySelector('video');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

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

function ampliarImagem(img, idFoto) {

    const acumulado = `
        <div style="position: relative; background-color: #d2d2d2;">
            <!-- <button style="position: absolute; top: 10px; left: 10px;" onclick="removerImagem('${idFoto}')">Remover Imagem</button> -->
            <img style="width: 95%;" src="${img.src}">
        </div>
    `

    popup(acumulado, 'Imagem', true)

}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '-'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

function confirmarExclusao(idOcorrencia, idCorrecao) {

    const funcao = idCorrecao ? `excluirOcorrenciaCorrecao('${idOcorrencia}', '${idCorrecao}')` : `excluirOcorrenciaCorrecao('${idOcorrencia}')`

    const acumulado = `
        <div style="background-color: #d2d2d2; ${horizontal}; padding: 1rem; gap: 10px;">

            <label>Você tem certeza que deseja excluir?</label>

            <button onclick="${funcao}">Confirmar</button>

        </div>
    `
    popup(acumulado, 'Aviso', true)
}

async function excluirOcorrenciaCorrecao(idOcorrencia, idCorrecao) {

    removerPopup()
    overlayAguarde()

    if (idCorrecao) {

        delete dados_ocorrencias[idOcorrencia].correcoes[idCorrecao]
        await deletar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`)
        await inserirDados({ [idOcorrencia]: dados_ocorrencias[idOcorrencia] }, 'dados_ocorrencias')
    } else {

        delete listaOcorrencias[idOcorrencia] // Remover do objeto temporário;
        await deletar(`dados_ocorrencias/${idOcorrencia}`)
        await deletarDB('dados_ocorrencias', idOcorrencia)
    }

    await telaOcorrencias()

    removerOverlay()

}

function criarLinhaOcorrencia(idOcorrencia, ocorrencia) {

    const btnExclusao = autE.includes(acesso.permissao)
        ? botaoImg('fechar', `confirmarExclusao('${idOcorrencia}')`)
        : ''
    const btnEditar = autE.includes(acesso.permissao)
        ? botaoImg('lapis', `formularioOcorrencia('${idOcorrencia}')`)
        : ''
    const uc = uCorrecao(ocorrencia?.correcoes || {})
    const codCorrecao = uc.tipo
    const ultima_correcao = correcoes?.[codCorrecao]?.nome || 'Não analisada'
    const corAssinatura = ocorrencia.assinatura ? '#008000' : '#d30000'
    const cliente = dados_clientes?.[ocorrencia?.unidade] || {}
    const tipo = tipos?.[ocorrencia?.tipo]?.nome || 'Em branco'
    const sistema = sistemas?.[ocorrencia?.sistema]?.nome || 'Em branco'
    const prioridade = prioridades?.[ocorrencia?.prioridade]?.nome || 'Em branco'
    const criador = ocorrencia?.usuario || 'Em branco'
    const descricao = ocorrencia?.descricao || 'Em branco'
    const unidade = cliente?.nome || 'Em branco'
    const cidade = cliente?.cidade || 'Em branco'

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
                ${modeloCampos('Empresa', empresas[ocorrencia?.empresa]?.nome || '')}
                ${modeloCampos('Tipo', tipo)}
                ${modeloCampos('Sistema', sistema)}
                ${modeloCampos('Prioridade', prioridade)}
            </div>

            <div class="bloco-linha">
                ${carregarCorrecoes(idOcorrencia, ocorrencia?.correcoes || {})}
            </div>
        </div>`

    const executor = Object.values(ocorrencia?.correcoes || {})
        .map(c => c.executor)
        .filter(Boolean)

    const reagendado = Object.values(ocorrencia?.correcoes || {})
        .some(c => c.datas_agendadas)

    const diffDias = uc.dias

    listaOcorrencias[idOcorrencia] = {
        atrasado: diffDias < 0 ? 'Sim' : 'Não',
        reagendado: reagendado ? 'Sim' : 'Não',
        executor,
        unidade,
        ultima_correcao,
        cidade,
        chamado: idOcorrencia,
        descricao,
        partes,
        criador,
        tipo,
        sistema,
        prioridade
    }

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

        if (tipoCorrecao == 'WRuo2') solucionado = true

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

function carregarCorrecoes(idOcorrencia, dadosCorrecao = {}) {

    let divsCorrecoes = ''
    for (const [idCorrecao, correcao] of Object.entries(dadosCorrecao).reverse()) {

        const status = correcoes?.[correcao?.tipoCorrecao]?.nome || 'Não analisada'
        const estilo = status == 'Solucionada'
            ? 'fin'
            : status == 'Não analisada'
                ? 'na'
                : 'and'

        const imagens = Object.entries(correcao?.fotos || {})
            .map(([link,]) => `<img name="foto" data-salvo="sim" id="${link}" src="${api}/uploads/GCS/${link}" class="foto" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        const edicao = (correcao.usuario == acesso.usuario || autE.includes(acesso.permissao))
            ? `
            <div style="${horizontal}; justify-content: end; width: 100%; gap: 2px; padding: 0.5rem;"> 
                <button onclick="formularioCorrecao('${idOcorrencia}', '${idCorrecao}')">Editar</button>
                <button style="background-color: #B12425;" onclick="confirmarExclusao('${idOcorrencia}', '${idCorrecao}')">Excluir</button>
            </div>
            `
            : ''

        const agendamentos = (correcao?.datas_agendadas || []).reverse()
            .map(data => {
                const [ano, mes, dia] = data.split('-')
                return `<span>${dia}/${mes}/${ano}</span>`
            })
            .join('')

        const imgR = (correcao.usuario == acesso.usuario || autE.includes(acesso.permissao))
            ? `<button onclick="oAtual = {idOcorrencia: '${idOcorrencia}', idCorrecao: '${idCorrecao}'}; reagendarCorrecao()" style="background-color: #249f41; color: white;">Reagendar</button>`
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
                    ${modelo('Executor', `<span>${correcao.executor}</span>`)}
                    ${modelo('Correção', `<span class="${estilo}">${status}</span>`)}
                    ${modelo('Descrição', `<div style="white-space: pre-wrap;">${correcao.descricao}</div>`)}
                    ${modelo('Criado em', `<span>${correcao?.data || 'S/D'}</span>`)}
                </div>

                <div style="${horizontal}">
                    ${edicao}
                    <div style="${vertical}; padding: 0.5rem;">
                        ${imagens !== ''
                ? `<div class="fotos" style="display: flex;">${imagens}</div>`
                : '<img src="imagens/img.png" style="width: 4rem;">'}

                        <div id="anexos" style="${vertical};">
                            ${Object.entries(correcao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')` })).join('')}
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

function reagendarCorrecao() {

    const linhas = [
        {
            texto: 'Defina uma nova data',
            elemento: `<input id="dt_reag" oninput="bloqAnterior(this)" type="date">`
        }
    ]

    const botoes = [
        { img: 'concluido', texto: 'Salvar', funcao: `salvarDataCorrecao()` }
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Reagendar' })
    form.abrirFormulario()

}

async function salvarDataCorrecao() { //29

    const novaData = document.getElementById('dt_reag')
    if (!novaData) return

    overlayAguarde()
    const { idOcorrencia, idCorrecao } = oAtual
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
    filtrarPorCampo()

}

async function filtrarPorCampo(campo, valor) {

    const tAtiva = document.querySelector('.tela-ocorrencias')

    if (!tAtiva) await telaOcorrencias()

    if (!valor) {
        delete filtrosAtivos[campo]
    } else {
        filtrosAtivos[campo] = valor == 'Todos' ? '' : valor
    }

    // Backup Filtros;
    localStorage.setItem('filtrosAtivos', JSON.stringify(filtrosAtivos))

    recorteOcorrencias = Object.keys(filtrosAtivos).length
        ? recorteAcumulado(listaOcorrencias, filtrosAtivos)
        : null

    renderizarPagina(1)

    mostrarMenus(false)
}

function recorteAcumulado(base, filtros = {}) {
    let resultado = base

    for (const [chave, termo] of Object.entries(filtros)) {
        if (!termo) continue
        resultado = recortarOcorrencias(resultado, chave, termo)
    }

    return resultado
}

function recortarOcorrencias(base, chave, termo) {
    if (!chave || !termo) return base

    const t = termo.toString().toLowerCase().trim()

    return Object.fromEntries(
        Object.entries(base).filter(([, dados]) => {
            const valor = dados?.[chave]
            if (!valor) return false

            if (Array.isArray(valor)) {
                return valor.some(v =>
                    v?.toString().toLowerCase().includes(t)
                )
            }

            return valor
                .toString()
                .toLowerCase()
                .includes(t)
        })
    )
}

function renderizarPaginacao() {

    const base = recorteOcorrencias !== null
        ? recorteOcorrencias
        : listaOcorrencias

    const totalPaginas = Math.ceil(Object.keys(base).length / LIMITE)

    document.querySelector('.paginacao').innerHTML = `
    <img src="imagens/esq.png" ${paginaAtual === 1 ? 'disabled' : ''} onclick="renderizarPagina(${paginaAtual - 1})">
    <img src="imagens/dir.png" ${paginaAtual === totalPaginas ? 'disabled' : ''} onclick="renderizarPagina(${paginaAtual + 1})">
    <span style="white-space: nowrap;">${paginaAtual} de ${totalPaginas}</span>
  `
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

    for (let [campo, opcoes] of Object.entries(listas)) {

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

function limparFiltros() {
    filtrosAtivos = {}
    filtrarPorCampo()
}

async function renderizarPagina(pagina) {

    paginaAtual = pagina
    const inicio = (pagina - 1) * LIMITE
    const fim = inicio + LIMITE
    const base = recorteOcorrencias !== null
        ? recorteOcorrencias
        : listaOcorrencias

    const fatia = Object
        .values(base)
        .slice(inicio, fim)
        .sort((a, b) => {
            const ga = /^G(\d+)/.exec(a.chamado)
            const gb = /^G(\d+)/.exec(b.chamado)

            if (ga && gb) return Number(gb[1]) - Number(ga[1])
            if (ga) return -1
            if (gb) return 1

            return 0
        })


    const tabela = document.querySelector('.tabela1')
    tabela.innerHTML = ''
    listas = {}

    const contadorPagina = document.getElementById('contador')
    if (contadorPagina) contadorPagina.textContent = Object.keys(base).length

    if (fatia.length == 0)
        return contadorPagina.innerHTML = `<div onclick="limparFiltros()" style="${horizontal}; gap: 1rem; cursor: pointer;"><span>Sem resultados</span> • <span>Limpar</span></div>`

    // Lançamento das linhas na página //29
    for (const dados of fatia) {
        const { criador, tipo, sistema, partes, prioridade, ultima_correcao, executor, reagendado, atrasado } = dados

        tabela.insertAdjacentHTML('beforeend', partes)

        for (const [chave, valor] of Object.entries({ criador, tipo, sistema, prioridade, ultima_correcao, executor, reagendado, atrasado })) {
            const set = (listas[chave] ??= new Set())

            if (Array.isArray(valor)) {
                valor.forEach(v => set.add(v))
            } else {
                set.add(valor)
            }
        }

    }

    renderizarPaginacao()
}

async function telaOcorrencias(apenasObjeto = false) {

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

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias).reverse()) {
        criarLinhaOcorrencia(idOcorrencia, ocorrencia)
    }

    if (apenasObjeto) return

    filtrarPorCampo()

    const acumulado = `
        <div class="tela-ocorrencias">
            <div class="painelBotoes">
                <div class="topo-ocorrencias">
                    <div style="${vertical};">
                        <div class="paginacao"></div>
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

}

function auxPendencias() {

    const contadores = { Todos: 0 }

    for (const ocorrencia of Object.values(dados_ocorrencias)) {

        const codCorrecao = uCorrecao(ocorrencia?.correcoes || {}).tipo
        const ultimaCorrecao = correcoes?.[codCorrecao]?.nome || 'Não analisada'

        contadores[ultimaCorrecao] ??= 0

        contadores[ultimaCorrecao]++
        contadores.Todos++

    }

    const divPendencias = document.querySelector('.painel-pendencias')

    const ordemFinal = ['Solucionada', 'Todos']

    const etiquetas = Object
        .entries(contadores)
        .sort((a, b) => {
            const [nomeA, totalA] = a
            const [nomeB, totalB] = b

            const priA = ordemFinal.includes(nomeA)
            const priB = ordemFinal.includes(nomeB)

            if (priA && !priB) return 1
            if (!priA && priB) return -1

            return totalB - totalA // maior → menor
        })
        .map(([correcao, total]) => {

            const cor =
                correcao === 'Solucionada'
                    ? '#3c9f15'
                    : correcao === 'Todos'
                        ? '#004cff'
                        : '#b12425'

            return `
            <div class="pill" onclick="filtrarPorCampo('ultima_correcao', '${correcao}')">
                <span class="pill-a" style="background: ${cor};">${total}</span>
                <span class="pill-b">${correcao}</span>
            </div>`
        })
        .join('')

    divPendencias.innerHTML = etiquetas

}

async function atualizarOcorrencias() {

    if (emAtualizacao) return

    emAtualizacao = true
    sincronizarApp()
    let status = { total: 9, atual: 1 }

    sincronizarApp(status)

    // Especial: sincronismo das ocorrências;
    const base = 'dados_ocorrencias'
    const nuvem = await baixarOcorrencias()

    if (nuvem.resetar && nuvem.resetar == 1)
        await inserirDados({}, base, true)

    await inserirDados(nuvem.dados, base)

    status.atual++

    const basesAuxiliares = [
        'dados_setores',
        'empresas',
        'dados_composicoes',
        'dados_clientes',
        'sistemas',
        'prioridades',
        'correcoes',
        'tipos'
    ]

    for (const base of basesAuxiliares) {
        sincronizarApp(status)
        await sincronizarDados(base, true, base == 'dados_clientes') // Resetar sempre;
        status.atual++
    }

    sincronizarApp({ remover: true })

    emAtualizacao = false
    empresas = await recuperarDados('empresas')
    correcoes = await recuperarDados('correcoes')
    dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    dados_clientes = await recuperarDados('dados_clientes')

    const tOcorrencias = document.querySelector('.tela-ocorrencias')
    if (tOcorrencias) filtrarPorCampo() // Atualizar as linhas;

    carregarMenus()
    auxPendencias() // Atualizar os tópicos do menu lateral;
}

function sincronizarApp({ atual, total, remover } = {}) {

    if (remover) {

        setTimeout(async () => {
            const loader = document.querySelector('.circular-loader')
            if (loader) loader.remove()
            return
        }, 1000)

        return

    } else if (atual) {

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
        const progresso = document.querySelector('.progresso')
        progresso.innerHTML = carregamentoHTML

        progressCircle = document.querySelector('.circular-loader .progress');
        percentageText = document.querySelector('.circular-loader .percentage');
    }

}

async function baixarOcorrencias() {

    const timestampOcorrencia = await maiorTimestamp('dados_ocorrencias')

    async function maiorTimestamp(nomeBase) {

        let timestamp = 0
        const dados = await recuperarDados(nomeBase)
        for (const [id, objeto] of Object.entries(dados)) {
            if (objeto.timestamp && objeto.timestamp > timestamp) timestamp = objeto.timestamp
        }

        return timestamp
    }

    return new Promise((resolve, reject) => {
        fetch(`${api}/ocorrencias`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: acesso.usuario, timestampOcorrencia })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.mensagem) {
                    popup(mensagem(data.mensagem), 'Alerta', true)
                    reject()
                }

                resolve(data)
            })
            .catch(error => reject(error))

    })
}

async function telaUnidades() {

    mostrarMenus(false)
    titulo.textContent = 'Unidades'
    const colunas = ['CNPJ', 'Cidade', 'Nome', '']
    await carregarElementosPagina('dados_clientes', colunas)
}

async function telaEquipamentos() {

    mostrarMenus(false)
    titulo.textContent = 'Equipamentos'
    const colunas = ['Descrição', 'Código', 'Unidade', 'Modelo', 'Fabricante', '']
    await carregarElementosPagina('dados_composicoes', colunas)
}

async function formularioOcorrencia(idOcorrencia) {

    const oc = idOcorrencia ? await recuperarDado('dados_ocorrencias', idOcorrencia) : {}
    const funcao = idOcorrencia ? `salvarOcorrencia('${idOcorrencia}')` : 'salvarOcorrencia()'

    const elEmpresa = acesso.empresa == 0
        ? labelBotao('empresa', 'empresas', oc?.empresa, empresas[oc?.empresa]?.nome)
        : `<span class="campos" name="empresa" id="${acesso.empresa}">${empresas?.[acesso?.empresa]?.nome || '...'}</span>`

    const linhas = [
        { texto: 'Empresa', elemento: elEmpresa },
        { texto: 'Unidade de Manutenção', elemento: labelBotao('unidade', 'dados_clientes', oc?.unidade, dados_clientes[oc?.unidade]?.nome) },
        { texto: 'Sistema', elemento: labelBotao('sistema', 'sistemas', oc?.sistema, sistemas[oc?.sistema]?.nome) },
        { texto: 'Prioridade', elemento: labelBotao('prioridade', 'prioridades', oc?.prioridade, prioridades[oc?.prioridade]?.nome) },
        { texto: 'Tipo', elemento: labelBotao('tipo', 'tipos', oc?.tipo, tipos[oc?.tipo]?.nome) },
        { texto: 'Descrição', elemento: `<textarea rows="7" style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" name="descricao" class="campos">${oc?.descricao || ''}</textarea>` },
        {
            texto: 'Anexos', elemento: `
                <label class="campos">
                    Clique aqui
                    <input type="file" style="display: none;" onchange="anexosOcorrencias(this, '${idOcorrencia ? idOcorrencia : 'novo'}')" multiple>
                </label>`
        },
        {
            elemento: `
            <div id="anexos" style="${vertical};">
                ${Object.entries(oc?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}')` })).join('')}
            </div>`},
        { elemento: await blocoAuxiliarFotos(oc?.fotos || {}, true) }
    ]

    const botoes = [{ img: 'concluido', texto: 'Salvar', funcao }]

    const titulo = idOcorrencia ? 'Editar Ocorrência' : 'Criar Ocorrência'

    const form = new formulario({ linhas, botoes, titulo })
    form.abrirFormulario()

    visibilidadeFotos()

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
    const funcao = idCorrecao ? `salvarCorrecao('${idOcorrencia}', '${idCorrecao}')` : `salvarCorrecao('${idOcorrencia}')`

    let equipamentos = ''
    for (const [, equip] of Object.entries(correcao?.equipamentos || {})) equipamentos += await maisLabel(equip)

    const linhas = [
        { texto: 'Data Limite Execução', elemento: `<input oninput="bloqAnterior(this)" name="dtCorrecao" type="date" value="${correcao?.dtCorrecao || ''}">` },
        { texto: 'Status da Correção', elemento: labelBotao('tipoCorrecao', 'correcoes', correcao?.tipoCorrecao, correcoes[correcao?.tipoCorrecao]?.nome) },
        { texto: 'Quem fará a atividade?', elemento: labelBotao('executor', 'dados_setores', correcao?.executor || acesso.usuario, correcao?.executor || acesso.usuario) },
        { texto: 'Descrição', elemento: `<textarea style="background-color: white; width: 100%; border-radius: 2px; text-align: left;" name="descricao" rows="7" class="campos">${correcao?.descricao || ''}</textarea>` },
        { texto: 'Equipamentos usados', elemento: `<img src="imagens/baixar.png" class="olho" onclick="maisLabel()">` },
        {
            elemento: `
            <div style="${vertical}; gap: 2px;" id="equipamentos">
                ${equipamentos}
            </div>
            
            `},
        { elemento: `${await blocoAuxiliarFotos(correcao?.fotos || {}, true)}` },
        {
            texto: 'Anexos',
            elemento: `
            <div style="${vertical}; gap: 5px;">
                <label class="campos">
                    Clique aqui
                    <input type="file" style="display: none;" onchange="anexosOcorrencias(this, '${idOcorrencia}', '${idCorrecao ? idCorrecao : 'novo'}')" multiple>
                </label>
                <div id="anexos" style="${vertical};">
                    ${Object.entries(correcao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}', '${idCorrecao}')` })).join('')}
                </div>
            </div>
            `
        }
    ]
    const botoes = [{ img: 'concluido', texto: 'Salvar', funcao }]
    const form = new formulario({ linhas, botoes, titulo: 'Gerenciar Correção' })
    form.abrirFormulario()

    visibilidadeFotos()

}

async function maisLabel({ codigo, quantidade, unidade } = {}) {

    let div = document.getElementById('equipamentos')
    const opcoes = ['UND', 'METRO', 'CX'].map(op => `<option ${unidade == op ? `selected` : ''}>${op}</option>`).join('')
    const temporario = ID5digitos()
    let nome = 'Selecionar'
    if (codigo) {
        const produto = await recuperarDado('equipamentos', codigo)
        nome = produto.descricao
    }

    const label = `
        <div style="${horizontal}; gap: 5px;">
            <img src="imagens/cancel.png" class="olho" onclick="this.parentElement.remove()">
            <div style="${vertical}; gap: 5px;">
                <label class="campos" name="${temporario}" ${codigo ? `id="${codigo}"` : ''} onclick="cxOpcoes('${temporario}', 'dados_composicoes')">${nome}</label>
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

async function salvarCorrecao(idOcorrencia, idCorrecao) {

    overlayAguarde()

    if (!idCorrecao) idCorrecao = ID5digitos()

    const ocorrencia = dados_ocorrencias[idOcorrencia]
    ocorrencia.correcoes ??= {}
    ocorrencia.correcoes[idCorrecao] ??= {}

    let correcao = ocorrencia.correcoes[idCorrecao]
    const tipoCorrecao = obter('tipoCorrecao').id
    const dtCorrecao = obter('dtCorrecao').value

    if (!tipoCorrecao || !dtCorrecao) return popup(mensagem('Não deixe em branco <b>Data Limite</b> ou o <b>Tipo de Correção</b>'), 'Em branco', true)

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

    correcao.anexos = {
        ...correcao.anexos,
        ...anexosProvisorios
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

    const equipamentos = document.getElementById('equipamentos')

    if (equipamentos) {

        const divs = equipamentos.querySelectorAll('div')
        correcao.equipamentos = {}

        for (const div of divs) {
            const campos = div.querySelectorAll('.campos')
            const idEquip = ID5digitos()
            correcao.equipamentos[idEquip] = {
                codigo: campos[0].id,
                quantidade: Number(campos[1].value),
                unidade: campos[2].value
            }
        }
    }

    ocorrencia.tipoCorrecao = correcao.tipoCorrecao // Atualiza no objeto principal também;

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
    await telaOcorrencias()
    enviar(`dados_ocorrencias/${idOcorrencia}/correcoes/${idCorrecao}`, correcao)
    enviar(`dados_ocorrencias/${idOcorrencia}/tipoCorrecao`, correcao.tipoCorrecao)

    anexosProvisorios = {}
    removerPopup()

}

function obter(name) {
    const elemento = document.querySelector(`[name=${name}]`)
    return elemento
}

async function salvarOcorrencia(idOcorrencia) {

    overlayAguarde()

    const ocorrencia = idOcorrencia
        ? await recuperarDado('dados_ocorrencias', idOcorrencia)
        : {}

    const codEmpresa = obter('empresa')?.id

    if (codEmpresa == '0') return popup(mensagem('O campo empresa "GERAL" está bloqueado!'), 'Geral não disponível', true)

    const novo = {
        empresa: obter('empresa')?.id || '',
        unidade: obter('unidade')?.id || '',
        sistema: obter('sistema')?.id || '',
        prioridade: obter('prioridade')?.id || '',
        tipo: obter('tipo')?.id || '',
        descricao: obter('descricao')?.value || '',
        dataRegistro: new Date().toLocaleString('pt-BR'),
        usuario: acesso.usuario,
        anexos: {
            ...ocorrencia.anexos,
            ...anexosProvisorios
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
                popup(mensagem(resposta.mensagem), 'Alerta', true)
            } else {
                await salvarLocal(resposta.idOcorrencia, novo)
                await telaOcorrencias()
            }

            removerPopup()

        } catch (err) {
            popup(mensagem(err.mensagem), 'Alerta', true)
        }
    }

    anexosProvisorios = {}
}

async function anexosOcorrencias(input, idOcorrencia, idCorrecao) {

    overlayAguarde()

    const divAnexos = document.getElementById('anexos')
    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    let objeto = {}
    const anexos = await importarAnexos({ input })
    const novo = (idCorrecao == 'novo' || idOcorrencia == 'novo')

    if (novo) {
        objeto = anexosProvisorios
    } else if (idCorrecao) {
        if (!ocorrencia.correcoes[idCorrecao].anexos) ocorrencia.correcoes[idCorrecao].anexos = {}
        objeto = ocorrencia.correcoes[idCorrecao].anexos
    } else {
        if (!ocorrencia.anexos) ocorrencia.anexos = {}
        objeto = ocorrencia.anexos
    }

    anexos.forEach(anexo => {
        const idAnexo = ID5digitos()
        objeto[idAnexo] = anexo

        if (divAnexos) divAnexos.insertAdjacentHTML('beforeend', criarAnexoVisual({ nome: anexo.nome, link: anexo.link, funcao: `removerAnexo(this, '${idAnexo}', '${idOcorrencia}' ${idCorrecao ? `, '${idCorrecao}'` : ''})` }))

    })

    if (!novo) await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    removerOverlay()

}


async function removerAnexo(img, idAnexo, idOcorrencia, idCorrecao) {

    overlayAguarde()

    let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    if (idCorrecao) {
        delete ocorrencia.correcoes[idCorrecao].anexos[idAnexo]
    } else {
        delete ocorrencia.anexos[idAnexo]
    }

    await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

    img.parentElement.remove()

    removerOverlay()

}