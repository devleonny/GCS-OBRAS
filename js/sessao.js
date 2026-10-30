// Sessão com dois tokens: o de acesso (1h) vai em toda requisição; o de renovação
// (30 dias, trocado a cada uso) busca um novo acesso antes de o atual vencer.
// Assim quem está usando o sistema não precisa entrar de novo todo dia.
const MARGEM_RENOVACAO_MS = 10 * 60 * 1000
let renovacaoSessaoEmAndamento = null

function expiracaoToken(token) {
    try {
        const base64 = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        return (JSON.parse(atob(base64)).exp || 0) * 1000
    } catch {
        return 0
    }
}

// Resultados: 'valido' | 'renovado' | 'sem-renovacao' (login antigo) | 'expirada' | 'sem-rede' | 'erro'
// tokenRecusado: token que levou 401; se outra chamada/aba já trocou por um válido, não renova de novo.
function renovarSessao({ forcar = false, tokenRecusado = null } = {}) {
    renovacaoSessaoEmAndamento ??= (async () => {
        const executar = async () => {
            // Relê dentro da trava: outra aba pode ter acabado de renovar.
            const atual = JSON.parse(localStorage.getItem('acesso') || 'null')
            if (!atual?.refreshToken)
                return 'sem-renovacao'

            const restante = expiracaoToken(atual.token) - Date.now()

            if (tokenRecusado && atual.token !== tokenRecusado && restante > 0)
                return 'renovado'

            if (!forcar && restante > MARGEM_RENOVACAO_MS)
                return 'valido'

            let resposta
            try {
                // credentials: a resposta também renova o cookie dos arquivos (/uploads exige login).
                resposta = await fetch(`${api}/renovar-token`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: atual.refreshToken })
                })
            } catch {
                return 'sem-rede'
            }

            if (resposta.status === 401)
                return 'expirada'

            if (!resposta.ok)
                return 'erro'

            const dados = await resposta.json()
            const maisRecente = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
            const novoAcesso = { ...maisRecente, ...dados }
            localStorage.setItem('acesso', JSON.stringify(novoAcesso))
            acesso = novoAcesso
            return 'renovado'
        }

        // Web Locks: uma aba renova por vez (as outras leem o token novo do localStorage).
        return navigator.locks?.request
            ? navigator.locks.request('gcs-renovar-sessao', executar)
            : executar()
    })().finally(() => {
        renovacaoSessaoEmAndamento = null
    })

    return renovacaoSessaoEmAndamento
}

// Camada única sobre o fetch: toda chamada que leva "Authorization: Bearer" sai com token
// válido (renova antes se venceu, ex.: PC acordando) e, se mesmo assim vier 401, renova e
// repete uma vez. As telas não precisam tratar a expiração.
const fetchOriginalGCS = window.fetch.bind(window)

window.fetch = async function (entrada, opcoes = {}) {
    const cabecalhos = new Headers(opcoes?.headers || {})
    const autorizacao = cabecalhos.get('Authorization') || ''

    if ((typeof entrada !== 'string' && !(entrada instanceof URL)) || !autorizacao.startsWith('Bearer '))
        return fetchOriginalGCS(entrada, opcoes)

    const tokenAtual = () => (JSON.parse(localStorage.getItem('acesso') || 'null') || {}).token
    const comTokenAtual = () => {
        const token = tokenAtual()
        if (token)
            cabecalhos.set('Authorization', `Bearer ${token}`)
        return { ...opcoes, headers: cabecalhos }
    }

    const antes = tokenAtual()
    if (antes && expiracaoToken(antes) - Date.now() < 60 * 1000)
        await renovarSessao().catch(() => {})

    const envio = comTokenAtual()
    const resposta = await fetchOriginalGCS(entrada, envio)

    if (resposta.status !== 401)
        return resposta

    const tokenRecusado = envio.headers.get('Authorization').slice('Bearer '.length)
    const renovacao = await renovarSessao({ forcar: true, tokenRecusado }).catch(() => 'erro')

    const tokenNovo = tokenAtual()
    const trocou = tokenNovo && tokenNovo !== tokenRecusado

    return renovacao === 'renovado' || trocou
        ? fetchOriginalGCS(entrada, comTokenAtual())
        : resposta
}

async function encerrarSessaoServidor() {
    const { refreshToken } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    if (!refreshToken)
        return

    try {
        await fetch(`${api}/sair`, {
            method: 'POST',
            credentials: 'include', // apaga o cookie dos arquivos
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        })
    } catch {
        // Sem rede: a sessão expira sozinha no servidor.
    }
}

setInterval(() => {
    if (localStorage.getItem('acesso'))
        renovarSessao().catch(err => console.error('Falha ao renovar a sessão:', err))
}, 5 * 60 * 1000)

// Quem já estava logado antes de /uploads exigir login ainda não tem o cookie dos arquivos:
// uma renovação forçada (uma vez por navegador) grava o cookie sem precisar entrar de novo.
try {
    if (localStorage.getItem('acesso') && localStorage.getItem('cookieArquivosGCS') !== '1')
        renovarSessao({ forcar: true })
            .then(resultado => { if (resultado === 'renovado') localStorage.setItem('cookieArquivosGCS', '1') })
            .catch(() => {})
} catch { }

// PC acordou ou a aba voltou: o token pode ter vencido enquanto os timers estavam parados.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && localStorage.getItem('acesso'))
        renovarSessao().catch(err => console.error('Falha ao renovar a sessão:', err))
})
