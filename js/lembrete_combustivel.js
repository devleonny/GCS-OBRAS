// LEMBRETE DO PRAZO DE COMBUSTÍVEL: das 15:00 às 15:30 (Brasília, pelo relógio do servidor) uma
// pistola de abastecimento desce pela mangueira na lateral direita da tela, balançando de leve, com
// o tempo que falta para solicitar combustível para o mesmo dia. Depois das 15:30 o lançamento para
// hoje fica bloqueado (js/veiculos.js e gcs/SCRIPTS/combustivel_prazo.js).
// Desce às 15:00, 15:10, 15:20 e 15:25 (e ao abrir o GCS dentro da janela) e fica até o usuário
// fechar no ×. Cada descida vale uma vez por dia para todas as
// abas; "Não lembrar mais hoje" esconde até o dia seguinte.

const LEMBRETE_COMBUSTIVEL = {
    inicio: '15:00',
    passagens: ['15:00', '15:10', '15:20', '15:25'],
    verificarMs: 20000,
    chaveFeitas: 'lembreteCombustivelPassagens',
    chaveOculto: 'lembreteCombustivelOculto',
    permissoes: ['analista'] // só quem recebe o lembrete; o bloqueio das 15:30 vale para todos
}

let temporizadorLembreteCombustivel = null
let relogioAvisoCombustivel = null

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
    if (!usuario?.usuario || !LEMBRETE_COMBUSTIVEL.permissoes.includes(usuario.permissao)) return
    if (document.hidden || document.querySelector('.lembrete-combustivel')) return

    await sincronizarRelogioServidor().catch(() => { })
    const { dia, hora, segundos } = segundosAtePrazoCombustivel()
    if (hora < LEMBRETE_COMBUSTIVEL.inicio || segundos <= 0) return
    if (lerLembreteCombustivel(LEMBRETE_COMBUSTIVEL.chaveOculto) === dia) return

    // Descida da vez: a última já alcançada no horário; cada uma uma vez por dia.
    const passagem = LEMBRETE_COMBUSTIVEL.passagens.filter(h => h <= hora).pop()
    const feitas = lerLembreteCombustivel(LEMBRETE_COMBUSTIVEL.chaveFeitas)
    const doDia = feitas?.dia === dia ? feitas.horas : []
    if (!passagem || doDia.includes(passagem)) return

    gravarLembreteCombustivel(LEMBRETE_COMBUSTIVEL.chaveFeitas, { dia, horas: [...doDia, passagem] })
    mostrarAvisoCombustivel()
}

function textoAvisoCombustivel() {
    const { segundos } = segundosAtePrazoCombustivel()
    if (segundos <= 0) return `<b>Prazo encerrado.</b><span>Combustível agora só a partir de amanhã.</span>`
    const minutos = Math.ceil(segundos / 60)
    return `<b>Faltam ${minutos} min</b><span>para solicitar combustível para hoje (até ${HORA_LIMITE_COMBUSTIVEL}).</span>`
}

// Pistola de abastecimento no formato das de posto (cabo longo em cima, corpo facetado, proteção
// preta do gatilho, mola e bico curvo de aço), pendurada pela mangueira presa atrás do cabo.
// Desenhada de lado e girada -67° em volta do giratório (516, 95), que cai em (135, 10): assim ela fica
// na vertical, com o peso logo abaixo da mangueira. O CSS alinha a mangueira da tela em x = 135 (de 400).
function svgPistolaCombustivel() {
    return `
        <svg class="lembrete-combustivel-pistola" viewBox="0 0 400 650" aria-hidden="true">
            <defs>
                <linearGradient id="lcAco" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="180" y2="0">
                    <stop offset="0" stop-color="#6b7280"/>
                    <stop offset="0.45" stop-color="#f1f5f9"/>
                    <stop offset="1" stop-color="#4b5563"/>
                </linearGradient>
            </defs>
            <path d="M135 0 V14" stroke="#1e293b" stroke-width="30"/>
            <g transform="translate(135 10) rotate(-67) translate(-516 -95)">
            <rect x="498" y="82" width="36" height="30" rx="6" fill="#475569" stroke="#1e293b" stroke-width="3"/>
            <path d="M155 312 C130 370 95 420 62 552" fill="none" stroke="#1f2937" stroke-width="40" stroke-linecap="round"/>
            <path d="M155 312 C130 370 95 420 62 552" fill="none" stroke="url(#lcAco)" stroke-width="32" stroke-linecap="round"/>
            ${[[150, 326], [143, 343], [135, 360], [127, 377], [120, 394]].map(([x, y]) =>
                `<ellipse cx="${x}" cy="${y}" rx="25" ry="7" transform="rotate(24 ${x} ${y})" fill="none" stroke="#e5e7eb" stroke-width="6"/>
                <ellipse cx="${x}" cy="${y}" rx="25" ry="7" transform="rotate(24 ${x} ${y})" fill="none" stroke="#6b7280" stroke-width="2"/>`).join('')}
            <path d="M138 280 L188 300 L177 330 L127 310 Z" fill="#6b7280" stroke="#1f2937" stroke-width="3"/>
            <path fill-rule="evenodd" fill="#1c1c1c"
                d="M340 150 L506 112 L540 196 Q546 214 528 220 L382 256 Q352 262 350 236 Z M376 176 L482 152 L506 204 L384 228 Z"/>
            <path d="M392 222 L478 196" stroke="#cbd5e1" stroke-width="7" stroke-linecap="round"/>
            <circle cx="497" cy="126" r="6" fill="#9ca3af"/>
            <path d="M292 112 L470 66 Q508 58 514 92 L518 116 Q522 142 496 148 L335 188 Z" fill="#d7261e" stroke="#7f1d1d" stroke-width="3"/>
            <path d="M300 118 L470 76 Q498 70 503 90 L304 140 Z" fill="#ef4a3f" opacity="0.6"/>
            <path d="M240 92 Q262 88 292 104 L336 186 L350 262 Q354 292 324 300 L210 312 Q180 314 166 292 L122 222 Q108 192 124 160 L156 128 Z"
                fill="#d7261e" stroke="#7f1d1d" stroke-width="3"/>
            <path d="M240 96 L290 108 L332 186 L250 200 L188 150 Z" fill="#ef4a3f" opacity="0.55"/>
            <path d="M170 290 L210 308 L322 296 L302 250 L182 258 Z" fill="#a8151a" opacity="0.45"/>
            <text x="228" y="212" font-family="Arial" font-weight="bold" font-size="40" fill="#a8151a" opacity="0.75"
                text-anchor="middle" transform="rotate(67 228 212)">GCS</text>
            </g>
            <path class="lembrete-combustivel-gota" d="M382 618 Q370 634 382 646 Q394 634 382 618 Z" fill="#f59e0b"/>
        </svg>`
}

function mostrarAvisoCombustivel() {
    document.querySelector('.lembrete-combustivel')?.remove()

    const el = document.createElement('div')
    el.className = 'lembrete-combustivel'
    el.setAttribute('role', 'status')
    el.innerHTML = `
        <div class="lembrete-combustivel-pendulo">
            <span class="lembrete-combustivel-mangueira" aria-hidden="true"></span>
            <div class="lembrete-combustivel-cabeca">
                <div class="lembrete-combustivel-aviso">
                    <button type="button" class="lembrete-combustivel-fechar" onclick="recolherAvisoCombustivel()"
                        title="Fechar" aria-label="Fechar aviso">×</button>
                    <span class="lembrete-combustivel-texto">${textoAvisoCombustivel()}</span>
                    <button type="button" class="lembrete-combustivel-solicitar" onclick="solicitarPeloLembreteCombustivel()">Solicitar combustível</button>
                    <button type="button" class="lembrete-combustivel-hoje" onclick="ocultarLembreteCombustivelHoje()">Não lembrar mais hoje</button>
                </div>
                ${svgPistolaCombustivel()}
            </div>
        </div>`
    document.body.appendChild(el)

    const texto = el.querySelector('.lembrete-combustivel-texto')
    clearInterval(relogioAvisoCombustivel)
    relogioAvisoCombustivel = setInterval(() => {
        if (!el.isConnected) return clearInterval(relogioAvisoCombustivel)
        texto.innerHTML = textoAvisoCombustivel()
    }, 1000)

    // Fica até o usuário fechar. Às 15:30 o texto vira "Prazo encerrado" e ela continua até ser fechada.
}

// Sobe pela mangueira e some (× do aviso). A próxima descida do dia volta normalmente.
function recolherAvisoCombustivel() {
    const el = document.querySelector('.lembrete-combustivel')
    if (!el) return
    el.classList.add('subindo')
    setTimeout(fecharLembreteCombustivel, 700)
}

function fecharLembreteCombustivel() {
    clearInterval(relogioAvisoCombustivel)
    document.querySelector('.lembrete-combustivel')?.remove()
}

function ocultarLembreteCombustivelHoje() {
    gravarLembreteCombustivel(LEMBRETE_COMBUSTIVEL.chaveOculto, segundosAtePrazoCombustivel().dia)
    recolherAvisoCombustivel()
}

function solicitarPeloLembreteCombustivel() {
    fecharLembreteCombustivel()
    painelValores()
}

// Para testar fora do horário: no console, mostrarAvisoCombustivel()
