// Comprovantes do Itaú nas Faturas a pagar (25/11/2026). Botão "Comprovantes Itaú" na barra da lista.
// O PDF do banco (uma página por comprovante) sobe pelo /upload; o servidor divide em páginas, lê cada uma e
// sugere a fatura (SCRIPTS/financeiro_comprovantes.js): fatura em aberto → paga e anexa; pagamento já lançado
// sem comprovante → só anexa. Nada é gravado antes de "Aplicar": a pessoa confere, troca ou busca outra fatura.
// O comprovante fica no pagamento (fin_baixas.comprovante) e a coluna "Comprovante" da lista mostra quem tem.

let comprovantesFin = null // { arquivo, paginas: [...], aplicado: bool }

function botaoComprovantesFin() {
    return `<label class="fin-barra-arquivo" title="PDF do Itaú com um comprovante por página: divide, acha a fatura de cada um, paga e anexa">
        ${iconeFin('anexo')} Comprovantes Itaú<input type="file" accept="application/pdf,.pdf" hidden onchange="lerComprovantesFin(this)"></label>`
}

async function lerComprovantesFin(input) {
    const arquivo = input.files?.[0]
    if (!arquivo) return
    if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== 'application/pdf') {
        input.value = ''
        return popup({ mensagem: 'Escolha o PDF dos comprovantes.' })
    }
    overlayAguarde()
    try {
        const enviados = await importarAnexos({ input })
        const enviado = Array.isArray(enviados) ? enviados[0] : null
        if (!enviado?.link) throw new Error('Falha ao enviar o PDF.')
        const [{ paginas }] = await Promise.all([
            apiFin('comprovantes/ler', { link: enviado.link, nome: arquivo.name }),
            carregarOpcoesFin()
        ])
        comprovantesFin = { arquivo: arquivo.name, paginas, aplicado: false }
        paginas.forEach(p => {
            p.sel = p.escolha ? p.candidatos.find(c => c.titulo_id === p.escolha.titulo_id && (c.baixa_id || null) === (p.escolha.baixa_id || null)) || null : null
            p.marcada = Boolean(p.sel)
            p.data = p.dados.data || ''
            p.valor = p.dados.valor ?? ''
            p.diferenca = 'PARCIAL'
            p.conta_id = p.sel?.conta_id || ''
        })
        desenharComprovantesFin()
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    } finally {
        removerOverlay()
        input.value = ''
    }
}

const chaveCandidatoFin = c => c ? (c.baixa_id ? `b${c.baixa_id}` : `t${c.titulo_id}`) : ''

// Outras páginas que já ficaram com a mesma fatura/pagamento (marcadas).
function repetidoComprovanteFin(p) {
    const k = chaveCandidatoFin(p.sel)
    return k && comprovantesFin.paginas.some(o => o !== p && o.marcada && chaveCandidatoFin(o.sel) === k)
}

function desenharComprovantesFin() {
    const c = comprovantesFin
    if (!c) return
    const ps = c.paginas
    const conta = f => ps.filter(f).length
    const resumo = [
        ['Páginas', ps.length, ''],
        ['Pagar e anexar', conta(p => p.marcada && p.sel?.acao === 'PAGAR'), 'ok'],
        ['Só anexar (já pagas)', conta(p => p.marcada && p.sel?.acao === 'ANEXAR'), 'ok'],
        ['Sem fatura escolhida', conta(p => !p.sel && !p.duplicado && !p.resultado?.ok), 'alerta'],
        ['Já anexados antes', conta(p => p.duplicado), '']
    ]
    tela.innerHTML = `
        <div class="fis-pagina fin-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Comprovantes do Itaú <small class="fin-comp-arquivo">${escFin(c.arquivo)}</small></h2>
                    <div class="fin-barra">
                        <button type="button" onclick="telaFaturasFin('PAGAR', null, true)">${iconeFin('voltar')} Voltar às faturas</button>
                        ${c.aplicado ? '' : `<button type="button" class="fin-barra-forte" onclick="aplicarComprovantesFin()">${iconeFin('check')} Aplicar marcadas</button>`}
                    </div>
                </header>
                <div class="fin-comp-corpo">
                    <div class="fin-comp-resumo">${resumo.map(([t, n, cls]) => `<div class="fin-comp-cartao ${cls}"><small>${t}</small><b>${n}</b></div>`).join('')}</div>
                    <small class="fis-dica">Cada página foi lida e casada pelo valor, CPF/CNPJ, chave Pix, código de barras, nome e data. As claras já vêm marcadas; confira, troque pela lista ou use "Buscar" para achar outra fatura. Nada é gravado até "Aplicar marcadas".</small>
                    <div class="fis-tabela-rolagem fin-comp-tabela">
                        <table class="fis-tabela">
                            <thead><tr>
                                <th><input type="checkbox" ${c.aplicado ? 'disabled' : ''} onchange="marcarTodosComprovantesFin(this.checked)" aria-label="Marcar todas"></th>
                                <th>Pág.</th><th>Comprovante lido</th><th>Fatura / pagamento</th><th>Pagamento</th><th>Situação</th>
                            </tr></thead>
                            <tbody>${ps.map((p, i) => linhaComprovanteFin(p, i)).join('')}</tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>`
}

function descreverCandidatoFin(o) {
    const nome = o.nome || '(sem nome)'
    return o.acao === 'ANEXAR'
        ? `Anexar ao pagamento de ${dataFin(o.data)} · ${nome} · ${dinheiroTexto(o.total)} · ${o.app}`
        : `Pagar · ${nome} · vence ${dataFin(o.vencimento)} · ${dinheiroTexto(o.saldo)} · ${o.app}${o.parcela_texto && o.parcela_texto !== '1/1' ? ` · ${o.parcela_texto}` : ''}`
}

function linhaComprovanteFin(p, i) {
    const d = p.dados || {}
    const travada = comprovantesFin.aplicado || p.resultado?.ok
    const doc = d.documento ? docFormatadoFis(d.documento) : d.documento_mascara ? escFin(d.documento_mascara) : ''
    const avisos = [
        p.sem_texto ? 'Página sem texto (imagem): escolha a fatura e informe valor e data.' : '',
        d.agendamento ? 'Comprovante de AGENDAMENTO: o pagamento pode ainda não ter saído.' : '',
        p.duplicado ? `Este comprovante já está no pagamento da fatura ${escFin(p.duplicado.titulo_id)} (${escFin(p.duplicado.nome || '')}).` : '',
        !p.banco && (d.agencia || d.conta) ? `Conta ${escFin(d.agencia || '')}/${escFin(d.conta || '')} não está ligada na Conciliação: escolha a conta corrente.` : '',
        repetidoComprovanteFin(p) ? 'A mesma fatura está escolhida em outra página.' : ''
    ].filter(Boolean)
    const opcoes = p.candidatos || []
    const sel = p.sel
    let pagamento = ''
    if (sel?.acao === 'PAGAR') {
        const op = opcoesFinCache || { contas: [] }
        const contas = op.contas.filter(k => contaAceitaFin(k, sel.app) && k.tipo !== 'CARTAO')
        const diferenca = r2Fin(Number(p.valor) - Number(sel.saldo))
        pagamento = `
            <div class="fin-comp-pag">
                <label><span>Data</span><input class="fis-input" type="date" max="${hojeFin()}" value="${escFin(p.data)}" ${travada ? 'disabled' : ''} onchange="campoComprovanteFin(${i}, 'data', this.value)"></label>
                <label><span>Valor pago</span><input class="fis-input fis-num" type="number" step="0.01" min="0.01" value="${escFin(p.valor)}" ${travada ? 'disabled' : ''} onchange="campoComprovanteFin(${i}, 'valor', this.value)"></label>
                <label class="fin-comp-conta"><span>Conta corrente</span><select class="fis-input" ${travada ? 'disabled' : ''} onchange="campoComprovanteFin(${i}, 'conta_id', this.value)">
                    <option value="">A da fatura / padrão</option>
                    ${contas.map(k => `<option value="${k.id}" ${String(k.id) === String(p.conta_id) ? 'selected' : ''}>${escFin(k.app !== sel.app ? `${k.app} · ${k.nome}` : k.nome)}</option>`).join('')}
                </select></label>
            </div>
            ${diferenca > 0.004 ? `<small class="fin-comp-dif">Pagou ${dinheiro(diferenca)} a mais: entra como juros.</small>` : ''}
            ${diferenca < -0.004 ? `<small class="fin-comp-dif">Pagou ${dinheiro(-diferenca)} a menos:
                <select ${travada ? 'disabled' : ''} onchange="campoComprovanteFin(${i}, 'diferenca', this.value)">
                    <option value="PARCIAL" ${p.diferenca === 'PARCIAL' ? 'selected' : ''}>pagamento parcial (fica faltando)</option>
                    <option value="DESCONTO" ${p.diferenca === 'DESCONTO' ? 'selected' : ''}>quita com desconto</option>
                </select></small>` : ''}`
    } else if (sel?.acao === 'ANEXAR') {
        pagamento = `<small>Pagamento já lançado em <b>${dataFin(sel.data)}</b> · ${escFin(sel.conta || '')} · ${dinheiro(sel.total)}.<br>Só anexa o comprovante.</small>`
    }
    const r = p.resultado
    const situacao = r
        ? r.ok ? `<span class="fin-comp-ok">✓ ${r.acao === 'ANEXAR' ? 'Anexado' : r.parcial ? 'Pago em parte e anexado' : 'Pago e anexado'}</span>`
            : `<span class="fin-comp-erro">✗ ${escFin(r.motivo)}</span>`
        : sel ? `<small>${escFin((sel.motivos || []).join(', ') || 'escolhida à mão')}</small>` : ''
    return `
        <tr class="${r?.ok ? 'fin-comp-feita' : ''}${p.duplicado ? ' fin-comp-dup' : ''}">
            <td><input type="checkbox" ${p.marcada ? 'checked' : ''} ${travada || !sel ? 'disabled' : ''} onchange="campoComprovanteFin(${i}, 'marcada', this.checked)" aria-label="Aplicar esta página"></td>
            <td class="fin-centro"><button type="button" class="fis-mini" title="Abrir a página" onclick="abrirArquivo('${escFin(p.link)}', '${escFin(p.nome)}')">${p.pagina}</button></td>
            <td class="fin-comp-lido">
                <b>${escFin(d.favorecido || '(favorecido não lido)')}</b>
                <span>${[d.tipo && d.tipo !== 'OUTRO' ? d.tipo : '', doc, d.data ? dataFin(d.data) : ''].filter(Boolean).join(' · ')}</span>
                <strong>${d.valor != null ? dinheiro(d.valor) : 'valor não lido'}</strong>
                ${avisos.map(a => `<small class="fin-comp-aviso">${a}</small>`).join('')}
            </td>
            <td class="fin-comp-fatura">
                <div class="fin-comp-escolha">
                    <select class="fis-input" ${travada ? 'disabled' : ''} onchange="escolherComprovanteFin(${i}, this.value)">
                        <option value="">${opcoes.length ? '— escolha —' : 'Nenhuma fatura com esse valor'}</option>
                        ${opcoes.map(o => `<option value="${chaveCandidatoFin(o)}" ${chaveCandidatoFin(o) === chaveCandidatoFin(sel) ? 'selected' : ''}>${escFin(descreverCandidatoFin(o))}</option>`).join('')}
                    </select>
                    ${travada ? '' : `<button type="button" class="fis-mini" onclick="buscarFaturaComprovanteFin(${i})">Buscar</button>`}
                </div>
                ${sel?.observacao ? `<small class="fin-comp-obs" title="${escFin(sel.observacao)}">${escFin(sel.observacao)}</small>` : ''}
            </td>
            <td>${pagamento}</td>
            <td>${situacao}</td>
        </tr>`
}

function escolherComprovanteFin(i, chave) {
    const p = comprovantesFin.paginas[i]
    p.sel = (p.candidatos || []).find(o => chaveCandidatoFin(o) === chave) || null
    p.marcada = Boolean(p.sel)
    p.conta_id = p.sel?.conta_id || ''
    desenharComprovantesFin()
}

function campoComprovanteFin(i, campo, valor) {
    comprovantesFin.paginas[i][campo] = valor
    desenharComprovantesFin()
}

function marcarTodosComprovantesFin(marcar) {
    comprovantesFin.paginas.forEach(p => { if (p.sel && !p.resultado?.ok) p.marcada = marcar })
    desenharComprovantesFin()
}

// Busca manual (nome, CPF/CNPJ, observação, valor): faturas em aberto e pagamentos sem comprovante.
function buscarFaturaComprovanteFin(i) {
    const p = comprovantesFin.paginas[i]
    const d = p.dados || {}
    const inicial = (d.favorecido || '').split(' ').filter(x => x.length > 2).slice(0, 2).join(' ')
    popup({
        titulo: `Buscar fatura · página ${p.pagina}`,
        elemento: `
            <div class="fis-form fin-comp-busca" data-busca-comp="${i}">
                <div class="fin-comp-resumo-busca"><b>${escFin(d.favorecido || '')}</b> ${d.valor != null ? dinheiro(d.valor) : ''} ${d.data ? `· ${dataFin(d.data)}` : ''}</div>
                <input class="fis-input" placeholder="Nome, CPF/CNPJ, observação ou valor (1.234,56)" value="${escFin(inicial)}"
                    oninput="clearTimeout(this._t); this._t = setTimeout(() => resultadosBuscaComprovanteFin(this), 350)">
                <div class="fin-comp-resultados" data-resultados-comp><small class="fin-vazio">Digite para buscar.</small></div>
            </div>`
    })
    const campo = document.querySelector(`[data-busca-comp="${i}"] input`)
    campo?.focus()
    if (inicial) resultadosBuscaComprovanteFin(campo)
}

async function resultadosBuscaComprovanteFin(campo) {
    const caixa = campo.closest('[data-busca-comp]')
    const i = Number(caixa.dataset.buscaComp)
    const p = comprovantesFin.paginas[i]
    const alvo = caixa.querySelector('[data-resultados-comp]')
    const busca = campo.value.trim()
    if (!busca) { alvo.innerHTML = '<small class="fin-vazio">Digite para buscar.</small>'; return }
    alvo.innerHTML = '<small class="fin-vazio">Buscando…</small>'
    try {
        const { opcoes } = await apiFin('comprovantes/buscar', { busca, valor: p.dados?.valor || 0 })
        if (campo.value.trim() !== busca) return
        caixa._opcoes = opcoes
        alvo.innerHTML = opcoes.length
            ? opcoes.map((o, k) => `<button type="button" class="fin-comp-opcao" onclick="usarBuscaComprovanteFin(this, ${k})">
                <b>${escFin(o.acao === 'ANEXAR' ? 'Já paga · só anexar' : 'Em aberto · pagar')}</b>
                <span>${escFin(descreverCandidatoFin(o))}</span>
                ${o.observacao ? `<small>${escFin(o.observacao)}</small>` : ''}</button>`).join('')
            : '<small class="fin-vazio">Nada encontrado.</small>'
    } catch (err) {
        alvo.innerHTML = `<small class="fin-comp-erro">${escFin(mensagemErroEst(err))}</small>`
    }
}

function usarBuscaComprovanteFin(botao, k) {
    const caixa = botao.closest('[data-busca-comp]')
    const p = comprovantesFin.paginas[Number(caixa.dataset.buscaComp)]
    const o = { ...caixa._opcoes[k], motivos: ['escolhida à mão'] }
    if (o.acao === 'PAGAR') {
        const banco = p.banco?.contas?.find(x => x.app === o.app)
        o.conta_id = banco?.id || o.conta_id || null
    }
    p.candidatos = [o, ...(p.candidatos || []).filter(x => chaveCandidatoFin(x) !== chaveCandidatoFin(o))]
    p.sel = o
    p.marcada = true
    p.conta_id = o.conta_id || ''
    removerPopup(botao.closest('.popup')?.id)
    desenharComprovantesFin()
}

async function aplicarComprovantesFin() {
    const ps = comprovantesFin.paginas.filter(p => p.marcada && p.sel && !p.resultado?.ok)
    if (!ps.length) return popup({ mensagem: 'Marque ao menos uma página com fatura escolhida.' })
    const repetidas = ps.filter(repetidoComprovanteFin)
    if (repetidas.length) return popup({ mensagem: `A mesma fatura está em mais de uma página (págs. ${repetidas.map(p => p.pagina).join(', ')}). Deixe só uma.` })
    const pagar = ps.filter(p => p.sel.acao === 'PAGAR')
    const semDados = pagar.filter(p => !p.data || !(Number(p.valor) > 0))
    if (semDados.length) return popup({ mensagem: `Informe data e valor nas págs. ${semDados.map(p => p.pagina).join(', ')}.` })
    const ok = await confirmarPopup({
        titulo: 'Aplicar comprovantes',
        mensagem: `${pagar.length ? `<b>${pagar.length}</b> fatura(s) serão pagas com o comprovante anexado. ` : ''}${ps.length - pagar.length ? `<b>${ps.length - pagar.length}</b> pagamento(s) já lançados recebem o comprovante.` : ''}`,
        textoConfirmar: 'Aplicar'
    })
    if (!ok) return
    overlayAguarde()
    try {
        const { resultados } = await apiFin('comprovantes/aplicar', {
            itens: ps.map(p => ({
                pagina: p.pagina, link: p.link, nome: p.nome, dados: p.dados, acao: p.sel.acao,
                titulo_id: p.sel.titulo_id, baixa_id: p.sel.baixa_id || null,
                conta_id: p.conta_id || null, data: p.data, valor: Number(p.valor), diferenca: p.diferenca
            }))
        })
        for (const r of resultados) {
            const p = comprovantesFin.paginas.find(x => x.pagina === r.pagina)
            if (p) p.resultado = r
        }
        const falhas = resultados.filter(r => !r.ok).length
        comprovantesFin.aplicado = !comprovantesFin.paginas.some(p => p.marcada && p.sel && !p.resultado?.ok)
        desenharComprovantesFin()
        popup({
            titulo: 'Comprovantes',
            mensagem: `<b>${resultados.length - falhas} página(s) aplicada(s).</b>${falhas ? `<br>${falhas} ficaram de fora: o motivo está na coluna Situação.` : ''}`,
            imagem: falhas ? undefined : 'imagens/concluido.png'
        })
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    } finally {
        removerOverlay()
    }
}

// ---------------- comprovante avulso num pagamento (aba Pagamentos da fatura)
async function anexarComprovanteBaixaFin(input, baixaId, tituloId) {
    if (!input.files?.length) return
    overlayAguarde()
    try {
        const enviados = await importarAnexos({ input })
        const a = Array.isArray(enviados) ? enviados[0] : null
        if (!a?.link) throw new Error('Falha ao enviar o arquivo.')
        await apiFin('comprovantes/anexar', { baixa_id: baixaId, anexo: { nome: a.nome || a.link, link: a.link } })
        posAcaoFaturaFin(tituloId)
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    } finally {
        removerOverlay()
        input.value = ''
    }
}

async function tirarComprovanteBaixaFin(baixaId, tituloId) {
    const ok = await confirmarPopup({ titulo: 'Tirar comprovante', mensagem: 'O pagamento continua; só o comprovante sai dele.', textoConfirmar: 'Tirar' })
    if (!ok) return
    try {
        overlayAguarde()
        await apiFin('comprovantes/anexar', { baixa_id: baixaId, anexo: null })
        posAcaoFaturaFin(tituloId)
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    } finally {
        removerOverlay()
    }
}

// Célula "Comprovante" da aba Pagamentos.
function celulaComprovanteBaixaFin(b, tituloId) {
    if (b.estornada) return b.comprovante ? `<button type="button" class="fis-mini" onclick="abrirArquivo('${escFin(b.comprovante.link)}', '${escFin(b.comprovante.nome || '')}')">Ver</button>` : ''
    const id = escFin(b.id), t = escFin(tituloId)
    return b.comprovante
        ? `<span class="fin-comp-celula">
              <button type="button" class="fis-mini" title="${escFin(b.comprovante.nome || '')}" onclick="abrirArquivo('${escFin(b.comprovante.link)}', '${escFin(b.comprovante.nome || '')}')">${iconeFin('anexo')} Ver</button>
              <button type="button" class="fis-mini" title="Tirar o comprovante" onclick="tirarComprovanteBaixaFin('${id}', '${t}')">×</button></span>`
        : `<label class="fis-mini fin-comp-anexar" title="Anexar o comprovante deste pagamento">${iconeFin('anexo')} Anexar
              <input type="file" hidden onchange="anexarComprovanteBaixaFin(this, '${id}', '${t}')"></label>`
}

// Coluna "Comprovante" da lista de faturas.
function colunaComprovanteFin(d) {
    if (d.comprovante === 'SIM') return '<span class="fin-comp-tem" title="Todos os pagamentos têm comprovante" aria-label="Com comprovante">✓</span>'
    if (d.comprovante === 'NÃO') return '<span class="fin-comp-falta" title="Pagamento sem comprovante" aria-label="Sem comprovante">✗</span>'
    return ''
}
