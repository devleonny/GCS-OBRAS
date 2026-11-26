// Escolha das colunas do Excel antes de baixar (26/11/2026).
// Usado por baixarExcelRelatorioGCS (js/fiscal.js): todas as telas com "Excel" das caixinhas passam por aqui.
// O usuário marca as colunas, arrasta (ou ↑ ↓) para mudar a ordem e pode salvar com um nome (layout).
// Fica no perfil (preferências: chave excel_layout:<tela>), em qualquer computador:
//   { layouts: [{ nome, colunas: [chave, ...] }], ultimo: nome | null, ultimasColunas: [chave, ...] }
// Ao abrir de novo já vem o último layout usado (ou a última escolha, se baixou sem layout salvo).
// Coluna nova no código entra desmarcada no fim dos layouts antigos.
// Resolve com as colunas escolhidas, na ordem, ou null se fechar/cancelar.

const chaveColunaExcel = c => String(c.id || c.titulo)

function escolherColunasExcel({ tela, titulo, colunas, quantidade = null }) {
    return new Promise(async resolve => {
        const chavePref = `excel_layout:${tela}`
        const pref = { layouts: [], ultimo: null, ultimasColunas: null, ...((await preferenciaUsuario(chavePref, null).catch(() => null)) || {}) }
        if (!Array.isArray(pref.layouts)) pref.layouts = []
        const porChave = new Map(colunas.map(c => [chaveColunaExcel(c), c]))
        const esc = v => escaparAtributo(String(v ?? ''))
        const k = crypto.randomUUID()

        // Ordem + marcadas a partir de uma lista de chaves (as que não estão nela vão desmarcadas no fim).
        const estadoDe = lista => {
            if (!Array.isArray(lista) || !lista.length) return colunas.map(c => ({ chave: chaveColunaExcel(c), marcada: true }))
            const vistas = new Set()
            const ordem = []
            lista.forEach(ch => { if (porChave.has(ch) && !vistas.has(ch)) { vistas.add(ch); ordem.push({ chave: ch, marcada: true }) } })
            colunas.forEach(c => { const ch = chaveColunaExcel(c); if (!vistas.has(ch)) ordem.push({ chave: ch, marcada: false }) })
            return ordem.some(o => o.marcada) ? ordem : colunas.map(c => ({ chave: chaveColunaExcel(c), marcada: true }))
        }
        const layoutPorNome = nome => pref.layouts.find(l => l.nome === nome)
        let layoutAtual = layoutPorNome(pref.ultimo) ? pref.ultimo : ''
        let estado = estadoDe(layoutAtual ? layoutPorNome(layoutAtual).colunas : pref.ultimasColunas)

        const id = popup({
            titulo: `Excel · ${titulo}`,
            modal: true,
            elemento: `
                <div class="xl-layout" id="xl-${k}">
                    <div class="xl-topo">
                        <label class="xl-campo">
                            <span>Layout</span>
                            <select data-acao="layout"></select>
                        </label>
                        <div class="xl-botoes-layout">
                            <button type="button" data-acao="salvar" title="Grava as colunas e a ordem atuais no layout escolhido">Salvar</button>
                            <button type="button" data-acao="novo" title="Cria um layout novo com as colunas e a ordem atuais">Salvar como…</button>
                            <button type="button" data-acao="renomear" title="Troca o nome do layout escolhido">Renomear</button>
                            <button type="button" data-acao="excluir" class="xl-perigo" title="Apaga o layout escolhido">Excluir</button>
                        </div>
                    </div>
                    <div class="xl-barra">
                        <span class="xl-contador"></span>
                        <span class="xl-links">
                            <button type="button" data-acao="todas">Marcar todas</button>
                            <button type="button" data-acao="nenhuma">Desmarcar todas</button>
                            <button type="button" data-acao="original" title="Volta à ordem da tela, com todas marcadas">Ordem original</button>
                        </span>
                    </div>
                    <ol class="xl-lista"></ol>
                    <small class="xl-dica">Arraste pela alça <b>⋮⋮</b> ou use as setas para mudar a ordem. A ordem da lista é a ordem das colunas no Excel.</small>
                </div>`,
            botoes: [
                { id: `xl-cancelar-${k}`, texto: 'Cancelar', img: 'cancel' },
                { id: `xl-baixar-${k}`, texto: quantidade != null ? `Baixar Excel (${quantidade} linha${quantidade === 1 ? '' : 's'})` : 'Baixar Excel', img: 'excel' }
            ]
        })
        const raiz = document.getElementById(`xl-${k}`)
        const lista = raiz.querySelector('.xl-lista')
        const seletor = raiz.querySelector('[data-acao="layout"]')

        const desenharLayouts = () => {
            seletor.innerHTML = `<option value="">— Sem layout salvo —</option>` +
                pref.layouts.map(l => `<option value="${esc(l.nome)}"${l.nome === layoutAtual ? ' selected' : ''}>${esc(l.nome)}</option>`).join('')
            raiz.querySelectorAll('[data-acao="salvar"], [data-acao="renomear"], [data-acao="excluir"]').forEach(b => { b.disabled = !layoutAtual })
        }
        const desenharLista = () => {
            lista.innerHTML = estado.map((o, i) => `
                <li class="xl-item${o.marcada ? '' : ' xl-desmarcada'}" draggable="true" data-i="${i}">
                    <span class="xl-alca" title="Arrastar">⋮⋮</span>
                    <label><input type="checkbox" ${o.marcada ? 'checked' : ''} data-i="${i}"><span>${esc(porChave.get(o.chave).titulo)}</span></label>
                    <span class="xl-setas">
                        <button type="button" data-mover="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
                        <button type="button" data-mover="1" data-i="${i}" ${i === estado.length - 1 ? 'disabled' : ''} title="Descer">↓</button>
                    </span>
                </li>`).join('')
            const n = estado.filter(o => o.marcada).length
            raiz.querySelector('.xl-contador').textContent = `${n} de ${estado.length} coluna(s) marcada(s)`
            document.getElementById(`xl-baixar-${k}`)?.classList.toggle('xl-desligado', !n)
        }
        desenharLayouts()
        desenharLista()

        const marcadasAtuais = () => estado.filter(o => o.marcada).map(o => o.chave)
        const gravar = () => salvarPreferenciaUsuario(chavePref, { layouts: pref.layouts, ultimo: pref.ultimo, ultimasColunas: pref.ultimasColunas })
        const pedirNome = async (valor = '') => {
            const nome = await pedirTextoPopup({ titulo: 'Nome do layout', mensagem: 'Como quer chamar este layout?', textoConfirmar: 'Salvar', minimo: 1, maximo: 60, valor })
            return nome ? nome.trim() : null
        }

        raiz.addEventListener('change', e => {
            if (e.target === seletor) {
                layoutAtual = seletor.value
                if (layoutAtual) estado = estadoDe(layoutPorNome(layoutAtual)?.colunas)
                desenharLayouts()
                desenharLista()
                return
            }
            const i = Number(e.target.dataset.i)
            if (e.target.type === 'checkbox' && estado[i]) {
                estado[i].marcada = e.target.checked
                desenharLista()
            }
        })

        raiz.addEventListener('click', async e => {
            const botao = e.target.closest('button')
            if (!botao) return
            if (botao.dataset.mover) {
                const i = Number(botao.dataset.i), j = i + Number(botao.dataset.mover)
                if (j < 0 || j >= estado.length) return
                ;[estado[i], estado[j]] = [estado[j], estado[i]]
                desenharLista()
                lista.querySelector(`button[data-mover="${botao.dataset.mover}"][data-i="${j}"]`)?.focus()
                return
            }
            const acao = botao.dataset.acao
            if (acao === 'todas' || acao === 'nenhuma') {
                estado.forEach(o => { o.marcada = acao === 'todas' })
                desenharLista()
            } else if (acao === 'original') {
                estado = colunas.map(c => ({ chave: chaveColunaExcel(c), marcada: true }))
                desenharLista()
            } else if (acao === 'salvar' && layoutAtual) {
                if (!marcadasAtuais().length) return popup({ mensagem: 'Marque pelo menos uma coluna.' })
                layoutPorNome(layoutAtual).colunas = marcadasAtuais()
                pref.ultimo = layoutAtual
                await gravar()
                popup({ mensagem: `Layout <b>${esc(layoutAtual)}</b> salvo.`, imagem: 'imagens/concluido.png' })
            } else if (acao === 'novo') {
                if (!marcadasAtuais().length) return popup({ mensagem: 'Marque pelo menos uma coluna.' })
                const nome = await pedirNome()
                if (!nome) return
                const existente = layoutPorNome(nome)
                if (existente && !(await confirmarPopup({ titulo: 'Layout já existe', mensagem: `Já existe o layout <b>${esc(nome)}</b>. Substituir?`, textoConfirmar: 'Substituir' }))) return
                if (existente) existente.colunas = marcadasAtuais()
                else pref.layouts.push({ nome, colunas: marcadasAtuais() })
                pref.layouts.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                layoutAtual = pref.ultimo = nome
                await gravar()
                desenharLayouts()
                popup({ mensagem: `Layout <b>${esc(nome)}</b> salvo.`, imagem: 'imagens/concluido.png' })
            } else if (acao === 'renomear' && layoutAtual) {
                const nome = await pedirNome(layoutAtual)
                if (!nome || nome === layoutAtual) return
                if (layoutPorNome(nome)) return popup({ mensagem: `Já existe o layout <b>${esc(nome)}</b>.` })
                layoutPorNome(layoutAtual).nome = nome
                if (pref.ultimo === layoutAtual) pref.ultimo = nome
                layoutAtual = nome
                pref.layouts.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                await gravar()
                desenharLayouts()
            } else if (acao === 'excluir' && layoutAtual) {
                if (!(await confirmarPopup({ titulo: 'Excluir layout', mensagem: `Excluir o layout <b>${esc(layoutAtual)}</b>?`, textoConfirmar: 'Excluir' }))) return
                pref.layouts = pref.layouts.filter(l => l.nome !== layoutAtual)
                if (pref.ultimo === layoutAtual) pref.ultimo = null
                layoutAtual = ''
                await gravar()
                desenharLayouts()
            }
        })

        // Arrastar para reordenar.
        let arrastando = null
        lista.addEventListener('dragstart', e => {
            const li = e.target.closest('.xl-item')
            if (!li) return
            arrastando = Number(li.dataset.i)
            li.classList.add('xl-arrastando')
            e.dataTransfer.effectAllowed = 'move'
            try { e.dataTransfer.setData('text/plain', String(arrastando)) } catch { }
        })
        lista.addEventListener('dragover', e => {
            if (arrastando == null) return
            e.preventDefault()
            const li = e.target.closest('.xl-item')
            lista.querySelectorAll('.xl-alvo-antes, .xl-alvo-depois').forEach(x => x.classList.remove('xl-alvo-antes', 'xl-alvo-depois'))
            if (!li) return
            const r = li.getBoundingClientRect()
            li.classList.add(e.clientY < r.top + r.height / 2 ? 'xl-alvo-antes' : 'xl-alvo-depois')
        })
        lista.addEventListener('drop', e => {
            e.preventDefault()
            const li = e.target.closest('.xl-item')
            if (arrastando == null || !li) return
            const r = li.getBoundingClientRect()
            let destino = Number(li.dataset.i) + (e.clientY < r.top + r.height / 2 ? 0 : 1)
            const [item] = estado.splice(arrastando, 1)
            if (destino > arrastando) destino--
            estado.splice(destino, 0, item)
            arrastando = null
            desenharLista()
        })
        lista.addEventListener('dragend', () => {
            arrastando = null
            lista.querySelectorAll('.xl-arrastando, .xl-alvo-antes, .xl-alvo-depois').forEach(x => x.classList.remove('xl-arrastando', 'xl-alvo-antes', 'xl-alvo-depois'))
        })

        let finalizado = false
        const observador = new MutationObserver(() => { if (!document.getElementById(id)) finalizar(null) })
        function finalizar(resultado) {
            if (finalizado) return
            finalizado = true
            observador.disconnect()
            removerPopup(id)
            resolve(resultado)
        }
        document.getElementById(`xl-cancelar-${k}`).addEventListener('click', () => finalizar(null))
        document.getElementById(`xl-baixar-${k}`).addEventListener('click', () => {
            const escolhidas = marcadasAtuais()
            if (!escolhidas.length) return popup({ mensagem: 'Marque pelo menos uma coluna.' })
            pref.ultimo = layoutAtual || null
            pref.ultimasColunas = escolhidas
            gravar()
            finalizar(escolhidas.map(ch => porChave.get(ch)))
        })
        observador.observe(document.body, { childList: true })
    })
}
