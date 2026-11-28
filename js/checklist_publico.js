// Página pública do checklist (checklist.html#CÓDIGO), feita para o celular. Sem login: o código é a autorização
// (gcs/SCRIPTS/planos_diarios_links.js). Tudo entra numa fila no aparelho (IndexedDB) e sobe em seguida:
// sem internet, fica guardado e é enviado quando ela volta.
(() => {
    const API = window.API_CHECKLIST || 'https://api.gcs.app.br'
    const codigo = location.hash.slice(1)
    const $ = id => document.getElementById(id)
    const corpo = $('ck-corpo')
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    const num = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
    const tres = n => Math.round(n * 1000) / 1000
    const br = d => d.split('-').reverse().join('/')
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const hoje = () => iso(new Date())
    // crypto.randomUUID não existe em navegadores mais antigos.
    const uuid = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))
    const CORES = ['#1d63ed', '#e11d2e', '#16a34a', '#c99a06', '#7c3aed', '#0e9aa7', '#ea580c', '#be185d', '#4d7c0f', '#475569']
    const TIPOS = { rack: ['#e11d2e', 1], eletroduto_dados: ['#16a34a', 1], eletrocalha: ['#c99a06', 1], utp: ['#1d63ed', 0], fibra: ['#e11d2e', 0], eletroduto_eletrico: ['#16a34a', 0], circuito: ['#1d63ed', 1], camera: ['#35d000', 0], livre: [null, 0] }

    let estado = null, dia = hoje(), aba = 'itens', fila = [], enviando = false, encerrado = ''
    let temporizador = null, banco = null

    // ---------- fila no aparelho ----------
    const abrirBanco = () => new Promise(ok => {
        try {
            const p = indexedDB.open('checklist-gcs', 1)
            p.onupgradeneeded = () => { p.result.createObjectStore('fila', { keyPath: 'chave' }); p.result.createObjectStore('estado') }
            p.onsuccess = () => ok(p.result)
            p.onerror = p.onblocked = () => ok(null)
        } catch { ok(null) }
    })
    // Sem IndexedDB (aba anônima em alguns aparelhos) a fila vale só enquanto a página estiver aberta.
    const noBanco = (loja, modo, fn) => new Promise((ok, falha) => {
        if (!banco) return ok(undefined)
        const t = banco.transaction(loja, modo), r = fn(t.objectStore(loja))
        t.oncomplete = () => ok(r?.result)
        t.onerror = t.onabort = () => falha(t.error || new Error('Sem espaço no aparelho.'))
    })
    const daqui = op => op.codigo === codigo

    async function enfileirar(op) {
        op = { codigo, carimbo: uuid(), criado: Date.now(), ...op }
        op.chave = `${codigo}|${op.chave}`
        const antiga = fila.find(f => f.chave === op.chave)
        if (antiga) {
            op.criado = antiga.criado
            if (op.tipo === 'salvar') op.dados = { ...antiga.dados, ...op.dados, executado: { ...antiga.dados.executado, ...op.dados.executado } }
            fila[fila.indexOf(antiga)] = op
        } else fila.push(op)
        situacao()
        try { await noBanco('fila', 'readwrite', s => s.put(op)) }
        catch { avisar('O aparelho está sem espaço: mantenha esta página aberta até enviar.', true) }
        situacao()
        agendarEnvio(op.tipo === 'salvar' ? 900 : 50)
    }
    async function tirarDaFila(op) {
        // Mudou enquanto era enviada: a versão nova continua na fila.
        const atual = fila.find(f => f.chave === op.chave)
        if (!atual || atual.carimbo !== op.carimbo) return
        fila = fila.filter(f => f !== atual)
        await noBanco('fila', 'readwrite', s => s.delete(op.chave)).catch(() => {})
    }
    function agendarEnvio(ms) {
        clearTimeout(temporizador)
        temporizador = setTimeout(enviarFila, ms)
    }

    async function pedir(rota, corpoPedido, arquivo = false) {
        const form = corpoPedido instanceof FormData
        const r = await fetch(`${API}/checklist-publico/${rota}`, { method: 'POST', body: form ? corpoPedido : JSON.stringify(corpoPedido),
            headers: { Authorization: `Link ${codigo}`, ...(form ? {} : { 'Content-Type': 'application/json' }) } })
        if (!r.ok) {
            const d = await r.json().catch(() => ({}))
            throw Object.assign(new Error(d.mensagem || 'Não foi possível concluir agora.'), { status: r.status })
        }
        return arquivo ? r.blob() : r.json()
    }

    async function enviarFila() {
        if (enviando || encerrado) return
        enviando = true
        clearTimeout(temporizador)
        let parou = false
        while (fila.length && !parou) {
            const op = fila[0]
            situacao()
            try {
                let novo
                if (op.tipo === 'foto') {
                    const f = new FormData()
                    for (const k of ['id', 'secao', 'data', 'comentario']) f.append(k, op[k] || '')
                    f.append('foto', op.blob, 'foto.jpg')
                    novo = await pedir('foto', f)
                } else if (op.tipo === 'salvar') novo = await pedir('salvar', { data: op.data, dados: op.dados })
                else novo = await pedir('fotoAlterar', op.corpo)
                estado = novo
                await tirarDaFila(op)
                guardarEstado()
            } catch (e) {
                if (e.status === 410) { encerrado = e.message; parou = true }
                // Recusado pelo servidor (ex.: passa do previsto): repetir não resolve, sai da fila e avisa.
                else if ([400, 403, 404, 413].includes(e.status)) {
                    await tirarDaFila(op)
                    avisar(e.message, true)
                    await recarregar()
                } else { parou = true; temporizador = setTimeout(enviarFila, 15000) }
            }
        }
        enviando = false
        situacao()
        if (encerrado) mostrarEncerrado()
        else if (!digitando()) desenhar()
        else cabecalho()
    }
    const guardarEstado = () => noBanco('estado', 'readwrite', s => s.put(estado, codigo)).catch(() => {})
    const digitando = () => document.activeElement?.matches?.('#ck-corpo input, #ck-corpo textarea') || !!document.querySelector('.ck-tela, .cam-gcs')

    async function recarregar() {
        try { estado = await pedir('abrir', {}); guardarEstado() }
        catch (e) { if (e.status === 410) { encerrado = e.message; mostrarEncerrado() } else if (!estado) throw e }
    }
    function mostrarEncerrado() {
        $('ck-abas').hidden = true; $('ck-dia').hidden = true
        document.querySelector('.ck-tela')?.remove()
        corpo.innerHTML = `<div class="ck-cartao ck-vazio"><b>${esc(encerrado)}</b>${fila.length ? `<p>${fila.length} alteração(ões) ainda não enviada(s) continuam guardadas neste aparelho. Se o link for renovado, abra-o de novo para enviar.</p>` : ''}</div>`
    }

    function situacao() {
        const el = $('ck-situacao')
        const fotos = fila.filter(f => f.tipo === 'foto').length
        el.hidden = !fila.length
        el.classList.toggle('ck-fora', !navigator.onLine)
        if (fila.length) el.textContent = !navigator.onLine ? `Sem internet · ${fotos ? `${fotos} foto(s) e ` : ''}as alterações estão guardadas e sobem quando ela voltar`
            : `Salvando… ${fotos ? `${fotos} foto(s) na fila · ` : ''}não precisa esperar`
    }
    let sumir = null
    function avisar(texto, erro = false) {
        document.querySelector('.ck-aviso')?.remove()
        document.body.insertAdjacentHTML('beforeend', `<div class="ck-aviso ${erro ? 'ck-erro' : ''}" role="alert">${esc(texto)}</div>`)
        clearTimeout(sumir)
        sumir = setTimeout(() => document.querySelector('.ck-aviso')?.remove(), erro ? 7000 : 3000)
    }

    // ---------- estado do servidor + o que ainda está na fila ----------
    function diaDe(data) {
        const salvo = estado.dias.find(d => d.data === data)
        const anterior = estado.dias.filter(d => d.data < data).sort((a, b) => a.data.localeCompare(b.data)).at(-1)
        const base = salvo || { ...(anterior || estado.gerais), executado: {}, observacoes: '' }
        const op = fila.find(f => f.tipo === 'salvar' && f.data === data)
        return { gerente: '', efetivo: 0, horario: '', observacoes: '', ...base, ...(op?.dados || {}), executado: { ...base.executado, ...op?.dados.executado }, salvo: !!salvo || !!op }
    }
    const datas = () => [...new Set([...estado.dias.map(d => d.data), ...fila.filter(f => f.tipo === 'salvar').map(f => f.data)])]
    function numeros(a) {
        let ate = a.inicial, outros = a.inicial
        for (const d of datas()) {
            const v = Number(diaDe(d).executado[a.id] || 0)
            if (d <= dia) ate += v
            if (d !== dia) outros += v
        }
        return { acumulado: tres(ate), maximo: Math.max(0, tres(a.previsto - outros)), percentual: a.previsto > 0 ? ate / a.previsto * 100 : 0 }
    }
    const diaria = secao => !!estado.secoes.find(s => s.secao === secao)?.diaria
    const versaoEm = (lista, d) => (lista || []).filter(v => v.data <= d).sort((a, b) => a.data.localeCompare(b.data)).at(-1)
    const comentarioDe = f => fila.find(o => o.tipo === 'alterar' && o.corpo.id === f.id && o.corpo.comentario !== undefined)?.corpo.comentario
        ?? versaoEm(f.comentarios, dia)?.texto ?? f.comentario
    const removida = f => fila.some(o => o.tipo === 'alterar' && o.corpo.id === f.id && o.corpo.remover)
    const marcacoesDe = f => {
        const ops = fila.filter(o => o.tipo === 'alterar' && o.corpo.id === f.id && o.corpo.data <= dia)
        const apagadas = new Set(ops.flatMap(o => o.corpo.apagar || [])), tem = new Set((f.marcacoes || []).map(m => m.id))
        return [...(f.marcacoes || []).filter(m => m.data <= dia && !(m.ate && m.ate <= dia)), ...ops.flatMap(o => o.corpo.adicionar || []).filter(m => !tem.has(m.id))]
            .filter(m => !apagadas.has(m.id))
    }
    function fotosDa(secoes) {
        const pend = fila.filter(o => o.tipo === 'foto').map(o => ({ ...o, minha: true, pendente: true, marcacoes: [] })).filter(p => !estado.fotos.some(f => f.id === p.id))
        return [...estado.fotos, ...pend].filter(f => secoes.includes(f.secao) && !removida(f)
            && (diaria(f.secao) ? f.data === dia : f.data <= dia && !(f.ate && f.ate <= dia)))
    }

    // Imagens pedidas com o código no cabeçalho (não vai na URL); ficam na memória da página.
    const imagens = new Map()
    function imagemDe(f, mini) {
        const op = fila.find(o => o.tipo === 'foto' && o.id === f.id)
        const versao = versaoEm(f.links, dia)?.data || ''
        const chave = op ? `local|${f.id}` : `${f.id}|${versao}|${mini}`
        if (!imagens.has(chave)) imagens.set(chave, (op ? Promise.resolve(op.blob) : pedir('imagem', { id: f.id, data: diaria(f.secao) ? f.data : dia, mini }, true))
            .then(b => URL.createObjectURL(b)).catch(e => { imagens.delete(chave); throw e }))
        return imagens.get(chave)
    }
    function carregarImagens(raiz, mini) {
        raiz.querySelectorAll('img[data-foto]').forEach(img => {
            const f = [...estado.fotos, ...fila.filter(o => o.tipo === 'foto')].find(x => x.id === img.dataset.foto)
            if (f) imagemDe(f, mini).then(u => { img.src = u }).catch(() => { img.alt = 'Imagem indisponível agora' })
            img.addEventListener('load', () => {
                img.parentElement.querySelector('svg')?.remove()
                const marcas = f ? marcacoesDe(f) : []
                if (marcas.length) img.insertAdjacentHTML('afterend', svgMarcas(marcas, img.naturalWidth, img.naturalHeight))
            })
        })
    }
    function svgMarcas(marcas, L, A) {
        const t = Math.max(2, L * .0035), r = Math.max(6, L * .024)
        return `<svg viewBox="0 0 ${L} ${A}" preserveAspectRatio="none">${marcas.map(m => {
            if (m.tipo === 'item') {
                const i = estado.atividades.findIndex(a => a.id === m.atividade)
                return `<circle cx="${m.x * L}" cy="${m.y * A}" r="${r}" fill="${i < 0 ? '#8a968f' : CORES[i % CORES.length]}" stroke="#fff" stroke-width="${t / 2}"/><text x="${m.x * L}" y="${m.y * A + r * .38}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${r * 1.1}" fill="#fff">${i < 0 ? '?' : i + 1}</text>`
            }
            const tipo = TIPOS[m.tipo]
            if (!tipo) return ''
            const est = `stroke="${tipo[0] || m.cor}" stroke-width="${t}" fill="none"${tipo[1] ? ` stroke-dasharray="${t * 4} ${t * 3}"` : ''}`
            if (m.tipo === 'camera') return `<circle cx="${m.x * L}" cy="${m.y * A}" r="${Math.max(3, L * .007)}" fill="${tipo[0]}"/>`
            if (m.tipo === 'rack') return `<rect x="${Math.min(m.x1, m.x2) * L}" y="${Math.min(m.y1, m.y2) * A}" width="${Math.abs(m.x2 - m.x1) * L}" height="${Math.abs(m.y2 - m.y1) * A}" ${est}/>`
            return `<polyline points="${m.pontos.map(p => `${p[0] * L},${p[1] * A}`).join(' ')}" ${est}/>`
        }).join('')}</svg>`
    }

    // ---------- tela ----------
    function cabecalho() {
        $('ck-titulo').textContent = estado.titulo
        $('ck-sub').textContent = `${estado.nome} · link até ${new Date(estado.expira).toLocaleDateString('pt-BR')}`
        $('ck-data').value = dia
        const d = new Date(`${dia}T12:00:00`)
        $('ck-dia-texto').textContent = `${dia === hoje() ? 'Hoje, ' : ''}${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} ${br(dia)}`
        $('ck-dia').hidden = false
        $('ck-abas').hidden = false
        document.querySelector('[data-aba="layout"]').hidden = !estado.secoes.some(s => !s.diaria)
        document.querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba))
        const ps = estado.atividades.filter(a => a.previsto > 0).map(a => Math.min(100, numeros(a).percentual))
        const geral = ps.length ? ps.reduce((s, p) => s + p, 0) / ps.length : 0
        document.querySelector('.ck-progresso').hidden = false
        document.querySelector('.ck-progresso i').style.width = `${geral}%`
        document.querySelector('.ck-progresso').title = `${num(Math.round(geral * 10) / 10)}% da obra`
    }
    function desenhar() {
        if (!estado || encerrado) return
        cabecalho()
        ;({ itens: telaItens, fotos: telaFotos, layout: telaLayout, dia: telaDia })[aba]()
    }

    function telaItens() {
        const { executado } = diaDe(dia)
        corpo.innerHTML = `${estado.atividades.length > 8 ? '<input type="search" class="ck-filtro" placeholder="Procurar item…">' : ''}` + estado.atividades.map((a, i) => `
            <article class="ck-cartao ck-item" data-id="${esc(a.id)}" data-nome="${esc(a.descricao.toLowerCase())}">
                <div class="ck-item-topo"><i style="background:${CORES[i % CORES.length]}">${i + 1}</i><b>${esc(a.descricao)}</b></div>
                <div class="ck-barra"><i></i></div>
                <small class="ck-numeros"></small>
                <div class="ck-qtde"><span>Feito neste dia</span>
                    <button type="button" data-passo="-1" aria-label="Menos">−</button>
                    <input type="text" inputmode="decimal" value="${executado[a.id] ? String(executado[a.id]).replace('.', ',') : ''}" placeholder="0" aria-label="Quantidade de ${esc(a.descricao)}">
                    <button type="button" data-passo="1" aria-label="Mais">+</button></div>
            </article>`).join('')
        corpo.querySelectorAll('.ck-item').forEach(numerosDoCartao)
    }
    function numerosDoCartao(cartao) {
        const a = estado.atividades.find(x => x.id === cartao.dataset.id)
        const n = numeros(a)
        cartao.querySelector('.ck-barra i').style.width = `${Math.min(100, n.percentual)}%`
        cartao.querySelector('.ck-numeros').textContent = `${num(n.acumulado)} de ${num(a.previsto)} ${a.unidade || ''} · ${num(Math.round(n.percentual * 10) / 10)}%`
    }
    function mudarQuantidade(cartao, valor, arrumar) {
        const a = estado.atividades.find(x => x.id === cartao.dataset.id)
        const campo = cartao.querySelector('input')
        const { maximo } = numeros(a)
        let v = tres(Math.max(0, Number.isFinite(valor) ? valor : 0))
        if (v > maximo) {
            v = maximo
            arrumar = true
            avisar(`O máximo para este dia é ${num(maximo)}: o previsto é ${num(a.previsto)} ${a.unidade || ''}.`, true)
        }
        if (arrumar) campo.value = v ? String(v).replace('.', ',') : ''
        enfileirar({ tipo: 'salvar', chave: `salvar:${dia}`, data: dia, dados: { executado: { [a.id]: v } } })
        numerosDoCartao(cartao)
        cabecalho()
    }

    function galeriaHtml(fotos) {
        return `<div class="ck-grade">${fotos.map(f => `
            <figure class="ck-foto" data-id="${esc(f.id)}"><div><img data-foto="${esc(f.id)}" alt="Foto"></div>
                <figcaption>${f.pendente ? '<em>enviando…</em>' : diaria(f.secao) ? '' : `<em>${br(f.data)}</em>`}<span>${esc(comentarioDe(f)) || (f.minha ? 'Toque para descrever' : '')}</span></figcaption></figure>`).join('')}</div>`
    }
    function telaFotos() {
        const secoes = estado.secoes.filter(s => s.diaria).map(s => s.secao)
        const fotos = fotosDa(secoes)
        corpo.innerHTML = secoes.length ? `${botoesFoto(secoes[0])}
            <h2>${fotos.length ? `${fotos.length} foto(s) em ${br(dia)}` : `Nenhuma foto em ${br(dia)}`}</h2>${galeriaHtml(fotos)}`
            : '<p class="ck-vazio">Este checklist não tem seção de fotos da execução.</p>'
        carregarImagens(corpo, true)
    }
    const botoesFoto = secao => `<div class="ck-botoes" data-secao="${secao}">
        <button type="button" class="ck-principal" data-acao="camera">Tirar fotos</button>
        <label class="ck-secundario">Galeria<input type="file" accept="image/*" multiple hidden></label></div>
        <label class="ck-aparelho" data-secao="${secao}">A câmera não abriu? Usar a câmera do aparelho<input type="file" accept="image/*" capture="environment" hidden></label>`
    function telaLayout() {
        const secoes = estado.secoes.filter(s => !s.diaria).map(s => s.secao)
        const fotos = fotosDa(secoes)
        corpo.innerHTML = `<h2>Layout e planta</h2>${fotos.length ? '<p class="ck-dica">Toque na imagem para marcar o que foi instalado.</p>' : '<p class="ck-vazio">Ainda não há layout. Você pode enviar a foto de uma planta.</p>'}
            ${galeriaHtml(fotos)}${botoesFoto(secoes[0])}`
        corpo.querySelector('.ck-grade')?.classList.add('ck-larga')
        carregarImagens(corpo, true)
    }
    function telaDia() {
        const d = diaDe(dia)
        corpo.innerHTML = `<div class="ck-cartao ck-form">
            <label>Responsável<input type="text" name="gerente" maxlength="150" value="${esc(d.gerente)}"></label>
            <label>Pessoas na obra<input type="number" name="efetivo" min="0" step="1" inputmode="numeric" value="${esc(d.efetivo)}"></label>
            <label>Horário de trabalho<input type="text" name="horario" maxlength="100" value="${esc(d.horario)}"></label>
            <label>Observações do dia<textarea name="observacoes" rows="5" maxlength="5000">${esc(d.observacoes)}</textarea></label></div>
            <h2>Dias preenchidos</h2><div class="ck-dias">${datas().sort().reverse().map(x => `<button type="button" data-ir="${x}" class="${x === dia ? 'ativa' : ''}">${br(x)}</button>`).join('') || '<small>Nenhum ainda.</small>'}</div>`
    }

    // ---------- fotos ----------
    async function reduzir(arquivo) {
        const url = URL.createObjectURL(arquivo)
        try {
            const img = new Image()
            await new Promise((ok, falha) => { img.onload = ok; img.onerror = () => falha(new Error(`Não foi possível abrir ${arquivo.name}.`)); img.src = url })
            const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight))
            const c = document.createElement('canvas')
            c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
            const ctx = c.getContext('2d')
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
            ctx.drawImage(img, 0, 0, c.width, c.height)
            return await new Promise((ok, falha) => c.toBlob(b => b ? ok(b) : falha(new Error('Não foi possível preparar a foto.')), 'image/jpeg', .85))
        } finally { URL.revokeObjectURL(url) }
    }
    async function incluirFoto(blob, secao, data) {
        const id = uuid()
        await enfileirar({ tipo: 'foto', chave: `foto:${id}`, id, secao, data, comentario: '', blob })
        return id
    }
    async function incluirArquivos(arquivos, secao) {
        const data = dia
        for (const a of arquivos) {
            try { await incluirFoto(await reduzir(a), secao, data) } catch (e) { avisar(e.message, true) }
        }
        desenhar()
    }
    function camera(secao) {
        const data = dia
        abrirCameraGCS({
            titulo: `Fotos de ${br(data)}`,
            aoCapturar: async src => { await incluirFoto(await reduzir(await (await fetch(src)).blob()), secao, data) },
            aoConcluir: n => { desenhar(); if (n) avisar(`${n} foto(s) guardada(s). Toque numa foto para descrever.`) }
        })
    }
    const alterar = corpoOp => enfileirar({ tipo: 'alterar', chave: `alterar:${uuid()}`, corpo: corpoOp })

    async function abrirFoto(id) {
        const pendente = fila.find(o => o.tipo === 'foto' && o.id === id)
        const f = estado.fotos.find(x => x.id === id) || pendente
        if (!f) return
        const minha = !!pendente || f.minha
        const planta = !diaria(f.secao)
        let adicionar = [], apagar = [], modo = 'marcar'
        const tela = document.createElement('div')
        tela.className = 'ck-tela'
        tela.innerHTML = `<div class="ck-tela-topo"><b>${planta ? 'Layout' : 'Foto'} · ${br(dia)}</b><span></span>
                <button type="button" data-z="-">−</button><button type="button" data-z="+">+</button><button type="button" data-fechar>Fechar</button></div>
            <div class="ck-palco"><div class="ck-quadro"><img alt=""><div class="ck-camada"></div></div></div>
            <div class="ck-tela-pe">
                <div class="ck-marcar"><select aria-label="Item a marcar">${estado.atividades.map((a, i) => `<option value="${esc(a.id)}">${i + 1}. ${esc(a.descricao)}</option>`).join('')}</select>
                    <button type="button" data-modo="marcar">Marcar</button><button type="button" data-modo="mover">Mover</button><button type="button" data-modo="apagar">Apagar</button></div>
                ${minha ? `<textarea rows="2" maxlength="1000" placeholder="Descreva: o que é, onde fica, detalhes…">${esc(comentarioDe(f))}</textarea>` : `<p>${esc(comentarioDe(f))}</p>`}
                <div class="ck-botoes">${minha ? '<button type="button" class="ck-apagar" data-remover>Apagar foto</button>' : ''}<button type="button" class="ck-principal" data-salvar>Salvar</button></div>
            </div>`
        document.body.append(tela)
        const img = tela.querySelector('img'), camada = tela.querySelector('.ck-camada'), quadro = tela.querySelector('.ck-quadro')
        // Foto ainda na fila não recebe marcação: o servidor precisa tê-la antes.
        if (pendente) tela.querySelector('.ck-marcar').hidden = true
        const visiveis = () => [...marcacoesDe(f), ...adicionar].filter(m => !apagar.includes(m.id))
        const redesenhar = () => {
            camada.innerHTML = img.naturalWidth ? svgMarcas(visiveis(), img.naturalWidth, img.naturalHeight) : ''
            camada.style.pointerEvents = modo === 'mover' || pendente ? 'none' : ''
            tela.querySelectorAll('[data-modo]').forEach(b => b.classList.toggle('ativa', b.dataset.modo === modo))
            const n = visiveis().filter(m => m.tipo === 'item').length
            tela.querySelector('.ck-tela-topo span').textContent = n ? `${n} ponto(s)` : ''
        }
        if (!planta) modo = 'mover'
        img.onload = redesenhar
        imagemDe(f, false).then(u => { img.src = u }).catch(() => avisar('A imagem não carregou. Confira a internet.', true))
        camada.addEventListener('click', ev => {
            const r = camada.getBoundingClientRect()
            const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))
            if (modo === 'marcar') adicionar.push({ id: uuid(), tipo: 'item', atividade: tela.querySelector('select').value, data: dia, x, y })
            else {
                // Apagar: o ponto mais perto do dedo (até 28 px na tela).
                const perto = visiveis().filter(m => m.x !== undefined).map(m => ({ m, d: Math.hypot((m.x - x) * r.width, (m.y - y) * r.height) })).sort((a, b) => a.d - b.d)[0]
                if (!perto || perto.d > 28) return
                if (adicionar.includes(perto.m)) adicionar = adicionar.filter(m => m !== perto.m)
                else apagar.push(perto.m.id)
            }
            redesenhar()
        })
        const campo = tela.querySelector('textarea'), original = campo?.value
        const mudou = () => adicionar.length || apagar.length || (campo && campo.value.trim() !== original.trim())
        let zoom = 100
        const fechar = () => { tela.remove(); desenhar() }
        tela.addEventListener('click', async ev => {
            const b = ev.target.closest('button')
            if (!b) return
            if (b.dataset.z) { zoom = Math.max(100, Math.min(500, zoom + (b.dataset.z === '+' ? 50 : -50))); quadro.style.width = `${zoom}%` }
            else if (b.dataset.modo) { modo = b.dataset.modo; redesenhar() }
            else if (b.hasAttribute('data-fechar')) { if (!mudou() || await confirmar('Sair sem salvar o que mudou nesta imagem?', 'Sair')) fechar() }
            else if (b.hasAttribute('data-remover')) {
                if (!(await confirmar('Apagar esta foto?', 'Apagar'))) return
                const op = fila.find(o => o.tipo === 'foto' && o.id === id)
                // Ainda na fila e fora de envio: basta não mandar.
                if (op && !enviando) await tirarDaFila(op)
                else await alterar({ id, data: f.data, remover: true })
                fechar()
            } else if (b.hasAttribute('data-salvar')) {
                const comentario = campo && campo.value.trim() !== original.trim() ? campo.value.trim() : undefined
                const op = fila.find(o => o.tipo === 'foto' && o.id === id)
                if (op && !enviando && comentario !== undefined) await enfileirar({ ...op, chave: `foto:${id}`, carimbo: uuid(), comentario })
                else if (comentario !== undefined || adicionar.length || apagar.length)
                    await alterar({ id, data: planta ? dia : f.data, ...(comentario !== undefined ? { comentario } : {}), ...(adicionar.length ? { adicionar } : {}), ...(apagar.length ? { apagar } : {}) })
                fechar()
            }
        })
        redesenhar()
    }
    function confirmar(texto, sim) {
        return new Promise(ok => {
            const d = document.createElement('div')
            d.className = 'ck-confirmar'
            d.innerHTML = `<div><p>${esc(texto)}</p><div class="ck-botoes"><button type="button" class="ck-secundario">Voltar</button><button type="button" class="ck-apagar">${esc(sim)}</button></div></div>`
            const [nao, s] = d.querySelectorAll('button')
            nao.onclick = () => { d.remove(); ok(false) }
            s.onclick = () => { d.remove(); ok(true) }
            document.body.append(d)
        })
    }

    // ---------- eventos ----------
    function irPara(data) {
        if (!/^20\d\d-\d\d-\d\d$/.test(data)) { $('ck-data').value = dia; return }
        document.activeElement?.blur?.()
        dia = data
        desenhar()
    }
    const passo = n => { const d = new Date(`${dia}T12:00:00`); d.setDate(d.getDate() + n); irPara(iso(d)) }
    $('ck-ant').onclick = () => passo(-1)
    $('ck-prox').onclick = () => passo(1)
    $('ck-data').onchange = e => irPara(e.target.value)
    $('ck-abas').onclick = e => { const b = e.target.closest('[data-aba]'); if (b) { document.activeElement?.blur?.(); aba = b.dataset.aba; desenhar(); scrollTo(0, 0) } }
    const lerNumero = v => { const t = v.trim().replace(/\s/g, ''); return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t) }
    corpo.addEventListener('click', e => {
        const p = e.target.closest('[data-passo]')
        if (p) { const c = p.closest('.ck-item'); return mudarQuantidade(c, (lerNumero(c.querySelector('input').value) || 0) + Number(p.dataset.passo), true) }
        const ir = e.target.closest('[data-ir]')
        if (ir) return irPara(ir.dataset.ir)
        if (e.target.closest('[data-acao="camera"]')) return camera(e.target.closest('[data-secao]').dataset.secao)
        const foto = e.target.closest('.ck-foto')
        if (foto) abrirFoto(foto.dataset.id)
    })
    corpo.addEventListener('input', e => {
        if (e.target.matches('.ck-filtro')) {
            const t = e.target.value.toLowerCase().trim()
            return corpo.querySelectorAll('.ck-item').forEach(c => { c.hidden = !c.dataset.nome.includes(t) })
        }
    })
    corpo.addEventListener('change', e => {
        const el = e.target
        if (el.type === 'file') {
            const arquivos = [...el.files]
            el.value = ''
            return incluirArquivos(arquivos, el.closest('[data-secao]').dataset.secao)
        }
        const cartao = el.closest('.ck-item')
        if (cartao) return mudarQuantidade(cartao, lerNumero(el.value), true)
        if (!el.closest('.ck-form')) return
        const valor = el.name === 'efetivo' ? Math.max(0, Math.round(Number(el.value) || 0)) : el.value.trim()
        enfileirar({ tipo: 'salvar', chave: `salvar:${dia}`, data: dia, dados: { executado: {}, [el.name]: valor } })
    })
    addEventListener('online', () => { situacao(); agendarEnvio(300) })
    addEventListener('offline', situacao)
    addEventListener('hashchange', () => location.reload())
    document.addEventListener('visibilitychange', async () => {
        if (document.hidden || !estado || encerrado) return
        if (fila.length) return agendarEnvio(300)
        if (enviando || digitando()) return
        await recarregar().catch(() => {})
        if (!digitando()) desenhar()
    })
    addEventListener('beforeunload', e => { if (fila.length && !banco) e.preventDefault() })

    ;(async () => {
        banco = await abrirBanco()
        if (!codigo) { encerrado = 'Link incompleto. Abra o link inteiro que você recebeu.'; return mostrarEncerrado() }
        const guardadas = await noBanco('fila', 'readonly', s => s.getAll()).catch(() => null)
        fila = (guardadas || []).filter(daqui).sort((a, b) => a.criado - b.criado)
        try { await recarregar() }
        catch (e) {
            estado = await noBanco('estado', 'readonly', s => s.get(codigo)).catch(() => null)
            if (!estado) {
                corpo.innerHTML = `<div class="ck-cartao ck-vazio"><b>Não foi possível abrir agora.</b><p>${esc(e.status ? e.message : 'Confira a internet e tente de novo.')}</p><button type="button" class="ck-principal" onclick="location.reload()">Tentar de novo</button></div>`
                return
            }
            avisar('Sem conexão: mostrando o que estava guardado no aparelho.', true)
        }
        if (encerrado) return mostrarEncerrado()
        desenhar()
        situacao()
        if (fila.length) agendarEnvio(300)
    })()
})()
