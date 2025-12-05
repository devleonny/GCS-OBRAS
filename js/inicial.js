async function telaInicial() {

    document.querySelector('[name="titulo"]').textContent = 'GCS'

    const guias = ['PDA', 'Acompanhamento Obras']

    const acumulado = `
        <div class="tela-gerenciamento">
            <div style="${horizontal}; gap: 5px; width: 100%;">
                ${guias.map(guia => `
                    <div style="opacity: 0.5;" class="aba-toolbar" id="toolbar-${guia}" onclick="mostrarGuia('${guia}')">
                        <label>${guia}</label>
                    </div>
                    `).join('')}
            </div>
            <div id="tabelas">
                ${await carregarPDA()}
            </div>
        </div>
    `

    const tGerenciamento = document.querySelector('.tela-gerenciamento')
    if (!tGerenciamento) {
        tela.innerHTML = acumulado
        criarMenus('inicial')
    }

    dados_clientes = await recuperarDados('dados_clientes')
    dados_orcamentos = await recuperarDados('dados_orcamentos')
    tagsTemporarias = await recuperarDados('tags_orcamentos')
    const pda = await recuperarDados('pda')

    for (const [idOrcamento, dados] of Object.entries(pda)) {
        linPda(idOrcamento, dados)
        console.log(dados_orcamentos[idOrcamento])
    }

    mostrarGuia('PDA')

}

function mostrarGuia(nomeGuia) {

    // Todas as guias e abas ocultadas;
    const tabelas = document.querySelectorAll('[name="tabela"]')
    for (const t of tabelas) t.style.display = 'none'

    const guias = document.querySelectorAll('.aba-toolbar')
    for (const g of guias) g.style.opacity = 0.5

    // Exibir apenas a selecionada;
    const aba = document.getElementById(`toolbar-${nomeGuia}`)
    aba.style.opacity = 1

    const tabela = document.querySelector(`.tabela-${nomeGuia}`)
    tabela.style.display = 'flex'

}

function carregarPDA() {

    const colunas = ['Orçamento', 'Cliente', 'Tag', 'Técnicos', 'Início', 'Término', 'Ação Necessário', '']

    const ths = colunas.map(col => `<th>${col}</th>`).join('')

    const acumulado = `
        <div class="tabela-PDA" name="tabela">
            <div class="topo-tabela">
                <button onclick="adicionarLinPda()">Adicionar Linha</button>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                    </thead>
                    <tbody id="pda"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    return acumulado
}

function auxCliPda(codOmie) {

    const cliente = dados_clientes[codOmie] || {}

    if (!cliente) return

    return `
    ${cliente.nome}<br>
    ${cliente.cnpj}<br>
    ${cliente.cidade}<br>
    `
}

function linPda(idOrcamento, dados) {

    const orcamento = dados_orcamentos[idOrcamento] || {}
    const codCliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = dados_clientes?.[codCliente] || {}
    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const acoes = Object.entries(dados.acoes || {})
        .map(([idAcao, dados]) => `
            <div style="${horizontal}; width: 100%; gap: 0.5rem;">
                <div class="etiqueta-${dados?.status == 'concluído' ? 'ok' : 'pendente'}">
                    <span><b>Ação:</b> ${dados?.acao || ''}</span>
                    <span><b>Responsável:</b> ${dados?.responsavel || ''}</span>
                    <span><b>Prazo:</b> ${dados?.prazo || ''}</span>
                    ${dados.registro
                ? `<div style="${horizontal}; justify-content: end; width: 100%;">
                        <span><b>criado em: </b>${new Date(dados.registro).toLocaleString('pt-BR')}</span>
                    </div>`
                : ''}
                </div>
                <img src="imagens/editar.png" style="width: 1.5rem;" onclick="formAcao('${idOrcamento}', '${idAcao}')">
            </div>
            `).join('')

    const tds = `
        <td>${orcamento?.dados_orcam?.contrato || ''}</td>
        <td>
            <div style="${vertical}; gap: 2px;">
                <span>${cliente?.nome || '...'}</span>
                <span>${cliente?.cidade || '...'}</span>
                <span>${dinheiro(orcamento?.total_geral)}</span>
                <select name="status" class="opcoesSelect" onchange="alterarStatus(this, '${idOrcamento}')">
                    ${opcoes}
                </select>
            </div>
        </td>
        <td>
            <div style="${horizontal}; justify-content: space-between; width: 100%; align-items: start; gap: 2px;">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${gerarLabelsAtivas(orcamento?.tags || {})}
                </div>
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="tagsOrcamento('${idOrcamento}')">
            </div>
        </td>
        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px;">
                <img onclick="id_orcam = '${idOrcamento}'; tecnicosAtivos()" src="imagens/baixar.png" style="width: 1.5rem;">
                <div style="${vertical}; gap: 2px; width: 100%;">
                    ${1}
                </div>
            </div>
        </td>
        <td>
            <input 
            style="width: max-content;"
            type="date" 
            class="etiqueta-${dados.inicio ? 'ok' : 'pendente'}"
            value="${dados?.inicio || ''}" 
            onchange="alterarDatas(this, 'inicio', '${idOrcamento}')">
        </td>
        <td>
            <input 
            style="width: max-content;"
            type="date" 
            class="etiqueta-${dados.termino ? 'ok' : 'pendente'}"
            value="${dados?.termino || ''}" 
            onchange="alterarDatas(this, 'termino', '${idOrcamento}')">
        </td>
        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px; min-width: 300px;">
                <img onclick="formAcao('${idOrcamento}')" src="imagens/baixar.png" style="width: 1.5rem;">
                <div style="${vertical}; gap: 2px; width: 100%;">
                    ${acoes}
                </div>
            </div>
        </td>
        <td>
            <img onclick="abrirAtalhos('${idOrcamento}')" src="imagens/pesquisar2.png" style="width: 1.5rem;">
        </td>
    `

    const trExistente = document.getElementById(idOrcamento)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('pda').insertAdjacentHTML('beforeend', `<tr id="${idOrcamento}">${tds}</tr>`)
}

async function alterarDatas(input, campo, idOrcamento) {

    const pda = await recuperarDado('pda', idOrcamento)
    const data = input.value

    input.classList = data ? 'etiqueta-ok' : 'etiqueta-pendente'

    pda[campo] = data

    await inserirDados({ [idOrcamento]: pda }, 'pda')
    enviar(`pda/${idOrcamento}/${campo}`, data)

}

async function formAcao(idOrcamento, idAcao) {

    const pda = await recuperarDado('pda', idOrcamento)
    const dados = pda?.acoes?.[idAcao] || {}

    const linhas = [
        { texto: 'Ação', elemento: `<textarea name="acao">${dados?.acao || ''}</textarea>` },
        {
            texto: 'Responsável',
            elemento: `<span 
            class="opcoes" 
            name="responsavel" 
            ${dados.responsavel ? `id="${dados.responsavel}"` : ''}
            onclick="cxOpcoes('responsavel', 'dados_setores', ['usuario', 'setor'])">
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

    const form = new formulario({ linhas, botoes, titulo: 'Ações' })
    form.abrirFormulario()

}

async function salvarAcao(idOrcamento, idAcao) {

    overlayAguarde()

    idAcao = idAcao || ID5digitos()

    const el = (nome) => {
        const elem = document.querySelector(`[name="${nome}"]`)
        return elem
    }

    const responsavel = el('responsavel').id
    const acao = el('acao').value
    const prazo = el('prazo').value
    const status = el('statusAcao').value

    const a = {
        responsavel,
        acao,
        prazo,
        status,
        registro: new Date().getTime()
    }

    const pda = await recuperarDado('pda', idOrcamento)
    pda.acoes ??= {}
    pda.acoes[idAcao] = a

    await inserirDados({ [idOrcamento]: pda }, 'pda')
    enviar(`pda/${idOrcamento}/acoes/${idAcao}`, a)

    removerPopup()
    await telaInicial()
}

function adicionarLinPda() {

    const linhas = [
        {
            texto: 'Orçamento',
            elemento: `
            <span 
            class="opcoes" name="orcamento" 
            onclick="cxOpcoes('orcamento', 'dados_orcamentos', ['dados_orcam/contrato', 'dados_orcam/omie_cliente[auxCliPda]', 'total_geral[dinheiro]'])">
                Selecione
            </span>`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'salvo', funcao: `salvarCartao()` }
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Adicionar linha' })
    form.abrirFormulario()

}

async function salvarCartao() {

    overlayAguarde()

    const span = document.querySelector('[name="orcamento"]')
    if (!span.id) return
    const idOrcamento = span.id

    await inserirDados({ [idOrcamento]: {} }, 'pda')
    enviar(`pda/${idOrcamento}`, {})

    await telaInicial()

    removerPopup()

}

async function origemDados(toggle, inicial) {

    overlayAguarde()
    origem = toggle.checked ? 'novos' : 'antigos'
    const track = document.querySelector('.track')
    const thumb = document.querySelector('.thumb')

    sessionStorage.setItem('origem', origem)

    if (!track) return

    if (origem == 'novos') {
        toggle.checked = true
        document.body.style.background = 'linear-gradient(45deg, #249f41, #151749)'
        track.style.backgroundColor = "#4caf50"
        thumb.style.transform = "translateX(0)"
    } else {
        toggle.checked = false
        document.body.style.background = 'linear-gradient(45deg, #B12425, #151749)'
        track.style.backgroundColor = "#B12425"
        thumb.style.transform = "translateX(26px)"
    }

    if (!inicial) await executar(funcaoTela)

    removerOverlay()
    precosDesatualizados(true)
}

function interruptorCliente(mostrar, inicial) {

    origem = sessionStorage.getItem('origem') || 'novos'
    const interruptor = document.querySelector('.interruptor')

    if (!mostrar) return interruptor.innerHTML = ''

    const acumulado = `
        <div id="interruptorOrigem" class="gatilhos-interruptor">
            <span>Clientes novos</span>

            <label style="position: relative; display: inline-block; width: 50px; height: 24px;">

                <input onchange="origemDados(this);" type="checkbox" id="toggle" style="opacity:0; width:0; height:0;" ${origem == 'novos' ? 'checked' : ''}>
                
                <span class="track"></span>
                <span class="thumb"></span>

            </label>

            <span>Antigos</span>
        </div>
    `
    const gatilhos = document.getElementById('interruptorOrigem')
    if (!gatilhos) interruptor.innerHTML = acumulado

    origemDados({ checked: origem == 'novos' }, inicial)

}

async function filtrarArquivados(remover) {
    const tagArquivado = document.querySelector('[name="tagArquivado"]')
    if (remover) {
        naoArquivados = true
    } else {
        naoArquivados = naoArquivados ? false : true
    }

    if (!naoArquivados) {
        const balao = `
        <div name="tagArquivado" class="tag">
            <img style="width: 1.5rem;" src="imagens/desarquivar.png">
            <span>Arquivados</span>
            <img style="width: 1.2rem;" src="imagens/cancel.png" onclick="filtrarArquivados(true)">
        </div>
        `
        baloes.insertAdjacentHTML('beforeend', balao)
    } else {
        tagArquivado.remove()
    }

    await telaOrcamentos()
}

async function filtrarMeus(remover) {
    const tagMeus = document.querySelector('[name="tagMeus"]')
    if (remover) {
        meusOrcamentos = true
    } else {
        meusOrcamentos = meusOrcamentos ? false : true
    }

    if (!meusOrcamentos) {
        const balao = `
        <div name="tagMeus" class="tag">
            <img style="width: 1.5rem;" src="imagens/painelcustos.png">
            <span>Meus orcaçamentos</span>
            <img style="width: 1.2rem;" src="imagens/cancel.png" onclick="filtrarMeus(true)">
        </div>
        `
        baloes.insertAdjacentHTML('beforeend', balao)
    } else {
        tagMeus.remove()
    }

    await telaOrcamentos()
}

