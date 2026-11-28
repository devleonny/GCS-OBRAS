// EDITOR DE LAYOUT DE LOJA (checklist): desenho em metros, encaixado numa grade de 0,25 m.
// Ao salvar vira uma imagem da seção 03 (planta), onde as instalações são marcadas pelo editor da foto.
// O desenho (vetor) fica em foto.layout e pode ser reaberto; a imagem nova vale do dia aberto em diante.
// Tipos conferidos no servidor (TIPOS_LAYOUT em gcs/SCRIPTS/planos_diarios.js).

const TIPOS_LAYOUT_DIARIO = {
    parede: { rotulo: 'Parede' },
    sala: { rotulo: 'Sala', cor: '#f7f9f8', borda: '#202925', esp: 0.15 },
    porta: { rotulo: 'Porta', l: 1, a: 1 },
    janela: { rotulo: 'Janela', l: 1.5, a: 0.15, cor: '#cfe6f7', borda: '#4a8fc2', esp: 0.04 },
    gondola: { rotulo: 'Gôndola', l: 3, a: 1, cor: '#e4ebe7', borda: '#7c8d84', esp: 0.04 },
    checkout: { rotulo: 'Checkout', l: 2, a: 1, cor: '#fdecc8', borda: '#b98a1c', esp: 0.04 },
    balcao: { rotulo: 'Balcão', l: 2, a: 0.75, cor: '#eadfd3', borda: '#8d6e4f', esp: 0.04 },
    rack: { rotulo: 'Rack', l: 0.75, a: 0.75, cor: '#fbdcdc', borda: '#b3262f', esp: 0.05 },
    pilar: { rotulo: 'Pilar', l: 0.5, a: 0.5, cor: '#5a6660', borda: '#202925', esp: 0.03 },
    texto: { rotulo: 'Texto', l: 3, a: 0.75 }
}
const GRADE_LAYOUT_DIARIO = 0.25
let layoutDiario = null

const metrosDiario = v => `${numeroPlanoDiario(Math.round(v * 100) / 100)} m`

function abrirLayoutDiario(id = null) {
    const e = estadoPlanoDiario
    const foto = id ? (e.plano.galeria || []).find(f => f.id === id) : null
    if (id && !foto?.layout) return
    if (e.carregando || e.renderizando || layoutDiario) return
    const base = foto?.layout || { largura: 20, altura: 12, elementos: [] }
    const dia = diaAbertoDiario()
    layoutDiario = {
        id, desde: foto && dia < foto.data ? foto.data : dia, travado: !!foto?.marcacoes?.length, zoom: 1,
        largura: base.largura, altura: base.altura, elementos: base.elementos.map(x => ({ ...x })),
        ferramenta: foto ? 'mover' : 'parede', sel: null, desfazer: [], refazer: [], acao: null, alterado: false
    }
    // Aviso ainda na tela (ex.: "Checklist criado") cobriria a barra de ferramentas.
    document.querySelectorAll('.balao-aviso').forEach(b => b.remove())
    const tela = document.createElement('div')
    tela.className = 'dl-tela'
    tela.innerHTML = `
        <div class="dl-topo" role="toolbar" aria-label="Desenho">
            <b>${foto ? 'Editar layout' : 'Novo layout'}</b>
            <button type="button" data-fer="mover">Selecionar</button>
            ${Object.entries(TIPOS_LAYOUT_DIARIO).map(([k, t]) => `<button type="button" data-fer="${k}">${t.rotulo}</button>`).join('')}
            <span class="dl-espaco"></span>
            <button type="button" data-acao="desfazer" title="Ctrl+Z">↶ Desfazer</button>
            <button type="button" data-acao="refazer" title="Ctrl+Y">↷ Refazer</button>
            <button type="button" data-acao="menos" aria-label="Diminuir">−</button>
            <button type="button" data-acao="mais" aria-label="Aumentar">+</button>
            <button type="button" data-acao="fechar">Cancelar</button>
            <button type="button" data-acao="salvar" class="dl-salvar">Salvar layout</button>
        </div>
        <div class="dl-corpo"><div class="dl-area"></div><aside class="dl-props"></aside></div>`
    layoutDiario.tela = tela
    document.body.append(tela)
    tela.querySelectorAll('[data-fer]').forEach(b => b.addEventListener('click', () => {
        layoutDiario.ferramenta = b.dataset.fer
        layoutDiario.sel = null
        desenharLayoutDiario(true)
    }))
    const acoes = { desfazer: () => voltarLayoutDiario('desfazer', 'refazer'), refazer: () => voltarLayoutDiario('refazer', 'desfazer'),
        menos: () => zoomLayoutDiario(1 / 1.25), mais: () => zoomLayoutDiario(1.25), fechar: fecharLayoutDiario, salvar: salvarLayoutDiario }
    tela.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', acoes[b.dataset.acao]))
    const area = tela.querySelector('.dl-area')
    area.addEventListener('pointerdown', apertarLayoutDiario)
    area.addEventListener('pointermove', arrastarLayoutDiario)
    area.addEventListener('pointerup', soltarLayoutDiario)
    area.addEventListener('pointercancel', () => { layoutDiario.acao = null; desenharLayoutDiario() })
    document.addEventListener('keydown', teclasLayoutDiario, true)
    desenharLayoutDiario(true)
}

function teclasLayoutDiario(ev) {
    const d = layoutDiario
    // Confirmação/aviso aberto por cima: as teclas são dele.
    if (!d || d.salvando || d.tela.style.visibility === 'hidden') return
    if (ev.target.closest?.('input, textarea')) return
    const tecla = ev.key.toLowerCase()
    const cuidar = fn => { ev.preventDefault(); ev.stopPropagation(); fn() }
    if ((ev.ctrlKey || ev.metaKey) && tecla === 'z') return cuidar(() => ev.shiftKey ? voltarLayoutDiario('refazer', 'desfazer') : voltarLayoutDiario('desfazer', 'refazer'))
    if ((ev.ctrlKey || ev.metaKey) && tecla === 'y') return cuidar(() => voltarLayoutDiario('refazer', 'desfazer'))
    if ((ev.ctrlKey || ev.metaKey) && tecla === 'd') return cuidar(duplicarLayoutDiario)
    if (ev.key === 'Delete' || ev.key === 'Backspace') return cuidar(apagarLayoutDiario)
    if (ev.key === 'Escape') return cuidar(() => { d.acao = null; d.sel = null; d.ferramenta = 'mover'; desenharLayoutDiario(true) })
    const passo = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key]
    if (passo && selecionadoLayoutDiario()) cuidar(() => {
        guardarLayoutDiario()
        deslocarLayoutDiario(selecionadoLayoutDiario(), passo[0] * GRADE_LAYOUT_DIARIO, passo[1] * GRADE_LAYOUT_DIARIO)
        desenharLayoutDiario(true)
    })
}

const selecionadoLayoutDiario = () => layoutDiario.elementos.find(x => x.id === layoutDiario.sel) || null
const encaixarDiario = v => Math.round(v / GRADE_LAYOUT_DIARIO) * GRADE_LAYOUT_DIARIO
const limitarDiario = (v, max) => Math.max(0, Math.min(max, v))
const fotoEstadoLayoutDiario = () => ({ largura: layoutDiario.largura, altura: layoutDiario.altura, elementos: layoutDiario.elementos.map(x => ({ ...x })) })

function guardarLayoutDiario(estado = fotoEstadoLayoutDiario()) {
    layoutDiario.desfazer.push(estado)
    if (layoutDiario.desfazer.length > 200) layoutDiario.desfazer.shift()
    layoutDiario.refazer = []
    layoutDiario.alterado = true
}

function voltarLayoutDiario(de, para) {
    const d = layoutDiario
    if (!d[de].length) return
    d[para].push(fotoEstadoLayoutDiario())
    Object.assign(d, d[de].pop(), { alterado: true })
    desenharLayoutDiario(true)
}

// Paredes ficam dentro da área; os outros elementos têm o centro preso nela.
function deslocarLayoutDiario(el, dx, dy) {
    const d = layoutDiario
    if (el.tipo === 'parede') {
        dx = Math.max(-Math.min(el.x1, el.x2), Math.min(d.largura - Math.max(el.x1, el.x2), dx))
        dy = Math.max(-Math.min(el.y1, el.y2), Math.min(d.altura - Math.max(el.y1, el.y2), dy))
        el.x1 += dx; el.x2 += dx; el.y1 += dy; el.y2 += dy
    } else {
        el.x = Math.max(-el.l / 2, Math.min(d.largura - el.l / 2, el.x + dx))
        el.y = Math.max(-el.a / 2, Math.min(d.altura - el.a / 2, el.y + dy))
    }
}

// SVG do desenho, em unidades de cm (1 m = 100): o mesmo na tela e na imagem salva.
function svgLayoutDiario({ largura, altura, elementos }, { edicao = false, sel = null, escala = 1 } = {}) {
    const n = v => Math.round(v * 1000) / 10
    const L = n(largura), A = n(altura)
    const letra = Math.max(14, Math.min(60, Math.max(L, A) / 60))
    const texto = (x, y, t, tam = letra, extra = '') => `<text x="${x}" y="${y}" font-family="Arial" font-size="${tam}" text-anchor="middle" fill="#33413a" ${extra}>${escaparAtributo(t)}</text>`
    const cota = p => Math.hypot(p.x2 - p.x1, p.y2 - p.y1)
    const desenho = elementos.map(el => {
        const t = TIPOS_LAYOUT_DIARIO[el.tipo]
        if (!t) return ''
        const marcado = el.id === sel
        if (el.tipo === 'parede') {
            const m = cota(el)
            let ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1) * 180 / Math.PI
            if (ang > 90 || ang <= -90) ang += 180
            const cx = n((el.x1 + el.x2) / 2), cy = n((el.y1 + el.y2) / 2)
            const linha = (cor, esp) => `<line x1="${n(el.x1)}" y1="${n(el.y1)}" x2="${n(el.x2)}" y2="${n(el.y2)}" stroke="${cor}" stroke-width="${esp}" stroke-linecap="square"/>`
            return `<g data-el="${el.id}">${edicao ? linha('transparent', Math.max(40, 14 / escala)) : ''}${linha(marcado ? '#269368' : '#202925', 15)}
                ${m >= 1 ? texto(cx, cy - 14, metrosDiario(m), letra * 0.85, `transform="rotate(${Math.round(ang * 10) / 10} ${cx} ${cy})"`) : ''}</g>`
        }
        const l = n(el.l), a = n(el.a), borda = marcado ? '#269368' : t.borda
        let forma
        if (el.tipo === 'porta') forma = `<rect width="${l}" height="${a}" fill="transparent"/><rect width="${l}" height="15" y="${a - 7.5}" fill="#fff"/><path d="M0 ${a} V0 A${l} ${a} 0 0 1 ${l} ${a}" fill="none" stroke="${marcado ? '#269368' : '#5a6660'}" stroke-width="4"/>`
        else if (el.tipo === 'texto') forma = `<rect width="${l}" height="${a}" fill="transparent"${marcado ? ' stroke="#269368" stroke-dasharray="8 6" stroke-width="2"' : ''}/>`
        else forma = `<rect width="${l}" height="${a}" fill="${t.cor}" ${el.tipo === 'sala' ? 'fill-opacity=".6"' : ''} stroke="${borda}" stroke-width="${t.esp * 100}"/>`
        // O rótulo cabe na largura do elemento e fica na horizontal quando o giro o deixaria de cabeça para baixo.
        const rotulo = el.texto || (el.tipo === 'rack' ? 'Rack' : '')
        const tam = el.tipo === 'texto' ? Math.max(10, a * 0.6) : Math.max(8, Math.min(letra, a * 0.6, l / Math.max(1, rotulo.length) * 1.7))
        const virar = el.giro > 90 && el.giro <= 270 ? `transform="rotate(180 ${l / 2} ${a / 2})"` : ''
        return `<g data-el="${el.id}" transform="translate(${n(el.x)} ${n(el.y)}) rotate(${el.giro || 0} ${l / 2} ${a / 2})">${forma}
            ${rotulo ? texto(l / 2, a / 2 + tam * 0.35, rotulo, tam, virar) : ''}
            ${edicao && marcado ? `<rect data-canto="${el.id}" x="${l - 8 / escala}" y="${a - 8 / escala}" width="${16 / escala}" height="${16 / escala}" fill="#269368" stroke="#fff" style="cursor:nwse-resize"/>` : ''}</g>`
    }).join('')
    const grade = edicao ? `<defs><pattern id="dlGrade" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#dde5e0" stroke-width="2"/></pattern></defs><rect width="${L}" height="${A}" fill="url(#dlGrade)"/>` : ''
    const alcas = edicao ? elementos.filter(el => el.id === sel && el.tipo === 'parede').flatMap(el => [1, 2].map(k =>
        `<circle data-ponta="${k}" cx="${n(el['x' + k])}" cy="${n(el['y' + k])}" r="${9 / escala}" fill="#269368" stroke="#fff" style="cursor:grab"/>`)).join('') : ''
    return { L, A, svg: `<rect width="${L}" height="${A}" fill="#fff"/>${grade}${desenho}${alcas}<rect width="${L}" height="${A}" fill="none" stroke="#c4cec8" stroke-width="2"/>` }
}

function desenharLayoutDiario(propriedades = false) {
    const d = layoutDiario
    if (!d) return
    const area = d.tela.querySelector('.dl-area')
    const cabe = Math.min((area.clientWidth - 40) / d.largura, (area.clientHeight - 40) / d.altura)
    const pxPorMetro = Math.max(2, cabe * d.zoom)
    const extras = d.acao?.novo ? [d.acao.novo] : []
    const { L, A, svg } = svgLayoutDiario({ ...d, elementos: [...d.elementos, ...extras] }, { edicao: true, sel: d.sel, escala: pxPorMetro / 100 })
    let el = area.querySelector('svg')
    if (!el) { area.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; el = area.querySelector('svg') }
    el.setAttribute('viewBox', `0 0 ${L} ${A}`)
    el.setAttribute('width', Math.round(d.largura * pxPorMetro))
    el.setAttribute('height', Math.round(d.altura * pxPorMetro))
    el.dataset.ferramenta = d.ferramenta
    el.innerHTML = svg
    d.tela.querySelectorAll('[data-fer]').forEach(b => b.classList.toggle('ativa', b.dataset.fer === d.ferramenta))
    d.tela.querySelector('[data-acao="desfazer"]').disabled = !d.desfazer.length
    d.tela.querySelector('[data-acao="refazer"]').disabled = !d.refazer.length
    if (propriedades) propriedadesLayoutDiario()
}

function propriedadesLayoutDiario() {
    const d = layoutDiario
    const painel = d.tela.querySelector('.dl-props')
    const el = selecionadoLayoutDiario()
    const numero = (nome, rotulo, valor, extra = '') => `<label>${rotulo}<input type="number" step="0.05" name="${nome}" value="${Math.round(valor * 100) / 100}" ${extra}></label>`
    const dicas = {
        mover: 'Clique num elemento para selecionar, arraste para mover. O quadrado verde muda o tamanho; nas paredes, arraste as pontas.',
        parede: 'Clique e arraste. Segure Alt para parede inclinada.',
        sala: 'Clique e arraste para desenhar o retângulo.',
    }
    painel.innerHTML = !el ? `
        <h4>Área da loja</h4>
        ${numero('largura', 'Largura (m)', d.largura, `min="1" max="500" ${d.travado ? 'disabled' : ''}`)}
        ${numero('altura', 'Comprimento (m)', d.altura, `min="1" max="500" ${d.travado ? 'disabled' : ''}`)}
        ${d.travado ? '<small>Já há instalações marcadas neste layout: o tamanho da área não muda, para elas não saírem do lugar.</small>' : ''}
        <small>${dicas[d.ferramenta] || 'Clique na área para colocar. Arraste para já dar o tamanho.'}</small>
        <small>Depois de salvar, clique na imagem do layout para marcar as instalações de cada dia.${d.id ? ` Esta alteração vale de ${dataPlanoDiario(d.desde)} em diante.` : ''}</small>`
        : `
        <h4>${TIPOS_LAYOUT_DIARIO[el.tipo].rotulo}</h4>
        ${el.tipo === 'parede'
            ? numero('comprimento', 'Comprimento (m)', Math.hypot(el.x2 - el.x1, el.y2 - el.y1), 'min="0.25" max="500"')
            : `<label>Texto<input type="text" name="texto" maxlength="120" value="${escaparAtributo(el.texto || '')}"></label>
               ${numero('l', 'Largura (m)', el.l, 'min="0.05" max="500"')}${numero('a', 'Profundidade (m)', el.a, 'min="0.05" max="500"')}
               <button type="button" data-prop="girar">Girar 90°</button>`}
        <button type="button" data-prop="duplicar">Duplicar (Ctrl+D)</button>
        <button type="button" data-prop="apagar">Apagar (Delete)</button>`
    painel.querySelectorAll('input').forEach(i => i.addEventListener('change', () => mudarPropLayoutDiario(i.name, i.value)))
    painel.querySelector('[data-prop="girar"]')?.addEventListener('click', () => { guardarLayoutDiario(); el.giro = ((el.giro || 0) + 90) % 360; desenharLayoutDiario(true) })
    painel.querySelector('[data-prop="duplicar"]')?.addEventListener('click', duplicarLayoutDiario)
    painel.querySelector('[data-prop="apagar"]')?.addEventListener('click', apagarLayoutDiario)
}

function mudarPropLayoutDiario(nome, valor) {
    const d = layoutDiario
    const el = selecionadoLayoutDiario()
    const v = Number(valor)
    if (nome !== 'texto' && !(v >= 0.05 && v <= 500)) return propriedadesLayoutDiario()
    if (['largura', 'altura'].includes(nome)) {
        if (d.travado || v < 1) return propriedadesLayoutDiario()
        // Diminuir a área não pode deixar parte do desenho de fora.
        const eixo = nome === 'largura' ? ['x1', 'x2', 'x', 'l'] : ['y1', 'y2', 'y', 'a']
        const usado = Math.max(0, ...d.elementos.map(x => x.tipo === 'parede' ? Math.max(x[eixo[0]], x[eixo[1]]) : x[eixo[2]] + x[eixo[3]] / 2))
        if (v < usado - 0.01) {
            avisarLayoutDiario(`O desenho ocupa ${metrosDiario(usado)}. Mova ou apague o que está fora antes de diminuir a área.`)
            return propriedadesLayoutDiario()
        }
        guardarLayoutDiario()
        d[nome] = v
    } else if (el) {
        guardarLayoutDiario()
        if (nome === 'texto') el.texto = valor.slice(0, 120)
        else if (nome === 'comprimento') {
            const atual = Math.hypot(el.x2 - el.x1, el.y2 - el.y1) || 1
            el.x2 = limitarDiario(el.x1 + (el.x2 - el.x1) / atual * v, d.largura)
            el.y2 = limitarDiario(el.y1 + (el.y2 - el.y1) / atual * v, d.altura)
        } else el[nome] = v
    }
    desenharLayoutDiario(true)
}

function duplicarLayoutDiario() {
    const el = selecionadoLayoutDiario()
    if (!el) return
    guardarLayoutDiario()
    const novo = { ...el, id: crypto.randomUUID() }
    layoutDiario.elementos.push(novo)
    if (novo.tipo === 'parede') deslocarLayoutDiario(novo, 0.5, 0.5)
    else deslocarLayoutDiario(novo, 0, (novo.giro || 0) % 180 ? novo.l + 1 : novo.a + 1)
    layoutDiario.sel = novo.id
    desenharLayoutDiario(true)
}

function apagarLayoutDiario() {
    if (!selecionadoLayoutDiario()) return
    guardarLayoutDiario()
    layoutDiario.elementos = layoutDiario.elementos.filter(x => x.id !== layoutDiario.sel)
    layoutDiario.sel = null
    desenharLayoutDiario(true)
}

function zoomLayoutDiario(fator) {
    layoutDiario.zoom = Math.max(0.5, Math.min(8, layoutDiario.zoom * fator))
    desenharLayoutDiario()
}

function pontoLayoutDiario(ev) {
    const r = layoutDiario.tela.querySelector('.dl-area svg').getBoundingClientRect()
    return [(ev.clientX - r.left) / r.width * layoutDiario.largura, (ev.clientY - r.top) / r.height * layoutDiario.altura]
}

function apertarLayoutDiario(ev) {
    const d = layoutDiario
    if (ev.button !== 0 || !ev.target.closest('.dl-area svg')) return
    if (document.activeElement?.closest('.dl-props')) document.activeElement.blur()
    ev.preventDefault()
    const [px, py] = pontoLayoutDiario(ev)
    const area = d.tela.querySelector('.dl-area')
    const antes = fotoEstadoLayoutDiario()
    if (d.ferramenta === 'mover') {
        const canto = ev.target.closest('[data-canto]'), ponta = ev.target.closest('[data-ponta]'), alvo = ev.target.closest('[data-el]')
        if (canto || ponta) d.acao = { modo: canto ? 'canto' : 'ponta', k: ponta?.dataset.ponta, el: selecionadoLayoutDiario(), antes }
        else {
            d.sel = alvo?.dataset.el || null
            const el = selecionadoLayoutDiario()
            d.acao = el ? { modo: 'mover', el, inicio: [px, py], base: { ...el }, antes } : null
        }
    } else {
        const x = limitarDiario(encaixarDiario(px), d.largura), y = limitarDiario(encaixarDiario(py), d.altura)
        const t = TIPOS_LAYOUT_DIARIO[d.ferramenta], id = crypto.randomUUID()
        d.acao = { modo: 'criar', inicio: [x, y], antes,
            novo: d.ferramenta === 'parede' ? { id, tipo: 'parede', x1: x, y1: y, x2: x, y2: y }
                : { id, tipo: d.ferramenta, x, y, l: t.l || 0.25, a: t.a || 0.25, giro: 0, texto: '' } }
    }
    // Só com ação em andamento, para o arraste continuar fora da área.
    if (d.acao) area.setPointerCapture(ev.pointerId)
    desenharLayoutDiario(true)
}

function arrastarLayoutDiario(ev) {
    const d = layoutDiario
    const ac = d?.acao
    if (!ac) return
    const [px, py] = pontoLayoutDiario(ev)
    const x = limitarDiario(encaixarDiario(px), d.largura), y = limitarDiario(encaixarDiario(py), d.altura)
    // Parede reta por padrão: segue o eixo em que o arraste foi maior.
    const reto = (ox, oy) => ev.altKey ? [x, y] : Math.abs(x - ox) >= Math.abs(y - oy) ? [x, oy] : [ox, y]
    if (ac.modo === 'criar') {
        const n = ac.novo, [ix, iy] = ac.inicio
        if (n.tipo === 'parede') [n.x2, n.y2] = reto(ix, iy)
        else if (Math.abs(x - ix) >= GRADE_LAYOUT_DIARIO && Math.abs(y - iy) >= GRADE_LAYOUT_DIARIO)
            Object.assign(n, { x: Math.min(x, ix), y: Math.min(y, iy), l: Math.abs(x - ix), a: Math.abs(y - iy) })
    } else if (ac.modo === 'mover') {
        const dx = encaixarDiario(px - ac.inicio[0]), dy = encaixarDiario(py - ac.inicio[1])
        Object.assign(ac.el, ac.base)
        deslocarLayoutDiario(ac.el, dx, dy)
        ac.mexeu ||= dx !== 0 || dy !== 0
    } else if (ac.modo === 'ponta') {
        const k = ac.k, o = k === '1' ? '2' : '1'
        ;[ac.el['x' + k], ac.el['y' + k]] = reto(ac.el['x' + o], ac.el['y' + o])
        ac.mexeu = true
    } else if (ac.modo === 'canto') {
        // Com giro, o canto oposto precisa ficar parado: calcula nos eixos do próprio elemento.
        const el = ac.el, rad = (el.giro || 0) * Math.PI / 180, cos = Math.cos(rad), sen = Math.sin(rad)
        const cx = el.x + el.l / 2, cy = el.y + el.a / 2
        const fx = cx - el.l / 2 * cos + el.a / 2 * sen, fy = cy - el.l / 2 * sen - el.a / 2 * cos
        const l = Math.max(GRADE_LAYOUT_DIARIO, encaixarDiario((px - fx) * cos + (py - fy) * sen))
        const a = Math.max(GRADE_LAYOUT_DIARIO, encaixarDiario(-(px - fx) * sen + (py - fy) * cos))
        const ncx = fx + l / 2 * cos - a / 2 * sen, ncy = fy + l / 2 * sen + a / 2 * cos
        Object.assign(el, { l, a, x: ncx - l / 2, y: ncy - a / 2 })
        ac.mexeu = true
    }
    desenharLayoutDiario()
}

function soltarLayoutDiario() {
    const d = layoutDiario
    const ac = d?.acao
    if (!ac) return
    d.acao = null
    if (ac.modo === 'criar') {
        const n = ac.novo
        const valido = n.tipo === 'parede' ? n.x1 !== n.x2 || n.y1 !== n.y2 : n.tipo !== 'sala' || n.l > GRADE_LAYOUT_DIARIO || n.a > GRADE_LAYOUT_DIARIO
        if (valido && d.elementos.length < 3000) {
            guardarLayoutDiario(ac.antes)
            d.elementos.push(n)
            // Parede e sala seguem ligadas (várias seguidas); o resto já fica selecionado para ajustar.
            if (!['parede', 'sala'].includes(n.tipo)) { d.ferramenta = 'mover'; d.sel = n.id }
        }
    } else if (ac.mexeu) guardarLayoutDiario(ac.antes)
    desenharLayoutDiario(true)
    if (d.ferramenta === 'mover' && selecionadoLayoutDiario()?.tipo === 'texto' && ac.modo === 'criar') d.tela.querySelector('.dl-props [name="texto"]')?.focus()
}

// Balão por cima do editor (que fica acima dos popups).
function avisarLayoutDiario(mensagem) {
    popup({ mensagem })
    const pilha = document.querySelector('.balao-pilha')
    if (pilha) pilha.style.zIndex = 10060
}

async function fecharLayoutDiario() {
    const d = layoutDiario
    if (!d || d.salvando) return
    if (d.alterado) {
        d.tela.style.visibility = 'hidden'
        const sair = await confirmarPopup({ mensagem: 'Descartar as alterações do desenho?', textoConfirmar: 'Descartar' })
        d.tela.style.visibility = ''
        if (!sair) return
    }
    encerrarLayoutDiario()
}

function encerrarLayoutDiario() {
    document.removeEventListener('keydown', teclasLayoutDiario, true)
    layoutDiario?.tela.remove()
    layoutDiario = null
}

// Desenho → PNG (até 2400 px no lado maior).
async function imagemLayoutDiario(d) {
    const { L, A, svg } = svgLayoutDiario(d)
    const escala = 2400 / Math.max(L, A)
    const largura = Math.max(1, Math.round(L * escala)), altura = Math.max(1, Math.round(A * escala))
    const img = new Image()
    await new Promise((ok, erro) => {
        img.onload = ok
        img.onerror = () => erro(new Error('Não foi possível gerar a imagem do layout.'))
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${L} ${A}">${svg}</svg>`)}`
    })
    const canvas = document.createElement('canvas')
    canvas.width = largura; canvas.height = altura
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, largura, altura)
    ctx.drawImage(img, 0, 0, largura, altura)
    return canvas.toDataURL('image/png')
}

async function salvarLayoutDiario() {
    const d = layoutDiario
    if (!d || d.salvando) return
    if (!d.elementos.length) return avisarLayoutDiario('Desenhe alguma coisa antes de salvar.')
    const botao = d.tela.querySelector('.dl-salvar')
    d.salvando = true
    botao.disabled = true
    try {
        const enviada = await importarAnexos({ foto: await imagemLayoutDiario(d) })
        const link = Array.isArray(enviada) && enviada[0]?.link
        // Em falha o importarAnexos já mostrou o aviso.
        if (!link) throw new Error('A imagem do layout não foi enviada. Tente de novo.')
        const { largura, altura, elementos } = d
        let gravou = false
        await gravarGaleriaDiario({ acao: 'layout', id: d.id || undefined, desde: d.desde, link, layout: { largura, altura, elementos } },
            'Layout salvo. Clique na imagem dele para marcar as instalações.', () => { gravou = true; encerrarLayoutDiario() })
        if (!gravou) avisarLayoutDiario('O layout não foi salvo. O desenho continua aqui.')
    } catch (e) { avisarLayoutDiario(e.message) }
    finally { d.salvando = false; botao.disabled = false }
}
