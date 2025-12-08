const filtroPda = {}

async function telaInicial() {

    document.querySelector('[name="titulo"]').textContent = 'GCS'

    const guias = ['Acompanhamento Obras', 'PDA']

    const acumulado = `
        <div id="loading" style="${horizontal};">
            <img src="gifs/loading.gif" style="width: 5rem;">
            <span style="color: white;">Carregando tabelas...</span>
        </div>
        <div class="tela-gerenciamento">
            <div style="${horizontal}; gap: 5px; width: 100%;">
                ${guias.map(guia => `
                    <div style="opacity: 0.5;" class="aba-toolbar" id="toolbar-${guia}" onclick="mostrarGuia('${guia}')">
                        <label>${guia}</label>
                    </div>
                    `).join('')}
            </div>
            <div id="tabelas" style="width: 100%;">
                ${carregarPDA()}
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
    const ativos = []

    for (const [idOrcamento, dados] of Object.entries(pda)) {
        ativos.push(idOrcamento)
        linPda(idOrcamento, dados)
    }

    const trs = document.querySelectorAll('#pda tr')
    for (const tr of trs) if (!ativos.includes(tr.id)) tr.remove()

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

    const loading = document.getElementById('loading')
    if (loading) loading.style.display = 'none'

    const tPda = document.querySelector('.tela-gerenciamento')
    if (tPda) tPda.style.display = 'flex'

}

async function sincronizarPda() {
    overlayAguarde()
    await sincronizarDados('pda')
    await sincronizarDados('dados_clientes')
    await sincronizarDados('dados_orcamentos')
    await telaInicial()
    removerOverlay()
}

function carregarPDA() {

    const colunas = ['Cliente', 'Tags', 'Técnicos', 'Início', 'Término', 'Serviço', 'Comentários', 'Ação Necessário', 'Detalhes', 'Excluir']

    const ths = colunas.map(col => `<th>${col}</th>`).join('')

    const pesquisas = colunas.map((op, i) => `<th style="background-color: white; text-align: left;" oninput="pesquisarGenerico('${i}', this.textContent, filtroPda, 'pda')" contentEditable="true"></th>`).join('')

    const acumulado = `
        <div class="tabela-PDA" name="tabela">
            <div class="topo-tabela">
                <div style="${horizontal}; gap: 5px; padding: 0.5rem;">
                    <img src="imagens/baixar.png" onclick="adicionarLinPda()">
                    <img src="imagens/atualizar3.png" onclick="sincronizarPda()">
                </div>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisas}</tr>
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

    const orcamento = dados_orcamentos[idOrcamento]
    const codCliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = dados_clientes?.[codCliente] || {}
    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const tecs = (orcamento?.checklist?.tecnicos || [])
        .map(codTec => {
            const cliente = dados_clientes?.[codTec] || {}
            return `<div class="etiquetas">${cliente?.nome || '...'}</div>`
        }).join('')

    const dtPrazo = (data) => {
        if (!data) return {}

        const [ano, mes, dia] = data.split('-')
        const dataPrazo = new Date(`${ano}-${mes}-${dia}T00:00:00`)
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)

        const atrasado = hoje > dataPrazo

        return {
            data: `${dia}/${mes}/${ano}`,
            estilo: atrasado ? 'atrasado' : 'pendente'
        }
    }

    const acoes = Object.entries(dados.acoes || {})
        .map(([idAcao, dados]) => {

            const formato = dtPrazo(dados?.prazo)

            return `
            <div style="${horizontal}; width: 100%; gap: 0.5rem;">
                <div class="etiqueta-${dados?.status == 'concluído' ? 'ok' : formato.estilo}">
                    <span><b>Ação:</b> ${dados?.acao || ''}</span>
                    <span><b>Responsável:</b> ${dados?.responsavel || ''}</span>
                    <span><b>Prazo:</b> ${formato.data}</span>
                    ${dados.registro
                    ? `<span><b>criado em: </b>${new Date(dados.registro).toLocaleString('pt-BR')}</span>`
                    : ''}
                </div>
                <img src="imagens/editar.png" style="width: 1.5rem;" onclick="formAcao('${idOrcamento}', '${idAcao}')">
            </div>
            `}).join('')

    const existente = `
        <div style="${vertical}; gap: 2px; text-align: left;">
            <span><b>Número: </b>${orcamento?.dados_orcam?.contrato || ''}</span>
            <span><b>Cliente: </b>${cliente?.nome || '...'}</span>
            <span><b>Data: </b>${orcamento?.dados_orcam?.data || '...'}</span>
            <span><b>Cidade: </b>${cliente?.cidade || '...'}</span>
            <span><b>Valor: </b> ${dinheiro(orcamento?.total_geral)}</span>
            <select name="status" class="etiquetas" onchange="alterarStatus(this, '${idOrcamento}')">
                ${opcoes}
            </select>
        </div>
    `
    const novo = `
        <div style="${horizontal}; gap: 5px;">
            <img src="imagens/projeto.png" onclick="criarOrcamentoPda('${idOrcamento}')">
            <textarea class="etiquetas" style="width: 100%;" oninput="mostrarBtn(this)">${dados.nome || ''}</textarea>
            <img data-campo="nome" onclick="atualizarPda(this, '${idOrcamento}')" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
        </div>
    `

    const tags = `
        <div style="${horizontal}; justify-content: space-between; width: 100%; align-items: start; gap: 2px;">
            <div name="tags" style="${vertical}; gap: 1px;">
                ${gerarLabelsAtivas(orcamento?.tags || {})}
            </div>
            <img 
                src="imagens/etiqueta.png" 
                style="width: 1.2rem;" 
                onclick="tagsOrcamento('${idOrcamento}')">
        </div>
    `

    const tds = `
        <td>
            ${orcamento ? existente : novo}
        </td>
        <td>
            ${orcamento ? tags : ''}
        </td>
        <td>
            <div style="${horizontal}; justify-content: start; align-items: start; gap: 2px;">
                <img onclick="id_orcam = '${idOrcamento}'; tecnicosAtivos()" src="imagens/baixar.png" style="width: 1.5rem;">
                <div style="${vertical}; gap: 2px; width: 100%;">
                    ${tecs}
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
            <div style="${horizontal}; gap: 5px;">
                <textarea oninput="mostrarBtn(this)"></textarea>
                <img data-campo="servico" onclick="atualizarPda(this, '${idOrcamento}')" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
            </div>
        </td>
        <td>
            <div style="${horizontal}; gap: 5px;">
                <textarea oninput="mostrarBtn(this)"></textarea>
                <img data-campo="comentario" onclick="atualizarPda(this, '${idOrcamento}')" style="display: none; width: 1.5rem;" src="imagens/concluido.png">
            </div>
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
        <td>
            <img onclick="confirmarExcluirPda('${idOrcamento}')" src="imagens/cancel.png" style="width: 1.5rem;">
        </td>
    `

    const trExistente = document.getElementById(idOrcamento)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('pda').insertAdjacentHTML('beforeend', `<tr id="${idOrcamento}">${tds}</tr>`)
}

async function criarOrcamentoPda(id) {

    const orcamento = { id }
    baseOrcamento(orcamento)
    await telaCriarOrcamento()

}

function confirmarExcluirPda(idOrcamento) {
    const acumulado = `
    <div style="background-color: #d2d2d2; gap: 1rem; padding: 1rem; ${horizontal};">
        <span>Tem certeza?</span>
        <button onclick="excluirPda('${idOrcamento}')">Confirmar</buttton>
    </div>
    `

    popup(acumulado, 'Pense bem...', true)
}

async function excluirPda(idOrcamento) {

    overlayAguarde()
    await deletarDB('pda', idOrcamento)
    deletar(`pda/${idOrcamento}`)
    await telaInicial()
    removerPopup()

}

async function atualizarPda(img, idOrcamento) {

    const textarea = img.previousElementSibling
    const info = textarea.value
    const campo = img.dataset.campo

    const pda = await recuperarDado('pda', idOrcamento)
    pda[campo] = info

    await inserirDados({ [idOrcamento]: pda }, 'pda')
    enviar(`pda/${idOrcamento}/${campo}`, info)

    img.style.display = 'none'

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

    id_orcam = idOrcamento

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

    if (idAcao) botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirAcao('${idAcao}')` })

    const form = new formulario({ linhas, botoes, titulo: 'Ações' })
    form.abrirFormulario()

}

async function confirmarExcluirAcao(idAcao) {

    const acumulado = `
        <div style="${horizontal}; background-color: #d2d2d2; gap: 2rem; padding: 1rem;">
            <span>Tem certeza?</span>
            <button onclick="excluirAcao('${idAcao}')">Confirmar</button>
        </div>
    `
    popup(acumulado, 'Pense bem...', true)

}

async function excluirAcao(idAcao) {

    overlayAguarde()

    const pda = await recuperarDado('pda', id_orcam)

    delete pda.acoes[idAcao]

    await inserirDados({ [id_orcam]: pda }, 'pda')
    deletar(`pda/${id_orcam}/acoes/${idAcao}`)

    await telaInicial()

    removerPopup()
    removerPopup()

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
            <div style="${horizontal}; gap: 5px;">
                <div id="caixaSelecaoOrcamento" data-existente="S">
                    <span 
                    class="opcoes" name="orcamento" 
                    onclick="cxOpcoes('orcamento', 'dados_orcamentos', ['dados_orcam/contrato', 'dados_orcam/omie_cliente[auxCliPda]', 'total_geral[dinheiro]'])">
                        Selecione
                    </span>
                </div>
                <img onclick="alterarModo()" src="imagens/ajustar.png">
            </div>
            `
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'salvo', funcao: `salvarCartao()` }
    ]

    const form = new formulario({ linhas, botoes, titulo: 'Adicionar linha' })
    form.abrirFormulario()

}

function alterarModo() {

    const cxSel = document.getElementById('caixaSelecaoOrcamento')
    const existente = cxSel.dataset.existente

    if (existente == 'S') {
        const id = unicoID()
        cxSel.innerHTML = `<textarea name="orcamento" id="${id}"></textarea>`
        cxSel.dataset.existente = 'N'

    } else {
        cxSel.innerHTML = `
            <span 
            class="opcoes" name="orcamento" 
            onclick="cxOpcoes('orcamento', 'dados_orcamentos', ['dados_orcam/contrato', 'dados_orcam/omie_cliente[auxCliPda]', 'total_geral[dinheiro]'])">
                Selecione
            </span>
        `
        cxSel.dataset.existente = 'S'
    }

}

async function salvarCartao() {

    overlayAguarde()

    const elemento = document.querySelector('[name="orcamento"]')
    if (!elemento.id) return
    const idOrcamento = elemento.id
    const dados = {}

    if (elemento.tagName === 'TEXTAREA') dados.nome = elemento.value

    await inserirDados({ [idOrcamento]: dados }, 'pda')
    enviar(`pda/${idOrcamento}`, dados)

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

