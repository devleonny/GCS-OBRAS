// Remessas a retornar (gcs: migrations/fiscal-remessas-retorno.sql, rotas /fiscal/remessas*).
// Demonstração (60 dias, Ajuste SINIEF 02/2018), conserto (180 dias) e comodato/locação (prazo do contrato).
// Remessa não é faturamento: não entra no saldo do orçamento, mas o bem tem que voltar; estourado o
// prazo, o ICMS suspenso fica devido. O retorno se liga sozinho quando a nota do destinatário (Recebidas)
// ou a nossa NF-e de entrada referencia a chave da remessa; sem nota, baixa com motivo.
// Lembretes: gcs SCRIPTS/notificacoes.js (fonte remessas) para adm e fin.

const TIPOS_REMESSA = {
    DEMONSTRACAO: { texto: 'Demonstração', prazo: '60 dias', cor: '#2563eb' },
    CONSERTO: { texto: 'Conserto', prazo: '180 dias', cor: '#0d9488' },
    COMODATO: { texto: 'Comodato / locação', prazo: 'prazo do contrato', cor: '#7c3aed' }
}
const PRAZOS_REMESSA = {
    VENCIDA: { texto: 'Vencida', cor: '#b91c1c' },
    A_VENCER: { texto: 'Vence em até 15 dias', cor: '#d97706' },
    SEM_PRAZO: { texto: 'Sem prazo', cor: '#7c3aed' },
    NO_PRAZO: { texto: 'No prazo', cor: '#15803d' },
    ENCERRADA: { texto: 'Encerrada', cor: '#64748b' }
}
const SITUACOES_REMESSA = {
    PENDENTE: { texto: 'Pendente', cor: '#d97706' },
    PARCIAL: { texto: 'Retorno parcial', cor: '#2563eb' },
    RETORNADA: { texto: 'Retornou', cor: '#15803d' },
    BAIXADA: { texto: 'Baixada', cor: '#64748b' },
    CANCELADA: { texto: 'Nota cancelada', cor: '#64748b' }
}
const BAIXAS_REMESSA = {
    RETORNOU_SEM_NOTA: 'O bem voltou sem nota de retorno',
    VENDIDA: 'Virou venda (nota de venda emitida)',
    PERDA: 'Perda, roubo ou avaria',
    OUTRO: 'Outro motivo'
}

const estadoRemessas = { situacao: 'ABERTAS', tipo: '', prazo: '', busca: '', lista: [], resumo: [], timer: null }
const podeEditarRemessas = () => pode('vendas.remessas.editar')
const escRem = v => escaparAtributo(v ?? '')
const dataRem = v => v ? new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : ''
// O departamento de algumas notas do Omie vem como o texto 'null'.
const orcRem = r => { const o = String(r?.orcamento ?? '').trim(); return o && o.toLowerCase() !== 'null' ? o : '' }

async function telaRemessasRetorno(abrirId = null) {
    // Tudo num quadro branco (a página tem fundo escuro): contadores, filtros e a lista.
    const situacoes = [['ABERTAS', 'Abertas'], ['ENCERRADAS', 'Encerradas'], ['TODAS', 'Todas']]
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>Remessas a retornar</h2></div>
            <div class="rem-quadro">
                <div class="fis-cartoes rem-cartoes" data-cartoes-remessas></div>
                <div class="rem-filtros">
                    <div class="rem-segmentos">
                        ${situacoes.map(([k, t]) => `<button type="button" class="${estadoRemessas.situacao === k ? 'ativo' : ''}"
                            onclick="estadoRemessas.situacao = '${k}'; telaRemessasRetorno()">${t}</button>`).join('')}
                    </div>
                    <select class="fis-input" onchange="estadoRemessas.tipo = this.value; carregarRemessas()">
                        ${opcoesFis([['', 'Todos os tipos'], ...Object.entries(TIPOS_REMESSA).map(([k, t]) => [k, t.texto])], estadoRemessas.tipo)}
                    </select>
                    <input class="fis-input rem-busca" placeholder="Nº, destinatário, CNPJ, ORC ou item…" value="${escRem(estadoRemessas.busca)}"
                        oninput="clearTimeout(estadoRemessas.timer); estadoRemessas.busca = this.value; estadoRemessas.timer = setTimeout(carregarRemessas, 400)">
                </div>
                <small class="rem-explica">
                    Demonstração volta em <b>60 dias</b>, conserto em <b>180 dias</b> e comodato/locação no fim do contrato.
                    Sem retorno no prazo, o ICMS suspenso fica devido com multa e juros. Remessa não conta como faturamento.
                </small>
                <div data-lista-remessas></div>
            </div>
        </div>`
    await carregarRemessas()
    if (abrirId) abrirRemessaRetorno(abrirId)
}

async function carregarRemessas() {
    const alvo = document.querySelector('[data-lista-remessas]')
    if (!alvo) return
    try {
        const { remessas = [], resumo = [] } = await apiFiscal('remessas', {
            situacao: estadoRemessas.situacao, tipo: estadoRemessas.tipo || null, busca: estadoRemessas.busca || null
        })
        estadoRemessas.lista = remessas
        estadoRemessas.resumo = resumo
        desenharCartoesRemessas()
        desenharListaRemessas()
    } catch (err) {
        alvo.innerHTML = `<div class="fis-alerta">${escRem(mensagemErroEst(err))}</div>`
    }
}

function desenharCartoesRemessas() {
    const alvo = document.querySelector('[data-cartoes-remessas]')
    if (!alvo) return
    const por = Object.fromEntries(estadoRemessas.resumo.map(r => [r.prazo_situacao, r]))
    const cartao = chave => {
        const r = por[chave] || {}
        const ativo = estadoRemessas.prazo === chave
        return `
            <button type="button" class="fis-cartao${ativo ? ' rem-cartao-ativo' : ''}" style="--cor: ${PRAZOS_REMESSA[chave].cor}"
                onclick="filtrarPrazoRemessas('${chave}')" title="${ativo ? 'Clique para tirar o filtro' : 'Filtrar a lista'}">
                <span class="rem-cartao-rotulo">${PRAZOS_REMESSA[chave].texto}</span>
                <b>${r.quantidade || 0}</b>
                <span>${r.valor ? `${dinheiro(r.valor)} pendente` : '&nbsp;'}</span></button>`
    }
    alvo.innerHTML = ['VENCIDA', 'A_VENCER', 'SEM_PRAZO', 'NO_PRAZO'].map(cartao).join('')
}

function filtrarPrazoRemessas(chave) {
    estadoRemessas.prazo = estadoRemessas.prazo === chave ? '' : chave
    if (estadoRemessas.prazo && estadoRemessas.situacao === 'ENCERRADAS') {
        estadoRemessas.situacao = 'ABERTAS'
        return telaRemessasRetorno()
    }
    desenharCartoesRemessas()
    desenharListaRemessas()
}

function prazoTextoRemessa(r) {
    if (r.prazo_situacao === 'ENCERRADA') return r.prazo ? `<small>${dataRem(r.prazo)}</small>` : ''
    if (!r.prazo) return `<small>${r.tipo === 'COMODATO' ? 'informe o fim do contrato' : 'sem prazo'}</small>`
    return `${dataRem(r.prazo)}<small>${quandoRemessa(r)}</small>`
}

function quandoRemessa(r) {
    const d = Number(r.dias_restantes)
    if (!r.prazo || !Number.isFinite(d)) return ''
    return d < 0 ? `venceu há ${-d} dia${d === -1 ? '' : 's'}` : d === 0 ? 'vence hoje' : `faltam ${d} dia${d === 1 ? '' : 's'}`
}

// Cor da lateral do cabeçalho do painel (mesmas classes da nota: .fis-nota-topo.ok/.andando/...).
const TOM_PRAZO_REMESSA = { VENCIDA: 'erro', A_VENCER: 'andando', SEM_PRAZO: 'rascunho', NO_PRAZO: 'ok', ENCERRADA: 'neutro' }

function desenharListaRemessas() {
    const alvo = document.querySelector('[data-lista-remessas]')
    if (!alvo) return
    const lista = estadoRemessas.prazo ? estadoRemessas.lista.filter(r => r.prazo_situacao === estadoRemessas.prazo) : estadoRemessas.lista
    if (!lista.length) {
        alvo.innerHTML = '<div class="fis-escolha-vazio">Nenhuma remessa neste filtro.</div>'
        return
    }
    alvo.innerHTML = `
        <div class="fis-tabela-rolagem rem-rolagem">
            <table class="fis-tabela rem-tabela">
                <thead><tr><th>Destinatário</th><th>Nota</th><th>Tipo</th><th>Orçamento</th>
                    <th class="fis-num">Pendente</th><th>Prazo</th><th>Situação</th></tr></thead>
                <tbody>${lista.map(r => {
                    const prazo = PRAZOS_REMESSA[r.prazo_situacao] || {}
                    const tipo = TIPOS_REMESSA[r.tipo] || {}
                    const situacao = r.prazo_situacao === 'ENCERRADA'
                        ? etiquetaEst(SITUACOES_REMESSA[r.situacao]?.texto, SITUACOES_REMESSA[r.situacao]?.cor)
                        : `${etiquetaEst(prazo.texto, prazo.cor)}${r.situacao === 'PARCIAL' ? etiquetaEst('Retorno parcial', '#2563eb') : ''}`
                    return `
                    <tr onclick="abrirRemessaRetorno('${escRem(r.id)}')" style="--cor: ${prazo.cor || '#64748b'}" title="Abrir a remessa">
                        <td class="fis-descricao rem-destinatario"><b>${escRem(r.destinatario_nome)}</b><small>${docFormatadoFis(r.destinatario_documento)}${r.destinatario_uf ? ` · ${escRem(r.destinatario_uf)}` : ''}</small></td>
                        <td class="rem-nota"><b>${escRem(r.app)} ${escRem(r.numero)}</b><small>${dataRem(r.emissao)} · ${r.origem === 'GCS' ? 'GCS' : 'Omie'} · CFOP ${escRem(r.cfop)}</small></td>
                        <td><span class="rem-tipo" style="--cor: ${tipo.cor || '#64748b'}">${escRem(tipo.texto || r.tipo)}</span></td>
                        <td>${orcRem(r) ? `<span class="rem-orc">${escRem(orcRem(r))}</span>` : '<small>—</small>'}</td>
                        <td class="fis-num"><b>${dinheiro(r.valor_pendente)}</b>${Number(r.valor_retornado) > 0 ? `<small>de ${dinheiro(r.valor)}</small>` : ''}</td>
                        <td class="rem-prazo">${prazoTextoRemessa(r)}</td>
                        <td><div class="rem-etiquetas">${situacao}</div></td>
                    </tr>`
                }).join('')}</tbody>
            </table>
        </div>
        ${lista.length >= 1000 ? '<small class="fis-secao-info">Mostrando as 1.000 primeiras: use a busca para achar as demais.</small>' : ''}`
}

async function buscarRemessa(id) {
    let r = estadoRemessas.lista.find(x => x.id === id)
    if (r) return r
    const { remessas = [] } = await apiFiscal('remessas', { situacao: 'TODAS' })
    estadoRemessas.lista = remessas
    return remessas.find(x => x.id === id) || null
}

async function abrirRemessaRetorno(id) {
    let r
    try { r = await buscarRemessa(id) } catch (err) { return popup({ mensagem: escRem(mensagemErroEst(err)) }) }
    if (!r) return popup({ mensagem: 'Remessa não encontrada.' })
    const editavel = podeEditarRemessas()
    const aberta = r.prazo_situacao !== 'ENCERRADA'
    const tipo = TIPOS_REMESSA[r.tipo] || {}
    const itens = Array.isArray(r.itens) ? r.itens : []
    const retornos = Array.isArray(r.retornos) ? r.retornos : []
    const origemPrazo = { LEI: `legal (${tipo.prazo})`, CONTRATO: 'do contrato', PRORROGADO: 'prorrogado' }[r.prazo_origem] || ''
    const prazo = PRAZOS_REMESSA[r.prazo_situacao] || {}
    const pctRetornado = Number(r.valor) > 0 ? Math.min(100, Math.round(Number(r.valor_retornado || 0) / Number(r.valor) * 100)) : 0
    const docDest = `${docFormatadoFis(r.destinatario_documento)}${r.destinatario_uf ? ` <small>${escRem(r.destinatario_uf)}</small>` : ''}`
    // Mesmo visual da nota (.fis-nota): cabeçalho com lateral pela situação do prazo, resumo, cartões de seção.
    const elemento = `
        <div class="fis-painel fis-doc fis-nota rem-detalhe" data-remessa="${escRem(r.id)}">
            <div class="fis-nota-topo ${TOM_PRAZO_REMESSA[r.prazo_situacao] || 'neutro'}">
                <div class="fis-nota-titulo">
                    <b>${escRem(r.destinatario_nome || 'Destinatário')}</b>
                    <div class="fis-nota-etiquetas">
                        ${etiquetaEst(tipo.texto || r.tipo, tipo.cor)}
                        ${etiquetaEst(prazo.texto, prazo.cor)}
                        ${r.prazo_situacao === 'ENCERRADA' || r.situacao === 'PARCIAL' ? etiquetaEst(SITUACOES_REMESSA[r.situacao]?.texto, SITUACOES_REMESSA[r.situacao]?.cor) : ''}
                    </div>
                    <small>NF-e ${escRem(r.numero)} · ${escRem(r.app)} · ${r.origem === 'GCS' ? 'emitida pelo GCS' : 'emitida pelo Omie'} · CFOP ${escRem(r.cfop)}</small>
                </div>
                <div class="fis-nota-valor">
                    <span>${aberta ? 'Falta retornar' : 'Valor da remessa'}</span>
                    <b>${dinheiro(aberta ? r.valor_pendente : r.valor)}</b>
                </div>
            </div>

            ${resumoDocumentoFis(r, [
                ['Emissão', dataRem(r.emissao)],
                ['Prazo de retorno', r.prazo ? `${dataRem(r.prazo)}${aberta && quandoRemessa(r) ? ` <small>${quandoRemessa(r)}</small>` : ''}` : 'sem prazo'],
                ['Origem do prazo', `${escRem(origemPrazo)}${r.prazo_alterado_por ? ` <small>por ${escRem(r.prazo_alterado_por)}</small>` : ''}`],
                [r.destinatario_documento?.length > 11 ? 'CNPJ' : 'CPF/CNPJ', docDest],
                ['Orçamento', escRem(orcRem(r) || '—')]
            ])}

            <div class="fis-secao rem-progresso">
                <div class="fis-secao-topo"><b>Retornado</b>
                    <small>${dinheiro(r.valor_retornado)} de ${dinheiro(r.valor)} (${pctRetornado}%)</small></div>
                <div class="rem-barra"><span style="width: ${pctRetornado}%"></span></div>
            </div>

            ${r.chave ? `<div class="fis-chave">Chave <code>${escRem(r.chave)}</code></div>` : ''}

            ${r.baixa_em ? `
                <div class="fis-alerta rem-baixa">
                    <b>Baixada</b> em ${dataHoraFis(r.baixa_em)} por ${escRem(r.baixa_por)}: ${escRem(BAIXAS_REMESSA[r.baixa_tipo] || r.baixa_tipo)}
                    ${r.baixa_documento ? ` · nota ${escRem(r.baixa_documento)}` : ''}${r.baixa_motivo ? `<br><small>${escRem(r.baixa_motivo)}</small>` : ''}
                </div>` : ''}

            <div class="fis-secao">
                <div class="fis-secao-topo"><b>Itens</b> <span class="fis-contador">${itens.length}</span></div>
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela">
                        <thead><tr><th>#</th><th>Descrição</th><th class="fis-num">Qtd</th><th class="fis-num">Valor</th></tr></thead>
                        <tbody>${itens.map(i => `<tr><td class="fis-num">${escRem(i.n_item)}</td>
                            <td class="fis-descricao">${escRem(i.descricao)}${i.codigo ? `<small>Cód. ${escRem(i.codigo)}</small>` : ''}</td>
                            <td class="fis-num">${qtdEst(i.quantidade)} ${escRem(i.unidade || '')}</td><td class="fis-num">${i.valor != null ? dinheiro(i.valor) : ''}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>

            <div class="fis-secao">
                <div class="fis-secao-topo"><b>Notas de retorno</b> <span class="fis-contador">${retornos.length}</span>
                    <small>ligadas sozinhas quando a nota referencia a chave desta remessa</small></div>
                ${retornos.length ? `
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela">
                        <thead><tr><th>Data</th><th>Nota</th><th>Emitente</th><th class="fis-num">Valor</th><th></th></tr></thead>
                        <tbody>${retornos.map(x => `
                        <tr><td>${dataRem(x.data)}</td><td><b>${escRem(x.numero)}</b></td><td>${escRem(x.emitente)}</td>
                            <td class="fis-num">${dinheiro(x.valor)}</td>
                            <td class="fis-num">${x.documento_id ? `<button type="button" class="fis-mini" onclick="abrirDocumentoFiscal('${escRem(x.documento_id)}')">Abrir</button>` : ''}</td></tr>`).join('')}</tbody>
                    </table>
                </div>`
                : '<div class="rem-vazio">Nenhuma nota de retorno ainda.</div>'}
            </div>

            <div class="fis-secao">
                <div class="fis-secao-topo"><b>Controle</b>${editavel ? '' : ' <small>só adm, diretoria e financeiro alteram</small>'}</div>
                <div class="fis-grade">
                    ${campoFis(`Prazo de retorno${r.tipo === 'COMODATO' ? ' <small>(fim do contrato)</small>' : ' <small>(prorrogação)</small>'}`,
                        `<input class="fis-input" type="date" name="prazo" value="${escRem(r.prazo ? String(r.prazo).slice(0, 10) : '')}" ${editavel ? '' : 'disabled'}>`)}
                    ${campoFis('Orçamento / departamento', `<input class="fis-input" name="orcamento" value="${escRem(orcRem(r))}" maxlength="60" placeholder="ORC_..." ${editavel ? '' : 'disabled'}>`)}
                </div>
                ${campoFis('Observação', `<textarea class="fis-input" name="observacao" rows="2" maxlength="1000" ${editavel ? '' : 'disabled'}>${escRem(r.observacao || '')}</textarea>`)}
            </div>
        </div>`
    const botoes = []
    if (r.origem === 'GCS' && r.documento_id) botoes.push({ texto: 'Abrir a nota', img: 'pesquisar', funcao: `abrirDocumentoFiscal('${escRem(r.documento_id)}')` })
    if (editavel) {
        botoes.push({ texto: 'Salvar', img: 'salvo', funcao: `salvarRemessaRetorno('${escRem(r.id)}', this)` })
        if (aberta && r.chave) botoes.push({ texto: 'NF-e de entrada do retorno', img: 'baixar', funcao: `emitirEntradaRetornoRemessa('${escRem(r.id)}')` })
        if (!r.baixa_em && !r.cancelada && r.situacao !== 'RETORNADA') botoes.push({ texto: 'Dar baixa', img: 'concluido', funcao: `baixarRemessaRetorno('${escRem(r.id)}')` })
        if (r.baixa_em) botoes.push({ texto: 'Desfazer baixa', img: 'cancel', funcao: `desfazerBaixaRemessaRetorno('${escRem(r.id)}')` })
    }
    popup({
        titulo: `Remessa ${r.app} ${r.numero}`,
        elemento,
        botoes,
        conteudoRodape: typeof rodapeOrcamento === 'function' ? rodapeOrcamento(orcRem(r) || null, r.destinatario_nome) : ''
    })
}

async function salvarRemessaRetorno(id, botao) {
    const painel = document.querySelector(`[data-remessa="${CSS.escape(id)}"]`)
    if (!painel) return
    const v = n => painel.querySelector(`[name="${n}"]`)?.value?.trim() || ''
    try {
        overlayAguarde()
        await apiFiscal('remessas/salvar', { id, prazo: v('prazo') || null, orcamento: v('orcamento'), observacao: v('observacao') })
        removerOverlay()
        removerPopup(botao?.closest?.('.popup')?.id || null)
        await carregarRemessas()
        popup({ mensagem: 'Remessa salva.', tempo: 3 })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: escRem(mensagemErroEst(err)) })
    }
}

function baixarRemessaRetorno(id) {
    const chave = crypto.randomUUID()
    const idPopup = popup({
        titulo: 'Dar baixa na remessa', modal: true,
        elemento: `
            <div class="fis-painel rem-form-baixa" data-baixa="${chave}">
                <p>Use a baixa só quando <b>não houver nota de retorno</b>: a nota do destinatário que referencia a remessa se liga sozinha.</p>
                ${campoFis('Como foi resolvida', `<select class="fis-input" name="tipo">${opcoesFis(Object.entries(BAIXAS_REMESSA), 'RETORNOU_SEM_NOTA')}</select>`)}
                ${campoFis('Nº da nota <small>(de venda, se virou venda)</small>', '<input class="fis-input" name="documento" maxlength="60">')}
                ${campoFis('Motivo / detalhes', '<textarea class="fis-input" name="motivo" rows="3" maxlength="1000"></textarea>')}
            </div>`,
        botoes: [
            { texto: 'Cancelar', img: 'cancel', fechar: true },
            { texto: 'Dar baixa', img: 'concluido', funcao: `confirmarBaixaRemessa('${escRem(id)}', '${chave}', this)` }
        ]
    })
    return idPopup
}

async function confirmarBaixaRemessa(id, chave, botao) {
    const form = document.querySelector(`[data-baixa="${chave}"]`)
    const v = n => form?.querySelector(`[name="${n}"]`)?.value?.trim() || ''
    try {
        overlayAguarde()
        await apiFiscal('remessas/baixar', { id, tipo: v('tipo'), documento: v('documento'), motivo: v('motivo') })
        removerOverlay()
        document.querySelectorAll('.popup').forEach(p => { if (p.querySelector(`[data-baixa="${chave}"], [data-remessa="${CSS.escape(id)}"]`)) removerPopup(p.id) })
        await carregarRemessas()
        popup({ mensagem: 'Remessa baixada.', tempo: 3 })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: escRem(mensagemErroEst(err)) })
    }
}

async function desfazerBaixaRemessaRetorno(id) {
    if (!await confirmarPopup({ titulo: 'Desfazer baixa', mensagem: 'A remessa volta a ficar pendente e a gerar lembretes. Continuar?', textoConfirmar: 'Desfazer' })) return
    try {
        overlayAguarde()
        await apiFiscal('remessas/desfazer-baixa', { id })
        removerOverlay()
        document.querySelectorAll('.popup').forEach(p => { if (p.querySelector(`[data-remessa="${CSS.escape(id)}"]`)) removerPopup(p.id) })
        await carregarRemessas()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: escRem(mensagemErroEst(err)) })
    }
}

// NF-e de entrada própria do retorno (destinatário sem IE, que não emite nota): operação ENTRADA_RETORNO_*,
// a remessa referenciada e os itens dela. O retorno se liga à remessa sozinho quando a nota é autorizada.
async function emitirEntradaRetornoRemessa(id) {
    const r = await buscarRemessa(id)
    if (!r) return
    const itens = (Array.isArray(r.itens) ? r.itens : []).map(i => {
        const q = Number(i.quantidade) || 1
        return { codigo: i.codigo, descricao: i.descricao, ncm: i.ncm, unidade: i.unidade || 'UN', quantidade: q, valor_unitario: Math.round((Number(i.valor) || 0) / q * 10000) / 10000 }
    })
    document.querySelectorAll('.popup').forEach(p => { if (p.querySelector(`[data-remessa="${CSS.escape(id)}"]`)) removerPopup(p.id) })
    await formularioEmissaoNFe({
        app: r.app,
        operacao_id: `${r.app}_ENTRADA_RETORNO_${r.tipo}`,
        destinatario: { documento: r.destinatario_documento, nome: r.destinatario_nome, uf: r.destinatario_uf },
        itens,
        opcoes: {
            referenciadas: [r.chave],
            informacoes_complementares: `Retorno da NF-e ${r.numero} de ${dataRem(r.emissao)} (${(TIPOS_REMESSA[r.tipo]?.texto || '').toLowerCase()}).`
        }
    })
    // Completa o destinatário pelo cadastro e pelas notas anteriores (mesmo caminho de digitar o CPF/CNPJ).
    const doc = document.querySelector('[data-form-nfe] [name="d_documento"]')
    if (doc && typeof buscarParticipanteFis === 'function') buscarParticipanteFis(doc)
}
