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
const podeEditarRemessas = () => ['adm', 'diretoria', 'fin'].includes(acesso?.permissao)
const escRem = v => escaparAtributo(v ?? '')
const dataRem = v => v ? new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : ''

async function telaRemessasRetorno(abrirId = null) {
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>Remessas a retornar</h2></div>
            <div class="fis-alerta rem-explica">
                Demonstração volta em <b>60 dias</b> e conserto em <b>180 dias</b>; comodato/locação segue o contrato
                (informe o prazo na remessa). Passado o prazo sem retorno, o ICMS suspenso fica devido com multa e juros.
                Remessa não conta como faturamento do orçamento.
            </div>
            <div class="fis-cartoes" data-cartoes-remessas></div>
            <div class="rem-filtros">
                <select class="fis-input" onchange="estadoRemessas.situacao = this.value; carregarRemessas()">
                    ${opcoesFis([['ABERTAS', 'Abertas'], ['ENCERRADAS', 'Encerradas'], ['TODAS', 'Todas']], estadoRemessas.situacao)}
                </select>
                <select class="fis-input" onchange="estadoRemessas.tipo = this.value; carregarRemessas()">
                    ${opcoesFis([['', 'Todos os tipos'], ...Object.entries(TIPOS_REMESSA).map(([k, t]) => [k, t.texto])], estadoRemessas.tipo)}
                </select>
                <input class="fis-input rem-busca" placeholder="Nº, destinatário, CNPJ, ORC ou item…" value="${escRem(estadoRemessas.busca)}"
                    oninput="clearTimeout(estadoRemessas.timer); estadoRemessas.busca = this.value; estadoRemessas.timer = setTimeout(carregarRemessas, 400)">
            </div>
            <div class="fis-conteudo" data-lista-remessas></div>
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
                onclick="filtrarPrazoRemessas('${chave}')" title="${r.valor ? `Pendente: ${dinheiro(r.valor)}` : ''}">
                <b>${r.quantidade || 0}</b><span>${PRAZOS_REMESSA[chave].texto.toLowerCase()}${r.valor ? ` · ${dinheiro(r.valor)}` : ''}</span></button>`
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
    if (!r.prazo) return `<small>${r.tipo === 'COMODATO' ? 'informe o fim do contrato' : ''}</small>`
    const d = Number(r.dias_restantes)
    const quando = d < 0 ? `venceu há ${-d} dia${d === -1 ? '' : 's'}` : d === 0 ? 'vence hoje' : `faltam ${d} dia${d === 1 ? '' : 's'}`
    return `${dataRem(r.prazo)}<small>${quando}</small>`
}

function desenharListaRemessas() {
    const alvo = document.querySelector('[data-lista-remessas]')
    if (!alvo) return
    const lista = estadoRemessas.prazo ? estadoRemessas.lista.filter(r => r.prazo_situacao === estadoRemessas.prazo) : estadoRemessas.lista
    if (!lista.length) {
        alvo.innerHTML = '<div class="fis-escolha-vazio">Nenhuma remessa neste filtro.</div>'
        return
    }
    alvo.innerHTML = `
        <div class="fis-tabela-rolagem">
            <table class="fis-tabela rem-tabela">
                <thead><tr><th></th><th>Emissão</th><th>Empresa</th><th>Nº</th><th>Tipo</th><th>Destinatário</th><th>Orçamento</th>
                    <th class="fis-num">Pendente</th><th>Prazo</th><th>Situação</th></tr></thead>
                <tbody>${lista.map(r => `
                    <tr onclick="abrirRemessaRetorno('${escRem(r.id)}')" style="cursor: pointer">
                        <td class="fis-acoes-linha"><img src="imagens/pesquisar.svg" title="Abrir"></td>
                        <td>${dataRem(r.emissao)}</td>
                        <td>${escRem(r.app)}</td>
                        <td><b>${escRem(r.numero)}</b><small>${r.origem === 'GCS' ? 'GCS' : 'Omie'} · CFOP ${escRem(r.cfop)}</small></td>
                        <td>${etiquetaEst(TIPOS_REMESSA[r.tipo]?.texto || r.tipo, TIPOS_REMESSA[r.tipo]?.cor)}</td>
                        <td class="fis-descricao">${escRem(r.destinatario_nome)}<small>${docFormatadoFis(r.destinatario_documento)}${r.destinatario_uf ? ` · ${escRem(r.destinatario_uf)}` : ''}</small></td>
                        <td>${escRem(r.orcamento || '')}</td>
                        <td class="fis-num">${dinheiro(r.valor_pendente)}</td>
                        <td class="rem-prazo">${prazoTextoRemessa(r)}</td>
                        <td>${etiquetaEst(PRAZOS_REMESSA[r.prazo_situacao]?.texto, PRAZOS_REMESSA[r.prazo_situacao]?.cor)}
                            ${r.prazo_situacao === 'ENCERRADA' ? '' : r.situacao === 'PARCIAL' ? etiquetaEst('Retorno parcial', '#2563eb') : ''}
                            ${r.prazo_situacao === 'ENCERRADA' ? etiquetaEst(SITUACOES_REMESSA[r.situacao]?.texto, SITUACOES_REMESSA[r.situacao]?.cor) : ''}</td>
                    </tr>`).join('')}</tbody>
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
    const elemento = `
        <div class="fis-painel rem-detalhe" data-remessa="${escRem(r.id)}">
            <div class="rem-etiquetas">
                ${etiquetaEst(tipo.texto || r.tipo, tipo.cor)}
                ${etiquetaEst(PRAZOS_REMESSA[r.prazo_situacao]?.texto, PRAZOS_REMESSA[r.prazo_situacao]?.cor)}
                ${etiquetaEst(SITUACOES_REMESSA[r.situacao]?.texto, SITUACOES_REMESSA[r.situacao]?.cor)}
            </div>
            <div class="rem-resumo">
                <div><small>Nota</small><b>${escRem(r.app)} ${escRem(r.numero)}</b><small>${r.origem === 'GCS' ? 'emitida pelo GCS' : 'emitida pelo Omie'} · CFOP ${escRem(r.cfop)}</small></div>
                <div><small>Emissão</small><b>${dataRem(r.emissao)}</b></div>
                <div><small>Prazo de retorno</small><b>${r.prazo ? dataRem(r.prazo) : 'sem prazo'}</b><small>${escRem(origemPrazo)}${r.prazo_alterado_por ? ` · por ${escRem(r.prazo_alterado_por)}` : ''}</small></div>
                <div><small>Destinatário</small><b>${escRem(r.destinatario_nome)}</b><small>${docFormatadoFis(r.destinatario_documento)}${r.destinatario_uf ? ` · ${escRem(r.destinatario_uf)}` : ''}</small></div>
                <div><small>Valor da remessa</small><b>${dinheiro(r.valor)}</b><small>retornado ${dinheiro(r.valor_retornado)}</small></div>
            </div>
            ${r.chave ? `<small class="fis-secao-info">Chave: ${escRem(r.chave)}</small>` : ''}

            <div class="fis-secao">
                <div class="fis-secao-titulo"><b>Itens</b> <span class="fis-contador">${itens.length}</span></div>
                <table class="fis-tabela">
                    <thead><tr><th>#</th><th>Código</th><th>Descrição</th><th class="fis-num">Qtd</th><th class="fis-num">Valor</th></tr></thead>
                    <tbody>${itens.map(i => `<tr><td>${escRem(i.n_item)}</td><td>${escRem(i.codigo)}</td><td>${escRem(i.descricao)}</td>
                        <td class="fis-num">${escRem(i.quantidade)}</td><td class="fis-num">${i.valor != null ? dinheiro(i.valor) : ''}</td></tr>`).join('')}</tbody>
                </table>
            </div>

            <div class="fis-secao">
                <div class="fis-secao-titulo"><b>Retornos</b> <span class="fis-contador">${retornos.length}</span>
                    <small class="fis-secao-info">ligados sozinhos quando a nota referencia a chave desta remessa</small></div>
                ${retornos.length ? `<table class="fis-tabela"><tbody>${retornos.map(x => `
                    <tr><td>${dataRem(x.data)}</td><td><b>${escRem(x.numero)}</b></td><td>${escRem(x.emitente)}</td>
                        <td class="fis-num">${dinheiro(x.valor)}</td>
                        <td>${x.documento_id ? `<button type="button" class="fis-mini" onclick="abrirDocumentoFiscal('${escRem(x.documento_id)}')">Abrir</button>` : ''}</td></tr>`).join('')}</tbody></table>`
                    : '<small class="fis-secao-info">Nenhuma nota de retorno ainda.</small>'}
            </div>

            ${r.baixa_em ? `
                <div class="fis-secao rem-baixa">
                    <b>Baixada</b> em ${dataHoraFis(r.baixa_em)} por ${escRem(r.baixa_por)}: ${escRem(BAIXAS_REMESSA[r.baixa_tipo] || r.baixa_tipo)}
                    ${r.baixa_documento ? ` · nota ${escRem(r.baixa_documento)}` : ''}<br><small>${escRem(r.baixa_motivo)}</small>
                </div>` : ''}

            <div class="fis-grade">
                ${campoFis(`Prazo de retorno${r.tipo === 'COMODATO' ? ' <small>(fim do contrato)</small>' : ' <small>(prorrogação)</small>'}`,
                    `<input class="fis-input" type="date" name="prazo" value="${escRem(r.prazo ? String(r.prazo).slice(0, 10) : '')}" ${editavel ? '' : 'disabled'}>`)}
                ${campoFis('Orçamento / departamento', `<input class="fis-input" name="orcamento" value="${escRem(r.orcamento || '')}" maxlength="60" placeholder="ORC_..." ${editavel ? '' : 'disabled'}>`)}
            </div>
            ${campoFis('Observação', `<textarea class="fis-input" name="observacao" rows="2" maxlength="1000" ${editavel ? '' : 'disabled'}>${escRem(r.observacao || '')}</textarea>`)}
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
        conteudoRodape: typeof rodapeOrcamento === 'function' ? rodapeOrcamento(r.orcamento, r.destinatario_nome) : ''
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
