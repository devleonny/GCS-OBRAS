// Fiscal (servidor: SCRIPTS/fiscal.js, SCRIPTS/fiscal/*; banco: migrations/fiscal-estoque.sql).
// - Notas recebidas: importar XML ou buscar na SEFAZ (Focus), ligar cada item ao cadastro do GCS
//   (o de-para aprende: a próxima nota do fornecedor já vem ligada), manifestar e lançar no estoque.
//   A entrada nunca cria item novo.
// - Notas emitidas: NF-e e NFS-e pela Focus NFe, com prévia dos impostos (perfis de operação copiados
//   das notas do Omie), rascunho, emissão, consulta e cancelamento. NF-e autorizada dá saída no estoque.
// - Configuração: empresas, perfis de operação (CFOP/CST/alíquotas) e serviços (LC 116/ISS/retenções).
// Chamadas pelas rotas em apiModuloFiscal (js/estoque.js).

const escFis = valor => escaparAtributo(valor ?? '')
const apiFiscal = (rota, corpo) => apiModuloFiscal(`fiscal/${rota}`, corpo)
const soDigFis = v => String(v ?? '').replace(/\D/g, '')

const STATUS_FISCAL = {
    RESUMO: { cor: '#d97706', texto: 'Só resumo' },
    COMPLETA: { cor: '#15803d', texto: 'XML completo' },
    RASCUNHO: { cor: '#64748b', texto: 'Rascunho' },
    PROCESSANDO: { cor: '#2563eb', texto: 'Processando' },
    AUTORIZADA: { cor: '#15803d', texto: 'Autorizada' },
    REJEITADA: { cor: '#b91c1c', texto: 'Rejeitada' },
    DENEGADA: { cor: '#7f1d1d', texto: 'Denegada' },
    CANCELADA: { cor: '#475569', texto: 'Cancelada' }
}
const ESTOQUE_FISCAL = {
    PENDENTE_VINCULO: { cor: '#d97706', texto: 'Itens a vincular' },
    PRONTO: { cor: '#2563eb', texto: 'Pronta p/ lançar' },
    LANCADO: { cor: '#15803d', texto: 'Lançada' },
    NAO_MOVIMENTA: { cor: '#64748b', texto: 'Não movimenta' }
}
const MANIFESTACAO_FISCAL = {
    PENDENTE: { cor: '#d97706', texto: 'Sem manifestação' },
    CIENCIA: { cor: '#2563eb', texto: 'Ciência' },
    CONFIRMACAO: { cor: '#15803d', texto: 'Confirmada' },
    DESCONHECIMENTO: { cor: '#b91c1c', texto: 'Desconhecida' },
    NAO_REALIZADA: { cor: '#7f1d1d', texto: 'Não realizada' }
}
const ORIGENS_MERCADORIA = {
    0: '0 · Nacional', 1: '1 · Estrangeira (importação direta)', 2: '2 · Estrangeira (mercado interno)',
    3: '3 · Nacional, importação > 40%', 4: '4 · Nacional, processos básicos', 5: '5 · Nacional, importação ≤ 40%',
    6: '6 · Estrangeira direta, sem similar', 7: '7 · Estrangeira interna, sem similar', 8: '8 · Nacional, importação > 70%'
}

const etiquetaFis = (mapa, chave) => chave ? etiquetaEst(mapa[chave]?.texto || chave, mapa[chave]?.cor) : ''
const dataFis = v => v ? new Date(v).toLocaleDateString('pt-BR') : ''
const dataHoraFis = v => v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
const docFormatadoFis = v => {
    const d = soDigFis(v)
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    return v || ''
}

// ================================================================ NOTAS RECEBIDAS

async function telaNotasRecebidas() {
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>Notas recebidas</h2></div>
            <div class="fis-cartoes" data-cartoes-recebidas></div>
            <div class="fis-conteudo"></div>
            <input type="file" accept=".xml,text/xml" multiple hidden data-arquivos-xml onchange="importarXmlsRecebidos(this)">
        </div>`
    contadoresFiscal()
    await abrirTabelaRecebidas()
}

async function abrirTabelaRecebidas(filtroExtra = null) {
    try {
        delete controles.notasRecebidas
        document.querySelector('.fis-conteudo').innerHTML = await modTab({
            base: 'vw_fiscal_documentos',
            pag: 'notasRecebidas',
            body: 'bodyNotasRecebidas',
            criarLinha: 'criarLinhaNotaRecebida',
            topoEmLinha: true,
            filtrosFixos: { direcao: { op: '=', value: 'entrada' }, ...(filtroExtra || {}) },
            btnExtras: `
                <div class="fis-acoes">
                    <button type="button" onclick="document.querySelector('[data-arquivos-xml]').click()">Importar XML</button>
                    <button type="button" onclick="buscarNotasSefaz()" title="Busca na SEFAZ (pela Focus NFe) as notas emitidas contra os CNPJs do grupo">Buscar na SEFAZ</button>
                    ${filtroExtra ? '<button type="button" onclick="abrirTabelaRecebidas()">Limpar filtro</button>' : ''}
                </div>`,
            ordenar: [{ path: 'emissao', direcao: 'desc' }],
            colunas: {
                '': {},
                'Emissão': { chave: 'dia', tipoPesquisa: 'data' },
                'Empresa': { chave: 'app', tipoPesquisa: 'select' },
                'Nº': { chave: 'numero' },
                'Fornecedor': { chave: 'participante_nome' },
                'CNPJ': { chave: 'participante_documento' },
                'Valor': { chave: 'valor_total', op: '>=', tipoOrdenacao: 'numero' },
                'Itens': { chave: 'itens_pendentes', tipoOrdenacao: 'numero' },
                'Estoque': { chave: 'estoque_status', tipoPesquisa: 'select' },
                'Manifestação': { chave: 'manifestacao', tipoPesquisa: 'select' },
                'Situação': { chave: 'status', tipoPesquisa: 'select' }
            }
        })
        await paginacao('notasRecebidas')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir as notas recebidas: ${escFis(err.message)}` })
    }
}

async function contadoresFiscal() {
    const alvo = document.querySelector('[data-cartoes-recebidas], [data-cartoes-emitidas]')
    if (!alvo) return
    try {
        const { contadores: c, empresas } = await apiFiscal('painel')
        const semFocus = empresas.filter(e => e.ativo && !e[`focus_${e.ambiente}`]).map(e => e.app)
        const cartao = (n, texto, cor, acao) => `
            <button type="button" class="fis-cartao" style="--cor: ${cor}" ${acao ? `onclick="${acao}"` : 'disabled'}>
                <b>${n || 0}</b><span>${texto}</span></button>`
        alvo.innerHTML = alvo.dataset.cartoesRecebidas !== undefined
            ? `
                ${cartao(c.entrada_pendente_vinculo, 'com itens a vincular', '#d97706', `abrirTabelaRecebidas({ estoque_status: { op: '=', value: 'pendente_vinculo' } })`)}
                ${cartao(c.entrada_pronta, 'prontas para lançar', '#2563eb', `abrirTabelaRecebidas({ estoque_status: { op: '=', value: 'pronto' } })`)}
                ${cartao(c.entrada_sem_manifestacao, 'sem confirmação', '#7c3aed', `abrirTabelaRecebidas({ manifestacao: { op: '=', value: 'pendente' } })`)}
                ${cartao(c.entrada_resumo, 'só com resumo (falta XML)', '#64748b', `abrirTabelaRecebidas({ status: { op: '=', value: 'resumo' } })`)}
                ${semFocus.length ? `<div class="fis-alerta">Integração com a SEFAZ (Focus NFe) ainda não configurada para ${semFocus.join(', ')}. Por enquanto, importe os XMLs.</div>` : ''}`
            : `
                ${cartao(c.saida_rascunho, 'rascunhos', '#64748b', `abrirTabelaEmitidas({ status: { op: '=', value: 'rascunho' } })`)}
                ${cartao(c.saida_processando, 'processando', '#2563eb', `abrirTabelaEmitidas({ status: { op: '=', value: 'processando' } })`)}
                ${cartao(c.saida_rejeitada, 'rejeitadas', '#b91c1c', `abrirTabelaEmitidas({ status: { op: '=', value: 'rejeitada' } })`)}
                ${semFocus.length ? `<div class="fis-alerta">Emissão pela Focus NFe ainda não configurada para ${semFocus.join(', ')}: dá para montar e salvar rascunhos, a emissão fica para quando o token estiver cadastrado.</div>` : ''}`
    } catch (err) {
        alvo.innerHTML = `<div class="fis-alerta">${escFis(err.message)}</div>`
    }
}

function criarLinhaNotaRecebida(d) {
    const pend = Number(d.itens_pendentes || 0)
    return `
        <tr>
            <td class="fis-acoes-linha"><img src="imagens/pesquisar.svg" title="Abrir nota" onclick="abrirDocumentoFiscal('${escFis(d.id)}')"></td>
            <td>${dataFis(d.emissao)}</td>
            <td>${escFis(d.app)}</td>
            <td><b>${escFis(d.numero || '')}</b></td>
            <td class="fis-descricao">${escFis(d.participante_nome)}</td>
            <td><small>${docFormatadoFis(d.participante_documento)}</small></td>
            <td class="fis-num">${d.valor_total != null ? dinheiro(d.valor_total) : ''}</td>
            <td class="fis-num">${d.itens}${pend ? ` <small class="fis-pendente">${pend} a vincular</small>` : ''}</td>
            <td>${etiquetaFis(ESTOQUE_FISCAL, d.estoque_status)}</td>
            <td>${etiquetaFis(MANIFESTACAO_FISCAL, d.manifestacao)}</td>
            <td>${etiquetaFis(STATUS_FISCAL, d.status)}</td>
        </tr>`
}

async function importarXmlsRecebidos(input) {
    const arquivos = [...(input.files || [])]
    input.value = ''
    if (!arquivos.length) return
    overlayAguarde()
    try {
        const xmls = await Promise.all(arquivos.map(async a => ({ nome: a.name, conteudo: await a.text() })))
        const { resultados } = await apiFiscal('recebidas/importar-xml', { xmls })
        removerOverlay()
        const linhas = resultados.map(r => `
            <tr>
                <td>${escFis(r.arquivo || '')}</td>
                <td>${r.mensagem
                    ? `<span class="fis-negativo">${escFis(r.mensagem)}</span>`
                    : r.duplicada ? 'Já estava importada'
                    : `<span class="fis-positivo">NF ${escFis(r.numero)} · ${escFis(r.emitente || '')}</span>`}</td>
                <td>${r.id ? `<button type="button" class="fis-mini" onclick="abrirDocumentoFiscal('${escFis(r.id)}')">Abrir</button>` : ''}</td>
            </tr>`).join('')
        popup({ titulo: 'Importação de XML', elemento: `<div class="fis-painel"><table class="fis-tabela"><tbody>${linhas}</tbody></table></div>` })
        contadoresFiscal()
        if (controles.notasRecebidas) paginacao('notasRecebidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function buscarNotasSefaz() {
    overlayAguarde()
    try {
        const { resultado } = await apiFiscal('recebidas/sincronizar')
        removerOverlay()
        const linhas = resultado.map(r => `<li><b>${escFis(r.app)}</b>: ${r.mensagem
            ? escFis(r.mensagem)
            : `${r.novas} novas, ${r.completas} com XML completo, ${r.canceladas} canceladas`}</li>`).join('')
        popup({ titulo: 'Busca na SEFAZ', mensagem: `<ul class="fis-lista">${linhas}</ul>` })
        contadoresFiscal()
        if (controles.notasRecebidas) paginacao('notasRecebidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- documento (recebido ou emitido)

async function abrirDocumentoFiscal(id) {
    overlayAguarde()
    try {
        const dados = await apiFiscal('documento', { id })
        removerOverlay()
        // Reabre no lugar: fecha a janela anterior do mesmo documento.
        const anterior = document.querySelector(`[data-doc-fiscal="${CSS.escape(id)}"]`)?.closest('.popup')?.id
        if (anterior) removerPopup(anterior)
        const html = dados.documento.direcao === 'ENTRADA' ? htmlNotaRecebida(dados) : htmlNotaEmitida(dados)
        popup({ titulo: dados.documento.direcao === 'ENTRADA' ? 'Nota recebida' : 'Nota emitida', elemento: html })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function resumoDocumentoFis(d, campos) {
    return `<div class="fis-resumo">${campos.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`
}

function htmlNotaRecebida({ documento: d, itens, movimentos, pagamentos }) {
    const lancada = d.estoque_status === 'LANCADO'
    const pendentes = itens.filter(i => i.vinculo === 'PENDENTE').length
    const linhas = itens.map(i => {
        let vinculo
        if (i.vinculo === 'VINCULADO') {
            const qtdEstoque = Number(i.quantidade) * Number(i.fator || 1)
            vinculo = `
                <div class="fis-vinculo ok">
                    <b>${escFis(i.item_codigo)}</b> ${escFis(i.item_descricao)}
                    <small>${Number(i.fator) !== 1 ? `${qtdEst(i.quantidade)} ${escFis(i.unidade)} × ${qtdEst(i.fator)} = ` : ''}${qtdEst(qtdEstoque)} ${escFis(i.item_unidade || '')} no estoque
                    · ${escFis({ DEPARA: 'de-para', EAN: 'pelo EAN', MANUAL: 'manual', EMISSAO: '' }[i.vinculo_origem] || '')}</small>
                    ${lancada ? '' : `<button type="button" class="fis-mini" onclick="painelVincularItem('${escFis(i.id)}', '${escFis(d.id)}')">Trocar</button>
                    <button type="button" class="fis-mini" onclick="vincularItemFiscal('${escFis(i.id)}', '${escFis(d.id)}', 'DESVINCULAR')">Desfazer</button>`}
                </div>`
        } else if (i.vinculo === 'IGNORADO') {
            vinculo = `<div class="fis-vinculo ignorado">Não é item de estoque
                ${lancada ? '' : `<button type="button" class="fis-mini" onclick="vincularItemFiscal('${escFis(i.id)}', '${escFis(d.id)}', 'DESVINCULAR')">Desfazer</button>`}</div>`
        } else {
            vinculo = `<div class="fis-vinculo pendente">
                <button type="button" class="fis-botao" onclick="painelVincularItem('${escFis(i.id)}', '${escFis(d.id)}')">Vincular ao cadastro</button>
                <button type="button" class="fis-mini" onclick="vincularItemFiscal('${escFis(i.id)}', '${escFis(d.id)}', 'IGNORAR')" title="Frete, serviço, material de uso imediato…">Não é estoque</button></div>`
        }
        return `
            <tr>
                <td class="fis-num">${i.n_item}</td>
                <td><small>${escFis(i.codigo)}</small></td>
                <td class="fis-descricao">${escFis(i.descricao)}<small>NCM ${escFis(i.ncm || '—')} · CFOP ${escFis(i.cfop || '—')}${i.ean ? ` · EAN ${escFis(i.ean)}` : ''}</small></td>
                <td class="fis-num">${qtdEst(i.quantidade)} ${escFis(i.unidade)}</td>
                <td class="fis-num">${i.valor_unitario != null ? dinheiro(i.valor_unitario) : ''}</td>
                <td class="fis-num">${i.valor_total != null ? dinheiro(i.valor_total) : ''}</td>
                <td>${vinculo}</td>
            </tr>`
    }).join('')

    const manifestar = ['CIENCIA', 'CONFIRMACAO', 'DESCONHECIMENTO', 'NAO_REALIZADA']
        .filter(t => t !== d.manifestacao)
        .map(t => `<button type="button" class="fis-mini" onclick="manifestarNotaFiscal('${escFis(d.id)}', '${t}')">${MANIFESTACAO_FISCAL[t].texto}</button>`).join('')

    return `
        <div class="fis-painel fis-doc" data-doc-fiscal="${escFis(d.id)}">
            ${resumoDocumentoFis(d, [
                ['Fornecedor', `${escFis(d.participante_nome)} <small>${docFormatadoFis(d.participante_documento)} ${escFis(d.participante_uf || '')}</small>`],
                ['Nota', `${escFis(d.numero || '—')}${d.serie ? ` / série ${escFis(d.serie)}` : ''}`],
                ['Emissão', dataHoraFis(d.emissao)],
                ['Empresa', escFis(d.app)],
                ['Valor', d.valor_total != null ? dinheiro(d.valor_total) : ''],
                ['Natureza', escFis(d.natureza_operacao || '')],
                ['Situação', `${etiquetaFis(STATUS_FISCAL, d.status)} ${etiquetaFis(MANIFESTACAO_FISCAL, d.manifestacao)} ${etiquetaFis(ESTOQUE_FISCAL, d.estoque_status)}`]
            ])}
            ${d.chave ? `<div class="fis-chave">Chave: <code>${escFis(d.chave)}</code></div>` : ''}
            ${(d.mensagens || []).length ? `<div class="fis-alerta">${d.mensagens.map(escFis).join('<br>')}</div>` : ''}
            ${pagamentos?.length ? `<div class="fis-info">Pagamento lançado com esta chave: ${pagamentos.map(p => `<b>${escFis(p.id)}</b> (${escFis(p.status || '')})`).join(', ')}</div>` : ''}

            <div class="fis-acoes-claras">
                ${d.status !== 'RESUMO' && !lancada ? `<button type="button" class="fis-botao" ${pendentes ? `disabled title="Faltam ${pendentes} itens"` : ''} onclick="lancarNotaEstoque('${escFis(d.id)}')">Lançar no estoque</button>` : ''}
                ${lancada ? `<button type="button" class="fis-mini" onclick="estornarNotaEstoque('${escFis(d.id)}')">Estornar entrada</button>` : ''}
                ${d.tem_xml ? `<button type="button" class="fis-mini" onclick="baixarArquivoFiscal('${escFis(d.id)}', 'xml')">XML</button>` : ''}
                <button type="button" class="fis-mini" onclick="baixarArquivoFiscal('${escFis(d.id)}', 'danfe')">DANFE</button>
                <span class="fis-separador"></span>
                <small>Manifestar:</small> ${manifestar}
            </div>

            ${d.status === 'RESUMO'
                ? '<div class="fis-vazio">A SEFAZ só mandou o resumo. Dê <b>Ciência</b> para liberar o XML completo, ou importe o XML que o fornecedor enviou.</div>'
                : `
            <div class="fis-secao">
                <div class="fis-secao-topo"><b>Itens</b> ${pendentes ? `<small class="fis-pendente">${pendentes} sem vínculo: a entrada só vai para o estoque com todos resolvidos</small>` : '<small>todos resolvidos</small>'}</div>
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela">
                        <thead><tr><th>#</th><th>Cód. fornecedor</th><th>Descrição na nota</th><th>Qtd</th><th>Unit.</th><th>Total</th><th>Item do GCS</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            </div>`}
            ${movimentos?.length ? `
                <details class="fis-secao"><summary><b>Movimentos de estoque</b> (${movimentos.length})</summary>
                    <table class="fis-tabela"><tbody>${movimentos.map(m => linhaMovimentoEst(m, { comItem: true, acoes: false })).join('')}</tbody></table>
                </details>` : ''}
            ${historicoFiscal(d)}
        </div>`
}

function historicoFiscal(d) {
    const ev = Array.isArray(d.eventos) ? d.eventos : []
    if (!ev.length) return ''
    return `
        <details class="fis-secao"><summary><b>Histórico</b> (${ev.length})</summary>
            <ul class="fis-lista">${ev.slice().reverse().map(e => `<li><small>${dataHoraFis(e.em)} · ${escFis(e.por)}</small> ${escFis(e.acao)}${e.detalhe ? ` <small>— ${escFis(e.detalhe)}</small>` : ''}</li>`).join('')}</ul>
        </details>`
}

async function baixarArquivoFiscal(id, tipo) {
    try {
        overlayAguarde()
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const r = await fetch(`${api}/fiscal/arquivo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id, tipo })
        })
        removerOverlay()
        if (!r.ok) {
            const j = await r.json().catch(() => ({}))
            throw new Error(j.mensagem || 'Arquivo não disponível')
        }
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        if (tipo === 'xml') {
            const a = document.createElement('a')
            a.href = url
            a.download = (r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/) || [])[1] || `${id}.xml`
            a.click()
        } else {
            window.open(url, '_blank')
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: escFis(err.message) })
    }
}

// ---------------------------------------------------------------- vínculo de itens

async function painelVincularItem(documentoItemId, documentoId, texto = '') {
    overlayAguarde()
    try {
        const { itens } = await apiFiscal('itens/sugestoes', { documento_item_id: documentoItemId, texto: texto || undefined })
        removerOverlay()
        const anterior = document.querySelector('[data-painel-vinculo]')?.closest('.popup')?.id
        if (anterior) removerPopup(anterior)
        const lista = itens.map(c => `
            <tr>
                <td><b>${escFis(c.codigo)}</b></td>
                <td class="fis-descricao">${escFis(c.descricao)}<small>${[c.fabricante, c.modelo, c.partnumber].filter(Boolean).map(escFis).join(' · ')}</small></td>
                <td>${escFis(c.unidade || '')}</td>
                <td><small>${escFis(c.ncm || '')}</small></td>
                <td class="fis-num">${c.saldo != null ? qtdEst(c.saldo) : ''}</td>
                <td class="fis-num"><small>${c.pontos}</small></td>
                <td><button type="button" class="fis-botao" onclick="escolherItemVinculo('${escFis(documentoItemId)}', '${escFis(documentoId)}', '${escFis(c.id)}', this)">Usar</button></td>
            </tr>`).join('')
        popup({
            titulo: 'Vincular ao cadastro do GCS',
            elemento: `
                <div class="fis-painel" data-painel-vinculo>
                    <div class="fis-barra-clara">
                        <input class="fis-input fis-busca" value="${escFis(texto)}" placeholder="Buscar por descrição, código, modelo, part number…"
                            onkeydown="if (event.key === 'Enter') painelVincularItem('${escFis(documentoItemId)}', '${escFis(documentoId)}', this.value)">
                        <button type="button" class="fis-mini" onclick="painelVincularItem('${escFis(documentoItemId)}', '${escFis(documentoId)}', this.previousElementSibling.value)">Buscar</button>
                    </div>
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela">
                            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th>NCM</th><th>Saldo</th><th>Afinidade</th><th></th></tr></thead>
                            <tbody>${lista || '<tr><td colspan="7" class="fis-vazio">Nada parecido no cadastro. Busque por outro termo; se o item não existir, cadastre-o em Composições e volte aqui.</td></tr>'}</tbody>
                        </table>
                    </div>
                    <small class="fis-dica">A entrada nunca cria item novo: escolha o item do cadastro que corresponde ao produto do fornecedor.</small>
                </div>`
        })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function escolherItemVinculo(documentoItemId, documentoId, itemId, botao) {
    const painelBusca = botao.closest('.popup')?.id
    popup({
        titulo: 'Conversão de unidade',
        linhas: [{
            elemento: `
                <div class="fis-form" data-fator-vinculo>
                    <label class="fis-campo"><span>1 unidade da nota do fornecedor = quantas unidades no estoque?</span>
                        <input class="fis-input" name="fator" type="number" min="0.0001" step="any" value="1"></label>
                    <small class="fis-dica">Ex.: fornecedor vende CAIXA com 10 e o estoque controla UNIDADE → 10.</small>
                    <label class="fis-check"><input type="checkbox" name="lembrar" checked> Lembrar para as próximas notas deste fornecedor (de-para)</label>
                </div>`
        }],
        botoes: [{
            texto: 'Vincular', img: 'concluido',
            funcao: `confirmarVinculoItem('${escFis(documentoItemId)}', '${escFis(documentoId)}', '${escFis(itemId)}', '${escFis(painelBusca || '')}', this)`
        }]
    })
}

async function confirmarVinculoItem(documentoItemId, documentoId, itemId, painelBusca, botao) {
    const form = document.querySelector('[data-fator-vinculo]')
    const fator = form.querySelector('[name="fator"]').value
    const lembrar = form.querySelector('[name="lembrar"]').checked
    removerPopup(botao?.closest('.popup')?.id)
    if (painelBusca) removerPopup(painelBusca)
    await vincularItemFiscal(documentoItemId, documentoId, 'VINCULAR', { item_id: itemId, fator, lembrar })
}

async function vincularItemFiscal(documentoItemId, documentoId, acao, extra = {}) {
    try {
        overlayAguarde()
        const r = await apiFiscal('itens/vincular', { documento_item_id: documentoItemId, acao, lembrar: true, ...extra })
        removerOverlay()
        await abrirDocumentoFiscal(documentoId)
        const avisos = []
        if (r.outras) avisos.push(`O de-para também ligou ${r.outras} item(ns) pendente(s) em outras notas deste fornecedor.`)
        if (r.completou?.length) avisos.push(`O cadastro do item ganhou ${r.completou.join(', ')} vindo(s) da nota.`)
        if (avisos.length) popup({ mensagem: avisos.join('<br>'), imagem: 'imagens/concluido.png', tempo: 6 })
        if (controles.notasRecebidas) paginacao('notasRecebidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function lancarNotaEstoque(id) {
    try {
        overlayAguarde()
        const r = await apiFiscal('recebidas/lancar-estoque', { id })
        removerOverlay()
        popup({ mensagem: `Entrada lançada: ${r.lancados} item(ns) no estoque.`, imagem: 'imagens/concluido.png', tempo: 4 })
        abrirDocumentoFiscal(id)
        contadoresFiscal()
        if (controles.notasRecebidas) paginacao('notasRecebidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function estornarNotaEstoque(id) {
    const motivo = prompt('Motivo do estorno da entrada:')
    if (motivo === null) return
    try {
        overlayAguarde()
        await apiFiscal('recebidas/estornar-estoque', { id, motivo })
        removerOverlay()
        abrirDocumentoFiscal(id)
        if (controles.notasRecebidas) paginacao('notasRecebidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function manifestarNotaFiscal(id, tipo) {
    let justificativa
    if (tipo === 'NAO_REALIZADA') {
        justificativa = prompt('Justificativa (mínimo 15 caracteres):')
        if (justificativa === null) return
    } else {
        const textos = {
            CIENCIA: 'Dar ciência da nota (libera o XML completo; não confirma a compra).',
            CONFIRMACAO: 'Confirmar a operação (a mercadoria foi recebida). É definitivo na SEFAZ.',
            DESCONHECIMENTO: 'Desconhecer a operação (a empresa não fez esta compra). É definitivo na SEFAZ.'
        }
        const ok = await confirmarPopup({ titulo: MANIFESTACAO_FISCAL[tipo].texto, mensagem: textos[tipo], textoConfirmar: 'Enviar à SEFAZ' })
        if (!ok) return
    }
    try {
        overlayAguarde()
        await apiFiscal('recebidas/manifestar', { id, tipo, justificativa })
        removerOverlay()
        abrirDocumentoFiscal(id)
        contadoresFiscal()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ================================================================ NOTAS EMITIDAS

async function telaNotasEmitidas() {
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>Notas emitidas</h2></div>
            <div class="fis-cartoes" data-cartoes-emitidas></div>
            <div class="fis-conteudo"></div>
        </div>`
    contadoresFiscal()
    await abrirTabelaEmitidas()
}

async function abrirTabelaEmitidas(filtroExtra = null) {
    try {
        delete controles.notasEmitidas
        document.querySelector('.fis-conteudo').innerHTML = await modTab({
            base: 'vw_fiscal_documentos',
            pag: 'notasEmitidas',
            body: 'bodyNotasEmitidas',
            criarLinha: 'criarLinhaNotaEmitida',
            topoEmLinha: true,
            filtrosFixos: { direcao: { op: '=', value: 'saida' }, ...(filtroExtra || {}) },
            btnExtras: `
                <div class="fis-acoes">
                    <button type="button" onclick="formularioEmissaoNFe()">+ NF-e</button>
                    <button type="button" onclick="formularioEmissaoNFSe()">+ NFS-e</button>
                    ${filtroExtra ? '<button type="button" onclick="abrirTabelaEmitidas()">Limpar filtro</button>' : ''}
                </div>`,
            ordenar: [{ path: 'criado_em', direcao: 'desc' }],
            colunas: {
                '': {},
                'Data': { chave: 'dia', tipoPesquisa: 'data' },
                'Empresa': { chave: 'app', tipoPesquisa: 'select' },
                'Modelo': { chave: 'modelo', tipoPesquisa: 'select' },
                'Nº': { chave: 'numero' },
                'Destinatário': { chave: 'participante_nome' },
                'Operação': { chave: 'natureza_operacao' },
                'Valor': { chave: 'valor_total', op: '>=', tipoOrdenacao: 'numero' },
                'Situação': { chave: 'status', tipoPesquisa: 'select' },
                'Estoque': { chave: 'estoque_status', tipoPesquisa: 'select' },
                'Ambiente': { chave: 'ambiente', tipoPesquisa: 'select' }
            }
        })
        await paginacao('notasEmitidas')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir as notas emitidas: ${escFis(err.message)}` })
    }
}

function criarLinhaNotaEmitida(d) {
    return `
        <tr>
            <td class="fis-acoes-linha"><img src="imagens/pesquisar.svg" title="Abrir" onclick="abrirDocumentoFiscal('${escFis(d.id)}')"></td>
            <td>${dataFis(d.emissao || d.criado_em)}</td>
            <td>${escFis(d.app)}</td>
            <td>${d.modelo === 'NFSE' ? 'NFS-e' : 'NF-e'}</td>
            <td><b>${escFis(d.numero || '')}</b></td>
            <td class="fis-descricao">${escFis(d.participante_nome)}<small>${docFormatadoFis(d.participante_documento)}</small></td>
            <td><small>${escFis(d.natureza_operacao || '')}</small></td>
            <td class="fis-num">${d.valor_total != null ? dinheiro(d.valor_total) : ''}</td>
            <td>${etiquetaFis(STATUS_FISCAL, d.status)}</td>
            <td>${etiquetaFis(ESTOQUE_FISCAL, d.estoque_status)}</td>
            <td>${d.ambiente === 'homologacao' ? etiquetaEst('Homologação', '#d97706') : escFis(d.ambiente || '')}</td>
        </tr>`
}

function htmlNotaEmitida({ documento: d, itens, movimentos }) {
    const entrada = d.payload?.entrada || {}
    const editavel = ['RASCUNHO', 'REJEITADA'].includes(d.status)
    const t = d.valor_impostos || {}
    const impostos = d.modelo === 'NFSE'
        ? [['Serviço', t.servico], ['ISS', t.iss], ['Retido', t.total_retido], ['Líquido', t.liquido]]
        : [['Produtos', t.produtos], ['ICMS', t.icms], ['PIS', t.pis], ['COFINS', t.cofins], ['IBS', t.ibs], ['CBS', t.cbs], ['DIFAL', t.difal], ['Total', t.nota]]
    return `
        <div class="fis-painel fis-doc" data-doc-fiscal="${escFis(d.id)}">
            ${resumoDocumentoFis(d, [
                ['Destinatário', `${escFis(d.participante_nome)} <small>${docFormatadoFis(d.participante_documento)} ${escFis(d.participante_uf || '')}</small>`],
                [d.modelo === 'NFSE' ? 'NFS-e' : 'NF-e', `${escFis(d.numero || '—')}${d.serie ? ` / série ${escFis(d.serie)}` : ''}`],
                ['Empresa', `${escFis(d.app)} ${d.ambiente === 'homologacao' ? etiquetaEst('Homologação', '#d97706') : ''}`],
                ['Operação', escFis(d.natureza_operacao || '')],
                ['Situação', `${etiquetaFis(STATUS_FISCAL, d.status)} ${etiquetaFis(ESTOQUE_FISCAL, d.estoque_status)}`],
                ['Criada', `${dataHoraFis(d.criado_em)} <small>${escFis(d.criado_por || '')}</small>`]
            ])}
            ${d.chave ? `<div class="fis-chave">Chave: <code>${escFis(d.chave)}</code></div>` : ''}
            ${(d.mensagens || []).length ? `<div class="fis-alerta">${d.mensagens.map(escFis).join('<br>')}</div>` : ''}
            <div class="fis-totais">${impostos.filter(([, v]) => v).map(([k, v]) => `<div><span>${k}</span><b>${dinheiro(v)}</b></div>`).join('')}</div>
            <div class="fis-acoes-claras">
                ${editavel ? `
                    <button type="button" class="fis-botao" onclick="editarRascunhoFiscal('${escFis(d.id)}')">Editar</button>
                    <button type="button" class="fis-botao" onclick="emitirDocumentoFiscal('${escFis(d.id)}')">Emitir</button>
                    <button type="button" class="fis-mini" onclick="excluirRascunhoFiscal('${escFis(d.id)}')">Excluir rascunho</button>` : ''}
                ${d.status === 'PROCESSANDO' || d.status === 'AUTORIZADA' ? `<button type="button" class="fis-mini" onclick="consultarDocumentoFiscal('${escFis(d.id)}')">Atualizar situação</button>` : ''}
                ${d.status === 'AUTORIZADA' ? `
                    <button type="button" class="fis-mini" onclick="baixarArquivoFiscal('${escFis(d.id)}', 'danfe')">${d.modelo === 'NFSE' ? 'DANFSe' : 'DANFE'}</button>
                    <button type="button" class="fis-mini" onclick="baixarArquivoFiscal('${escFis(d.id)}', 'xml')">XML</button>
                    <button type="button" class="fis-mini" onclick="cancelarDocumentoFiscal('${escFis(d.id)}')">Cancelar nota</button>` : ''}
                ${!editavel ? `<button type="button" class="fis-mini" onclick="duplicarDocumentoFiscal('${escFis(d.id)}')">Duplicar</button>` : ''}
            </div>
            ${itens.length ? `
                <div class="fis-secao"><div class="fis-secao-topo"><b>Itens</b></div>
                    <div class="fis-tabela-rolagem"><table class="fis-tabela">
                        <thead><tr><th>#</th><th>Código</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th>Qtd</th><th>Unit.</th><th>Total</th><th>ICMS</th><th>PIS/COFINS</th></tr></thead>
                        <tbody>${itens.map(i => `
                            <tr>
                                <td class="fis-num">${i.n_item}</td><td><small>${escFis(i.codigo)}</small></td>
                                <td class="fis-descricao">${escFis(i.descricao)}</td><td><small>${escFis(i.ncm || '')}</small></td><td>${escFis(i.cfop || '')}</td>
                                <td class="fis-num">${qtdEst(i.quantidade)} ${escFis(i.unidade || '')}</td>
                                <td class="fis-num">${dinheiro(i.valor_unitario || 0)}</td><td class="fis-num">${dinheiro(i.valor_total || 0)}</td>
                                <td class="fis-num">${i.impostos?.icms ? dinheiro(i.impostos.icms) : ''}</td>
                                <td class="fis-num">${i.impostos?.pis || i.impostos?.cofins ? dinheiro((i.impostos.pis || 0) + (i.impostos.cofins || 0)) : ''}</td>
                            </tr>`).join('')}</tbody>
                    </table></div>
                </div>` : ''}
            ${d.modelo === 'NFSE' && entrada.dados?.descricao ? `<div class="fis-secao"><b>Serviço</b><div class="fis-texto">${escFis(entrada.dados.descricao).replace(/\n/g, '<br>')}</div></div>` : ''}
            ${movimentos?.length ? `
                <details class="fis-secao"><summary><b>Movimentos de estoque</b> (${movimentos.length})</summary>
                    <table class="fis-tabela"><tbody>${movimentos.map(m => linhaMovimentoEst(m, { comItem: true, acoes: false })).join('')}</tbody></table>
                </details>` : ''}
            ${historicoFiscal(d)}
        </div>`
}

async function editarRascunhoFiscal(id) {
    const { documento } = await apiFiscal('documento', { id })
    const anterior = document.querySelector(`[data-doc-fiscal="${CSS.escape(id)}"]`)?.closest('.popup')?.id
    if (anterior) removerPopup(anterior)
    const entrada = documento.payload?.entrada || {}
    if (documento.modelo === 'NFSE') formularioEmissaoNFSe({ ...entrada, id })
    else formularioEmissaoNFe({ ...entrada, id })
}

async function duplicarDocumentoFiscal(id) {
    const { documento } = await apiFiscal('documento', { id })
    const entrada = { ...(documento.payload?.entrada || {}) }
    delete entrada.id
    if (documento.modelo === 'NFSE') formularioEmissaoNFSe(entrada)
    else formularioEmissaoNFe(entrada)
}

async function emitirDocumentoFiscal(id) {
    const { documento: d } = await apiFiscal('documento', { id })
    const ok = await confirmarPopup({
        titulo: 'Emitir nota',
        mensagem: `${d.modelo === 'NFSE' ? 'NFS-e' : 'NF-e'} da <b>${escFis(d.app)}</b> para <b>${escFis(d.participante_nome)}</b>, ${dinheiro(d.valor_total || 0)}.<br>
            Ambiente: <b>${d.ambiente === 'producao' ? 'PRODUÇÃO (vale como nota fiscal)' : 'homologação (teste, sem valor fiscal)'}</b>`,
        textoConfirmar: 'Emitir'
    })
    if (!ok) return
    try {
        overlayAguarde()
        const r = await apiFiscal('emissao/emitir', { id })
        removerOverlay()
        if (r.avisos?.length) popup({ mensagem: r.avisos.map(escFis).join('<br>') })
        abrirDocumentoFiscal(id)
        if (controles.notasEmitidas) paginacao('notasEmitidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
        if (controles.notasEmitidas) paginacao('notasEmitidas')
    }
}

async function consultarDocumentoFiscal(id) {
    try {
        overlayAguarde()
        await apiFiscal('emissao/consultar', { id })
        removerOverlay()
        abrirDocumentoFiscal(id)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function cancelarDocumentoFiscal(id) {
    const justificativa = prompt('Justificativa do cancelamento (15 a 255 caracteres):')
    if (justificativa === null) return
    try {
        overlayAguarde()
        await apiFiscal('emissao/cancelar', { id, justificativa })
        removerOverlay()
        abrirDocumentoFiscal(id)
        if (controles.notasEmitidas) paginacao('notasEmitidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function excluirRascunhoFiscal(id) {
    const ok = await confirmarPopup({ titulo: 'Excluir rascunho', mensagem: 'O rascunho é apagado.', textoConfirmar: 'Excluir' })
    if (!ok) return
    try {
        await apiFiscal('emissao/excluir', { id })
        const janela = document.querySelector(`[data-doc-fiscal="${CSS.escape(id)}"]`)?.closest('.popup')?.id
        if (janela) removerPopup(janela)
        if (controles.notasEmitidas) paginacao('notasEmitidas')
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ================================================================ EMISSÃO (formulários)

let opcoesEmissaoFiscal = null
async function carregarOpcoesEmissao(forcar = false) {
    if (!opcoesEmissaoFiscal || forcar) opcoesEmissaoFiscal = await apiFiscal('emissao/opcoes')
    return opcoesEmissaoFiscal
}

const campoFis = (rotulo, conteudo, classe = '') => `<label class="fis-campo ${classe}"><span>${rotulo}</span>${conteudo}</label>`
const inputFis = (nome, valor = '', extra = '') => `<input class="fis-input" name="${nome}" value="${escFis(valor)}" ${extra}>`
const opcoesFis = (lista, valor) => lista.map(([v, t]) => `<option value="${escFis(v)}" ${String(v) === String(valor ?? '') ? 'selected' : ''}>${escFis(t)}</option>`).join('')

function blocoDestinatarioFis(dest = {}, { nfse = false } = {}) {
    return `
        <fieldset class="fis-passo">
            <legend><span class="fis-num-passo">2</span> ${nfse ? 'Tomador' : 'Destinatário'} <small>— digite o CPF/CNPJ: o GCS completa pelo cadastro e pelas notas anteriores</small></legend>
            <div class="fis-grade">
                ${campoFis('CPF / CNPJ', inputFis('d_documento', docFormatadoFis(dest.documento), 'inputmode="numeric" onchange="buscarParticipanteFis(this)"'), 'fis-destaque')}
                ${campoFis('Nome / razão social', inputFis('d_nome', dest.nome), 'fis-largo')}
                ${nfse ? '' : campoFis('Contribuinte do ICMS?', `<select class="fis-input" name="d_indicador_ie" onchange="agendarPreviaFis()">${opcoesFis([['1', '1 · Contribuinte (tem IE)'], ['2', '2 · Isento'], ['9', '9 · Não contribuinte']], dest.indicador_ie || '1')}</select>`)}
                ${nfse ? '' : campoFis('Inscrição estadual', inputFis('d_inscricao_estadual', dest.inscricao_estadual))}
                ${campoFis('CEP', inputFis('d_cep', dest.cep, 'inputmode="numeric" maxlength="9"'))}
                ${campoFis('Logradouro', inputFis('d_logradouro', dest.logradouro), 'fis-largo')}
                ${campoFis('Número', inputFis('d_numero', dest.numero))}
                ${campoFis('Complemento', inputFis('d_complemento', dest.complemento))}
                ${campoFis('Bairro', inputFis('d_bairro', dest.bairro))}
                ${campoFis('Município', inputFis('d_municipio', dest.municipio))}
                ${campoFis('UF', inputFis('d_uf', dest.uf, 'maxlength="2" style="text-transform: uppercase" onchange="agendarPreviaFis()"'))}
                ${campoFis('Código IBGE', inputFis('d_codigo_municipio', dest.codigo_municipio, 'inputmode="numeric" maxlength="7"'))}
                ${campoFis('E-mail', inputFis('d_email', dest.email, 'type="email"'))}
                ${campoFis('Telefone', inputFis('d_telefone', dest.telefone, 'inputmode="numeric"'))}
            </div>
            <input type="hidden" name="d_cliente_id" value="${escFis(dest.cliente_id || '')}">
            <div class="fis-aviso" data-aviso-destinatario></div>
        </fieldset>`
}

function lerDestinatarioFis(form) {
    const v = n => form.querySelector(`[name="d_${n}"]`)?.value?.trim() ?? ''
    return {
        documento: soDigFis(v('documento')), nome: v('nome'), indicador_ie: v('indicador_ie') || undefined,
        inscricao_estadual: v('inscricao_estadual'), cep: soDigFis(v('cep')), logradouro: v('logradouro'), numero: v('numero'),
        complemento: v('complemento'), bairro: v('bairro'), municipio: v('municipio'), uf: v('uf').toUpperCase(),
        codigo_municipio: soDigFis(v('codigo_municipio')), email: v('email'), telefone: soDigFis(v('telefone')),
        cliente_id: v('cliente_id') || undefined
    }
}

async function buscarParticipanteFis(input) {
    const form = input.closest('.fis-form')
    const doc = soDigFis(input.value)
    const aviso = form.querySelector('[data-aviso-destinatario]')
    if (!(doc.length === 11 || doc.length === 14)) {
        aviso.innerHTML = doc ? '<span class="fis-negativo">CPF/CNPJ incompleto</span>' : ''
        return
    }
    aviso.innerHTML = '<small>Buscando…</small>'
    try {
        const { participante: p } = await apiFiscal('participante', { documento: doc })
        input.value = docFormatadoFis(doc)
        if (!p?.fonte) {
            aviso.innerHTML = '<small>Não encontrado no cadastro nem em notas anteriores: preencha os dados.</small>'
            return
        }
        for (const [k, v] of Object.entries(p)) {
            const campo = form.querySelector(`[name="d_${k}"]`)
            if (campo && v != null && v !== '' && k !== 'documento') campo.value = k === 'indicador_ie' ? String(v) : v
        }
        aviso.innerHTML = `<small class="fis-positivo">Dados ${p.fonte === 'fiscal' ? 'de notas anteriores' : 'do cadastro de clientes'}: confira.</small>`
        agendarPreviaFis()
    } catch (err) {
        aviso.innerHTML = `<span class="fis-negativo">${escFis(err.message)}</span>`
    }
}

// ---------------------------------------------------------------- NF-e

async function formularioEmissaoNFe(inicial = {}) {
    let op
    try {
        overlayAguarde()
        op = await carregarOpcoesEmissao()
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    const empresas = op.empresas.filter(e => e.emite_nfe)
    const app = inicial.app || empresas.find(e => e.app === 'AC')?.app || empresas[0]?.app
    const o = inicial.opcoes || {}
    const elemento = `
        <div class="fis-form fis-form-emissao" data-form-nfe data-id="${escFis(inicial.id || '')}" oninput="agendarPreviaFis()" onchange="agendarPreviaFis()">
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">1</span> Empresa e operação</legend>
                <div class="fis-grade">
                    ${campoFis('Empresa', `<select class="fis-input" name="app" onchange="trocarEmpresaNFe(this)">${opcoesFis(empresas.map(e => [e.app, `${e.app} · ${e.razao_social}`]), app)}</select>`, 'fis-largo')}
                    ${campoFis('Operação', `<select class="fis-input" name="operacao_id"></select>`, 'fis-largo')}
                </div>
                <div class="fis-aviso" data-aviso-empresa></div>
            </fieldset>
            ${blocoDestinatarioFis(inicial.destinatario)}
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">3</span> Itens <small>— do cadastro do GCS (NCM e origem vêm do item)</small></legend>
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela fis-itens-emissao">
                        <thead><tr><th>Item</th><th>NCM</th><th>Origem</th><th>Un.</th><th>Qtd</th><th>Valor unit.</th><th>Desconto</th><th>Total</th><th></th></tr></thead>
                        <tbody data-itens-nfe></tbody>
                    </table>
                </div>
                <button type="button" class="fis-mini" onclick="adicionarItemNFe()">+ Item</button>
            </fieldset>
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">4</span> Complementos</legend>
                <div class="fis-grade">
                    ${campoFis('Frete', `<select class="fis-input" name="modalidade_frete">${opcoesFis([['9', 'Sem frete'], ['0', 'Por conta do emitente (CIF)'], ['1', 'Por conta do destinatário (FOB)'], ['2', 'Terceiros']], o.modalidade_frete ?? '9')}</select>`)}
                    ${campoFis('Valor do frete (R$)', inputFis('valor_frete', o.valor_frete || '', 'type="number" min="0" step="0.01"'))}
                    ${campoFis('Consumidor final', `<select class="fis-input" name="consumidor_final">${opcoesFis([['', 'Automático (pela IE)'], ['1', 'Sim'], ['0', 'Não']], o.consumidor_final ?? '')}</select>`)}
                    ${campoFis('Orçamento / departamento', inputFis('orcamento', inicial.orcamento))}
                    ${campoFis('Chamado', inputFis('chamado', inicial.chamado))}
                </div>
                ${campoFis('Chave(s) da NF-e referenciada <small>(retorno, devolução; uma por linha)</small>', `<textarea class="fis-input" name="referenciadas" rows="2">${escFis((o.referenciadas || []).join('\n'))}</textarea>`)}
                ${campoFis('Informações complementares', `<textarea class="fis-input" name="informacoes_complementares" rows="2">${escFis(o.informacoes_complementares || '')}</textarea>`)}
            </fieldset>
            <div class="fis-previa" data-previa></div>
        </div>`
    popup({
        titulo: inicial.id ? 'Editar NF-e' : 'Emitir NF-e',
        linhas: [{ elemento }],
        botoes: [
            { texto: 'Salvar rascunho', img: 'salvo', funcao: 'salvarEmissaoFis(false, this)' },
            { texto: 'Emitir', img: 'concluido', funcao: 'salvarEmissaoFis(true, this)' }
        ]
    })
    const form = document.querySelector('[data-form-nfe]')
    trocarEmpresaNFe(form.querySelector('[name="app"]'), inicial.operacao_id)
    for (const item of inicial.itens?.length ? inicial.itens : [{}]) adicionarItemNFe(item)
    agendarPreviaFis()
}

function trocarEmpresaNFe(select, operacaoInicial) {
    const form = select.closest('.fis-form')
    const app = select.value
    const op = opcoesEmissaoFiscal
    const empresa = op.empresas.find(e => e.app === app)
    const lista = op.operacoes.filter(o => o.app === app)
    const atual = operacaoInicial || form.querySelector('[name="operacao_id"]').value?.replace(/^[A-Z]+_/, `${app}_`)
    form.querySelector('[name="operacao_id"]').innerHTML = opcoesFis(lista.map(o => [o.id, `${o.descricao} (${o.cfop_interno}/${o.cfop_interestadual})`]), lista.some(o => o.id === atual) ? atual : lista[0]?.id)
    form.querySelector('[data-aviso-empresa]').innerHTML = avisoEmpresaFis(empresa)
}

function avisoEmpresaFis(empresa) {
    if (!empresa) return ''
    return `${empresa.ambiente === 'producao' ? etiquetaEst('PRODUÇÃO', '#b91c1c') : etiquetaEst('Homologação (teste)', '#d97706')}
        ${empresa.crt === 1 ? etiquetaEst('Simples Nacional', '#7c3aed') : etiquetaEst('Regime normal', '#2563eb')}
        ${empresa.focus ? '' : '<small class="fis-pendente">Sem token da Focus: salva como rascunho, emissão fica para depois.</small>'}`
}

let sequenciaItemFis = 0
function adicionarItemNFe(item = {}) {
    const corpo = document.querySelector('[data-itens-nfe]')
    if (!corpo) return
    const n = ++sequenciaItemFis
    const tr = document.createElement('tr')
    tr.dataset.linha = n
    tr.innerHTML = `
        <td class="fis-item-cel">
            <input type="hidden" name="item_id" value="${escFis(item.item_id || '')}">
            <input type="hidden" name="codigo" value="${escFis(item.codigo || '')}">
            <input class="fis-input" name="descricao" value="${escFis(item.descricao || '')}" placeholder="Buscar item do cadastro…"
                onkeydown="if (event.key === 'Enter') { event.preventDefault(); buscarItemEmissaoFis(this) }" onchange="if (!this.closest('tr').querySelector('[name=item_id]').value) buscarItemEmissaoFis(this)">
            <small data-item-info>${item.item_id ? escFis(item.codigo || item.item_id) : ''}</small>
        </td>
        <td><input class="fis-input fis-curto" name="ncm" value="${escFis(item.ncm || '')}" maxlength="10" inputmode="numeric"></td>
        <td><select class="fis-input fis-curto" name="origem">${opcoesFis(Object.entries(ORIGENS_MERCADORIA), item.origem ?? '0')}</select></td>
        <td><input class="fis-input fis-curto" name="unidade" value="${escFis(item.unidade || 'UN')}" maxlength="6"></td>
        <td><input class="fis-input fis-curto" name="quantidade" type="number" min="0" step="any" value="${escFis(item.quantidade || 1)}"></td>
        <td><input class="fis-input fis-curto" name="valor_unitario" type="number" min="0" step="0.0001" value="${escFis(item.valor_unitario || '')}"></td>
        <td><input class="fis-input fis-curto" name="desconto" type="number" min="0" step="0.01" value="${escFis(item.desconto || '')}"></td>
        <td class="fis-num" data-total-item></td>
        <td><button type="button" class="fis-mini" title="Remover" onclick="this.closest('tr').remove(); agendarPreviaFis()">×</button></td>`
    corpo.appendChild(tr)
}

// Última lista de itens buscados na emissão (o botão "Usar" aponta pelo índice).
let itensBuscadosEmissaoFis = []

async function buscarItemEmissaoFis(input) {
    const termo = input.value.trim()
    if (termo.length < 2) return
    try {
        const { itens } = await apiFiscal('itens/sugestoes', { texto: termo, limite: 12 })
        itensBuscadosEmissaoFis = itens
        const linha = soDigFis(input.closest('tr').dataset.linha)
        const lista = itens.map((c, i) => `
            <tr>
                <td><b>${escFis(c.codigo)}</b></td>
                <td class="fis-descricao">${escFis(c.descricao)}<small>${[c.fabricante, c.modelo].filter(Boolean).map(escFis).join(' · ')}</small></td>
                <td><small>${escFis(c.ncm || 'sem NCM')}</small></td>
                <td class="fis-num">${c.saldo != null ? qtdEst(c.saldo) : ''}</td>
                <td><button type="button" class="fis-botao" onclick="usarItemEmissaoFis('${linha}', ${i}, this)">Usar</button></td>
            </tr>`).join('')
        popup({
            titulo: 'Escolher item',
            elemento: `<div class="fis-painel"><table class="fis-tabela"><thead><tr><th>Código</th><th>Descrição</th><th>NCM</th><th>Saldo</th><th></th></tr></thead>
                <tbody>${lista || '<tr><td colspan="5" class="fis-vazio">Nada encontrado.</td></tr>'}</tbody></table></div>`
        })
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function usarItemEmissaoFis(linha, indice, botao) {
    const c = itensBuscadosEmissaoFis[indice]
    removerPopup(botao.closest('.popup')?.id)
    if (!c) return
    const tr = document.querySelector(`[data-itens-nfe] tr[data-linha="${CSS.escape(linha)}"]`)
    if (!tr) return
    const set = (n, v) => { const el = tr.querySelector(`[name="${n}"]`); if (el && v != null) el.value = v }
    set('item_id', c.id)
    set('codigo', c.codigo)
    set('descricao', c.descricao)
    set('ncm', c.ncm || '')
    set('unidade', c.unidade || 'UN')
    tr.querySelector('[data-item-info]').textContent = `${c.codigo}${c.saldo != null ? ` · saldo ${qtdEst(c.saldo)}` : ''}${c.ncm ? '' : ' · SEM NCM no cadastro'}`
    agendarPreviaFis()
}

function lerEmissaoNFe(form) {
    const v = n => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? ''
    const itens = [...form.querySelectorAll('[data-itens-nfe] tr')].map(tr => {
        const c = n => tr.querySelector(`[name="${n}"]`)?.value?.trim() ?? ''
        return {
            item_id: c('item_id') || undefined, codigo: c('codigo') || undefined, descricao: c('descricao'),
            ncm: soDigFis(c('ncm')), origem: c('origem'), unidade: c('unidade'),
            quantidade: Number(c('quantidade')) || 0, valor_unitario: Number(c('valor_unitario')) || 0, desconto: Number(c('desconto')) || 0
        }
    }).filter(i => i.descricao || i.item_id)
    return {
        modelo: 'NFE',
        app: v('app'),
        operacao_id: v('operacao_id'),
        destinatario: lerDestinatarioFis(form),
        itens,
        opcoes: {
            modalidade_frete: v('modalidade_frete'),
            valor_frete: Number(v('valor_frete')) || 0,
            consumidor_final: v('consumidor_final') === '' ? undefined : v('consumidor_final'),
            referenciadas: v('referenciadas').split(/\s+/).map(soDigFis).filter(Boolean),
            informacoes_complementares: v('informacoes_complementares')
        },
        orcamento: v('orcamento'),
        chamado: v('chamado')
    }
}

// ---------------------------------------------------------------- NFS-e

async function formularioEmissaoNFSe(inicial = {}) {
    let op
    try {
        overlayAguarde()
        op = await carregarOpcoesEmissao()
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    const empresas = op.empresas.filter(e => e.emite_nfse)
    const app = inicial.app || empresas.find(e => e.app === 'AC')?.app || empresas[0]?.app
    const d = inicial.dados || {}
    const elemento = `
        <div class="fis-form fis-form-emissao" data-form-nfse data-id="${escFis(inicial.id || '')}" oninput="agendarPreviaFis()" onchange="agendarPreviaFis()">
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">1</span> Empresa e serviço</legend>
                <div class="fis-grade">
                    ${campoFis('Empresa', `<select class="fis-input" name="app" onchange="trocarEmpresaNFSe(this)">${opcoesFis(empresas.map(e => [e.app, `${e.app} · ${e.razao_social}`]), app)}</select>`, 'fis-largo')}
                    ${campoFis('Serviço', `<select class="fis-input" name="servico_id" onchange="trocarServicoNFSe(this)"></select>`, 'fis-largo')}
                </div>
                <div class="fis-aviso" data-aviso-empresa></div>
            </fieldset>
            ${blocoDestinatarioFis(inicial.destinatario, { nfse: true })}
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">3</span> Serviço prestado</legend>
                <div class="fis-grade">
                    ${campoFis('Valor do serviço (R$)', inputFis('valor', d.valor || '', 'type="number" min="0" step="0.01"'), 'fis-destaque')}
                    ${campoFis('Competência', inputFis('data_competencia', d.data_competencia || new Date().toLocaleDateString('en-CA'), 'type="date"'))}
                    ${campoFis('Município da prestação (IBGE)', inputFis('codigo_municipio_prestacao', d.codigo_municipio_prestacao || '', 'inputmode="numeric" maxlength="7" placeholder="vazio = do tomador"'))}
                    ${campoFis('Orçamento / departamento', inputFis('orcamento', inicial.orcamento))}
                    ${campoFis('Chamado', inputFis('chamado', inicial.chamado))}
                </div>
                ${campoFis('Discriminação do serviço', `<textarea class="fis-input" name="descricao" rows="4">${escFis(d.descricao || '')}</textarea>`)}
                <div class="fis-retencoes" data-retencoes></div>
            </fieldset>
            <div class="fis-previa" data-previa></div>
        </div>`
    popup({
        titulo: inicial.id ? 'Editar NFS-e' : 'Emitir NFS-e',
        linhas: [{ elemento }],
        botoes: [
            { texto: 'Salvar rascunho', img: 'salvo', funcao: 'salvarEmissaoFis(false, this)' },
            { texto: 'Emitir', img: 'concluido', funcao: 'salvarEmissaoFis(true, this)' }
        ]
    })
    const form = document.querySelector('[data-form-nfse]')
    trocarEmpresaNFSe(form.querySelector('[name="app"]'), inicial.servico_id, d)
}

function trocarEmpresaNFSe(select, servicoInicial, dados = {}) {
    const form = select.closest('.fis-form')
    const app = select.value
    const op = opcoesEmissaoFiscal
    const lista = op.servicos.filter(s => s.app === app)
    const atual = servicoInicial || form.querySelector('[name="servico_id"]').value
    form.querySelector('[name="servico_id"]').innerHTML = opcoesFis(lista.map(s => [s.id, `${s.codigo_lc116} · ${s.descricao} (ISS ${String(s.aliquota_iss).replace('.', ',')}%)`]), lista.some(s => s.id === atual) ? atual : lista[0]?.id)
    const empresa = op.empresas.find(e => e.app === app)
    form.querySelector('[data-aviso-empresa]').innerHTML = `${avisoEmpresaFis(empresa)}
        ${empresa?.nfse_padrao === 'municipal' ? '<small class="fis-pendente">Esta empresa emite pelo sistema da prefeitura (não pelo padrão nacional).</small>' : ''}`
    trocarServicoNFSe(form.querySelector('[name="servico_id"]'), dados)
}

function trocarServicoNFSe(select, dados = {}) {
    const form = select.closest('.fis-form')
    const s = opcoesEmissaoFiscal.servicos.find(x => x.id === select.value)
    const alvo = form.querySelector('[data-retencoes]')
    if (!s) { alvo.innerHTML = ''; return }
    const ret = s.retencoes || {}
    const marcado = (t, padrao) => (dados.retencoes?.[t] ?? padrao) ? 'checked' : ''
    alvo.innerHTML = `
        <span>Reter:</span>
        <label class="fis-check"><input type="checkbox" name="iss_retido" ${marcado('iss', dados.iss_retido ?? s.iss_retido)}> ISS ${String(s.aliquota_iss).replace('.', ',')}%</label>
        ${['pis', 'cofins', 'csll', 'ir', 'inss'].filter(t => Number(ret[t]?.aliquota)).map(t => `
            <label class="fis-check"><input type="checkbox" name="reter_${t}" ${marcado(t, ret[t]?.reter)}> ${t.toUpperCase()} ${String(ret[t].aliquota).replace('.', ',')}%</label>`).join('')}`
    const desc = form.querySelector('[name="descricao"]')
    if (!desc.value && s.discriminacao_padrao) desc.value = s.discriminacao_padrao
    agendarPreviaFis()
}

function lerEmissaoNFSe(form) {
    const v = n => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? ''
    const marcado = n => form.querySelector(`[name="${n}"]`)?.checked
    const destinatario = lerDestinatarioFis(form)
    const retencoes = {}
    for (const t of ['pis', 'cofins', 'csll', 'ir', 'inss']) {
        const el = form.querySelector(`[name="reter_${t}"]`)
        if (el) retencoes[t] = el.checked
    }
    return {
        modelo: 'NFSE',
        app: v('app'),
        servico_id: v('servico_id'),
        destinatario,
        dados: {
            valor: Number(v('valor')) || 0,
            descricao: v('descricao'),
            data_competencia: v('data_competencia'),
            codigo_municipio_prestacao: soDigFis(v('codigo_municipio_prestacao')) || destinatario.codigo_municipio,
            iss_retido: marcado('iss_retido'),
            retencoes
        },
        orcamento: v('orcamento'),
        chamado: v('chamado')
    }
}

// ---------------------------------------------------------------- prévia e salvar

let temporizadorPreviaFis = null
function agendarPreviaFis() {
    clearTimeout(temporizadorPreviaFis)
    temporizadorPreviaFis = setTimeout(atualizarPreviaFis, 600)
}

function formEmissaoAberto() {
    return document.querySelector('[data-form-nfe], [data-form-nfse]')
}

function lerEmissaoFis(form) {
    return form.matches('[data-form-nfse]') ? lerEmissaoNFSe(form) : lerEmissaoNFe(form)
}

async function atualizarPreviaFis() {
    const form = formEmissaoAberto()
    if (!form) return
    const alvo = form.querySelector('[data-previa]')
    const entrada = lerEmissaoFis(form)
    // Total por linha na hora (a prévia do servidor confirma os impostos).
    form.querySelectorAll('[data-itens-nfe] tr').forEach(tr => {
        const q = Number(tr.querySelector('[name="quantidade"]').value) || 0
        const u = Number(tr.querySelector('[name="valor_unitario"]').value) || 0
        const d = Number(tr.querySelector('[name="desconto"]').value) || 0
        tr.querySelector('[data-total-item]').textContent = q && u ? dinheiroTexto(q * u - d) : ''
    })
    if (!entrada.app || (entrada.modelo === 'NFE' && !entrada.itens.length)) { alvo.innerHTML = ''; return }
    try {
        const r = await apiFiscal('emissao/previa', entrada)
        if (formEmissaoAberto() !== form) return
        const t = r.totais || {}
        const linhas = r.modelo === 'NFSE'
            ? [['Serviço', t.servico], ['ISS', t.iss], ...Object.entries(t.retencoes || {}).filter(([, x]) => x.valor).map(([k, x]) => [`${k.toUpperCase()}${x.reter ? ' (retido)' : ''}`, x.valor]), ['Total retido', t.total_retido], ['Líquido a receber', t.liquido]]
            : [['Produtos', t.produtos], ['Desconto', t.desconto], ['Frete', t.frete], ['ICMS', t.icms], ['DIFAL', t.difal], ['PIS', t.pis], ['COFINS', t.cofins], ['IBS', t.ibs], ['CBS', t.cbs], ['Total da nota', t.nota]]
        alvo.innerHTML = `
            <div class="fis-totais">${linhas.filter(([, v]) => v).map(([k, v]) => `<div><span>${k}</span><b>${dinheiro(v)}</b></div>`).join('')}</div>
            ${r.erros?.length ? `<div class="fis-erros"><b>Falta corrigir:</b><ul>${r.erros.map(e => `<li>${escFis(e)}</li>`).join('')}</ul></div>` : '<div class="fis-ok">Pronta para emitir.</div>'}
            ${r.avisos?.length ? `<div class="fis-alerta">${r.avisos.map(escFis).join('<br>')}</div>` : ''}
            ${r.itens?.length ? `<small class="fis-dica">CFOP ${[...new Set(r.itens.map(i => i.cfop))].join(', ')}</small>` : ''}`
    } catch (err) {
        alvo.innerHTML = `<div class="fis-erros">${mensagemErroEst(err)}</div>`
    }
}

async function salvarEmissaoFis(emitir, botao) {
    const form = formEmissaoAberto()
    if (!form) return
    const entrada = lerEmissaoFis(form)
    const id = form.dataset.id || null
    try {
        overlayAguarde()
        const r = await apiFiscal('emissao/rascunho', { id, ...entrada })
        form.dataset.id = r.id
        removerOverlay()
        if (!emitir) {
            removerPopup(botao?.closest('.popup')?.id)
            popup({ mensagem: `Rascunho salvo.${r.erros?.length ? ' Ainda há pendências para emitir.' : ''}`, imagem: 'imagens/concluido.png', tempo: 3 })
            if (controles.notasEmitidas) paginacao('notasEmitidas')
            return
        }
        if (r.erros?.length) {
            atualizarPreviaFis()
            return popup({ mensagem: `Rascunho salvo, mas falta corrigir:<ul class="fis-lista-erros">${r.erros.map(e => `<li>${escFis(e)}</li>`).join('')}</ul>` })
        }
        removerPopup(botao?.closest('.popup')?.id)
        await emitirDocumentoFiscal(r.id)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ================================================================ CONFIGURAÇÃO

const estadoConfigFis = { aba: 'empresas', dados: null }

async function telaConfigFiscal(aba = estadoConfigFis.aba) {
    estadoConfigFis.aba = aba
    overlayAguarde()
    try {
        estadoConfigFis.dados = await apiFiscal('config')
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    const abas = { empresas: 'Empresas', operacoes: 'Operações (NF-e)', servicos: 'Serviços (NFS-e)' }
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>Configuração fiscal</h2></div>
            <div class="fis-painel">
                <nav class="relatorio-dep-abas" role="tablist">${Object.entries(abas).map(([k, t]) => `
                    <button type="button" class="${k === aba ? 'ativa' : ''}" onclick="telaConfigFiscal('${k}')">${t}</button>`).join('')}</nav>
                <div class="fis-explica">${{
                    empresas: 'Dados das empresas emitentes (vieram do cadastro do Omie). <b>Ambiente</b>: homologação emite notas de teste, sem valor fiscal; só adm/diretoria passam para produção. O token da Focus NFe fica no servidor (SCRIPTS/config.js).',
                    operacoes: 'Perfis de operação copiados das notas emitidas pelo Omie (CFOP, CST e alíquotas). Na emissão, o GCS escolhe o CFOP interno ou interestadual pela UF do destinatário e calcula ICMS, PIS/COFINS (base sem ICMS) e IBS/CBS. <b>Confira com a contabilidade antes de ir para produção.</b>',
                    servicos: 'Serviços das NFS-e (copiados das notas do Omie de mai–nov/2026): item da LC 116, código de tributação nacional, NBS, alíquota de ISS e retenções federais padrão.'
                }[aba]}</div>
                <div data-config-fiscal>${{ empresas: htmlConfigEmpresas, operacoes: htmlConfigOperacoes, servicos: htmlConfigServicos }[aba](estadoConfigFis.dados)}</div>
            </div>
        </div>`
}

function htmlConfigEmpresas({ empresas }) {
    return `<div class="fis-cartoes-empresa">${empresas.map(e => `
        <div class="fis-cartao-empresa" data-empresa="${escFis(e.app)}">
            <div class="fis-secao-topo"><b>${escFis(e.app)}</b> <small>${escFis(e.razao_social)}</small></div>
            <div class="fis-chips">
                ${e.crt === 1 ? etiquetaEst('Simples Nacional', '#7c3aed') : etiquetaEst('Regime normal', '#2563eb')}
                ${etiquetaEst(`Focus homologação ${e.focus_homologacao ? '✓' : '✗'}`, e.focus_homologacao ? '#15803d' : '#94a3b8')}
                ${etiquetaEst(`Focus produção ${e.focus_producao ? '✓' : '✗'}`, e.focus_producao ? '#15803d' : '#94a3b8')}
                ${e.ativo ? '' : etiquetaEst('Desativada', '#b91c1c')}
            </div>
            <div class="fis-grade">
                ${campoFis('CNPJ', `<input class="fis-input" value="${docFormatadoFis(e.cnpj)}" disabled>`)}
                ${campoFis('Inscrição estadual', inputFis('inscricao_estadual', e.inscricao_estadual))}
                ${campoFis('Inscrição municipal', inputFis('inscricao_municipal', e.inscricao_municipal))}
                ${campoFis('CRT', `<select class="fis-input" name="crt">${opcoesFis([['1', '1 · Simples Nacional'], ['2', '2 · Simples (excesso)'], ['3', '3 · Regime normal']], e.crt)}</select>`)}
                ${campoFis('Município', `<input class="fis-input" value="${escFis(`${e.municipio}/${e.uf} (${e.codigo_municipio})`)}" disabled>`)}
                ${campoFis('Ambiente', `<select class="fis-input" name="ambiente">${opcoesFis([['homologacao', 'Homologação (teste)'], ['producao', 'PRODUÇÃO']], e.ambiente)}</select>`)}
                ${campoFis('Série NF-e', inputFis('serie_nfe', e.serie_nfe, 'type="number" min="1"'))}
                ${campoFis('NFS-e', `<select class="fis-input" name="nfse_padrao">${opcoesFis([['nacional', 'Padrão nacional'], ['municipal', 'Sistema da prefeitura']], e.nfse_padrao)}</select>`)}
            </div>
            <div class="fis-chips">
                <label class="fis-check"><input type="checkbox" name="emite_nfe" ${e.emite_nfe ? 'checked' : ''}> Emite NF-e</label>
                <label class="fis-check"><input type="checkbox" name="emite_nfse" ${e.emite_nfse ? 'checked' : ''}> Emite NFS-e</label>
                <label class="fis-check"><input type="checkbox" name="recebe_notas" ${e.recebe_notas ? 'checked' : ''}> Busca notas recebidas</label>
                <label class="fis-check"><input type="checkbox" name="ativo" ${e.ativo ? 'checked' : ''}> Ativa</label>
            </div>
            ${e.observacao ? `<small class="fis-dica">${escFis(e.observacao)}</small>` : ''}
            <div class="fis-acoes-claras"><button type="button" class="fis-botao" onclick="salvarEmpresaFiscal('${escFis(e.app)}')">Salvar ${escFis(e.app)}</button></div>
        </div>`).join('')}</div>`
}

async function salvarEmpresaFiscal(app) {
    const card = document.querySelector(`[data-empresa="${CSS.escape(app)}"]`)
    const v = n => card.querySelector(`[name="${n}"]`)
    const dados = {
        app,
        inscricao_estadual: soDigFis(v('inscricao_estadual').value),
        inscricao_municipal: soDigFis(v('inscricao_municipal').value),
        crt: Number(v('crt').value),
        ambiente: v('ambiente').value,
        serie_nfe: Number(v('serie_nfe').value) || 1,
        nfse_padrao: v('nfse_padrao').value,
        emite_nfe: v('emite_nfe').checked,
        emite_nfse: v('emite_nfse').checked,
        recebe_notas: v('recebe_notas').checked,
        ativo: v('ativo').checked
    }
    if (dados.ambiente === 'producao') {
        const ok = await confirmarPopup({ titulo: 'Produção', mensagem: `Notas emitidas pela <b>${escFis(app)}</b> passam a ter <b>valor fiscal</b>. Confirme que os testes em homologação foram feitos.`, textoConfirmar: 'Passar para produção' })
        if (!ok) return
    }
    try {
        await apiFiscal('config/salvar', { tipo: 'empresa', dados })
        opcoesEmissaoFiscal = null
        popup({ mensagem: `${escFis(app)} salva.`, imagem: 'imagens/concluido.png', tempo: 3 })
        telaConfigFiscal('empresas')
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function resumoRegrasFis(r = {}, crt) {
    const icms = r.icms || {}
    return [
        crt === 1 ? `CSOSN ${icms.csosn || '—'}` : `ICMS ${icms.cst || '—'}${icms.aliquota_interna ? ` ${icms.aliquota_interna}% / ${icms.aliquota_interestadual}% / imp. ${icms.aliquota_importado}%` : ''}`,
        `PIS ${r.pis?.cst || '—'} ${r.pis?.aliquota || 0}%`,
        `COFINS ${r.cofins?.cst || '—'} ${r.cofins?.aliquota || 0}%`,
        r.ipi?.cst ? `IPI ${r.ipi.cst}` : '',
        r.ibs_cbs?.cst ? `IBS/CBS ${r.ibs_cbs.cst}/${r.ibs_cbs.classificacao}` : ''
    ].filter(Boolean).join(' · ')
}

function htmlConfigOperacoes({ operacoes, empresas }) {
    const crt = Object.fromEntries(empresas.map(e => [e.app, e.crt]))
    return `
        <div class="fis-acoes-claras"><button type="button" class="fis-botao" onclick="formularioOperacaoFiscal()">+ Nova operação</button></div>
        <div class="fis-tabela-rolagem fis-alta"><table class="fis-tabela">
            <thead><tr><th>Empresa</th><th>Operação</th><th>Natureza</th><th>CFOP</th><th>Tributação</th><th>Estoque</th><th></th></tr></thead>
            <tbody>${operacoes.map(o => `
                <tr class="${o.ativo ? '' : 'fis-estornado'}">
                    <td>${escFis(o.app)}</td>
                    <td><b>${escFis(o.descricao)}</b>${o.exige_nota_referenciada ? '<small>exige nota referenciada</small>' : ''}</td>
                    <td><small>${escFis(o.natureza_operacao)}</small></td>
                    <td>${escFis(o.cfop_interno)} / ${escFis(o.cfop_interestadual)}</td>
                    <td><small>${escFis(resumoRegrasFis(o.regras, crt[o.app]))}</small></td>
                    <td>${o.movimenta_estoque === 'SAIDA' ? 'Saída' : o.movimenta_estoque === 'ENTRADA' ? 'Entrada' : '—'}</td>
                    <td><button type="button" class="fis-mini" onclick="formularioOperacaoFiscal('${escFis(o.id)}')">Editar</button></td>
                </tr>`).join('')}</tbody>
        </table></div>`
}

function formularioOperacaoFiscal(id = null) {
    const { operacoes, empresas } = estadoConfigFis.dados
    const o = operacoes.find(x => x.id === id) || { app: 'AC', regras: {}, ativo: true, tipo_documento: 1, finalidade: 1, movimenta_estoque: 'SAIDA' }
    const r = o.regras || {}
    const n = (nome, valor, extra = 'type="number" step="0.01"') => inputFis(nome, valor ?? '', extra)
    popup({
        titulo: id ? `Operação ${o.descricao}` : 'Nova operação',
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-operacao data-id="${escFis(o.id || '')}">
                    <div class="fis-grade">
                        ${campoFis('Empresa', `<select class="fis-input" name="app" ${id ? 'disabled' : ''}>${opcoesFis(empresas.map(e => [e.app, e.app]), o.app)}</select>`)}
                        ${campoFis('Código', inputFis('codigo', o.codigo, id ? 'disabled' : 'placeholder="ex.: VENDA_DEMO"'))}
                        ${campoFis('Descrição', inputFis('descricao', o.descricao), 'fis-largo')}
                        ${campoFis('Natureza da operação (vai na nota)', inputFis('natureza_operacao', o.natureza_operacao, 'maxlength="60"'), 'fis-largo')}
                        ${campoFis('CFOP dentro da UF', inputFis('cfop_interno', o.cfop_interno, 'maxlength="5"'))}
                        ${campoFis('CFOP fora da UF', inputFis('cfop_interestadual', o.cfop_interestadual, 'maxlength="5"'))}
                        ${campoFis('Estoque', `<select class="fis-input" name="movimenta_estoque">${opcoesFis([['SAIDA', 'Dá saída'], ['', 'Não movimenta']], o.movimenta_estoque || '')}</select>`)}
                        ${campoFis('Finalidade', `<select class="fis-input" name="finalidade">${opcoesFis([['1', 'Normal'], ['4', 'Devolução'], ['2', 'Complementar'], ['3', 'Ajuste']], o.finalidade)}</select>`)}
                    </div>
                    <label class="fis-check"><input type="checkbox" name="exige_nota_referenciada" ${o.exige_nota_referenciada ? 'checked' : ''}> Exige chave da nota de origem (retorno/devolução)</label>
                    <fieldset class="fis-passo"><legend>ICMS</legend><div class="fis-grade">
                        ${campoFis('CST (regime normal)', inputFis('icms_cst', r.icms?.cst, 'maxlength="2"'))}
                        ${campoFis('CSOSN (Simples)', inputFis('icms_csosn', r.icms?.csosn, 'maxlength="3"'))}
                        ${campoFis('Alíquota interna %', n('icms_aliquota_interna', r.icms?.aliquota_interna))}
                        ${campoFis('Interestadual %', n('icms_aliquota_interestadual', r.icms?.aliquota_interestadual))}
                        ${campoFis('Importados fora da UF %', n('icms_aliquota_importado', r.icms?.aliquota_importado))}
                        ${campoFis('Crédito Simples %', n('icms_aliquota_credito', r.icms?.aliquota_credito))}
                    </div></fieldset>
                    <fieldset class="fis-passo"><legend>PIS / COFINS / IPI</legend><div class="fis-grade">
                        ${campoFis('PIS CST', inputFis('pis_cst', r.pis?.cst, 'maxlength="2"'))}
                        ${campoFis('PIS %', n('pis_aliquota', r.pis?.aliquota))}
                        ${campoFis('COFINS CST', inputFis('cofins_cst', r.cofins?.cst, 'maxlength="2"'))}
                        ${campoFis('COFINS %', n('cofins_aliquota', r.cofins?.aliquota))}
                        ${campoFis('IPI CST', inputFis('ipi_cst', r.ipi?.cst, 'maxlength="2"'))}
                        ${campoFis('IPI enquadramento', inputFis('ipi_enquadramento', r.ipi?.enquadramento, 'maxlength="3"'))}
                    </div></fieldset>
                    <fieldset class="fis-passo"><legend>IBS / CBS (regime normal)</legend><div class="fis-grade">
                        ${campoFis('CST', inputFis('ibs_cst', r.ibs_cbs?.cst, 'maxlength="3"'))}
                        ${campoFis('cClassTrib', inputFis('ibs_classificacao', r.ibs_cbs?.classificacao, 'maxlength="6"'))}
                        ${campoFis('CBS %', n('cbs_aliquota', r.ibs_cbs?.cbs_aliquota))}
                        ${campoFis('IBS UF %', n('ibs_uf_aliquota', r.ibs_cbs?.ibs_uf_aliquota))}
                        ${campoFis('IBS Mun %', n('ibs_mun_aliquota', r.ibs_cbs?.ibs_mun_aliquota))}
                    </div></fieldset>
                    ${campoFis('Informações complementares padrão', `<textarea class="fis-input" name="informacoes_complementares" rows="2">${escFis(o.informacoes_complementares || '')}</textarea>`)}
                    <label class="fis-check"><input type="checkbox" name="ativo" ${o.ativo ? 'checked' : ''}> Ativa</label>
                </div>`
        }],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarOperacaoFiscal(this)' }]
    })
}

async function salvarOperacaoFiscal(botao) {
    const f = document.querySelector('[data-form-operacao]')
    const v = n => f.querySelector(`[name="${n}"]`)?.value?.trim() ?? ''
    const num = n => v(n) === '' ? undefined : Number(v(n).replace(',', '.'))
    const limpo = o => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined && x !== ''))
    const original = estadoConfigFis.dados.operacoes.find(o => o.id === f.dataset.id) || {}
    const dados = {
        id: f.dataset.id || undefined,
        app: v('app'), codigo: v('codigo'), descricao: v('descricao'), natureza_operacao: v('natureza_operacao'),
        cfop_interno: v('cfop_interno'), cfop_interestadual: v('cfop_interestadual'),
        movimenta_estoque: v('movimenta_estoque') || null, finalidade: Number(v('finalidade')), tipo_documento: 1,
        exige_nota_referenciada: f.querySelector('[name="exige_nota_referenciada"]').checked,
        informacoes_complementares: v('informacoes_complementares'),
        ativo: f.querySelector('[name="ativo"]').checked,
        ordem: original.ordem,
        regras: {
            ...(original.regras || {}),
            icms: limpo({ ...(original.regras?.icms || {}), cst: v('icms_cst'), csosn: v('icms_csosn'), aliquota_interna: num('icms_aliquota_interna'), aliquota_interestadual: num('icms_aliquota_interestadual'), aliquota_importado: num('icms_aliquota_importado'), aliquota_credito: num('icms_aliquota_credito') }),
            pis: limpo({ cst: v('pis_cst'), aliquota: num('pis_aliquota') }),
            cofins: limpo({ cst: v('cofins_cst'), aliquota: num('cofins_aliquota') }),
            ipi: limpo({ cst: v('ipi_cst'), enquadramento: v('ipi_enquadramento') }),
            ibs_cbs: limpo({ cst: v('ibs_cst'), classificacao: v('ibs_classificacao'), cbs_aliquota: num('cbs_aliquota'), ibs_uf_aliquota: num('ibs_uf_aliquota'), ibs_mun_aliquota: num('ibs_mun_aliquota') })
        }
    }
    try {
        await apiFiscal('config/salvar', { tipo: 'operacao', dados })
        opcoesEmissaoFiscal = null
        removerPopup(botao?.closest('.popup')?.id)
        telaConfigFiscal('operacoes')
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function htmlConfigServicos({ servicos }) {
    const ret = r => ['pis', 'cofins', 'csll', 'ir', 'inss'].filter(t => Number(r?.[t]?.aliquota))
        .map(t => `${t.toUpperCase()} ${r[t].aliquota}%${r[t].reter ? ' (retém)' : ''}`).join(' · ')
    return `
        <div class="fis-acoes-claras"><button type="button" class="fis-botao" onclick="formularioServicoFiscal()">+ Novo serviço</button></div>
        <div class="fis-tabela-rolagem fis-alta"><table class="fis-tabela">
            <thead><tr><th>Empresa</th><th>Serviço</th><th>LC 116</th><th>Cód. nacional</th><th>NBS</th><th>ISS</th><th>Retenções federais</th><th></th></tr></thead>
            <tbody>${servicos.map(s => `
                <tr class="${s.ativo ? '' : 'fis-estornado'}">
                    <td>${escFis(s.app)}</td><td><b>${escFis(s.descricao)}</b></td><td>${escFis(s.codigo_lc116)}</td>
                    <td>${escFis(s.codigo_tributacao_nacional)}${s.codigo_tributacao_municipal ? `<small>mun. ${escFis(s.codigo_tributacao_municipal)}</small>` : ''}</td>
                    <td>${escFis(s.codigo_nbs || '')}</td><td>${String(s.aliquota_iss).replace('.', ',')}%${s.iss_retido ? ' <small>retido</small>' : ''}</td>
                    <td><small>${escFis(ret(s.retencoes))}</small></td>
                    <td><button type="button" class="fis-mini" onclick="formularioServicoFiscal('${escFis(s.id)}')">Editar</button></td>
                </tr>`).join('')}</tbody>
        </table></div>`
}

function formularioServicoFiscal(id = null) {
    const { servicos, empresas } = estadoConfigFis.dados
    const s = servicos.find(x => x.id === id) || { app: 'AC', retencoes: {}, ativo: true }
    const r = s.retencoes || {}
    popup({
        titulo: id ? `Serviço ${s.descricao}` : 'Novo serviço',
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-servico data-id="${escFis(s.id || '')}">
                    <div class="fis-grade">
                        ${campoFis('Empresa', `<select class="fis-input" name="app" ${id ? 'disabled' : ''}>${opcoesFis(empresas.map(e => [e.app, e.app]), s.app)}</select>`)}
                        ${campoFis('Descrição', inputFis('descricao', s.descricao), 'fis-largo')}
                        ${campoFis('Item LC 116', inputFis('codigo_lc116', s.codigo_lc116, 'placeholder="14.02"'))}
                        ${campoFis('Código nacional (6 dígitos)', inputFis('codigo_tributacao_nacional', s.codigo_tributacao_nacional, `maxlength="6" ${id ? 'disabled' : ''}`))}
                        ${campoFis('Código municipal', inputFis('codigo_tributacao_municipal', s.codigo_tributacao_municipal))}
                        ${campoFis('NBS', inputFis('codigo_nbs', s.codigo_nbs, 'maxlength="9"'))}
                        ${campoFis('CNAE', inputFis('cnae', s.cnae, 'maxlength="7"'))}
                        ${campoFis('ISS %', inputFis('aliquota_iss', s.aliquota_iss, 'type="number" step="0.01"'))}
                    </div>
                    <label class="fis-check"><input type="checkbox" name="iss_retido" ${s.iss_retido ? 'checked' : ''}> ISS retido pelo tomador (padrão)</label>
                    <fieldset class="fis-passo"><legend>Retenções federais (padrão)</legend><div class="fis-grade">
                        ${['pis', 'cofins', 'csll', 'ir', 'inss'].map(t => campoFis(`${t.toUpperCase()} %`, `
                            <div class="fis-com-check">${inputFis(`${t}_aliquota`, r[t]?.aliquota ?? '', 'type="number" step="0.01"')}
                            <label class="fis-check"><input type="checkbox" name="${t}_reter" ${r[t]?.reter ? 'checked' : ''}> reter</label></div>`)).join('')}
                    </div></fieldset>
                    ${campoFis('Discriminação padrão', `<textarea class="fis-input" name="discriminacao_padrao" rows="3">${escFis(s.discriminacao_padrao || '')}</textarea>`)}
                    <label class="fis-check"><input type="checkbox" name="ativo" ${s.ativo ? 'checked' : ''}> Ativo</label>
                </div>`
        }],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarServicoFiscal(this)' }]
    })
}

async function salvarServicoFiscal(botao) {
    const f = document.querySelector('[data-form-servico]')
    const v = n => f.querySelector(`[name="${n}"]`)?.value?.trim() ?? ''
    const marcado = n => f.querySelector(`[name="${n}"]`)?.checked
    const original = estadoConfigFis.dados.servicos.find(s => s.id === f.dataset.id) || {}
    const retencoes = {}
    for (const t of ['pis', 'cofins', 'csll', 'ir', 'inss'])
        retencoes[t] = { aliquota: Number(v(`${t}_aliquota`).replace(',', '.')) || 0, reter: marcado(`${t}_reter`) }
    const dados = {
        id: f.dataset.id || undefined, app: v('app'), descricao: v('descricao'), codigo_lc116: v('codigo_lc116'),
        codigo_tributacao_nacional: v('codigo_tributacao_nacional'), codigo_tributacao_municipal: v('codigo_tributacao_municipal'),
        codigo_nbs: v('codigo_nbs'), cnae: v('cnae'), aliquota_iss: Number(v('aliquota_iss').replace(',', '.')) || 0,
        iss_retido: marcado('iss_retido'), retencoes, ibs_cbs: original.ibs_cbs || {}, discriminacao_padrao: v('discriminacao_padrao'),
        ativo: marcado('ativo'), ordem: original.ordem
    }
    try {
        await apiFiscal('config/salvar', { tipo: 'servico', dados })
        opcoesEmissaoFiscal = null
        removerPopup(botao?.closest('.popup')?.id)
        telaConfigFiscal('servicos')
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}
