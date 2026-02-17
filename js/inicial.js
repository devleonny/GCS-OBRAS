const abas = ['PDA', 'POC', 'INFRA', 'LOGÍSTICA', 'EM_ANDAMENTO', 'CONCLUÍDO']
const coments = (comentario, campo, id) => {

    if (!comentario) comentario = ''
    return `
        <div style="${horizontal}; gap: 5px;">
            <div class="comentario-padrao" oninput="mostrarBtn(this)" contentEditable="true">${comentario.replace('\n', '<br>') || ''}</div>
            <img data-campo="${campo}" onclick="atualizarPda(this, '${id}')" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
        </div>
    `
}

let ultimoTitulo = null

const posicoesEstados = {
    "AC": { x: 80, y: 230 },
    "AL": { x: 575, y: 225 },
    "AP": { x: 340, y: 60 },
    "AM": { x: 150, y: 150 },
    "BA": { x: 480, y: 270 },
    "CE": { x: 515, y: 150 },
    "DF": { x: 395, y: 322 },
    "ES": { x: 500, y: 380 },
    "GO": { x: 365, y: 325 },
    "MA": { x: 435, y: 155 },
    "MG": { x: 450, y: 360 },
    "MS": { x: 295, y: 390 },
    "MT": { x: 280, y: 280 },
    "PA": { x: 320, y: 165 },
    "PB": { x: 580, y: 190 },
    "PE": { x: 540, y: 210 },
    "PI": { x: 470, y: 200 },
    "PR": { x: 345, y: 455 },
    "RJ": { x: 470, y: 420 },
    "RN": { x: 570, y: 155 },
    "RO": { x: 175, y: 250 },
    "RR": { x: 200, y: 60 },
    "RS": { x: 320, y: 530 },
    "SC": { x: 365, y: 495 },
    "SE": { x: 565, y: 255 },
    "SP": { x: 385, y: 415 },
    "TO": { x: 390, y: 240 }
}

function preencherMapa(estado, numero) {
    const svg = document.getElementById("mapaOverlay")
    const pos = posicoesEstados[estado]
    if (!pos) return

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g")

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    bg.setAttribute("x", pos.x - 18)
    bg.setAttribute("y", pos.y - 14)
    bg.setAttribute("width", "36")
    bg.setAttribute("height", "28")
    bg.setAttribute("rx", "8")
    bg.setAttribute("fill", "#ffffff")
    bg.setAttribute("stroke", "#333")
    bg.setAttribute("stroke-width", "1.2")

    const texto = document.createElementNS("http://www.w3.org/2000/svg", "text")
    texto.setAttribute("x", pos.x)
    texto.setAttribute("y", pos.y + 2)
    texto.setAttribute("font-size", "16")
    texto.setAttribute("font-weight", "bold")
    texto.setAttribute("fill", "#333")
    texto.setAttribute("text-anchor", "middle")
    texto.setAttribute("dominant-baseline", "middle")
    texto.textContent = numero

    group.appendChild(bg)
    group.appendChild(texto)
    svg.appendChild(group)
}

const dtPrazo = (data) => {
    if (!data) return ''

    const [ano, mes, dia] = data.split('-')
    const dataPrazo = new Date(`${ano}-${mes}-${dia}T00:00:00`)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const atrasado = hoje > dataPrazo
    return atrasado
}

async function telaInicial() {

    atribuirVariaveis()

    mostrarMenus(false)

    toolbar.style.display = 'flex'
    titulo.textContent = 'GCS'
    localStorage.setItem('app', 'GCS')
    app = 'GCS'

    if (priExeGCS)
        await atualizarGCS()

    const aBloqs = ['INDICADORES', 'TÉCNICOS']

    const abasToolbar = ['INDICADORES', 'TÉCNICOS', ...abas]
        .map(aba => {

            let funcao = `tabelaPorAba({aba: '${aba}'})`
            if (aba == 'INDICADORES')
                funcao = 'indicadores()'
            else if (aba == 'TÉCNICOS')
                funcao = 'tabelaTecnicos()'

            return `
                <div style="opacity: 0.5; height: 3rem;" class="aba-toolbar" id="toolbar-${aba}" onclick="${funcao}">
                    <label>${aba.replace('_', ' ')}</label>
                    ${aBloqs.includes(aba) ? '' : `<span id="contador-${aba}"></span>`}
                </div>
            `
        }).join('')

    const acumulado = `
        <div class="tela-gerenciamento">
            <div style="${horizontal}; width: 80vw;">
                <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
                <div id="toolbar">
                    ${abasToolbar}
                </div>
                <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
            </div>
            
            <div class="tabelas-inicial"></div>
            
        </div>
    `

    const tGerenciamento = document.querySelector('.tela-gerenciamento')
    if (!tGerenciamento) {
        tela.innerHTML = acumulado
        criarMenus('inicial')
    }

    // Carregar tabelas;
    await indicadores()
    await contadores()
    await carregarControles()

}

async function tabelaPorAba({ aba = 'CONCLUÍDO', filtros = { 'aba': { op: '=', value: aba } } }) {

    mostrarGuia(aba)

    const colunas = {
        'Cliente': { chave: 'snapshots.pda' },
        'Tags': { chave: 'snapshots.tags' },
        'Técnicos': '',
        'Início': '',
        'Término': '',
        'Comentários': '',
        'Ação Necessário': '',
        'Checklist': '',
        'Detalhes': '',
        'Remover': ''
    }

    const pag = 'indicadores'
    const tabela = modTab({
        pag,
        colunas,
        base: 'dados_orcamentos',
        filtros,
        criarLinha: 'linPda',
        body: 'bodyIndicadores'
    })

    document.querySelector('.tabelas-inicial').innerHTML = tabela

    await paginacao(pag)

}

async function linPda(orcamento) {

    const { cliente, cidade } = orcamento.snapshots
    const idOrcamento = orcamento.id

    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma]
        .map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`)
        .join('')

    const pda = orcamento.pda || {}
    const listaTecs = orcamento?.checklist?.tecnicos || pda?.tecnicos || []

    const tecs = listaTecs
        .map(codTec => {
            const cliente = {}
            return `<div class="etiquetas" style="min-width: 100px;">${cliente?.nome || '...'}</div>`
        }).join('')

    const mod = (texto, elemento) => `
        <div style="${vertical}; gap: 2px;">
            <span><b>${texto}:</b></span>
            ${elemento}
        </div>
    `

    const strAcoes = Object.entries(pda.acoes || {})
        .map(([idAcao, dados]) => {

            const [ano, mes, dia] = dados.prazo.split('-')
            const prazo = `${dia}/${mes}/${ano}`

            const estilo = dados?.status === 'concluído'
                ? 'concluído'
                : dtPrazo(dados?.prazo)
                    ? 'atrasado'
                    : 'pendente'

            return `
            <div style="${horizontal}; text-align: left; width: 100%; gap: 0.5rem;">
                <div class="etiqueta-${estilo}">
                    <span><b>Ação:</b> ${dados?.acao || ''}</span>
                    <span><b>Responsável:</b> ${dados?.responsavel || ''}</span>
                    <span><b>Prazo:</b> ${prazo}</span>
                    ${dados.registro
                    ? `<span><b>criado em:</b> ${new Date(dados.registro).toLocaleString('pt-BR')}</span>`
                    : ''}
                </div>
                <img src="imagens/editar.png" style="width: 1.5rem;" onclick="formAcao('${idOrcamento}', '${idAcao}')">
            </div>
            `}).join('')

    const selectAbas = `
        <select class="etiquetas" onchange="atualizarAba(this, '${idOrcamento}')">
            <option></option>
            ${abas.map(aba => `<option ${orcamento?.aba == aba ? 'selected' : ''}>${aba}</option>`).join('')}
        </select>
    `

    const existente = `
        <div style="${vertical}; gap: 2px; text-align: left;">
            <span><b>Número: </b>${orcamento?.dados_orcam?.contrato || ''}</span>
            <span><b>Cliente: </b>${cliente}</span>
            <span><b>Data: </b>${orcamento?.dados_orcam?.data || '...'}</span>
            <span><b>Cidade: </b>${cidade}</span>
            <span><b>Valor: </b> ${dinheiro(orcamento?.total_geral)}</span>

            ${mod('Status', `
                <select name="status" class="etiquetas" onchange="alterarStatus('${idOrcamento}', this)">
                    ${opcoes}
                </select>
                `)}

        </div>
    `
    const novo = `
        <div style="${vertical}; gap: 5px; text-align: left;">
            <span><b>Projeto:</b> ${orcamento?.projeto || 'Projeto sem nome'}</span>
            <div style="${horizontal}; justify-content: end; align-items: end; gap: 5px;">

                ${mod('Estado', `
                    <select class="etiquetas" data-campo="estado" onchange="atualizarCampo(this, '${idOrcamento}')">
                        <option></option>
                        ${Object.keys(posicoesEstados).map(estado => `<option ${pda.estado == estado ? 'selected' : ''}>${estado}</option>`).join('')}
                    </select>
                    `)}
                
                <img src="imagens/editar.png" onclick="editarLinPda({idOrcamento:'${idOrcamento}'})">
                <img src="imagens/projeto.png" onclick="confirmarCriarOrcamento('${idOrcamento}')">
            </div>
        </div>
    `

    // Tags;
    const tags = []

    for (const idTag of Object.keys(orcamento.tags || {})) {

        const tag = await recuperarDado('tags_orcamentos', idTag)

        tags.push(modeloTag(tag, idOrcamento))

    }

    const tds = `
        <td>
            ${cliente ? existente : novo}
            ${mod('Aba', selectAbas)}
        </td>
        <td>
            <div style="${vertical}; gap: 2px;">
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="renderPainel('${idOrcamento}')">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${tags.join('')}
                </div>
            </div>
        </td>
        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px;">
                <img onclick="tecnicosAtivos('${id}')" src="imagens/baixar.png" style="width: 1.5rem;">
                <div style="${vertical}; gap: 2px; width: 100%;">
                    ${tecs}
                </div>
            </div>
        </td>
        <td>
            <input 
            style="width: max-content;"
            type="date" 
            class="etiqueta-${orcamento.inicio ? 'concluído' : 'pendente'}"
            value="${orcamento?.inicio || ''}" 
            onchange="alterarDatas(this, 'inicio', '${idOrcamento}')">
        </td>
        <td>
            <input 
            style="width: max-content;"
            type="date" 
            class="etiqueta-${orcamento.termino ? 'concluído' : 'pendente'}"
            value="${orcamento?.termino || ''}" 
            onchange="alterarDatas(this, 'termino', '${idOrcamento}')">
        </td>

        <td>${coments(pda?.comentario, 'comentario', idOrcamento)}</td>

        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px;">
                <img onclick="formAcao('${idOrcamento}')" src="imagens/baixar.png" style="width: 1.5rem;">
                <div class="bloco-acoes">
                    ${strAcoes}
                </div>
            </div>
        </td>
        <td>
            <div style="${vertical}; width: 100%; gap: 2px;">
                ${orcamento?.checklist?.andamento
            ? divPorcentagem(orcamento.checklist.andamento)
            : ''
        }
            </div>
        </td>
        <td>
            ${orcamento ? `<img onclick="abrirAtalhos('${idOrcamento}')" src="imagens/pesquisar2.png" style="width: 1.5rem;">` : ''}
        </td>
        <td>
            <img onclick="confirmarExcluirPda('${idOrcamento}')" src="imagens/cancel.png" style="width: 1.5rem;">
        </td>
    `

    return `
        <tr id="${idOrcamento}">
            ${tds}
        </tr>`

}

async function contadores() {

    const contadores = await contarPorCampo({ base: 'dados_orcamentos', path: 'aba' })

    for (const [aba, total] of Object.entries(contadores)) {

        const spanContador = document.getElementById(`contador-${aba}`)
        if (spanContador) spanContador.textContent = total

    }
}

async function tabelaTecnicos() {

    mostrarGuia('TÉCNICOS')

    const colunas = {
        'Nome': { chave: 'nome' },
        'Obras': {}
    }
    const pag = 'tecnicos'
    const tabela = modTab({
        pag,
        body: 'bodyTecnicos',
        base: 'dados_clientes',
        filtros: { 'tags.*.tag': { op: '=', value: 'TÉCNICO' } },
        criarLinha: 'criarLinhaTecnico',
        colunas
    })

    const divTabelas = document.querySelector('.tabelas-inicial')
    if (divTabelas) divTabelas.innerHTML = tabela

    await paginacao(pag)

}

function criarLinhaTecnico(tecnico) {

    return `
    <tr>
        <td>${tecnico.nome}</td>
        <td></td>
    </tr>
    `

}

function linAcoes(orcamento) {

    const idOrcamento = orcamento.id
    const acoes = orcamento?.pda?.acoes || {}
    const chamado = orcamento?.dados_orcam?.chamado || orcamento?.dados_orcam?.contrato || orcamento?.projeto || '-'

    const filtroUsuarioAtivo = controles?.acoes?.filtros?.['pda.acoes.*.responsavel']?.value
    const statusFiltro = controles?.acoes?.status

    let strAcoes = ''

    for (const dados of Object.values(acoes)) {

        const { responsavel, status, usuario, registro, prazo, acao } = dados

        if (filtroUsuarioAtivo && responsavel !== filtroUsuarioAtivo)
            continue

        const estilo = status === 'concluído'
            ? 'concluído'
            : dtPrazo(prazo)
                ? 'atrasado'
                : 'pendente'

        if (statusFiltro && statusFiltro !== estilo)
            continue

        const [ano, mes, dia] = prazo.split('-')
        const prazoConvertido = `${dia}/${mes}/${ano}`
        const dtRegistro = registro
            ? `<span><b>criado em: </b>${new Date(registro).toLocaleString('pt-BR')}</span>`
            : ''
        const criadoPor = usuario
            ? `<span><b>criado por: </b>${usuario}</span>`
            : ''
        strAcoes += `
            <tr>    
                <div class="etiqueta-${estilo}" style="width: 95%; flex-direction: row; gap: 0.5rem; margin: 1px;">

                    <img src="imagens/pesquisar2.png" style="width: 2rem;" onclick="irORC('${idOrcamento}', '${orcamento?.aba || 'N'}')">

                    <div style="${vertical};">
                        <span><b>ID:</b> ${chamado}</span>
                        <span><b>Aba:</b> ${orcamento.aba || ''}</span>
                        <div style="white-space: pre-wrap;"><b>Ação:</b> ${acao || ''}</div>
                        <span><b>Responsável:</b> ${responsavel || ''}</span>
                        <span><b>Prazo:</b> ${prazoConvertido}</span>
                        ${dtRegistro}
                        ${criadoPor}
                    </div>
                </div>
            </tr>`
    }

    return strAcoes
}

function somarPend(obj) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const t = { atrasados: 0, pendentes: 0 }

    for (const [data, qtd] of Object.entries(obj)) {
        const d = new Date(data + 'T00:00:00')
        if (isNaN(d)) continue

        t[d < hoje ? 'atrasados' : 'pendentes'] += Number(qtd) || 0
    }

    return t
}

async function criarGaveta(usuario = null, conf = {}) {

    if (!usuario)
        usuario = document.querySelector('[name="contador"]').id || 'Geral'

    const contadores = JSON.parse(localStorage.getItem('contadores')) || {}
    contadores[usuario] = { estrela: conf.estrela || 'N' }

    localStorage.setItem('contadores', JSON.stringify(contadores))

    const box = (titulo, valor, cor) => {

        const auxiliar = usuario == 'Geral'
            ? `controles.acoes.filtros = {'pda.acoes': {op: 'NOT_EMPTY'}}`
            : `controles.acoes.filtros = {'pda.acoes.*.responsavel': { op: '=', value: '${usuario}' }}`

        return `
        <div 
            class="ind" 
            style="border-left: 6px solid ${cor};" 
            onclick="controles.acoes.status = '${titulo}'; ${auxiliar}; paginacao('acoes')">
            <span style="font-size: 14px; color: #444;">${inicialMaiuscula(titulo)}</span>
            <strong style="font-size: 22px; margin-top:5px;">${valor}</strong>
        </div>`
    }

    const filtros = usuario == 'Geral'
        ? {}
        : { 'pda.acoes.*.responsavel': { op: '=', value: usuario } }

    const contagem = await contarPorCampo({
        base: 'dados_orcamentos',
        path: 'pda.acoes.*.status',
        filtros
    })

    const resposta = await contarPorCampo({
        base: 'dados_orcamentos',
        path: 'pda.acoes.*.prazo',
        filtros: {
            ...filtros,
            'pda.acoes.*.status': { op: '=', value: 'pendente' }
        }
    })

    const totais = somarPend(resposta)

    const botaoCancelar = usuario == acesso.usuario
        ? ''
        : `<img src="imagens/cancel.png" onclick="removerContador('${usuario}')">`

    const conteudo = `
        <div style="${horizontal}; gap: 1rem;">
            <span>Contador de ações <b>${usuario}</b></span>
            ${botaoCancelar}
        </div>
        <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
            ${box('pendente', totais?.pendentes || 0, "#41a6ff")}
            ${box('atrasado', totais?.atrasados, "#ff0000")}
            ${box('concluído', contagem?.concluído || 0, "#008000")}
            <img src="imagens/estrela${conf?.estrela == 'S' ? '' : '_off'}.png" name="estrela" data-usuario="${usuario}" onclick="favoritar(this)">
        </div>
    `

    const gaveta = `
        <div id="gaveta_${usuario}" style="${vertical}; gap: 5px; padding: 0.5rem;">
            ${conteudo}
        </div>
    `

    const guardaRoupas = document.querySelector('.guarda-roupas')
    const existente = document.getElementById(`gaveta_${usuario}`)
    if (existente)
        return existente.innerHTML = conteudo

    if (guardaRoupas)
        guardaRoupas.insertAdjacentHTML('beforeend', gaveta)

}

async function favoritar(img) {

    const usuario = img.dataset.usuario
    const contadores = JSON.parse(localStorage.getItem('contadores')) || {}

    Object.entries(contadores)
        .map(([u, conf]) => {
            conf.estrela = 'N'
        })

    contadores[usuario].estrela = 'S'

    localStorage.setItem('contadores', JSON.stringify(contadores))

    const estrelas = document.querySelectorAll('[name="estrela"]')

    estrelas.forEach(e => e.src = 'imagens/estrela_off.png')

    img.src = 'imagens/estrela.png'

    const filtros = usuario == 'Geral'
        ? {}
        : { op: '=', value: usuario }

    controles.acoes.filtros = {
        'pda.acoes.*.responsavel': filtros
    }

    await paginacao('acoes')

}

function removerContador(usuario) {
    const contadores = JSON.parse(localStorage.getItem('contadores')) || []
    delete contadores[usuario]
    localStorage.setItem('contadores', JSON.stringify(contadores))

    const gaveta = document.getElementById(`gaveta_${usuario}`)
    if (gaveta)
        gaveta.remove()
}

function incluirContador() {

    const linhas = [
        {
            texto: 'Escolha o usuário',
            elemento: `<span class="opcoes" name="contador" onclick="cxOpcoes('contador')">Selecione</span>`
        }
    ]

    controlesCxOpcoes.contador = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `criarGaveta()` },
    ]

    popup({ botoes, linhas, nra: false })
}

async function indicadores() {

    mostrarGuia('INDICADORES')

    //await atualizarGCS()

    const contadores = JSON.parse(localStorage.getItem('contadores')) || []
    if (!contadores[acesso.usuario])
        contadores[acesso.usuario] = { estrela: 'N' }

    let filtroUsuario = {}

    Object.entries(contadores)
        .forEach(([u, conf]) => {
            if (conf.estrela == 'S' && u !== 'Geral')
                filtroUsuario = { 'pda.acoes.*.responsavel': { op: '=', value: u } }

            criarGaveta(u, conf)
        })

    const pag = 'acoes'
    const tabela = modTab({
        criarLinha: 'linAcoes',
        base: 'dados_orcamentos',
        pag,
        body: 'bodyAcoes',
        filtros: {
            'pda.acoes': { op: 'NOT_EMPTY' },
            ...filtroUsuario
        }
    })

    const acumulado = `
    <div class="painel-indicadores">

        <div style="${vertical}; width: 50%;">
            <button onclick="incluirContador()">Incluir contador</button>
            <div class="guarda-roupas"></div>

            <!--
            <div class="toolbar-mapas"></div>
            <div class="fundo-mapa">
                <img src="imagens/mapa.png" class="mapa">
                <svg id="mapaOverlay" width="600" height="600" style="position: absolute; top: 0; left: 0;"></svg>
            </div>
            -->

        </div>

        <div style="width: 50%;">
            ${tabela}
        </div>

    </div>
    `
    document.querySelector('.tabelas-inicial').innerHTML = acumulado

    await paginacao(pag)

}


function mostrarGuia(guia) {

    const abas = document.querySelectorAll('.aba-toolbar')

    abas.forEach(a => { a.style.opacity = 0.5 })

    const aba = document.querySelector(`#toolbar-${guia}`)

    if (aba) aba.style.opacity = 1
}

function confirmarCriarOrcamento(idOrcamento) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `criarOrcamentoPda('${idOrcamento}')` }
    ]

    popup({ botoes, elemento: 'Deseja transformar esse item em orçamento?', titulo: 'Transformar em Orçamento' })
}

async function criarOrcamentoPda(id) {

    removerPopup()

    const orcamento = await recuperarDado('dados_orcamentos', id)
    orcamento.id = id

    baseOrcamento(orcamento)
    await telaCriarOrcamento()

}

function confirmarExcluirPda(idOrcamento) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirPda('${idOrcamento}')` }
    ]

    const elemento = `Este item será apenas removido das tabelas, <br>Ele não será excluído dos orçamentos`

    popup({ botoes, elemento, titulo: 'Remover dos PDAs' })
}

async function excluirPda(idOrcamento) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    const trExistente = document.getElementById(idOrcamento)
    enviar(`dados_orcamentos/${idOrcamento}/aba`, '')
    removerPopup()

    if (trExistente) trExistente.remove()
    await contadores()

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

}

async function atualizarAba(select, idOrcamento) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const valor = select.value
    orcamento.aba = valor

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/aba`, valor)

}

async function atualizarCampo(select, idOrcamento) {

    const campo = select.dataset.campo
    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const valor = select.value
    orcamento.pda ??= {}
    orcamento.pda[campo] = valor

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/pda/${campo}`, valor)

}

async function atualizarPda(img, idOrcamento) {

    const div = img.previousElementSibling
    const info = div.textContent
    const campo = img.dataset.campo

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    orcamento.pda ??= {}
    orcamento.pda[campo] = info

    img.style.display = 'none'

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/pda/${campo}`, info)

}

async function alterarDatas(input, campo, idOrcamento) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const data = input.value

    input.classList = data ? 'etiqueta-concluído' : 'etiqueta-pendente'

    orcamento[campo] = data

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/${campo}`, data)

}

async function formAcao(idOrcamento, idAcao) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const dados = orcamento?.pda?.acoes?.[idAcao] || {}

    controlesCxOpcoes.responsavel = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const linhas = [
        { texto: 'Ação', elemento: `<textarea name="acao">${dados?.acao || ''}</textarea>` },
        {
            texto: 'Responsável',
            elemento: `<span 
            class="opcoes" 
            name="responsavel" 
            ${dados.responsavel ? `id="${dados.responsavel}"` : ''}
            onclick="cxOpcoes('responsavel')">
                ${dados.responsavel || 'Selecione'}
            </span>`
        },
        { texto: 'Prazo da ação', elemento: `<input name="prazo" type="date" value="${dados?.prazo || ''}">` },
        {
            texto: 'Status', elemento: `
            <select name="statusAcao">
                ${['pendente', 'concluído'].map(op => `<option ${dados?.status == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            ` }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarAcao('${idOrcamento}' ${idAcao ? `, '${idAcao}'` : ''})` }
    ]

    if (idAcao) botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirAcao('${idAcao}', '${idOrcamento}')` })

    popup({ linhas, botoes, titulo: 'Ações' })

}

async function confirmarExcluirAcao(idAcao, idOrcamento) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirAcao('${idAcao}', '${idOrcamento}')` }
    ]

    popup({ botoes, mensagem: 'Tem certeza?', nra: false })

}

async function excluirAcao(idAcao, idOrcamento) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    delete orcamento.pda.acoes[idAcao]

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    deletar(`dados_orcamentos/${idOrcamento}/pda/acoes/${idAcao}`)

}

async function salvarAcao(idOrcamento, idAcao) {

    overlayAguarde()

    idAcao = idAcao || ID5digitos()

    const painel = document.querySelector('.painel-padrao')
    const el = (nome) => {
        const elem = painel.querySelector(`[name="${nome}"]`)
        return elem
    }

    const responsavel = el('responsavel').id
    const acao = el('acao').value
    const prazo = el('prazo').value
    const status = el('statusAcao').value

    if (!prazo || !responsavel) return popup({ mensagem: 'Preencha o prazo e/ou responsável da ação' })

    const a = {
        usuario: acesso.usuario,
        responsavel,
        acao,
        prazo,
        status,
        registro: new Date().getTime()
    }

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    orcamento.pda ??= {}
    orcamento.pda.acoes ??= {}
    orcamento.pda.acoes[idAcao] = a

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/pda/acoes/${idAcao}`, a)

    removerPopup()

}

async function editarLinPda({ idOrcamento, aba = 'PDA' }) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    const linhas = [
        {
            texto: 'Nome do Projeto',
            elemento: `<textarea name="projeto"></textarea>`
        },
        {
            texto: 'Estado',
            elemento: `
                <select name="estado">
                    ${Object.keys(posicoesEstados).map(estado => `<option ${orcamento?.pda?.estado == estado ? 'selected' : ''}>${estado}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Aba',
            elemento: `
                <select name="aba">
                    ${abas.map(a => `<option ${(aba || orcamento?.aba) == a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
            `
        }
    ]

    const funcao = idOrcamento ? `salvarCartao('${idOrcamento}')` : 'salvarCartao()'

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    const titulo = idOrcamento ? 'Editar item' : 'Adicionar item'

    popup({ linhas, botoes, titulo })

}

async function salvarCartao(idOrcamento) {

    overlayAguarde()

    const projeto = document.querySelector('[name="projeto"]').value
    const estado = document.querySelector('[name="estado"]').value
    const aba = document.querySelector('[name="aba"]').value
    const dados = {
        projeto,
        estado,
        aba,
        checklist: { tecnicos: [] },
        usuario: acesso.usuario
    }

    const orcamento = {
        ...await recuperarDado('dados_orcamentos', idOrcamento) || {},
        ...dados
    }

    if (idOrcamento) {
        enviar(`dados_orcamentos/${idOrcamento}/projeto`, projeto)
        enviar(`dados_orcamentos/${idOrcamento}/estado`, estado)
        enviar(`dados_orcamentos/${idOrcamento}/aba`, aba)
    } else {
        idOrcamento = `PDA_${unicoID()}`
        enviar(`dados_orcamentos/${idOrcamento}`, dados)
    }

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')

    removerPopup()

}
