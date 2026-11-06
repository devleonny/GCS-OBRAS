// Janelas independentes (LIGADO por padrão).
//
// O popup não bloqueia a tela: sem fundo escuro, a janela pode ser arrastada pela barra de
// título, minimizada para a barra do rodapé e o resto do GCS continua clicável com ela aberta.
//
// Saída de emergência só neste navegador (volta ao popup que bloqueia): ?janelas=0 na URL
// (?janelas=1 religa), ou no console: alternarJanelasIndependentes(true | false).
//
// Como o código antigo continua funcionando: quase todo formulário supõe que o popup "da vez" é o
// ÚLTIMO .popup do DOM (removerPopup() sem id, obVal, .painel-padrao at(-1)...). Aqui a janela
// clicada é sempre levada para o fim do DOM, então "o último" passa a ser "a janela em foco".
// removerPopup() sem id só fecha a janela em foco (nunca uma de outro assunto) e
// removerTodosPopups() fecha só a cascata da janela em foco (ela, quem a abriu e quem ela abriu).

const CHAVE_JANELAS = 'gcs_janelas_independentes'

;(() => {
    try {
        const valor = new URLSearchParams(location.search).get('janelas')
        if (valor === '1') localStorage.removeItem(CHAVE_JANELAS)
        if (valor === '0') localStorage.setItem(CHAVE_JANELAS, '0')
    } catch { }
})()

function janelasIndependentesLigadas() {
    try { return localStorage.getItem(CHAVE_JANELAS) !== '0' } catch { return true }
}

function alternarJanelasIndependentes(ligar = !janelasIndependentesLigadas()) {
    try {
        if (ligar) localStorage.removeItem(CHAVE_JANELAS)
        else localStorage.setItem(CHAVE_JANELAS, '0')
    } catch { }
    location.reload()
}

// trazerJanelaParaFrente e janelaQueAbriu: padrões no popup.js (páginas sem este arquivo); aqui
// trazerJanelaParaFrente ganha o comportamento real.
if (janelasIndependentesLigadas()) {

    // Janela em foco (id do .popup) ou null quando o último clique foi na página, fora das janelas.
    let janelaEmFoco = null

    const popupOriginal = popup
    const removerPopupOriginal = removerPopup
    const removerTodosPopupsOriginal = removerTodosPopups

    const janelaPorId = id => (id ? document.getElementById(id) : null)
    const janelaAberta = id => {
        const el = janelaPorId(id)
        return el?.classList.contains('popup') ? el : null
    }
    const janelaVisivel = id => {
        const el = janelaAberta(id)
        return el && !el.classList.contains('janela-minimizada') ? el : null
    }
    const todasJanelas = () => [...document.querySelectorAll('body > .popup')]
    const filhasDe = id => todasJanelas().filter(j => j.dataset.janelaPai === id)

    function descendentes(id) {
        const lista = []
        for (const filha of filhasDe(id)) lista.push(filha, ...descendentes(filha.id))
        return lista
    }

    function raizDe(id) {
        let atual = janelaAberta(id)
        while (atual && janelaAberta(atual.dataset.janelaPai)) atual = janelaAberta(atual.dataset.janelaPai)
        return atual
    }

    // Move para o fim do <body> sem perder rolagem/foco: moveBefore (Chrome/Edge 133+) preserva o
    // estado do elemento; no fallback a rolagem interna é guardada e restaurada.
    function moverParaFim(el) {
        const popups = todasJanelas()
        if (popups.at(-1) === el) return
        const ultimo = popups.at(-1)
        const referencia = ultimo?.nextSibling ?? null
        if (typeof document.body.moveBefore === 'function') {
            try { document.body.moveBefore(el, referencia); return } catch { }
        }
        const rolados = [el, ...el.querySelectorAll('*')]
            .filter(n => n.scrollTop || n.scrollLeft)
            .map(n => [n, n.scrollTop, n.scrollLeft])
        const ativo = el.contains(document.activeElement) ? document.activeElement : null
        document.body.insertBefore(el, referencia)
        for (const [n, topo, esquerda] of rolados) { n.scrollTop = topo; n.scrollLeft = esquerda }
        ativo?.focus?.({ preventScroll: true })
    }

    // Minimizada vai para o começo da pilha: nunca é "a última" para o código antigo.
    function moverParaInicio(el) {
        const primeiro = todasJanelas()[0]
        if (!primeiro || primeiro === el) return
        if (typeof document.body.moveBefore === 'function') {
            try { document.body.moveBefore(el, primeiro); return } catch { }
        }
        document.body.insertBefore(el, primeiro)
    }

    function marcarFoco() {
        for (const j of todasJanelas()) j.classList.toggle('janela-em-foco', j.id === janelaEmFoco)
        atualizarBarraJanelas()
    }

    function focarJanela(id) {
        const el = janelaAberta(id)
        if (!el) { janelaEmFoco = null; marcarFoco(); return }
        el.classList.remove('janela-minimizada')
        moverParaFim(el)
        janelaEmFoco = el.id
        marcarFoco()
    }

    // Depois de fechar/minimizar: foco volta para quem abriu (cascata) ou para nenhuma.
    function devolverFoco(pai) {
        if (janelaVisivel(pai)) focarJanela(pai)
        else { janelaEmFoco = null; marcarFoco() }
    }

    function minimizarJanela(id) {
        const el = janelaAberta(id)
        if (!el) return
        el.classList.add('janela-minimizada')
        moverParaInicio(el)
        if (janelaEmFoco === id || !janelaVisivel(janelaEmFoco)) devolverFoco(el.dataset.janelaPai)
        else marcarFoco()
    }

    // × do usuário (barra de título ou rodapé): formulário pergunta antes (fecharPopupUsuario,
    // popup.js); minimizado volta à tela para a pessoa ver o que está fechando.
    function fecharJanelaUsuario(id) {
        const el = janelaAberta(id)
        if (!el) return
        if (el.dataset.confirmarFechar === 'S') focarJanela(id)
        fecharPopupUsuario(id, fecharJanela)
    }

    // Fecha a janela e as que ela abriu.
    function fecharJanela(id) {
        const el = janelaAberta(id)
        if (!el) return
        for (const filha of descendentes(id).reverse()) removerPopupOriginal(filha.id)
        const pai = el.dataset.janelaPai
        removerPopupOriginal(id)
        document.body.style.overflow = ''
        devolverFoco(pai)
    }

    // ---- Proteção contra janelas duplicadas ----
    // Muito código lê/escreve os campos por id na página inteira (getElementById pega o primeiro):
    // duas janelas com os mesmos ids misturam dados ao salvar, e tabelas de id fixo desenham na
    // janela errada. Ao abrir uma janela com id que já existe em OUTRA janela aberta:
    //  - a outra é formulário → a nova não abre: a existente vem para frente, avisa, e o código que
    //    abria é interrompido (JanelaDuplicada), para não preencher campos no formulário errado;
    //  - a outra é painel (tabela/lista) → fecha a antiga e abre a nova (reabrir = atualizar).
    // Aberta de dentro da própria janela conflitante (recarregar) não muda nada: igual ao clássico.
    class JanelaDuplicada extends Error {
        constructor(titulo) { super(`Janela já aberta: ${titulo}`); this.name = 'JanelaDuplicada' }
    }
    let ultimoBloqueio = 0
    const ignorarJanelaDuplicada = e => { if (e?.reason?.name === 'JanelaDuplicada' || e?.error?.name === 'JanelaDuplicada') e.preventDefault() }
    addEventListener('unhandledrejection', ignorarJanelaDuplicada)
    addEventListener('error', ignorarJanelaDuplicada)

    const htmlDasOpcoes = o => [o.elemento, o.mensagem, o.conteudoRodape, ...(o.linhas || []).flatMap(l => [l?.texto, l?.elemento])]
        .filter(v => typeof v === 'string').join('\n')

    const ehFormulario = j => j.dataset.confirmarFechar === 'S' || !!j.querySelector('.painel-padrao')
    const linhagem = id => { const ids = new Set(); let atual = janelaAberta(id); while (atual) { ids.add(atual.id); atual = janelaAberta(atual.dataset.janelaPai) } return ids }

    function janelasEmConflito(opcoes, pai) {
        const ids = new Set([...htmlDasOpcoes(opcoes).matchAll(/\bid\s*=\s*["']([^"'\s]+)["']/g)].map(m => m[1]))
        const daLinhagem = linhagem(pai)
        const conflitos = new Map()
        for (const id of ids) {
            const janela = document.getElementById(id)?.closest('body > .popup')
            if (janela && !daLinhagem.has(janela.id)) conflitos.set(janela.id, janela)
        }
        return [...conflitos.values()]
    }

    popup = function (opcoes = {}) {
        // Quem abre é a janela em foco (clique dentro dela) — vira o "pai" da cascata.
        const pai = janelaVisivel(janelaEmFoco)?.id || ''

        // A tentativa barrada costuma cair num catch que mostra "Falha ao abrir…": não mostra.
        if (Date.now() - ultimoBloqueio < 1500 && opcoes.mensagem && !opcoes.linhas?.length && !opcoes.elemento && /falha|erro/i.test(opcoes.mensagem))
            return null

        const conflitos = opcoes.mensagem && !opcoes.linhas?.length && !opcoes.elemento ? [] : janelasEmConflito(opcoes, pai)
        const formularioAberto = conflitos.find(ehFormulario)
        if (formularioAberto) {
            removerOverlay()
            focarJanela(formularioAberto.id)
            const titulo = formularioAberto.querySelector('.popup-top label')?.textContent.trim() || 'este formulário'
            popup({ mensagem: `Já existe <b>${escaparAtributo(titulo)}</b> aberto.<br>Salve ou feche esse antes de abrir outro igual.` })
            ultimoBloqueio = Date.now()
            throw new JanelaDuplicada(titulo)
        }
        for (const painel of conflitos) fecharJanela(painel.id)

        const abertas = todasJanelas().filter(j => !j.classList.contains('janela-minimizada') && j.dataset.semBarra !== 'S').length
        // Aberta com um modal na tela (ex.: lista de seleção de dentro dele): fica acima do modal.
        const sobreModal = !!document.querySelector('body > .popup.janela-modal')
        // opcoes.barraJanelas: vai para a barra do rodapé e pode minimizar. Padrão: formulários
        // (linhas) e painéis (elemento) sim; mensagens/confirmações/avisos não.
        const naBarra = !opcoes.modal && !sobreModal && (opcoes.barraJanelas ?? Boolean(opcoes.linhas?.length || opcoes.elemento))
        const id = popupOriginal(opcoes)
        document.body.style.overflow = ''
        const el = janelaPorId(id)
        if (el) {
            el.dataset.janelaPai = pai
            if (!naBarra) el.dataset.semBarra = 'S'
            if (opcoes.modal) el.classList.add('janela-modal')
            if (sobreModal) el.classList.add('janela-sobre-modal')
            // Abre em cascata (deslocada) para não cobrir a barra de título das outras;
            // mensagem fica no centro.
            const passo = naBarra ? (abertas % 8) * 28 : 0
            const caixa = el.querySelector('.popup-janela-fora')
            if (caixa && passo) caixa.style.translate = `${passo}px ${passo}px`
            prepararJanela(el, naBarra)
            janelaEmFoco = id
            marcarFoco()
            encaixarJanela(el)
            if (caixa) observadorTamanho.observe(caixa)
        }
        return id
    }

    removerPopup = function (id = null) {
        // Sem id: só a janela em foco. Clique na página (foco nenhum) não fecha janela alheia.
        const alvo = id ? janelaPorId(id) : janelaVisivel(janelaEmFoco)
        if (!alvo) return
        const pai = alvo.dataset.janelaPai
        // As que ela abriu passam a ser da janela de cima (o código fecha a de baixo de propósito às vezes).
        for (const filha of filhasDe(alvo.id)) filha.dataset.janelaPai = pai || ''
        const estavaEmFoco = janelaEmFoco === alvo.id
        removerPopupOriginal(alvo.id)
        document.body.style.overflow = ''
        if (estavaEmFoco || !janelaVisivel(janelaEmFoco)) devolverFoco(pai)
        else marcarFoco()
    }

    removerTodosPopups = function () {
        removerOverlay()
        const raiz = raizDe(janelaEmFoco)
        if (raiz) {
            for (const j of [raiz, ...descendentes(raiz.id)].reverse()) removerPopupOriginal(j.id)
        }
        document.querySelector('.aguarde')?.remove()
        document.body.style.overflow = ''
        janelaEmFoco = null
        marcarFoco()
    }

    // Barra de título: minimizar (azul) e fechar (vermelho) juntos; arrastar pela barra.
    function prepararJanela(el, minimizavel = true) {
        const topo = el.querySelector('.popup-top')
        const fechar = topo?.querySelector(':scope > span')
        if (!topo || !fechar) return
        fechar.removeAttribute('onclick')
        fechar.className = 'janela-fechar'
        fechar.title = 'Fechar'
        fechar.setAttribute('aria-label', 'Fechar')
        fechar.addEventListener('click', () => fecharJanelaUsuario(el.id))
        const grupo = document.createElement('div')
        grupo.className = 'janela-botoes'
        fechar.replaceWith(grupo)
        if (minimizavel) {
            grupo.innerHTML = '<span class="janela-minimizar" title="Minimizar" aria-label="Minimizar">–</span>'
            grupo.querySelector('.janela-minimizar').addEventListener('click', () => minimizarJanela(el.id))
        }
        grupo.append(fechar)
        topo.addEventListener('pointerdown', evento => iniciarArraste(evento, el))
    }

    function iniciarArraste(evento, el) {
        if (evento.button !== 0 || evento.target.closest('.janela-botoes')) return
        const janela = el.querySelector('.popup-janela-fora')
        if (!janela) return
        evento.preventDefault()
        const caixa = janela.getBoundingClientRect()
        // Na primeira vez sai do centro (flex) e passa a ter posição própria.
        janela.classList.add('janela-posicionada')
        janela.style.translate = ''
        janela.style.left = `${caixa.left}px`
        janela.style.top = `${caixa.top}px`
        const dx = evento.clientX - caixa.left
        const dy = evento.clientY - caixa.top
        const topo = evento.currentTarget
        topo.setPointerCapture?.(evento.pointerId)
        topo.classList.add('arrastando')

        const mover = e => {
            // A barra de título nunca sai da tela (senão não dá para pegar de volta).
            const largura = janela.offsetWidth
            const x = Math.min(Math.max(e.clientX - dx, 60 - largura), innerWidth - 60)
            const y = Math.min(Math.max(e.clientY - dy, 0), innerHeight - alturaBarra - 52)
            janela.style.left = `${x}px`
            janela.style.top = `${y}px`
        }
        const soltar = () => {
            topo.classList.remove('arrastando')
            topo.removeEventListener('pointermove', mover)
            topo.removeEventListener('pointerup', soltar)
            topo.removeEventListener('pointercancel', soltar)
        }
        topo.addEventListener('pointermove', mover)
        topo.addEventListener('pointerup', soltar)
        topo.addEventListener('pointercancel', soltar)
    }

    // Foco em dois tempos:
    // - pointerdown: foco lógico e visual (z-index). Mover o nó aqui faria o navegador cancelar o
    //   click (mousedown e mouseup deixam de "casar"), então só a barra de título (arrastar) move já.
    // - click (captura): leva a janela para o fim do DOM antes dos handlers antigos rodarem.
    document.addEventListener('pointerdown', evento => {
        if (evento.target.closest?.('#barra-janelas, .aguarde')) return
        const janela = evento.target.closest?.('body > .popup')
        if (!janela) {
            // Clique na página (fora das janelas): minimiza todas para a barra do rodapé.
            // Mensagens/confirmações (sem lugar na barra) ficam, senão sumiriam sem volta.
            janelaEmFoco = null
            for (const j of todasJanelas())
                if (j.dataset.semBarra !== 'S' && !j.classList.contains('janela-minimizada')) {
                    j.classList.add('janela-minimizada')
                    moverParaInicio(j)
                }
            marcarFoco()
            return
        }
        const naBarraDeTitulo = evento.target.closest('.popup-top') && !evento.target.closest('.janela-botoes')
        if (naBarraDeTitulo) return focarJanela(janela.id)
        if (janelaEmFoco !== janela.id) { janelaEmFoco = janela.id; marcarFoco() }
    }, true)

    document.addEventListener('click', evento => {
        const janela = evento.target.closest?.('body > .popup')
        if (!janela || janela.classList.contains('janela-minimizada')) return
        janelaEmFoco = janela.id
        if (todasJanelas().at(-1) !== janela) moverParaFim(janela)
        marcarFoco()
    }, true)

    // Barra do rodapé com as janelas abertas (minimizadas ou não).
    function atualizarBarraJanelas() {
        let barra = document.getElementById('barra-janelas')
        const janelas = todasJanelas()
            .filter(j => j.querySelector('.popup-top') && j.dataset.semBarra !== 'S')
            .sort((a, b) => (a.dataset.janelaOrdem || 0) - (b.dataset.janelaOrdem || 0))
        if (!janelas.length) {
            barra?.remove()
            definirAlturaBarra(0)
            return
        }
        if (!barra) {
            document.body.insertAdjacentHTML('beforeend', '<div id="barra-janelas" role="toolbar" aria-label="Janelas abertas"></div>')
            barra = document.getElementById('barra-janelas')
        }
        barra.innerHTML = janelas.map(j => {
            const titulo = j.querySelector('.popup-top label')?.textContent.trim() || 'GCS'
            const minimizada = j.classList.contains('janela-minimizada')
            const estado = minimizada ? ' minimizada' : j.id === janelaEmFoco ? ' em-foco' : ''
            const dica = minimizada ? `${titulo} (minimizada — clique para abrir)` : titulo
            return `
                <div class="barra-janela${estado}" data-janela="${j.id}" title="${escaparAtributo(dica)}">
                    <span class="barra-janela-icone" aria-hidden="true"></span>
                    <span class="barra-janela-titulo">${escaparAtributo(titulo)}</span>
                    <span class="barra-janela-fechar" title="Fechar">×</span>
                </div>`
        }).join('')
        definirAlturaBarra(barra.offsetHeight)
    }

    // A área das janelas (CSS --barra-janelas-altura) termina onde a barra do rodapé começa.
    let alturaBarra = 0
    function definirAlturaBarra(altura) {
        if (altura === alturaBarra) return
        alturaBarra = altura
        document.documentElement.style.setProperty('--barra-janelas-altura', `${altura}px`)
        todasJanelas().forEach(encaixarJanela)
    }

    // Nenhuma janela termina atrás da barra do rodapé: se a base passar do limite (cascata,
    // conteúdo que cresceu depois de abrir, tela redimensionada), sobe o necessário, sem
    // passar do topo da tela.
    const MARGEM_JANELA = 8
    function encaixarJanela(el) {
        const janela = el?.querySelector?.('.popup-janela-fora')
        if (!janela || el.classList.contains('janela-minimizada')) return
        const caixa = janela.getBoundingClientRect()
        if (!caixa.height) return
        const limite = innerHeight - alturaBarra - MARGEM_JANELA
        const excesso = caixa.bottom - limite
        if (excesso <= 0) return
        const subir = Math.min(excesso, Math.max(0, caixa.top - MARGEM_JANELA))
        if (!subir) return
        if (janela.classList.contains('janela-posicionada')) {
            janela.style.top = `${parseFloat(janela.style.top || caixa.top) - subir}px`
        } else {
            const [x = '0px', y = '0px'] = (janela.style.translate || '0px 0px').split(' ')
            janela.style.translate = `${x} ${parseFloat(y) - subir}px`
        }
    }

    const observadorTamanho = new ResizeObserver(registros => {
        for (const r of registros) encaixarJanela(r.target.closest('.popup'))
    })
    addEventListener('resize', () => todasJanelas().forEach(encaixarJanela))

    let ordemJanelas = 0
    // Sincroniza a barra também quando o código remove o .popup direto (p.remove()).
    new MutationObserver(registros => {
        let mudou = false
        for (const r of registros) {
            for (const n of r.addedNodes) if (n.classList?.contains('popup')) {
                n.dataset.janelaOrdem ||= String(++ordemJanelas)
                mudou = true
            }
            for (const n of r.removedNodes) if (n.classList?.contains('popup')) mudou = true
        }
        if (!mudou) return
        if (janelaEmFoco && !janelaAberta(janelaEmFoco)) janelaEmFoco = null
        atualizarBarraJanelas()
    }).observe(document.body, { childList: true })

    document.addEventListener('click', evento => {
        const item = evento.target.closest?.('#barra-janelas .barra-janela')
        if (!item) return
        const id = item.dataset.janela
        if (evento.target.closest('.barra-janela-fechar')) return fecharJanelaUsuario(id)
        const el = janelaAberta(id)
        if (!el) return atualizarBarraJanelas()
        // Clicar na que já está em foco minimiza (como na barra de tarefas).
        if (id === janelaEmFoco && !el.classList.contains('janela-minimizada')) minimizarJanela(id)
        else focarJanela(id)
    })

    trazerJanelaParaFrente = elemento => {
        const janela = elemento?.closest?.('body > .popup')
        if (janela) focarJanela(janela.id)
    }

    document.documentElement.classList.add('janelas-independentes')
}
