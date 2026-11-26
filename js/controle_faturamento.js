// Controle de Faturamento (Financeiro → Controle de Faturamento), layout financeiro.
// A planilha "CONTROLE FATURAMENTO 2026" dentro do GCS: uma linha por nota de saída (Omie, avulsas e as emitidas
// pelo GCS), lida da vw_controle_faturamento (gcs migrations/controle-faturamento.sql).
//
// Empresa = empresa do cadastro do cliente (coluna grupo da view; sem ela, a do cliente do orçamento). Emissora = AC/HNK/IAC/HNW.
// Setor  = setor do responsável do orçamento na ficha do RH (rh_funcionarios.setor); corrige-se clicando nele.
// Situação: Recebida, Recebida parcial, A vencer, Atrasada (pelas faturas a receber ligadas à nota),
//           Sem fatura, Fatura cancelada, Cancelada, Substituída, Devolvida e Sem cobrança (remessa/devolução).
// Totais do topo (como o PAINEL da planilha): só o que se cobra (cobravel = S), com os filtros da tabela.

// painel: bandeja da direita com os totais (começa aberta).
const estadoControleFat = { ano: String(new Date().getFullYear()), painel: true }
const dadosControleFat = new Map()
let assinaturaTotaisControleFat = null

const SITUACOES_CONTROLE_FAT = {
    RECEBIDA: '#2e9e4f', 'RECEBIDA PARCIAL': '#7a9e2e', 'A VENCER': '#2563eb', ATRASADA: '#d32f2f',
    'SEM FATURA': '#b7791f', 'FATURA CANCELADA': '#b7791f', CANCELADA: '#64748b', 'SUBSTITUÍDA': '#64748b',
    DEVOLVIDA: '#8e44ad', 'SEM COBRANÇA': '#64748b'
}
const ICONES_CONTROLE_FAT = { RECEBIDA: 'check', ATRASADA: 'alerta', 'A VENCER': 'relogio', CANCELADA: 'cancelar' }

function situacaoControleFat(s) {
    return `<span class="fin-sit" style="--cor: ${SITUACOES_CONTROLE_FAT[s] || '#64748b'}">${iconeFin(ICONES_CONTROLE_FAT[s] || 'relogio')}${escFin(s || '')}</span>`
}

// Ano escolhido no topo (filtro fixo pelo mês da emissão); "todos" tira o filtro.
const filtrosFixosControleFat = () => estadoControleFat.ano === 'todos' ? null : { mes: { op: 'includes', value: `${estadoControleFat.ano}-` } }

function abrirControleFaturamento() {
    recolherMenuPrincipalFin()
    return telaControleFaturamento()
}

async function telaControleFaturamento() {
    dadosControleFat.clear()
    assinaturaTotaisControleFat = null
    const anoAtual = new Date().getFullYear()
    const anos = [anoAtual, anoAtual - 1, anoAtual - 2].map(String)
    tela.innerHTML = `
        <div class="fis-pagina fin-tela ctf-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Controle de Faturamento</h2>
                    <div class="fin-barra">
                        <select aria-label="Ano da emissão" onchange="estadoControleFat.ano = this.value; telaControleFaturamento()">
                            ${[...anos, 'todos'].map(a => `<option value="${a}" ${a === estadoControleFat.ano ? 'selected' : ''}>${a === 'todos' ? 'Todos os anos' : `Emitidas em ${a}`}</option>`).join('')}
                        </select>
                        <button type="button" onclick="baixarExcelControleFat()" title="Baixa todas as notas dos filtros aplicados">${iconeFin('excel')} Excel</button>
                    </div>
                </header>
                <div class="fin-corpo${estadoControleFat.painel ? '' : ' recolhido'}" data-corpo-ctf>
                    <div class="fin-tabela-area ctf-area" data-tabela-ctf></div>
                    <div class="fin-lateral">
                        <button type="button" class="fin-recolher" onclick="alternarPainelControleFat()" aria-expanded="${estadoControleFat.painel}"
                            title="${estadoControleFat.painel ? 'Recolher' : 'Mostrar'} os totais">${iconeFin('seta')}</button>
                        <aside class="fin-painel cf-painel" data-totais-ctf>${painelControleFat()}</aside>
                    </div>
                </div>
            </section>
        </div>`
    overlayAguarde()
    try {
        delete controles.controleFat
        const area = document.querySelector('[data-tabela-ctf]')
        area.innerHTML = await modTab({
            base: 'vw_controle_faturamento',
            pag: 'controleFat',
            body: 'bodyControleFat',
            criarLinha: 'criarLinhaControleFat',
            caber: true,
            limite: 50,
            funcaoAdicional: ['aposCarregarControleFat'],
            filtrosFixos: filtrosFixosControleFat(),
            ordenar: [{ path: 'emissao', direcao: 'desc' }],
            colunas: {
                // opcoes fixas: sem elas o modTab conta a view inteira por coluna antes de desenhar a tela.
                'Setor': { chave: 'setor', tipoPesquisa: 'select', opcoes: [...SETORES_PADRAO_RH, 'SEM SETOR'] },
                'Responsável': { chave: 'responsavel' },
                'Empresa': { chave: 'grupo', tipoPesquisa: 'select' },
                'Cliente': { chave: 'cliente', principal: true },
                'Orçamento': { chave: 'orcamento' },
                'Valor': { chave: 'valor', tipoOrdenacao: 'numero' },
                'Nota': { chave: 'numero' },
                'Tipo': { chave: 'tipo', tipoPesquisa: 'select', opcoes: ['VENDA', 'SERVIÇO', 'REMESSA', 'DEVOLUÇÃO', 'COMISSÃO VENDA DIRETA'] },
                'Emissora': { chave: 'app', tipoPesquisa: 'select', opcoes: ['AC', 'HNK', 'IAC', 'HNW'] },
                'Emissão': { chave: 'dia_emissao', tipoPesquisa: 'data' },
                'Vencimento': { chave: 'dia_vencimento', tipoPesquisa: 'data' },
                'Recebido em': { chave: 'dia_recebimento', tipoPesquisa: 'data' },
                'Situação': { chave: 'situacao', tipoPesquisa: 'select', opcoes: Object.keys(SITUACOES_CONTROLE_FAT) },
                'Recebido': { chave: 'recebido', tipoOrdenacao: 'numero' },
                'Saldo': { chave: 'saldo', tipoOrdenacao: 'numero' },
                'Dias de atraso': { chave: 'dias_atraso', tipoOrdenacao: 'numero' },
                'Pedido do cliente': { chave: 'pedido_cliente' },
                'CPF/CNPJ': { chave: 'cliente_documento' },
                'LPU': { chave: 'lpu_ativa', tipoPesquisa: 'select' },
                'Origem': { chave: 'fonte', tipoPesquisa: 'select', opcoes: ['OMIE', 'GCS'], rotulos: { OMIE: 'Omie / avulsa', GCS: 'GCS' } }
            }
        })
        // Paginação no rodapé, como nas Faturas (no layout financeiro a do modTab fica escondida no topo).
        area.querySelector('.modtab')?.insertAdjacentHTML('beforeend', '<div class="fin-rodape" data-rodape-ctf></div>')
        await paginacao('controleFat')
        removerOverlay()
    } catch (err) {
        removerOverlay()
        console.error(err)
        popup({ mensagem: `Falha ao abrir o Controle de Faturamento: ${escFin(err.message)}` })
    }
}

// Bandeja da direita (como a das Faturas): totais do filtro e ações; recolhida, ficam só os ícones.
function painelControleFat(t = null) {
    const v = n => t == null ? '…' : n == null ? '—' : dinheiro(n)
    return `
        <div class="fin-painel-cabeca" title="Totais com os filtros da tabela">
            <span class="fin-avatar">R$</span>
            <div class="fin-painel-texto"><b>Totais do filtro</b>
                <small>${t ? `${t.notas} nota(s)` : 'Calculando…'} · ${estadoControleFat.ano === 'todos' ? 'todos os anos' : `emitidas em ${estadoControleFat.ano}`}</small></div>
        </div>
        <div class="cf-infos">
            <div class="cf-info cf-ok"><small>Recebido</small><b>${v(t?.recebido)}</b></div>
            <div class="cf-info cf-falta"><small>Atrasado</small><b>${v(t?.atrasado)}</b></div>
            <div class="cf-info"><small>A vencer</small><b>${v(t?.aVencer)}</b></div>
            <div class="cf-info"><small>Total faturado</small><b>${v(t?.total)}</b>
                <small>Sem canceladas, substituídas, devolvidas e remessas</small></div>
        </div>
        <hr>
        <button type="button" class="fin-acao" title="Baixar em Excel todas as notas dos filtros" onclick="baixarExcelControleFat()">${iconeFin('excel')}<span>Baixar Excel</span></button>`
}

function alternarPainelControleFat() {
    const corpo = document.querySelector('[data-corpo-ctf]')
    if (!corpo) return
    estadoControleFat.painel = corpo.classList.contains('recolhido')
    corpo.classList.toggle('recolhido', !estadoControleFat.painel)
    const botao = corpo.querySelector('.fin-recolher')
    botao?.setAttribute('aria-expanded', String(estadoControleFat.painel))
    if (botao) botao.title = `${estadoControleFat.painel ? 'Recolher' : 'Mostrar'} os totais`
}

function criarLinhaControleFat(d) {
    dadosControleFat.set(String(d.id), d)
    const id = escFin(d.id)
    const primeiraFatura = String(d.titulos || '').split(',')[0]
    const titulo = [
        d.substituta ? `Substituída pela ${d.substituta}` : '',
        Number(d.faturas) ? `${d.faturas} fatura(s) a receber · duplo clique abre` : 'Sem fatura a receber ligada',
        d.orc_venda_direta ? 'Orçamento de venda direta' : ''
    ].filter(Boolean).join(' · ')
    // Uma linha de texto por nota: o que não cabe termina em "..." (texto inteiro no título, ao passar o mouse).
    const corta = (texto, classe = '') => `<td class="ctf-corta ${classe}" title="${escFin(texto || '')}"><span>${escFin(texto || '')}</span></td>`
    return `
        <tr class="fin-linha ctf-linha" title="${escFin(titulo)}" ${primeiraFatura ? `ondblclick="abrirFaturaFin('${escFin(primeiraFatura)}')"` : ''}>
            <td class="ctf-corta"><button type="button" class="ctf-setor ${d.setor === 'SEM SETOR' ? 'vazio' : ''}" title="${escFin(d.setor)} · ${d.responsavel_id ? 'clique para corrigir o setor de quem pediu (vale para todas as notas dele)' : 'responsável sem cadastro: o setor não se corrige por aqui'}"
                ${d.responsavel_id ? `onclick="event.stopPropagation(); escolherSetorControleFat('${id}')"` : 'disabled'}>${escFin(d.setor)}</button></td>
            ${corta(d.responsavel)}
            ${corta(d.grupo)}
            ${corta(d.cliente, 'ctf-largo')}
            <td class="fin-centro">${escFin(d.orcamento || '')}</td>
            <td class="fis-num">${dinheiro(d.valor)}</td>
            <td class="fin-centro fin-doc" title="${escFin(d.modelo)}"><span class="ctf-modelo">${escFin(d.modelo)}</span> ${escFin(d.numero || '')}</td>
            ${corta(d.tipo)}
            <td class="fin-centro">${escFin(d.app || '')}</td>
            <td class="fin-centro">${dataFin(d.dia_emissao)}</td>
            <td class="fin-centro">${dataFin(d.dia_vencimento)}</td>
            <td class="fin-centro">${dataFin(d.dia_recebimento)}</td>
            <td class="ctf-corta" title="${escFin(d.substituta ? `${d.situacao} pela ${d.substituta}` : d.situacao)}">${situacaoControleFat(d.situacao)}</td>
            <td class="fis-num">${Number(d.recebido) ? dinheiro(d.recebido) : '—'}</td>
            <td class="fis-num">${Number(d.saldo) ? dinheiro(d.saldo) : '—'}</td>
            <td class="fin-centro">${d.dias_atraso ? `<b class="ctf-atraso">${d.dias_atraso}</b>` : ''}</td>
            ${corta(d.pedido_cliente)}
            <td class="fin-centro fin-doc">${d.cliente_documento ? docFormatadoFis(d.cliente_documento) : ''}</td>
            ${corta(d.lpu_ativa)}
            <td>${d.fonte === 'GCS' ? 'GCS' : 'Omie / avulsa'}</td>
        </tr>`
}

async function aposCarregarControleFat() {
    await cabecalhoAvancadoTabela('controleFat', { prefKey: 'controle_faturamento' })
    desenharRodapeControleFat()
    totaisControleFat()
}

// Rodapé "1 - 50 de 3.318 registros · página N de M" (o mesmo das Faturas, para esta tabela).
function desenharRodapeControleFat() {
    const alvo = document.querySelector('[data-rodape-ctf]')
    const ctrl = controles.controleFat
    if (!alvo || !ctrl) return
    const porPagina = Number(ctrl.limite) || 50
    const total = Number(document.getElementById('resultados_controleFat')?.textContent) || 0
    const paginas = Math.max(1, Number(ctrl.total) || 1)
    const pagina = Math.min(ctrl.pagina || 1, paginas)
    const inicio = total ? (pagina - 1) * porPagina + 1 : 0
    const fim = Math.min(total, pagina * porPagina)
    const botao = (texto, destino, ativo, titulo = '') =>
        `<button type="button" ${ativo ? `onclick="irPaginaControleFat(${destino})"` : 'disabled'} ${titulo ? `title="${titulo}"` : ''}>${texto}</button>`
    alvo.innerHTML = `
        <span class="fin-rodape-info"><span>${inicio} - ${fim} de ${total.toLocaleString('pt-BR')} nota${total === 1 ? '' : 's'}</span>${typeof filtrosAtivosRodapeCab === 'function' ? filtrosAtivosRodapeCab(ctrl.pag) : ''}</span>
        <div class="fin-paginas">
            ${botao('|‹', 1, pagina > 1, 'Primeira página')}
            ${botao('‹ anterior', pagina - 1, pagina > 1)}
            <label>Página <input type="number" min="1" max="${paginas}" value="${pagina}" onchange="irPaginaControleFat(this.value)"></label>
            <span>de ${paginas.toLocaleString('pt-BR')}</span>
            ${botao('próximo ›', pagina + 1, pagina < paginas)}
            ${botao('›|', paginas, pagina < paginas, 'Última página')}
        </div>`
}

async function irPaginaControleFat(n) {
    const ctrl = controles.controleFat
    if (!ctrl) return
    const pagina = Math.min(Math.max(1, parseInt(n) || 1), Math.max(1, Number(ctrl.total) || 1))
    if (pagina === ctrl.pagina) return desenharRodapeControleFat()
    ctrl.pagina = pagina
    await paginacao('controleFat')
}

// Totais com os filtros da tabela: recebido e total só do que se cobra; atrasado e a vencer pelo saldo.
async function totaisControleFat() {
    const ctrl = controles.controleFat
    const caixa = document.querySelector('[data-totais-ctf]')
    if (!ctrl || !caixa) return
    const base = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
    const assinatura = JSON.stringify(base)
    if (assinatura === assinaturaTotaisControleFat) return
    assinaturaTotaisControleFat = assinatura
    const comFiltro = extra => combinarFiltros(base, extra)
    // contar-por-campo em modo soma devolve { todos: linhas, total: soma }.
    const somar = async (path, extra) => {
        try { return await contarPorCampo({ base: 'vw_controle_faturamento', path, modo: 'soma', filtros: extra ? comFiltro(extra) : base }) } catch { return null }
    }
    const cobravel = { cobravel: { op: '=', value: 'S' } }
    caixa.innerHTML = painelControleFat()
    const [recebido, atrasado, aVencer, total, todas] = await Promise.all([
        somar('recebido', cobravel),
        somar('saldo', { situacao: { op: '=', value: 'ATRASADA' } }),
        somar('saldo', { situacao: { modo: 'OR', regras: [{ op: '=', value: 'A VENCER' }, { op: '=', value: 'RECEBIDA PARCIAL' }] } }),
        somar('valor', cobravel),
        somar('valor', null)
    ])
    if (assinatura !== assinaturaTotaisControleFat || !document.body.contains(caixa)) return
    const n = r => r == null ? null : Number(r.total || 0)
    caixa.innerHTML = painelControleFat({
        recebido: n(recebido), atrasado: n(atrasado), aVencer: n(aVencer), total: n(total),
        notas: todas?.todos != null ? Number(todas.todos).toLocaleString('pt-BR') : '—'
    })
}

// ------------------------------------------------------------ setor do responsável (rh_funcionarios.setor)

function escolherSetorControleFat(idLinha) {
    const d = dadosControleFat.get(String(idLinha))
    if (!d?.responsavel_id) return
    const atual = d.setor === 'SEM SETOR' ? '' : d.setor
    const opcoes = [...new Set([...SETORES_PADRAO_RH, ...(atual ? [atual] : [])])]
    popup({
        titulo: 'Setor de quem pediu o faturamento',
        linhas: [
            { texto: 'Responsável', elemento: `<b>${escFin(d.responsavel)}</b>` },
            {
                texto: 'Setor',
                elemento: `<select name="setor"><option value="">— sem setor —</option>${opcoes.map(s =>
                    `<option value="${escFin(s)}" ${s === atual ? 'selected' : ''}>${escFin(s)}</option>`).join('')}</select>`
            },
            { elemento: '<small>Vale para todas as notas dele e aparece na ficha do RH.</small>' }
        ],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarSetorControleFat(this, '${escFin(d.responsavel_id)}')` }]
    })
}

async function salvarSetorControleFat(botao, idPessoa) {
    const janela = botao.closest('.popup')
    const setor = janela?.querySelector('[name="setor"]')?.value || null
    const resposta = await enviar(`rh_funcionarios/${idPessoa}/setor`, setor)
    if (!resposta?.success)
        return popup({ mensagem: resposta?.mensagem || 'Não foi possível salvar o setor.' })
    removerPopup(janela?.id)
    assinaturaTotaisControleFat = null
    await paginacao('controleFat')
}

// ------------------------------------------------------------ Excel (todas as linhas dos filtros)

async function baixarExcelControleFat() {
    const ctrl = controles.controleFat
    if (!ctrl) return
    overlayAguarde()
    try {
        const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        const linhas = []
        let pagina = 1, paginas = 1
        do {
            const r = await pesquisarDB({ base: 'vw_controle_faturamento', filtros, ordenar: ctrl.ordenar, pagina, limite: 2000 })
            linhas.push(...(r?.resultados || []))
            paginas = Number(r?.paginas) || 1
            pagina++
        } while (pagina <= paginas)
        const data = v => v ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`) : null
        const texto = k => d => d[k] ?? ''
        const moeda = (titulo, k) => ({ titulo, largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d[k]) || 0 })
        await baixarExcelRelatorioGCS({
            titulo: 'Controle de Faturamento',
            resumo: `${linhas.length} nota(s)`,
            filtrosTexto: `${estadoControleFat.ano === 'todos' ? 'Todos os anos' : `Emitidas em ${estadoControleFat.ano}`} · Filtros: ${descreverFiltrosFin(ctrl)}`,
            colunas: [
                { titulo: 'Setor', largura: 20, valor: texto('setor') },
                { titulo: 'Responsável', largura: 16, valor: texto('responsavel') },
                { titulo: 'Empresa', largura: 16, valor: texto('grupo') },
                { titulo: 'Cliente', largura: 34, quebra: true, valor: texto('cliente') },
                { titulo: 'Orçamento', largura: 12, valor: texto('orcamento') },
                moeda('Valor', 'valor'),
                { titulo: 'Nota', largura: 12, centro: true, valor: texto('numero') },
                { titulo: 'Modelo', largura: 9, centro: true, valor: texto('modelo') },
                { titulo: 'Tipo', largura: 16, valor: texto('tipo') },
                { titulo: 'Emissora', largura: 9, centro: true, valor: texto('app') },
                { titulo: 'Emissão', largura: 12, tipo: 'data', valor: d => data(d.dia_emissao) },
                { titulo: 'Vencimento', largura: 12, tipo: 'data', valor: d => data(d.dia_vencimento) },
                { titulo: 'Recebido em', largura: 12, tipo: 'data', valor: d => data(d.dia_recebimento) },
                { titulo: 'Situação', largura: 17, valor: texto('situacao') },
                moeda('Recebido', 'recebido'),
                moeda('Saldo', 'saldo'),
                { titulo: 'Dias de atraso', largura: 10, centro: true, valor: d => d.dias_atraso ?? '' },
                { titulo: 'Pedido do cliente', largura: 16, valor: texto('pedido_cliente') },
                { titulo: 'CPF/CNPJ', largura: 18, valor: d => d.cliente_documento ? docFormatadoFis(d.cliente_documento) : '' },
                { titulo: 'Substituída por', largura: 16, valor: texto('substituta') }
            ],
            linhas
        })
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao gerar o Excel: ${escFin(err.message)}` })
    } finally {
        removerOverlay()
    }
}
