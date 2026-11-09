// LEMBRETE DO PRAZO DE COMBUSTÍVEL: das 15:00 às 15:30 (Brasília, pelo relógio do servidor) a van
// do GCS (a mesma do joguinho, js/jogo.js) atravessa o rodapé puxando uma faixa com o tempo que
// falta para solicitar combustível para o mesmo dia. Depois das 15:30 o lançamento para hoje fica
// bloqueado (js/veiculos.js e gcs/SCRIPTS/combustivel_prazo.js).
// Passa às 15:00, 15:10, 15:20 e 15:25 (e ao abrir o GCS dentro da janela). Cada passagem vale uma
// vez por dia para todas as abas; "não mostrar hoje" esconde até o dia seguinte.

const LEMBRETE_COMBUSTIVEL = {
    inicio: '15:00',
    passagens: ['15:00', '15:10', '15:20', '15:25'],
    verificarMs: 20000,
    chaveFeitas: 'lembreteCombustivelPassagens',
    chaveOculto: 'lembreteCombustivelOculto',
    bloqueio: ['cliente', 'técnico'] // mesmo bloqueio do menu de Combustíveis
}

let temporizadorLembreteCombustivel = null
let relogioFaixaCombustivel = null

function iniciarLembreteCombustivel() {
    if (temporizadorLembreteCombustivel) return
    temporizadorLembreteCombustivel = setInterval(verificarLembreteCombustivel, LEMBRETE_COMBUSTIVEL.verificarMs)
    verificarLembreteCombustivel()
}

function lerLembreteCombustivel(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || 'null') } catch { return null }
}

function gravarLembreteCombustivel(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)) } catch { }
}

// Segundos que faltam até 15:30 de hoje (negativo depois do prazo).
function segundosAtePrazoCombustivel() {
    let agora
    try { agora = dataServidor() } catch { agora = new Date() }
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(agora).map(x => [x.type, x.value]))
    const [hl, ml] = HORA_LIMITE_COMBUSTIVEL.split(':').map(Number)
    return {
        dia: `${p.year}-${p.month}-${p.day}`,
        hora: `${p.hour}:${p.minute}`,
        segundos: (hl * 3600 + ml * 60) - (Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second))
    }
}

async function verificarLembreteCombustivel() {
    const usuario = JSON.parse(localStorage.getItem('acesso') || 'null')
    if (!usuario?.usuario || LEMBRETE_COMBUSTIVEL.bloqueio.includes(usuario.permissao)) return
    if (document.hidden || document.querySelector('.lembrete-combustivel')) return

    await sincronizarRelogioServidor().catch(() => { })
    const { dia, hora, segundos } = segundosAtePrazoCombustivel()
    if (hora < LEMBRETE_COMBUSTIVEL.inicio || segundos <= 0) return
    if (lerLembreteCombustivel(LEMBRETE_COMBUSTIVEL.chaveOculto) === dia) return

    // Passagem da vez: a última já alcançada no horário; cada uma uma vez por dia.
    const passagem = LEMBRETE_COMBUSTIVEL.passagens.filter(h => h <= hora).pop()
    const feitas = lerLembreteCombustivel(LEMBRETE_COMBUSTIVEL.chaveFeitas)
    const doDia = feitas?.dia === dia ? feitas.horas : []
    if (!passagem || doDia.includes(passagem)) return

    gravarLembreteCombustivel(LEMBRETE_COMBUSTIVEL.chaveFeitas, { dia, horas: [...doDia, passagem] })
    passarVanCombustivel()
}

function textoFaixaCombustivel() {
    const { segundos } = segundosAtePrazoCombustivel()
    if (segundos <= 0) return `Prazo encerrado: combustível agora só a partir de amanhã.`
    const minutos = Math.ceil(segundos / 60)
    return `Faltam <b>${minutos} min</b> para solicitar combustível para hoje (até ${HORA_LIMITE_COMBUSTIVEL})`
}

// Van do joguinho em SVG (mesmas medidas e cores de desenharVanRota, 58x30).
function svgVanCombustivel() {
    const roda = cx => `
        <g class="lembrete-combustivel-roda">
            <circle cx="${cx}" cy="25" r="6" fill="#1e293b"/>
            <circle cx="${cx}" cy="25" r="2.6" fill="#cbd5e1"/>
            <path d="M${cx} 25 l5 0 M${cx} 25 l-2.5 4.33 M${cx} 25 l-2.5 -4.33" stroke="#cbd5e1" stroke-width="1"/>
        </g>`
    return `
        <svg class="lembrete-combustivel-van" viewBox="-1 0 60 32" aria-hidden="true">
            <ellipse cx="29" cy="31" rx="27" ry="1.6" fill="rgba(15, 23, 42, 0.18)"/>
            <rect x="0" y="2" width="44" height="22" rx="4" fill="#fff" stroke="#1e293b" stroke-width="1.5"/>
            <path d="M44 8 L53 10 Q58 12 58 18 L58 24 L44 24 Z" fill="#fff" stroke="#1e293b" stroke-width="1.5"/>
            <path d="M46 11 L52 12 L55 17 L46 17 Z" fill="#7dd3fc"/>
            <rect x="1" y="13" width="43" height="5" fill="#2f7d4a"/>
            <text x="6" y="11" font-family="Arial" font-weight="bold" font-size="8" fill="#1e293b">GCS</text>
            <g transform="translate(32 8) rotate(45)" stroke="#15803d" stroke-linecap="round" fill="none">
                <path d="M0 -0.45 L0 3.8" stroke-width="1.8"/>
                <path d="M1.1 -3.5 A1.6 1.6 0 1 1 -1.1 -3.5" stroke-width="1.5"/>
            </g>
            <rect x="55" y="19" width="3" height="3" fill="#facc15"/>
            ${roda(11)}${roda(47)}
        </svg>`
}

function passarVanCombustivel() {
    document.querySelector('.lembrete-combustivel')?.remove()

    const el = document.createElement('div')
    el.className = 'lembrete-combustivel'
    el.setAttribute('role', 'status')
    el.innerHTML = `
        <div class="lembrete-combustivel-comboio">
            <div class="lembrete-combustivel-faixa">
                <span class="lembrete-combustivel-icone" aria-hidden="true">⛽</span>
                <span class="lembrete-combustivel-texto">${textoFaixaCombustivel()}</span>
                <button type="button" class="lembrete-combustivel-solicitar" onclick="solicitarPeloLembreteCombustivel()">Solicitar</button>
                <button type="button" class="lembrete-combustivel-fechar" onclick="ocultarLembreteCombustivelHoje()"
                    title="Não mostrar mais hoje" aria-label="Não mostrar mais hoje">×</button>
            </div>
            <span class="lembrete-combustivel-corda" aria-hidden="true"></span>
            ${svgVanCombustivel()}
        </div>`
    document.body.appendChild(el)

    const texto = el.querySelector('.lembrete-combustivel-texto')
    clearInterval(relogioFaixaCombustivel)
    relogioFaixaCombustivel = setInterval(() => {
        if (!el.isConnected) return clearInterval(relogioFaixaCombustivel)
        texto.innerHTML = textoFaixaCombustivel()
    }, 1000)

    el.querySelector('.lembrete-combustivel-comboio').addEventListener('animationend', fecharLembreteCombustivel)
}

function fecharLembreteCombustivel() {
    clearInterval(relogioFaixaCombustivel)
    document.querySelector('.lembrete-combustivel')?.remove()
}

function ocultarLembreteCombustivelHoje() {
    gravarLembreteCombustivel(LEMBRETE_COMBUSTIVEL.chaveOculto, segundosAtePrazoCombustivel().dia)
    fecharLembreteCombustivel()
}

function solicitarPeloLembreteCombustivel() {
    fecharLembreteCombustivel()
    painelValores()
}

// Para testar fora do horário: no console, passarVanCombustivel()
