async function telaInicial() {

    document.querySelector('[name="titulo"]').textContent = 'GCS'

    const hora = new Date().getHours()
    const guias = ['PDA', 'Acompanhamento Obras']

    const acumulado = `
        <div class="tela-gerenciamento">
            <div style="${horizontal}; gap: 5px;">
                ${guias.map(guia => `
                    <div style="opacity: 0.5;" class="aba-toolbar" onclick="">
                        <label>${guia}</label>
                    </div>
                    `).join('')}
            </div>
            <div id="tabelas">
                ${await carregarPDA()}
            </div>
        </div>
    `
    tela.innerHTML = acumulado

    const pda = await recuperarDados('pda')

    for(const [idOrcamento, dados] of Object.entries(pda)) {
        linPda(idOrcamento, dados)
    }

    criarMenus('inicial')

}

async function carregarPDA() {

    dados_clientes = await recuperarDados('dados_clientes')
    dados_orcamentos = await recuperarDados('dados_orcamentos')

    const colunas = ['Orçamento', 'Cliente', 'Cidade', 'Valor do Orçamento', 'Status', 'Tag', 'Cliente', 'Serviço', 'Ação Necessário']

    const ths = colunas.map(col => `<th>${col}</th>`).join('')

    const acumulado = `
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

    const tds = `
        <td>${orcamento?.dados_orcam?.contrato || ''}</td>
        <td>${cliente?.nome || '...'}</td>
        <td>${cliente?.cidade || '...'}</td>
        <td>${dinheiro(orcamento?.total_geral)}</td>
        <td>
            <select name="status" class="opcoesSelect" onchange="alterarStatus(this, '${idOrcamento}')">
                ${opcoes}
            </select>
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
        <td></td>
        <td></td>
        <td>
            <div style="${vertical};gap: 2px;">
                <button>Adicionar</button>
                <div style="${vertical}; gap: 2px;"></div>
            </div>
        </td>
    `

    document.getElementById('pda').insertAdjacentHTML('beforeend', `<tr id="">${tds}</tr>`)
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

