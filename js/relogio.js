// Referência do servidor + tempo monotônico: alterações no relógio do PC não afetam o avanço.
let referenciaRelogioServidor = null
let consultaRelogioServidor = null

function agoraServidor() {
    if (!referenciaRelogioServidor) throw new Error('Aguarde a sincronização do horário do servidor.')
    return Math.floor(referenciaRelogioServidor.epoch + performance.now() - referenciaRelogioServidor.monotono)
}

function dataServidor() {
    return new Date(agoraServidor())
}

async function sincronizarRelogioServidor(forcar = false) {
    if (consultaRelogioServidor) return consultaRelogioServidor
    // Uma sincronização a cada cinco minutos, somente quando solicitada pelo uso da aplicação.
    if (!forcar && referenciaRelogioServidor && performance.now() - referenciaRelogioServidor.monotono < 300000) return
    consultaRelogioServidor = (async () => {
        const inicio = performance.now()
        const resposta = await fetch(`${api}/horario`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        if (!resposta.ok) throw new Error('Não foi possível sincronizar o horário do servidor.')
        const { epoch } = await resposta.json()
        if (typeof epoch !== 'number' || !Number.isFinite(epoch)) throw new Error('Horário inválido recebido do servidor.')
        const fim = performance.now()
        referenciaRelogioServidor = { epoch: epoch + (fim - inicio) / 2, monotono: fim }
    })()
    try {
        await consultaRelogioServidor
    } finally {
        consultaRelogioServidor = null
    }
}
