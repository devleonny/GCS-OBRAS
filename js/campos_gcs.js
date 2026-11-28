// CAMPOS DE FORMULÁRIO NO PADRÃO DO DEPARTAMENTO DO FINANCEIRO (28/11/2026)
// Começou no formulário de correção e de chamado (ocorrencias.js). Componentes:
//   campoEscolhaHtml   campo pesquisável de lista FECHADA (o texto só busca; só entra clicando/Enter num item).
//                      multiplo = vai acrescentando chips ali mesmo, sem outro popup, e não aceita repetido.
//   toggleOpcoesHtml   pílulas de escolha única (radios por baixo: quem lê continua lendo :checked).
//   zonaAnexosHtml     clique para escolher ou arraste para enviar (como o importar OFX da conciliação).
//   blocoFotosHtml     grade de fotos + botão que abre a câmera (abrirCameraGCS).
//   abrirCameraGCS     câmera em tela cheia: várias fotos seguidas, trocar câmera, imagem da galeria.
//
// Fontes do campo pesquisável (fontesEscolha[nome]):
//   { base, filtros, campos: [colunas pesquisadas], valor: 'id', rotulo: d => '', detalhe: d => '',
//     local: true (carrega a lista uma vez e filtra aqui) | false (pesquisa no servidor a cada digitação),
//     limite, ordenar, filtrosDoCampo: campo => ({}), excluir: campo => [valores já usados em outro lugar],
//     dica: 'texto no topo da lista' }
// No servidor, cada palavra digitada vira um grupo OR por coluna ({ campo } nas regras, gcs SCRIPTS/pesquisa-db.js):
// "atacadao salvador" acha quem tem as duas palavras, em qualquer uma das colunas.
//
// Leitura: lerEscolha(campo) → valor (único) ou lista de valores (múltiplo); lerEscolhaRotulo(campo).

const fontesEscolha = {}
const cacheEscolha = {}
const dadosEscolha = new Map()
const TEMPO_CACHE_ESCOLHA = 5 * 60 * 1000

const normEscolha = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
const palavrasEscolha = t => String(t ?? '').split(/\s+/).map(normEscolha).filter(Boolean)
const escEscolha = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const ICONES_CAMPOS = {
    lupa: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    enviar: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    galeria: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    virar: '<path d="M4 9a8 8 0 0 1 14-3l2 2"/><path d="M20 4v4h-4"/><path d="M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M4 20v-4h4"/>',
    arquivo: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    madrugada: '<path d="M3 18h18"/><path d="M8 18a4 4 0 0 1 8 0"/><path d="M12 6v3M5.6 10.6l1.4 1.4M18.4 10.6 17 12"/>',
    manha: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    tarde: '<path d="M3 17h18"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M12 7v2M5 10l1.4 1.4M19 10l-1.4 1.4"/><path d="M8 21h8"/>',
    noite: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'
}
const iconeCampo = (nome, classe = '') =>
    `<svg class="ce-icone ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES_CAMPOS[nome] || ''}</svg>`

// ------------------------------------------------------------------ campo pesquisável

function campoEscolhaHtml({ fonte, name = fonte, valor = '', rotulo = '', multiplo = false, valores = [], placeholder = 'Pesquisar…', aoMudar = '' }) {
    const chips = multiplo
        ? valores.filter(v => v && v.valor != null && v.valor !== '').map(v => chipEscolhaHtml(v.valor, v.rotulo ?? v.valor)).join('')
        : ''
    const temValor = !multiplo && valor != null && valor !== ''
    return `
        <div class="ce-campo${multiplo ? ' ce-multiplo' : ''}${temValor ? ' ce-preenchido' : ''}" name="${escEscolha(name)}" data-ce-fonte="${escEscolha(fonte)}"
            ${multiplo ? 'data-ce-multiplo' : `data-valor="${escEscolha(temValor ? valor : '')}" data-rotulo="${escEscolha(temValor ? rotulo : '')}"`}
            ${aoMudar ? `data-ce-ao-mudar="${escEscolha(aoMudar)}"` : ''}>
            ${multiplo ? `<div class="ce-chips">${chips}</div>` : ''}
            <div class="ce-busca">
                ${iconeCampo('lupa', 'ce-lupa')}
                <input type="text" class="ce-input" value="${temValor ? escEscolha(rotulo) : ''}" placeholder="${escEscolha(placeholder)}"
                    autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list"
                    onfocus="ceFocar(this)" oninput="ceDigitar(this)" onkeydown="ceTecla(event, this)" onblur="ceSair(this)">
                ${multiplo ? '' : `<button type="button" class="ce-limpar" title="Limpar" aria-label="Limpar" onmousedown="event.preventDefault()" onclick="ceLimpar(this)">&times;</button>`}
                <div class="ce-lista" role="listbox" hidden></div>
            </div>
        </div>`
}

function chipEscolhaHtml(valor, rotulo) {
    return `
        <span class="ce-chip" data-valor="${escEscolha(valor)}" data-rotulo="${escEscolha(rotulo)}">
            <span class="ce-chip-texto">${escEscolha(rotulo)}</span>
            <button type="button" class="ce-chip-tirar" title="Tirar" aria-label="Tirar ${escEscolha(rotulo)}" onclick="ceRemoverChip(this)">&times;</button>
        </span>`
}

const campoDoElemento = el => el?.closest?.('.ce-campo') || null

function lerEscolha(campo) {
    if (!campo) return null
    if (campo.hasAttribute('data-ce-multiplo'))
        return [...campo.querySelectorAll('.ce-chip')].map(c => c.dataset.valor)
    return campo.dataset.valor || null
}

function lerEscolhaRotulo(campo) {
    if (!campo) return null
    if (campo.hasAttribute('data-ce-multiplo'))
        return [...campo.querySelectorAll('.ce-chip')].map(c => c.dataset.rotulo)
    return campo.dataset.valor ? campo.dataset.rotulo || campo.dataset.valor : null
}

// Dado completo do item escolhido (o que veio da pesquisa), quando ainda está na memória.
const dadoEscolhido = (campo, valor = lerEscolha(campo)) => dadosEscolha.get(`${campo?.dataset.ceFonte}|${valor}`) || null

function filtrosEscolha(campo, fonte) {
    return { ...(fonte.filtros || {}), ...(fonte.filtrosDoCampo?.(campo) || {}) }
}

async function itensLocaisEscolha(campo, fonte) {
    const filtros = filtrosEscolha(campo, fonte)
    const chave = `${campo.dataset.ceFonte}|${JSON.stringify(filtros)}`
    const atual = cacheEscolha[chave]
    if (atual && Date.now() - atual.quando < TEMPO_CACHE_ESCOLHA) return atual.itens
    const promessa = pesquisarDB({ base: fonte.base, filtros, limite: fonte.limiteLocal || 2000, ordenar: fonte.ordenar })
        .then(r => r?.resultados || [])
    cacheEscolha[chave] = { quando: Date.now(), itens: promessa }
    try {
        const itens = await promessa
        cacheEscolha[chave] = { quando: Date.now(), itens }
        return itens
    } catch (err) {
        delete cacheEscolha[chave]
        throw err
    }
}

async function pesquisarEscolha(campo, termo) {
    const fonte = fontesEscolha[campo.dataset.ceFonte]
    if (!fonte) throw new Error(`Campo sem fonte: ${campo.dataset.ceFonte}`)
    const campos = fonte.campos || ['nome']
    const palavras = palavrasEscolha(termo)
    const limite = fonte.limite || 40

    if (fonte.local) {
        const itens = await itensLocaisEscolha(campo, fonte)
        const achados = !palavras.length ? itens : itens.filter(d => {
            const textos = campos.map(c => normEscolha(getByPath(d, c)))
            return palavras.every(p => textos.some(t => t.includes(p)))
        })
        return { itens: achados.slice(0, limite), mais: achados.length > limite }
    }

    const filtros = filtrosEscolha(campo, fonte)
    palavras.slice(0, 6).forEach((p, i) => {
        filtros[`__busca${i}`] = { modo: 'OR', regras: campos.map(c => ({ campo: c, op: 'includes', value: p })) }
    })
    const r = await pesquisarDB({ base: fonte.base, filtros, limite, ordenar: fonte.ordenar })
    const itens = r?.resultados || []
    return { itens, mais: itens.length >= limite }
}

function valorDoDado(fonte, d) {
    const v = typeof fonte.valor === 'function' ? fonte.valor(d) : getByPath(d, fonte.valor || 'id')
    return v == null ? '' : String(v)
}
const rotuloDoDado = (fonte, d) => String((fonte.rotulo ? fonte.rotulo(d) : d.nome) ?? '')

function ceFocar(input) {
    input.select()
    ceAbrirLista(input, '')
}

function ceDigitar(input) {
    const campo = campoDoElemento(input)
    campo.classList.remove('ce-invalido')
    clearTimeout(campo._ceEspera)
    const fonte = fontesEscolha[campo.dataset.ceFonte]
    campo._ceEspera = setTimeout(() => ceAbrirLista(input, input.value), fonte?.local ? 60 : 250)
}

async function ceAbrirLista(input, termo) {
    const campo = campoDoElemento(input)
    const lista = campo.querySelector('.ce-lista')
    const fonte = fontesEscolha[campo.dataset.ceFonte]
    if (!fonte) return
    // Campo único: o texto do que já está escolhido não filtra (ao focar mostra tudo de novo).
    if (!campo.hasAttribute('data-ce-multiplo') && termo && normEscolha(termo) === normEscolha(campo.dataset.rotulo)) termo = ''

    const pedido = (campo._cePedido || 0) + 1
    campo._cePedido = pedido
    lista.hidden = false
    input.setAttribute('aria-expanded', 'true')
    if (!lista.children.length || !fonte.local) lista.innerHTML = '<div class="ce-lista-aviso">Buscando…</div>'

    let resultado
    try {
        resultado = await pesquisarEscolha(campo, termo)
    } catch (err) {
        console.error('Campo pesquisável:', err)
        if (campo._cePedido === pedido) lista.innerHTML = '<div class="ce-lista-aviso ce-erro">Não foi possível pesquisar agora. Tente de novo.</div>'
        return
    }
    if (campo._cePedido !== pedido || document.activeElement !== input) return

    const escolhidos = new Set([
        ...[].concat(lerEscolha(campo) || []),
        ...(fonte.excluir?.(campo) || []).map(String)
    ])
    const multiplo = campo.hasAttribute('data-ce-multiplo')
    const palavras = palavrasEscolha(termo)

    const linhas = resultado.itens.map(d => {
        const valor = valorDoDado(fonte, d)
        if (!valor) return ''
        dadosEscolha.set(`${campo.dataset.ceFonte}|${valor}`, d)
        const rotulo = rotuloDoDado(fonte, d)
        const detalhe = fonte.detalhe?.(d) || ''
        const ja = escolhidos.has(valor) && (multiplo || valor !== campo.dataset.valor)
        const atual = !multiplo && valor === campo.dataset.valor
        return `
            <button type="button" class="ce-item${ja ? ' ce-ja' : ''}${atual ? ' ce-atual' : ''}" role="option" tabindex="-1"
                data-valor="${escEscolha(valor)}" data-rotulo="${escEscolha(rotulo)}" ${ja ? 'aria-disabled="true"' : ''}
                onmousedown="event.preventDefault()" onclick="ceEscolher(this)">
                <span class="ce-item-rotulo">${destacarEscolha(rotulo, palavras)}</span>
                ${detalhe ? `<span class="ce-item-detalhe">${destacarEscolha(detalhe, palavras)}</span>` : ''}
                ${ja ? '<span class="ce-item-ja">já incluído</span>' : ''}
            </button>`
    }).join('')

    lista.innerHTML = `
        ${fonte.dica && !palavras.length ? `<div class="ce-lista-aviso">${escEscolha(fonte.dica)}</div>` : ''}
        ${linhas || `<div class="ce-lista-aviso">${palavras.length ? 'Nada encontrado: só vale um item da lista.' : 'Lista vazia.'}</div>`}
        ${resultado.mais ? '<div class="ce-lista-aviso">Mostrando os primeiros. Digite mais para refinar.</div>' : ''}`
    const primeiro = lista.querySelector('.ce-item:not(.ce-ja)')
    if (primeiro && palavras.length) primeiro.classList.add('ce-ativo')
}

// Negrito no trecho que bate com cada palavra digitada (ignora acento e caixa).
function destacarEscolha(texto, palavras) {
    const t = String(texto ?? '')
    if (!palavras.length) return escEscolha(t)
    const marcas = new Array(t.length).fill(false)
    // Mapa caractere a caractere do texto normalizado (só letras/números) para a posição original.
    const pos = [], norm = []
    for (let i = 0; i < t.length; i++) {
        const n = normEscolha(t[i])
        for (const c of n) { norm.push(c); pos.push(i) }
    }
    const textoNorm = norm.join('')
    for (const p of palavras) {
        let i = textoNorm.indexOf(p)
        while (i !== -1) {
            for (let k = i; k < i + p.length; k++) marcas[pos[k]] = true
            i = textoNorm.indexOf(p, i + p.length)
        }
    }
    let html = '', aberto = false
    for (let i = 0; i < t.length; i++) {
        if (marcas[i] && !aberto) { html += '<b>'; aberto = true }
        if (!marcas[i] && aberto && /[\p{L}\p{N}]/u.test(t[i])) { html += '</b>'; aberto = false }
        html += escEscolha(t[i])
    }
    return html + (aberto ? '</b>' : '')
}

function ceTecla(evento, input) {
    const campo = campoDoElemento(input)
    const lista = campo.querySelector('.ce-lista')
    const itens = [...lista.querySelectorAll('.ce-item:not(.ce-ja)')]
    const ativo = lista.querySelector('.ce-ativo')
    const mover = passo => {
        if (lista.hidden) return ceAbrirLista(input, input.value)
        if (!itens.length) return
        const i = itens.indexOf(ativo)
        const prox = itens[(i + passo + itens.length) % itens.length]
        ativo?.classList.remove('ce-ativo')
        prox.classList.add('ce-ativo')
        prox.scrollIntoView({ block: 'nearest' })
    }
    if (evento.key === 'ArrowDown') { evento.preventDefault(); mover(1) }
    else if (evento.key === 'ArrowUp') { evento.preventDefault(); mover(-1) }
    else if (evento.key === 'Enter') {
        evento.preventDefault()
        const alvo = ativo || (itens.length === 1 ? itens[0] : null)
        if (alvo) ceEscolher(alvo)
    } else if (evento.key === 'Escape' && !lista.hidden) {
        evento.preventDefault()
        evento.stopPropagation()
        ceFecharLista(campo, true)
    } else if (evento.key === 'Backspace' && !input.value && campo.hasAttribute('data-ce-multiplo')) {
        campo.querySelector('.ce-chip:last-child .ce-chip-tirar')?.click()
    }
}

function ceFecharLista(campo, restaurar) {
    const input = campo.querySelector('.ce-input')
    const lista = campo.querySelector('.ce-lista')
    lista.hidden = true
    input.setAttribute('aria-expanded', 'false')
    if (!restaurar) return
    const multiplo = campo.hasAttribute('data-ce-multiplo')
    const voltar = multiplo ? '' : campo.dataset.rotulo || ''
    // Texto solto não fica: volta para o escolhido e pisca para mostrar que não valeu.
    if (input.value.trim() && normEscolha(input.value) !== normEscolha(voltar)) {
        campo.classList.remove('ce-invalido')
        void campo.offsetWidth
        campo.classList.add('ce-invalido')
        setTimeout(() => campo.classList.remove('ce-invalido'), 1200)
    }
    input.value = voltar
}

function ceSair(input) {
    const campo = campoDoElemento(input)
    clearTimeout(campo._ceEspera)
    setTimeout(() => {
        if (document.activeElement === input) return
        campo._cePedido = (campo._cePedido || 0) + 1
        ceFecharLista(campo, true)
    }, 120)
}

function ceEscolher(botao) {
    const campo = campoDoElemento(botao)
    if (botao.classList.contains('ce-ja')) {
        const chip = [...campo.querySelectorAll('.ce-chip')].find(c => c.dataset.valor === botao.dataset.valor)
        if (chip) piscarChip(chip)
        return
    }
    ceDefinir(campo, botao.dataset.valor, botao.dataset.rotulo)
    const input = campo.querySelector('.ce-input')
    if (campo.hasAttribute('data-ce-multiplo')) {
        input.value = ''
        ceAbrirLista(input, '')
        input.focus()
    } else {
        ceFecharLista(campo, false)
        input.blur()
    }
}

function piscarChip(chip) {
    chip.classList.remove('ce-pisca')
    void chip.offsetWidth
    chip.classList.add('ce-pisca')
}

// Escolhe por código (também usado para preencher técnicos memorizados etc.). Retorna false se for repetido.
function ceDefinir(campo, valor, rotulo = valor) {
    if (!campo || valor == null || valor === '') return false
    valor = String(valor)
    if (campo.hasAttribute('data-ce-multiplo')) {
        const repetido = [...campo.querySelectorAll('.ce-chip')].find(c => c.dataset.valor === valor)
        if (repetido) { piscarChip(repetido); return false }
        campo.querySelector('.ce-chips').insertAdjacentHTML('beforeend', chipEscolhaHtml(valor, rotulo))
    } else {
        campo.dataset.valor = valor
        campo.dataset.rotulo = rotulo
        campo.querySelector('.ce-input').value = rotulo
        campo.classList.add('ce-preenchido')
    }
    campo.classList.remove('ce-invalido')
    ceAvisarMudanca(campo)
    return true
}

function ceLimpar(botao) {
    const campo = campoDoElemento(botao)
    campo.dataset.valor = ''
    campo.dataset.rotulo = ''
    campo.querySelector('.ce-input').value = ''
    campo.classList.remove('ce-preenchido')
    ceAvisarMudanca(campo)
}

function ceRemoverChip(botao) {
    const campo = campoDoElemento(botao)
    botao.closest('.ce-chip').remove()
    ceAvisarMudanca(campo)
}

function ceAvisarMudanca(campo) {
    const funcao = window[campo.dataset.ceAoMudar]
    if (typeof funcao === 'function') {
        Promise.resolve(funcao(campo)).catch(err => console.error('Campo pesquisável (ao mudar):', err))
    }
}

// ------------------------------------------------------------------ pílulas (escolha única)
// opcoes: [{ valor, texto, icone }] ou textos. dado = nome do data-* que leva o valor (ex.: 'turno' → data-turno).
// desmarcavel: clicar de novo na marcada tira a escolha.
function toggleOpcoesHtml({ name, opcoes, valor, dado = 'valor', desmarcavel = true, compacto = false }) {
    const lista = opcoes.map(o => typeof o === 'string' ? { valor: o, texto: o } : o)
    return `
        <div class="ce-toggle${compacto ? ' ce-toggle-compacto' : ''}" role="radiogroup">
            ${lista.map(o => `
                <label class="ce-toggle-op">
                    <input type="radio" name="${escEscolha(name)}" value="${escEscolha(o.valor)}" data-${dado}="${escEscolha(o.valor)}"
                        ${String(o.valor) === String(valor ?? '') ? 'checked data-marcado="1"' : ''}
                        ${desmarcavel ? 'onclick="ceToggleClique(this)"' : ''}>
                    <span>${o.icone ? iconeCampo(o.icone) : ''}${escEscolha(o.texto ?? o.valor)}</span>
                </label>`).join('')}
        </div>`
}

function ceToggleClique(radio) {
    const grupo = radio.closest('.ce-toggle')
    if (radio.dataset.marcado) {
        radio.checked = false
        delete radio.dataset.marcado
        return
    }
    grupo.querySelectorAll('input[type="radio"]').forEach(r => delete r.dataset.marcado)
    radio.dataset.marcado = '1'
}

const lerToggle = (raiz, name) => raiz?.querySelector(`input[type="radio"][name="${name}"]:checked`)?.value ?? ''

// ------------------------------------------------------------------ anexos (clique ou arraste)
// O <input type="file" name> guarda os arquivos escolhidos (vários envios se somam): quem salva lê input.files
// como antes (importarAnexos({ input })). existentes = HTML dos anexos já salvos (criarAnexoVisual).
function zonaAnexosHtml({ name = 'anexos', existentes = '', dica = 'PDF, imagens, planilhas… pode mandar vários de uma vez' } = {}) {
    return `
        <div class="ce-anexos" data-ce-anexos>
            <label class="ce-soltar" data-soltar-arquivo="ceSoltarAnexosPopup"
                ondragover="event.preventDefault(); this.classList.add('ce-soltar-sobre')"
                ondragleave="this.classList.remove('ce-soltar-sobre')"
                ondrop="event.preventDefault(); this.classList.remove('ce-soltar-sobre'); ceSomarAnexos(this, event.dataTransfer.files)">
                ${iconeCampo('enviar')}
                <b>Arraste os arquivos aqui ou clique para escolher</b>
                <small>${escEscolha(dica)}</small>
                <input type="file" name="${escEscolha(name)}" multiple hidden onchange="ceSomarAnexos(this, this.files)">
            </label>
            <div class="ce-anexos-novos"></div>
            <div id="anexos" class="local-anexos">${existentes}</div>
        </div>`
}

// Soltou o arquivo em outro ponto do popup (ferramentas.js areaSoltarArquivo): vale como soltar na área.
function ceSoltarAnexosPopup(evento, area) {
    ceSomarAnexos(area, evento.dataTransfer?.files)
}

function ceSomarAnexos(el, arquivos) {
    const zona = el.closest('[data-ce-anexos]')
    const input = zona.querySelector('input[type="file"]')
    input._ceArquivos ??= []
    // Escolhendo pelo clique, o input troca os arquivos dele pelos novos: aqui eles se somam aos anteriores.
    for (const f of [...(arquivos || [])]) {
        const igual = input._ceArquivos.some(a => a.name === f.name && a.size === f.size && a.lastModified === f.lastModified)
        if (!igual) input._ceArquivos.push(f)
    }
    ceAplicarAnexos(input)
}

function ceAplicarAnexos(input) {
    const dt = new DataTransfer()
    input._ceArquivos.forEach(f => dt.items.add(f))
    input.files = dt.files
    const zona = input.closest('[data-ce-anexos]')
    const tamanho = b => b > 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`
    zona.querySelector('.ce-anexos-novos').innerHTML = input._ceArquivos.map((f, i) => `
        <span class="ce-anexo-novo" title="Vai ser enviado ao salvar">
            ${iconeCampo('arquivo')}
            <span class="ce-anexo-nome">${escEscolha(f.name)}</span>
            <small>${tamanho(f.size)}</small>
            <button type="button" class="ce-chip-tirar" aria-label="Tirar ${escEscolha(f.name)}" onclick="ceTirarAnexo(this, ${i})">&times;</button>
        </span>`).join('')
}

function ceTirarAnexo(botao, indice) {
    const input = botao.closest('[data-ce-anexos]').querySelector('input[type="file"]')
    input._ceArquivos.splice(indice, 1)
    ceAplicarAnexos(input)
}

// ------------------------------------------------------------------ fotos do formulário
// fotos salvas: { link: {...} }. funcaoExcluir(link) = texto da chamada que apaga a foto salva (ou '' sem excluir).
function blocoFotosHtml({ fotos = {}, funcaoExcluir = null } = {}) {
    const salvas = Object.keys(fotos || {}).map(link => fotoFormHtml({
        id: link, src: `${api}/uploads/${link}`, salvo: true,
        remover: funcaoExcluir ? funcaoExcluir(link) : ''
    })).join('')
    return `
        <div class="ce-fotos" data-ce-fotos>
            <div class="fotos ce-fotos-grade">${salvas}</div>
            <button type="button" class="ce-foto-abrir" onclick="ceAbrirCameraForm(this)">
                ${iconeCampo('camera')}
                <span><b>Tirar foto</b><small>ou escolher imagem do aparelho</small></span>
            </button>
        </div>`
}

function fotoFormHtml({ id, src, salvo, remover = '' }) {
    const tirar = salvo
        ? (remover ? `onclick="event.stopPropagation(); ${remover}"` : '')
        : `onclick="event.stopPropagation(); ceTirarFotoNova(this)"`
    return `
        <div class="ce-foto${salvo ? '' : ' ce-foto-nova'}" id="bloco-foto-${escEscolha(id)}">
            <img name="foto" data-salvo="${salvo ? 'sim' : 'não'}" id="${escEscolha(id)}" src="${src}" class="foto" alt="Foto" onclick="ampliarImagem(this, '${escEscolha(id)}')">
            ${tirar ? `<button type="button" class="ce-foto-tirar" title="Tirar foto" aria-label="Tirar foto" ${tirar}>&times;</button>` : ''}
            ${salvo ? '' : '<span class="ce-foto-selo">nova</span>'}
        </div>`
}

function ceTirarFotoNova(botao) {
    botao.closest('.ce-foto').remove()
}

function ceAbrirCameraForm(botao) {
    const grade = botao.closest('[data-ce-fotos]').querySelector('.ce-fotos-grade')
    abrirCameraGCS({
        titulo: 'Fotos do formulário',
        aoCapturar: src => {
            grade.insertAdjacentHTML('beforeend', fotoFormHtml({ id: crypto.randomUUID(), src, salvo: false }))
        }
    })
}

// ------------------------------------------------------------------ câmera
// aoCapturar(dataUrl JPEG) a cada foto (pode ser assíncrono: a miniatura mostra enviando/erro).
// aoConcluir(quantidade) ao fechar. Sem câmera (computador, permissão negada), a galeria continua valendo.
async function abrirCameraGCS({ titulo = 'Tirar foto', aoCapturar, aoConcluir, maxLado = 1920 } = {}) {

    document.querySelector('.cam-gcs')?.remove()

    const tela = document.createElement('div')
    tela.className = 'cam-gcs'
    tela.setAttribute('role', 'dialog')
    tela.setAttribute('aria-modal', 'true')
    tela.setAttribute('aria-label', titulo)
    tela.innerHTML = `
        <div class="cam-topo">
            <span class="cam-titulo">${escEscolha(titulo)}</span>
            <span class="cam-contador" hidden></span>
            <button type="button" class="cam-fechar" aria-label="Fechar câmera" title="Fechar">&times;</button>
        </div>
        <div class="cam-palco">
            <video autoplay playsinline muted></video>
            <div class="cam-flash"></div>
            <div class="cam-aviso" hidden></div>
        </div>
        <div class="cam-rodape">
            <div class="cam-miniaturas"></div>
            <div class="cam-controles">
                <label class="cam-btn" title="Escolher imagem do aparelho">
                    ${iconeCampo('galeria')}
                    <span>Galeria</span>
                    <input type="file" accept="image/*" multiple hidden>
                </label>
                <button type="button" class="cam-disparo" aria-label="Tirar foto" title="Tirar foto (espaço)"><span></span></button>
                <button type="button" class="cam-btn cam-virar" title="Trocar câmera" hidden>
                    ${iconeCampo('virar')}
                    <span>Virar</span>
                </button>
            </div>
            <button type="button" class="cam-concluir">Concluir</button>
        </div>`
    document.body.appendChild(tela)

    const video = tela.querySelector('video')
    const aviso = tela.querySelector('.cam-aviso')
    const disparo = tela.querySelector('.cam-disparo')
    const miniaturas = tela.querySelector('.cam-miniaturas')
    const contador = tela.querySelector('.cam-contador')
    let fluxo = null
    let frente = false
    let quantidade = 0
    let pendentes = 0

    const parar = () => {
        fluxo?.getTracks().forEach(t => t.stop())
        fluxo = null
        video.srcObject = null
    }

    const ligar = async () => {
        parar()
        aviso.hidden = true
        disparo.disabled = true
        if (!navigator.mediaDevices?.getUserMedia) {
            aviso.hidden = false
            aviso.innerHTML = 'Este navegador não abre a câmera. Use <b>Galeria</b> para escolher uma imagem.'
            return
        }
        try {
            fluxo = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: frente ? 'user' : 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            })
            if (!tela.isConnected) return parar()
            video.srcObject = fluxo
            video.classList.toggle('cam-espelho', frente)
            disparo.disabled = false
            const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
            tela.querySelector('.cam-virar').hidden = cameras.length < 2
        } catch (err) {
            aviso.hidden = false
            const negado = err?.name === 'NotAllowedError'
            aviso.innerHTML = negado
                ? 'A câmera foi bloqueada no navegador. Libere a permissão no cadeado da barra de endereço ou use <b>Galeria</b>.'
                : 'Nenhuma câmera disponível agora. Use <b>Galeria</b> para escolher uma imagem do aparelho.'
        }
    }

    const reduzir = fonte => {
        const w = fonte.videoWidth || fonte.naturalWidth || fonte.width
        const h = fonte.videoHeight || fonte.naturalHeight || fonte.height
        const escala = Math.min(1, maxLado / Math.max(w, h))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * escala)
        canvas.height = Math.round(h * escala)
        canvas.getContext('2d').drawImage(fonte, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', 0.85)
    }

    const registrar = async src => {
        quantidade++
        pendentes++
        contador.hidden = false
        contador.textContent = `${quantidade} ${quantidade === 1 ? 'foto' : 'fotos'}`
        const mini = document.createElement('div')
        mini.className = 'cam-mini cam-enviando'
        mini.innerHTML = `<img src="${src}" alt="Foto ${quantidade}">`
        miniaturas.appendChild(mini)
        miniaturas.scrollLeft = miniaturas.scrollWidth
        try {
            await aoCapturar?.(src)
            mini.classList.remove('cam-enviando')
        } catch (err) {
            console.error('Câmera:', err)
            mini.classList.remove('cam-enviando')
            mini.classList.add('cam-falhou')
            mini.title = 'Não foi enviada: tente de novo'
        } finally {
            pendentes--
        }
    }

    const capturar = () => {
        if (disparo.disabled || !video.videoWidth) return
        const flash = tela.querySelector('.cam-flash')
        flash.classList.remove('cam-flash-ativo')
        void flash.offsetWidth
        flash.classList.add('cam-flash-ativo')
        registrar(reduzir(video))
    }

    const daGaleria = async arquivos => {
        for (const arquivo of [...arquivos].filter(a => a.type.startsWith('image/'))) {
            const url = URL.createObjectURL(arquivo)
            try {
                const img = new Image()
                await new Promise((ok, erro) => { img.onload = ok; img.onerror = erro; img.src = url })
                await registrar(reduzir(img))
            } finally {
                URL.revokeObjectURL(url)
            }
        }
    }

    const fechar = async () => {
        if (pendentes) {
            aviso.hidden = false
            aviso.textContent = 'Terminando de enviar as fotos…'
            while (pendentes) await new Promise(r => setTimeout(r, 150))
        }
        parar()
        document.removeEventListener('keydown', teclas, true)
        tela.remove()
        aoConcluir?.(quantidade)
    }

    const teclas = evento => {
        if (!tela.isConnected) return
        if (evento.key === 'Escape') { evento.preventDefault(); evento.stopPropagation(); fechar() }
        // Espaço fora de um botão tira a foto (no botão, o próprio clique do navegador já tira).
        else if (evento.key === ' ' && !evento.target.closest?.('button, input, label, textarea, [contenteditable]')) {
            evento.preventDefault()
            capturar()
        }
    }

    disparo.addEventListener('click', capturar)
    tela.querySelector('.cam-fechar').addEventListener('click', fechar)
    tela.querySelector('.cam-concluir').addEventListener('click', fechar)
    tela.querySelector('.cam-virar').addEventListener('click', () => { frente = !frente; ligar() })
    tela.querySelector('input[type="file"]').addEventListener('change', e => { daGaleria(e.target.files); e.target.value = '' })
    document.addEventListener('keydown', teclas, true)
    disparo.focus()

    await ligar()
}

// ------------------------------------------------------------------ fontes comuns

// Usuários do GCS (técnicos, executores, gestor): o valor é o login (clientes.usuario).
fontesEscolha.usuarios = {
    base: 'clientes',
    filtros: { usuario: { op: 'NOT_EMPTY' } },
    campos: ['usuario', 'nome', 'matricula', 'cidade', 'permissao', 'cargo'],
    valor: 'usuario',
    rotulo: d => d.usuario,
    detalhe: d => [d.nome && d.nome !== d.usuario ? d.nome : '', d.cargo || d.permissao, cidadeUfEscolha(d)]
        .filter(Boolean).join(' · '),
    local: true,
    ordenar: { path: 'usuario', direcao: 'ASC' }
}

// "SALVADOR (BA)": a cidade de clientes às vezes já traz a UF.
const cidadeUfEscolha = d => !d.cidade ? '' : d.estado && !String(d.cidade).includes(d.estado) ? `${d.cidade}/${d.estado}` : d.cidade

const formatarCnpjEscolha = v => {
    const d = String(v || '').replace(/\D/g, '')
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    return v || ''
}

// Unidade de manutenção (clientes): pesquisa no servidor por nome, CNPJ, endereço, bairro, cidade, CEP…
fontesEscolha.unidades = {
    base: 'clientes',
    campos: ['nome', 'razao_social', 'cnpj', 'endereco', 'bairro', 'cidade', 'estado', 'cep'],
    valor: 'id',
    rotulo: d => d.nome,
    detalhe: d => [
        formatarCnpjEscolha(d.cnpj),
        [d.endereco, d.numero].filter(Boolean).join(', '),
        d.bairro,
        cidadeUfEscolha(d)
    ].filter(Boolean).join(' · '),
    limite: 30,
    ordenar: { path: 'nome', direcao: 'ASC' },
    dica: 'Pesquise por nome, CNPJ, endereço, bairro ou cidade'
}

// Listas simples de cadastro (id + nome).
for (const base of ['tipos', 'sistemas', 'prioridades']) {
    fontesEscolha[base] = { base, campos: ['nome'], valor: 'id', rotulo: d => d.nome, local: true, ordenar: { path: 'nome', direcao: 'ASC' } }
}

// Peças / equipamentos (dados_composicoes, sem serviços). O filtro de LPU vem do seletor da própria linha
// ([data-lpu]); itens já lançados em outra linha da mesma lista aparecem como "já incluído".
fontesEscolha.composicoes = {
    base: 'dados_composicoes',
    filtros: { tipo: { op: '!=', value: 'SERVIÇO' } },
    campos: ['descricao', 'id', 'modelo', 'fabricante', 'partnumber'],
    valor: 'id',
    rotulo: d => d.descricao,
    detalhe: d => [`Cód. ${d.id}`, d.modelo, d.fabricante, d.unidade].filter(Boolean).join(' · '),
    limite: 30,
    ordenar: { path: 'descricao', direcao: 'ASC' },
    dica: 'Pesquise por descrição, código, modelo ou fabricante',
    filtrosDoCampo: campo => {
        const lpu = String(campo.closest('.borda-equipamento')?.querySelector('[data-lpu]')?.value || '').toLowerCase()
        return lpu ? { [`snapshots.${lpu}.0`]: { op: '!=', value: 0 } } : {}
    },
    excluir: campo => [...(campo.closest('#equipamentos')?.querySelectorAll('.ce-campo[data-ce-fonte="composicoes"]') || [])]
        .filter(c => c !== campo)
        .map(c => c.dataset.valor)
        .filter(Boolean)
}
