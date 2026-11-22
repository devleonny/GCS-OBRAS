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
    const FALTAS = { numero: 'Pedido do cliente', valor: 'Valor' }
    const cartoes = promessas.map(p => {
        // Departamento com vários ORCs (texto do Omie): o primeiro em destaque e "+N" com a lista no title.
        const orcs = String(p.contrato || '').split(/\s+/).filter(Boolean)
        const principal = orcs[0] || 'Sem orçamento'
        const dias = Number(p.dias) || 0
        const nivel = dias > 30 ? 'critico' : dias > 7 ? 'atrasado' : 'recente'
        return `
        <article class="promessa-cartao ${nivel}">
            <div class="promessa-info">
                <div class="promessa-titulo">
                    <b>${esc(principal)}</b>
                    ${orcs.length > 1 ? `<span class="promessa-mais" title="${esc(orcs.join(', '))}">+${orcs.length - 1} ORCs</span>` : ''}
                </div>
                <span class="promessa-cliente">${esc(p.cliente || (p.orcamento_id ? 'Cliente não informado' : 'Sem orçamento no GCS'))}${p.executor && (todas || String(p.executor).toLowerCase() !== String(acesso?.usuario || '').toLowerCase()) ? ` · lançado por ${esc(p.executor)}` : ''}${p.responsavel && String(p.responsavel).toLowerCase() !== String(p.executor || '').toLowerCase() ? ` · assumido por ${esc(p.responsavel)}` : ''}</span>
                <div class="promessa-faltas">
                    ${(p.faltas || []).map(f => `<span class="promessa-falta">Falta ${esc((FALTAS[f] || f).toLowerCase())}</span>`).join('')}
                    ${Number(p.valor) > 10 ? `<span class="promessa-valor">Previsto ${dinheiro(p.valor)}</span>` : ''}
                </div>
            </div>
            <div class="promessa-lado">
                <span class="promessa-dias" title="Desde o lançamento do pedido">${dias} ${dias === 1 ? 'dia' : 'dias'}</span>
                ${p.orcamento_id ? `<button type="button" class="promessa-historico" title="Abrir o histórico do orçamento" onclick="abrirHistoricoPrometido('${esc(p.orcamento_id)}')">Histórico</button>` : ''}
                <button type="button" class="promessa-completar" onclick="completarPedidoPrometido('${esc(p.pedido_id)}', '${esc(principal)}')">Completar</button>
            </div>
        </article>`
    }).join('')
    const espera = cobranca ? ESPERA_LEMBRAR_PROMESSAS_S : 0
    const elemento = `
        <div class="promessas-pedido">
            <div class="promessas-aviso">
                <img src="imagens/alerta.png" alt="">
                <div>
                    <b>${todas ? `${promessas.length} pedido(s) pendente(s) em aberto` : promessas.length === 1 ? 'Você tem 1 pedido pendente sem o pedido do cliente' : `Você tem ${promessas.length} pedidos pendentes sem o pedido do cliente`}</b>
                    <small>Enquanto o pedido estiver pendente, a nota fiscal não é emitida e o orçamento não pode ser concluído.
                    Complete com o número (ou "Aprovado por E-mail"), o valor e a OC anexada.${todas ? '' : ' O gestor também recebe este aviso.'}</small>
                </div>
            </div>
            <div class="promessas-lista">${cartoes}</div>
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

// Histórico (Esquema) do orçamento; a janela fecha antes para o histórico não ficar por baixo dela.
function abrirHistoricoPrometido(orcamentoId) {
    if (estadoPromessas.aberta) { removerPopup(estadoPromessas.aberta); estadoPromessas.aberta = null }
    abrirEsquema(orcamentoId)
}
