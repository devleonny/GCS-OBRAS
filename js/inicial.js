const abas = ['PDA', 'POC', 'INFRA', 'LOGÍSTICA', 'EM_ANDAMENTO', 'CONCLUÍDO', 'PENDÊNCIA']

const dtPrazo = (data) => {
    if (!data) return ''

    const [ano, mes, dia] = data.split('-')
    const dataPrazo = new Date(`${ano}-${mes}-${dia}T00:00:00`)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const atrasado = hoje > dataPrazo
    return atrasado
}

async function telaInicialGCS() {

    atribuirVariaveis()

    toolbar.style.display = 'flex'
    titulo.textContent = 'GCS'

    priExeGCS = false

    if (acesso.permissao == 'cliente' || acesso.permissao == 'técnico')
        return await telaInicialOcorrencias()

    criarMenus('inicial')

    const aBloqs = ['INDICADORES', 'TÉCNICOS']

    const abasToolbar = ['INDICADORES', 'TÉCNICOS', ...abas]
        .map(aba => {

            return `
                <div 
                style="opacity: 0.5; height: 3rem;" 
                class="aba-toolbar" 
                id="toolbar-${aba}" 
                onclick="tabelaPorAba({aba: '${aba}'})">
                    <label>${aba.replace('_', ' ')}</label>
                    ${aBloqs.includes(aba) ? '' : `<span id="contador-${aba}"></span>`}
                </div>`

        }).join('')


    // INDICADORES
    const filtroUsuario = await atualizarContadoresAcoes()

    const tabelaIndicadores = await modTab({
        criarLinha: 'linAcoes',
        base: 'acoes',
        pag: 'acoes',
        body: 'bodyAcoes',
        filtros: filtroUsuario
    })

    const indicadores = `
    <div class="painel-indicadores">

        <div class="bloco-indicador-incial">
            <button onclick="incluirContador()">Incluir contador</button>
            <div class="guarda-roupas"></div>
        </div>

        <div class="bloco-indicador-incial">
            ${tabelaIndicadores}
        </div>
    </div>`

    const btnExtras = `<button onclick="editarLinPda({idOrcamento: null})">Adicionar Projeto</button>`
    // TABELAS PAGINADAS;
    const tabelasPaginadas = await modTab({
        btnExtras,
        base: 'dados_orcamentos',
        pag: 'tabelasIndicadores',
        funcaoAdicional: ['contadoresAbas', 'atualizarContadoresAcoes'],
        body: 'bodyIndicadores',
        criarLinha: 'linPda',
        colunas: {
            'Cliente': { chave: 'snapshots.contrato' },
            'Tags': { chave: 'snapshots.tags' },
            'Técnicos': { chave: 'snapshots.tecnicos' },
            'Início': {},
            'Término': {},
            'Comentário': { chave: 'pda.comentario' },
            'Ação Necessária': {},
            'Checklist': {},
            'Detalhes': {}
        }
    })

    // TÉCNICOS
    const tabelaTecnicos = await modTab({
        pag: 'tecnicos',
        body: 'bodyTecnicos',
        base: 'dados_clientes',
        filtros: { 'tags.*.tag': { op: '=', value: 'TÉCNICO' } },
        criarLinha: 'criarLinhaTecnico',
        colunas: {
            'Nome': { chave: 'nome' },
            'Obras': {}
        }
    })

    const acumulado = `
        <div class="tela-gerenciamento">
            <div style="${horizontal}; width: 80vw;">
                <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
                <div id="toolbar">
                    ${abasToolbar}
                </div>
                <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
            </div>
            
            <div class="tabelas-inicial">
                <div class="t-indicadores">${indicadores}</div>
                <div class="t-tecnicos">${tabelaTecnicos}</div>
                <div class="t-tabelas">${tabelasPaginadas}</div>
            </div>
            
        </div>`

    tela.innerHTML = acumulado

    mostrarMenus(false)
    await tabelaPorAba({ aba: 'INDICADORES' })
    await carregarControles()

    // Inciar coelho;
    parar()

    if (!LPUS) {
        const resposta = await buscarLPUs()

        if (resposta.mensagem)
            return popup({ mensagem: resposta.mensagem })

        if (resposta.lpus)
            LPUS = resposta.lpus
    }


}

async function tabelaPorAba({ aba = 'CONCLUÍDO', id = null }) {

    // DESTACAR ABA;
    const abas = document.querySelectorAll('.aba-toolbar')

    abas.forEach(a => { a.style.opacity = 0.5 })

    const abaToolbar = document.querySelector(`#toolbar-${aba}`)

    if (abaToolbar)
        abaToolbar.style.opacity = 1

    // MOSTRAR PAINEL;
    const paineis = ['indicadores', 'tecnicos', 'tabelas']
    paineis.forEach(p => {
        document.querySelector(`.t-${p}`).style.display = 'none'
    })

    let painel = 'tabelas'

    if (aba == 'INDICADORES')
        painel = 'indicadores'
    else if (aba == 'TÉCNICOS')
        painel = 'tecnicos'

    document.querySelector(`.t-${painel}`).style.display = 'flex'

    // FILTRAGEM DE DADOS;
    controles.tabelasIndicadores.filtros ??= {}

    controles.tabelasIndicadores.filtros = id
        ? { 'id': { op: '=', value: id } }
        : { 'aba': { op: '=', value: aba } }

    await paginacao()

}

async function linPda(orcamento) {

    const { pda, estado, snapshots } = orcamento || {}
    const { cliente, cidade, tags, tecnicos } = snapshots || {}
    const idOrcamento = orcamento.id

    const mod = (texto, elemento) => `
        <div style="${vertical}; gap: 2px;">
            <span><b>${texto}:</b></span>
            ${elemento}
        </div>`

    const acoes = await pesquisarDB({
        base: 'acoes',
        filtros: {
            'origem.id': { op: '=', value: idOrcamento }
        }
    })

    const strAcoes = acoes.resultados
        .map(dados => {

            const idAcao = dados.id
            const [ano, mes, dia] = dados.prazo.split('-')
            const prazo = `${dia}/${mes}/${ano}`

            const estilo = dados?.status === 'concluído'
                ? 'concluído'
                : dtPrazo(dados?.prazo)
                    ? 'atrasado'
                    : 'pendente'

            const listagemResp = Array.isArray(dados?.responsavel)
                ? dados?.responsavel.join('<br>')
                : dados?.responsavel || ''

            return `
            <div style="${horizontal}; text-align: left; width: 100%; gap: 0.5rem;">
                <div class="etiqueta-${estilo}">
                    <span><b>Ação:</b> ${dados?.acao || ''}</span>
                    <div><b>Responsáveis:</b> <br>
                        ${listagemResp}
                    </div>
                    <span><b>Prazo:</b> ${prazo}</span>
                    ${dados.registro
                    ? `<span><b>criado em:</b> ${new Date(dados.registro).toLocaleString('pt-BR')}</span>`
                    : ''}
                </div>
                <img src="imagens/editar.png" style="width: 1.5rem;" onclick="formAcao('${idOrcamento}', '${idAcao}')">
            </div>
            `}).join('')

    const opAbas = abas
        .sort((a, b) => a.localeCompare(b))
        .map(aba => `<option ${orcamento?.aba == aba ? 'selected' : ''}>${aba}</option>`)
        .join('')

    const selectAbas = `
        <select class="etiquetas" onchange="atualizarAba(this, '${idOrcamento}')">
            <option></option>
            ${opAbas}
        </select>
    `

    const existente = `
        <div style="${vertical}; gap: 2px; text-align: left;">
            <span><b>Número: </b>${orcamento?.dados_orcam?.contrato || ''}</span>
            <span><b>Cliente: </b>${cliente}</span>
            <span><b>Data: </b>${orcamento?.dados_orcam?.data || '...'}</span>
            <span><b>Cidade: </b>${cidade}</span>
            <span><b>Valor: </b> ${dinheiro(orcamento?.total_geral)}</span>

            ${mod('Status', seletorStatus(orcamento))}

        </div>
    `
    const novo = `
        <div style="${vertical}; gap: 5px; text-align: left;">
            <span><b>Projeto:</b> ${orcamento?.projeto || 'Projeto sem nome'}</span>
            <div style="${horizontal}; justify-content: end; align-items: end; gap: 5px;">

                ${mod('Estado', `
                    <select class="etiquetas" data-campo="estado" onchange="atualizarCampo(this, '${idOrcamento}')">
                        <option></option>
                        ${Object.keys(posicoesEstados).map(e => `<option ${estado == e ? 'selected' : ''}>${e}</option>`).join('')}
                    </select>
                    `)}
                
                <img src="imagens/editar.png" onclick="editarLinPda({idOrcamento:'${idOrcamento}'})">
                <img src="imagens/projeto.png" onclick="confirmarCriarOrcamento('${idOrcamento}')">
            </div>
        </div>
    `

    // Tags;
    const listaTags = []
    for (const tag of Object.values(tags || {})) {
        listaTags.push(modeloTag(tag, idOrcamento))
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
                    ${listaTags.join('')}
                </div>
            </div>
        </td>
        <td>
            <div style="${vertical}; gap: 2px; padding: 1rem;">
                <img onclick="tecnicosAtivos('${idOrcamento}')" src="imagens/baixar.png" style="width: 1.5rem;">
                <div style="${vertical}; gap: 2px;">
                    ${tecnicos.map(t => `<span class="etiqueta-pendente">${t}</span>`).join('')}
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

        <td>
            <div style="${horizontal}; gap: 5px;">
                <div class="comentario-padrao" onclick="editarComentario('${idOrcamento}')">${pda?.comentario || ''}</div>
            </div>
        </td>

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
        </td>`

    return `<tr>${tds}</tr>`

}

async function editarComentario(id) {

    const { pda } = await recuperarDado('dados_orcamentos', id) || {}

    const linhas = [
        {
            texto: 'Comentário',
            elemento: `<textarea id="comentarioPda">${pda?.comentario || ''}</textarea>`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarComentarioPda('${id}')` }
    ]

    popup({ linhas, botoes, titulo: 'Edição de Comentário' })

}

async function salvarComentarioPda(id) {

    overlayAguarde()
    const comentarioPda = document.getElementById('comentarioPda')
    const comentario = comentarioPda?.value || ''

    await enviar(`dados_orcamentos/${id}/pda/comentario`, comentario)
    removerPopup(null, false)
}

async function contadoresAbas() {

    const contadores = await contarPorCampo({ base: 'dados_orcamentos', path: 'aba' })

    for (const [aba, total] of Object.entries(contadores)) {

        const spanContador = document.getElementById(`contador-${aba}`)
        if (spanContador)
            spanContador.textContent = total

    }
}

function criarLinhaTecnico(tecnico) {

    return `
    <tr>
        <td>${tecnico.nome}</td>
        <td></td>
    </tr>
    `
}

function linAcoes(pda) {

    const { id, responsavel, status, usuario, registro, prazo, acao, snapshots } = pda || {}

    const contrato = snapshots?.contrato || ''
    const aba = snapshots?.aba || ''

    const estilo = status === 'concluído'
        ? 'concluído'
        : dtPrazo(prazo)
            ? 'atrasado'
            : 'pendente'

    const [ano, mes, dia] = prazo.split('-')
    const prazoConvertido = `${dia}/${mes}/${ano}`
    const dtRegistro = registro
        ? `<span><b>criado em: </b>${new Date(registro).toLocaleString('pt-BR')}</span>`
        : ''

    const criadoPor = usuario
        ? `<span><b>criado por: </b>${usuario}</span>`
        : ''

    const listagemResp = Array.isArray(responsavel)
        ? responsavel.join('<br>')
        : responsavel || ''

    const linha = `
        <tr>    
            <div class="etiqueta-${estilo}" style="width: 95%; flex-direction: row; gap: 0.5rem; margin: 1px;">

                <img src="imagens/pesquisar2.png" style="width: 2rem;" onclick="irAcao('${id}')">

                <div style="${vertical};">
                    <span><b>ID:</b> ${contrato}</span>
                    <span><b>Aba:</b> ${aba}</span>
                    <div style="white-space: pre-wrap;"><b>Ação:</b> ${acao || ''}</div>
                    <div><b>Responsáveis:</b> <br>
                        ${listagemResp}
                    </div>
                    <span><b>Prazo:</b> ${prazoConvertido}</span>
                    ${dtRegistro}
                    ${criadoPor}
                </div>
            </div>
        </tr>`

    return linha
}

async function irAcao(idAcao) {

    const { origem } = await recuperarDado('acoes', idAcao) || {}

    if (origem.base == 'dados_orcamentos') {
        await irORC(origem.id)

    } else if (origem.base == 'dados_manutencao') {

        await telaChamados()
        await criarManutencao(origem.id)

    }

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

async function atualizarContadoresAcoes() {

    const contadores = JSON.parse(localStorage.getItem('contadores')) || []

    if (!contadores[acesso.usuario])
        contadores[acesso.usuario] = { estrela: 'N' }

    let filtroUsuario = {}

    Object.entries(contadores)
        .forEach(([u, conf]) => {
            if (conf.estrela == 'S' && u !== 'Geral')
                filtroUsuario = { 'responsavel': { op: '=', value: u } }

            criarGaveta(u, conf)
        })

    return filtroUsuario
}

async function filtrarPorGaveta(titulo, usuario) {

    controles.acoes.filtros ??= {}

    let filtros = {}

    if (titulo == 'atrasado') {

        filtros = {
            'prazo': { op: '<d', value: new Date().toLocaleDateString() },
            'status': { op: '!=', value: 'concluído' }
        }

    } else if (titulo == 'pendente') {

        filtros = {
            'prazo': { op: '>=d', value: new Date().toLocaleDateString() },
            'status': { op: '=', value: 'pendente' }
        }

    } else if (titulo == 'concluído') {

        filtros = {
            'status': { op: '=', value: 'concluído' }
        }
    }

    // Acrescentar filtros de status;
    controles.acoes.filtros = filtros

    // Filtros de usuário;
    if (usuario == 'Geral')
        delete controles.acoes.filtros.responsavel
    else
        controles.acoes.filtros.responsavel = { op: 'includes', value: usuario }

    await paginacao()

}

async function criarGaveta(usuario = null, conf = {}) {

    const spanContador = document.querySelector('[name="contador"]')
    const usuarioSelecionado = spanContador?.id

    if (
        usuario == null ||
        usuario === '' ||
        usuario === 'undefined' ||
        usuario === undefined
    ) {
        usuario = usuarioSelecionado
    }

    if (
        !usuario ||
        usuario === 'undefined' ||
        usuario === 'null'
    ) {
        usuario = 'Geral'
    }

    const contadores = JSON.parse(localStorage.getItem('contadores')) || {}
    contadores[usuario] = { estrela: conf.estrela || 'N' }

    localStorage.setItem('contadores', JSON.stringify(contadores))

    const box = (titulo, valor, cor) => {

        return `
        <div 
            class="ind" 
            style="border-left: 6px solid ${cor};" 
            onclick="filtrarPorGaveta('${titulo}', '${usuario}')">
            <span style="font-size: 14px; color: #444;">${inicialMaiuscula(titulo)}</span>
            <strong style="font-size: 22px; margin-top:5px;" id="gaveta_${usuario}_${titulo}">${valor}</strong>
        </div>`
    }

    const filtros = usuario == 'Geral'
        ? {}
        : { 'responsavel': { op: 'includes', value: usuario } }

    const contagem = await contarPorCampo({
        base: 'acoes',
        path: 'status',
        filtros
    })

    const resposta = await contarPorCampo({
        base: 'acoes',
        path: 'prazo',
        filtros: {
            ...filtros,
            'status': { op: '=', value: 'pendente' }
        }
    })

    const totais = somarPend(resposta)

    // Atualizar se existir, sem recriar;
    let continuar = false
    for (const [tipo, total] of Object.entries(totais)) {
        const indicExistente = document.getElementById(`gaveta_${usuario}_${tipo}`)
        if (indicExistente)
            indicExistente.textContent = total

        continuar = indicExistente
    }

    if (continuar)
        return

    const botaoCancelar = usuario == acesso.usuario
        ? ''
        : `<img src="imagens/cancel.png" style="width: 1.5rem;" onclick="removerContador('${usuario}')">`

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
        </div>`

    const gaveta = `
        <div id="gaveta_${usuario}" style="${vertical}; gap: 5px; padding: 0.5rem;">
            ${conteudo}
        </div>`

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

    if (usuario == 'Geral')
        delete controles.acoes.filtros.responsavel
    else
        controles.acoes.filtros.responsavel = { op: '=', value: usuario }


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

    await enviar(`dados_orcamentos/${idOrcamento}/aba`, '')
    removerPopup()

    await contadores()

}

async function atualizarAba(select, idOrcamento) {

    await enviar(`dados_orcamentos/${idOrcamento}/aba`, select.value)

}

async function atualizarCampo(select, idOrcamento) {

    const campo = select.dataset.campo
    const valor = select.value

    await enviar(`dados_orcamentos/${idOrcamento}/pda/${campo}`, valor)

}

async function alterarDatas(input, campo, idOrcamento) {

    const data = input.value
    input.classList = data ? 'etiqueta-concluído' : 'etiqueta-pendente'
    await enviar(`dados_orcamentos/${idOrcamento}/${campo}`, data)

}

async function formAcao(idOrcamento, idAcao) {

    const { prazo, status, acao, responsavel = [] } = await recuperarDado('acoes', idAcao) || {}

    const linhas = [
        { texto: 'Ação', elemento: `<textarea name="acao">${acao || ''}</textarea>` },
        {
            texto: 'Responsável',
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" onclick="incluirResponsavel()">
                    <div style="${vertical}" id="responsaveis"></div>
                </div>
            `
        },
        { texto: 'Prazo da ação', elemento: `<input name="prazo" type="date" value="${prazo || ''}">` },
        {
            texto: 'Status', elemento: `
            <select name="statusAcao">
                ${['pendente', 'concluído'].map(op => `<option ${status == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            ` }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarAcao('${idOrcamento}' ${idAcao ? `, '${idAcao}'` : ''})` }
    ]

    if (idAcao)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirAcao('${idAcao}')` })

    popup({ linhas, botoes, titulo: 'Ações' })

    for (const r of responsavel)
        incluirResponsavel(r)

}

async function incluirResponsavel(usuario) {

    const u = usuario || ID5digitos()

    controlesCxOpcoes[u] = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const span = `
        <div style="${horizontal}; gap: 3px;">
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
            <span 
                class="opcoes" 
                name="${u}" 
                ${usuario ? `id="${usuario}"` : ''}
                onclick="cxOpcoes('${u}')">
                    ${usuario || 'Selecione'}
            </span>
        </div>
    `

    const divResponsaveis = document.getElementById('responsaveis')

    divResponsaveis.insertAdjacentHTML('beforeend', span)

}

async function confirmarExcluirAcao(idAcao) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirAcao('${idAcao}')` }
    ]

    popup({ botoes, mensagem: 'Tem certeza?', nra: false })

}

async function excluirAcao(idAcao) {

    await deletar(`acoes/${idAcao}`)

}

async function salvarAcao(idOrcamento, idAcao = crypto.randomUUID()) {

    overlayAguarde()

    const painel = document.querySelector('.painel-padrao')
    const el = (nome) => {
        const elem = painel.querySelector(`[name="${nome}"]`)
        return elem
    }

    const divResp = document.getElementById('responsaveis')
    const responsavel = [...divResp.querySelectorAll('span')]
        .filter(span => span.textContent != 'Selecione')
        .map(span => span.id)

    const acao = el('acao').value
    const prazo = el('prazo').value
    const status = el('statusAcao').value

    if (!prazo || !responsavel)
        return popup({ mensagem: 'Preencha o prazo e/ou responsável da ação' })

    const a = {
        origem: {
            id: idOrcamento,
            base: 'dados_orcamentos'
        },
        usuario: acesso.usuario,
        responsavel,
        acao,
        prazo,
        status,
        registro: new Date().getTime()
    }

    await enviar(`acoes/${idAcao}`, a)

    removerPopup()

}

async function editarLinPda({ idOrcamento }) {

    const { aba, projeto, estado } = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    const linhas = [
        {
            texto: 'Nome do Projeto',
            elemento: `<textarea name="projeto">${projeto || ''}</textarea>`
        },
        {
            texto: 'Estado',
            elemento: `
                <select name="estado">
                    ${Object.keys(posicoesEstados).map(e => `<option ${estado == e ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Aba',
            elemento: `
                <select name="aba">
                    ${abas.map(a => `<option ${aba == a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
            `
        }
    ]

    const funcao = idOrcamento
        ? `salvarCartao('${idOrcamento}')`
        : 'salvarCartao()'

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    if (idOrcamento && idOrcamento.slice(0, 3) == 'PDA')
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExclusaoOrcamentoBase('${idOrcamento}')` })

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

    if (idOrcamento) {
        await enviar(`dados_orcamentos/${idOrcamento}/projeto`, projeto)
        await enviar(`dados_orcamentos/${idOrcamento}/estado`, estado)
        await enviar(`dados_orcamentos/${idOrcamento}/aba`, aba)
    } else {
        idOrcamento = `PDA_${crypto.randomUUID()}`
        await enviar(`dados_orcamentos/${idOrcamento}`, dados)
    }

    removerPopup()

}
