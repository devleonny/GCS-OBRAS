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

// Imagem de /uploads que falhou: quase sempre o cookie dos arquivos ainda não estava gravado
// (tela desenhada antes da renovação acima terminar, ou cookie vencido com o PC parado).
// Renova a sessão, que grava o cookie, e recarrega as imagens que falharam (uma vez cada).
// Renovação forçada no máximo a cada minuto: arquivo apagado de verdade também cai aqui.
// Fora de *.gcs.app.br (ex.: Live Server em localhost) o navegador não manda o cookie nas imagens
// (SameSite=Lax entre sites diferentes): a imagem é baixada com o token no cabeçalho, que o
// servidor também aceita, e exibida da memória. Em produção não passa por aqui.
const FORA_DO_DOMINIO_GCS = !/(^|\.)gcs\.app\.br$/.test(location.hostname)
const imagensComToken = new Map()

async function carregarImagemComToken(img, src) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    if (!token) return

    if (!imagensComToken.has(src))
        imagensComToken.set(src, fetch(src, { headers: { Authorization: `Bearer ${token}` } })
            .then(resposta => resposta.ok ? resposta.blob() : null)
            .then(blob => blob && URL.createObjectURL(blob))
            .catch(() => null))

    const local = await imagensComToken.get(src)
    if (!local) return imagensComToken.delete(src)
    // Mesmo endereço, ou trocado pelo logo no onerror da tela: mostra a imagem verdadeira.
    if (img.src === src || !img.src.includes('/uploads/')) img.src = local
}

const imagensArquivosFalhas = []
let recargaArquivosAgendada = null
let ultimaRenovacaoArquivos = 0

document.addEventListener('error', evento => {
    const img = evento.target
    if (!(img instanceof HTMLImageElement) || img.dataset.arquivoRecarregado || typeof api === 'undefined')
        return

    let url
    try { url = new URL(img.src) } catch { return }
    if (url.origin !== new URL(api).origin || !url.pathname.startsWith('/uploads/'))
        return

    img.dataset.arquivoRecarregado = 'sim'

    if (FORA_DO_DOMINIO_GCS)
        return carregarImagemComToken(img, img.src)

    imagensArquivosFalhas.push({ img, src: img.src })

    recargaArquivosAgendada ??= (async () => {
        if (Date.now() - ultimaRenovacaoArquivos > 60 * 1000) {
            ultimaRenovacaoArquivos = Date.now()
            const resultado = await renovarSessao({ forcar: true }).catch(() => 'erro')
            if (resultado === 'renovado') localStorage.setItem('cookieArquivosGCS', '1')
        }
        // Só recarrega quem ainda mostra o mesmo endereço (onerror pode ter trocado pelo logo).
        for (const { img, src } of imagensArquivosFalhas.splice(0))
            if (img.src === src) img.src = `${src}${src.includes('?') ? '&' : '?'}r=${Date.now()}`
    })().finally(() => { recargaArquivosAgendada = null })
}, true)

// PC acordou ou a aba voltou: o token pode ter vencido enquanto os timers estavam parados.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && localStorage.getItem('acesso'))
        renovarSessao().catch(err => console.error('Falha ao renovar a sessão:', err))
})
