// TÉCNICO NA ROTA — joguinho da tela inicial (aparece quando não há pendências).
// A van do técnico desvia de cones, buracos e barreiras e recolhe chamados no caminho.
// Tudo desenhado no canvas (620x180 internos; o CSS escala). Recorde fica no navegador.

const ROTA = {
    largura: 620,
    altura: 180,
    chao: 146,          // base das rodas
    gravidade: 0.62,
    impulso: -10.6,
    pulinho: -4.2,      // soltar cedo = pulo curto
    velocidadeInicial: 4.2,
    chaveRecorde: 'jogoRotaRecorde'
}

let canvasJogo = null
let ctxJogo = null
let animationId = null
let rota = null

const van = { x: 64, y: 0, largura: 58, altura: 30, vy: 0, noChao: true, giroRoda: 0 }

function lerRecordeRota() {
    try { return Number(localStorage.getItem(ROTA.chaveRecorde)) || 0 } catch { return 0 }
}

function salvarRecordeRota(valor) {
    try { localStorage.setItem(ROTA.chaveRecorde, String(valor)) } catch { }
}

function novoCenarioRota() {
    // Prédios ao fundo (parallax), gerados uma vez e reciclados.
    const predios = []
    for (let x = 0; x < ROTA.largura + 120; x += 34 + Math.random() * 30) {
        predios.push({ x, largura: 26 + Math.random() * 34, altura: 30 + Math.random() * 55, tom: Math.random() })
    }
    return {
        estado: 'parado',      // parado | jogando | fim
        pontos: 0,
        distancia: 0,
        chamados: 0,
        velocidade: ROTA.velocidadeInicial,
        proximoObstaculo: 60,
        proximoChamado: 140,
        obstaculos: [],
        coletaveis: [],
        particulas: [],
        textos: [],
        predios,
        deslocamentoFaixa: 0,
        recorde: lerRecordeRota(),
        novoRecorde: false,
        ultimoQuadro: 0
    }
}

// ---------- CONTROLE ----------

function pressionarRota() {
    if (!canvasJogo || !rota) return
    if (rota.estado !== 'jogando') return comecarRota()
    if (van.noChao) {
        van.vy = ROTA.impulso
        van.noChao = false
    }
}

function soltarRota() {
    if (rota?.estado === 'jogando' && van.vy < ROTA.pulinho) van.vy = ROTA.pulinho
}

function comecarRota() {
    cancelAnimationFrame(animationId)
    const recorde = rota?.recorde ?? lerRecordeRota()
    rota = novoCenarioRota()
    rota.recorde = recorde
    rota.estado = 'jogando'
    van.y = ROTA.chao - van.altura
    van.vy = 0
    van.noChao = true
    rota.ultimoQuadro = performance.now()
    animationId = requestAnimationFrame(quadroRota)
}

function encerrarRota() {
    rota.estado = 'fim'
    if (rota.pontos > rota.recorde) {
        rota.recorde = rota.pontos
        rota.novoRecorde = true
        salvarRecordeRota(rota.pontos)
    }
    for (let i = 0; i < 14; i++) poeiraRota(van.x + van.largura - 6, van.y + van.altura / 2, '#f59e0b')
}

// ---------- LÓGICA ----------

function criarObstaculoRota() {
    const tipos = rota.distancia < 400 ? ['cone', 'buraco'] : ['cone', 'buraco', 'barreira', 'cone']
    const tipo = tipos[Math.floor(Math.random() * tipos.length)]
    const medidas = {
        cone: { largura: 18, altura: 24 },
        buraco: { largura: 34, altura: 6 },
        barreira: { largura: 34, altura: 26 }
    }[tipo]
    rota.obstaculos.push({ tipo, x: ROTA.largura + 10, y: ROTA.chao - medidas.altura + (tipo === 'buraco' ? 4 : 0), ...medidas })
}

function criarChamadoRota() {
    const alto = Math.random() < 0.55
    rota.coletaveis.push({ x: ROTA.largura + 10, y: alto ? 70 : 112, base: alto ? 70 : 112, fase: Math.random() * 6 })
}

function poeiraRota(x, y, cor = '#cbd5e1') {
    rota.particulas.push({
        x, y,
        vx: -1 - Math.random() * 2.5,
        vy: -Math.random() * 2,
        vida: 1,
        raio: 2 + Math.random() * 3,
        cor
    })
}

function bateuRota(o) {
    // Caixa da van um pouco menor que o desenho: colisão justa, sem "morte injusta".
    const folga = o.tipo === 'buraco' ? 10 : 6
    return van.x + 6 < o.x + o.largura - folga / 2 &&
        van.x + van.largura - 6 > o.x + folga / 2 &&
        van.y + 4 < o.y + o.altura &&
        van.y + van.altura > o.y + (o.tipo === 'buraco' ? 0 : 4)
}

function atualizarRota(passo) {
    const v = rota.velocidade * passo

    // Van
    const estavaNoAr = !van.noChao
    van.vy += ROTA.gravidade * passo
    van.y += van.vy * passo
    if (van.y >= ROTA.chao - van.altura) {
        van.y = ROTA.chao - van.altura
        van.vy = 0
        van.noChao = true
        if (estavaNoAr) for (let i = 0; i < 5; i++) poeiraRota(van.x + 10, ROTA.chao)
    }
    van.giroRoda += v * 0.18
    if (van.noChao && Math.random() < 0.25 * passo) poeiraRota(van.x + 2, ROTA.chao - 3)

    // Cenário
    rota.distancia += v
    rota.deslocamentoFaixa = (rota.deslocamentoFaixa + v) % 40
    for (const p of rota.predios) {
        p.x -= v * 0.25
        if (p.x + p.largura < 0) p.x += ROTA.largura + 120
    }

    // Surgimento (em distância, não em tempo: acompanha a aceleração)
    rota.proximoObstaculo -= v
    if (rota.proximoObstaculo <= 0) {
        criarObstaculoRota()
        rota.proximoObstaculo = 190 + Math.random() * 170 + rota.velocidade * 8
    }
    rota.proximoChamado -= v
    if (rota.proximoChamado <= 0) {
        criarChamadoRota()
        rota.proximoChamado = 260 + Math.random() * 320
    }

    // Obstáculos
    for (const o of rota.obstaculos) {
        o.x -= v
        if (bateuRota(o)) return encerrarRota()
    }
    rota.obstaculos = rota.obstaculos.filter(o => o.x + o.largura > -10)

    // Chamados
    for (const c of rota.coletaveis) {
        c.x -= v
        c.fase += 0.08 * passo
        c.y = c.base + Math.sin(c.fase) * 4
        const pegou = van.x < c.x + 18 && van.x + van.largura > c.x && van.y < c.y + 18 && van.y + van.altura > c.y
        if (pegou) {
            c.pego = true
            rota.chamados++
            rota.pontos += 25
            rota.textos.push({ x: c.x, y: c.y, texto: '+25 chamado!', vida: 1 })
        }
    }
    rota.coletaveis = rota.coletaveis.filter(c => !c.pego && c.x > -20)

    // Efeitos
    for (const p of rota.particulas) {
        p.x += p.vx * passo
        p.y += p.vy * passo
        p.vida -= 0.035 * passo
    }
    rota.particulas = rota.particulas.filter(p => p.vida > 0)
    for (const t of rota.textos) {
        t.y -= 0.6 * passo
        t.vida -= 0.02 * passo
    }
    rota.textos = rota.textos.filter(t => t.vida > 0)

    // Pontuação e dificuldade
    rota.pontos += 0.1 * passo
    rota.velocidade = Math.min(10, ROTA.velocidadeInicial + rota.distancia / 2200)
}

// ---------- DESENHO ----------

function retanguloArredondado(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

function desenharCenarioRota(ctx) {
    const { largura, altura, chao } = ROTA

    const ceu = ctx.createLinearGradient(0, 0, 0, chao)
    ceu.addColorStop(0, '#dbeafe')
    ceu.addColorStop(1, '#f6f8fb')
    ctx.fillStyle = ceu
    ctx.fillRect(0, 0, largura, altura)

    // Sol
    ctx.fillStyle = '#fde68a'
    ctx.beginPath()
    ctx.arc(540, 38, 18, 0, Math.PI * 2)
    ctx.fill()

    // Prédios
    for (const p of rota.predios) {
        ctx.fillStyle = p.tom > 0.5 ? '#c7d2de' : '#b6c3d1'
        ctx.fillRect(p.x, chao - 18 - p.altura, p.largura, p.altura)
        ctx.fillStyle = '#e8eef5'
        for (let jy = chao - 12 - p.altura; jy < chao - 24; jy += 10)
            for (let jx = p.x + 4; jx < p.x + p.largura - 6; jx += 8)
                ctx.fillRect(jx, jy, 4, 5)
    }

    // Calçada e rua
    ctx.fillStyle = '#94a3b8'
    ctx.fillRect(0, chao - 18, largura, 4)
    ctx.fillStyle = '#475569'
    ctx.fillRect(0, chao - 14, largura, altura - chao + 14)
    ctx.fillStyle = '#334155'
    ctx.fillRect(0, chao + 4, largura, altura - chao)

    // Faixa central tracejada
    ctx.fillStyle = '#f8fafc'
    for (let x = -rota.deslocamentoFaixa; x < largura; x += 40)
        ctx.fillRect(x, chao + 14, 20, 3)
}

function desenharVanRota(ctx) {
    const { x, largura: w, altura: h } = van
    const y = van.y

    // Sombra
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)'
    ctx.beginPath()
    ctx.ellipse(x + w / 2, ROTA.chao + 1, w / 2 - (ROTA.chao - (y + h)) * 0.15, 3, 0, 0, Math.PI * 2)
    ctx.fill()

    // Carroceria
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1.5
    retanguloArredondado(ctx, x, y + 2, w - 14, h - 8, 4)
    ctx.fill(); ctx.stroke()
    // Cabine
    ctx.beginPath()
    ctx.moveTo(x + w - 14, y + 8)
    ctx.lineTo(x + w - 5, y + 10)
    ctx.quadraticCurveTo(x + w, y + 12, x + w, y + 18)
    ctx.lineTo(x + w, y + h - 6)
    ctx.lineTo(x + w - 14, y + h - 6)
    ctx.closePath()
    ctx.fill(); ctx.stroke()
    // Janela da cabine
    ctx.fillStyle = '#7dd3fc'
    ctx.beginPath()
    ctx.moveTo(x + w - 12, y + 11)
    ctx.lineTo(x + w - 6, y + 12)
    ctx.lineTo(x + w - 3, y + 17)
    ctx.lineTo(x + w - 12, y + 17)
    ctx.closePath()
    ctx.fill()

    // Faixa e logo
    ctx.fillStyle = '#2f7d4a'
    ctx.fillRect(x + 1, y + 13, w - 15, 5)
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 8px Arial'
    ctx.fillText('GCS', x + 6, y + 11)
    ctx.font = '9px Arial'
    ctx.fillText('🔧', x + 28, y + 12)

    // Farol
    ctx.fillStyle = '#facc15'
    ctx.fillRect(x + w - 3, y + 19, 3, 3)

    // Rodas
    for (const rx of [x + 11, x + w - 11]) {
        const ry = y + h - 5
        ctx.fillStyle = '#1e293b'
        ctx.beginPath(); ctx.arc(rx, ry, 6, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#cbd5e1'
        ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#cbd5e1'
        ctx.lineWidth = 1
        for (let i = 0; i < 3; i++) {
            const a = van.giroRoda + i * (Math.PI * 2 / 3)
            ctx.beginPath()
            ctx.moveTo(rx, ry)
            ctx.lineTo(rx + Math.cos(a) * 5, ry + Math.sin(a) * 5)
            ctx.stroke()
        }
    }
}

function desenharObstaculoRota(ctx, o) {
    if (o.tipo === 'cone') {
        ctx.fillStyle = '#f97316'
        ctx.beginPath()
        ctx.moveTo(o.x + o.largura / 2, o.y)
        ctx.lineTo(o.x + o.largura - 2, o.y + o.altura - 3)
        ctx.lineTo(o.x + 2, o.y + o.altura - 3)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(o.x + 6, o.y + 11, o.largura - 12, 3)
        ctx.fillStyle = '#c2410c'
        ctx.fillRect(o.x, o.y + o.altura - 3, o.largura, 3)
    } else if (o.tipo === 'buraco') {
        ctx.fillStyle = '#0f172a'
        ctx.beginPath()
        ctx.ellipse(o.x + o.largura / 2, o.y + 3, o.largura / 2, 4, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#64748b'
        ctx.lineWidth = 1
        ctx.stroke()
    } else {
        // Barreira listrada
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(o.x, o.y + 4, o.largura, 9)
        ctx.save()
        ctx.beginPath()
        ctx.rect(o.x, o.y + 4, o.largura, 9)
        ctx.clip()
        ctx.fillStyle = '#dc2626'
        for (let i = -10; i < o.largura; i += 10) {
            ctx.beginPath()
            ctx.moveTo(o.x + i, o.y + 13)
            ctx.lineTo(o.x + i + 5, o.y + 4)
            ctx.lineTo(o.x + i + 10, o.y + 4)
            ctx.lineTo(o.x + i + 5, o.y + 13)
            ctx.fill()
        }
        ctx.restore()
        ctx.fillStyle = '#334155'
        ctx.fillRect(o.x + 3, o.y + 13, 3, o.altura - 13)
        ctx.fillRect(o.x + o.largura - 6, o.y + 13, 3, o.altura - 13)
    }
}

function desenharChamadoRota(ctx, c) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#2f7d4a'
    ctx.lineWidth = 2
    retanguloArredondado(ctx, c.x, c.y, 18, 18, 5)
    ctx.fill(); ctx.stroke()
    ctx.font = '11px Arial'
    ctx.fillText('🔧', c.x + 3, c.y + 13)
}

function desenharHudRota(ctx) {
    ctx.font = 'bold 13px Arial'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1e293b'
    ctx.fillText(`Pontos: ${Math.floor(rota.pontos)}`, 14, 22)
    ctx.fillStyle = '#2f7d4a'
    ctx.fillText(`🔧 ${rota.chamados}`, 120, 22)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#64748b'
    ctx.font = '12px Arial'
    ctx.fillText(`Recorde: ${Math.floor(rota.recorde)}`, ROTA.largura - 14, 22)
    ctx.textAlign = 'left'
}

function painelRota(ctx, titulo, linhas) {
    const w = 330, h = 30 + linhas.length * 20
    const x = (ROTA.largura - w) / 2, y = 44
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    retanguloArredondado(ctx, x, y, w, h, 10)
    ctx.fill(); ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 17px Arial'
    ctx.fillText(titulo, ROTA.largura / 2, y + 24)
    ctx.font = '12px Arial'
    ctx.fillStyle = '#475569'
    linhas.forEach((linha, i) => ctx.fillText(linha, ROTA.largura / 2, y + 44 + i * 18))
    ctx.textAlign = 'left'
}

function desenharRota() {
    const ctx = ctxJogo
    ctx.clearRect(0, 0, ROTA.largura, ROTA.altura)
    desenharCenarioRota(ctx)

    for (const o of rota.obstaculos) desenharObstaculoRota(ctx, o)
    for (const c of rota.coletaveis) desenharChamadoRota(ctx, c)

    for (const p of rota.particulas) {
        ctx.globalAlpha = Math.max(0, p.vida)
        ctx.fillStyle = p.cor
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.globalAlpha = 1

    desenharVanRota(ctx)

    for (const t of rota.textos) {
        ctx.globalAlpha = Math.max(0, t.vida)
        ctx.fillStyle = '#2f7d4a'
        ctx.font = 'bold 12px Arial'
        ctx.fillText(t.texto, t.x - 10, t.y)
    }
    ctx.globalAlpha = 1

    desenharHudRota(ctx)

    if (rota.estado === 'parado')
        painelRota(ctx, '🚐 Técnico na rota', ['Toque, clique ou espaço para pular', 'Desvie dos cones e buracos e pegue os chamados 🔧'])

    if (rota.estado === 'fim')
        painelRota(ctx, rota.novoRecorde ? '🏆 Novo recorde!' : 'Rota encerrada!', [
            `${Math.floor(rota.pontos)} pontos · ${rota.chamados} chamado${rota.chamados === 1 ? '' : 's'} atendido${rota.chamados === 1 ? '' : 's'}`,
            'Toque ou espaço para sair de novo'
        ])
}

function quadroRota(agora) {
    if (!canvasJogo || !canvasJogo.isConnected) return limparJogo()

    // Passo relativo a 60 fps: mesma velocidade em telas de 60/120/144 Hz.
    const passo = Math.min(2.5, (agora - rota.ultimoQuadro) / (1000 / 60)) || 1
    rota.ultimoQuadro = agora

    if (rota.estado === 'jogando') atualizarRota(passo)
    else {
        // Depois da batida, só as partículas terminam de assentar.
        for (const p of rota.particulas) { p.x += p.vx * passo; p.y += p.vy * passo; p.vida -= 0.035 * passo }
        rota.particulas = rota.particulas.filter(p => p.vida > 0)
    }

    desenharRota()

    if (rota.estado === 'jogando' || rota.particulas.length)
        animationId = requestAnimationFrame(quadroRota)
}

// ---------- INTEGRAÇÃO COM A TELA ----------

function tratarTeclaJogo(evento) {
    if (!canvasJogo || !canvasJogo.isConnected) return limparJogo()
    if (evento.target.matches('input, textarea, select, [contenteditable="true"]')) return
    if (evento.code !== 'Space' && evento.code !== 'ArrowUp') return
    evento.preventDefault()
    if (evento.type === 'keydown' && !evento.repeat) pressionarRota()
    if (evento.type === 'keyup') soltarRota()
}

function tocarJogo(evento) {
    evento.preventDefault()
    pressionarRota()
}

function limparJogo() {
    cancelAnimationFrame(animationId)

    if (canvasJogo) {
        canvasJogo.removeEventListener('pointerdown', tocarJogo)
        canvasJogo.removeEventListener('pointerup', soltarRota)
        canvasJogo.removeEventListener('pointerleave', soltarRota)
    }

    document.removeEventListener('keydown', tratarTeclaJogo)
    document.removeEventListener('keyup', tratarTeclaJogo)

    canvasJogo = null
    ctxJogo = null
    if (rota) rota.estado = 'parado'
}

function atribuirFuncoesJogo() {
    limparJogo()

    canvasJogo = document.querySelector('#jogoPendencias')
    if (!canvasJogo) return

    ctxJogo = canvasJogo.getContext('2d')
    rota = novoCenarioRota()
    van.y = ROTA.chao - van.altura
    van.vy = 0
    van.noChao = true

    canvasJogo.style.touchAction = 'manipulation'
    canvasJogo.addEventListener('pointerdown', tocarJogo)
    canvasJogo.addEventListener('pointerup', soltarRota)
    canvasJogo.addEventListener('pointerleave', soltarRota)
    document.addEventListener('keydown', tratarTeclaJogo)
    document.addEventListener('keyup', tratarTeclaJogo)

    desenharRota()
}
