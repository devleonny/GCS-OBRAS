// Preços a confirmar: composições cujo preço ativo tem mais de 60 dias (servidor:
// SCRIPTS/notificacoes.js, rotas /notificacoes/precos-vencidos e /validar-precos).
// A logística confere e marca "Está válido": a data do preço ativo passa a ser hoje e o item só
// volta a aparecer daqui a 60 dias. Tela inicial (bloco 'precos') e notificações abrem aqui.
// Só a permissão log. "Editar preço" abre o editor de composições por cima do painel; ao salvar,
// o websocket (dados_composicoes) recarrega a lista (recarregarPrecosVencidos).

const estadoPrecosVencidos = { precos: [], dias: 60, lpu: '', busca: '', selecionados: new Set() }
const LIMITE_LINHAS_PRECOS = 300
const chavePrecoVencido = p => `${p.lpu}|${p.codigo}`

async function abrirPrecosVencidos(lpu = null) {
    overlayAguarde()
    try {
        const { precos = [], dias = 60 } = await chamarNotificacoes('precos-vencidos')
        Object.assign(estadoPrecosVencidos, { precos, dias, lpu: lpu || '', busca: '', selecionados: new Set() })
        removerOverlay()

        const aberto = document.getElementById('painelPrecosVencidos')
        if (aberto) {
            renderizarPrecosVencidos()
            return trazerJanelaParaFrente(aberto)
        }

        const lpus = [...new Set(precos.map(p => p.lpu))].sort()
        const contagem = l => precos.filter(p => p.lpu === l).length
        popup({
            titulo: 'Preços a confirmar',
            elemento: `
                <div class="painel-precos-vencidos" id="painelPrecosVencidos">
                    <p class="precos-vencidos-aviso">
                        Preço ativo com mais de <b>${dias} dias</b>. Se continua valendo, marque e clique em
                        <b>Está válido</b>: a data passa a ser hoje e o item só volta em ${dias} dias.
                        Se mudou, clique em <b>Editar</b> na linha e lance o preço novo.
                    </p>
                    <div class="precos-vencidos-filtros">
                        <select onchange="estadoPrecosVencidos.lpu = this.value; renderizarPrecosVencidos()">
                            <option value="">Todas as LPUs (${precos.length})</option>
                            ${lpus.map(l => `<option value="${escaparAtributo(l)}" ${l === estadoPrecosVencidos.lpu ? 'selected' : ''}>${escaparAtributo(l.toUpperCase())} (${contagem(l)})</option>`).join('')}
                        </select>
                        <input type="search" placeholder="Buscar código ou descrição" oninput="estadoPrecosVencidos.busca = this.value; renderizarPrecosVencidos()">
                    </div>
                    <div class="precos-vencidos-acoes">
                        <label><input type="checkbox" id="precosVencidosTodos" onchange="selecionarFiltradosPrecos(this.checked)"> Marcar todos do filtro</label>
                        <span id="precosVencidosResumo"></span>
                        <button type="button" class="precos-vencidos-recarregar" onclick="recarregarPrecosVencidos()" title="Buscar a lista de novo">Atualizar lista</button>
                        <button type="button" class="precos-vencidos-validar" onclick="confirmarValidarPrecos()">Está válido</button>
                    </div>
                    <div class="precos-vencidos-tabela">
                        <table>
                            <thead><tr><th></th><th>Código</th><th style="text-align: left;">Descrição</th><th>LPU</th><th>Preço</th><th>Data do preço</th><th>Dias</th><th>Editar</th></tr></thead>
                            <tbody id="corpoPrecosVencidos"></tbody>
                        </table>
                    </div>
                </div>`
        })
        renderizarPrecosVencidos()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: `Falha ao carregar os preços: ${escaparAtributo(erro.message)}` })
    }
}

function precosFiltrados() {
    const { precos, lpu, busca } = estadoPrecosVencidos
    const termo = busca.trim().toLowerCase()
    return precos.filter(p => (!lpu || p.lpu === lpu) &&
        (!termo || String(p.codigo).toLowerCase().includes(termo) || String(p.descricao || '').toLowerCase().includes(termo)))
}

function renderizarPrecosVencidos() {
    const corpo = document.getElementById('corpoPrecosVencidos')
    if (!corpo) return
    const filtrados = precosFiltrados()
    const { selecionados } = estadoPrecosVencidos
    const linhas = filtrados.slice(0, LIMITE_LINHAS_PRECOS).map(p => {
        const chave = chavePrecoVencido(p)
        return `
            <tr>
                <td><input type="checkbox" data-chave="${escaparAtributo(chave)}" ${selecionados.has(chave) ? 'checked' : ''} onchange="marcarPrecoVencido(this)"></td>
                <td>${escaparAtributo(p.codigo)}</td>
                <td style="text-align: left;">${escaparAtributo(p.descricao || '')}</td>
                <td>${escaparAtributo(p.lpu.toUpperCase())}</td>
                <td>${p.valor == null || p.valor === '' ? '--' : dinheiro(p.valor)}</td>
                <td>${escaparAtributo(p.data || 'sem data')}</td>
                <td><b class="precos-vencidos-dias">${p.dias ?? '?'}</b></td>
                <td><button type="button" class="precos-vencidos-editar" title="Editar preço" data-codigo="${escaparAtributo(p.codigo)}" data-lpu="${escaparAtributo(p.lpu)}" onclick="editarPrecoVencido(this)"><img src="imagens/preco.png" alt=""> Editar</button></td>
            </tr>`
    }).join('')
    corpo.innerHTML = linhas || '<tr><td colspan="8" style="padding: 1rem;">Nenhum preço para conferir neste filtro.</td></tr>'
    if (filtrados.length > LIMITE_LINHAS_PRECOS)
        corpo.insertAdjacentHTML('beforeend', `<tr><td colspan="8" style="padding: 8px;"><small>Mostrando ${LIMITE_LINHAS_PRECOS} de ${filtrados.length}. Use a busca ou a LPU para ver os outros (o "Marcar todos do filtro" vale para os ${filtrados.length}).</small></td></tr>`)
    atualizarResumoPrecosVencidos(filtrados)
}

function atualizarResumoPrecosVencidos(filtrados = precosFiltrados()) {
    const { selecionados } = estadoPrecosVencidos
    const resumo = document.getElementById('precosVencidosResumo')
    if (resumo) resumo.textContent = `${selecionados.size} selecionado(s)`
    const todos = document.getElementById('precosVencidosTodos')
    if (todos) todos.checked = filtrados.length > 0 && filtrados.every(p => selecionados.has(chavePrecoVencido(p)))
}

function marcarPrecoVencido(caixa) {
    const { selecionados } = estadoPrecosVencidos
    caixa.checked ? selecionados.add(caixa.dataset.chave) : selecionados.delete(caixa.dataset.chave)
    atualizarResumoPrecosVencidos()
}

function selecionarFiltradosPrecos(marcar) {
    const { selecionados } = estadoPrecosVencidos
    for (const p of precosFiltrados()) marcar ? selecionados.add(chavePrecoVencido(p)) : selecionados.delete(chavePrecoVencido(p))
    renderizarPrecosVencidos()
}

// Editor de preço da tela de composições, por cima do painel (mesmo de requisições).
async function editarPrecoVencido(botao) {
    await abrirHistoricoPrecosSobre(botao.dataset.codigo, botao.dataset.lpu)
}

// Lista de novo do servidor, mantendo LPU, busca e marcados que ainda estão na lista.
async function recarregarPrecosVencidos() {
    if (!document.getElementById('painelPrecosVencidos')) return
    try {
        const { precos = [] } = await chamarNotificacoes('precos-vencidos')
        const existentes = new Set(precos.map(chavePrecoVencido))
        estadoPrecosVencidos.precos = precos
        estadoPrecosVencidos.selecionados = new Set([...estadoPrecosVencidos.selecionados].filter(c => existentes.has(c)))
        renderizarPrecosVencidos()
    } catch (erro) {
        console.error('[PRECOS] recarregar', erro)
    }
}

async function confirmarValidarPrecos() {
    const quantidade = estadoPrecosVencidos.selecionados.size
    if (!quantidade) return popup({ mensagem: 'Marque os preços que continuam válidos.' })
    const ok = await confirmarPopup({
        titulo: 'Confirmar preços',
        mensagem: `Confirmar que <b>${quantidade}</b> preço(s) continuam válidos?<br><small>A data desses preços passa a ser hoje.</small>`,
        textoConfirmar: 'Está válido'
    })
    if (!ok) return
    overlayAguarde()
    try {
        const itens = [...estadoPrecosVencidos.selecionados].map(chave => {
            const [lpu, ...codigo] = chave.split('|')
            return { lpu, codigo: codigo.join('|') }
        })
        const { atualizados } = await chamarNotificacoes('validar-precos', { itens })
        const confirmados = new Set(estadoPrecosVencidos.selecionados)
        estadoPrecosVencidos.precos = estadoPrecosVencidos.precos.filter(p => !confirmados.has(chavePrecoVencido(p)))
        estadoPrecosVencidos.selecionados = new Set()
        removerOverlay()
        renderizarPrecosVencidos()
        if (typeof criarElementosIniciais === 'function' && document.querySelector('.planoFundo')) criarElementosIniciais()
        popup({ titulo: 'Preços confirmados', mensagem: `${atualizados} preço(s) confirmado(s). Voltam a ser conferidos em ${estadoPrecosVencidos.dias} dias.`, imagem: 'imagens/concluido.png', tempo: 4 })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: `Falha ao confirmar: ${escaparAtributo(erro.message)}` })
    }
}
