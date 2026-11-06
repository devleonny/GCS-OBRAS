// Service worker do GCS (PWA): recebe as notificações (Web Push) e, no clique, leva à tela certa.
// O conteúdo vem do servidor (SCRIPTS/notificacoes.js): { titulo, corpo, acao, tag, ids }.
// Sem cache offline de propósito: o GCS sempre carrega a versão publicada.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', evento => evento.waitUntil(self.clients.claim()))

self.addEventListener('push', evento => {
    let dados = {}
    try { dados = evento.data ? evento.data.json() : {} }
    catch { dados = { corpo: evento.data ? evento.data.text() : '' } }

    evento.waitUntil(self.registration.showNotification(dados.titulo || 'GCS', {
        body: dados.corpo || '',
        icon: '/icons/icon-192.png',
        tag: dados.tag || undefined,
        renotify: !!dados.tag,
        lang: 'pt-BR',
        data: { acao: dados.acao || null, ids: dados.ids || [] }
    }))
})

self.addEventListener('notificationclick', evento => {
    evento.notification.close()
    const dados = evento.notification.data || {}

    evento.waitUntil((async () => {
        const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        const janela = janelas.find(j => new URL(j.url).origin === self.location.origin)

        // GCS já aberto: traz para frente e manda abrir a tela (js/notificacoes.js).
        if (janela) {
            await janela.focus()
            janela.postMessage({ tipo: 'gcs-notificacao', ...dados })
            return
        }

        // Fechado: abre com a ação na URL; o app executa depois do login.
        const url = new URL('/', self.location.origin)
        url.searchParams.set('notificacao', btoa(unescape(encodeURIComponent(JSON.stringify(dados)))))
        await self.clients.openWindow(url.href)
    })())
})
