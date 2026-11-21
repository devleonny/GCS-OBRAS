// ---------------- Rastreamento dos carros (Mobi7) ----------------
// Dados gravados no servidor pelo processo "mobi7" (gcs: SCRIPTS/mobi7.js, posição a cada minuto e
// backup de trajetos, viagens e ofensas desde 01/01/2026) e lidos por /veiculos/rastreio/* (SCRIPTS/mobi7_rotas.js).
// Acesso: veiculos.rastreio. Mapa gratuito: Leaflet + OpenStreetMap, carregados só quando um mapa abre.
//
// Ícone automático: qualquer tela que marcar um elemento com
//     data-rastreio-usuario="login"   (técnico/motorista; o carro vem do cadastro de Veículos → motoristas)
//     data-rastreio-placa="ABC1D23"   (carro)
//     data-rastreio-de / data-rastreio-ate = AAAA-MM-DD (opcional: abre o Histórico nesse período)
// ganha ao lado um carrinho colorido (em movimento, ligado, desligado, sem sinal) que abre o popup do carro.
// Quem não tem acesso ou não tem carro com rastreador não vê nada.

const RASTREIO = { frota: null, quando: 0, carregando: null, porUsuario: new Map(), porPlaca: new Map(), janelas: new Map() }
const RASTREIO_VALIDADE = 55 * 1000 // o servidor atualiza a posição a cada minuto
const RASTREIO_ATUALIZAR = 30 * 1000

const podeRastreio = () => typeof pode === 'function' && pode('veiculos.rastreio')
const placaRastreio = p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

async function apiRastreio(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/veiculos/rastreio/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.mensagem || 'Falha ao consultar o rastreamento.')
    return dados
}

// Frota com a posição atual (uma consulta por minuto, compartilhada por todas as telas).
async function frotaRastreio({ forcar = false } = {}) {
    if (!forcar && RASTREIO.frota && Date.now() - RASTREIO.quando < RASTREIO_VALIDADE) return RASTREIO.frota
    if (RASTREIO.carregando) return RASTREIO.carregando
    RASTREIO.carregando = apiRastreio('frota')
        .then(({ veiculos = [] }) => {
            RASTREIO.frota = veiculos
            RASTREIO.porUsuario = new Map()
            RASTREIO.porPlaca = new Map()
            // A lista vem com quem está rodando primeiro: com dois carros, vale o mais recente.
            for (const v of veiculos) {
                if (!RASTREIO.porPlaca.has(v.placa)) RASTREIO.porPlaca.set(v.placa, v)
                for (const u of v.motoristas_usuarios || []) {
                    const chave = String(u).trim().toLowerCase()
                    if (chave && !RASTREIO.porUsuario.has(chave)) RASTREIO.porUsuario.set(chave, v)
                }
            }
            return veiculos
        })
        .catch(erro => {
            // Sem acesso ou fora do ar: não insiste até a próxima janela.
            RASTREIO.frota ??= []
            throw erro
        })
        .finally(() => {
            RASTREIO.quando = Date.now()
            RASTREIO.carregando = null
        })
    return RASTREIO.carregando
}

// ---------- textos ----------

const horaRastreio = d => d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'
const dataHoraRastreio = d => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const kmRastreio = n => n == null ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`

function duracaoRastreio(segundos) {
    const min = Math.round((segundos || 0) / 60)
    if (min < 60) return `${min} min`
    return `${Math.floor(min / 60)} h${String(min % 60).padStart(2, '0')}`
}

function desdeRastreio(d) {
    if (!d) return ''
    const min = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000))
    if (min < 1) return 'agora'
    if (min < 60) return `há ${min} min`
    if (min < 48 * 60) return `há ${Math.round(min / 60)} h`
    return `há ${Math.round(min / 1440)} dias`
}

function situacaoRastreio(v) {
    if (v?.em_movimento) return { classe: 'movimento', texto: `Em movimento · ${v.velocidade || 0} km/h` }
    if (v?.ligado) return { classe: 'ligado', texto: 'Ligado, parado' }
    if (v?.transmitindo) return { classe: 'parado', texto: `Desligado ${desdeRastreio(v.posicao_data)}` }
    return { classe: 'sem-sinal', texto: `Sem sinal desde ${dataHoraRastreio(v?.posicao_data)}` }
}

const OFENSAS_RASTREIO = {
    breaking_light: 'Freada brusca (leve)', breaking_hard: 'Freada brusca (forte)',
    curve_light: 'Curva brusca (leve)', curve_hard: 'Curva brusca (forte)',
    acceleration_light: 'Aceleração brusca (leve)', acceleration_hard: 'Aceleração brusca (forte)',
    exceeded_speed: 'Excesso de velocidade'
}
const nomeOfensaRastreio = t => OFENSAS_RASTREIO[t] || t

const nomeCarroRastreio = v => [v.placa, v.motoristas_nomes || v.motorista || v.apelido].filter(Boolean).join(' · ')

const SVG_CARRO_RASTREIO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3.5h2.2m13.8-5.5a2 2 0 0 1 2 2v3.5h-2.2M5.2 16.5a1.8 1.8 0 1 0 3.6 0m-3.6 0a1.8 1.8 0 1 1 3.6 0m0 0h6.4m0 0a1.8 1.8 0 1 0 3.6 0m-3.6 0a1.8 1.8 0 1 1 3.6 0"/></svg>`

// ---------- ícone automático ao lado de técnicos e placas ----------

const SELETOR_RASTREIO = '[data-rastreio-usuario]:not([data-rastreio-ok]), [data-rastreio-placa]:not([data-rastreio-ok])'

function veiculoDoElementoRastreio(el) {
    if (el.dataset.rastreioPlaca) return RASTREIO.porPlaca.get(placaRastreio(el.dataset.rastreioPlaca))
    return RASTREIO.porUsuario.get(String(el.dataset.rastreioUsuario || '').trim().toLowerCase())
}

function iconeRastreio(v, de, ate) {
    const { classe, texto } = situacaoRastreio(v)
    const periodo = de ? `, { de: '${escaparAtributo(de)}', ate: '${escaparAtributo(ate || de)}' }` : ''
    return `<button type="button" class="rastreio-icone ${classe}" data-rastreio-veiculo="${escaparAtributo(v.id)}"
        title="${escaparAtributo(`Rastreio ${v.placa}: ${texto}${de ? ' · clique para ver o período' : ''}`)}"
        onclick="event.stopPropagation(); abrirRastreio('${escaparAtributo(v.id)}'${periodo})">${SVG_CARRO_RASTREIO}</button>`
}

let agendadoRastreio = false

function marcarRastreio() {
    agendadoRastreio = false
    if (!podeRastreio()) return
    const alvos = [...document.querySelectorAll(SELETOR_RASTREIO)]
    if (!alvos.length) return
    if (!RASTREIO.frota || Date.now() - RASTREIO.quando >= RASTREIO_VALIDADE) {
        if (!RASTREIO.carregando) frotaRastreio().then(marcarRastreio).catch(() => { })
        if (!RASTREIO.frota) return
    }
    for (const el of alvos) {
        el.dataset.rastreioOk = 'S'
        const v = veiculoDoElementoRastreio(el)
        if (v) el.insertAdjacentHTML('afterend', iconeRastreio(v, el.dataset.rastreioDe, el.dataset.rastreioAte))
        // data-rastreio-sem="cinza": sem carro com rastreador, mostra o carrinho apagado em vez de nada.
        else if (el.dataset.rastreioSem === 'cinza') el.insertAdjacentHTML('afterend',
            `<span class="rastreio-icone sem-rastreador" title="Sem rastreador neste carro">${SVG_CARRO_RASTREIO}</span>`)
    }
}

// Cores dos ícones já na tela acompanham a posição (a cada 30 s, só se houver algum).
async function atualizarIconesRastreio() {
    const icones = document.querySelectorAll('.rastreio-icone[data-rastreio-veiculo]')
    if (!icones.length || !podeRastreio()) return
    try { await frotaRastreio() } catch { return }
    for (const icone of icones) {
        const v = RASTREIO.frota.find(x => x.id === icone.dataset.rastreioVeiculo)
        if (!v) continue
        const { classe, texto } = situacaoRastreio(v)
        icone.classList.remove('movimento', 'ligado', 'parado', 'sem-sinal')
        icone.classList.add(classe)
        icone.title = `Rastreio ${v.placa}: ${texto}`
    }
}

new MutationObserver(() => {
    if (agendadoRastreio) return
    agendadoRastreio = true
    requestAnimationFrame(marcarRastreio)
}).observe(document.body, { childList: true, subtree: true })
setInterval(atualizarIconesRastreio, RASTREIO_ATUALIZAR)

// ---------- mapa (Leaflet + OpenStreetMap, gratuito) ----------

let leafletRastreio = null
function carregarLeaflet() {
    if (window.L?.map) return Promise.resolve()
    leafletRastreio ??= new Promise((ok, falha) => {
        const css = document.createElement('link')
        css.rel = 'stylesheet'
        css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        document.head.appendChild(css)
        const js = document.createElement('script')
        js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
        js.onload = ok
        js.onerror = () => { leafletRastreio = null; falha(new Error('Não foi possível carregar o mapa. Verifique a internet.')) }
        document.head.appendChild(js)
    })
    return leafletRastreio
}

function criarMapaRastreio(elemento) {
    const mapa = L.map(elemento, { zoomControl: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    }).addTo(mapa)
    mapa.setView([-14.2, -51.9], 4) // Brasil
    return mapa
}

function marcadorCarroRastreio(v, { rotulo = true } = {}) {
    const { classe } = situacaoRastreio(v)
    const seta = v.em_movimento ? `<i class="rastreio-seta" style="transform: rotate(${Number(v.direcao) || 0}deg)"></i>` : ''
    return L.marker([v.lat, v.lng], {
        icon: L.divIcon({
            className: 'rastreio-marcador-caixa',
            html: `<div class="rastreio-marcador ${classe}">${seta}${SVG_CARRO_RASTREIO}</div>
                ${rotulo ? `<span class="rastreio-marcador-placa">${escaparAtributo(v.placa)}</span>` : ''}`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    })
}

// ---------- popup de um carro: Agora | Histórico ----------

const hojeRastreio = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

function diasDoPeriodoRastreio(de, ate) {
    if (!de) return []
    const dias = []
    const fim = new Date(`${ate || de}T12:00:00Z`)
    for (let d = new Date(`${de}T12:00:00Z`); d <= fim && dias.length < 31; d = new Date(d.getTime() + 86400000))
        dias.push(d.toISOString().slice(0, 10))
    return dias
}

async function abrirRastreio(idVeiculo, { de = null, ate = null } = {}) {
    if (!podeRastreio()) return popup({ mensagem: 'Você não tem acesso ao rastreamento dos veículos.' })
    overlayAguarde()
    try {
        await Promise.all([carregarLeaflet(), frotaRastreio()])
    } catch (erro) {
        removerOverlay()
        return popup({ mensagem: erro.message })
    }
    const v = RASTREIO.frota.find(x => x.id === idVeiculo)
    if (!v) {
        removerOverlay()
        return popup({ mensagem: 'Este carro não tem rastreamento com dados em 2026.' })
    }

    const chave = `r${crypto.randomUUID().slice(0, 8)}`
    const dias = diasDoPeriodoRastreio(de, ate)
    const estado = { chave, id: v.id, aba: de ? 'historico' : 'agora', dia: dias[0] || hojeRastreio(), dias, mapa: null, camada: null }
    RASTREIO.janelas.set(chave, estado)

    popup({
        titulo: `Rastreio · ${escaparAtributo(nomeCarroRastreio(v))}`,
        elemento: `
            <div class="rastreio" id="${chave}">
                <div class="rastreio-topo">
                    <div class="rastreio-abas">
                        <button type="button" data-aba="agora" onclick="abaRastreio('${chave}', 'agora')">Agora</button>
                        <button type="button" data-aba="historico" onclick="abaRastreio('${chave}', 'historico')">Histórico</button>
                    </div>
                    <span class="rastreio-carro">${escaparAtributo([v.modelo_gcs || v.modelo, v.regiao].filter(Boolean).join(' · '))}</span>
                </div>
                <div class="rastreio-corpo">
                    <div class="rastreio-lado"></div>
                    <div class="rastreio-mapa"></div>
                </div>
            </div>`
    })

    const raiz = document.getElementById(chave)
    estado.mapa = criarMapaRastreio(raiz.querySelector('.rastreio-mapa'))
    abaRastreio(chave, estado.aba)

    // Enquanto o popup estiver aberto, a aba Agora acompanha a posição.
    estado.relogio = setInterval(async () => {
        if (!document.getElementById(chave)) {
            clearInterval(estado.relogio)
            return RASTREIO.janelas.delete(chave)
        }
        if (estado.aba !== 'agora') return
        try { await frotaRastreio() } catch { return }
        desenharAgoraRastreio(estado, { centralizar: false })
    }, RASTREIO_ATUALIZAR)
}

function abaRastreio(chave, aba) {
    const estado = RASTREIO.janelas.get(chave)
    const raiz = document.getElementById(chave)
    if (!estado || !raiz) return
    estado.aba = aba
    raiz.querySelectorAll('.rastreio-abas button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === aba))
    if (aba === 'agora') desenharAgoraRastreio(estado)
    else carregarDiaRastreio(chave, estado.dia)
}

function limparCamadaRastreio(estado) {
    if (estado.camada) estado.mapa.removeLayer(estado.camada)
    estado.camada = L.featureGroup().addTo(estado.mapa)
    return estado.camada
}

function desenharAgoraRastreio(estado, { centralizar = true } = {}) {
    const raiz = document.getElementById(estado.chave)
    const v = RASTREIO.frota.find(x => x.id === estado.id)
    if (!raiz || !v) return
    const { classe, texto } = situacaoRastreio(v)
    const linha = (rotulo, valor) => valor ? `<div class="rastreio-linha"><b>${rotulo}</b><span>${valor}</span></div>` : ''

    raiz.querySelector('.rastreio-lado').innerHTML = `
        <div class="rastreio-situacao ${classe}">${escaparAtributo(texto)}</div>
        ${linha('Motorista', escaparAtributo(v.motoristas_nomes || v.motorista || ''))}
        ${linha('Placa', escaparAtributo(v.placa))}
        ${linha('Última posição', `${dataHoraRastreio(v.posicao_data)} <small>${desdeRastreio(v.posicao_data)}</small>`)}
        ${linha('Velocidade', `${v.velocidade || 0} km/h`)}
        ${linha('Ignição', v.ignicao ? 'Ligada' : 'Desligada')}
        ${linha('Hodômetro', kmRastreio(v.hodometro))}
        ${linha('Bateria', v.bateria ? `${Number(v.bateria).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} V` : '')}
        ${v.lat ? `<a class="rastreio-link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${v.lat},${v.lng}">Abrir no Google Maps</a>` : ''}
        <small class="rastreio-rodape">Atualiza sozinho a cada 30 s.</small>`

    estado.mapa.invalidateSize()
    const camada = limparCamadaRastreio(estado)
    if (!v.lat) return
    marcadorCarroRastreio(v, { rotulo: false }).addTo(camada)
    if (centralizar) estado.mapa.setView([v.lat, v.lng], 15)
    else if (!estado.mapa.getBounds().contains([v.lat, v.lng])) estado.mapa.panTo([v.lat, v.lng])
}

function mudarDiaRastreio(chave, passo) {
    const estado = RASTREIO.janelas.get(chave)
    if (!estado) return
    const d = new Date(`${estado.dia}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + passo)
    carregarDiaRastreio(chave, d.toISOString().slice(0, 10))
}

async function carregarDiaRastreio(chave, dia) {
    const estado = RASTREIO.janelas.get(chave)
    const raiz = document.getElementById(chave)
    if (!estado || !raiz || !/^\d{4}-\d{2}-\d{2}$/.test(dia || '')) return
    estado.dia = dia
    const lado = raiz.querySelector('.rastreio-lado')
    const atalhos = estado.dias.length > 1
        ? `<div class="rastreio-dias">${estado.dias.map(d => `<button type="button" class="${d === dia ? 'ativo' : ''}"
            onclick="carregarDiaRastreio('${chave}', '${d}')">${d.slice(8)}/${d.slice(5, 7)}</button>`).join('')}</div>`
        : ''
    lado.innerHTML = `
        <div class="rastreio-data">
            <button type="button" onclick="mudarDiaRastreio('${chave}', -1)" title="Dia anterior">◀</button>
            <input type="date" value="${dia}" max="${hojeRastreio()}" min="2026-01-01" onchange="carregarDiaRastreio('${chave}', this.value)">
            <button type="button" onclick="mudarDiaRastreio('${chave}', 1)" title="Próximo dia">▶</button>
        </div>
        ${atalhos}
        <div class="rastreio-resumo"><img src="gifs/loading-gcs.png" class="rastreio-carregando" alt="Carregando"></div>`
    estado.mapa.invalidateSize()
    limparCamadaRastreio(estado)

    let dados
    try {
        dados = await apiRastreio('dia', { veiculo: estado.id, data: dia })
    } catch (erro) {
        lado.querySelector('.rastreio-resumo').innerHTML = `<p class="rastreio-vazio">${escaparAtributo(erro.message)}</p>`
        return
    }
    // Trocou de dia ou de aba enquanto buscava.
    if (estado.dia !== dia || estado.aba !== 'historico' || !document.getElementById(chave)) return
    estado.historico = dados
    desenharDiaRastreio(estado)
}

function desenharDiaRastreio(estado) {
    const raiz = document.getElementById(estado.chave)
    const { percursos = [], pontos = [], ofensas = [], copiado_ate = {} } = estado.historico || {}
    const resumo = raiz.querySelector('.rastreio-resumo')
    const camada = limparCamadaRastreio(estado)

    const fimDoDia = new Date(`${estado.dia}T00:00:00-03:00`).getTime() + 86400000
    const copiadoAte = copiado_ate.posicoes ? new Date(copiado_ate.posicoes).getTime() : 0
    const aviso = copiadoAte < fimDoDia && copiadoAte < Date.now() - 20 * 60000
        ? `<p class="rastreio-aviso">O backup deste carro ainda está sendo copiado da Mobi7 (até ${dataHoraRastreio(copiado_ate.posicoes) || 'o início'}). Volte mais tarde para ver o dia completo.</p>`
        : ''

    if (!percursos.length && !pontos.length) {
        resumo.innerHTML = `${aviso}<p class="rastreio-vazio">Nenhum deslocamento registrado neste dia.</p>`
        return
    }

    const km = percursos.reduce((s, p) => s + (p.distancia_km || 0), 0)
    const tempo = percursos.reduce((s, p) => s + (p.duracao_s || 0), 0)
    const max = Math.max(0, ...percursos.map(p => p.velocidade_max || 0))
    const excessos = ofensas.filter(o => o.tipo === 'exceeded_speed').length

    // Trajeto do dia: linha azul; viagem escolhida fica destacada por cima.
    const caminho = pontos.map(p => [p.lat, p.lng])
    if (caminho.length > 1) L.polyline(caminho, { color: '#1c7ed6', weight: 4, opacity: 0.75 }).addTo(camada)
    percursos.forEach((p, i) => {
        if (p.inicio_lat) L.circleMarker([p.inicio_lat, p.inicio_lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#2f9e44', fillOpacity: 1 })
            .bindTooltip(`Saída ${i + 1}: ${horaRastreio(p.inicio)}`).addTo(camada)
        if (p.fim_lat) L.circleMarker([p.fim_lat, p.fim_lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#c92a2a', fillOpacity: 1 })
            .bindTooltip(`Chegada ${i + 1}: ${horaRastreio(p.fim)}`).addTo(camada)
    })
    ofensas.forEach(o => {
        if (o.lat) L.circleMarker([o.lat, o.lng], { radius: 4, color: '#f08c00', weight: 1, fillColor: '#ffd43b', fillOpacity: 0.9 })
            .bindTooltip(`${nomeOfensaRastreio(o.tipo)} · ${o.velocidade ?? '—'} km/h · ${horaRastreio(o.data)}`).addTo(camada)
    })
    if (camada.getLayers().length) estado.mapa.fitBounds(camada.getBounds(), { padding: [30, 30], maxZoom: 16 })

    const viagens = percursos.map((p, i) => `
        <button type="button" class="rastreio-viagem" onclick="focarViagemRastreio('${estado.chave}', ${i})">
            <b>${horaRastreio(p.inicio)} → ${horaRastreio(p.fim)}</b>
            <span>${kmRastreio(p.distancia_km)} · ${duracaoRastreio(p.duracao_s)} · máx ${p.velocidade_max ?? '—'} km/h</span>
        </button>`).join('')

    const contagemOfensas = Object.entries(ofensas.reduce((m, o) => ({ ...m, [o.tipo]: (m[o.tipo] || 0) + 1 }), {}))
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `<li class="${t === 'exceeded_speed' ? 'excesso' : ''}">${escaparAtributo(nomeOfensaRastreio(t))} <b>${n}</b></li>`).join('')

    resumo.innerHTML = `
        ${aviso}
        <div class="rastreio-numeros">
            <div><b>${percursos.length}</b><span>viagens</span></div>
            <div><b>${kmRastreio(km)}</b><span>rodados</span></div>
            <div><b>${duracaoRastreio(tempo)}</b><span>dirigindo</span></div>
            <div class="${max > 110 ? 'alerta' : ''}"><b>${max} km/h</b><span>vel. máxima</span></div>
        </div>
        ${viagens ? `<h4>Viagens</h4><div class="rastreio-viagens">${viagens}</div>` : ''}
        ${ofensas.length ? `<details class="rastreio-ofensas" ${excessos ? 'open' : ''}><summary>Condução: ${ofensas.length} ocorrência(s)${excessos ? ` · <b>${excessos} excesso(s) de velocidade</b>` : ''}</summary><ul>${contagemOfensas}</ul></details>` : ''}`
}

function focarViagemRastreio(chave, i) {
    const estado = RASTREIO.janelas.get(chave)
    const p = estado?.historico?.percursos?.[i]
    if (!p) return
    const ini = new Date(p.inicio).getTime()
    const fim = new Date(p.fim || p.inicio).getTime()
    const trecho = (estado.historico.pontos || [])
        .filter(x => { const t = new Date(x.data).getTime(); return t >= ini && t <= fim })
        .map(x => [x.lat, x.lng])
    if (estado.destaque) estado.camada.removeLayer(estado.destaque)
    const linha = trecho.length > 1 ? trecho : [[p.inicio_lat, p.inicio_lng], [p.fim_lat, p.fim_lng]]
    estado.destaque = L.polyline(linha, { color: '#e8590c', weight: 6, opacity: 0.95 }).addTo(estado.camada)
    estado.mapa.fitBounds(estado.destaque.getBounds(), { padding: [40, 40], maxZoom: 17 })
    document.getElementById(chave)?.querySelectorAll('.rastreio-viagem').forEach((b, j) => b.classList.toggle('ativo', j === i))
}

// ---------- tela da frota (menu Veículos → Rastreamento) ----------

async function telaRastreioFrota() {
    if (!podeRastreio()) return popup({ mensagem: 'Você não tem acesso ao rastreamento dos veículos.' })
    overlayAguarde()
    try {
        await Promise.all([carregarLeaflet(), frotaRastreio({ forcar: true })])
    } catch (erro) {
        removerOverlay()
        return popup({ mensagem: erro.message })
    }

    const chave = `f${crypto.randomUUID().slice(0, 8)}`
    const estado = { chave, mapa: null, camada: null, marcadores: new Map(), semSinal: false, primeira: true }
    RASTREIO.janelas.set(chave, estado)

    popup({
        titulo: 'Rastreamento da frota (Mobi7)',
        elemento: `
            <div class="rastreio rastreio-frota" id="${chave}">
                <div class="rastreio-topo">
                    <div class="rastreio-legenda">
                        <span><i class="movimento"></i>Em movimento</span>
                        <span><i class="ligado"></i>Ligado, parado</span>
                        <span><i class="parado"></i>Desligado</span>
                        <span><i class="sem-sinal"></i>Sem sinal há mais de 1 dia</span>
                    </div>
                    <label class="rastreio-filtro"><input type="checkbox" onchange="filtroFrotaRastreio('${chave}', this.checked)"> Mostrar sem sinal</label>
                </div>
                <div class="rastreio-corpo">
                    <div class="rastreio-lado rastreio-lista"></div>
                    <div class="rastreio-mapa"></div>
                </div>
            </div>`
    })

    estado.mapa = criarMapaRastreio(document.querySelector(`#${chave} .rastreio-mapa`))
    desenharFrotaRastreio(estado)

    estado.relogio = setInterval(async () => {
        if (!document.getElementById(chave)) {
            clearInterval(estado.relogio)
            return RASTREIO.janelas.delete(chave)
        }
        try { await frotaRastreio() } catch { return }
        desenharFrotaRastreio(estado)
    }, RASTREIO_ATUALIZAR)
}

function filtroFrotaRastreio(chave, semSinal) {
    const estado = RASTREIO.janelas.get(chave)
    if (!estado) return
    estado.semSinal = semSinal
    estado.primeira = true
    desenharFrotaRastreio(estado)
}

function desenharFrotaRastreio(estado) {
    const raiz = document.getElementById(estado.chave)
    if (!raiz) return
    const carros = RASTREIO.frota.filter(v => estado.semSinal || v.transmitindo)
    const camada = limparCamadaRastreio(estado)
    estado.marcadores = new Map()

    for (const v of carros) {
        if (!v.lat) continue
        const m = marcadorCarroRastreio(v)
            .bindTooltip(`${escaparAtributo(nomeCarroRastreio(v))}<br>${escaparAtributo(situacaoRastreio(v).texto)}`)
            .on('click', () => abrirRastreio(v.id))
            .addTo(camada)
        estado.marcadores.set(v.id, m)
    }
    if (estado.primeira && camada.getLayers().length) {
        estado.mapa.invalidateSize()
        estado.mapa.fitBounds(camada.getBounds(), { padding: [40, 40], maxZoom: 13 })
        estado.primeira = false
    }

    const andando = carros.filter(v => v.em_movimento).length
    raiz.querySelector('.rastreio-lista').innerHTML = `
        <div class="rastreio-contagem"><b>${andando}</b> em movimento de <b>${carros.length}</b> carro(s)</div>
        ${carros.map(v => {
            const { classe, texto } = situacaoRastreio(v)
            return `
            <div class="rastreio-item">
                <button type="button" class="rastreio-item-principal" onclick="focarCarroFrotaRastreio('${estado.chave}', '${escaparAtributo(v.id)}')">
                    <i class="rastreio-bolinha ${classe}"></i>
                    <span>
                        <b>${escaparAtributo(v.placa)}</b>
                        <em class="rastreio-item-nome" style="font-style:normal" title="${escaparAtributo(v.motoristas_nomes || v.motorista || v.apelido || '')}">${escaparAtributo(v.motoristas_nomes || v.motorista || v.apelido || '—')}</em>
                        <small>${escaparAtributo(texto)}${v.regiao ? ` · ${escaparAtributo(v.regiao)}` : ''}</small>
                    </span>
                </button>
                <button type="button" class="rastreio-item-abrir" title="Abrir agora e histórico" onclick="abrirRastreio('${escaparAtributo(v.id)}')">Detalhes</button>
            </div>`
        }).join('') || '<p class="rastreio-vazio">Nenhum carro transmitindo.</p>'}
        <small class="rastreio-rodape">Atualizado ${horaRastreio(RASTREIO.quando)} · atualiza sozinho a cada 30 s.</small>`
}

function focarCarroFrotaRastreio(chave, id) {
    const estado = RASTREIO.janelas.get(chave)
    const m = estado?.marcadores.get(id)
    if (!m) return
    estado.mapa.setView(m.getLatLng(), 15)
    m.openTooltip()
}
