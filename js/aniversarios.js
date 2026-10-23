// ANIVERSARIANTES
// - O aniversariante recebe o popup especial (foto, parabéns e próximos aniversários)
//   ao abrir a tela inicial, uma vez por aniversário em cada navegador.
// - Os demais veem o aviso "🎂 ..." na barra do topo, que abre o mesmo popup no clique.
// - Aniversário em fim de semana/feriado é comemorado no próximo dia útil ("parabéns atrasado").
// Ninguém com permissão cliente vê nada. Dados: vw_aniversariantes (gcs/SQL/aniversarios.sql),
// que já devolve só dia/mês, os próximos 30 dias e quem deve ser comemorado hoje.

const CHAVE_ANIVERSARIOS_VISTOS = 'aniversariosVistos'
// Índice = isodow (1 = segunda ... 7 = domingo).
const DIAS_SEMANA_ANIVERSARIO = ['', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado', 'no domingo']
let aniversariosDoDia = null   // { hoje: [...], proximos: [...] } da última consulta

// Marca pelo aniversário (data comemorada), não pelo dia: quem fez aniversário no sábado
// e abriu o sistema no sábado não recebe o popup de novo na segunda.
function aniversarioJaVisto(dataComemorada) {
    try { return localStorage.getItem(CHAVE_ANIVERSARIOS_VISTOS) === dataComemorada } catch { return false }
}

function marcarAniversarioVisto(dataComemorada) {
    try { localStorage.setItem(CHAVE_ANIVERSARIOS_VISTOS, dataComemorada) } catch { }
}

async function verificarAniversarios() {
    try {
        if (!acesso?.usuario || acesso.permissao === 'cliente') return atualizarAvisoAniversario()

        const { resultados } = await pesquisarDB({ base: 'vw_aniversariantes', limite: 500 }) || {}
        const sim = v => v === true || v === 'true'
        const lista = (resultados || [])
            .map(p => ({
                ...p,
                dias_ate: Number(p.dias_ate),
                dias_desde: Number(p.dias_desde) || 0,
                dia_semana_comemorado: Number(p.dia_semana_comemorado),
                comemorar: sim(p.comemorar)
            }))

        const hoje = lista.filter(p => p.comemorar)
            .sort((a, b) => a.dias_desde - b.dias_desde || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
        const proximos = lista.filter(p => !p.comemorar && p.dias_ate > 0)
            .sort((a, b) => a.dias_ate - b.dias_ate || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))

        aniversariosDoDia = { hoje, proximos }
        atualizarAvisoAniversario()

        // Popup automático só para quem está sendo comemorado.
        const meu = hoje.find(p => p.usuario === acesso.usuario)
        if (meu && !aniversarioJaVisto(meu.data_comemorada)) {
            marcarAniversarioVisto(meu.data_comemorada)
            abrirAniversariosHoje()
        }
    } catch (erro) {
        // Aniversário é um extra: falha aqui não pode atrapalhar a tela inicial.
        console.error('Aniversariantes:', erro)
    }
}

function abrirAniversariosHoje() {
    if (aniversariosDoDia?.hoje.length)
        popupAniversarios(aniversariosDoDia.hoje, aniversariosDoDia.proximos)
}

// Ao sair do sistema: o próximo usuário não herda o aviso de quem saiu.
function ocultarAvisoAniversario() {
    aniversariosDoDia = null
    const aviso = document.querySelector('.aniversario-aviso')
    if (aviso) aviso.hidden = true
}

// "ontem", "no sábado" ou "" (hoje).
function quandoFoiAniversario(p) {
    if (!p.dias_desde) return ''
    if (p.dias_desde === 1) return 'ontem'
    return DIAS_SEMANA_ANIVERSARIO[p.dia_semana_comemorado] || `há ${p.dias_desde} dias`
}

// Aviso na barra do topo: só aparece quando há alguém para comemorar.
function atualizarAvisoAniversario() {
    const aviso = document.querySelector('.aniversario-aviso')
    if (!aviso) return

    const hoje = acesso?.permissao === 'cliente' ? [] : aniversariosDoDia?.hoje || []
    aviso.hidden = hoje.length === 0
    if (!hoje.length) return

    const meu = hoje.find(p => p.usuario === acesso.usuario)
    const outros = hoje.filter(p => p.usuario !== acesso.usuario)
        .map(p => p.dias_desde ? `${nomeAniversario(p.nome)} (${quandoFoiAniversario(p).replace(/^(no|na) /, '')})` : nomeAniversario(p.nome))
    const nomes = outros.length > 2 ? `${outros.slice(0, 2).join(', ')} +${outros.length - 2}` : outros.join(' e ')
    const prefixo = hoje.every(p => !p.dias_desde) ? 'Hoje: ' : 'Aniversário: '
    const texto = meu
        ? `${meu.dias_desde ? 'Parabéns atrasado pra você!' : 'Hoje é o seu dia!'}${outros.length ? ` E de ${nomes}` : ''}`
        : `${prefixo}${nomes}`

    aviso.innerHTML = `<span class="aniversario-aviso-icone" aria-hidden="true">🎂</span><span>${escaparAtributo(texto)}</span>`
    aviso.title = 'Ver aniversariantes'
}

function nomeAniversario(nome) {
    const partes = String(nome || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
    const curto = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes
    return curto.map(p => p[0].toUpperCase() + p.slice(1)).join(' ') || 'Aniversariante'
}

function quandoAniversario(dias) {
    if (dias === 1) return 'amanhã'
    if (dias < 7) return `em ${dias} dias`
    if (dias < 14) return 'semana que vem'
    return `em ${dias} dias`
}

function mensagemAniversario(p) {
    const eu = p.usuario === acesso.usuario
    const nome = `<b>${escaparAtributo(nomeAniversario(p.nome))}</b>`
    const quando = quandoFoiAniversario(p)

    if (eu && !quando)
        return 'Hoje o dia é seu! Toda a equipe GCS deseja muita saúde, alegria e um novo ciclo cheio de conquistas.'
    if (eu)
        return `Seu aniversário foi ${quando} (${escaparAtributo(p.dia_mes_comemorado)}), mas a comemoração continua! Toda a equipe GCS deseja muita saúde, alegria e um novo ciclo cheio de conquistas.`
    if (!quando)
        return `Hoje é aniversário de ${nome}! Aproveite para mandar os parabéns e desejar um ótimo novo ciclo.`
    return `O aniversário de ${nome} foi ${quando} (${escaparAtributo(p.dia_mes_comemorado)}). Ainda dá tempo de mandar os parabéns!`
}

function popupAniversarios(hoje, proximos) {
    const meu = hoje.find(p => p.usuario === acesso.usuario)
    const todosHoje = hoje.every(p => !p.dias_desde)

    const confetes = Array.from({ length: 26 }, (_, i) => `
        <i style="--x: ${Math.round(Math.random() * 100)}%; --atraso: ${(Math.random() * 2.2).toFixed(2)}s;
            --duracao: ${(2.6 + Math.random() * 2).toFixed(2)}s; --giro: ${Math.round(Math.random() * 720 - 360)}deg;
            --cor: ${['#22c55e', '#facc15', '#3b82f6', '#ef4444', '#a855f7', '#f97316'][i % 6]}"></i>`).join('')

    const cartoes = hoje.map(p => `
        <div class="aniversario-cartao">
            <div class="aniversario-foto">
                <img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(p.foto))}" alt=""
                    onerror="this.onerror = null; this.src = logo">
                <span class="aniversario-selo" aria-hidden="true">🎂</span>
            </div>
            <span class="aniversario-nome">${escaparAtributo(nomeAniversario(p.nome))}</span>
            ${p.cargo || p.setor ? `<small class="aniversario-funcao">${escaparAtributo(p.cargo || p.setor)}</small>` : ''}
            ${p.dias_desde ? `<small class="aniversario-quando">🎈 ${escaparAtributo(p.dia_mes_comemorado)} · ${quandoFoiAniversario(p)}</small>` : ''}
            <p class="aniversario-mensagem">${mensagemAniversario(p)}</p>
        </div>`).join('')

    const listaProximos = proximos.length
        ? proximos.map(p => `
            <li>
                <img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(p.foto))}" alt=""
                    onerror="this.onerror = null; this.src = logo">
                <span class="aniversario-proximo-nome">${escaparAtributo(nomeAniversario(p.nome))}</span>
                <span class="aniversario-proximo-data">
                    <b>${escaparAtributo(p.dia_mes)}</b>
                    <small>${quandoAniversario(p.dias_ate)}</small>
                </span>
            </li>`).join('')
        : '<li class="aniversario-vazio">Nenhum outro aniversário nos próximos 30 dias.</li>'

    const titulo = meu
        ? (meu.dias_desde ? 'Parabéns atrasado!' : 'Feliz aniversário!')
        : todosHoje
            ? (hoje.length > 1 ? 'Aniversariantes do dia' : 'Aniversariante do dia')
            : (hoje.length > 1 ? 'Aniversariantes' : 'Aniversariante')

    const elemento = `
        <div class="aniversarios">
            <div class="aniversario-confetes" aria-hidden="true">${confetes}</div>

            <section class="aniversario-destaque">
                <span class="aniversario-titulo">${titulo}</span>
                <div class="aniversario-cartoes">${cartoes}</div>
            </section>

            <aside class="aniversario-proximos">
                <span class="aniversario-subtitulo">Próximos aniversários</span>
                <ul>${listaProximos}</ul>
            </aside>
        </div>
    `

    popup({ elemento, titulo: '🎉 Aniversários' })
}
