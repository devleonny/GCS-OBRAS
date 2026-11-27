// Orçamentos → Pedidos e Orçamentos → Requisições (27/11/2026, a pedido): duas tabelas no layout financeiro para
// acompanhar separadamente os pedidos (OCs) e as requisições de todos os orçamentos. Mesmo modelo do Controle de
// Faturamento: caixinhas (página e todas do filtro), bandeja com totais, Σ no pé, paginação no rodapé e Excel.
// Só leitura: vw_orc_pedidos e vw_orc_requisicoes (gcs migrations/orcamentos-pedidos-requisicoes.sql); o clique na
// linha mostra onde mexer (histórico do orçamento, pedido, chamado).

const CORES_ACOMP_ORC = {
    'A FATURAR': '#2563eb', 'FATURADO PARCIAL': '#7a9e2e', FATURADO: '#2e9e4f', BAIXADO: '#64748b',
    'ACIMA DA OC': '#d32f2f', PENDENTE: '#b7791f', 'EXCLUÍDO': '#64748b',
    'EM ABERTO': '#2563eb', SEPARADA: '#7a9e2e', FATURADA: '#2e9e4f', ENTREGUE: '#1f9e89', 'CONCLUÍDA': '#2e7d4f', 'EXCLUÍDA': '#64748b'
}
const ICONES_ACOMP_ORC = {
    FATURADO: 'check', FATURADA: 'check', 'CONCLUÍDA': 'check', ENTREGUE: 'check', 'ACIMA DA OC': 'alerta',
    PENDENTE: 'alerta', 'EXCLUÍDO': 'cancelar', 'EXCLUÍDA': 'cancelar'
}

const situacaoAcompOrc = s => `<span class="fin-sit" style="--cor: ${CORES_ACOMP_ORC[s] || '#64748b'}">${iconeFin(ICONES_ACOMP_ORC[s] || 'relogio')}${escFin(s || '')}</span>`
const cortaAcompOrc = (texto, classe = '') => `<td class="ctf-corta ${classe}" title="${escFin(texto ?? '')}"><span>${escFin(texto ?? '')}</span></td>`
const numAcompOrc = v => Number(v) ? dinheiro(v) : '—'

// ------------------------------------------------------------ as duas tabelas
const TABELAS_ACOMP_ORC = {
    pedidos: {
        titulo: 'Pedidos', base: 'vw_orc_pedidos', pag: 'pedidosOrc', prefKey: 'orcamentos_pedidos',
        um: 'pedido', varios: 'pedidos', ordenar: [{ path: 'dia', direcao: 'desc' }],
        colunas: {
            '': {},
            'Situação': { chave: 'situacao', tipoPesquisa: 'select', opcoes: ['A FATURAR', 'FATURADO PARCIAL', 'FATURADO', 'ACIMA DA OC', 'PENDENTE', 'BAIXADO', 'EXCLUÍDO'] },
            'Orçamento': { chave: 'orcamento' },
            'Cliente': { chave: 'cliente', principal: true },
            'Cidade': { chave: 'cidade' },
            'Pedido (OC)': { chave: 'numero' },
            'Aprovação': { chave: 'aprovacao', tipoPesquisa: 'select', opcoes: ['COM NÚMERO', 'POR E-MAIL', 'PENDENTE'] },
            'Data': { chave: 'dia', tipoPesquisa: 'data' },
            'Valor': { chave: 'valor', tipoOrdenacao: 'numero' },
            'Faturado': { chave: 'faturado', tipoOrdenacao: 'numero' },
            'Saldo': { chave: 'saldo', tipoOrdenacao: 'numero' },
            'Etapa': { chave: 'etapa', tipoPesquisa: 'select', opcoes: ['Pedido', 'Requisição', 'Separado', 'Faturado', 'Entregue', 'Concluído'] },
            'Rodadas': { chave: 'rodadas', tipoOrdenacao: 'numero' },
            'Requisições': { chave: 'requisicoes', tipoOrdenacao: 'numero' },
            'Notas': { chave: 'numeros_notas' },
            'Empresa': { chave: 'empresa', tipoPesquisa: 'select', opcoes: ['AC', 'IAC', 'HNK', 'HNW'] },
            'Responsável': { chave: 'responsavel' },
            'Setor': { chave: 'setor', tipoPesquisa: 'select', opcoes: [...SETORES_PADRAO_RH, 'SEM SETOR'] },
            'Lançado por': { chave: 'executor' },
            'OC anexada': { chave: 'com_anexo', tipoPesquisa: 'select', opcoes: ['S', 'N'], rotulos: { S: 'Sim', N: 'Não' } },
            'Status do orçamento': { chave: 'status_atual' },
            'Comentário': { chave: 'comentario' }
        },
        linha: d => `
            <td class="ctf-corta" title="${escFin(d.situacao)}">${situacaoAcompOrc(d.situacao)}</td>
            ${cortaAcompOrc(d.orcamento)}
            ${cortaAcompOrc(d.cliente, 'ctf-largo')}
            ${cortaAcompOrc(d.cidade)}
            ${cortaAcompOrc(d.numero)}
            ${cortaAcompOrc(d.aprovacao)}
            <td class="fin-centro">${dataFin(d.dia)}</td>
            <td class="fis-num">${dinheiro(d.valor)}</td>
            <td class="fis-num">${numAcompOrc(d.faturado)}</td>
            <td class="fis-num"${Number(d.saldo) < 0 ? ' style="color: #c62828"' : ''}>${numAcompOrc(d.saldo)}</td>
            ${cortaAcompOrc(d.etapa)}
            <td class="fin-centro">${Number(d.rodadas) || ''}</td>
            <td class="fin-centro">${Number(d.requisicoes) || ''}</td>
            ${cortaAcompOrc(d.numeros_notas)}
            <td class="fin-centro">${escFin(d.empresa || '')}</td>
            ${cortaAcompOrc(d.responsavel)}
            ${cortaAcompOrc(d.setor)}
            ${cortaAcompOrc(d.executor)}
            <td class="fin-centro">${d.com_anexo === 'S' ? 'Sim' : 'Não'}</td>
            ${cortaAcompOrc(d.status_atual)}
            ${cortaAcompOrc(d.comentario, 'ctf-largo')}`,
        totaisRodape: ['valor', 'faturado', 'saldo'],
        // Bandeja: o que se acompanha (sem os excluídos).
        totais: async somar => {
            const vivos = { situacao: { op: '!=', value: 'EXCLUÍDO' } }
            const abertos = { situacao: { modo: 'OR', regras: [{ op: '=', value: 'A FATURAR' }, { op: '=', value: 'FATURADO PARCIAL' }] } }
            const [valor, faturado, saldo, pendentes, acima] = await Promise.all([
                somar('valor', vivos), somar('faturado', vivos), somar('saldo', abertos),
                somar('valor', { situacao: { op: '=', value: 'PENDENTE' } }), somar('saldo', { situacao: { op: '=', value: 'ACIMA DA OC' } })
            ])
            return [
                { rotulo: 'Valor dos pedidos', valor, detalhe: 'Sem os excluídos' },
                { rotulo: 'Faturado', valor: faturado, classe: 'cf-ok' },
                { rotulo: 'Saldo a faturar', valor: saldo, classe: 'cf-falta', detalhe: 'A faturar e faturado parcial' },
                { rotulo: 'Pendentes (sem OC)', valor: pendentes, contar: true },
                { rotulo: 'Notas acima da OC', valor: acima, contar: true, absoluto: true }
            ]
        },
        excel: [
            ['Situação', 16, 'situacao'], ['Orçamento', 12, 'orcamento'], ['Cliente', 34, 'cliente', { quebra: true }], ['Cidade', 18, 'cidade'],
            ['Pedido (OC)', 16, 'numero'], ['Aprovação', 12, 'aprovacao'], ['Data', 12, 'dia', { tipo: 'data' }],
            ['Valor', 15, 'valor', { tipo: 'moeda' }], ['Faturado', 15, 'faturado', { tipo: 'moeda' }], ['Saldo', 15, 'saldo', { tipo: 'moeda' }],
            ['Etapa', 12, 'etapa'], ['Rodadas', 9, 'rodadas', { centro: true }], ['Requisições', 11, 'requisicoes', { centro: true }],
            ['Notas', 18, 'numeros_notas'], ['Empresa', 9, 'empresa', { centro: true }], ['Responsável', 16, 'responsavel'], ['Setor', 18, 'setor'],
            ['Lançado por', 14, 'executor'], ['OC anexada', 10, 'com_anexo', { centro: true }], ['Status do orçamento', 22, 'status_atual'],
            ['Comentário', 30, 'comentario', { quebra: true }]
        ]
    },
    requisicoes: {
        titulo: 'Requisições', base: 'vw_orc_requisicoes', pag: 'requisicoesOrc', prefKey: 'orcamentos_requisicoes',
        um: 'requisição', varios: 'requisições', ordenar: [{ path: 'dia', direcao: 'desc' }],
        colunas: {
            '': {},
            'Situação': { chave: 'situacao', tipoPesquisa: 'select', opcoes: ['EM ABERTO', 'SEPARADA', 'FATURADA', 'ENTREGUE', 'CONCLUÍDA', 'EXCLUÍDA'] },
            'Orçamento': { chave: 'orcamento' },
            'Cliente': { chave: 'cliente', principal: true },
            'Cidade': { chave: 'cidade' },
            'Tipo': { chave: 'tipo', tipoPesquisa: 'select', opcoes: ['VENDA', 'SERVIÇO'] },
            'Pedido (OC)': { chave: 'pedido_numero' },
            'Data': { chave: 'dia', tipoPesquisa: 'data' },
            'Valor': { chave: 'valor', tipoOrdenacao: 'numero' },
            'Itens': { chave: 'itens', tipoOrdenacao: 'numero' },
            'Notas': { chave: 'numeros_notas' },
            'Empresa': { chave: 'empresa', tipoPesquisa: 'select', opcoes: ['AC', 'IAC', 'HNK', 'HNW'] },
            'Responsável': { chave: 'responsavel' },
            'Setor': { chave: 'setor', tipoPesquisa: 'select', opcoes: [...SETORES_PADRAO_RH, 'SEM SETOR'] },
            'Requisitado por': { chave: 'executor' },
            'Transportadora': { chave: 'transportadora' },
            'Volumes': { chave: 'volumes', tipoOrdenacao: 'numero' },
            'Prazo': { chave: 'prazo' },
            'Avulsa': { chave: 'avulsa', tipoPesquisa: 'select', opcoes: ['S', 'N'], rotulos: { S: 'Sim', N: 'Não' } },
            'Status do orçamento': { chave: 'status_atual' },
            'Comentário': { chave: 'comentario' }
        },
        linha: d => `
            <td class="ctf-corta" title="${escFin(d.situacao)}">${situacaoAcompOrc(d.situacao)}</td>
            ${cortaAcompOrc(d.orcamento)}
            ${cortaAcompOrc(d.cliente, 'ctf-largo')}
            ${cortaAcompOrc(d.cidade)}
            ${cortaAcompOrc(d.tipo)}
            ${cortaAcompOrc(d.pedido_numero)}
            <td class="fin-centro">${dataFin(d.dia)}</td>
            <td class="fis-num">${numAcompOrc(d.valor)}</td>
            <td class="fin-centro">${Number(d.itens) || ''}</td>
            ${cortaAcompOrc(d.numeros_notas)}
            <td class="fin-centro">${escFin(d.empresa || '')}</td>
            ${cortaAcompOrc(d.responsavel)}
            ${cortaAcompOrc(d.setor)}
            ${cortaAcompOrc(d.executor)}
            ${cortaAcompOrc(d.transportadora)}
            <td class="fin-centro">${Number(d.volumes) || ''}</td>
            ${cortaAcompOrc(d.prazo ? dataFin(d.prazo) || d.prazo : '')}
            <td class="fin-centro">${d.avulsa === 'S' ? 'Sim' : ''}</td>
            ${cortaAcompOrc(d.status_atual)}
            ${cortaAcompOrc(d.comentario, 'ctf-largo')}`,
        totaisRodape: ['valor'],
        totais: async somar => {
            const sit = s => ({ situacao: { op: '=', value: s } })
            const [valor, aberto, separada, faturada, concluida] = await Promise.all([
                somar('valor', { situacao: { op: '!=', value: 'EXCLUÍDA' } }), somar('valor', sit('EM ABERTO')), somar('valor', sit('SEPARADA')),
                somar('valor', { situacao: { modo: 'OR', regras: [{ op: '=', value: 'FATURADA' }, { op: '=', value: 'ENTREGUE' }] } }), somar('valor', sit('CONCLUÍDA'))
            ])
            return [
                { rotulo: 'Valor das requisições', valor, detalhe: 'Sem as excluídas' },
                { rotulo: 'Em aberto', valor: aberto, classe: 'cf-falta', contar: true },
                { rotulo: 'Separadas', valor: separada, contar: true },
                { rotulo: 'Faturadas / entregues', valor: faturada, classe: 'cf-ok', contar: true },
                { rotulo: 'Concluídas', valor: concluida, classe: 'cf-ok', contar: true }
            ]
        },
        excel: [
            ['Situação', 14, 'situacao'], ['Orçamento', 12, 'orcamento'], ['Cliente', 34, 'cliente', { quebra: true }], ['Cidade', 18, 'cidade'],
            ['Tipo', 10, 'tipo'], ['Pedido (OC)', 16, 'pedido_numero'], ['Data', 12, 'dia', { tipo: 'data' }], ['Valor', 15, 'valor', { tipo: 'moeda' }],
            ['Itens', 8, 'itens', { centro: true }], ['Notas', 18, 'numeros_notas'], ['Empresa', 9, 'empresa', { centro: true }],
            ['Responsável', 16, 'responsavel'], ['Setor', 18, 'setor'], ['Requisitado por', 14, 'executor'], ['Transportadora', 18, 'transportadora'],
            ['Volumes', 9, 'volumes', { centro: true }], ['Prazo', 12, 'prazo'], ['Avulsa', 8, 'avulsa', { centro: true }],
            ['Status do orçamento', 22, 'status_atual'], ['Comentário', 30, 'comentario', { quebra: true }]
        ]
    }
}

// Estado de cada tabela: ano da data (filtro fixo), bandeja aberta, linhas vistas, marcadas e totais.
const estadoAcompOrc = {}
const estAcompOrc = tipo => (estadoAcompOrc[tipo] ??= { ano: 'todos', painel: true, dados: new Map(), selecao: new Map(), totais: null, somas: null, assinatura: null })

const filtrosFixosAcompOrc = tipo => estAcompOrc(tipo).ano === 'todos' ? null : { dia: { op: 'includes', value: `${estAcompOrc(tipo).ano}-` } }

function telaPedidosOrc() { recolherMenuPrincipalFin(); estAcompOrc('pedidos').selecao.clear(); return telaAcompOrc('pedidos') }
function telaRequisicoesOrc() { recolherMenuPrincipalFin(); estAcompOrc('requisicoes').selecao.clear(); return telaAcompOrc('requisicoes') }

// modTab chama as funções pelo nome: uma de cada por tabela.
function criarLinhaPedidosOrc(d) { return linhaAcompOrc('pedidos', d) }
function criarLinhaRequisicoesOrc(d) { return linhaAcompOrc('requisicoes', d) }
function aposCarregarPedidosOrc() { return aposCarregarAcompOrc('pedidos') }
function aposCarregarRequisicoesOrc() { return aposCarregarAcompOrc('requisicoes') }

const nomeFnAcompOrc = tipo => tipo === 'pedidos' ? 'PedidosOrc' : 'RequisicoesOrc'
const bodyAcompOrc = tipo => `body${nomeFnAcompOrc(tipo)}`

async function telaAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo], est = estAcompOrc(tipo)
    est.dados.clear()
    est.assinatura = null
    tela.innerHTML = `
        <div class="fis-pagina fin-tela fin-uma-linha ctf-tela" data-acomp-orc="${tipo}">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>${cfg.titulo}</h2>
                    <div class="fin-barra">
                        <button type="button" onclick="baixarExcelAcompOrc('${tipo}')" title="Com linhas marcadas, baixa só as marcadas; sem marcação, todas as dos filtros aplicados">${iconeFin('excel')} Excel</button>
                    </div>
                </header>
                <div class="fin-corpo${est.painel ? '' : ' recolhido'}" data-corpo-aco>
                    <div class="fin-tabela-area ctf-area" data-tabela-aco></div>
                    <div class="fin-lateral">
                        <button type="button" class="fin-recolher" onclick="alternarPainelAcompOrc('${tipo}')" aria-expanded="${est.painel}"
                            title="${est.painel ? 'Recolher' : 'Mostrar'} os totais">${iconeFin('seta')}</button>
                        <aside class="fin-painel cf-painel" data-totais-aco>${painelAcompOrc(tipo)}</aside>
                    </div>
                </div>
            </section>
        </div>`
    overlayAguarde()
    try {
        delete controles[cfg.pag]
        const area = document.querySelector('[data-tabela-aco]')
        area.innerHTML = await modTab({
            base: cfg.base,
            pag: cfg.pag,
            body: bodyAcompOrc(tipo),
            criarLinha: `criarLinha${nomeFnAcompOrc(tipo)}`,
            caber: true,
            limite: 50,
            funcaoAdicional: [`aposCarregar${nomeFnAcompOrc(tipo)}`],
            filtrosFixos: filtrosFixosAcompOrc(tipo),
            ordenar: cfg.ordenar,
            colunas: cfg.colunas
        })
        area.querySelector('.modtab')?.insertAdjacentHTML('beforeend', '<div class="fin-rodape" data-rodape-aco></div>')
        area.querySelector('.modtab')?.insertAdjacentHTML('afterbegin', '<div class="fin-aviso-selecao" data-aviso-selecao-aco hidden></div>')
        await paginacao(cfg.pag)
        removerOverlay()
    } catch (err) {
        removerOverlay()
        console.error(err)
        popup({ mensagem: `Falha ao abrir ${cfg.titulo}: ${escFin(err.message)}` })
    }
}

function linhaAcompOrc(tipo, d) {
    const est = estAcompOrc(tipo), cfg = TABELAS_ACOMP_ORC[tipo]
    est.dados.set(String(d.id), d)
    const id = escFin(d.id)
    return `
        <tr class="fin-linha ctf-linha" title="Clique para abrir o orçamento, o ${cfg.um} ou o chamado" onclick="atalhosAcompOrc('${tipo}', '${id}', event)">
            <td class="fin-col-marcar">
                <input type="checkbox" class="fin-marcar" data-marcar-aco value="${id}" ${est.selecao.has(String(d.id)) ? 'checked' : ''}
                    onclick="event.stopPropagation(); marcarLinhaAcompOrc('${tipo}', this)" ondblclick="event.stopPropagation()" aria-label="Marcar">
            </td>
            ${cfg.linha(d)}
        </tr>`
}

async function aposCarregarAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo]
    prepararTotaisAcompOrc(tipo)
    await cabecalhoAvancadoTabela(cfg.pag, { prefKey: cfg.prefKey })
    prepararSelecaoAcompOrc(tipo)
    desenharRodapeAcompOrc(tipo)
    totaisAcompOrc(tipo)
}

// ------------------------------------------------------------ bandeja da direita
function painelAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo], est = estAcompOrc(tipo)
    const n = est.selecao.size
    const somaMarcadas = chave => [...est.selecao.values()].reduce((s, d) => s + (Number(d[chave]) || 0), 0)
    const marcadas = n ? `
        <div class="fin-painel-cabeca" title="Linhas marcadas na tabela">
            <span class="fin-avatar">${n}</span>
            <div class="fin-painel-texto"><b>${n.toLocaleString('pt-BR')} ${n === 1 ? cfg.um : cfg.varios} marcado(s)</b><small>O Excel baixa só as marcadas.</small></div>
        </div>
        <div class="cf-infos">
            ${cfg.totaisRodape.map(c => `<div class="cf-info"><small>${escFin(Object.entries(cfg.colunas).find(([, v]) => v.chave === c)?.[0] || c)}</small><b>${dinheiro(somaMarcadas(c))}</b></div>`).join('')}
        </div>
        <button type="button" class="fin-acao" title="Desmarcar todas" onclick="limparSelecaoAcompOrc('${tipo}')">${iconeFin('fechar')}<span>Desmarcar todas</span></button>
        <hr>` : ''
    const anoAtual = new Date().getFullYear()
    const anos = ['todos', ...[anoAtual, anoAtual - 1, anoAtual - 2].map(String)]
    const ano = `
        <label class="ctf-ano"><small>Data do ${cfg.um}</small>
            <select aria-label="Ano" onchange="estAcompOrc('${tipo}').ano = this.value; telaAcompOrc('${tipo}')">
                ${anos.map(a => `<option value="${a}" ${a === est.ano ? 'selected' : ''}>${a === 'todos' ? 'Todos os anos' : `Lançados em ${a}`}</option>`).join('')}
            </select>
        </label>`
    const t = est.totais
    const cartoes = (t || []).map(c => {
        const v = c.valor == null ? '—' : dinheiro(c.absoluto ? Math.abs(Number(c.valor.total) || 0) : Number(c.valor.total) || 0)
        const qtd = c.contar && c.valor?.todos != null ? `<small>${Number(c.valor.todos).toLocaleString('pt-BR')} ${Number(c.valor.todos) === 1 ? cfg.um : cfg.varios}</small>` : ''
        return `<div class="cf-info ${c.classe || ''}"><small>${escFin(c.rotulo)}</small><b>${v}</b>${qtd}${c.detalhe ? `<small>${escFin(c.detalhe)}</small>` : ''}</div>`
    }).join('')
    return `${ano}${marcadas}
        <div class="fin-painel-cabeca" title="Totais com os filtros da tabela">
            <span class="fin-avatar">R$</span>
            <div class="fin-painel-texto"><b>Totais do filtro</b>
                <small>${est.contagem != null ? `${Number(est.contagem).toLocaleString('pt-BR')} ${cfg.varios}` : 'Calculando…'} · ${est.ano === 'todos' ? 'todos os anos' : `lançados em ${est.ano}`}</small></div>
        </div>
        <div class="cf-infos">${t ? cartoes : '<div class="cf-info"><small>Calculando…</small><b>…</b></div>'}</div>
        <hr>
        <button type="button" class="fin-acao" title="${n ? 'Baixar em Excel só as marcadas' : 'Baixar em Excel todas as linhas dos filtros'}" onclick="baixarExcelAcompOrc('${tipo}')">${iconeFin('excel')}<span>Baixar Excel${n ? ' (marcadas)' : ''}</span></button>`
}

function alternarPainelAcompOrc(tipo) {
    const est = estAcompOrc(tipo)
    const corpo = document.querySelector('[data-corpo-aco]')
    if (!corpo) return
    est.painel = corpo.classList.contains('recolhido')
    corpo.classList.toggle('recolhido', !est.painel)
    const botao = corpo.querySelector('.fin-recolher')
    botao?.setAttribute('aria-expanded', String(est.painel))
    if (botao) botao.title = `${est.painel ? 'Recolher' : 'Mostrar'} os totais`
}

async function totaisAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo], est = estAcompOrc(tipo)
    const ctrl = controles[cfg.pag]
    const caixa = document.querySelector('[data-totais-aco]')
    if (!ctrl || !caixa) return
    const base = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
    const assinatura = JSON.stringify(base)
    if (assinatura === est.assinatura) return
    est.assinatura = assinatura
    // contar-por-campo em modo soma devolve { todos: linhas, total: soma }.
    const somar = async (path, extra) => {
        try { return await contarPorCampo({ base: cfg.base, path, modo: 'soma', filtros: extra ? combinarFiltros(base, extra) : base }) } catch { return null }
    }
    est.totais = null
    est.contagem = null
    est.somas = null
    caixa.innerHTML = painelAcompOrc(tipo)
    escreverTotaisRodapeAcompOrc(tipo)
    const [cartoes, ...somasPe] = await Promise.all([cfg.totais(somar), ...cfg.totaisRodape.map(c => somar(c, null))])
    if (assinatura !== est.assinatura || !document.body.contains(caixa)) return
    est.totais = cartoes
    est.contagem = somasPe[0]?.todos ?? null
    est.somas = Object.fromEntries(cfg.totaisRodape.map((c, i) => [c, somasPe[i] == null ? null : Number(somasPe[i].total || 0)]))
    caixa.innerHTML = painelAcompOrc(tipo)
    escreverTotaisRodapeAcompOrc(tipo)
}

// ------------------------------------------------------------ seleção (caixinhas)
function prepararSelecaoAcompOrc(tipo) {
    const est = estAcompOrc(tipo)
    const tabela = document.getElementById(bodyAcompOrc(tipo))?.closest('table')
    const th = tabela?.querySelector('thead tr:first-child th:first-child')
    if (th && !th.querySelector('[data-marcar-todas-aco]'))
        th.innerHTML = `<input type="checkbox" class="fin-marcar" data-marcar-todas-aco title="Marcar todas desta página" onclick="event.stopPropagation(); marcarTodasAcompOrc('${tipo}', this)">`
    const filtro = tabela?.querySelector('thead tr:nth-child(2) th:first-child')
    if (filtro?.querySelector('img')) filtro.innerHTML = ''
    document.querySelectorAll(`#${bodyAcompOrc(tipo)} [data-marcar-aco]`).forEach(c => { c.checked = est.selecao.has(c.value) })
    desenharSelecaoAcompOrc(tipo)
}

function marcarLinhaAcompOrc(tipo, caixa) {
    const est = estAcompOrc(tipo)
    if (caixa.checked) est.selecao.set(caixa.value, est.dados.get(caixa.value) || {})
    else est.selecao.delete(caixa.value)
    desenharSelecaoAcompOrc(tipo)
}

function marcarTodasAcompOrc(tipo, caixa) {
    const est = estAcompOrc(tipo)
    document.querySelectorAll(`#${bodyAcompOrc(tipo)} [data-marcar-aco]`).forEach(c => {
        c.checked = caixa.checked
        if (caixa.checked) est.selecao.set(c.value, est.dados.get(c.value) || {})
        else est.selecao.delete(c.value)
    })
    desenharSelecaoAcompOrc(tipo)
}

function limparSelecaoAcompOrc(tipo) {
    estAcompOrc(tipo).selecao.clear()
    prepararSelecaoAcompOrc(tipo)
}

// Todas as linhas do filtro aplicado (todas as páginas).
async function linhasDoFiltroAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo]
    const ctrl = controles[cfg.pag]
    const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
    const linhas = []
    let pagina = 1, paginas = 1
    do {
        const r = await pesquisarDB({ base: cfg.base, filtros, ordenar: ctrl.ordenar, pagina, limite: 2000 })
        linhas.push(...(r?.resultados || []))
        paginas = Number(r?.paginas) || 1
        pagina++
    } while (pagina <= paginas && pagina <= 50)
    return linhas
}

async function selecionarTodasFiltroAcompOrc(tipo) {
    if (!controles[TABELAS_ACOMP_ORC[tipo].pag]) return
    overlayAguarde()
    try {
        const est = estAcompOrc(tipo)
        ;(await linhasDoFiltroAcompOrc(tipo)).forEach(d => est.selecao.set(String(d.id), d))
        removerOverlay()
        prepararSelecaoAcompOrc(tipo)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: `Falha ao marcar as linhas do filtro: ${escFin(err.message)}` })
    }
}

function desenharSelecaoAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo], est = estAcompOrc(tipo)
    const pagina = [...document.querySelectorAll(`#${bodyAcompOrc(tipo)} [data-marcar-aco]`)]
    const todas = document.querySelector('[data-marcar-todas-aco]')
    const marcadasPagina = pagina.filter(c => c.checked).length
    const paginaToda = pagina.length > 0 && marcadasPagina === pagina.length
    if (todas) {
        todas.checked = paginaToda
        todas.indeterminate = marcadasPagina > 0 && marcadasPagina < pagina.length
    }
    const aviso = document.querySelector('[data-aviso-selecao-aco]')
    if (aviso) {
        const n = est.selecao.size, total = Number(document.getElementById(`resultados_${cfg.pag}`)?.textContent) || 0
        const plural = q => `${q.toLocaleString('pt-BR')} ${q === 1 ? cfg.um : cfg.varios}`
        const limpar = `<a href="#" onclick="event.preventDefault(); limparSelecaoAcompOrc('${tipo}')">limpar a seleção</a>`
        aviso.hidden = !(n && paginaToda)
        aviso.innerHTML = aviso.hidden ? '' : n < total
            ? `Você marcou ${plural(n)}. Você pode ${limpar} ou <a href="#" onclick="event.preventDefault(); selecionarTodasFiltroAcompOrc('${tipo}')">marcar todos os ${plural(total)} deste filtro</a>`
            : `Você marcou ${n === total ? 'todos os ' : ''}${plural(n)}${n === total ? ' deste filtro' : ''}. Você pode ${limpar}`
    }
    const caixa = document.querySelector('[data-totais-aco]')
    if (caixa) caixa.innerHTML = painelAcompOrc(tipo)
    escreverTotaisRodapeAcompOrc(tipo)
    if (est.selecao.size && !est.painel) alternarPainelAcompOrc(tipo)
}

// ------------------------------------------------------------ rodapé: paginação e Σ
function desenharRodapeAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo]
    const alvo = document.querySelector('[data-rodape-aco]')
    const ctrl = controles[cfg.pag]
    if (!alvo || !ctrl) return
    const porPagina = Number(ctrl.limite) || 50
    const total = Number(document.getElementById(`resultados_${cfg.pag}`)?.textContent) || 0
    const paginas = Math.max(1, Number(ctrl.total) || 1)
    const pagina = Math.min(ctrl.pagina || 1, paginas)
    const inicio = total ? (pagina - 1) * porPagina + 1 : 0
    const fim = Math.min(total, pagina * porPagina)
    const botao = (texto, destino, ativo, titulo = '') =>
        `<button type="button" ${ativo ? `onclick="irPaginaAcompOrc('${tipo}', ${destino})"` : 'disabled'} ${titulo ? `title="${titulo}"` : ''}>${texto}</button>`
    alvo.innerHTML = `
        <span class="fin-rodape-info"><span>${inicio} - ${fim} de ${total.toLocaleString('pt-BR')} ${total === 1 ? cfg.um : cfg.varios}</span>${typeof filtrosAtivosRodapeCab === 'function' ? filtrosAtivosRodapeCab(ctrl.pag) : ''}</span>
        <div class="fin-paginas">
            ${botao('|‹', 1, pagina > 1, 'Primeira página')}
            ${botao('‹ anterior', pagina - 1, pagina > 1)}
            <label>Página <input type="number" min="1" max="${paginas}" value="${pagina}" onchange="irPaginaAcompOrc('${tipo}', this.value)"></label>
            <span>de ${paginas.toLocaleString('pt-BR')}</span>
            ${botao('próximo ›', pagina + 1, pagina < paginas)}
            ${botao('›|', paginas, pagina < paginas, 'Última página')}
        </div>`
}

async function irPaginaAcompOrc(tipo, n) {
    const ctrl = controles[TABELAS_ACOMP_ORC[tipo].pag]
    if (!ctrl) return
    const pagina = Math.min(Math.max(1, parseInt(n) || 1), Math.max(1, Number(ctrl.total) || 1))
    if (pagina === ctrl.pagina) return desenharRodapeAcompOrc(tipo)
    ctrl.pagina = pagina
    await paginacao(ctrl.pag)
}

// Linha de totais (tfoot) e a de enchimento que segura totais e paginação no pé da janela.
function prepararTotaisAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo]
    const tabela = document.getElementById(bodyAcompOrc(tipo))?.closest('table')
    if (!tabela || tabela.tFoot) return
    const chaves = Object.values(controles[cfg.pag]?.colunas || {}).map(c => c.chave || '')
    const linha = tabela.createTFoot().insertRow()
    linha.className = 'fin-totais'
    chaves.forEach(chave => {
        const td = linha.insertCell()
        if (cfg.totaisRodape.includes(chave)) {
            td.dataset.totalAco = chave
            td.className = 'fis-num'
        }
    })
    const enchimento = document.createElement('tbody')
    enchimento.className = 'fin-enchimento'
    enchimento.innerHTML = `<tr><td colspan="${chaves.length}"></td></tr>`
    tabela.insertBefore(enchimento, tabela.tFoot)
}

function escreverTotaisRodapeAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo], est = estAcompOrc(tipo)
    const marcadas = est.selecao.size
    cfg.totaisRodape.forEach((chave, i) => {
        const td = document.querySelector(`[data-total-aco="${chave}"]`)
        if (!td) return
        if (marcadas) {
            const soma = [...est.selecao.values()].reduce((s, d) => s + (Number(d?.[chave]) || 0), 0)
            td.title = `Soma das ${marcadas} linha(s) marcada(s). Desmarque todas para ver o total do filtro.`
            td.innerHTML = `${i === 0 ? `<small class="fin-total-rotulo">${marcadas} marcada${marcadas === 1 ? '' : 's'}</small> ` : ''}<span class="fin-sigma">Σ</span> ${dinheiro(Math.round(soma * 100) / 100)}`
            td.classList.add('fin-total-selecao')
        } else {
            const v = est.somas?.[chave]
            td.title = 'Total de todas as linhas do filtro'
            td.innerHTML = `<span class="fin-sigma">Σ</span> ${v == null ? '…' : dinheiro(v)}`
            td.classList.remove('fin-total-selecao')
        }
    })
}

// ------------------------------------------------------------ clique na linha: onde mexer
function atalhosAcompOrc(tipo, idLinha, event) {
    if (event?.target?.closest('input, button, a, select')) return
    const d = estAcompOrc(tipo).dados.get(String(idLinha))
    if (!d) return
    const item = (icone, titulo, detalhe, acao, { ativo = true, motivo = '' } = {}) => `
        <button type="button" class="ctf-atalho" ${ativo ? `onclick="fecharAtalhosControleFat(this); ${acao}"` : 'disabled'} title="${escFin(ativo ? titulo : motivo)}">
            ${iconeFin(icone)}
            <span><b>${escFin(titulo)}</b><small>${escFin(ativo ? detalhe : motivo)}</small></span>
        </button>`
    const semOrc = { ativo: !!d.orcamento_id, motivo: 'Sem orçamento ligado' }
    const pedidoId = tipo === 'pedidos' ? d.id : null
    const lista = [
        item('ver', 'Histórico do orçamento', 'Pedidos, requisições, notas e o esquema do orçamento', `abrirEsquema('${escFin(d.orcamento_id || '')}')`, semOrc),
        tipo === 'pedidos'
            ? item('editar', 'Pedido', 'Número da OC, valor, empresa, condição de pagamento e o PDF da OC', `painelAdicionarPedido('${escFin(pedidoId)}')`,
                { ativo: d.situacao !== 'EXCLUÍDO', motivo: 'Pedido excluído: restaure pelo histórico do orçamento' })
            : item('ver', 'Cartão no fluxo', 'A requisição no Fluxo de Vendas/Serviços (separação, nota e entrega)', `telaFluxoItensVendas()`),
        item('relogio', 'Chamado', 'Status e correções do chamado do orçamento', `abrirChamadoDoStatus('${escFin(d.orcamento || '')}')`,
            { ativo: !!d.orcamento, motivo: 'Sem orçamento ligado' })
    ]
    const titulo = tipo === 'pedidos' ? `Pedido ${d.numero || ''}` : `Requisição de ${dataFin(d.dia)}`
    popup({
        titulo: `${titulo} · ${d.orcamento || ''}`,
        linhas: [
            { elemento: `<div class="ctf-atalhos-topo"><b>${escFin(d.cliente || '')}</b><small>${dataFin(d.dia)} · ${dinheiro(d.valor)} · ${escFin(d.situacao)}</small></div>` },
            { elemento: `<p class="ctf-atalhos-dica">Esta tabela só mostra. Escolha onde abrir:</p><div class="ctf-atalhos">${lista.join('')}</div>` }
        ]
    })
}

// ------------------------------------------------------------ Excel
async function baixarExcelAcompOrc(tipo) {
    const cfg = TABELAS_ACOMP_ORC[tipo], est = estAcompOrc(tipo)
    const ctrl = controles[cfg.pag]
    if (!ctrl) return
    overlayAguarde()
    try {
        const marcadas = [...est.selecao.values()].filter(d => d && d.id != null)
        const linhas = marcadas.length
            ? marcadas.sort((a, b) => String(b.dia || '').localeCompare(String(a.dia || '')))
            : await linhasDoFiltroAcompOrc(tipo)
        const data = v => v ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`) : null
        await baixarExcelRelatorioGCS({
            titulo: cfg.titulo,
            resumo: `${linhas.length} ${linhas.length === 1 ? cfg.um : cfg.varios}`,
            filtrosTexto: marcadas.length
                ? `Linhas marcadas na tela: ${marcadas.length}`
                : `${est.ano === 'todos' ? 'Todos os anos' : `Lançados em ${est.ano}`} · Filtros: ${descreverFiltrosFin(ctrl)}`,
            colunas: cfg.excel.map(([titulo, largura, chave, extra = {}]) => ({
                titulo, largura, ...extra,
                ...(extra.tipo === 'moeda' ? { soma: true, valor: d => Number(d[chave]) || 0 }
                    : extra.tipo === 'data' ? { valor: d => data(d[chave]) }
                        : { valor: d => d[chave] ?? '' })
            })),
            linhas
        })
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao gerar o Excel: ${escFin(err.message)}` })
    } finally {
        removerOverlay()
    }
}
