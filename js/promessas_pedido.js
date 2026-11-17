// Promessas de pedido (16/11/2026, a pedido): pedido lançado sem o pedido do cliente ("Pedido pendente") ou com
// valor simbólico. O GCS cobra até ser completado (número ou "Aprovado por E-mail", valor e a OC anexada):
//   - contador na barra do topo (atalhoPromessas) com as promessas de quem está logado;
//   - janela que bloqueia a tela ao entrar e de novo a cada hora enquanto houver promessa, com o botão
//     "Lembrar depois" liberado só depois de alguns segundos;
//   - no servidor: aviso diário no sino/push para quem lançou e resumo para os gestores (gcs notificacoes.js),
//     nota do orçamento bloqueada e orçamento sem concluir (gcs fiscal.js / fluxo_itens.js).
// Dados: gcs /fluxo-itens/promessas (vw_pedido_promessas).

const INTERVALO_JANELA_PROMESSAS_MS = 60 * 60 * 1000
const ESPERA_LEMBRAR_PROMESSAS_S = 8
const estadoPromessas = { lista: [], temporizador: null, aberta: null }

const chaveJanelaPromessas = () => `promessasPedidoJanela_${acesso?.usuario || ''}`
const faltasPromessaTexto = faltas => (faltas || []).map(f => f === 'numero' ? 'pedido do cliente' : f === 'valor' ? 'valor' : f).join(' e ')

async function buscarPedidosPrometidos(todas = false) {
    const { promessas = [], gestor = false } = await apiModuloFiscal('fluxo-itens/promessas', { todas })
    return { promessas, gestor }
}

// Chamado na montagem da barra (websocket.js), de 10 em 10 minutos e depois de salvar um pedido.
// silencioso: só atualiza o contador (não abre a janela).
async function verificarPedidosPrometidos({ silencioso = false } = {}) {
    if (!navigator.onLine || !acesso?.usuario || acesso.permissao === 'cliente') return
    try {
        const { promessas } = await buscarPedidosPrometidos()
        estadoPromessas.lista = promessas
        const atalho = document.getElementById('atalhoPromessas')
        const contador = document.getElementById('contadorPromessas')
        if (atalho) atalho.style.display = promessas.length ? '' : 'none'
        if (contador) {
            contador.style.display = promessas.length ? 'flex' : 'none'
            contador.textContent = promessas.length || ''
        }
        if (!promessas.length) {
            if (estadoPromessas.aberta) { removerPopup(estadoPromessas.aberta); estadoPromessas.aberta = null }
            return
        }
        if (silencioso || estadoPromessas.aberta) return
        const ultima = Number(localStorage.getItem(chaveJanelaPromessas()) || 0)
        if (Date.now() - ultima >= INTERVALO_JANELA_PROMESSAS_MS) abrirJanelaPromessas(promessas, { cobranca: true })
    } catch (err) {
        console.error('[PROMESSAS]', err)
    }
}

function iniciarCobrancaPromessas() {
    clearInterval(estadoPromessas.temporizador)
    estadoPromessas.temporizador = setInterval(() => {
        if (document.visibilityState === 'visible') verificarPedidosPrometidos()
    }, 10 * 60 * 1000)
    return verificarPedidosPrometidos()
}

// Atalho da barra e notificação (acao { tipo: 'promessas', todas }): abre a lista sem a espera.
async function abrirPromessasPedido(todas = false) {
    overlayAguarde()
    try {
        const { promessas, gestor } = await buscarPedidosPrometidos(todas)
        removerOverlay()
        if (!promessas.length)
            return popup({ titulo: 'Pedidos pendentes', mensagem: todas ? 'Nenhum pedido pendente em aberto.' : 'Você não tem pedido pendente em aberto.' })
        abrirJanelaPromessas(promessas, { todas: todas && gestor })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function abrirJanelaPromessas(promessas, { cobranca = false, todas = false } = {}) {
    if (estadoPromessas.aberta) removerPopup(estadoPromessas.aberta)
    const esc = v => escaparAtributo(v ?? '')
    const linhas = promessas.map(p => `
        <tr>
            <td><b>${esc(p.contrato)}</b><br><small>${esc(p.cliente || '')}</small></td>
            ${todas ? `<td>${esc(p.executor || '—')}</td>` : ''}
            <td style="text-align: right; white-space: nowrap;">${Number(p.valor) > 10 ? dinheiro(p.valor) : '<span style="color: #b91c1c;">sem valor</span>'}</td>
            <td style="white-space: nowrap; color: ${Number(p.dias) > 7 ? '#b91c1c' : '#b45309'}; font-weight: 600;">${Number(p.dias) || 0} dia(s)</td>
            <td><small>Falta: ${esc(faltasPromessaTexto(p.faltas))}</small></td>
            <td><button type="button" onclick="completarPedidoPrometido('${esc(p.pedido_id)}', '${esc(p.contrato)}')">Completar</button></td>
        </tr>`).join('')
    const espera = cobranca ? ESPERA_LEMBRAR_PROMESSAS_S : 0
    const elemento = `
        <div class="promessas-pedido" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; max-width: min(56rem, 92vw); text-align: left;">
            <div style="background: #fff7ed; border-left: 4px solid #b45309; padding: 0.6rem 0.8rem; border-radius: 4px;">
                <b>${todas ? `${promessas.length} pedido(s) pendente(s) em aberto` : promessas.length === 1 ? 'Você tem 1 pedido pendente sem o pedido do cliente' : `Você tem ${promessas.length} pedidos pendentes sem o pedido do cliente`}</b><br>
                <small>A nota fiscal destes orçamentos não é emitida e eles não podem ser concluídos enquanto o pedido for promessa.
                Complete com o número (ou "Aprovado por E-mail"), o valor e a OC anexada.${todas ? '' : ' O gestor também recebe este aviso.'}</small>
            </div>
            <div style="max-height: 55vh; overflow: auto;">
                <table class="tabela" style="width: 100%;">
                    <thead><tr><th>Orçamento</th>${todas ? '<th>Lançado por</th>' : ''}<th>Valor</th><th>Há</th><th></th><th></th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
        </div>`
    const id = popup({
        titulo: 'Pedidos pendentes',
        modal: cobranca,
        elemento,
        botoes: [{ id: 'lembrar-promessas', texto: espera ? `Lembrar depois (${espera})` : 'Fechar', img: 'relogio', funcao: 'fecharJanelaPromessas(this)' }]
    })
    estadoPromessas.aberta = id
    if (cobranca) localStorage.setItem(chaveJanelaPromessas(), String(Date.now()))
    if (!espera) return
    // "Lembrar depois" só libera depois da espera (a janela volta em 1 hora).
    const botao = document.getElementById('lembrar-promessas')
    if (!botao) return
    botao.style.opacity = '0.45'
    botao.style.pointerEvents = 'none'
    let falta = espera
    const tique = setInterval(() => {
        falta--
        const texto = botao.querySelector('span')
        if (falta > 0) { if (texto) texto.textContent = `Lembrar depois (${falta})`; return }
        clearInterval(tique)
        if (texto) texto.textContent = 'Lembrar daqui a 1 hora'
        botao.style.opacity = ''
        botao.style.pointerEvents = ''
    }, 1000)
}

function fecharJanelaPromessas(botao) {
    const id = botao?.closest('.popup')?.id || estadoPromessas.aberta
    estadoPromessas.aberta = null
    removerPopup(id)
}

// Abre o formulário do pedido no orçamento dele (painelAdicionarPedido usa o departamento ativo).
async function completarPedidoPrometido(pedidoId, contrato) {
    if (estadoPromessas.aberta) { removerPopup(estadoPromessas.aberta); estadoPromessas.aberta = null }
    controles.ocorrencias = { ...(controles.ocorrencias || {}), ativo: contrato }
    await painelAdicionarPedido(pedidoId)
}
