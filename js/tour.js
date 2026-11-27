// Passo a passo de primeira vez (tour) — 27/11/2026.
// Overlay escuro com um círculo destacando o lugar da tela, balão com a explicação e Voltar / Próximo / Concluir.
// Visto uma vez (concluído ou pulado) não volta mais para aquele usuário: fica nas preferências do perfil
// (usuarios_preferencias, chave tour_<id>), então vale em qualquer aparelho. O botão "Tour" de cada tela reabre.
//
// Uso numa tela nova:
//   const TOUR_X = [{ alvo: '.seletor' | () => elemento | null, titulo, texto, antes: () => {...} }, ...]
//   tourPrimeiraVez('x', TOUR_X)   // ao abrir a tela: só aparece se o usuário ainda não viu
//   iniciarTour('x', TOUR_X)       // botão "Tour": mostra sempre
// Passo sem alvo (ou com alvo que não está visível na hora) aparece centralizado, sem círculo.

const estadoTour = { id: null, passos: [], indice: 0, raiz: null, alvo: null, ouvintes: null }

const chaveTour = id => `tour_${String(id).toLowerCase().replace(/[^a-z0-9_]/g, '_')}`.slice(0, 60)

async function tourPrimeiraVez(id, passos, { atraso = 400 } = {}) {
    try {
        if (estadoTour.raiz) return
        if (typeof preferenciaUsuario === 'function' && await preferenciaUsuario(chaveTour(id), null)) return
        // Espera a tela assentar (linhas, rodapé, bandeja) antes de medir os alvos.
        await new Promise(r => setTimeout(r, atraso))
        iniciarTour(id, passos)
    } catch (err) {
        console.error('[TOUR]', err)
    }
}

function iniciarTour(id, passos) {
    fecharTour(false)
    if (!Array.isArray(passos) || !passos.length) return
    estadoTour.id = id
    estadoTour.passos = passos
    estadoTour.indice = 0

    const raiz = document.createElement('div')
    raiz.className = 'tour-raiz'
    raiz.setAttribute('role', 'dialog')
    raiz.setAttribute('aria-modal', 'true')
    raiz.innerHTML = `
        <div class="tour-bloqueio"></div>
        <div class="tour-foco" aria-hidden="true"></div>
        <div class="tour-balao" tabindex="-1" aria-live="polite"></div>`
    document.body.appendChild(raiz)
    estadoTour.raiz = raiz

    const reposicionar = () => posicionarTour()
    const teclas = e => {
        if (!estadoTour.raiz) return
        if (e.key === 'Escape') { e.preventDefault(); fecharTour(true) }
        else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); avancarTour(1) }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); avancarTour(-1) }
    }
    window.addEventListener('resize', reposicionar)
    window.addEventListener('scroll', reposicionar, true)
    document.addEventListener('keydown', teclas, true)
    estadoTour.ouvintes = { reposicionar, teclas }

    mostrarPassoTour()
}

function alvoTour(passo) {
    let el = null
    try {
        el = typeof passo.alvo === 'function' ? passo.alvo() : passo.alvo ? document.querySelector(passo.alvo) : null
    } catch { el = null }
    if (!el) return null
    const r = el.getBoundingClientRect()
    // Escondido (coluna recolhida, bandeja fechada...): o passo aparece centralizado.
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return null
    return el
}

async function mostrarPassoTour() {
    const { raiz, passos, indice } = estadoTour
    if (!raiz) return
    const passo = passos[indice]
    try { await passo.antes?.() } catch (err) { console.error('[TOUR]', err) }
    if (!estadoTour.raiz) return

    const alvo = alvoTour(passo)
    estadoTour.alvo = alvo
    if (alvo) {
        alvo.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        // Alvo dentro de área com rolagem própria (a tabela): centraliza na horizontal se ficou fora da vista.
        const r = alvo.getBoundingClientRect()
        if (r.right > window.innerWidth || r.left < 0) alvo.scrollIntoView({ block: 'nearest', inline: 'center' })
    }

    const total = passos.length
    const ultimo = indice === total - 1
    const balao = raiz.querySelector('.tour-balao')
    balao.innerHTML = `
        <div class="tour-topo">
            <span class="tour-contagem">${indice + 1} de ${total}</span>
            <button type="button" class="tour-pular" onclick="fecharTour(true)">Pular tour</button>
        </div>
        ${passo.titulo ? `<h3 class="tour-titulo">${passo.titulo}</h3>` : ''}
        <div class="tour-texto">${passo.texto || ''}</div>
        <div class="tour-pontos" aria-hidden="true">${passos.map((_, i) => `<i class="${i === indice ? 'ativo' : i < indice ? 'visto' : ''}"></i>`).join('')}</div>
        <div class="tour-botoes">
            ${indice > 0 ? '<button type="button" class="tour-voltar" onclick="avancarTour(-1)">Voltar</button>' : '<span></span>'}
            <button type="button" class="tour-proximo" onclick="avancarTour(1)">${ultimo ? 'Concluir' : 'Próximo'}</button>
        </div>`
    raiz.classList.toggle('sem-alvo', !alvo)
    posicionarTour()
    balao.querySelector('.tour-proximo')?.focus({ preventScroll: true })
}

function posicionarTour() {
    const { raiz, alvo } = estadoTour
    if (!raiz) return
    const foco = raiz.querySelector('.tour-foco')
    const balao = raiz.querySelector('.tour-balao')
    const vw = window.innerWidth, vh = window.innerHeight, margem = 12

    if (!alvo || !alvo.isConnected) {
        foco.style.cssText = 'display: none'
        balao.style.left = `${Math.max(margem, (vw - balao.offsetWidth) / 2)}px`
        balao.style.top = `${Math.max(margem, (vh - balao.offsetHeight) / 2)}px`
        balao.dataset.lado = 'centro'
        return
    }

    // Círculo (elipse nos alvos compridos) em volta do alvo, com folga. Alvo grande (bandeja, cabeçalho, rodapé):
    // retângulo arredondado, que a elipse cortaria os cantos.
    const r = alvo.getBoundingClientRect()
    const grande = r.width > 260 || r.height > 110
    const folga = grande ? 8 : Math.min(28, Math.max(10, Math.min(r.width, r.height) * 0.35))
    const largura = Math.min(r.width + folga * 2, vw)
    const altura = grande ? Math.min(r.height + folga * 2, vh) : Math.max(r.height + folga * 2, Math.min(largura, r.height + folga * 4))
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    foco.classList.toggle('retangulo', grande)
    foco.style.cssText = `display: block; left: ${cx - largura / 2}px; top: ${cy - altura / 2}px; width: ${largura}px; height: ${altura}px;`

    // Balão: embaixo, em cima, à direita ou à esquerda do círculo — onde couber.
    const bw = balao.offsetWidth, bh = balao.offsetHeight, distancia = 16
    const circ = { left: cx - largura / 2, right: cx + largura / 2, top: cy - altura / 2, bottom: cy + altura / 2 }
    let left, top, lado
    if (circ.bottom + distancia + bh <= vh - margem) { lado = 'baixo'; top = circ.bottom + distancia; left = cx - bw / 2 }
    else if (circ.top - distancia - bh >= margem) { lado = 'cima'; top = circ.top - distancia - bh; left = cx - bw / 2 }
    else if (circ.right + distancia + bw <= vw - margem) { lado = 'direita'; left = circ.right + distancia; top = cy - bh / 2 }
    else if (circ.left - distancia - bw >= margem) { lado = 'esquerda'; left = circ.left - distancia - bw; top = cy - bh / 2 }
    else { lado = 'centro'; left = (vw - bw) / 2; top = vh - bh - margem }
    balao.style.left = `${Math.min(Math.max(margem, left), vw - bw - margem)}px`
    balao.style.top = `${Math.min(Math.max(margem, top), vh - bh - margem)}px`
    balao.dataset.lado = lado
}

function avancarTour(direcao) {
    if (!estadoTour.raiz) return
    const novo = estadoTour.indice + direcao
    if (novo < 0) return
    if (novo >= estadoTour.passos.length) return fecharTour(true)
    estadoTour.indice = novo
    mostrarPassoTour()
}

// visto = true: concluído ou pulado, não aparece mais sozinho para este usuário.
function fecharTour(visto = true) {
    const { raiz, ouvintes, id } = estadoTour
    if (ouvintes) {
        window.removeEventListener('resize', ouvintes.reposicionar)
        window.removeEventListener('scroll', ouvintes.reposicionar, true)
        document.removeEventListener('keydown', ouvintes.teclas, true)
    }
    raiz?.remove()
    estadoTour.raiz = null
    estadoTour.alvo = null
    estadoTour.ouvintes = null
    if (visto && id && typeof salvarPreferenciaUsuario === 'function')
        salvarPreferenciaUsuario(chaveTour(id), new Date().toISOString())
}
