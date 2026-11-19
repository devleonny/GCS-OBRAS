// Histórico de Uso GCS (acesso sistema.historico).
//  - Alterações: versões dos registros (gcs: migrations/versoes.sql, SCRIPTS/versoes_rotas.js).
//    Quem mudou, quando, o que tinha antes e o que ficou; voltar uma versão (sistema.restaurar_versao).
//  - Uso do sistema: atividades de logs_rotas e o mapa de calor de dias x horários.
// abrirVersoesRegistro(tabela, registro) abre a linha do tempo de um registro de qualquer tela.

let chartMapaCalor = null

const estadoHU = {
    aba: 'alteracoes',
    filtros: { busca: '', quem: 'pessoas', tabelas: [], usuarios: [], operacao: '', de: '', ate: '' },
    pagina: 1,
    por: 50,
    itens: [],
    total: 0,
    opcoes: null,
    podeRestaurar: false
}
const escHU = v => escaparAtributo(v ?? '')
// Texto como argumento de onclick (aspas de qualquer tipo).
const jsHU = v => escaparAtributo(JSON.stringify(String(v ?? '')))

async function apiVersoes(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/versoes/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const retorno = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(retorno.mensagem || `Falha (${resposta.status})`)
    return retorno
}

// ---------------------------------------------------------------- nomes amigáveis

const TABELAS_HU = {
    dados_orcamentos: 'Orçamento', dados_ocorrencias: 'Chamado', composicoes_base: 'Item do catálogo',
    lpu_precos: 'Preço de LPU', lpus: 'LPU', familias: 'Família', tags_orcamentos: 'Tag de orçamento',
    orcamento_lotes: 'Lote de orçamentos', orcamento_saldo_baixas: 'Baixa de saldo', contratos_vinculados: 'Vínculo de orçamentos',
    parceiros: 'LPU parceiro', checklist: 'Checklist', correcoes: 'Correção', config_locacao: 'Configuração de locação',
    quadros: 'Quadro', fluxo_itens: 'Pedido / requisição / nota', clientes: 'Cadastro', empresas: 'Empresa',
    colaboradores: 'Colaborador', transportadoras: 'Transportadora', lista_pagamentos: 'Pagamento',
    lista_recebimentos: 'Recebimento', autorizacoes_departamento: 'Autorização de departamento',
    fin_titulos: 'Fatura (financeiro)', fin_baixas: 'Baixa (financeiro)', fin_categorias: 'Categoria (financeiro)',
    fin_contas: 'Conta (financeiro)', fin_setores: 'Setor (financeiro)', fin_parametros: 'Parâmetro (financeiro)',
    fin_recorrencias: 'Recorrência (financeiro)', custos_pessoal_manuais: 'Custo de pessoal', custos_pessoal_categorias: 'Categoria de custo de pessoal',
    localiza_classificacao: 'Classificação Localiza', fiscal_documentos: 'Nota fiscal', fiscal_documento_itens: 'Item de nota fiscal',
    fiscal_operacoes: 'Operação fiscal', fiscal_participantes: 'Participante fiscal', fiscal_servicos: 'Serviço fiscal',
    fiscal_empresas: 'Empresa emissora', fiscal_depara: 'De-para fiscal', fiscal_remessas: 'Remessa',
    estoque_locais: 'Local de estoque', estoque_movimentos: 'Movimento de estoque', estoque_inventarios: 'Inventário',
    estoque_inventario_itens: 'Item de inventário', controle_logistico: 'Envio (logística)', custo_veiculos: 'Custo de veículo',
    veiculos: 'Veículo', dados_veiculos: 'Dados de veículo', documentos: 'Documento do RH', rh_funcionarios: 'Funcionário (RH)',
    rh_salarios: 'Salário', rh_exames: 'Exame (RH)', rh_epis: 'EPI', rh_ficha_itens: 'Ficha do funcionário',
    rh_documentos_regras: 'Regra de documentos (RH)', rh_pastas_acesso: 'Pasta do RH', acesso_perfis: 'Perfil de acesso',
    acesso_usuarios: 'Acessos do usuário', ref_permissoes_bases: 'Permissão de base'
}
const nomeTabelaHU = t => TABELAS_HU[t] || inicialMaiuscula(String(t || '').replace(/_/g, ' '))

// Nome de cada campo (último pedaço do caminho que tem nome conhecido).
const CAMPOS_HU = {
    dados_orcam: '', contrato: 'Nº do orçamento', omie_cliente: 'Cliente (código Omie)', cliente_selecionado: 'Cliente',
    emissor: 'Emissor', validade: 'Validade (dias)', validade_ate: 'Válido até', condicoes: 'Condições',
    condicao_pagamento: 'Condição de pagamento', data_registro: 'Data do registro', prorrogacoes: 'Prorrogações',
    dados_composicoes: '', esquema_composicoes: '', revisoes: 'Revisões', historico_status: 'Status',
    total_geral: 'Total', total_bruto: 'Total bruto', lpu_ativa: 'LPU ativa', tags: 'Tags', vinculados: 'Vinculados',
    custo: 'Preço', custo_original: 'Preço original', qtde: 'Quantidade', descricao: 'Descrição', unidade: 'Unidade',
    tipo: 'Tipo', codigo: 'Código', valor: 'Valor', status: 'Status', usuario: 'Usuário', data: 'Data', nome: 'Nome',
    observacao: 'Observação', observacoes: 'Observações', comentario: 'Comentário', excluido: 'Exclusão',
    anexos: 'Anexos', fotos: 'Fotos', correcoes: 'Andamentos', unidade_: 'Unidade', prioridade: 'Prioridade',
    sistema: 'Sistema', tecnico: 'Técnico', executor: 'Executor', param: '', historico: 'Histórico',
    distribuicao: 'Rateio por departamento', categorias: 'Categorias', data_vencimento: 'Vencimento',
    valor_documento: 'Valor', numero_documento_fiscal: 'Nº do documento fiscal', codigo_categoria: 'Categoria',
    etapa: 'Etapa', pedido: 'Pedido', requisicoes: 'Requisições', notas: 'Notas', cnpj: 'CNPJ/CPF',
    endereco: 'Endereço', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade',
    estado: 'UF', cep: 'CEP', email: 'E-mail', celular: 'Celular', permissao: 'Perfil', empresa: 'Empresa',
    setor: 'Setor', cargo: 'Cargo', inscricao_estadual: 'Inscrição estadual', inscricao_municipal: 'Inscrição municipal',
    razao_social: 'Razão social', desligado: 'Desligado', itens: 'Marcações', adicionados: 'A mais', removidos: 'A menos',
    salario: 'Salário', vencimento: 'Vencimento', emissao: 'Emissão', participante_nome: 'Participante',
    valor_total: 'Valor total', serie: 'Série', chave: 'Chave', margem: 'Margem', fornecedor: 'Fornecedor',
    ativo: 'Ativo', familia: 'Família', ncm: 'NCM', modelo: 'Modelo', fabricante: 'Fabricante', imagem: 'Imagem'
}

function nomeCampoHU(tabela, c = []) {
    if (!c.length) return 'Registro inteiro'
    const partes = []
    for (let i = 0; i < c.length; i++) {
        const p = String(c[i]), anterior = c[i - 1]
        // Itens do orçamento: dados_composicoes/<código>/<campo> → "Item 722 › Preço"
        if (['dados_composicoes', 'esquema_composicoes'].includes(anterior)) { partes.push(`Item ${p}`); continue }
        if (/^\d+$/.test(p)) { if (!(tabela === 'lista_pagamentos' && anterior === 'param' && p === '0')) partes.push(`nº ${Number(p) + 1}`); continue }
        if (/^[0-9a-f-]{20,}$/i.test(p) || /^[A-Za-z0-9_-]{5,}$/.test(p) && !CAMPOS_HU[p] && /\d/.test(p)) continue  // ids internos
        partes.push(p in CAMPOS_HU ? CAMPOS_HU[p] : inicialMaiuscula(p.replace(/_/g, ' ')))
    }
    return partes.filter(Boolean).join(' › ') || 'Registro'
}

function valorHU(v, ausente) {
    if (ausente) return '<i class="hu-nada">—</i>'
    if (v === null || v === '') return '<i class="hu-nada">(vazio)</i>'
    if (v === '[SIGILOSO]' || v === '[OCULTO]') return '<i class="hu-nada">••• sigiloso</i>'
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
    if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
    if (typeof v === 'string') {
        const curto = v.length > 160 ? v.slice(0, 160) + '…' : v
        return `<span title="${escHU(v)}">${escHU(curto)}</span>`
    }
    // Objeto/lista: o que tiver de mais legível
    const legivel = v && !Array.isArray(v) && (v.status || v.nome || v.descricao || v.justificativa || v.comentario)
    const json = JSON.stringify(v)
    const curto = legivel ? String(legivel) : (json.length > 140 ? json.slice(0, 140) + '…' : json)
    return `<span class="hu-obj" title="${escHU(json.slice(0, 2000))}">${escHU(curto)}</span>`
}

const ACAO_HU = { I: ['Criou', 'hu-criou'], U: ['Editou', 'hu-editou'], D: ['Apagou', 'hu-apagou'] }

function origemHU(v) {
    const o = String(v.origem || '')
    if (o.startsWith('restauração')) return o.replace('restauração', 'voltou versão')
    if (v.usuario) return ''
    const mapa = {
        'gcs:server': 'GCS (automático)', 'gcs:atualizar_pagamentos': 'Sincronização Omie (pagamentos)',
        'gcs:atualizar_notas': 'Sincronização Omie (notas)', 'gcs:cadastrar_clientes': 'Sincronização de cadastros',
        psql: 'Direto no banco (suporte)', banco: 'Banco (sem identificação)'
    }
    return mapa[o] || (o.startsWith('gcs:') ? `Script ${o.slice(4)}` : o || 'Banco')
}

const quandoHU = q => new Date(q).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

// ---------------------------------------------------------------- tela

async function daily() {
    titulo.innerHTML = 'Histórico de Uso GCS'
    tela.innerHTML = `
        <div class="pagina-conteudo hu">
            <div class="cabecalho-pagina"><h2>Histórico de Uso GCS</h2></div>
            <div class="hu-abas">
                <button type="button" data-hu-aba="alteracoes" onclick="trocarAbaHU('alteracoes')">Alterações</button>
                <button type="button" data-hu-aba="uso" onclick="trocarAbaHU('uso')">Uso do sistema</button>
            </div>
            <div data-hu-corpo></div>
        </div>`
    await trocarAbaHU(estadoHU.aba)
}

async function trocarAbaHU(aba) {
    estadoHU.aba = aba
    document.querySelectorAll('[data-hu-aba]').forEach(b => b.classList.toggle('ativo', b.dataset.huAba === aba))
    const corpo = document.querySelector('[data-hu-corpo]')
    if (!corpo) return
    if (aba === 'uso') return dailyUso(corpo)
    await desenharAlteracoesHU(corpo)
}

async function desenharAlteracoesHU(corpo) {
    if (!estadoHU.opcoes) {
        try { estadoHU.opcoes = await apiVersoes('opcoes') }
        catch (erro) { corpo.innerHTML = `<div class="hu-vazio">${escHU(erro.message)}</div>`; return }
    }
    const f = estadoHU.filtros
    const { tabelas = [], usuarios = [] } = estadoHU.opcoes
    const opcoesTabelas = tabelas.map(t => [t, nomeTabelaHU(t)]).sort((a, b) => a[1].localeCompare(b[1]))
    corpo.innerHTML = `
        <div class="hu-filtros">
            <input class="hu-busca" placeholder="Buscar: ORC_5344, cliente, nº da nota, usuário…" value="${escHU(f.busca)}"
                onkeydown="if (event.key === 'Enter') { estadoHU.filtros.busca = this.value; buscarHU() }"
                onchange="estadoHU.filtros.busca = this.value; buscarHU()">
            <div class="hu-segmento">
                ${[['pessoas', 'Pessoas'], ['sistema', 'Sistema'], ['todos', 'Todos']].map(([k, t]) =>
                    `<button type="button" class="${f.quem === k ? 'ativo' : ''}" onclick="estadoHU.filtros.quem = '${k}'; desenharAlteracoesHU(document.querySelector('[data-hu-corpo]'))">${t}</button>`).join('')}
            </div>
            <select onchange="estadoHU.filtros.tabelas = this.value ? [this.value] : []; buscarHU()">
                <option value="">Tudo</option>
                ${opcoesTabelas.map(([t, n]) => `<option value="${escHU(t)}" ${f.tabelas[0] === t ? 'selected' : ''}>${escHU(n)}</option>`).join('')}
            </select>
            <select onchange="estadoHU.filtros.usuarios = this.value ? [this.value] : []; buscarHU()">
                <option value="">Todos os usuários</option>
                ${usuarios.map(u => `<option value="${escHU(u)}" ${f.usuarios[0] === u ? 'selected' : ''}>${escHU(u)}</option>`).join('')}
            </select>
            <select onchange="estadoHU.filtros.operacao = this.value; buscarHU()">
                <option value="">Criou, editou ou apagou</option>
                ${[['U', 'Editou'], ['I', 'Criou'], ['D', 'Apagou']].map(([k, t]) => `<option value="${k}" ${f.operacao === k ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <label>De <input type="date" value="${escHU(f.de)}" onchange="estadoHU.filtros.de = this.value; buscarHU()"></label>
            <label>Até <input type="date" value="${escHU(f.ate)}" onchange="estadoHU.filtros.ate = this.value; buscarHU()"></label>
            <button type="button" class="hu-limpar" onclick="limparFiltrosHU()">Limpar</button>
        </div>
        <div class="hu-resumo" data-hu-resumo></div>
        <div class="hu-lista" data-hu-lista><div class="hu-vazio">Carregando…</div></div>`
    await buscarHU()
}

function limparFiltrosHU() {
    estadoHU.filtros = { busca: '', quem: 'pessoas', tabelas: [], usuarios: [], operacao: '', de: '', ate: '' }
    desenharAlteracoesHU(document.querySelector('[data-hu-corpo]'))
}

async function buscarHU(mais = false) {
    const lista = document.querySelector('[data-hu-lista]')
    if (!lista) return
    estadoHU.pagina = mais ? estadoHU.pagina + 1 : 1
    if (!mais) lista.innerHTML = '<div class="hu-vazio">Carregando…</div>'
    try {
        const r = await apiVersoes('lista', { ...estadoHU.filtros, pagina: estadoHU.pagina, por: estadoHU.por })
        estadoHU.itens = mais ? [...estadoHU.itens, ...r.itens] : r.itens
        estadoHU.total = r.total
        estadoHU.podeRestaurar = r.podeRestaurar
        desenharListaHU()
    } catch (erro) {
        lista.innerHTML = `<div class="hu-vazio">${escHU(erro.message)}</div>`
    }
}

function cartaoVersaoHU(v, { mostrarRegistro = true } = {}) {
    const [acao, classe] = ACAO_HU[v.operacao] || ['Alterou', '']
    const origem = origemHU(v)
    // Itens do orçamento mudam em dois lugares (esquema e itens gerados): no cartão aparece uma vez.
    const vistos = new Set()
    const linhas = (v.mudancas || []).map(m => {
        const html = `
        <div class="hu-mud">
            <span class="hu-campo">${escHU(nomeCampoHU(v.tabela, m.c))}</span>
            <span class="hu-antes">${valorHU(m.a, !('a' in m))}</span>
            <span class="hu-seta">→</span>
            <span class="hu-depois">${valorHU(m.d, !('d' in m))}</span>
        </div>`
        if (vistos.has(html)) return ''
        vistos.add(html)
        return html
    }).join('')
    const resto = (v.total_mudancas || 0) - (v.mudancas || []).length
    return `
        <div class="hu-cartao">
            <div class="hu-cartao-topo">
                <span class="hu-hora">${quandoHU(v.quando)}</span>
                <span class="hu-quem">${escHU(v.usuario || origem)}</span>
                <span class="hu-acao ${classe}">${acao}</span>
                ${mostrarRegistro ? `<span class="hu-tabela">${escHU(nomeTabelaHU(v.tabela))}</span>
                    <a class="hu-registro" onclick="abrirVersoesRegistro(${jsHU(v.tabela)}, ${jsHU(v.registro)})" title="Ver todas as versões deste registro">${escHU(v.rotulo || v.registro)}</a>` : ''}
                ${v.usuario && origem ? `<span class="hu-origem">${escHU(origem)}</span>` : ''}
                <span class="hu-espaco"></span>
                <button type="button" class="hu-btn" onclick="abrirVersaoHU(${Number(v.id)})">Detalhes${estadoHU.podeRestaurar ? ' / voltar' : ''}</button>
            </div>
            ${v.operacao === 'D' ? '<div class="hu-mud hu-nada">Registro apagado. A cópia completa ficou guardada (dá para trazer de volta).</div>' : ''}
            ${v.operacao === 'I' ? '<div class="hu-mud hu-nada">Registro criado.</div>' : ''}
            ${linhas}
            ${resto > 0 ? `<div class="hu-mais" onclick="abrirVersaoHU(${Number(v.id)})">+ ${resto} mudança${resto > 1 ? 's' : ''}…</div>` : ''}
        </div>`
}

function desenharListaHU() {
    const lista = document.querySelector('[data-hu-lista]')
    const resumo = document.querySelector('[data-hu-resumo]')
    if (!lista) return
    if (resumo) resumo.textContent = `${estadoHU.total.toLocaleString('pt-BR')} alteração(ões)` +
        (estadoHU.filtros.quem === 'pessoas' ? ' feitas por pessoas' : estadoHU.filtros.quem === 'sistema' ? ' automáticas' : '')
    if (!estadoHU.itens.length) {
        lista.innerHTML = '<div class="hu-vazio">Nada encontrado com esses filtros. As versões começaram a ser guardadas em 18/11/2026.</div>'
        return
    }
    let dia = ''
    let html = ''
    for (const v of estadoHU.itens) {
        const d = new Date(v.quando).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
        if (d !== dia) { dia = d; html += `<div class="hu-dia">${escHU(inicialMaiuscula(d))}</div>` }
        html += cartaoVersaoHU(v)
    }
    if (estadoHU.itens.length < estadoHU.total)
        html += `<button type="button" class="hu-carregar" onclick="buscarHU(true)">Carregar mais (${(estadoHU.total - estadoHU.itens.length).toLocaleString('pt-BR')} restantes)</button>`
    lista.innerHTML = html
}

// ---------------------------------------------------------------- detalhe e voltar

async function abrirVersaoHU(id) {
    overlayAguarde()
    let r
    try { r = await apiVersoes('detalhe', { id }) }
    catch (erro) { removerOverlay(); return popup({ mensagem: escHU(erro.message) }) }
    removerOverlay()
    const { versao: v, posteriores, podeRestaurar } = r
    const [acao] = ACAO_HU[v.operacao] || ['Alterou']
    const linhas = v.operacao === 'D'
        ? '<tr><td colspan="3" class="hu-nada">Registro apagado (a cópia completa está guardada).</td></tr>'
        : (v.mudancas || []).map(m => `
            <tr>
                <td>${escHU(nomeCampoHU(v.tabela, m.c))}<div class="hu-caminho">${escHU((m.c || []).join(' / '))}</div></td>
                <td class="hu-antes">${valorHU(m.a, !('a' in m))}</td>
                <td class="hu-depois">${valorHU(m.d, !('d' in m))}</td>
            </tr>`).join('') || '<tr><td colspan="3" class="hu-nada">Registro criado.</td></tr>'
    const outros = posteriores.length
        ? `<div class="hu-aviso">Depois desta, o registro teve mais ${posteriores.length} alteração(ões):
            ${posteriores.slice(0, 8).map(p => `${escHU(p.usuario || origemHU(p))} (${quandoHU(p.quando)})`).join(', ')}${posteriores.length > 8 ? '…' : ''}.
            Voltar desfaz essas também.</div>` : ''
    const botoes = podeRestaurar ? `
        <div class="hu-acoes">
            <button type="button" onclick="voltarVersaoHU(${Number(v.id)}, true)"
                title="O registro fica como estava logo antes desta alteração">${v.operacao === 'I' ? 'Desfazer a criação (apagar)' : v.operacao === 'D' ? 'Trazer de volta' : 'Desfazer esta alteração'}</button>
            ${v.operacao !== 'D' && posteriores.length ? `<button type="button" onclick="voltarVersaoHU(${Number(v.id)}, false)"
                title="O registro fica como estava logo depois desta alteração">Voltar para como ficou aqui</button>` : ''}
        </div>` : ''
    popup({
        titulo: `${acao} · ${nomeTabelaHU(v.tabela)} ${v.rotulo || v.registro}`,
        elemento: `
            <div class="hu-detalhe">
                <div class="hu-detalhe-topo">
                    <span><b>${escHU(v.usuario || origemHU(v))}</b> em ${quandoHU(v.quando)}</span>
                    ${v.usuario && origemHU(v) ? `<span class="hu-origem">${escHU(origemHU(v))}</span>` : ''}
                    <a class="hu-registro" onclick="abrirVersoesRegistro(${jsHU(v.tabela)}, ${jsHU(v.registro)})">Todas as versões deste registro</a>
                </div>
                <table class="hu-tabela-mud">
                    <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
                ${podeRestaurar ? outros : ''}
                ${botoes}
            </div>`
    })
}

async function voltarVersaoHU(id, antes) {
    const ok = await confirmarPopup({
        titulo: 'Voltar versão',
        mensagem: antes
            ? 'O registro volta a ficar como estava <b>antes</b> desta alteração (ela e as seguintes são desfeitas).<br><br>Isso não desfaz o que já aconteceu em outros lugares (notas emitidas, pagamentos no Omie, saldos já abatidos). A volta também fica registrada como uma versão nova.'
            : 'O registro volta a ficar como estava <b>logo depois</b> desta alteração (as seguintes são desfeitas).<br><br>Isso não desfaz o que já aconteceu em outros lugares (notas emitidas, pagamentos no Omie, saldos já abatidos). A volta também fica registrada como uma versão nova.',
        textoConfirmar: 'Voltar'
    })
    if (!ok) return
    overlayAguarde()
    try {
        await apiVersoes('restaurar', { id, antes })
        removerOverlay()
        removerTodosPopups()
        popup({ mensagem: 'Pronto: o registro voltou para a versão escolhida.' })
        if (estadoHU.aba === 'alteracoes' && document.querySelector('[data-hu-lista]')) buscarHU()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: escHU(erro.message) })
    }
}

// Linha do tempo de um registro (também chamada de outras telas).
async function abrirVersoesRegistro(tabela, registro) {
    overlayAguarde()
    let r
    try { r = await apiVersoes('registro', { tabela, registro }) }
    catch (erro) { removerOverlay(); return popup({ mensagem: escHU(erro.message) }) }
    removerOverlay()
    estadoHU.podeRestaurar = r.podeRestaurar
    popup({
        titulo: `Versões · ${nomeTabelaHU(tabela)} ${r.rotulo || registro}`,
        elemento: `
            <div class="hu-linha-tempo">
                ${r.itens.map(v => cartaoVersaoHU(v, { mostrarRegistro: false })).join('')
                    || '<div class="hu-vazio">Nenhuma versão guardada deste registro (as versões começaram em 18/11/2026).</div>'}
            </div>`
    })
}

// ---------------------------------------------------------------- uso do sistema (logs_rotas)

async function dailyUso(corpo) {

    try {

        overlayAguarde()

        const { criadores } = await recuperarDado('mvw_opcoes_filtros', 1) || {}

        const dropdownUsuarios = montarDropdownCheckbox({
            titulo: 'Usuários',
            pag: 'daily',
            path: 'usuario',
            opcoes: criadores || []
        })

        const tabela = await modTab({
            btnExtras: dropdownUsuarios,
            base: 'logs_rotas',
            pag: 'daily',
            body: 'bodyDaily',
            funcaoAdicional: ['graficoMapaCalor'],
            criarLinha: 'linDaily',
            filtros: {
                'rota': { op: '!=', value: '/acesso' }
            },
            colunas: {
                'Usuário': { chave: 'usuario' },
                'Data': { chave: 'data', tipoPesquisa: 'data' },
                'Tabela': { chave: 'body.caminho' },
                'Detalhes': {}
            }
        })

        corpo.innerHTML = `
            <div class="daily">
                <div class="pagina-conteudo">
                ${tabela}
            </div>
                <div class="mapa-calor">
                    <h2>Dias x Horários de maior uso do GCS</h2>
                </div>
            </div>`

        await paginacao()

        removerOverlay()

    } catch (err) {
        console.error(err)
        removerOverlay()
        popup({ mensagem: 'Falha ao abrir o histórico de Uso: Fale com o suporte.' })
    }

}


function resumirValor(body) {
    const { valor, caminho } = body || {}

    // Desde 18/11/2026 o conteúdo das gravações fica nas versões (aba Alterações).
    if (body?.versionado)
        return 'O que mudou está na aba Alterações'

    if (!valor)
        return ''

    if (valor === 'string')
        return valor

    if (caminho.includes('/tags'))
        return 'Alterou a tag'

    if (caminho.includes('postit/'))
        return ''

    if (caminho.includes('historico/') && valor?.justificativa == 'ok')
        return 'Aprovou um pagamento'

    const candidatos = [
        valor,
        valor.para,
        valor.titulo,
        valor.nome,
        valor.descricao,
        valor.comentario,
        valor.pedido,
        valor.contrato,
        valor.chamado,
        valor.codigo
    ].filter(v => typeof v === 'string' || typeof v === 'number')

    const principal = candidatos.find(v => String(v).trim())
    if (principal)
        return String(principal).trim()

    return ''
}

function traducaoLog({ body, rota }) {

    const { caminho = '' } = body || {}
    const partes = caminho.split('/')
    const tabela = inicialMaiuscula(partes[0])

    let traducao = ''

    if (rota == '/salvar') {

        traducao = `Editou • ${tabela}`

    } else if (rota == '/deletar') {

        traducao = `Apagou • ${tabela}`

    } else if (rota == '/excel') {

        traducao = `Baixou um relatório em Excel`

    }

    return traducao || rota

}

function linDaily(dados) {

    const { id, usuario, data, body } = dados || {}

    const traducao = traducaoLog(dados)
    const valorResumido = resumirValor(body)
    const tabela = inicialMaiuscula(body?.caminho?.split('/')?.[0] || '')

    const tr = `
        <tr>
            <td>
                <div style="${vertical};gap: 1rem;">
                    <span>${usuario}</span>
                    <span style="color: #ff2022;">${id}</span>
                </div>
            </td>
            <td>${data}</td>
            <td>${tabela}</td>
            <td>    
                <div style="${vertical}; gap: 1rem;">
                    <span><b>${traducao}</b></span>
                    <div style="white-space: pre-wrap;">${valorResumido}</div>
                </div>
            </td>
        </tr>
    `

    return tr

}

function obterMesAnoFiltroDaily() {
    const filtrosData = controles?.daily?.filtros?.data || []
    const hoje = dataServidor()

    let dataInicial = null
    let dataFinal = null

    for (const item of filtrosData) {
        if (!item?.value) continue

        if (item.op === '>=d') dataInicial = item.value
        if (item.op === '<=d') dataFinal = item.value
    }

    const dataBase = dataInicial || dataFinal

    if (!dataBase) {
        return {
            mes: hoje.getMonth() + 1,
            ano: hoje.getFullYear(),
            dataInicial: null,
            dataFinal: null
        }
    }

    const [ano, mes] = String(dataBase).split('-').map(Number)

    return {
        mes,
        ano,
        dataInicial,
        dataFinal
    }
}

async function graficoMapaCalor() {
    const filtros = controles?.daily?.filtros || {}
    const { mes, ano, dataInicial, dataFinal } = obterMesAnoFiltroDaily()

    const contagem = await contarPorCampo({
        base: 'logs_rotas',
        filtros,
        path: 'data'
    })

    const mapaCalor = document.querySelector('.mapa-calor')
    if (!mapaCalor) return

    const titulo = mapaCalor.querySelector('h2')
    if (titulo) {
        titulo.textContent = dataInicial || dataFinal
            ? `Dias x Horários de maior uso do GCS (${dataInicial || '...'} até ${dataFinal || '...'})`
            : 'Dias x Horários de maior uso do GCS'
    }

    if (!document.getElementById('chart-mapa-calor')) {
        mapaCalor.insertAdjacentHTML('beforeend', `<div id="chart-mapa-calor"></div>`)
    }

    const series = montarSeriesMapaCalor(contagem, mes, ano)
    const ranges = criarFaixasCor(series)

    if (chartMapaCalor) chartMapaCalor.destroy()

    chartMapaCalor = new ApexCharts(
        document.querySelector('#chart-mapa-calor'),
        {
            chart: {
                type: 'heatmap',
                height: 220 + (series.length * 12),
                toolbar: { show: false }
            },
            series,
            dataLabels: {
                enabled: false
            },
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0,
                    colorScale: { ranges }
                }
            },
            stroke: {
                width: 1,
                colors: ['#ddd']
            },
            xaxis: {
                type: 'category',
                categories: Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, '0')}h`),
                labels: { rotate: 0 }
            },
            yaxis: {
                reversed: true
            },
            tooltip: {
                y: {
                    formatter: value => value || 0
                }
            },
            legend: {
                show: false
            }
        }
    )

    chartMapaCalor.render()
}

function criarFaixasCor(series) {
    const valores = series
        .flatMap(linha => linha.data.map(p => Number(p.y || 0)))
        .filter(v => v > 0)

    if (!valores.length) {
        return [
            {
                from: 0,
                to: 0,
                color: '#ffffff',
                name: 'Sem dados'
            }
        ]
    }

    const min = Math.min(...valores)
    const max = Math.max(...valores)

    if (min === max) {
        return [
            {
                from: 0,
                to: 0,
                color: '#ffffff',
                name: '0'
            },
            {
                from: min,
                to: max,
                color: '#ff0000',
                name: String(max)
            }
        ]
    }

    const faixas = 6
    const passo = (max - min) / faixas

    const ranges = [
        {
            from: 0,
            to: 0,
            color: '#ffffff',
            name: '0'
        }
    ]

    for (let i = 0; i < faixas; i++) {
        const from = i === 0 ? min : (min + passo * i)
        const to = i === faixas - 1 ? max : (min + passo * (i + 1))

        const intensidade = (i + 1) / faixas
        const verdeAzul = Math.round(255 * (1 - intensidade))

        ranges.push({
            from,
            to,
            color: `rgb(255, ${verdeAzul}, ${verdeAzul})`,
            name: `${Math.round(from)} - ${Math.round(to)}`
        })
    }

    return ranges
}

function montarSeriesMapaCalor(dados, mes, ano) {
    const diasNoMes = new Date(ano, mes, 0).getDate()
    const horaInicio = 5
    const horaFim = 23
    const mapa = {}

    for (const [dataHora, qtde] of Object.entries(dados || {})) {
        if (!dataHora)
            continue

        const [data = '', hora = ''] = String(dataHora).split(', ')
        const [dia, mesRegistro, anoRegistro] = data.split('/').map(Number)
        const horaNumero = Number((hora.split(':')[0] || 0))

        if (
            !dia ||
            !mesRegistro ||
            !anoRegistro ||
            Number.isNaN(horaNumero) ||
            mesRegistro !== mes ||
            anoRegistro !== ano ||
            horaNumero < horaInicio ||
            horaNumero > horaFim
        ) continue

        mapa[dia] ??= {}
        mapa[dia][horaNumero] = (mapa[dia][horaNumero] || 0) + Number(qtde || 0)
    }

    return Array.from({ length: diasNoMes }, (_, i) => {
        const dia = i + 1

        return {
            name: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`,
            data: Array.from({ length: horaFim - horaInicio + 1 }, (_, j) => {
                const hora = horaInicio + j
                return {
                    x: `${String(hora).padStart(2, '0')}h`,
                    y: mapa?.[dia]?.[hora] || 0
                }
            })
        }
    })
}

function criarFaixasCor(series) {
    const valores = series.flatMap(linha => linha.data.map(p => p.y))
    const max = Math.max(...valores, 0)

    if (max <= 0) {
        return [{
            from: 0,
            to: 0,
            color: '#ffffff',
            name: 'Sem dados'
        }]
    }

    const faixas = 6
    const passo = Math.ceil(max / faixas)

    return Array.from({ length: faixas }, (_, i) => {
        const from = i * passo
        const to = i === faixas - 1 ? max : ((i + 1) * passo) - 1
        const intensidade = (i + 1) / faixas
        const verdeAzul = Math.round(255 * (1 - intensidade))

        return {
            from,
            to,
            color: `rgb(255, ${verdeAzul}, ${verdeAzul})`,
            name: `${from} - ${to}`
        }
    })
}