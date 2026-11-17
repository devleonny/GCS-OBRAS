// Fiscal (servidor: SCRIPTS/fiscal.js, SCRIPTS/fiscal/*; banco: migrations/fiscal-estoque.sql).
// - Notas recebidas: importar XML ou buscar na SEFAZ (Focus), ligar cada item ao cadastro do GCS
//   (o de-para aprende: a próxima nota do fornecedor já vem ligada), manifestar e lançar no estoque.
//   A entrada nunca cria item novo.
// - Notas emitidas: NF-e e NFS-e pela Focus NFe, com prévia dos impostos (perfis de operação copiados
//   das notas do Omie), rascunho, emissão, consulta e cancelamento. NF-e autorizada dá saída no estoque.
// - Configuração: empresas, perfis de operação (CFOP/CST/alíquotas) e serviços (LC 116/ISS/retenções).
// Chamadas pelas rotas em apiModuloFiscal (js/estoque.js).

// Perfis que nas notas só consultam e na separação só escolhem o transporte (gerente desde 16/11/2026).
const PERFIS_SO_CONSULTA_FIS = ['log', 'gerente']
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
    CANCELADA: { cor: '#b91c1c', texto: 'Cancelada' }
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
// Devoluções (gcs migrations/fiscal-devolucoes.sql).
const DEVOLUCAO_FISCAL = {
    FORNECEDOR: { cor: '#b45309', texto: 'Devolução ao fornecedor', explica: 'Devolução de compra ao fornecedor' },
    CLIENTE: { cor: '#b45309', texto: 'Devolução do cliente', explica: 'Devolução emitida pelo cliente, da nossa venda' },
    CLIENTE_ENTRADA: { cor: '#b45309', texto: 'Devolução (entrada própria)', explica: 'NF-e de entrada própria: devolução da nossa venda' }
}
const ORIGENS_MERCADORIA = {
    0: '0 · Nacional', 1: '1 · Estrangeira (importação direta)', 2: '2 · Estrangeira (mercado interno)',
    3: '3 · Nacional, importação > 40%', 4: '4 · Nacional, processos básicos', 5: '5 · Nacional, importação ≤ 40%',
    6: '6 · Estrangeira direta, sem similar', 7: '7 · Estrangeira interna, sem similar', 8: '8 · Nacional, importação > 70%'
}

// Botão de tirar uma linha (categoria, departamento, parcela, item): lixeira, vermelha ao passar o mouse.
const iconeLixeiraFis = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
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
                    ${PERFIS_SO_CONSULTA_FIS.includes(acesso?.permissao) ? '' : '<button type="button" onclick="devolucaoPorChaveFis()" title="Devolver uma compra ao fornecedor ou registrar a devolução de uma venda, pela chave da nota">Devolução</button>'}
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
        const { contadores: todos } = await apiFiscal('painel')
        // Telas presas a um modelo (NF-e ou NFS-e Emitidas) contam só os documentos daquele modelo.
        const c = (alvo.dataset.cartoesEmitidas !== undefined && modeloEmitidasFis && todos.saida_por_modelo?.[modeloEmitidasFis]) || todos
        const cartao = (n, texto, cor, acao) => `
            <button type="button" class="fis-cartao" style="--cor: ${cor}" ${acao ? `onclick="${acao}"` : 'disabled'}>
                <b>${n || 0}</b><span>${texto}</span></button>`
        alvo.innerHTML = alvo.dataset.cartoesRecebidas !== undefined
            ? `
                ${cartao(c.entrada_pendente_vinculo, 'com itens a vincular', '#d97706', `abrirTabelaRecebidas({ estoque_status: { op: '=', value: 'pendente_vinculo' } })`)}
                ${cartao(c.entrada_pronta, 'prontas para lançar', '#2563eb', `abrirTabelaRecebidas({ estoque_status: { op: '=', value: 'pronto' } })`)}
                ${cartao(c.entrada_sem_manifestacao, 'sem confirmação', '#7c3aed', `abrirTabelaRecebidas({ manifestacao: { op: '=', value: 'pendente' } })`)}
                ${cartao(c.entrada_resumo, 'só com resumo (falta XML)', '#64748b', `abrirTabelaRecebidas({ status: { op: '=', value: 'resumo' } })`)}`
            : `
                ${cartao(c.saida_rascunho, 'rascunhos', '#64748b', `abrirTabelaEmitidas({ status: { op: '=', value: 'rascunho' } })`)}
                ${cartao(c.saida_processando, 'processando', '#2563eb', `abrirTabelaEmitidas({ status: { op: '=', value: 'processando' } })`)}
                ${cartao(c.saida_rejeitada, 'rejeitadas', '#b91c1c', `abrirTabelaEmitidas({ status: { op: '=', value: 'rejeitada' } })`)}`
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
            <td class="fis-descricao">${escFis(d.participante_nome)}${d.devolucao_tipo ? ` ${etiquetaFis(DEVOLUCAO_FISCAL, d.devolucao_tipo)}` : ''}</td>
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
        // Nota emitida que pertence a uma venda do kanban: traz o bloco "Venda no fluxo" (tela única).
        const contexto = dados.documento.direcao === 'SAIDA'
            ? await apiModuloFiscal('fluxo-itens/detalhe', { nota: id }).catch(() => null)
            : null
        // Nota recebida: categorias/contas do Financeiro para "Gerar faturas a pagar?".
        const opcoesFin = dados.documento.direcao === 'ENTRADA' ? await carregarOpcoesFin().catch(() => null) : null
        removerOverlay()
        // Reabre no lugar: fecha a janela anterior do mesmo documento.
        const anterior = document.querySelector(`[data-doc-fiscal="${CSS.escape(id)}"]`)?.closest('.popup')?.id
        if (anterior) removerPopup(anterior)
        const html = dados.documento.direcao === 'ENTRADA' ? htmlNotaRecebida(dados, opcoesFin) : htmlNotaEmitida(dados, contexto)
        popup({ titulo: dados.documento.direcao === 'ENTRADA' ? 'Nota recebida' : 'Nota emitida', elemento: html })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function resumoDocumentoFis(d, campos) {
    return `<div class="fis-resumo">${campos.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`
}

function htmlNotaRecebida({ documento: d, itens, movimentos, pagamentos, titulos = [], locais = [], cobranca = null, devolucoes = [], origem_devolucao = null }, opcoesFin = null) {
    const lancada = d.estoque_status === 'LANCADO' || Boolean(d.entrada_em)
    const pendentes = itens.filter(i => i.vinculo === 'PENDENTE').length
    const linhas = itens.map(i => {
        let vinculo
        if (i.vinculo === 'VINCULADO') {
            const qtdEstoque = Number(i.quantidade) * Number(i.fator || 1)
            vinculo = `
                <div class="fis-vinculo ok">
                    <b>${escFis(i.item_codigo)}</b> ${escFis(i.item_descricao)}
                    <small>${Number(i.fator) !== 1 ? `${qtdEst(i.quantidade)} ${escFis(i.unidade)} × ${qtdEst(i.fator)} = ` : ''}${qtdEst(qtdEstoque)} ${escFis(i.item_unidade || '')} no estoque
                    · ${escFis({ DEPARA: 'de-para', EAN: 'pelo EAN', MANUAL: 'manual', EMISSAO: '', DEVOLUCAO: 'pela nota de origem' }[i.vinculo_origem] || '')}</small>
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
                <td class="fis-descricao">${escFis(i.descricao)}<small>${i.codigo ? `Cód. ${escFis(i.codigo)} · ` : ''}NCM ${escFis(i.ncm || '—')} · CFOP ${escFis(i.cfop || '—')}${i.ean ? ` · EAN ${escFis(i.ean)}` : ''}</small></td>
                <td class="fis-num">${qtdEst(i.quantidade)} ${escFis(i.unidade)}</td>
                <td class="fis-num">${i.valor_unitario != null ? dinheiro(i.valor_unitario) : ''}</td>
                <td class="fis-num">${i.valor_total != null ? dinheiro(i.valor_total) : ''}</td>
                <td>${vinculo}</td>
            </tr>`
    }).join('')

    const manifestar = ['CIENCIA', 'CONFIRMACAO', 'DESCONHECIMENTO', 'NAO_REALIZADA']
        .filter(t => t !== d.manifestacao)
        .map(t => `<button type="button" class="fis-mini" onclick="manifestarNotaFiscal('${escFis(d.id)}', '${t}')">${MANIFESTACAO_FISCAL[t].texto}</button>`).join('')

    // Mesmo visual da nota emitida: cabeçalho com lateral colorida (verde = lançada no estoque,
    // laranja = itens a vincular, cinza = cancelada, azul = demais), grade, faixa de ações e cartões.
    const tom = d.status === 'CANCELADA' ? 'neutro' : lancada ? 'ok' : pendentes ? 'andando' : 'rascunho'
    return `
        <div class="fis-painel fis-doc fis-nota" data-doc-fiscal="${escFis(d.id)}">
            <div class="fis-nota-topo ${tom}">
                <div class="fis-nota-titulo">
                    <b>${escFis(d.participante_nome || 'Fornecedor')}</b>
                    <div class="fis-nota-etiquetas">
                        ${etiquetaFis(STATUS_FISCAL, d.status)}
                        ${etiquetaFis(MANIFESTACAO_FISCAL, d.manifestacao)}
                        ${etiquetaFis(ESTOQUE_FISCAL, d.estoque_status)}
                        ${etiquetaFis(DEVOLUCAO_FISCAL, d.devolucao_tipo)}
                    </div>
                    <small>NF-e ${escFis(d.numero || '—')}${d.serie ? ` · série ${escFis(d.serie)}` : ''}</small>
                </div>
                <div class="fis-nota-valor">
                    <span>Total da nota</span>
                    <b>${d.valor_total != null ? dinheiro(d.valor_total) : '—'}</b>
                </div>
            </div>

            ${resumoDocumentoFis(d, [
                ['Emissão', dataHoraFis(d.emissao)],
                ['Empresa', escFis(d.app)],
                [d.devolucao_tipo === 'CLIENTE' ? 'CNPJ do cliente' : 'CNPJ do fornecedor', `${docFormatadoFis(d.participante_documento)}${d.participante_uf ? ` <small>${escFis(d.participante_uf)}</small>` : ''}`],
                ['Natureza', escFis(d.natureza_operacao || '')]
            ])}

            ${d.chave ? `<div class="fis-chave">Chave <code>${escFis(d.chave)}</code></div>` : ''}
            ${(d.mensagens || []).length ? `<div class="fis-alerta">${d.mensagens.map(escFis).join('<br>')}</div>` : ''}
            ${pagamentos?.length ? `<div class="fis-info">Pagamento lançado com esta chave: ${pagamentos.map(p => `<b>${escFis(p.id)}</b> (${escFis(p.status || '')})`).join(', ')}</div>` : ''}

            <div class="fis-acoes-claras fis-nota-acoes">
                ${d.tem_xml ? `<button type="button" class="fis-mini" onclick="baixarArquivoFiscal('${escFis(d.id)}', 'xml')">XML</button>` : ''}
                <button type="button" class="fis-mini" onclick="baixarArquivoFiscal('${escFis(d.id)}', 'danfe')">DANFE</button>
                ${d.status === 'COMPLETA' && d.devolucao_tipo !== 'CLIENTE' && !PERFIS_SO_CONSULTA_FIS.includes(acesso?.permissao)
                    ? `<button type="button" class="fis-mini" onclick="abrirDevolucaoFis({ id: '${escFis(d.id)}', lado: 'COMPRA' })" title="Emite a NF-e de devolução com os impostos desta compra">Devolver ao fornecedor</button>` : ''}
                <span class="fis-separador"></span>
                <small class="fis-nota-acoes-rotulo">Manifestar</small> ${manifestar}
            </div>

            ${blocoDevolucaoFis(d, devolucoes, origem_devolucao)}

            ${htmlEntradaNotaFis(d, { pendentes, titulos, locais, cobranca, opcoesFin })}

            ${d.status === 'RESUMO'
                ? '<div class="fis-vazio">A SEFAZ só mandou o resumo. Dê <b>Ciência</b> para liberar o XML completo, ou importe o XML que o fornecedor enviou.</div>'
                : `
            <div class="fis-secao">
                <div class="fis-secao-topo">
                    <b>Itens</b> <span class="fis-contador">${itens.length}</span>
                    ${pendentes ? `<small class="fis-pendente">${pendentes} sem vínculo: para gerar estoque, todos precisam estar resolvidos</small>` : '<small class="fis-secao-info">todos resolvidos</small>'}
                </div>
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela">
                        <thead><tr><th>#</th><th>Descrição na nota</th><th class="fis-num">Qtd</th><th class="fis-num">Unit.</th><th class="fis-num">Total</th><th>Item do GCS</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            </div>`}
            ${movimentos?.length ? `
                <details class="fis-secao"><summary><b>Movimentos de estoque</b> <span class="fis-contador">${movimentos.length}</span></summary>
                    <table class="fis-tabela"><tbody>${movimentos.map(m => linhaMovimentoEst(m, { comItem: true, acoes: false })).join('')}</tbody></table>
                </details>` : ''}
            ${historicoFiscal(d)}
        </div>`
}

// ---------------------------------------------------------------- entrada da nota recebida
// Duas respostas obrigatórias (sem padrão): "Gerar estoque?" e "Gerar faturas a pagar?". Faturas: parcelas do
// XML (cobr/dup) quando o fornecedor mandou; senão o usuário informa. Desfazer: estorna o estoque e cancela as
// faturas; se alguma fatura tem pagamento, o servidor bloqueia e diz qual (desfaz-se o pagamento antes).
function htmlEntradaNotaFis(d, { pendentes, titulos, locais, cobranca, opcoesFin }) {
    if (d.status === 'RESUMO' || d.status === 'CANCELADA') return ''
    const feita = d.entrada_em || d.estoque_status === 'LANCADO'
    if (feita) {
        const local = locais.find(l => l.id === d.estoque_local_id)
        return `
            <div class="fis-secao fin-entrada feita">
                <div class="fis-secao-topo">
                    <b>Entrada da nota</b>
                    <small>${d.entrada_em ? `feita em ${dataHoraFis(d.entrada_em)} por ${escFis(d.entrada_por || '')}` : 'lançada no estoque antes do Financeiro'}</small>
                    <button type="button" class="fis-mini" onclick="desfazerEntradaNotaFis('${escFis(d.id)}')">Desfazer entrada</button>
                </div>
                <div class="fin-entrada-resumo">
                    <div><span>Estoque</span><b>${d.estoque_status === 'LANCADO' ? `Sim${local ? ` · ${escFis(local.nome)}` : ''}` : 'Não'}</b></div>
                    ${d.devolucao_tipo === 'CLIENTE'
                        ? `<div><span>Faturas da venda</span><b>${d.devolucao_financeiro ? 'Acertadas' : d.gerar_faturas === false ? 'Não' : '—'}</b></div>`
                        : `<div><span>Faturas a pagar</span><b>${titulos.length ? `${titulos.length} parcela(s)` : d.gerar_faturas === false ? 'Não' : '—'}</b></div>`}
                </div>
                ${titulos.length ? `
                <table class="fis-tabela">
                    <thead><tr><th>Parcela</th><th>Vencimento</th><th class="fis-num">Valor</th><th class="fis-num">Pago</th><th>Situação</th><th></th></tr></thead>
                    <tbody>${titulos.map(t => `
                        <tr><td>${escFis(t.parcela_texto)}</td><td>${dataFin(t.vencimento)}</td><td class="fis-num">${dinheiro(t.valor)}</td><td class="fis-num">${Number(t.pago) ? dinheiro(t.pago) : ''}</td>
                            <td>${etiquetaEst(SITUACOES_FIN[t.situacao]?.texto || t.situacao, SITUACOES_FIN[t.situacao]?.cor)}</td>
                            <td><button type="button" class="fis-mini" onclick="abrirFaturaFin('${escFis(t.id)}')">Abrir</button></td></tr>`).join('')}
                    </tbody>
                </table>` : ''}
            </div>`
    }
    // Parcelas sugeridas: as duplicatas do XML; o total a bater é o líquido da fatura (se as duplicatas somam ele) ou o total da nota.
    const dups = cobranca?.duplicatas || []
    const somaDups = Math.round(dups.reduce((a, x) => a + Number(x.valor || 0), 0) * 100) / 100
    const total = dups.length && Math.abs(somaDups - Number(cobranca?.fatura?.valor_liquido || 0)) <= 0.01 ? somaDups : Number(d.valor_total || 0)
    const formaXml = cobranca?.pagamentos?.[0]?.forma
    const devolucaoCliente = d.devolucao_tipo === 'CLIENTE'
    const blocoFaturas = devolucaoCliente
        ? '<small class="fis-dica">Abate o valor da devolução nas faturas a receber da nossa venda, da última parcela para a primeira. O que o cliente já pagou vira uma fatura a pagar a ele (crédito). Venda feita pelo Omie: as faturas estão lá, acerte por lá.</small>'
        : !opcoesFin
        ? '<div class="fis-alerta">Sem acesso às categorias do Financeiro: peça a alguém do financeiro para dar esta entrada.</div>'
        : `
            <div class="fis-grade">
                <label class="fis-campo fis-largo"><span>Categoria *</span><select class="fis-input" name="categoria_id">${opcoesCategoriasFin(opcoesFin.categorias, 'PAGAR')}</select></label>
                <label class="fis-campo"><span>Forma</span><select class="fis-input" name="forma_pagamento"><option value=""></option>${FORMAS_FIN.filter(([v]) => v !== 'OMIE').map(([v, n]) => `<option value="${v}" ${formaXml === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                <label class="fis-campo"><span>Conta</span><select class="fis-input" name="conta_id">${opcoesContasFin(opcoesFin.contas, d.app)}</select></label>
            </div>
            ${dups.length ? `<small class="fis-dica">Parcelas que o fornecedor pôs na nota (${dups.length}): confira.</small>` : '<small class="fis-dica">A nota não traz parcelas: informe os vencimentos.</small>'}
            ${editorParcelasFin(dups.map(x => ({ vencimento: x.vencimento, valor: x.valor })), total)}
            ${editorRateioFin(opcoesFin.departamentos, [])}`
    return `
        <div class="fis-secao fin-entrada" data-entrada-nota="${escFis(d.id)}" data-devolucao="${escFis(d.devolucao_tipo || '')}">
            <div class="fis-secao-topo"><b>Dar entrada</b> <small>responda as duas perguntas</small></div>
            <div class="fin-entrada-grade">
                <div class="fin-entrada-bloco">
                    ${simNaoFin('gerar_estoque', 'Gerar estoque?', 'alternarEntradaFis(this)')}
                    <div data-se="gerar_estoque" hidden>
                        ${pendentes ? `<div class="fis-alerta">Faltam ${pendentes} item(ns) sem vínculo: vincule ou marque "não é estoque" na lista abaixo.</div>` : ''}
                        <label class="fis-campo"><span>Local</span><select class="fis-input" name="local_id">${locais.filter(l => l.tipo !== 'DIVERGENCIA').map(l => `<option value="${escFis(l.id)}" ${l.padrao ? 'selected' : ''}>${escFis(l.nome)}${l.padrao ? ' (padrão)' : ''}</option>`).join('')}</select></label>
                    </div>
                </div>
                <div class="fin-entrada-bloco">
                    ${simNaoFin('gerar_faturas', devolucaoCliente ? 'Abater nas faturas a receber da venda?' : 'Gerar faturas a pagar?', 'alternarEntradaFis(this)')}
                    <div data-se="gerar_faturas" hidden>${blocoFaturas}</div>
                </div>
            </div>
            <div class="fis-acoes-claras"><button type="button" class="fis-botao" onclick="darEntradaNotaFis('${escFis(d.id)}')">Dar entrada</button></div>
        </div>`
}

function alternarEntradaFis(input) {
    const caixa = input.closest('[data-entrada-nota]')
    const alvo = caixa.querySelector(`[data-se="${input.name}"]`)
    if (alvo) alvo.hidden = input.value !== 'sim'
    const parcelas = alvo?.querySelector('[data-parcelas]')
    if (parcelas && !alvo.hidden) somarParcelasFin(parcelas)
}

async function darEntradaNotaFis(id) {
    const caixa = document.querySelector(`[data-entrada-nota="${CSS.escape(id)}"]`)
    const gerar_estoque = lerSimNaoFin(caixa, 'gerar_estoque')
    const gerar_faturas = lerSimNaoFin(caixa, 'gerar_faturas')
    const faltas = []
    if (gerar_estoque === null) faltas.push('Responda: gerar estoque?')
    // Devolução do cliente: a pergunta é "abater nas faturas da venda?" (sem categoria nem parcelas).
    const devolucaoCliente = caixa.dataset.devolucao === 'CLIENTE'
    if (gerar_faturas === null) faltas.push(devolucaoCliente ? 'Responda: abater nas faturas a receber da venda?' : 'Responda: gerar faturas a pagar?')
    const v = n => caixa.querySelector(`[name="${n}"]`)?.value || ''
    if (gerar_faturas && !devolucaoCliente && !v('categoria_id')) faltas.push('Escolha a categoria das faturas.')
    if (faltas.length) return popup({ mensagem: `<ul class="fis-lista-erros">${faltas.map(f => `<li>${escFis(f)}</li>`).join('')}</ul>` })
    try {
        overlayAguarde()
        const r = await apiFiscal('recebidas/dar-entrada', {
            id, gerar_estoque, gerar_faturas, local_id: gerar_estoque ? v('local_id') : undefined,
            ...(gerar_faturas && !devolucaoCliente ? {
                categoria_id: v('categoria_id'), forma_pagamento: v('forma_pagamento'), conta_id: v('conta_id') || null,
                parcelas: lerParcelasFin(caixa), rateio: lerRateioFin(caixa)
            } : {})
        })
        removerOverlay()
        const partes = [gerar_estoque ? `${r.lancados} item(ns) no estoque` : 'sem estoque',
            devolucaoCliente ? (gerar_faturas ? `${r.faturas} fatura(s) acertada(s)` : 'faturas da venda sem mudança')
                : gerar_faturas ? `${r.faturas} fatura(s) a pagar` : 'sem faturas']
        popup({ mensagem: `Entrada feita: ${partes.join(' · ')}.${r.avisos?.length ? `<br>${r.avisos.map(escFis).join('<br>')}` : ''}`, imagem: 'imagens/concluido.png', tempo: 5 })
        abrirDocumentoFiscal(id)
        contadoresFiscal()
        if (controles.notasRecebidas) paginacao('notasRecebidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function desfazerEntradaNotaFis(id) {
    const motivo = await pedirTextoPopup({ titulo: 'Desfazer entrada', mensagem: 'Por que desfazer a entrada? (o estoque é estornado e as faturas a pagar canceladas)', textoConfirmar: 'Desfazer' })
    if (motivo === null) return
    try {
        overlayAguarde()
        const r = await apiFiscal('recebidas/desfazer-entrada', { id, motivo })
        removerOverlay()
        popup({ mensagem: `Entrada desfeita: ${r.estornados} movimento(s) de estoque estornado(s), ${r.faturas} fatura(s) cancelada(s).`, imagem: 'imagens/concluido.png', tempo: 5 })
        abrirDocumentoFiscal(id)
        contadoresFiscal()
        if (controles.notasRecebidas) paginacao('notasRecebidas')
    } catch (err) {
        removerOverlay()
        // 409 = fatura com pagamento registrado: a mensagem do servidor diz qual e o que fazer.
        popup({ titulo: err.status === 409 ? 'Entrada não pode ser desfeita' : undefined, mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- pagamento na emissão
// Condição de pagamento (js/condicao_pagamento.js): vem do pedido (que vem da empresa do cliente). Vai na
// nota (NF-e: fatura/duplicatas; NFS-e: no texto) e, autorizada, vira as faturas a receber do Financeiro.
// Vencimentos pela emissão calculados no dia em que a nota sai; datas fixas valem como estão.
function blocoPagamentoFis(numero, pagamento = {}) {
    return `
        <fieldset class="fis-passo" data-pagamento-emissao>
            <legend><span class="fis-num-passo">${numero}</span> Pagamento <small>— sai na nota e vira as faturas a receber</small></legend>
            ${htmlCondicaoPag(Object.keys(pagamento || {}).length ? pagamento : null)}
        </fieldset>`
}

function previaPagamentoFis(el) {
    iniciarCondicoesPag(el?.closest?.('[data-pagamento-emissao]') || document)
}

function lerPagamentoFis(form) {
    const caixa = form.querySelector('[data-pagamento-emissao] [data-condicao-pag]')
    if (!caixa) return undefined
    const { condicao } = lerCondicaoPag(caixa)
    return condicao?.forma ? condicao : undefined
}

// Problemas da condição na tela (sem forma é tratado à parte em salvarEmissaoFis).
function errosPagamentoFis(form) {
    const caixa = form.querySelector('[data-pagamento-emissao] [data-condicao-pag]')
    return caixa ? lerCondicaoPag(caixa).erros.filter(e => !/forma de pagamento/i.test(e)) : []
}

function historicoFiscal(d) {
    const ev = Array.isArray(d.eventos) ? d.eventos : []
    if (!ev.length) return ''
    return `
        <details class="fis-secao"><summary><b>Histórico</b> <span class="fis-contador">${ev.length}</span></summary>
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
    const motivo = await pedirTextoPopup({ titulo: 'Estornar entrada', mensagem: 'Motivo do estorno da entrada:', textoConfirmar: 'Estornar' })
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
        justificativa = await pedirTextoPopup({ titulo: 'Operação não realizada', mensagem: 'Justificativa:', minimo: 15, textoConfirmar: 'Enviar à SEFAZ' })
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

// Menus "Vendas e NF-e" e "Serviços e NFS-e" (js/esquema_botoes.js): a mesma lista, presa a um modelo.
// O modelo fica guardado para o "Limpar filtro" dos contadores não trazer as duas de volta.
let modeloEmitidasFis = null
function telaNotasNFe() { return telaNotasEmitidas('NFE') }
function telaNotasNFSe() { return telaNotasEmitidas('NFSE') }

async function telaNotasEmitidas(modelo = null) {
    modeloEmitidasFis = ['NFE', 'NFSE'].includes(modelo) ? modelo : null
    const titulo = { NFE: 'NF-e emitidas', NFSE: 'NFS-e emitidas' }[modeloEmitidasFis] || 'Notas emitidas'
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>${titulo}</h2></div>
            <div class="fis-cartoes" data-cartoes-emitidas></div>
            <div class="fis-conteudo"></div>
        </div>`
    contadoresFiscal()
    await abrirTabelaEmitidas()
}

async function abrirTabelaEmitidas(filtroExtra = null) {
    // vw_fiscal_emitidas: notas de saída do GCS + notas emitidas pelo Omie (fonte OMIE; serviço = NFSE).
    const filtroModelo = modeloEmitidasFis ? { modelo: { op: '=', value: modeloEmitidasFis } } : {}
    try {
        delete controles.notasEmitidas
        document.querySelector('.fis-conteudo').innerHTML = await modTab({
            base: 'vw_fiscal_emitidas',
            pag: 'notasEmitidas',
            body: 'bodyNotasEmitidas',
            criarLinha: 'criarLinhaNotaEmitida',
            topoEmLinha: true,
            caber: true,
            filtrosFixos: { ...filtroModelo, ...(filtroExtra || {}) },
            btnExtras: `
                <div class="fis-acoes">
                    ${modeloEmitidasFis !== 'NFSE' && !PERFIS_SO_CONSULTA_FIS.includes(acesso?.permissao) ? '<button type="button" onclick="formularioEmissaoNFe()">+ NF-e</button>' : ''}
                    ${modeloEmitidasFis !== 'NFE' && !PERFIS_SO_CONSULTA_FIS.includes(acesso?.permissao) ? '<button type="button" onclick="formularioEmissaoNFSe()">+ NFS-e</button>' : ''}
                    ${modeloEmitidasFis !== 'NFSE' && !PERFIS_SO_CONSULTA_FIS.includes(acesso?.permissao) ? '<button type="button" onclick="devolucaoPorChaveFis()" title="Devolução de uma venda (nota de entrada própria) ou de uma compra, pela chave da nota">Devolução</button>' : ''}
                    ${filtroExtra ? '<button type="button" onclick="abrirTabelaEmitidas()">Limpar filtro</button>' : ''}
                </div>`,
            ordenar: [{ path: 'criado_em', direcao: 'desc' }],
            colunas: {
                '': {},
                'Data': { chave: 'dia', tipoPesquisa: 'data' },
                'Empresa': { chave: 'app', tipoPesquisa: 'select' },
                // Nas telas presas a um modelo (NF-e ou NFS-e) a coluna repetiria sempre o mesmo valor.
                ...(modeloEmitidasFis ? {} : { 'Modelo': { chave: 'modelo', tipoPesquisa: 'select' } }),
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
            <td class="fis-acoes-linha">${d.fonte === 'OMIE'
                ? `<img src="imagens/pesquisar.svg" title="Nota emitida pelo Omie: abrir o PDF" onclick="abrirDANFE('${escFis(d.id)}')">${
                    d.modelo === 'NFE' && d.status === 'AUTORIZADA' && /^venda/i.test(d.natureza_operacao || '') && !PERFIS_SO_CONSULTA_FIS.includes(acesso?.permissao)
                        ? `<img src="imagens/voltar.png" title="Registrar devolução desta venda (nota de entrada própria)" onclick="abrirDevolucaoFis({ id: '${escFis(d.id)}', lado: 'VENDA' })">` : ''}`
                : `<img src="imagens/pesquisar.svg" title="Abrir" onclick="abrirDocumentoFiscal('${escFis(d.id)}')">`}</td>
            <td>${dataFis(d.emissao || d.criado_em)}</td>
            <td>${escFis(d.app)}</td>
            ${modeloEmitidasFis ? '' : `<td>${d.modelo === 'NFSE' ? 'NFS-e' : 'NF-e'}</td>`}
            <td><b>${escFis(d.numero || '')}</b></td>
            <td class="fis-descricao">${escFis(d.participante_nome)}<small>${docFormatadoFis(d.participante_documento)}</small></td>
            <td><small>${escFis(d.natureza_operacao || '')}</small></td>
            <td class="fis-num">${d.valor_total != null ? dinheiro(d.valor_total) : ''}</td>
            <td>${etiquetaFis(STATUS_FISCAL, d.status)}</td>
            <td>${etiquetaFis(ESTOQUE_FISCAL, d.estoque_status)}</td>
            <td>${d.ambiente === 'homologacao' ? etiquetaEst('Homologação', '#d97706') : d.ambiente === 'producao' ? etiquetaEst('Produção', '#15803d') : d.ambiente === 'omie' ? etiquetaEst('Omie', '#7c3aed') : escFis(d.ambiente || '')}</td>
        </tr>`
}

// contexto (opcional): detalhe do item do Fluxo de Vendas (gcs /fluxo-itens/detalhe) — acrescenta o bloco
// "Venda no fluxo" (tela única da venda: kanban e NF-e Emitidas).
function htmlNotaEmitida({ documento: d, itens, movimentos, devolucoes = [], origem_devolucao = null }, contexto = null) {
    const entrada = d.payload?.entrada || {}
    const o = entrada.opcoes || {}
    // Acesso log: só consulta (DANFE, XML, espelho, situação, histórico). O transporte da separação ele
    // ajusta pelo menu ⋮ do cartão ("Editar NF-e"), que abre o formulário travado.
    const soConsulta = PERFIS_SO_CONSULTA_FIS.includes(acesso?.permissao)
    const editavel = !soConsulta && ['RASCUNHO', 'REJEITADA'].includes(d.status)
    const nfse = d.modelo === 'NFSE'
    const t = d.valor_impostos || {}
    const impostos = nfse
        ? [['Serviço', t.servico], ['ISS', t.iss], ['Retido', t.total_retido], ['Líquido', t.liquido]]
        : [['Produtos', t.produtos], ['Desconto', t.desconto], ['Frete', t.frete], ['ICMS', t.icms], ['ICMS ST', t.st], ['IPI devolvido', t.ipi_devolvido], ['DIFAL', t.difal], ['PIS', t.pis], ['COFINS', t.cofins], ['IBS', t.ibs], ['CBS', t.cbs]]
    const tom = { AUTORIZADA: 'ok', REJEITADA: 'erro', DENEGADA: 'erro', CANCELADA: 'neutro', PROCESSANDO: 'andando' }[d.status] || 'rascunho'
    const transp = o.transportador
    const infos = [o.informacoes_complementares, o.numero_pedido ? `Pedido de compra nº ${o.numero_pedido}.` : ''].filter(Boolean).join(' ')
    // Sem ORC gravado na nota (rascunho antigo editado fora do kanban): o do item do fluxo, se houver.
    const orc = String(d.orcamento || contexto?.item?.contrato || '')
    const botao = (texto, acao, principal = false) => `<button type="button" class="${principal === 'perigo' ? 'fis-mini fis-perigo' : principal ? 'fis-botao' : 'fis-mini'}" onclick="${acao}">${texto}</button>`
    const fretes = { 9: 'Sem frete', 0: 'Emitente (CIF)', 1: 'Destinatário (FOB)', 2: 'Terceiros' }

    return `
        <div class="fis-painel fis-doc fis-nota" data-doc-fiscal="${escFis(d.id)}">
            <div class="fis-nota-topo ${tom}">
                <div class="fis-nota-titulo">
                    <b>${nfse ? 'NFS-e' : 'NF-e'} ${d.numero ? `nº ${escFis(d.numero)}${d.serie ? ` <small>série ${escFis(d.serie)}</small>` : ''}` : '<small>(sem número)</small>'}</b>
                    <div class="fis-nota-etiquetas">
                        ${etiquetaFis(STATUS_FISCAL, d.status)}
                        ${d.ambiente === 'homologacao' ? etiquetaEst('Homologação', '#d97706') : etiquetaEst('Produção', '#15803d')}
                        ${etiquetaFis(ESTOQUE_FISCAL, d.estoque_status)}
                        ${etiquetaFis(DEVOLUCAO_FISCAL, d.devolucao_tipo)}
                    </div>
                    <small>${escFis(d.natureza_operacao || '')}</small>
                </div>
                <div class="fis-nota-valor">
                    <span>Total da nota</span>
                    <b>${d.valor_total != null ? dinheiro(d.valor_total) : '—'}</b>
                </div>
            </div>

            ${resumoDocumentoFis(d, [
                ['Destinatário', `${escFis(d.participante_nome || '—')} <small>${docFormatadoFis(d.participante_documento)}${d.participante_uf ? ` · ${escFis(d.participante_uf)}` : ''}</small>`],
                ['Empresa', escFis(d.app)],
                // Rateio: cada departamento com o percentual (é assim que os recebimentos foram divididos).
                Array.isArray(entrada.rateio) && entrada.rateio.length > 1
                    ? ['Departamentos', entrada.rateio.map(r => `${escFis(r.departamento)} <small>${Number(r.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%${r.modo === 'valor' && r.valor ? ` · ${dinheiro(r.valor)}` : ''}</small>`).join(' · ')]
                    : ['Orçamento', escFis(orc || '—')],
                ['Criada', `${dataHoraFis(d.criado_em)} <small>${escFis(d.criado_por || '')}</small>`],
                ['Autorizada', d.emissao ? dataHoraFis(d.emissao) : '']
            ])}

            ${d.chave ? `<div class="fis-chave">Chave <code>${escFis(d.chave)}</code>${d.protocolo ? ` <span>· protocolo <code>${escFis(d.protocolo)}</code></span>` : ''}</div>` : ''}
            ${(d.mensagens || []).length ? `<div class="fis-alerta">${d.mensagens.map(escFis).join('<br>')}</div>` : ''}

            <div class="fis-nota-impostos">${impostos.filter(([, v]) => v).map(([k, v]) => `<div><span>${k}</span><b>${dinheiro(v)}</b></div>`).join('')}</div>

            ${blocoDevolucaoFis(d, devolucoes, origem_devolucao)}

            <div class="fis-acoes-claras fis-nota-acoes">
                ${editavel ? botao('Emitir', `emitirDocumentoFiscal('${escFis(d.id)}')`, true) + botao('Editar', `editarRascunhoFiscal('${escFis(d.id)}')`) : ''}
                ${d.status === 'AUTORIZADA' ? botao(nfse ? 'DANFSe' : 'DANFE', `baixarArquivoFiscal('${escFis(d.id)}', 'danfe')`) + botao('XML', `baixarArquivoFiscal('${escFis(d.id)}', 'xml')`) : ''}
                ${!nfse && d.status !== 'AUTORIZADA' && entrada.itens ? botao('Espelho', `espelhoNotaItemFluxo('${escFis(d.id)}')`) : ''}
                ${d.status === 'PROCESSANDO' || d.status === 'AUTORIZADA' ? botao('Atualizar situação', `consultarDocumentoFiscal('${escFis(d.id)}')`) : ''}
                ${contexto?.item?.orcamento_id ? botao('Histórico do Orçamento', `abrirEsquema('${escFis(contexto.item.orcamento_id)}')`) : /^ORC_/.test(orc) ? botao('Histórico do Orçamento', `abrirEsquemaPorContratoFis('${escFis(orc)}')`) : ''}
                ${!editavel && !soConsulta ? botao('Duplicar', `duplicarDocumentoFiscal('${escFis(d.id)}')`) : ''}
                ${!nfse && d.status === 'AUTORIZADA' && !d.devolucao_tipo && !soConsulta
                    ? botao('Registrar devolução', `abrirDevolucaoFis({ id: '${escFis(d.id)}', lado: 'VENDA' })`) : ''}
                <span class="fis-separador"></span>
                ${d.status === 'AUTORIZADA' && !soConsulta ? botao('Cancelar nota', `cancelarDocumentoFiscal('${escFis(d.id)}')`, 'perigo') : ''}
                ${editavel ? botao('Excluir rascunho', `excluirRascunhoFiscal('${escFis(d.id)}')`, 'perigo') : ''}
            </div>

            ${itens.length ? `
                <div class="fis-secao">
                    <div class="fis-secao-topo"><b>Itens</b> <span class="fis-contador">${itens.length}</span></div>
                    <div class="fis-tabela-rolagem"><table class="fis-tabela">
                        <thead><tr><th>#</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th class="fis-num">Qtd</th><th class="fis-num">Unit.</th><th class="fis-num">Total</th><th class="fis-num">ICMS</th><th class="fis-num">PIS+COFINS</th></tr></thead>
                        <tbody>${itens.map(i => `
                            <tr>
                                <td class="fis-num">${i.n_item}</td>
                                <td class="fis-descricao">${escFis(i.descricao)}<small>${escFis(i.codigo || '')}</small></td>
                                <td><small>${escFis(i.ncm || '')}</small></td><td>${escFis(i.cfop || '')}</td>
                                <td class="fis-num">${qtdEst(i.quantidade)} ${escFis(i.unidade || '')}</td>
                                <td class="fis-num">${dinheiro(i.valor_unitario || 0)}</td><td class="fis-num"><b>${dinheiro(i.valor_total || 0)}</b></td>
                                <td class="fis-num">${i.impostos?.icms ? dinheiro(i.impostos.icms) : ''}</td>
                                <td class="fis-num">${i.impostos?.pis || i.impostos?.cofins ? dinheiro((i.impostos.pis || 0) + (i.impostos.cofins || 0)) : ''}</td>
                            </tr>`).join('')}</tbody>
                    </table></div>
                </div>` : ''}

            ${!nfse && (transp || o.volumes) ? `
                <div class="fis-secao">
                    <div class="fis-secao-topo"><b>Transporte</b></div>
                    ${resumoDocumentoFis(d, [
                        ['Frete por conta de', escFis(fretes[o.modalidade_frete ?? 9] || '')],
                        ['Transportadora', transp ? `${escFis(transp.nome || '')} <small>${docFormatadoFis(transp.documento)}</small>` : '—'],
                        ['Volumes', escFis(o.volumes || '—')]
                    ])}
                </div>` : ''}

            ${infos ? `<div class="fis-secao"><div class="fis-secao-topo"><b>Informações complementares</b></div><div class="fis-texto">${escFis(infos)}</div></div>` : ''}
            ${nfse && entrada.dados?.descricao ? `<div class="fis-secao"><div class="fis-secao-topo"><b>Serviço</b></div><div class="fis-texto">${escFis(entrada.dados.descricao).replace(/\n/g, '<br>')}</div></div>` : ''}
            ${movimentos?.length ? `
                <details class="fis-secao"><summary><b>Movimentos de estoque</b> <span class="fis-contador">${movimentos.length}</span></summary>
                    <table class="fis-tabela"><tbody>${movimentos.map(m => linhaMovimentoEst(m, { comItem: true, acoes: false })).join('')}</tbody></table>
                </details>` : ''}
            ${historicoFiscal(d)}
            ${contexto && typeof blocoItemFluxoHtml === 'function' ? blocoItemFluxoHtml(contexto) : ''}
        </div>`
}

// Histórico do Orçamento a partir do código ORC da nota (o histórico abre pelo id do orçamento).
async function abrirEsquemaPorContratoFis(contrato) {
    try {
        const { resultados } = await pesquisarDB({ base: 'vw_fluxo_itens', filtros: { contrato: { op: '=', value: contrato } }, limite: 1 })
        const orcamentoId = resultados?.[0]?.orcamento_id
        if (!orcamentoId) return popup({ mensagem: `Orçamento ${escFis(contrato)} não encontrado.` })
        abrirEsquema(orcamentoId)
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function editarRascunhoFiscal(id) {
    const { documento } = await apiFiscal('documento', { id })
    const anterior = document.querySelector(`[data-doc-fiscal="${CSS.escape(id)}"]`)?.closest('.popup')?.id
    if (anterior) removerPopup(anterior)
    const entrada = documento.payload?.entrada || {}
    if (entrada.devolucao) return abrirDevolucaoFis({ ...origemDaDevolucaoFis(documento), inicial: { ...entrada, id } })
    if (documento.modelo === 'NFSE') formularioEmissaoNFSe({ ...entrada, id })
    else formularioEmissaoNFe({ ...entrada, id })
}

async function duplicarDocumentoFiscal(id) {
    const { documento } = await apiFiscal('documento', { id })
    const entrada = { ...(documento.payload?.entrada || {}) }
    delete entrada.id
    if (entrada.devolucao) return abrirDevolucaoFis({ ...origemDaDevolucaoFis(documento), inicial: entrada })
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
    const justificativa = await pedirTextoPopup({ titulo: 'Cancelar nota', mensagem: 'Justificativa do cancelamento:', minimo: 15, maximo: 255, textoConfirmar: 'Cancelar nota' })
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

// Indicador de IE quando o cadastro não diz: "ISENTO" = isento (2); com IE = contribuinte (1, inclusive
// produtor rural com CPF); sem IE (todo CPF comum) = não contribuinte (9). Antes vinha sempre 1 e a nota
// de pessoa física era barrada por "contribuinte sem Inscrição Estadual".
function indicadorPadraoFis(dest = {}) {
    const ie = String(dest.inscricao_estadual || '').trim().toUpperCase()
    if (/^ISENT/.test(ie)) return '2'
    return ie ? '1' : '9'
}

function blocoDestinatarioFis(dest = {}, { nfse = false } = {}) {
    return `
        <fieldset class="fis-passo" data-bloco-destinatario data-preenchido="${escFis(soDigFis(dest.documento || ''))}">
            <legend><span class="fis-num-passo">2</span> ${nfse ? 'Tomador' : 'Destinatário'} <small>— digite o CPF/CNPJ: o GCS completa pelo cadastro e pelas notas anteriores</small></legend>
            <div class="fis-grade">
                ${campoFis('CPF / CNPJ', inputFis('d_documento', docFormatadoFis(dest.documento), `inputmode="numeric" onchange="buscarParticipanteFis(this)" ${ATRIBUTOS_SUGESTAO_FIS}`), 'fis-destaque')}
                ${campoFis('Nome / razão social', inputFis('d_nome', dest.nome, `placeholder="Digite para buscar no cadastro…" ${ATRIBUTOS_SUGESTAO_FIS}`), 'fis-largo')}
                ${nfse ? '' : campoFis('Contribuinte do ICMS?', `<select class="fis-input" name="d_indicador_ie" onchange="agendarPreviaFis()">${opcoesFis([['1', '1 · Contribuinte (tem IE)'], ['2', '2 · Isento'], ['9', '9 · Não contribuinte']], dest.indicador_ie || indicadorPadraoFis(dest))}</select>`)}
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

// ---------------- sugestões do destinatário/tomador enquanto digita (nome, razão social ou CPF/CNPJ)
// A lista fica no body com posição fixa (os popups rolam e cortariam um menu dentro do formulário).
const ATRIBUTOS_SUGESTAO_FIS = 'autocomplete="off" oninput="sugerirParticipanteFis(this)" onkeydown="teclaSugestaoFis(event, this)" onblur="fecharSugestoesFis()"'
let sugestaoFis = { timer: null, seq: 0, input: null, lista: [], ativo: -1 }

function sugerirParticipanteFis(input) {
    clearTimeout(sugestaoFis.timer)
    const termo = input.value.trim()
    // Apagou o nome ou o CPF/CNPJ: o cliente saiu, então o resto do bloco sai junto.
    if (!termo) {
        fecharSugestoesFis()
        return limparDestinatarioFis(input.closest('.fis-form'))
    }
    // CPF/CNPJ completo segue pelo onchange (buscarParticipanteFis); aqui só o começo do número.
    if (input.name === 'd_documento' && [11, 14].includes(soDigFis(termo).length)) return fecharSugestoesFis()
    if (termo.length < 2 || (input.name === 'd_documento' && soDigFis(termo).length < 3)) return fecharSugestoesFis()
    sugestaoFis.timer = setTimeout(async () => {
        const seq = ++sugestaoFis.seq
        try {
            const { participantes = [] } = await apiFiscal('participante', { texto: termo })
            if (seq !== sugestaoFis.seq || document.activeElement !== input) return
            mostrarSugestoesFis(input, participantes)
        } catch (err) {
            console.error(err)
        }
    }, 250)
}

function mostrarSugestoesFis(input, lista) {
    sugestaoFis = { ...sugestaoFis, input, lista, ativo: -1 }
    let caixa = document.getElementById('fis-sugestoes')
    if (!caixa) {
        caixa = document.createElement('div')
        caixa.id = 'fis-sugestoes'
        caixa.className = 'fis-sugestoes'
        // mousedown (antes do blur do campo) para o clique valer.
        caixa.addEventListener('mousedown', e => {
            e.preventDefault()
            const item = e.target.closest('[data-indice]')
            if (item) escolherSugestaoFis(Number(item.dataset.indice))
        })
        document.body.appendChild(caixa)
        // Rolou a janela/popup: a lista (fixa) ficaria solta longe do campo.
        window.addEventListener('scroll', e => { if (!caixa.hidden && !caixa.contains(e.target)) fecharSugestoesFis() }, true)
        window.addEventListener('resize', () => fecharSugestoesFis())
    }
    caixa.innerHTML = lista.length
        ? lista.map((p, i) => `
            <div class="fis-sugestao" data-indice="${i}">
                <b>${escFis(p.nome || '')}</b>${p.inativo ? ' <small class="fis-negativo">inativo</small>' : ''}
                <small>${[docFormatadoFis(p.documento), p.fantasia, p.cidade].filter(Boolean).map(escFis).join(' · ')}</small>
            </div>`).join('')
        : '<div class="fis-sugestao-vazia">Nada encontrado no cadastro nem em notas anteriores.</div>'
    const r = input.getBoundingClientRect()
    const largura = Math.max(r.width, 360)
    caixa.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - largura - 4))}px`
    caixa.style.width = `${largura}px`
    const embaixo = window.innerHeight - r.bottom
    if (embaixo < 240 && r.top > embaixo) {
        caixa.style.top = ''
        caixa.style.bottom = `${window.innerHeight - r.top + 2}px`
    } else {
        caixa.style.bottom = ''
        caixa.style.top = `${r.bottom + 2}px`
    }
    caixa.hidden = false
}

function fecharSugestoesFis() {
    clearTimeout(sugestaoFis.timer)
    sugestaoFis.seq++
    const caixa = document.getElementById('fis-sugestoes')
    if (caixa) caixa.hidden = true
    sugestaoFis.lista = []
    sugestaoFis.ativo = -1
}

function teclaSugestaoFis(e, input) {
    const caixa = document.getElementById('fis-sugestoes')
    const aberta = caixa && !caixa.hidden && sugestaoFis.input === input && sugestaoFis.lista.length
    if (!aberta) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const n = sugestaoFis.lista.length
        sugestaoFis.ativo = (sugestaoFis.ativo + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
        caixa.querySelectorAll('.fis-sugestao').forEach((el, i) => el.classList.toggle('ativa', i === sugestaoFis.ativo))
        caixa.querySelector('.fis-sugestao.ativa')?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && sugestaoFis.ativo >= 0) {
        e.preventDefault()
        escolherSugestaoFis(sugestaoFis.ativo)
    } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        fecharSugestoesFis()
    }
}

// Escolhido: grava o CPF/CNPJ e completa o resto como se tivesse digitado o documento.
function escolherSugestaoFis(indice) {
    const p = sugestaoFis.lista[indice]
    const input = sugestaoFis.input
    fecharSugestoesFis()
    if (!p || !input) return
    const form = input.closest('.fis-form')
    const doc = form?.querySelector('[name="d_documento"]')
    const nome = form?.querySelector('[name="d_nome"]')
    if (!doc) return
    if (nome) nome.value = p.nome || ''
    const clienteId = form.querySelector('[name="d_cliente_id"]')
    if (clienteId) clienteId.value = ''
    doc.value = docFormatadoFis(p.documento)
    buscarParticipanteFis(doc)
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

// Esvazia o bloco Destinatário/Tomador (menos os campos em "manter") e volta o indicador de IE ao padrão.
function limparDestinatarioFis(form, manter = []) {
    if (!form) return
    form.querySelectorAll('[name^="d_"]').forEach(campo => {
        if (manter.includes(campo.name.slice(2))) return
        if (campo.name === 'd_indicador_ie') campo.value = '9'
        else campo.value = ''
    })
    const aviso = form.querySelector('[data-aviso-destinatario]')
    if (aviso) aviso.innerHTML = ''
    const bloco = form.querySelector('[data-bloco-destinatario]')
    if (bloco) bloco.dataset.preenchido = ''
    agendarPreviaFis()
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
        // Os dados do cliente anterior não podem ficar misturados com os do novo documento.
        // Sem cadastro, o nome digitado fica se não veio do cliente anterior.
        const bloco = form.querySelector('[data-bloco-destinatario]')
        const anterior = bloco?.dataset.preenchido
        if (anterior && anterior !== doc) limparDestinatarioFis(form, ['documento'])
        else if (p?.fonte) limparDestinatarioFis(form, ['documento', 'nome'])
        if (!p?.fonte) {
            aviso.innerHTML = '<small>Não encontrado no cadastro nem em notas anteriores: preencha os dados.</small>'
            return
        }
        for (const [k, v] of Object.entries(p)) {
            const campo = form.querySelector(`[name="d_${k}"]`)
            if (campo && v != null && v !== '' && k !== 'documento') campo.value = k === 'indicador_ie' ? String(v) : v
        }
        // Sem indicador no cadastro: pelo IE (com IE = 1, ISENTO = 2, sem IE = 9).
        const indicador = form.querySelector('[name="d_indicador_ie"]')
        if (indicador && !p.indicador_ie) indicador.value = indicadorPadraoFis({ ...p, documento: doc })
        if (bloco) bloco.dataset.preenchido = doc
        aviso.innerHTML = `<small class="fis-positivo">Dados ${p.fonte === 'fiscal' ? 'de notas anteriores' : 'do cadastro de clientes'}: confira.</small>`
        agendarPreviaFis()
    } catch (err) {
        aviso.innerHTML = `<span class="fis-negativo">${escFis(err.message)}</span>`
    }
}

// ---------------------------------------------------------------- NF-e

// Um formulário de NF-e por vez: o código lê [data-form-nfe] / [data-itens-nfe] da página e um
// segundo aberto misturaria os itens. Se já existe um (mesmo minimizado), ele volta para a frente.
let abrindoEmissaoNFe = false
async function formularioEmissaoNFe(inicial = {}) {
    const aberto = document.querySelector('[data-form-nfe]')
    if (aberto) return trazerJanelaParaFrente(aberto)
    if (abrindoEmissaoNFe) return
    abrindoEmissaoNFe = true
    let op
    try {
        overlayAguarde()
        op = await carregarOpcoesEmissao()
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    } finally {
        abrindoEmissaoNFe = false
    }
    const empresas = op.empresas.filter(e => e.emite_nfe)
    const app = inicial.app || empresas.find(e => e.app === 'AC')?.app || empresas[0]?.app
    const o = inicial.opcoes || {}
    // Kanban: "previa" = clique no cartão em Requisição (só olhar, o cartão não anda);
    // "logistica" = separação feita pelo acesso log (só transportadora e volumes ficam abertos).
    const trava = inicial.fluxo_item ? (inicial.previa ? 'previa' : PERFIS_SO_CONSULTA_FIS.includes(acesso?.permissao) ? 'logistica' : '') : ''
    const avisoTrava = {
        previa: 'Prévia da separação: nada é salvo e o cartão continua em Requisição. Para separar, arraste o cartão para Separado.',
        logistica: 'Informe o frete, a transportadora e os volumes. Os dados da nota e os tributários ficam com o faturamento.'
    }[trava]
    const elemento = `
        <div class="fis-form fis-form-emissao" data-form-nfe data-id="${escFis(inicial.id || '')}" data-fluxo-item="${escFis(inicial.fluxo_item || '')}" data-trava="${trava}" oninput="agendarPreviaFis()" onchange="agendarPreviaFis()">
            ${avisoTrava ? `<div class="fis-aviso fis-aviso-trava">${escFis(avisoTrava)}</div>` : ''}
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
                        <thead><tr><th>Cód.</th><th>Item</th><th>NCM</th><th>Origem</th><th>Un.</th><th>Qtd</th><th>Valor unit.</th><th>Desconto</th><th>Total</th><th></th></tr></thead>
                        <tbody data-itens-nfe></tbody>
                    </table>
                </div>
                <button type="button" class="fis-mini" onclick="adicionarItemNFe()">+ Item</button>
            </fieldset>
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">4</span> Transporte <small>— ${inicial.fluxo_item ? 'transportadora e volumes obrigatórios na separação' : 'o valor do frete fica para o envio (Logística)'}</small></legend>
                <div class="fis-grade">
                    ${campoFis('Frete por conta de', `<select class="fis-input" name="modalidade_frete">${opcoesFis([['9', 'Sem frete'], ['0', 'Emitente (CIF)'], ['1', 'Destinatário (FOB)'], ['2', 'Terceiros']], o.modalidade_frete ?? (inicial.fluxo_item ? '0' : '9'))}</select>`)}
                    ${campoFis(`Transportadora${inicial.fluxo_item ? ' *' : ''}`, `<select class="fis-input" name="transportadora" onchange="trocarTransportadoraNFe(this)">
                        <option value="">Selecione</option>
                        <option value="SEM_TRANSPORTE" ${o.sem_transporte ? 'selected' : ''}>SEM TRANSPORTE</option>
                        ${(op.transportadoras || []).map(t => `<option value="${escFis(t.id)}" ${String(o.transportador?.id || '') === String(t.id) ? 'selected' : ''}>${escFis(t.razao_social || t.nome)}${t.cnpj ? ` · ${escFis(docFormatadoFis(t.cnpj))}` : ''}</option>`).join('')}
                    </select>`, 'fis-largo')}
                    ${campoFis(`Volumes${inicial.fluxo_item ? ' *' : ''}`, inputFis('volumes', o.volumes || '', 'type="number" min="1" step="1" inputmode="numeric"'))}
                </div>
            </fieldset>
            ${blocoPagamentoFis(5, o.pagamento || inicial.pagamento || {})}
            ${blocoRateioFis(6, rateioInicialFis(inicial))}
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">7</span> Complementos</legend>
                <div class="fis-grade">
                    ${campoFis('Consumidor final', `<select class="fis-input" name="consumidor_final">${opcoesFis([['', 'Automático (pela IE)'], ['1', 'Sim'], ['0', 'Não']], o.consumidor_final ?? '')}</select>`)}
                    ${inicial.fluxo_item
                        // Separação (kanban): o orçamento da nota é o do pedido que originou o item (liga a nota ao
                        // ORC). Os Departamentos (passo 6) já nascem com ele em 100% e podem ser rateados.
                        ? campoFis('Orçamento <small>(origem do pedido)</small>', inputFis('orcamento', inicial.orcamento, 'readonly title="Fixo: orçamento do pedido de origem"'))
                        : ''}
                    ${campoFis('Nº do pedido do cliente',
                        inputFis('numero_pedido', o.numero_pedido ?? inicial.numero_pedido ?? '',
                            `maxlength="60" placeholder="${escFis(inicial.situacao_pedido ? `${inicial.situacao_pedido}: informe o número, se houver` : 'Se houver')}"`))}
                </div>
                ${campoFis('Chave(s) da NF-e referenciada <small>(retorno, devolução; uma por linha)</small>', `<textarea class="fis-input" name="referenciadas" rows="2">${escFis((o.referenciadas || []).join('\n'))}</textarea>`)}
                ${campoFis('Informações complementares', `<textarea class="fis-input" name="informacoes_complementares" rows="2">${escFis(o.informacoes_complementares || '')}</textarea>`)}
            </fieldset>
            <div class="fis-previa" data-previa></div>
        </div>`
    popup({
        titulo: trava === 'previa' ? 'Prévia da separação' : inicial.fluxo_item ? 'Separar: dados da NF-e' : inicial.id ? 'Editar NF-e' : 'Emitir NF-e',
        linhas: [{ elemento }],
        conteudoRodape: '<div class="fis-rodape-nfe" data-rodape-total-nfe></div>',
        // Aberta pelo kanban (Requisição → Separado): só salva; a emissão é o arraste para Faturado.
        botoes: trava === 'previa'
            ? [{ texto: 'Espelho', img: 'pdf', funcao: 'espelhoEmissaoFis(this)' }]
            : inicial.fluxo_item
            ? [
                { texto: 'Espelho', img: 'pdf', funcao: 'espelhoEmissaoFis(this)' },
                { texto: 'Salvar', img: 'salvo', funcao: 'salvarEmissaoFis(false, this)' }
            ]
            : [
                { texto: 'Espelho', img: 'pdf', funcao: 'espelhoEmissaoFis(this)' },
                { texto: 'Salvar rascunho', img: 'salvo', funcao: 'salvarEmissaoFis(false, this)' },
                { texto: 'Emitir', img: 'concluido', funcao: 'salvarEmissaoFis(true, this)' }
            ]
    })
    const form = document.querySelector('[data-form-nfe]')
    totalRateioFis = null
    somarRateioFis(form)
    trocarEmpresaNFe(form.querySelector('[name="app"]'), inicial.operacao_id)
    for (const item of inicial.itens?.length ? inicial.itens : [{}]) adicionarItemNFe(item)
    previaPagamentoFis(form.querySelector('[name="pag_forma"]'))
    if (trava) travarFormNFe(form, trava === 'logistica' ? ['modalidade_frete', 'transportadora', 'volumes'] : [])
    // Logística vê só o passo 4 (Transporte); os demais continuam no formulário (travados) para salvar.
    if (trava === 'logistica')
        form.querySelectorAll('.fis-passo, [data-previa]').forEach(el => {
            if (!el.querySelector('[name="transportadora"]')) el.style.display = 'none'
        })
    agendarPreviaFis()
}

// Separação "SEM TRANSPORTE": a nota sai sem transportadora e com frete "Sem frete" (9).
// Voltando para uma transportadora, o frete não pode ficar em "Sem frete": volta para Emitente (CIF).
function trocarTransportadoraNFe(select) {
    const frete = select.form?.querySelector('[name="modalidade_frete"]') || select.closest('[data-form-nfe]')?.querySelector('[name="modalidade_frete"]')
    if (!frete) return
    if (select.value === 'SEM_TRANSPORTE') frete.value = '9'
    else if (select.value && frete.value === '9') frete.value = '0'
    agendarPreviaFis()
}

// Trava o formulário: campos só leitura (menos os liberados) e sem os botões de incluir/remover.
// O servidor confere de novo (gcs: /fluxo-itens/logistica usa só transportadora e volumes da tela).
function travarFormNFe(form, liberados = []) {
    form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(el => {
        if (!liberados.includes(el.name)) el.disabled = true
    })
    form.querySelectorAll('button').forEach(b => { b.style.display = 'none' })
}

function trocarEmpresaNFe(select, operacaoInicial) {
    const form = select.closest('.fis-form')
    const app = select.value
    const op = opcoesEmissaoFiscal
    const empresa = op.empresas.find(e => e.app === app)
    const lista = op.operacoes.filter(o => o.app === app && Number(o.finalidade) !== 4)
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
    // Código numa coluna própria (antes ficava embaixo da descrição e desalinhava as linhas);
    // saldo e "sem NCM" ficam na dica do código.
    tr.innerHTML = `
        <td class="fis-item-cod" data-item-info>${item.item_id ? escFis(item.codigo || item.item_id) : ''}</td>
        <td class="fis-item-cel">
            <input type="hidden" name="item_id" value="${escFis(item.item_id || '')}">
            <input type="hidden" name="codigo" value="${escFis(item.codigo || '')}">
            <input class="fis-input" name="descricao" value="${escFis(item.descricao || '')}" placeholder="Buscar item do cadastro…"
                onkeydown="if (event.key === 'Enter') { event.preventDefault(); buscarItemEmissaoFis(this) }" onchange="if (!this.closest('tr').querySelector('[name=item_id]').value) buscarItemEmissaoFis(this)">
        </td>
        <td><input class="fis-input fis-curto" name="ncm" value="${escFis(item.ncm || '')}" maxlength="10" inputmode="numeric"></td>
        <td><select class="fis-input fis-curto" name="origem">${opcoesFis(Object.entries(ORIGENS_MERCADORIA), item.origem ?? '0')}</select></td>
        <td><input class="fis-input fis-curto" name="unidade" value="${escFis(item.unidade || 'UN')}" maxlength="6"></td>
        <td><input class="fis-input fis-curto" name="quantidade" type="number" min="0" step="any" value="${escFis(item.quantidade || 1)}"></td>
        <td><input class="fis-input fis-curto" name="valor_unitario" type="number" min="0" step="0.0001" value="${escFis(item.valor_unitario || '')}"></td>
        <td><input class="fis-input fis-curto" name="desconto" type="number" min="0" step="0.01" value="${escFis(item.desconto || '')}"></td>
        <td class="fis-num" data-total-item></td>
        <td><button type="button" class="fis-remover-linha" title="Remover" aria-label="Remover" onclick="this.closest('tr').remove(); agendarPreviaFis()">${iconeLixeiraFis}</button></td>`
    corpo.appendChild(tr)
}

// Última lista de itens buscados na emissão (o botão "Usar" aponta pelo índice).
let itensBuscadosEmissaoFis = []

// Janela "Escolher item": busca no topo (refaz a pesquisa sem fechar), cartões clicáveis com
// código, descrição, fabricante/modelo, NCM e saldo; ↑/↓ escolhem e Enter usa o item marcado.
function cartoesItensEmissaoFis(itens, linha, termo) {
    if (!itens.length) return `<div class="fis-escolha-vazio">Nada encontrado para <b>${escFis(termo)}</b>.<br><small>Tente outra parte do nome, o código ou o modelo.</small></div>`
    return itens.map((c, i) => {
        const extra = [c.fabricante, c.modelo].filter(Boolean).map(escFis).join(' · ')
        const saldo = c.saldo != null ? Number(c.saldo) : null
        return `
            <button type="button" class="fis-escolha-item${i === 0 ? ' ativo' : ''}" data-indice="${i}"
                onclick="usarItemEmissaoFis('${linha}', ${i}, this)" onmouseenter="marcarEscolhaItemFis(this)">
                <span class="fis-escolha-cod">${escFis(c.codigo || '—')}</span>
                <span class="fis-escolha-texto">
                    <b>${escFis(c.descricao)}</b>
                    ${extra ? `<small>${extra}</small>` : ''}
                </span>
                <span class="fis-escolha-dados">
                    ${c.ncm ? `<span class="fis-escolha-ncm" title="NCM">NCM ${escFis(c.ncm)}</span>` : '<span class="fis-escolha-ncm sem" title="Item sem NCM no cadastro">sem NCM</span>'}
                    ${saldo != null ? `<span class="fis-escolha-saldo${saldo > 0 ? ' tem' : ''}" title="Saldo em estoque">${qtdEst(saldo)} ${escFis(c.unidade || 'UN')}</span>` : ''}
                </span>
                <span class="fis-escolha-usar">Usar →</span>
            </button>`
    }).join('')
}

function marcarEscolhaItemFis(el) {
    el.parentElement.querySelectorAll('.fis-escolha-item.ativo').forEach(b => b.classList.remove('ativo'))
    el.classList.add('ativo')
}

async function pesquisarEscolhaItemFis(input) {
    const caixa = input.closest('[data-escolher-item]')
    const termo = input.value.trim()
    if (!caixa || termo.length < 2) return
    const lista = caixa.querySelector('[data-escolha-lista]')
    lista.classList.add('carregando')
    try {
        const { itens } = await apiFiscal('itens/sugestoes', { texto: termo, limite: 12 })
        itensBuscadosEmissaoFis = itens
        lista.innerHTML = cartoesItensEmissaoFis(itens, caixa.dataset.escolherItem, termo)
        caixa.querySelector('[data-escolha-contagem]').textContent = contagemEscolhaFis(itens.length)
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    } finally {
        lista.classList.remove('carregando')
    }
}

function teclaEscolhaItemFis(event, input) {
    const lista = input.closest('[data-escolher-item]')?.querySelector('[data-escolha-lista]')
    if (!lista) return
    const cartoes = [...lista.querySelectorAll('.fis-escolha-item')]
    const atual = cartoes.findIndex(b => b.classList.contains('ativo'))
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!cartoes.length) return
        const prox = cartoes[Math.max(0, Math.min(cartoes.length - 1, atual + (event.key === 'ArrowDown' ? 1 : -1)))]
        marcarEscolhaItemFis(prox)
        prox.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
        event.preventDefault()
        // Texto mudou desde a última busca: pesquisa de novo; senão usa o cartão marcado.
        if (input.value.trim() !== input.dataset.ultimo) {
            input.dataset.ultimo = input.value.trim()
            pesquisarEscolhaItemFis(input)
        } else if (atual >= 0) cartoes[atual].click()
    }
}

const contagemEscolhaFis = n => n ? `${n} ${n === 1 ? 'item' : 'itens'}${n >= 12 ? ' (refine a busca para ver outros)' : ''}` : ''

async function buscarItemEmissaoFis(input) {
    const termo = input.value.trim()
    if (termo.length < 2) return
    const linha = soDigFis(input.closest('tr').dataset.linha)
    // Enter abre a janela e o foco vai para a busca dela; o campo da linha perde o foco e dispara o
    // onchange, que chamaria esta função de novo. Uma janela por linha: se já existe (ou está abrindo), não abre outra.
    const aberta = document.querySelector(`[data-escolher-item="${linha}"]`)
    if (input.dataset.buscando || aberta) {
        aberta?.querySelector('.fis-escolha-busca input')?.focus()
        return
    }
    input.dataset.buscando = '1'
    try {
        const { itens } = await apiFiscal('itens/sugestoes', { texto: termo, limite: 12 })
        itensBuscadosEmissaoFis = itens
        popup({
            titulo: 'Escolher item',
            elemento: `
                <div class="fis-escolha" data-escolher-item="${linha}">
                    <div class="fis-escolha-busca">
                        <input class="fis-input" value="${escFis(termo)}" data-ultimo="${escFis(termo)}" placeholder="Nome, código ou modelo…"
                            autocomplete="off" onkeydown="teclaEscolhaItemFis(event, this)">
                        <span data-escolha-contagem>${contagemEscolhaFis(itens.length)}</span>
                    </div>
                    <div class="fis-escolha-lista" data-escolha-lista>${cartoesItensEmissaoFis(itens, linha, termo)}</div>
                    <div class="fis-escolha-dica"><kbd>↑</kbd><kbd>↓</kbd> escolher · <kbd>Enter</kbd> usar ou buscar de novo</div>
                </div>`
        })
        const campo = [...document.querySelectorAll(`[data-escolher-item="${linha}"] .fis-escolha-busca input`)].pop()
        campo?.focus()
        campo?.select()
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    } finally {
        delete input.dataset.buscando
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
    const info = tr.querySelector('[data-item-info]')
    info.textContent = c.codigo || ''
    info.title = [c.saldo != null ? `Saldo ${qtdEst(c.saldo)}` : '', c.ncm ? '' : 'SEM NCM no cadastro'].filter(Boolean).join(' · ')
    info.classList.toggle('fis-negativo', !c.ncm)
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
    const transportadora = (opcoesEmissaoFiscal?.transportadoras || []).find(t => String(t.id) === v('transportadora'))
    const semTransporte = v('transportadora') === 'SEM_TRANSPORTE'
    const rateio = lerRateioFis(form.querySelector('[data-rateio]'))
    return {
        modelo: 'NFE',
        app: v('app'),
        operacao_id: v('operacao_id'),
        destinatario: lerDestinatarioFis(form),
        itens,
        opcoes: {
            modalidade_frete: semTransporte ? '9' : v('modalidade_frete'),
            sem_transporte: semTransporte || undefined,
            consumidor_final: v('consumidor_final') === '' ? undefined : v('consumidor_final'),
            referenciadas: v('referenciadas').split(/\s+/).map(soDigFis).filter(Boolean),
            informacoes_complementares: v('informacoes_complementares'),
            // Bloco de transporte da nota (o valor do frete é calculado depois, no envio).
            transportador: transportadora ? {
                id: transportadora.id, nome: transportadora.razao_social || transportadora.nome, documento: soDigFis(transportadora.cnpj),
                inscricao_estadual: transportadora.inscricao_estadual || '', endereco: transportadora.endereco || '',
                municipio: String(transportadora.cidade || '').replace(/\s*\([A-Z]{2}\)\s*$/, ''), uf: transportadora.estado || ''
            } : undefined,
            volumes: Number(v('volumes')) || undefined,
            // Nº do pedido do cliente: rodapé da nota (informações complementares).
            numero_pedido: v('numero_pedido') || undefined,
            // Forma e parcelas: fatura/duplicatas da nota e contas a receber no Financeiro.
            pagamento: lerPagamentoFis(form)
        },
        // Separação: o orçamento fica o do pedido (mesmo com rateio). Nota avulsa: o departamento ou 'RATEIO'.
        orcamento: form.querySelector('[name="orcamento"]') ? v('orcamento') : (rateio.length === 1 ? rateio[0].departamento : rateio.length ? 'RATEIO' : ''),
        rateio
    }
}

// ---------------------------------------------------------------- departamentos (rateio)
// Seção própria da NF-e avulsa e da NFS-e: divide a nota entre departamentos (contratos ORC e setores da
// lista do Financeiro, vw_fin_departamentos). As faturas a receber da nota autorizada saem divididas por
// este rateio (gcs SCRIPTS/financeiro.js gerarReceberDaNota). Lista FECHADA como no Financeiro: o texto
// só busca; o departamento entra clicando num item. Um só = 100%.
// Cada linha aceita % ou R$: o que o usuário mexeu por último manda (data-modo) e o outro é calculado
// sobre o total da nota; se o total mudar, a linha em R$ mantém o valor e a linha em % mantém o percentual.
// O percentual vai com 6 casas (o valor em R$ bate no centavo). "Colar da planilha": várias linhas de uma vez.

const normalFis = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const destinosFis = () => opcoesEmissaoFiscal?.destinos || []
const rotuloDestinoFis = d => d ? `${d.id}${d.cliente ? ` · ${d.cliente}` : d.tipo === 'SETOR' ? ' · setor' : ''}${d.cidade ? ` (${d.cidade})` : ''}` : ''
const r2Fis = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100
const r6Fis = v => Math.round(Number(v) * 1e6) / 1e6
// Percentual no campo: até 4 casas (o cálculo usa a precisão toda).
const pctCampoFis = v => String(Number(Number(v).toFixed(4)))
const pctTextoFis = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 })
// Base do valor por departamento: o que a prévia calculou (NF-e: total da nota; NFS-e: líquido a receber).
let totalRateioFis = null

function rateioInicialFis(inicial = {}) {
    if (Array.isArray(inicial.rateio) && inicial.rateio.length) return inicial.rateio
    return inicial.orcamento && inicial.orcamento !== 'RATEIO' ? [{ departamento: inicial.orcamento, percentual: 100 }] : []
}

function blocoRateioFis(numero, linhas = []) {
    const lista = linhas.length ? linhas : [{ departamento: '', percentual: 100 }]
    return `
        <fieldset class="fis-passo" data-rateio>
            <legend><span class="fis-num-passo">${numero}</span> Departamentos <small>— contrato (ORC) ou setor; vários = rateio em % ou em R$. Os recebimentos desta nota são divididos assim</small></legend>
            <div class="fis-rateio">
                <div class="fis-rateio-cab"><span>Departamento</span><span>%</span><span>Valor (R$)</span><span></span></div>
                <div data-rateio-linhas>${lista.map(linhaRateioFis).join('')}</div>
                <div class="fis-rateio-rodape">
                    <span>
                        <button type="button" class="fis-mini" onclick="adicionarRateioFis(this)">+ Departamento</button>
                        <button type="button" class="fis-mini" onclick="abrirColarRateioFis()" title="Colar várias linhas (ORC e valor) de uma planilha">Colar da planilha</button>
                        <button type="button" class="fis-mini" onclick="dividirRateioFis(this)" title="Mesmo percentual para todos os departamentos">Dividir igual</button>
                    </span>
                    <small data-rateio-soma></small>
                </div>
            </div>
        </fieldset>`
}

function linhaRateioFis(l = {}) {
    const dep = destinosFis().find(d => d.id === l.departamento)
    // Departamento salvo que saiu da lista: fica visível (o servidor recusa ao salvar e diz qual é).
    const id = dep ? dep.id : (l.departamento || '')
    const modo = l.modo === 'valor' && l.valor != null ? 'valor' : 'pct'
    return `
        <div class="fis-rateio-linha" data-modo="${modo}">
            <div class="fin-escolha" data-valor="${escFis(id)}">
                <input class="fis-input" name="rateio_busca" value="${escFis(dep ? rotuloDestinoFis(dep) : id)}" placeholder="Buscar contrato, cliente ou setor…" autocomplete="off"
                    onfocus="this.select(); buscarDestinoFis(this)" oninput="buscarDestinoFis(this)" onblur="setTimeout(() => fecharBuscaDestinoFis(this), 150)">
                <div class="fin-escolha-lista" hidden></div>
            </div>
            <input class="fis-input fis-curto" name="rateio_percentual" type="number" min="0" max="100" step="any" placeholder="%"
                value="${l.percentual != null && l.percentual !== '' ? pctCampoFis(l.percentual) : ''}" oninput="editarRateioFis(this, 'pct')">
            <input class="fis-input fis-curto fis-num" name="rateio_valor" type="number" min="0" step="0.01" placeholder="R$"
                value="${modo === 'valor' ? escFis(l.valor) : ''}" oninput="editarRateioFis(this, 'valor')">
            <button type="button" class="fis-remover-linha" title="Tirar departamento" aria-label="Tirar departamento" onclick="removerRateioFis(this)">${iconeLixeiraFis}</button>
        </div>`
}

// Mexeu no % ou no R$: essa linha passa a ser guiada por ele; o outro campo é recalculado.
function editarRateioFis(input, modo) {
    input.closest('.fis-rateio-linha').dataset.modo = modo
    somarRateioFis(input)
}

function adicionarRateioFis(botao) {
    const bloco = botao.closest('[data-rateio]')
    const linhas = bloco.querySelector('[data-rateio-linhas]')
    // A linha nova já vem com o que falta para 100%.
    const soma = lerRateioFis(bloco, true).reduce((s, l) => s + l.percentual, 0)
    linhas.insertAdjacentHTML('beforeend', linhaRateioFis({ departamento: '', percentual: soma < 100 ? r6Fis(100 - soma) : '' }))
    somarRateioFis(bloco)
    linhas.lastElementChild.querySelector('[name="rateio_busca"]').focus()
}

function removerRateioFis(botao) {
    const bloco = botao.closest('[data-rateio]')
    botao.closest('.fis-rateio-linha').remove()
    if (!bloco.querySelector('.fis-rateio-linha')) bloco.querySelector('[data-rateio-linhas]').insertAdjacentHTML('beforeend', linhaRateioFis({ percentual: 100 }))
    somarRateioFis(bloco)
    agendarPreviaFis()
}

function dividirRateioFis(botao) {
    const bloco = botao.closest('[data-rateio]')
    const linhas = [...bloco.querySelectorAll('.fis-rateio-linha')]
    if (!linhas.length) return
    const parte = r6Fis(100 / linhas.length)
    linhas.forEach((l, i) => {
        l.dataset.modo = 'pct'
        l.querySelector('[name="rateio_percentual"]').value = pctCampoFis(i === linhas.length - 1 ? r6Fis(100 - parte * (linhas.length - 1)) : parte)
    })
    somarRateioFis(bloco)
}

function buscarDestinoFis(input) {
    const caixa = input.closest('.fin-escolha')
    const lista = caixa.querySelector('.fin-escolha-lista')
    const termo = normalFis(input.value).trim()
    const todos = destinosFis()
    // O que já está escolhido não filtra (ao focar, mostra tudo de novo). Os já usados em outra linha saem.
    const filtro = termo && termo !== normalFis(rotuloDestinoFis(todos.find(d => d.id === caixa.dataset.valor))) ? termo.split(/\s+/) : []
    const usados = new Set([...input.closest('[data-rateio]').querySelectorAll('.fin-escolha')].filter(c => c !== caixa).map(c => c.dataset.valor))
    const achados = todos
        .filter(d => !usados.has(d.id) && filtro.every(p => normalFis(`${d.id} ${d.cliente || ''} ${d.cidade || ''}`).includes(p)))
        .slice(0, 40)
    lista.innerHTML = achados.map(d => `
        <button type="button" class="fin-escolha-item" onmousedown="event.preventDefault(); escolherDestinoFis(this, '${escFis(d.id)}')">
            <b>${escFis(d.id)}</b> <span>${escFis(d.cliente || (d.tipo === 'SETOR' ? 'Setor' : ''))}${d.cidade ? ` · ${escFis(d.cidade)}` : ''}</span>
        </button>`).join('') || '<div class="fin-escolha-vazio">Nada encontrado: só contratos e setores da lista do Financeiro.</div>'
    lista.hidden = false
}

function escolherDestinoFis(botao, id) {
    const caixa = botao.closest('.fin-escolha')
    caixa.dataset.valor = id
    caixa.querySelector('input').value = rotuloDestinoFis(destinosFis().find(d => d.id === id))
    caixa.querySelector('.fin-escolha-lista').hidden = true
    somarRateioFis(caixa)
    agendarPreviaFis()
}

// Saiu do campo sem escolher: volta para o que estava escolhido (texto solto não fica).
function fecharBuscaDestinoFis(input) {
    const caixa = input.closest('.fin-escolha')
    if (!caixa) return
    caixa.querySelector('.fin-escolha-lista').hidden = true
    const dep = destinosFis().find(d => d.id === caixa.dataset.valor)
    input.value = dep ? rotuloDestinoFis(dep) : (caixa.dataset.valor || '')
}

// Linhas do rateio. todas = true: inclui as sem departamento e não arredonda (para somar e conferir).
// Senão: só as com departamento, percentual em 6 casas e o resíduo do arredondamento no maior (soma 100 exato).
function lerRateioFis(raiz, todas = false) {
    const total = totalRateioFis
    const linhas = [...(raiz?.querySelectorAll('.fis-rateio-linha') || [])].map(l => {
        const modo = l.dataset.modo === 'valor' ? 'valor' : 'pct'
        const valorCampo = Number(l.querySelector('[name="rateio_valor"]')?.value) || 0
        const pctCampo = Number(l.querySelector('[name="rateio_percentual"]')?.value) || 0
        const percentual = modo === 'valor' ? (total ? valorCampo * 100 / total : null) : pctCampo
        return {
            departamento: l.querySelector('.fin-escolha')?.dataset.valor || '',
            modo,
            percentual: percentual ?? 0,
            semTotal: percentual == null,
            valor: modo === 'valor' ? r2Fis(valorCampo) : total ? r2Fis(total * pctCampo / 100) : null
        }
    })
    if (todas) return linhas
    const r = linhas.filter(l => l.departamento)
    if (r.length === 1) return [{ departamento: r[0].departamento, percentual: 100 }]
    r.forEach(l => l.percentual = r6Fis(l.percentual))
    const soma = r.reduce((s, l) => s + l.percentual, 0)
    if (r.length && Math.abs(100 - soma) < 0.001) {
        const maior = r.reduce((a, l) => l.percentual > a.percentual ? l : a)
        maior.percentual = r6Fis(maior.percentual + 100 - soma)
    }
    // modo/valor voltam no Editar (a linha em R$ reabre em R$).
    return r.map(l => ({ departamento: l.departamento, percentual: l.percentual, ...(l.modo === 'valor' ? { modo: 'valor', valor: l.valor } : {}) }))
}

function somarRateioFis(el) {
    const form = el?.closest?.('.fis-form') || formEmissaoAberto()
    const bloco = form?.querySelector('[data-rateio]')
    if (!bloco) return
    const total = totalRateioFis
    const ativo = document.activeElement
    const linhas = [...bloco.querySelectorAll('.fis-rateio-linha')]
    const unica = linhas.length === 1
    for (const l of linhas) {
        const pct = l.querySelector('[name="rateio_percentual"]')
        const val = l.querySelector('[name="rateio_valor"]')
        // Um departamento só: 100% do total, sem o que digitar.
        pct.readOnly = val.readOnly = unica
        if (unica) {
            l.dataset.modo = 'pct'
            pct.value = 100
            val.value = total != null ? total.toFixed(2) : ''
            continue
        }
        if (total == null) continue
        // Recalcula só o campo que não manda (e nunca o que o usuário está digitando).
        if (l.dataset.modo === 'valor') {
            if (pct !== ativo) pct.value = val.value === '' ? '' : pctCampoFis((Number(val.value) || 0) * 100 / total)
        } else if (val !== ativo) {
            val.value = pct.value === '' ? '' : r2Fis(total * (Number(pct.value) || 0) / 100).toFixed(2)
        }
    }
    const todas = lerRateioFis(bloco, true)
    const alvo = bloco.querySelector('[data-rateio-soma]')
    if (todas.some(l => l.semTotal)) {
        alvo.className = 'fis-pendente'
        alvo.textContent = 'Aguardando o total da nota para converter os valores em %…'
        return
    }
    const soma = todas.reduce((s, l) => s + l.percentual, 0)
    const ok = Math.abs(soma - 100) < 0.001
    const somaValor = total != null ? r2Fis(total * soma / 100) : null
    alvo.className = ok ? 'fis-positivo' : 'fis-negativo'
    alvo.textContent = ok
        ? `Soma 100% ✓${total != null ? ` · ${dinheiroTexto(total)}` : ''}`
        : `Soma ${pctTextoFis(soma)}%${total != null ? ` (${dinheiroTexto(somaValor)} de ${dinheiroTexto(total)})` : ''} · ${soma < 100 ? 'faltam' : 'sobram'} ${pctTextoFis(Math.abs(100 - soma))}%${total != null ? ` (${dinheiroTexto(Math.abs(r2Fis(total - somaValor)))})` : ''}`
}

// Erros do rateio antes de salvar (o servidor confere de novo).
function errosRateioFis(form) {
    const bloco = form.querySelector('[data-rateio]')
    if (!bloco) return []
    const todas = lerRateioFis(bloco, true)
    const preenchidas = todas.filter(l => l.departamento)
    const erros = []
    if (todas.length > 1 && preenchidas.length < todas.length)
        erros.push('Há linha de departamento sem departamento escolhido: escolha na lista ou tire a linha.')
    if (preenchidas.length > 1) {
        if (preenchidas.some(l => l.semTotal)) erros.push('O rateio está em R$ e o total da nota ainda não foi calculado: confira os dados da nota e tente de novo.')
        else {
            const soma = preenchidas.reduce((s, l) => s + l.percentual, 0)
            if (Math.abs(soma - 100) >= 0.001) erros.push(`O rateio entre departamentos precisa somar 100% do total (está em ${pctTextoFis(soma)}%).`)
            if (preenchidas.some(l => !(l.percentual > 0))) erros.push('Cada departamento do rateio precisa de um percentual ou valor maior que zero.')
        }
    }
    return erros
}

// ---------------- colar da planilha
// Uma linha por departamento: o ORC (orc123, ORC 123, ORC_123) ou o nome do setor e o valor em R$
// (1.234,56 · 1234.56 · R$ 1.234,56) ou o percentual (com %). Colunas separadas por tab (Excel), ; ou espaço.
// Departamento repetido soma. A colagem substitui as linhas da seção.

function numeroColadoFis(texto) {
    let t = String(texto || '').replace(/R\$|\s/gi, '')
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
    const n = Number(t)
    return Number.isFinite(n) ? n : null
}

function interpretarColagemRateioFis(texto) {
    const deps = destinosFis()
    const chave = id => normalFis(id).replace(/[\s_-]/g, '')
    const porChave = new Map(deps.map(d => [chave(d.id), d]))
    // Setores pelo nome (o mais longo primeiro: "ASSISTENCIA TECNICA" antes de "ASSISTENCIA").
    const setores = deps.filter(d => d.tipo === 'SETOR').sort((a, b) => b.id.length - a.id.length)
    const linhas = []
    for (const bruta of String(texto || '').split(/\r?\n/)) {
        const original = bruta.trim()
        if (!original) continue
        let id = null, dep = null, resto = original
        const orc = original.match(/orc[\s_-]*(\d+)/i)
        if (orc) {
            id = `ORC_${orc[1]}`
            dep = porChave.get(chave(id)) || null
            resto = original.replace(orc[0], ' ')
        } else {
            const norm = normalFis(original)
            dep = setores.find(s => norm.startsWith(normalFis(s.id))) || null
            if (dep) { id = dep.id; resto = original.slice(dep.id.length) }
        }
        const num = resto.match(/(R\$\s*)?-?\d[\d.,]*\s*(%)?/i)
        const valor = num ? numeroColadoFis(num[0].replace('%', '')) : null
        const modo = num?.[2] ? 'pct' : 'valor'
        // Linha sem departamento e sem número (cabeçalho, título): ignora.
        if (!id && valor == null) continue
        let erro = ''
        if (!id) erro = 'departamento não reconhecido'
        else if (!dep) erro = 'fora da lista do Financeiro'
        else if (valor == null) erro = 'sem valor'
        else if (!(valor > 0)) erro = 'valor tem que ser maior que zero'
        linhas.push({ original, id: dep?.id || id, dep, valor, modo, erro })
    }
    // Repetidos: soma (no mesmo tipo: R$ com R$, % com %).
    const juntas = []
    for (const l of linhas) {
        const igual = !l.erro && juntas.find(j => !j.erro && j.id === l.id)
        if (!igual) { juntas.push({ ...l, vezes: 1 }); continue }
        if (igual.modo !== l.modo) { juntas.push({ ...l, erro: 'repetido com R$ e % misturados' }); continue }
        igual.valor = igual.modo === 'pct' ? r6Fis(igual.valor + l.valor) : r2Fis(igual.valor + l.valor)
        igual.vezes++
    }
    return juntas
}

function abrirColarRateioFis() {
    popup({
        titulo: 'Colar departamentos da planilha',
        elemento: `
            <div class="fis-colar-rateio" data-colar-rateio>
                <small>Uma linha por departamento: o ORC (ex.: <b>orc123</b>, <b>ORC_123</b>) ou o nome do setor e o valor em R$
                    (<b>1.234,56</b>) ou o percentual (<b>25%</b>). Copie as duas colunas do Excel e cole aqui.
                    Departamento repetido soma. Substitui o rateio atual.</small>
                <textarea class="fis-input" rows="10" placeholder="ORC_6224&#9;12.500,00&#10;ORC_6231&#9;7.500,00" oninput="previaColarRateioFis(this)"></textarea>
                <div data-colar-previa></div>
            </div>`,
        botoes: [{ texto: 'Usar estas linhas', img: 'concluido', funcao: 'aplicarColarRateioFis(this)' }]
    })
    setTimeout(() => document.querySelector('[data-colar-rateio] textarea')?.focus(), 50)
}

function previaColarRateioFis(area) {
    const alvo = area.closest('[data-colar-rateio]').querySelector('[data-colar-previa]')
    const linhas = interpretarColagemRateioFis(area.value)
    if (!linhas.length) { alvo.innerHTML = ''; return }
    const boas = linhas.filter(l => !l.erro)
    const somaValor = r2Fis(boas.filter(l => l.modo === 'valor').reduce((s, l) => s + l.valor, 0))
    const somaPct = r6Fis(boas.filter(l => l.modo === 'pct').reduce((s, l) => s + l.valor, 0))
    const total = totalRateioFis
    const resumo = [
        somaValor ? `${dinheiroTexto(somaValor)} em R$` : '',
        somaPct ? `${pctTextoFis(somaPct)}% em percentual` : '',
        total != null ? `total da nota ${dinheiroTexto(total)}` : 'total da nota ainda não calculado'
    ].filter(Boolean).join(' · ')
    alvo.innerHTML = `
        <table class="fis-tabela">
            <thead><tr><th>Departamento</th><th>Cliente</th><th class="fis-num">Valor</th><th></th></tr></thead>
            <tbody>${linhas.map(l => `
                <tr>
                    <td><b>${escFis(l.id || '—')}</b>${l.vezes > 1 ? ` <small>(${l.vezes} linhas somadas)</small>` : ''}</td>
                    <td><small>${escFis(l.dep?.cliente || (l.dep?.tipo === 'SETOR' ? 'Setor' : ''))}</small></td>
                    <td class="fis-num">${l.valor == null ? '' : l.modo === 'pct' ? `${pctTextoFis(l.valor)}%` : dinheiroTexto(l.valor)}</td>
                    <td>${l.erro ? `<small class="fis-negativo">${escFis(l.erro)}: “${escFis(l.original)}”</small>` : '<small class="fis-positivo">✓</small>'}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        <small>${boas.length} de ${linhas.length} linha(s) reconhecida(s) · ${resumo}</small>`
}

function aplicarColarRateioFis(botao) {
    const caixa = botao.closest('.popup')?.querySelector('[data-colar-rateio]')
    const linhas = interpretarColagemRateioFis(caixa?.querySelector('textarea')?.value)
    const form = formEmissaoAberto()
    const bloco = form?.querySelector('[data-rateio]')
    if (!bloco) return popup({ mensagem: 'O formulário da nota foi fechado.' })
    if (!linhas.length) return popup({ mensagem: 'Cole pelo menos uma linha com o departamento e o valor.' })
    const ruins = linhas.filter(l => l.erro)
    if (ruins.length)
        return popup({ mensagem: `Corrija antes de usar:<ul class="fis-lista-erros">${ruins.map(l => `<li>“${escFis(l.original)}”: ${escFis(l.erro)}</li>`).join('')}</ul>` })
    bloco.querySelector('[data-rateio-linhas]').innerHTML = linhas
        .map(l => linhaRateioFis(l.modo === 'pct'
            ? { departamento: l.id, percentual: l.valor }
            : { departamento: l.id, modo: 'valor', valor: l.valor, percentual: totalRateioFis ? l.valor * 100 / totalRateioFis : '' }))
        .join('')
    removerPopup(caixa.closest('.popup')?.id)
    somarRateioFis(bloco)
    agendarPreviaFis()
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
        <div class="fis-form fis-form-emissao" data-form-nfse data-id="${escFis(inicial.id || '')}" data-fluxo-item="${escFis(inicial.fluxo_item || '')}" oninput="agendarPreviaFis()" onchange="agendarPreviaFis()">
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
                    ${campoFis('Chamado', inputFis('chamado', inicial.chamado))}
                </div>
                ${campoFis('Discriminação do serviço', `<textarea class="fis-input" name="descricao" rows="4">${escFis(d.descricao || '')}</textarea>`)}
                <div class="fis-retencoes" data-retencoes></div>
            </fieldset>
            ${blocoPagamentoFis(4, d.pagamento || inicial.pagamento || {})}
            ${blocoRateioFis(5, rateioInicialFis(inicial))}
            <div class="fis-previa" data-previa></div>
        </div>`
    // Rodada de serviço do Fluxo (js/fluxo_kanban.js): só salva; o cartão vai para Separado e Faturar emite.
    popup({
        titulo: inicial.fluxo_item ? 'Faturar serviço: dados da NFS-e' : inicial.id ? 'Editar NFS-e' : 'Emitir NFS-e',
        linhas: [{ elemento }],
        botoes: inicial.fluxo_item
            ? [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarEmissaoFis(false, this)' }]
            : [
                { texto: 'Salvar rascunho', img: 'salvo', funcao: 'salvarEmissaoFis(false, this)' },
                { texto: 'Emitir', img: 'concluido', funcao: 'salvarEmissaoFis(true, this)' }
            ]
    })
    const form = document.querySelector('[data-form-nfse]')
    totalRateioFis = null
    somarRateioFis(form)
    trocarEmpresaNFSe(form.querySelector('[name="app"]'), inicial.servico_id, d)
    previaPagamentoFis(form.querySelector('[name="pag_forma"]'))
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
    const rateio = lerRateioFis(form.querySelector('[data-rateio]'))
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
            retencoes,
            // Vencimentos vão no texto da NFS-e (a DPS nacional não tem grupo de cobrança) e viram contas a receber.
            pagamento: lerPagamentoFis(form)
        },
        // Departamentos: o servidor grava orcamento = o departamento (um só) ou 'RATEIO' (vários).
        orcamento: rateio.length === 1 ? rateio[0].departamento : rateio.length ? 'RATEIO' : '',
        rateio,
        chamado: v('chamado')
    }
}

// ---------------------------------------------------------------- prévia e salvar

// Rodapé do formulário de NF-e (lado esquerdo): quantos itens e o total da nota. Na hora mostra a soma
// das linhas (produtos − desconto); quando a prévia do servidor volta, troca pelo total com frete,
// ST, IPI etc. ("totalServidor").
function rodapeTotalNFeFis(form, totalServidor) {
    const alvo = form.closest('.popup')?.querySelector('[data-rodape-total-nfe]')
    if (!alvo) return
    let itens = 0, soma = 0
    form.querySelectorAll('[data-itens-nfe] tr').forEach(tr => {
        const v = n => Number(tr.querySelector(`[name="${n}"]`)?.value) || 0
        if (!tr.querySelector('[name="item_id"]')?.value && !tr.querySelector('[name="descricao"]')?.value.trim()) return
        itens++
        soma += v('quantidade') * v('valor_unitario') - v('desconto')
    })
    const total = totalServidor != null && Number.isFinite(Number(totalServidor)) ? Number(totalServidor) : soma
    alvo.innerHTML = `
        <span class="fis-rodape-itens"><b>${itens}</b> ${itens === 1 ? 'item' : 'itens'}</span>
        <span class="fis-rodape-total" title="${totalServidor != null ? 'Total da nota (prévia com impostos e frete)' : 'Soma dos itens; a prévia confirma o total'}">
            <small>Total da nota</small><b>${dinheiro(total)}</b>
        </span>`
}

let temporizadorPreviaFis = null
function agendarPreviaFis() {
    clearTimeout(temporizadorPreviaFis)
    temporizadorPreviaFis = setTimeout(atualizarPreviaFis, 600)
}

function formEmissaoAberto() {
    return document.querySelector('[data-form-nfe], [data-form-nfse], [data-form-devolucao]')
}

function lerEmissaoFis(form) {
    if (form.matches('[data-form-devolucao]')) return lerDevolucaoFis(form)
    return form.matches('[data-form-nfse]') ? lerEmissaoNFSe(form) : lerEmissaoNFe(form)
}

async function atualizarPreviaFis() {
    const form = formEmissaoAberto()
    if (!form) return
    const alvo = form.querySelector('[data-previa]')
    somarRateioFis(form)
    const entrada = lerEmissaoFis(form)
    // Total por linha na hora (a prévia do servidor confirma os impostos).
    form.querySelectorAll('[data-itens-nfe] tr').forEach(tr => {
        const q = Number(tr.querySelector('[name="quantidade"]').value) || 0
        const u = Number(tr.querySelector('[name="valor_unitario"]').value) || 0
        const d = Number(tr.querySelector('[name="desconto"]').value) || 0
        tr.querySelector('[data-total-item]').textContent = q && u ? dinheiroTexto(q * u - d) : ''
    })
    rodapeTotalNFeFis(form)
    // Devolução: total de cada linha (quantidade × valor unitário da origem); sem quantidade, nada a calcular.
    form.querySelectorAll('[data-devolver]').forEach(input => {
        const q = Number(input.value) || 0
        const celula = input.closest('tr')?.querySelector('[data-total-item]')
        if (celula) celula.textContent = q ? dinheiroTexto(q * Number(input.dataset.unitario || 0)) : ''
    })
    if (entrada.devolucao && !entrada.devolucao.itens.length) {
        alvo.innerHTML = '<div class="fis-vazio">Informe a quantidade a devolver de ao menos um item.</div>'
        return
    }
    if (!entrada.app || (entrada.modelo === 'NFE' && !entrada.devolucao && !entrada.itens.length)) {
        alvo.innerHTML = ''
        totalRateioFis = null
        somarRateioFis(form)
        return
    }
    try {
        const r = await apiFiscal('emissao/previa', entrada)
        if (formEmissaoAberto() !== form) return
        const t = r.totais || {}
        // Valor de cada departamento: o que vai virar recebimento (NFS-e: líquido; NF-e: total da nota).
        totalRateioFis = Number(r.modelo === 'NFSE' ? (t.liquido ?? t.servico) : t.nota) || null
        somarRateioFis(form)
        if (r.modelo !== 'NFSE') rodapeTotalNFeFis(form, t.nota)
        const linhas = r.modelo === 'NFSE'
            ? [['Serviço', t.servico], ['ISS', t.iss], ...Object.entries(t.retencoes || {}).filter(([, x]) => x.valor).map(([k, x]) => [`${k.toUpperCase()}${x.reter ? ' (retido)' : ''}`, x.valor]), ['Total retido', t.total_retido], ['Líquido a receber', t.liquido]]
            : [['Produtos', t.produtos], ['Desconto', t.desconto], ['Frete', t.frete], ['Seguro', t.seguro], ['Outras despesas', t.outras], ['ICMS', t.icms], ['ICMS ST', t.st], ['IPI devolvido', t.ipi_devolvido], ['DIFAL', t.difal], ['PIS', t.pis], ['COFINS', t.cofins], ['IBS', t.ibs], ['CBS', t.cbs], ['Total da nota', t.nota]]
        alvo.innerHTML = `
            <div class="fis-totais">${linhas.filter(([, v]) => v).map(([k, v]) => `<div><span>${k}</span><b>${dinheiro(v)}</b></div>`).join('')}</div>
            ${r.erros?.length ? `<div class="fis-erros"><b>Falta corrigir:</b><ul>${r.erros.map(e => `<li>${escFis(e)}</li>`).join('')}</ul></div>` : '<div class="fis-ok">Pronta para emitir.</div>'}
            ${r.avisos?.length ? `<div class="fis-alerta">${r.avisos.map(escFis).join('<br>')}</div>` : ''}
            ${r.itens?.length ? `<small class="fis-dica">CFOP ${[...new Set(r.itens.map(i => i.cfop))].join(', ')}</small>` : ''}`
    } catch (err) {
        alvo.innerHTML = `<div class="fis-erros">${mensagemErroEst(err)}</div>`
    }
}

// Espelho (PDF): DANFE de pré-visualização da Focus com o que está no formulário (mesmo sem salvar),
// com os dados reais e "SEM VALOR FISCAL", para mostrar ao cliente antes de faturar. Abre em outra aba.
async function espelhoEmissaoFis(botao) {
    const form = formEmissaoAberto()
    if (!form) return
    const entrada = lerEmissaoFis(form)
    if (!(entrada.itens?.length || entrada.devolucao?.itens?.length)) return popup({ mensagem: entrada.devolucao ? 'Informe a quantidade a devolver para gerar o espelho.' : 'Inclua pelo menos um item para gerar o espelho.' })
    const aba = window.open('', '_blank') // aberta já no clique: depois do await o navegador bloquearia
    try {
        overlayAguarde()
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const resposta = await fetch(`${api}/fiscal/emissao/espelho`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(entrada)
        })
        removerOverlay()
        if (!resposta.ok) {
            const r = await resposta.json().catch(() => ({}))
            throw Object.assign(new Error(r.mensagem || `Falha ao gerar o espelho (${resposta.status})`), { erros: r.erros })
        }
        const url = URL.createObjectURL(await resposta.blob())
        if (aba) aba.location = url
        else window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000)
    } catch (err) {
        removerOverlay()
        aba?.close()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function salvarEmissaoFis(emitir, botao) {
    const form = formEmissaoAberto()
    if (!form) return
    const entrada = lerEmissaoFis(form)
    const id = form.dataset.id || null
    if (entrada.devolucao && !entrada.devolucao.itens.length)
        return popup({ mensagem: 'Informe a quantidade a devolver de ao menos um item.' })
    // Devolução não tem cobrança (o servidor põe "sem pagamento" e acerta as faturas da nota de origem).
    if (!entrada.devolucao && !(entrada.opcoes?.pagamento || entrada.dados?.pagamento))
        return popup({ mensagem: 'Escolha a forma de pagamento (ou "Sem pagamento" para remessa, comodato, devolução…).' })
    if (entrada.modelo === 'NFE') {
        const o = entrada.opcoes || {}
        const faltas = []
        faltas.push(...errosPagamentoFis(form).map(e => `Pagamento: ${e}`))
        if (form.dataset.fluxoItem && !o.transportador && !o.sem_transporte) faltas.push('Escolha a transportadora (ou "SEM TRANSPORTE").')
        if (form.dataset.fluxoItem && !(Number.isInteger(o.volumes) && o.volumes >= 1)) faltas.push('Informe os volumes (número inteiro, a partir de 1).')
        if (o.transportador && String(o.modalidade_frete) === '9') faltas.push('Com transportadora, escolha por conta de quem é o frete (não pode ser "Sem frete").')
        faltas.push(...errosRateioFis(form))
        if (faltas.length) return popup({ mensagem: `<ul class="fis-lista-erros">${faltas.map(f => `<li>${escFis(f)}</li>`).join('')}</ul>` })
    }
    if (entrada.modelo === 'NFSE') {
        const faltas = errosRateioFis(form)
        if (faltas.length) return popup({ mensagem: `<ul class="fis-lista-erros">${faltas.map(f => `<li>${escFis(f)}</li>`).join('')}</ul>` })
    }
    if (form.dataset.trava === 'previa') return
    try {
        overlayAguarde()
        // Separação pelo acesso log: o servidor monta a nota e só aproveita transportadora e volumes.
        if (form.dataset.trava === 'logistica') {
            const r = await apiModuloFiscal('fluxo-itens/logistica', { id: form.dataset.fluxoItem, fiscal_id: id, entrada })
            form.dataset.id = r.id
            removerOverlay()
            removerPopup(botao?.closest('.popup')?.id)
            return popup({ mensagem: 'Separação salva.', imagem: 'imagens/concluido.png', tempo: 3 })
        }
        const r = await apiFiscal('emissao/rascunho', { id, ...entrada })
        form.dataset.id = r.id
        // Kanban (js/fluxo_kanban.js): o rascunho salvo leva o item para Separado.
        if (form.dataset.fluxoItem)
            await apiModuloFiscal('fluxo-itens/separar', { id: form.dataset.fluxoItem, fiscal_id: r.id, numero_pedido: entrada.opcoes?.numero_pedido })
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

// ================================================================ DEVOLUÇÕES
// Três casos (gcs migrations/fiscal-devolucoes.sql):
// - Devolver ao fornecedor: NF-e de saída a partir da nota recebida (botão na nota ou "Devolução" pela chave).
// - Devolução que o cliente emite: chega nas Recebidas, se liga sozinha à nossa venda e a entrada pergunta
//   "Abater nas faturas a receber da venda?".
// - Cliente sem IE: NF-e de entrada própria a partir da nossa venda (nota do GCS ou do Omie).
// A tela só escolhe a operação e as quantidades; itens, valores, impostos (proporcionais à quantidade),
// destinatário e nota referenciada vêm da nota de origem, montados no servidor. A nota sai sem cobrança:
// autorizada, abate as faturas da nota de origem e o que já foi pago vira crédito (Financeiro).

const LADO_DEVOLUCAO_FIS = {
    COMPRA: { titulo: 'Devolver ao fornecedor', quem: 'Fornecedor', qtd: 'Comprado', explica: 'NF-e de saída para o fornecedor, com o ICMS, a ST e o IPI da compra na proporção do que volta. Autorizada, tira os itens do estoque e abate as faturas a pagar da compra; o que já foi pago vira uma fatura a receber do fornecedor.' },
    VENDA: { titulo: 'Devolução de venda (nota de entrada própria)', quem: 'Cliente', qtd: 'Vendido', explica: 'Para cliente sem Inscrição Estadual (pessoa física, órgão público). Se o cliente tem IE, quem emite a devolução é ele: a nota dele chega em Notas Recebidas e se liga sozinha a esta venda. Autorizada, devolve os itens ao estoque e abate as faturas a receber da venda; o que já foi recebido vira uma fatura a pagar ao cliente.' }
}

function origemDaDevolucaoFis(documento) {
    const dev = documento.payload?.entrada?.devolucao || {}
    return { id: dev.origem_id || null, chave: dev.chave || documento.devolucao_chave || null, lado: documento.devolucao_tipo === 'FORNECEDOR' ? 'COMPRA' : 'VENDA' }
}

async function devolucaoPorChaveFis() {
    const chave = await pedirTextoPopup({
        titulo: 'Devolução',
        mensagem: 'Chave de acesso da NF-e que está voltando (44 dígitos).<br><small>Compra: a nota que o fornecedor emitiu para nós. Venda: a nota que emitimos (pelo GCS ou pelo Omie).</small>',
        textoConfirmar: 'Continuar', minimo: 44, maximo: 60
    })
    if (chave === null) return
    if (soDigFis(chave).length !== 44) return popup({ mensagem: 'A chave tem 44 dígitos.' })
    abrirDevolucaoFis({ chave: soDigFis(chave) })
}

// { id } (nota do GCS ou venda do Omie) ou { chave }; inicial = rascunho a editar ou devolução a duplicar.
async function abrirDevolucaoFis({ id = null, chave = null, lado = null, inicial = null } = {}) {
    let origem
    try {
        overlayAguarde()
        const [r] = await Promise.all([apiFiscal('devolucao/origem', { id, chave, lado }), carregarOpcoesEmissao()])
        origem = r
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ titulo: 'Devolução', mensagem: mensagemErroEst(err) })
    }
    // Fecha a nota de onde a devolução foi aberta (ela reabre atualizada depois).
    document.querySelectorAll('[data-doc-fiscal]').forEach(el => {
        const p = el.closest('.popup')?.id
        if (p && [origem.origem.documento_id, inicial?.id].includes(el.dataset.docFiscal)) removerPopup(p)
    })
    formularioDevolucaoFis(origem, inicial || {})
}

function formularioDevolucaoFis({ origem, participante: part = {}, itens, operacoes, operacao_sugerida, devolucoes = [] }, inicial = {}) {
    const lado = LADO_DEVOLUCAO_FIS[origem.lado]
    const escolhidos = new Map((inicial.devolucao?.itens || []).map(i => [Number(i.n_item), Number(i.quantidade) || 0]))
    const o = inicial.opcoes || {}
    // Editando o próprio rascunho: o que ele já reservou volta a ficar disponível.
    const maximo = i => Math.max(0, Number(i.disponivel) + (inicial.id ? (escolhidos.get(i.n_item) || 0) : 0))
    const linhas = itens.map(i => {
        const max = maximo(i)
        const valor = escolhidos.has(i.n_item) ? escolhidos.get(i.n_item) : ''
        return `
            <tr>
                <td class="fis-num">${i.n_item}</td>
                <td class="fis-descricao">${escFis(i.descricao)}<small>${i.codigo ? `Cód. ${escFis(i.codigo)} · ` : ''}NCM ${escFis(i.ncm || '—')} · CFOP ${escFis(i.cfop || '—')}</small></td>
                <td class="fis-num">${qtdEst(i.quantidade)} ${escFis(i.unidade || '')}</td>
                <td class="fis-num">${Number(i.devolvida) ? qtdEst(i.devolvida) : ''}</td>
                <td class="fis-num">${dinheiro(i.valor_unitario || 0)}</td>
                <td><input class="fis-input fis-qtd-devolver" type="number" min="0" max="${max}" step="any" inputmode="decimal"
                        data-devolver="${i.n_item}" data-unitario="${Number(i.valor_unitario) || 0}" data-maximo="${max}"
                        value="${escFis(valor)}" ${max > 0 ? '' : 'disabled title="Já devolvido por inteiro"'} placeholder="0"></td>
                <td class="fis-num" data-total-item></td>
                <td>${i.item_id
                    ? `<small>${escFis(i.item_codigo || '')} ${escFis(i.item_descricao || '')}${Number(i.fator) !== 1 ? ` · × ${qtdEst(i.fator)} no estoque` : ''}</small>`
                    : '<small class="fis-pendente">não mexe no estoque</small>'}</td>
            </tr>`
    }).join('')
    const transportadoras = opcoesEmissaoFiscal?.transportadoras || []
    const elemento = `
        <div class="fis-form fis-form-emissao" data-form-devolucao data-id="${escFis(inicial.id || '')}" data-app="${escFis(origem.app)}"
             data-origem-id="${escFis(origem.documento_id || origem.omie_id || '')}" data-chave="${escFis(origem.chave)}"
             data-participante="${escFis(part.documento || '')}" oninput="agendarPreviaFis()" onchange="agendarPreviaFis()">
            <div class="fis-aviso">${escFis(lado.explica)}</div>
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">1</span> Nota de origem</legend>
                <div class="fis-resumo">
                    <div><span>NF-e</span><b>${escFis(origem.numero || '—')}${origem.serie ? ` <small>série ${escFis(origem.serie)}</small>` : ''}${origem.fonte === 'OMIE' ? ` ${etiquetaEst('Omie', '#7c3aed')}` : ''}</b></div>
                    <div><span>Emissão</span><b>${dataFis(origem.emissao)}</b></div>
                    <div><span>Empresa</span><b>${escFis(origem.app)}</b></div>
                    <div><span>${lado.quem}</span><b>${escFis(part.nome || '')} <small>${docFormatadoFis(part.documento)}${part.uf ? ` · ${escFis(part.uf)}` : ''}</small></b></div>
                    <div><span>Total da nota</span><b>${origem.valor_total != null ? dinheiro(origem.valor_total) : '—'}</b></div>
                </div>
                <div class="fis-chave">Chave <code>${escFis(origem.chave)}</code></div>
                ${devolucoes.filter(d => d.id !== inicial.id).length ? `<div class="fis-alerta">Esta nota já tem devolução: ${devolucoes.filter(d => d.id !== inicial.id).map(d =>
                    `<span class="fis-link" onclick="abrirDocumentoFiscal('${escFis(d.id)}')">${escFis(DEVOLUCAO_FISCAL[d.devolucao_tipo]?.texto || 'Devolução')} ${escFis(d.numero || '(rascunho)')} · ${escFis(STATUS_FISCAL[d.status]?.texto || d.status)} · ${dinheiro(d.valor_total || 0)}</span>`).join('; ')}. A coluna "Já devolvido" desconta o que ela levou.</div>` : ''}
            </fieldset>
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">2</span> Operação</legend>
                <div class="fis-grade">
                    ${campoFis('Operação', `<select class="fis-input" name="operacao_id">${opcoesFis(operacoes.map(x => [x.id, `${x.descricao} (${x.cfop_interno}/${x.cfop_interestadual})`]), inicial.operacao_id || operacao_sugerida)}</select>`, 'fis-largo')}
                </div>
                ${operacoes.length ? '' : '<div class="fis-erros">Nenhuma operação de devolução cadastrada para esta empresa (Configuração fiscal → Operações).</div>'}
            </fieldset>
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">3</span> Itens a devolver <small>— valores e impostos saem da nota de origem, proporcionais à quantidade</small></legend>
                <div class="fis-acoes-claras">
                    <button type="button" class="fis-mini" onclick="devolverTudoFis(this, true)">Devolver tudo</button>
                    <button type="button" class="fis-mini" onclick="devolverTudoFis(this, false)">Zerar</button>
                </div>
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela">
                        <thead><tr><th>#</th><th>Item na nota</th><th class="fis-num">${lado.qtd}</th><th class="fis-num">Já devolvido</th><th class="fis-num">Unit.</th><th>Devolver</th><th class="fis-num">Total</th><th>Estoque</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            </fieldset>
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">4</span> Transporte</legend>
                <div class="fis-grade">
                    ${campoFis('Frete por conta de', `<select class="fis-input" name="modalidade_frete">${opcoesFis([['9', 'Sem frete'], ['0', 'Emitente (CIF)'], ['1', 'Destinatário (FOB)'], ['2', 'Terceiros']], String(o.modalidade_frete ?? '9'))}</select>`)}
                    ${campoFis('Transportadora', `<select class="fis-input" name="transportadora" onchange="trocarTransportadoraNFe(this)">
                        <option value="">Sem transportadora</option>
                        ${transportadoras.map(t => `<option value="${escFis(t.id)}" ${String(o.transportador?.id || '') === String(t.id) ? 'selected' : ''}>${escFis(t.razao_social || t.nome)}${t.cnpj ? ` · ${escFis(docFormatadoFis(t.cnpj))}` : ''}</option>`).join('')}
                    </select>`, 'fis-largo')}
                    ${campoFis('Volumes', inputFis('volumes', o.volumes || '', 'type="number" min="1" step="1" inputmode="numeric"'))}
                </div>
            </fieldset>
            <fieldset class="fis-passo">
                <legend><span class="fis-num-passo">5</span> Complementos</legend>
                ${campoFis('Informações complementares <small>(o texto "Devolução referente à NF-e…" com a chave entra sozinho)</small>', `<textarea class="fis-input" name="informacoes_complementares" rows="2">${escFis(o.informacoes_complementares || '')}</textarea>`)}
            </fieldset>
            <div class="fis-previa" data-previa></div>
        </div>`
    popup({
        titulo: inicial.id ? `Editar devolução` : lado.titulo,
        linhas: [{ elemento }],
        botoes: [
            { texto: 'Espelho', img: 'pdf', funcao: 'espelhoEmissaoFis(this)' },
            { texto: 'Salvar rascunho', img: 'salvo', funcao: 'salvarEmissaoFis(false, this)' },
            { texto: 'Emitir', img: 'concluido', funcao: 'salvarEmissaoFis(true, this)' }
        ]
    })
    agendarPreviaFis()
}

function devolverTudoFis(botao, tudo) {
    const form = botao.closest('[data-form-devolucao]')
    form.querySelectorAll('[data-devolver]:not(:disabled)').forEach(input => { input.value = tudo ? input.dataset.maximo : '' })
    agendarPreviaFis()
}

function lerDevolucaoFis(form) {
    const v = n => form.querySelector(`[name="${n}"]`)?.value?.trim() ?? ''
    const transportadora = (opcoesEmissaoFiscal?.transportadoras || []).find(t => String(t.id) === v('transportadora'))
    return {
        modelo: 'NFE',
        app: form.dataset.app,
        operacao_id: v('operacao_id'),
        destinatario: { documento: form.dataset.participante },
        devolucao: {
            origem_id: form.dataset.origemId || undefined,
            chave: form.dataset.chave,
            rascunho_id: form.dataset.id || undefined,
            itens: [...form.querySelectorAll('[data-devolver]')]
                .map(i => ({ n_item: Number(i.dataset.devolver), quantidade: Number(i.value) || 0 }))
                .filter(i => i.quantidade > 0)
        },
        opcoes: {
            modalidade_frete: v('modalidade_frete'),
            informacoes_complementares: v('informacoes_complementares'),
            transportador: transportadora ? {
                id: transportadora.id, nome: transportadora.razao_social || transportadora.nome, documento: soDigFis(transportadora.cnpj),
                inscricao_estadual: transportadora.inscricao_estadual || '', endereco: transportadora.endereco || '',
                municipio: String(transportadora.cidade || '').replace(/\s*\([A-Z]{2}\)\s*$/, ''), uf: transportadora.estado || ''
            } : undefined,
            volumes: Number(v('volumes')) || undefined
        }
    }
}

// Faixa da nota: sendo devolução, de qual nota e o que fez no Financeiro; tendo devoluções, a lista delas.
function blocoDevolucaoFis(d, devolucoes = [], origem = null) {
    const partes = []
    if (d.devolucao_tipo) {
        const fin = d.devolucao_financeiro
        const abatido = (fin?.abatidas || []).reduce((a, x) => a + Number(x.abatido || 0), 0)
        const resumoFin = !fin ? ''
            : fin.aviso ? `<br><small>${escFis(fin.aviso)}</small>`
            : `<br><small>Financeiro: ${abatido ? `${dinheiro(abatido)} abatido(s) em ${fin.abatidas.length} fatura(s) da nota de origem` : ''}${abatido && fin.credito?.length ? ' · ' : ''}${fin.credito?.length ? `fatura de crédito de ${dinheiro(Number(fin.valor) - abatido)}` : ''}</small>`
        partes.push(`<div class="fis-info">${escFis(DEVOLUCAO_FISCAL[d.devolucao_tipo]?.explica || 'Devolução')}:
            ${origem ? `<span class="fis-link" onclick="abrirDocumentoFiscal('${escFis(origem.id)}')">NF-e ${escFis(origem.numero || '')}${origem.participante_nome ? ` · ${escFis(origem.participante_nome)}` : ''}</span>`
                : `NF-e de chave <code>${escFis(d.devolucao_chave || '')}</code>${d.devolucao_tipo === 'FORNECEDOR' ? '' : ' (venda do Omie)'}`}${resumoFin}</div>`)
    }
    if (devolucoes.length)
        partes.push(`
            <div class="fis-secao">
                <div class="fis-secao-topo"><b>Devoluções desta nota</b> <span class="fis-contador">${devolucoes.length}</span></div>
                <table class="fis-tabela"><tbody>${devolucoes.map(x => `
                    <tr>
                        <td>${etiquetaFis(DEVOLUCAO_FISCAL, x.devolucao_tipo)}</td>
                        <td><b>${escFis(x.numero || '(rascunho)')}</b></td>
                        <td>${etiquetaFis(STATUS_FISCAL, x.status)}</td>
                        <td class="fis-num">${dinheiro(x.valor_total || 0)}</td>
                        <td><button type="button" class="fis-mini" onclick="abrirDocumentoFiscal('${escFis(x.id)}')">Abrir</button></td>
                    </tr>`).join('')}</tbody></table>
            </div>`)
    return partes.join('')
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
    const abas = { empresas: 'Empresas', operacoes: 'Operações (NF-e)', servicos: 'Serviços (NFS-e)', backup: 'Backup de XMLs' }
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>Configuração fiscal</h2></div>
            <div class="fis-painel">
                <nav class="relatorio-dep-abas" role="tablist">${Object.entries(abas).map(([k, t]) => `
                    <button type="button" class="${k === aba ? 'ativa' : ''}" onclick="telaConfigFiscal('${k}')">${t}</button>`).join('')}</nav>
                <div class="fis-explica">${{
                    empresas: 'Dados das empresas emitentes (vieram do cadastro do Omie). <b>Ambiente</b>: homologação emite notas de teste, sem valor fiscal; só adm/diretoria passam para produção. O token da Focus NFe fica no servidor (SCRIPTS/config.js).',
                    operacoes: 'Perfis de operação copiados das notas emitidas pelo Omie (CFOP, CST e alíquotas). Na emissão, o GCS escolhe o CFOP interno ou interestadual pela UF do destinatário e calcula ICMS, PIS/COFINS (base sem ICMS) e IBS/CBS. <b>Confira com a contabilidade antes de ir para produção.</b>',
                    servicos: 'Serviços das NFS-e (copiados das notas do Omie de mai–nov/2026): item da LC 116, código de tributação nacional, NBS, alíquota de ISS e retenções federais padrão.',
                    backup: 'XMLs guardados no GCS: as notas emitidas e recebidas pelo GCS e, como backup, as NF-e emitidas pelo Omie (o servidor baixa uma a uma pelo Omie; as novas entram sozinhas). As NFS-e do Omie ficam de fora: o Omie não entrega o XML delas.'
                }[aba]}</div>
                <div data-config-fiscal>${{ empresas: htmlConfigEmpresas, operacoes: htmlConfigOperacoes, servicos: htmlConfigServicos, backup: () => '<div class="fis-vazio">Carregando…</div>' }[aba](estadoConfigFis.dados)}</div>
            </div>
        </div>`
    if (aba === 'backup') carregarBackupXmlsFis()
}

// ---------------------------------------------------------------- backup de XMLs

async function carregarBackupXmlsFis() {
    const alvo = document.querySelector('[data-config-fiscal]')
    if (!alvo) return
    try {
        const r = await apiFiscal('backup/xmls')
        const empresas = (estadoConfigFis.dados?.empresas || []).map(e => e.app)
        const hoje = new Date()
        const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
        const inicioMes = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
        alvo.innerHTML = `
            <div class="fis-secao">
                <div class="fis-secao-topo"><b>NF-e emitidas pelo Omie</b> ${r.rodando ? '<small class="fis-secao-info">baixando agora…</small>' : ''}</div>
                <table class="fis-tabela fis-backup-tabela">
                    <thead><tr><th>Empresa</th><th class="fis-num">Notas</th><th class="fis-num">XMLs no GCS</th><th class="fis-num">Faltam</th><th class="fis-num">Com erro</th></tr></thead>
                    <tbody>${r.omie.map(x => `
                        <tr><td>${escFis(x.app)}</td><td class="fis-num">${x.notas}</td><td class="fis-num"><b>${x.guardados}</b></td>
                            <td class="fis-num">${Number(x.notas) - Number(x.guardados) || ''}</td><td class="fis-num">${Number(x.com_erro) || ''}</td></tr>`).join('')}</tbody>
                </table>
                <small class="fis-dica">Do GCS: ${r.gcs?.emitidas || 0} emitida(s) e ${r.gcs?.recebidas || 0} recebida(s) com XML.</small>
            </div>
            <div class="fis-secao" data-exportar-xmls>
                <div class="fis-secao-topo"><b>Baixar XMLs</b> <small class="fis-secao-info">um ZIP por empresa / emitidas ou recebidas / mês</small></div>
                <div class="fis-grade">
                    ${campoFis('De', inputFis('de', inicioMes, 'type="date"'))}
                    ${campoFis('Até', inputFis('ate', iso(hoje), 'type="date"'))}
                    ${campoFis('Empresa', `<select class="fis-input" name="app"><option value="">Todas</option>${empresas.map(a => `<option value="${escFis(a)}">${escFis(a)}</option>`).join('')}</select>`)}
                    ${campoFis('Notas', `<select class="fis-input" name="tipo">${opcoesFis([['todas', 'Emitidas e recebidas'], ['emitidas', 'Só emitidas'], ['recebidas', 'Só recebidas']], 'todas')}</select>`)}
                </div>
                <div class="fis-acoes-claras"><button type="button" class="fis-botao" onclick="exportarXmlsFis(this)">Baixar ZIP</button></div>
            </div>`
    } catch (err) {
        alvo.innerHTML = `<div class="fis-erros">${mensagemErroEst(err)}</div>`
    }
}

async function exportarXmlsFis(botao) {
    const caixa = botao.closest('[data-exportar-xmls]')
    const v = n => caixa.querySelector(`[name="${n}"]`)?.value || ''
    if (!v('de') || !v('ate')) return popup({ mensagem: 'Informe o período.' })
    try {
        overlayAguarde()
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const r = await fetch(`${api}/fiscal/backup/exportar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ de: v('de'), ate: v('ate'), app: v('app') || null, tipo: v('tipo') })
        })
        if (!r.ok) {
            const j = await r.json().catch(() => ({}))
            throw new Error(j.mensagem || `Falha ao gerar o ZIP (${r.status})`)
        }
        const blob = await r.blob()
        removerOverlay()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = (r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/) || [])[1] || 'xmls.zip'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: escFis(err.message) })
    }
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
