// ---------------- Documentos do RH: tela por funcionário ----------------
// Visões: Por pessoa (tabela com "+" que abre as pastas CONTÁBIL, PESSOAL e CERTIFICADOS, com os
// documentos arrastáveis entre elas), Por documento (lista plana) e Hierarquia (por gestor).
// Dados: vw_documentos (documentos) + vw_2_clientes com a tag FUNCIONÁRIO (quem ainda não tem
// documento também aparece). Tudo carregado de uma vez e filtrado no navegador.
// Banco (migrations/rh-pastas-hierarquia.sql): documentos.pasta, rh_documentos_regras.pasta e
// clientes.gestor. Sem essas colunas a tela funciona com a pasta padrão por tipo (PASTA_PADRAO_RH).
const PASTAS_RH = ['CONTÁBIL', 'PESSOAL', 'CERTIFICADOS']
const OBRIGATORIOS_RH = ['ASO', 'PTA', 'NR 06 - EPI', 'FICHA DE EPI', 'NR 10', 'NR 35']
const DIAS_AVISO_RH = 30
// mostrarDesligados: por padrão a tela esconde quem está desligado (clientes.desligado).
const estadoRH = { visao: 'pessoa', busca: '', situacao: 'todos', mostrarDesligados: false, abertos: new Set(), pessoas: [], porId: new Map(), documentos: [], carregando: 0, acessoPastas: new Map() }

// Pasta padrão por tipo (a mesma que a migração grava em rh_documentos_regras.pasta).
function pastaPadraoRH(tipo) {
    const t = String(tipo || '').toUpperCase()
    if (/^NR /.test(t) || ['PTA', 'APR'].includes(t)) return 'CERTIFICADOS'
    if (['ASO', 'FICHA DE EPI'].includes(t)) return 'PESSOAL'
    return null
}

const normalizarRH = texto => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const digitosRH = texto => String(texto || '').replace(/\D/g, '')

// Situação de um documento: verde (em dia ou sem vencimento), laranja (vence em até 30 dias),
// vermelho (vencido). Os dias de atraso ficam no título da bolinha, não na linha.
function situacaoDocumentoRH({ prazo, validadeData }, hoje = dataServidor()) {
    if (!Number(prazo) || !validadeData) return { cor: 'verde', texto: 'Sem vencimento', dias: null }
    const validade = new Date(`${String(validadeData).slice(0, 10)}T12:00:00`)
    const base = new Date(hoje); base.setHours(12, 0, 0, 0)
    const dias = Math.round((validade - base) / 86400000)
    if (dias < 0) return { cor: 'vermelho', texto: `Vencido há ${-dias} dia(s)`, dias }
    if (dias <= DIAS_AVISO_RH) return { cor: 'laranja', texto: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`, dias }
    return { cor: 'verde', texto: `Em dia (vence em ${dias} dias)`, dias }
}

const PESO_COR_RH = { vermelho: 3, laranja: 2, verde: 1 }
const bolinhaRH = ({ cor, texto }) => `<span class="rh-bolinha ${cor}" title="${escaparAtributo(texto)}" aria-label="${escaparAtributo(texto)}"></span>`
const dataBRDeISO = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''

async function pesquisarTodosRH(base, filtros = {}) {
    const resultados = []
    let pagina = 1, paginas = 1
    do {
        const resposta = await pesquisarDB({ base, filtros, pagina, limite: 500 })
        resultados.push(...(resposta?.resultados || []))
        paginas = Number(resposta?.paginas) || 1
        pagina++
    } while (pagina <= paginas)
    return resultados
}

// Monta pessoas e documentos (puro: testado em tests/rh-pastas.test.cjs).
// Obrigatórios (OBRIGATORIOS_RH) só para técnicos: cadastro com a tag TÉCNICO (ids em tecnicos).
function temTagRH(cadastro, tag) {
    let tags = cadastro?.tags
    if (typeof tags === 'string') try { tags = JSON.parse(tags) } catch { tags = [] }
    return Array.isArray(tags) && tags.some(t => String(t?.tag ?? t).toUpperCase() === tag)
}

function montarDadosRH(documentosBrutos = [], funcionarios = [], hoje = dataServidor(), tecnicos = new Set()) {
    const pessoas = new Map()
    const pessoa = (id, dados = {}) => {
        const chave = String(id)
        const atual = pessoas.get(chave) || { id: chave, documentos: [] }
        for (const campo of ['nome', 'cargo', 'cnpj', 'estado', 'cidade', 'foto', 'gestor', 'desligado', 'setor'])
            if (atual[campo] == null && dados[campo] != null && dados[campo] !== '') atual[campo] = dados[campo]
        pessoas.set(chave, atual)
        return atual
    }
    for (const f of funcionarios) {
        pessoa(f.id, f)
        if (temTagRH(f, 'TÉCNICO')) tecnicos.add(String(f.id))
    }

    const documentos = documentosBrutos
        .filter(d => !d.excluido && d.funcionario != null)
        .map(d => {
            const doc = {
                id: d.id, doc: d.doc, funcionario: String(d.funcionario), anexo: d.anexo && typeof d.anexo === 'object' ? d.anexo : {},
                realizado: d.realizado || '', validade: d.validade || '', validadeData: d.validadeData, prazo: d.prazo,
                pasta: d.pasta || d.pasta_padrao || pastaPadraoRH(d.doc)
            }
            doc.situacao = situacaoDocumentoRH(doc, hoje)
            pessoa(d.funcionario, d).documentos.push(doc)
            return doc
        })

    for (const p of pessoas.values()) {
        p.documentos.sort((a, b) => String(nomeDocRH(a)).localeCompare(String(nomeDocRH(b)), 'pt-BR'))
        const tipos = new Set(p.documentos.filter(d => d.doc).map(d => String(d.doc).toUpperCase()))
        p.tecnico = tecnicos.has(p.id)
        p.faltantes = p.desligado || !p.tecnico ? [] : OBRIGATORIOS_RH.filter(t => !tipos.has(t))
        const pior = p.documentos.reduce((a, d) => PESO_COR_RH[d.situacao.cor] > PESO_COR_RH[a.cor] ? d.situacao : a, { cor: 'verde', texto: 'Em dia' })
        p.situacao = p.faltantes.length && pior.cor === 'verde'
            ? { cor: 'laranja', texto: `Faltam: ${p.faltantes.join(', ')}` }
            : pior.cor === 'verde' ? { cor: 'verde', texto: 'Documentos em dia' } : { ...pior, texto: `${pior.texto} · ${p.documentos.filter(d => d.situacao.cor === pior.cor).map(d => d.doc).join(', ')}` }
        p.proximoVencimento = p.documentos
            .filter(d => Number(d.prazo) && d.validadeData)
            .sort((a, b) => String(a.validadeData).localeCompare(String(b.validadeData)))[0] || null
    }

    const lista = [...pessoas.values()].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
    return { pessoas: lista, porId: pessoas, documentos }
}

async function telaRH() {
    tela.innerHTML = `
        <div class="tela-rh2">
            <div class="rh2-topo">
                <div class="rh2-visoes" role="tablist" aria-label="Visão">
                    ${[['pessoa', 'Por pessoa'], ['documento', 'Por documento'], ['hierarquia', 'Hierarquia'], ['ficha', 'Ficha']].map(([valor, texto]) => `
                        <button type="button" data-visao="${valor}" class="${estadoRH.visao === valor ? 'ativo' : ''}" onclick="trocarVisaoRH('${valor}')">${texto}</button>`).join('')}
                </div>
                <input type="search" class="rh2-busca" placeholder="Buscar nome, CPF/CNPJ, cidade ou documento" value="${escaparAtributo(estadoRH.busca)}"
                    oninput="estadoRH.busca = this.value; renderizarRH()">
                <select class="rh2-situacao" onchange="estadoRH.situacao = this.value; renderizarRH()">
                    ${[['todos', 'Todas as situações'], ['vermelho', 'Vencidos'], ['laranja', 'A vencer / faltando'], ['verde', 'Em dia']].map(([v, t]) => `<option value="${v}" ${estadoRH.situacao === v ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <label class="rh2-mostrar-desligados"><input type="checkbox" ${estadoRH.mostrarDesligados ? 'checked' : ''} onchange="estadoRH.mostrarDesligados = this.checked; renderizarRH()"> Mostrar desligados</label>
                <button type="button" class="rh-filtro-tempo rh-adicionar" onclick="incluirDocumento()">Documento</button>
            </div>
            <div class="rh2-legenda">
                ${bolinhaRH({ cor: 'verde', texto: 'Em dia' })} Em dia
                ${bolinhaRH({ cor: 'laranja', texto: 'Vence em até 30 dias' })} Vence em até ${DIAS_AVISO_RH} dias / faltando obrigatório
                ${bolinhaRH({ cor: 'vermelho', texto: 'Vencido' })} Vencido
            </div>
            <div class="rh2-conteudo"><p class="rh2-vazio">Carregando documentos…</p></div>
        </div>`
    await carregarRH()
}

async function carregarRH() {
    const consulta = ++estadoRH.carregando
    try {
        const [documentos, funcionarios, tecnicos, acessoPastas] = await Promise.all([
            pesquisarTodosRH('vw_documentos'),
            pesquisarTodosRH('vw_2_clientes', { tags: { op: 'includes', value: 'FUNCIONÁRIO' } }),
            // Técnicos sem a tag FUNCIONÁRIO também têm obrigatórios (só os ids importam).
            pesquisarTodosRH('vw_2_clientes', { tags: { op: 'includes', value: 'TÉCNICO' } }),
            // Cadeado das pastas (sem a base ainda no servidor: todas livres).
            pesquisarTodosRH('rh_pastas_acesso').catch(() => []),
            // Ficha (exames, EPIs, ambiente, salário): js/rh_ficha.js. Falha não derruba os documentos.
            typeof carregarFichaRH === 'function' ? carregarFichaRH().catch(erro => console.error('[RH] ficha', erro)) : null
        ])
        if (consulta !== estadoRH.carregando) return
        const idsTecnicos = new Set(tecnicos.filter(t => !t.excluido && temTagRH(t, 'TÉCNICO')).map(t => String(t.id)))
        estadoRH.acessoPastas = new Map((acessoPastas || []).map(a => [String(a.id), a]))
        Object.assign(estadoRH, montarDadosRH(documentos, funcionarios.filter(f => !f.excluido), dataServidor(), idsTecnicos))
        renderizarRH()
    } catch (erro) {
        console.error('[RH] carregar', erro)
        const conteudo = document.querySelector('.tela-rh2 .rh2-conteudo')
        if (conteudo) conteudo.innerHTML = '<button type="button" onclick="carregarRH()">Falha ao carregar os documentos. Tentar de novo</button>'
    }
}

function trocarVisaoRH(visao) {
    estadoRH.visao = visao
    document.querySelectorAll('.rh2-visoes button').forEach(b => b.classList.toggle('ativo', b.dataset.visao === visao))
    renderizarRH()
}

function pessoaCombinaRH(p, termo, termoDigitos) {
    if (!termo) return true
    return normalizarRH([p.nome, p.cargo, p.cidade, p.estado, ...p.documentos.map(nomeDocRH)].join(' ')).includes(termo)
        || (termoDigitos.length >= 3 && digitosRH(p.cnpj).includes(termoDigitos))
}

function pessoasFiltradasRH() {
    const termo = normalizarRH(estadoRH.busca).trim()
    const termoDigitos = digitosRH(estadoRH.busca)
    return estadoRH.pessoas.filter(p => (estadoRH.mostrarDesligados || !p.desligado) && pessoaCombinaRH(p, termo, termoDigitos)
        && (estadoRH.situacao === 'todos' || p.situacao.cor === estadoRH.situacao))
}

function renderizarRH() {
    const conteudo = document.querySelector('.tela-rh2 .rh2-conteudo')
    if (!conteudo) return
    if (estadoRH.visao === 'documento') return conteudo.innerHTML = tabelaDocumentosRH()
    // Ficha (js/rh_ficha.js): mesma busca e desligados; o filtro de situação usa a situação da ficha.
    if (estadoRH.visao === 'ficha') {
        const termo = normalizarRH(estadoRH.busca).trim(), termoDigitos = digitosRH(estadoRH.busca)
        return conteudo.innerHTML = telaFichaRH(estadoRH.pessoas.filter(p => (estadoRH.mostrarDesligados || !p.desligado) && pessoaCombinaRH(p, termo, termoDigitos)))
    }
    if (estadoRH.visao === 'hierarquia') {
        conteudo.innerHTML = hierarquiaRH()
        return alinharLinhasHierarquiaRH(conteudo)
    }
    conteudo.innerHTML = tabelaPessoasRH()
}

// Foto clicável: abre o cadastro da pessoa (formularioCliente, js/clientes.js).
const fotoPessoaRH = p => `
    <button type="button" class="rh2-foto-botao" data-cliente="${escaparAtributo(p.id)}" title="Abrir cadastro" onclick="formularioCliente(Number(this.dataset.cliente))">
        <img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(p.foto))}" alt="Abrir cadastro de ${escaparAtributo(p.nome || '')}" loading="lazy" onerror="this.onerror = null; this.src = logo">
    </button>`
const nomePessoaRH = p => `
    <div class="rh2-nome">
        <b>${escaparAtributo(p.nome || 'Sem nome')}</b>
        ${p.desligado ? etiquetaDesligado(p.desligado) : ''}
        ${p.cargo ? `<small>${escaparAtributo(p.cargo)}</small>` : ''}
    </div>`

function tabelaPessoasRH() {
    const pessoas = pessoasFiltradasRH()
    if (!pessoas.length) return '<p class="rh2-vazio">Nenhum funcionário neste filtro.</p>'
    const linhas = pessoas.map(p => {
        const aberto = estadoRH.abertos.has(p.id)
        const gestor = p.gestor ? estadoRH.porId.get(String(p.gestor)) : null
        return `
            <tr class="rh2-pessoa ${aberto ? 'aberta' : ''}" data-pessoa="${escaparAtributo(p.id)}">
                <td><button type="button" class="rh2-mais" aria-expanded="${aberto}" title="${aberto ? 'Fechar' : 'Ver documentos'}" onclick="alternarPessoaRH('${escaparAtributo(p.id)}')">${aberto ? '−' : '+'}</button></td>
                <td>${fotoPessoaRH(p)}</td>
                <td style="text-align: left;">${nomePessoaRH(p)}</td>
                <td>${escaparAtributo(p.cnpj || '—')}</td>
                <td>${escaparAtributo(p.estado || '—')}</td>
                <td>${escaparAtributo(p.cidade || '—')}</td>
                <td>${escaparAtributo(gestor?.nome || '—')}</td>
                <td>${p.documentos.length}</td>
                <td style="text-align: left;"><div class="rh2-situacao-celula">${bolinhaRH(p.situacao)}<span>${p.proximoVencimento ? escaparAtributo(p.proximoVencimento.validade) : '—'}</span></div></td>
            </tr>
            ${aberto ? `<tr class="rh2-detalhe"><td colspan="9">${detalhePessoaRH(p)}</td></tr>` : ''}`
    }).join('')
    return `
        <div class="rh2-tabela">
            <table>
                <thead><tr><th></th><th></th><th style="text-align: left;">Funcionário</th><th>CPF/CNPJ</th><th>Estado</th><th>Cidade</th><th>Gestor</th><th>Docs</th><th title="Próximo vencimento" style="text-align: left;">Vencimento</th></tr></thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>
        <p class="rh2-rodape">${pessoas.length} funcionário(s)</p>`
}

function alternarPessoaRH(id) {
    estadoRH.abertos.has(id) ? estadoRH.abertos.delete(id) : estadoRH.abertos.add(id)
    renderizarRH()
}

// ---------------- Baixar a pasta em .zip ----------------
// Monta o zip no navegador (JSZip, carregado no index.html) com todos os anexos da pasta da pessoa.
// Os arquivos vêm de /uploads com o token do usuário; o servidor já não entrega documento de pasta
// restrita a quem não tem acesso, então o zip só tem o que a pessoa pode ver.
// Arquivo: "NOME - PASTA.zip", com uma pasta "NOME" dentro; documento com tipo leva o tipo no nome.
function botaoZipPastaRH(idPessoa, pasta, quantidade) {
    const titulo = `Baixar os ${quantidade} arquivo(s) desta pasta em .zip`
    return `
        <button type="button" class="rh2-zip" data-pessoa="${escaparAtributo(idPessoa)}" data-pasta="${escaparAtributo(pasta)}"
            title="${escaparAtributo(titulo)}" aria-label="${escaparAtributo(titulo)}" onclick="event.stopPropagation(); baixarPastaRH(this.dataset.pessoa, this.dataset.pasta)">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11"/>
            </svg>
        </button>`
}

const nomeArquivoSeguroRH = texto => String(texto || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'arquivo'

async function baixarPastaRH(idPessoa, pasta) {
    const p = estadoRH.porId.get(String(idPessoa))
    if (!p) return
    const docs = (pasta === 'SEM PASTA' ? p.documentos.filter(d => !PASTAS_RH.includes(d.pasta)) : p.documentos.filter(d => d.pasta === pasta))
        .filter(d => d.anexo?.link)
    if (!docs.length) return popup({ mensagem: 'Esta pasta não tem arquivos para baixar.' })
    if (typeof JSZip !== 'function') return popup({ mensagem: 'Não foi possível montar o .zip (biblioteca não carregada). Recarregue a página.' })

    overlayAguarde()
    const nomePessoa = nomeArquivoSeguroRH(p.nome || `Funcionário ${p.id}`)
    const zip = new JSZip()
    const pastaZip = zip.folder(nomePessoa)
    const usados = new Set()
    const falhas = []
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}

    for (const d of docs) {
        const original = d.anexo.nome || d.anexo.link
        const extensao = (/\.[a-z0-9]{1,6}$/i.exec(original) || /\.[a-z0-9]{1,6}$/i.exec(d.anexo.link) || [''])[0]
        const base = nomeArquivoSeguroRH(d.doc ? `${d.doc} - ${original.replace(/\.[a-z0-9]{1,6}$/i, '')}` : original.replace(/\.[a-z0-9]{1,6}$/i, ''))
        let nome = `${base}${extensao}`
        for (let n = 2; usados.has(nome.toLowerCase()); n++) nome = `${base} (${n})${extensao}`
        usados.add(nome.toLowerCase())
        try {
            const resposta = await fetch(`${api}/uploads/${encodeURIComponent(d.anexo.link)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: 'include'
            })
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
            pastaZip.file(nome, await resposta.blob())
        } catch (erro) {
            falhas.push(`${nomeDocRH(d)} (${erro.message})`)
        }
    }

    try {
        if (falhas.length === docs.length) throw new Error('nenhum arquivo pôde ser baixado')
        const blob = await zip.generateAsync({ type: 'blob' })
        const url = URL.createObjectURL(blob)
        const link = Object.assign(document.createElement('a'), { href: url, download: `${nomePessoa} - ${nomeArquivoSeguroRH(pasta)}.zip` })
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
        removerOverlay()
        if (falhas.length)
            popup({ mensagem: `Zip baixado, mas ${falhas.length} arquivo(s) não vieram:<br>${falhas.map(escaparAtributo).join('<br>')}` })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: `Não foi possível baixar a pasta: ${escaparAtributo(erro.message)}${falhas.length ? `<br>${falhas.map(escaparAtributo).join('<br>')}` : ''}` })
    }
}

// Detalhe (+): as 3 pastas com os documentos (arrastáveis entre elas), obrigatórios faltando e gestor.
function detalhePessoaRH(p) {
    const semPasta = p.documentos.filter(d => !PASTAS_RH.includes(d.pasta))
    const pastas = [...PASTAS_RH, ...(semPasta.length ? ['SEM PASTA'] : [])]
    const gestor = p.gestor ? estadoRH.porId.get(String(p.gestor)) : null
    return `
        <div class="rh2-pastas">
            ${pastas.map(pasta => {
                const docs = pasta === 'SEM PASTA' ? semPasta : p.documentos.filter(d => d.pasta === pasta)
                return `
                <div class="rh2-pasta ${pasta === 'SEM PASTA' ? 'sem-pasta' : ''}" data-pasta="${escaparAtributo(pasta)}" data-pessoa="${escaparAtributo(p.id)}"
                    ondragover="sobrePastaRH(event, this)"
                    ondragleave="if (!this.contains(event.relatedTarget)) this.classList.remove('soltar')"
                    ondrop="soltarDocumentoPastaRH(event, this)">
                    <div class="rh2-pasta-titulo"><span aria-hidden="true">📁</span> ${escaparAtributo(pasta)} ${pasta === 'SEM PASTA' ? '' : botaoCadeadoRH(pasta)}
                        ${podeVerPastaRH(pasta) && docs.some(d => d.anexo?.link) ? botaoZipPastaRH(p.id, pasta, docs.filter(d => d.anexo?.link).length) : ''}
                        <small>${podeVerPastaRH(pasta) ? docs.length : '—'}</small></div>
                    ${podeVerPastaRH(pasta) ? listaArquivosRH(docs) : '<small class="rh2-pasta-vazia rh2-pasta-restrita">Pasta restrita: você não tem acesso ao conteúdo.</small>'}
                </div>`
            }).join('')}
        </div>
        <div class="rh2-detalhe-rodape">
            ${p.faltantes.length ? `<span class="rh-pendencia-titulo">Faltam (obrigatórios):</span> ${p.faltantes.map(d => `<span class="docs-faltantes">${escaparAtributo(d)}</span>`).join('')}` : p.tecnico ? '<span class="rh-sem-pendencias">Obrigatórios registrados</span>' : '<span class="rh2-arq-cinza">Sem documentos obrigatórios (não é técnico)</span>'}
            <span class="rh2-gestor">Gestor: <button type="button" class="rh2-gestor-botao" onclick="escolherGestorRH('${escaparAtributo(p.id)}')">${escaparAtributo(gestor?.nome || 'Definir gestor')}</button></span>
            <button type="button" class="rh-filtro-tempo" data-funcionario="${escaparAtributo(p.id)}" onclick="incluirDocumento(null, this.dataset.funcionario)">+ Documento</button>
        </div>
        ${typeof fichaPessoaRH === 'function' ? fichaPessoaRH(p, undefined, { compacto: true }) : ''}`
}

// Pasta no estilo "Detalhes" do Explorer do Windows: cabeçalho de colunas e uma linha por arquivo.
// Duplo clique abre o anexo; ✎ edita; a linha é arrastável entre pastas.
function listaArquivosRH(docs) {
    if (!docs.length) return '<small class="rh2-pasta-vazia">Arraste documentos ou arquivos do computador para cá</small>'
    return `
        <div class="rh2-arquivos" role="table">
            <div class="rh2-arq-cabecalho" role="row"><span>Nome</span><span>Feito em</span><span>Vence em</span><span></span></div>
            ${docs.map(cartaoDocumentoRH).join('')}
        </div>`
}

// Ícone de arquivo (folha com canto dobrado) na cor do tipo, como nos anexos (corTipoAnexo).
function iconeArquivoRH(anexo) {
    const nome = String(anexo?.nome || anexo?.link || '')
    const extensao = anexo?.link ? (nome.match(/\.([^.]+)$/)?.[1] || 'arq').toLowerCase() : ''
    const cor = anexo?.link ? corTipoAnexo(extensao) : '#b3bfb8'
    return `
        <span class="rh2-arq-icone ${anexo?.link ? '' : 'sem-anexo'}" style="--cor: ${cor}" aria-hidden="true">
            <svg viewBox="0 0 16 20" width="16" height="20"><path d="M1.5 1.5h8.5l4.5 4.5v12.5h-13z" fill="#fff" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" ${anexo?.link ? '' : 'stroke-dasharray="2 1.5"'}/><path d="M10 1.5v4.5h4.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            ${extensao ? `<b>${escaparAtributo(extensao.slice(0, 4))}</b>` : ''}
        </span>`
}

// Assinatura digital resumida num sinal ao lado do nome (o detalhe completo fica no título).
function marcaAssinaturaRH(anexo) {
    const html = assinaturaRH(anexo)
    if (!html) return ''
    const classe = html.match(/rh-assinatura (\w+)/)?.[1] || 'neutro'
    if (classe === 'neutro') return ''           // não verificado / não é PDF: sem sinal
    const titulo = html.match(/title="([^"]*)"/)?.[1] || ''
    const sinal = { ok: '✓', alerta: '!', erro: '✗', neutro: '…' }[classe] || '•'
    return `<span class="rh2-arq-assinatura ${classe}" title="Assinatura digital: ${titulo}">${sinal}</span>`
}

function cartaoDocumentoRH(d) {
    const link = d.anexo?.link
    const titulo = [nomeDocRH(d), d.doc && d.anexo?.nome ? `Arquivo: ${d.anexo.nome}` : '', link ? 'Duplo clique para abrir' : 'Sem anexo', d.situacao?.texto].filter(Boolean).join('\n')
    return `
        <div class="rh2-doc rh2-arq ${estadoRH.movido === d.id ? 'rh2-movido' : ''}" role="row" draggable="true" tabindex="0"
            data-doc="${escaparAtributo(d.id)}" data-pasta="${escaparAtributo(d.pasta || '')}" data-link="${escaparAtributo(link || '')}"
            title="${escaparAtributo(titulo)}"
            ondragstart="arrastarDocumentoRH(event, this)" ondragend="fimArrastarDocumentoRH()"
            ondblclick="if (this.dataset.link) abrirArquivo(this.dataset.link)"
            onkeydown="if (event.key === 'Enter' && this.dataset.link) abrirArquivo(this.dataset.link)">
            <span class="rh2-arq-nome">
                ${iconeArquivoRH(d.anexo)}
                <span class="rh2-arq-texto ${d.doc ? '' : 'sem-tipo'}">${escaparAtributo(nomeDocRH(d))}</span>
                ${marcaAssinaturaRH(d.anexo)}
            </span>
            <span class="rh2-arq-data">${escaparAtributo(d.realizado || '—')}</span>
            <span class="rh2-arq-data rh2-arq-vence">${Number(d.prazo) ? `${bolinhaRH(d.situacao)} ${escaparAtributo(d.validade || '—')}` : '<span class="rh2-arq-cinza">—</span>'}</span>
            <button type="button" class="rh2-arq-editar" data-doc="${escaparAtributo(d.id)}" onclick="event.stopPropagation(); incluirDocumento(this.dataset.doc)" title="Editar" aria-label="Editar"><img src="imagens/editar3.png" alt=""></button>
        </div>`
}

// Arquivo(s) do computador soltos numa pasta: cada arquivo vira um item daquela pasta do funcionário.
// PDF de ASO, ficha de EPI ou certificado é identificado (js/rh_leitor.js, destinoArquivoLidoRH): vira o
// documento do tipo, com a data lida, e os exames/EPIs vão para a Ficha. Se já havia um documento do tipo,
// o anterior continua na pasta como arquivo sem tipo (nada se perde); arquivo mais antigo que o atual ou de
// outra pessoa fica só como arquivo. O resto entra sem tipo, como sempre (o tipo pode ser definido no ✎).
async function salvarArquivosPastaRH(funcionario, pasta, arquivos) {
    overlayAguarde()
    const relatorio = []
    try {
        for (const arquivo of arquivos) {
            const enviados = await importarAnexos({ input: { files: [arquivo] } })   // erro: popup e não lista
            const anexo = Array.isArray(enviados) ? enviados[0] : null
            if (!anexo) throw new Error(`falha ao enviar ${arquivo.name}`)

            let leitura = null, destino = { acao: 'arquivo' }
            if (typeof lerArquivoRH === 'function' && ehPdfRH(arquivo)) {
                leitura = await lerArquivoRH(arquivo).catch(erro => (console.error('[RH] leitura', erro), null))
                destino = destinoArquivoLidoRH(leitura, { funcionario, pessoas: estadoRH.pessoas, documentos: estadoRH.documentos })
            }
            const tipado = destino.acao === 'tipado'

            // O documento atual do tipo vira arquivo sem tipo, na pasta em que já estava.
            if (tipado && destino.substitui) {
                const anterior = destino.substitui
                for (const [campo, valor] of [['pasta', anterior.pasta || pastaPadraoRH(anterior.doc)], ['doc', null]]) {
                    const resposta = await enviar(`documentos/${anterior.id}/${campo}`, valor)
                    if (!resposta?.success) throw new Error(resposta?.mensagem || 'falha ao guardar o documento anterior')
                }
            }

            const id = crypto.randomUUID()
            const resposta = await enviar(`documentos/${id}`, {
                id, funcionario: Number(funcionario), doc: tipado ? leitura.tipo : null, usuario: acesso.usuario,
                anexo, pasta, realizado: tipado ? leitura.data || '' : ''
            })
            if (!resposta?.success) throw new Error(resposta?.mensagem || 'falha ao salvar')

            const ficha = tipado ? await lancarLeituraNaFichaRH(leitura, funcionario).catch(() => ({ falhas: 1 })) : null
            relatorio.push({ nome: arquivo.name, leitura, destino, ficha })
        }
        const resumo = relatorioArquivosPastaRH(relatorio)
        // Pasta com cadeado sem acesso: o arquivo entra, mas some da vista de quem enviou.
        const restrita = pasta && !podeVerPastaRH(pasta)
            ? `<p>Arquivo enviado para a pasta ${escaparAtributo(pasta)}. Ela é restrita e você não tem acesso ao conteúdo dela.</p>` : ''
        if (resumo || restrita) popup({ titulo: 'Arquivos recebidos', mensagem: `${restrita}${resumo}` })
    } catch (erro) {
        popup({ mensagem: `Não foi possível salvar o arquivo: ${escaparAtributo(erro.message || 'erro desconhecido')}` })
    } finally {
        removerOverlay()
        carregarRH()
    }
}

// Resumo do arraste: só aparece quando algum arquivo foi identificado ou tem aviso.
function relatorioArquivosPastaRH(relatorio) {
    if (!relatorio.some(r => r.destino.acao === 'tipado' || r.destino.motivo)) return ''
    const linha = ({ nome, leitura, destino, ficha }) => {
        if (destino.acao === 'tipado') {
            const partes = [`virou <b>${escaparAtributo(leitura.tipo)}</b>${leitura.data ? ` de ${dataBRDeISO(leitura.data)}` : ' (sem data no arquivo: informe no ✎)'}`]
            if (ficha?.lancados) partes.push(`${ficha.lancados} lançamento(s) na Ficha`)
            if (ficha?.fora) partes.push(`${ficha.fora} item(ns) fora do catálogo da Ficha`)
            if (ficha?.falhas) partes.push(`${ficha.falhas} lançamento(s) não gravado(s)`)
            if (destino.substitui) partes.push(`o ${escaparAtributo(leitura.tipo)} anterior ficou na pasta como arquivo sem tipo`)
            return `<li class="rhl-ok">${escaparAtributo(nome)}: ${partes.join(' · ')}</li>`
        }
        return `<li class="${destino.alerta ? 'rhl-alerta' : ''}">${escaparAtributo(nome)}: guardado sem tipo${destino.motivo ? ` (${escaparAtributo(destino.motivo)})` : ''}</li>`
    }
    return `<ul class="rhl-relatorio">${relatorio.map(linha).join('')}</ul>`
}

// Nome mostrado: o tipo do documento ou, sem tipo, o nome do arquivo.
const nomeDocRH = d => d.doc || d.anexo?.nome || 'Arquivo'

// Arrastar documento: as pastas que aceitam ficam destacadas; a de origem e "Sem pasta" mostram que não pode soltar.
function arrastarDocumentoRH(event, cartao) {
    event.stopPropagation()
    event.dataTransfer.setData('text/plain', cartao.dataset.doc)
    event.dataTransfer.effectAllowed = 'move'
    estadoRH.arrastandoDoc = { id: cartao.dataset.doc, pasta: cartao.dataset.pasta }
    // Depois do frame: a "foto" do arrasto já foi tirada sem o esmaecido.
    requestAnimationFrame(() => {
        cartao.classList.add('rh2-arrastando')
        cartao.closest('.rh2-pastas')?.classList.add('rh2-arrastando-doc')
    })
}

function fimArrastarDocumentoRH() {
    estadoRH.arrastandoDoc = null
    document.querySelectorAll('.rh2-arrastando, .rh2-arrastando-doc, .rh2-pasta.soltar')
        .forEach(e => e.classList.remove('rh2-arrastando', 'rh2-arrastando-doc', 'soltar'))
}

function pastaAceitaRH(pasta) {
    const origem = estadoRH.arrastandoDoc
    return !!origem && pasta !== 'SEM PASTA' && pasta !== origem.pasta
}

const arrastandoArquivoRH = event => !!event.dataTransfer?.types?.includes('Files')

function sobrePastaRH(event, zona) {
    // Arquivo do computador: qualquer pasta aceita (vira um documento novo nela).
    if (arrastandoArquivoRH(event)) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        return zona.classList.add('soltar')
    }
    if (!estadoRH.arrastandoDoc) return          // pessoa da hierarquia: não é aqui
    event.preventDefault()
    const aceita = pastaAceitaRH(zona.dataset.pasta)
    event.dataTransfer.dropEffect = aceita ? 'move' : 'none'
    zona.classList.toggle('soltar', aceita)
}

async function soltarDocumentoPastaRH(event, zona) {
    event.preventDefault()
    zona.classList.remove('soltar')
    const arquivos = [...(event.dataTransfer?.files || [])]
    if (arquivos.length) {
        const pasta = PASTAS_RH.includes(zona.dataset.pasta) ? zona.dataset.pasta : null
        return salvarArquivosPastaRH(zona.dataset.pessoa, pasta, arquivos)
    }
    const id = event.dataTransfer.getData('text/plain') || estadoRH.arrastandoDoc?.id
    const pasta = zona.dataset.pasta
    const aceita = pastaAceitaRH(pasta)
    fimArrastarDocumentoRH()
    const doc = estadoRH.documentos.find(d => String(d.id) === String(id))
    if (!doc || !aceita) return
    const anterior = doc.pasta
    doc.pasta = pasta
    estadoRH.movido = doc.id                     // destaca o cartão na pasta nova por um instante
    renderizarRH()
    setTimeout(() => { if (estadoRH.movido === doc.id) estadoRH.movido = null }, 1500)
    try {
        const resposta = await enviar(`documentos/${doc.id}/pasta`, pasta)
        if (resposta?.mensagem && !resposta?.success) throw new Error(resposta.mensagem)
    } catch (erro) {
        doc.pasta = anterior
        renderizarRH()
        popup({ mensagem: `Não foi possível mover o documento: ${escaparAtributo(erro.message || 'erro desconhecido')}` })
    }
}

function tabelaDocumentosRH() {
    const termo = normalizarRH(estadoRH.busca).trim()
    const termoDigitos = digitosRH(estadoRH.busca)
    const linhas = estadoRH.documentos
        .map(d => ({ d, p: estadoRH.porId.get(d.funcionario) || {} }))
        .filter(({ d, p }) => (estadoRH.mostrarDesligados || !p.desligado)
            && (estadoRH.situacao === 'todos' || d.situacao.cor === estadoRH.situacao)
            && (!termo || normalizarRH([nomeDocRH(d), d.pasta, p.nome, p.cargo, p.cidade, p.estado].join(' ')).includes(termo)
                || (termoDigitos.length >= 3 && digitosRH(p.cnpj).includes(termoDigitos))))
        .sort((a, b) => String(a.p.nome || '').localeCompare(String(b.p.nome || ''), 'pt-BR') || nomeDocRH(a.d).localeCompare(nomeDocRH(b.d), 'pt-BR'))
    if (!linhas.length) return '<p class="rh2-vazio">Nenhum documento neste filtro.</p>'
    return `
        <div class="rh2-tabela">
            <table>
                <thead><tr><th></th><th style="text-align: left;">Documento</th><th>Pasta</th><th style="text-align: left;">Funcionário</th><th>CPF/CNPJ</th><th>Estado</th><th>Cidade</th><th>Feito em</th><th>Vencimento</th><th>Assinatura</th></tr></thead>
                <tbody>${linhas.map(({ d, p }) => `
                    <tr>
                        <td><button type="button" class="rh2-mais" data-doc="${escaparAtributo(d.id)}" onclick="incluirDocumento(this.dataset.doc)" title="Editar" aria-label="Editar"><img class="rh2-icone-editar" src="imagens/editar3.png" alt=""></button></td>
                        <td style="text-align: left;">
                            <div class="rh-arquivo-pilula ${d.anexo?.link ? 'com-anexo' : 'sem-anexo'}">
                                <span class="rh-arquivo-tipo">${escaparAtributo(nomeDocRH(d))}</span>
                                ${d.anexo?.link ? `<button type="button" class="rh-arquivo-acao" data-link="${escaparAtributo(d.anexo.link)}" onclick="abrirArquivo(this.dataset.link)">Ver</button>` : '<span class="rh-arquivo-acao">Ausente</span>'}
                            </div>
                        </td>
                        <td>${escaparAtributo(d.pasta || 'Sem pasta')}</td>
                        <td style="text-align: left;">${nomePessoaRH(p)}</td>
                        <td>${escaparAtributo(p.cnpj || '—')}</td>
                        <td>${escaparAtributo(p.estado || '—')}</td>
                        <td>${escaparAtributo(p.cidade || '—')}</td>
                        <td>${escaparAtributo(d.realizado || '—')}</td>
                        <td><div class="rh2-situacao-celula">${bolinhaRH(d.situacao)}<span>${Number(d.prazo) ? escaparAtributo(d.validade || '—') : 'Sem vencimento'}</span></div></td>
                        <td>${assinaturaRH(d.anexo)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <p class="rh2-rodape">${linhas.length} documento(s)</p>`
}

// Hierarquia (clientes.gestor), com foto de cada pessoa:
//  - à esquerda, quem não tem hierarquia (sem gestor e sem equipe);
//  - à direita, um organograma por equipe (gestor no topo, equipe abaixo, ligados por linhas).
// Quem tem gestor fora da lista (ou desligado escondido) sobe como topo da própria equipe.
// O clique leva à pessoa na visão Por pessoa.
function hierarquiaRH() {
    const visiveis = new Set(pessoasFiltradasRH().map(p => p.id))
    const naTela = p => estadoRH.mostrarDesligados || !p.desligado
    const pessoas = estadoRH.pessoas.filter(naTela)
    const porId = new Map(pessoas.map(p => [p.id, p]))
    const filhos = new Map()
    for (const p of pessoas) {
        const chave = p.gestor && porId.has(String(p.gestor)) ? String(p.gestor) : ''
        filhos.set(chave, [...(filhos.get(chave) || []), p])
    }
    // Só mostra ramos com alguém do filtro (o caminho até ele aparece esmaecido).
    const temVisivel = (p, vistos = new Set()) => {
        if (vistos.has(p.id)) return false
        vistos.add(p.id)
        return visiveis.has(p.id) || (filhos.get(p.id) || []).some(f => temVisivel(f, vistos))
    }
    const cartao = p => `
        <button type="button" class="rh2-org-cartao ${visiveis.has(p.id) ? '' : 'caminho'}" data-pessoa="${escaparAtributo(p.id)}"
            onclick="abrirPessoaRH(this.dataset.pessoa)" title="${escaparAtributo(p.situacao.texto)} · arraste para outra pessoa para mudar o gestor"
            draggable="true" ondragstart="arrastarPessoaRH(event, this)" ondragend="document.querySelectorAll('.rh2-alvo').forEach(e => e.classList.remove('rh2-alvo'))"
            ondragover="sobrePessoaRH(event, this)" ondragleave="this.classList.remove('rh2-alvo')" ondrop="soltarPessoaRH(event, this.dataset.pessoa, this)">
            <img class="rh2-org-foto" src="${escaparAtributo(urlFotoCliente(p.foto))}" alt="" loading="lazy" onerror="this.onerror = null; this.src = logo">
            ${bolinhaRH(p.situacao)}
            <span class="rh2-org-textos">
                <b>${escaparAtributo(p.nome || 'Sem nome')}</b>
                ${p.cargo ? `<small>${escaparAtributo(p.cargo)}</small>` : ''}
                ${p.desligado ? etiquetaDesligado(p.desligado) : ''}
            </span>
        </button>`
    // Equipe grande não espalha na horizontal: quem não tem equipe própria (folha) vai para uma grade
    // de 2 a 4 colunas embaixo do gestor; só quem tem equipe abaixo continua lado a lado (galhos).
    const MINIMO_GRADE = 4
    const grade = folhas => {
        const colunas = folhas.length <= 6 ? 2 : folhas.length <= 12 ? 3 : 4
        return `<li class="rh2-org-grade-item"><div class="rh2-org-grade" style="--colunas: ${colunas}">${folhas.map(cartao).join('')}</div></li>`
    }
    const no = (p, vistos = new Set()) => {
        if (vistos.has(p.id)) return ''          // proteção contra ciclo de gestor
        vistos.add(p.id)
        const equipe = (filhos.get(p.id) || []).filter(f => temVisivel(f))
        const temEquipe = f => (filhos.get(f.id) || []).some(x => temVisivel(x))
        const galhos = equipe.filter(temEquipe)
        const folhas = equipe.filter(f => !temEquipe(f))
        const itens = folhas.length >= MINIMO_GRADE
            ? [...galhos.map(f => no(f, new Set(vistos))), grade(folhas)]
            : equipe.map(f => no(f, new Set(vistos)))
        return `<li>${cartao(p)}${itens.length ? `<ul>${itens.join('')}</ul>` : ''}</li>`
    }

    const raizes = (filhos.get('') || []).filter(p => temVisivel(p))
    const comEquipe = raizes.filter(p => (filhos.get(p.id) || []).length)
    const semHierarquia = raizes.filter(p => !(filhos.get(p.id) || []).length)
    if (!raizes.length) return '<p class="rh2-vazio">Ninguém neste filtro.</p>'

    return `
        <div class="rh2-hierarquia">
            <aside class="rh2-sem-hierarquia" ondragover="sobrePessoaRH(event, this)" ondragleave="if (!this.contains(event.relatedTarget)) this.classList.remove('rh2-alvo')" ondrop="soltarPessoaRH(event, '', this)">
                <div class="rh2-sem-hierarquia-titulo">Sem hierarquia <small>${semHierarquia.length}</small></div>
                ${semHierarquia.map(cartao).join('') || '<small class="rh2-pasta-vazia">Todos estão em alguma equipe.</small>'}
            </aside>
            <section class="rh2-equipes">
                ${comEquipe.map(p => {
                    const cheia = estadoRH.orgCheia === p.id
                    return `
                    <div class="rh2-org-caixa ${cheia ? 'cheia' : ''}" data-gestor="${escaparAtributo(p.id)}">
                        <div class="rh2-org-cheia-topo">
                            <b>Equipe de ${escaparAtributo(p.nome || 'Sem nome')}</b>
                            ${botaoTelaCheiaOrgRH(cheia)}
                        </div>
                        <div class="rh2-org"><ul>${no(p)}</ul></div>
                    </div>`
                }).join('')
                    || '<p class="rh2-vazio rh2-equipes-vazio">Nenhuma equipe montada ainda. Escolha o gestor das pessoas para formar os organogramas.</p>'}
            </section>
        </div>`
}

// ---------------- Tela cheia de um organograma ----------------
// O botão no canto de cada equipe abre o bloco em tela cheia (Fullscreen API; sem ela, o bloco cobre a
// janela). Volta pelo mesmo botão ou Esc. estadoRH.orgCheia guarda a equipe aberta: se a tela for
// redesenhada (ex.: alguém salvou um documento), o bloco continua cobrindo a janela.
function botaoTelaCheiaOrgRH(cheia) {
    const titulo = cheia ? 'Sair da tela cheia (Esc)' : 'Ver em tela cheia'
    const icone = cheia
        ? '<path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"/>'
        : '<path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/>'
    return `
        <button type="button" class="rh2-org-cheia-botao" title="${titulo}" aria-label="${titulo}" onclick="alternarTelaCheiaOrgRH(this)">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icone}</svg>
        </button>`
}

async function alternarTelaCheiaOrgRH(botao) {
    const caixa = botao.closest('.rh2-org-caixa')
    if (!caixa) return
    if (caixa.classList.contains('cheia')) return sairTelaCheiaOrgRH()
    estadoRH.orgCheia = caixa.dataset.gestor
    caixa.classList.add('cheia')
    botao.outerHTML = botaoTelaCheiaOrgRH(true)
    try { await caixa.requestFullscreen?.() } catch { }   // sem permissão: fica cobrindo a janela
    requestAnimationFrame(() => alinharLinhasHierarquiaRH(caixa))
}

function sairTelaCheiaOrgRH() {
    estadoRH.orgCheia = null
    if (document.fullscreenElement?.classList.contains('rh2-org-caixa')) document.exitFullscreen?.().catch(() => { })
    document.querySelectorAll('.rh2-org-caixa.cheia').forEach(caixa => {
        caixa.classList.remove('cheia')
        const botao = caixa.querySelector('.rh2-org-cheia-botao')
        if (botao) botao.outerHTML = botaoTelaCheiaOrgRH(false)
        requestAnimationFrame(() => alinharLinhasHierarquiaRH(caixa))
    })
}

// Saiu da tela cheia pelo navegador (Esc nativo): volta o bloco ao normal.
if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.querySelector('.rh2-org-caixa.cheia')) sairTelaCheiaOrgRH()
})
// Sem a Fullscreen API (bloco só cobrindo a janela): Esc também fecha.
if (typeof document !== 'undefined') document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !document.fullscreenElement && document.querySelector('.rh2-org-caixa.cheia')) sairTelaCheiaOrgRH()
})

// Linhas do organograma em pixel inteiro: a descida do gestor, a barra da equipe e a subida de cada
// cartão. Arredondadas para o mesmo pixel, as que se encontram ficam uma sobre a outra (sem parecer
// mais grossas). O cartão que fica embaixo da linha do gestor sobe por ela (uma reta só); os outros
// sobem pelo próprio centro.
function alinharLinhasHierarquiaRH(raiz = document) {
    for (const equipe of raiz.querySelectorAll('.rh2-org ul ul')) {
        const caixa = equipe.getBoundingClientRect()
        const linhaGestor = Math.round(caixa.left + caixa.width / 2)
        equipe.style.setProperty('--descida', `${linhaGestor - 1 - caixa.left}px`)
        const itens = [...equipe.children]
        itens.forEach((item, indice) => {
            const doItem = item.getBoundingClientRect()
            const cartao = item.querySelector(':scope > .rh2-org-cartao')?.getBoundingClientRect()
            const centro = cartao ? cartao.left + cartao.width / 2 : doItem.left + doItem.width / 2
            const x = cartao && linhaGestor > cartao.left + 12 && linhaGestor < cartao.right - 12 ? linhaGestor : Math.round(centro)
            item.style.setProperty('--subida', `${x - 1 - doItem.left}px`)
            // Barra horizontal: do centro do primeiro ao centro do último (mesmos pixels das subidas).
            item.style.setProperty('--barra-esq', indice === 0 ? `${x - 1 - doItem.left}px` : '0px')
            item.style.setProperty('--barra-dir', indice === itens.length - 1 ? `${doItem.right - (x + 1)}px` : '0px')
        })
    }
    // Organograma mais largo que a caixa: abre rolado com o gestor no meio (o resto fica a uma rolagem).
    for (const org of raiz.querySelectorAll('.rh2-org')) {
        if (org.scrollWidth <= org.clientWidth) continue
        const gestor = org.querySelector(':scope > ul > li > .rh2-org-cartao')?.getBoundingClientRect()
        if (!gestor) continue
        const caixa = org.getBoundingClientRect()
        org.scrollLeft += gestor.left + gestor.width / 2 - (caixa.left + caixa.width / 2)
    }
}

function abrirPessoaRH(id) {
    estadoRH.abertos.add(String(id))
    estadoRH.busca = estadoRH.porId.get(String(id))?.nome || ''
    const busca = document.querySelector('.tela-rh2 .rh2-busca')
    if (busca) busca.value = estadoRH.busca
    trocarVisaoRH('pessoa')
}

// Gestor: escolhido entre os funcionários (sem a própria pessoa nem quem está abaixo dela, para
// não fechar ciclo). Grava em clientes/<id>/gestor.
// A pessoa e todos abaixo dela (para não fechar ciclo ao escolher ou arrastar o gestor).
function pessoaEAbaixoRH(id) {
    const abaixo = new Set([String(id)])
    let cresceu = true
    while (cresceu) {
        cresceu = false
        for (const p of estadoRH.pessoas)
            if (p.gestor && abaixo.has(String(p.gestor)) && !abaixo.has(p.id)) { abaixo.add(p.id); cresceu = true }
    }
    return abaixo
}

// Arrastar na hierarquia: soltar em cima de alguém = entra na equipe dele; soltar em
// "Sem hierarquia" = fica sem gestor.
function arrastarPessoaRH(event, cartao) {
    event.dataTransfer.setData('text/plain', cartao.dataset.pessoa)
    event.dataTransfer.setData('application/x-gcs-pessoa', cartao.dataset.pessoa)
    event.dataTransfer.effectAllowed = 'move'
    estadoRH.arrastando = cartao.dataset.pessoa
}

function sobrePessoaRH(event, alvo) {
    if (!estadoRH.arrastando) return
    const destino = alvo.dataset.pessoa
    if (destino && pessoaEAbaixoRH(estadoRH.arrastando).has(String(destino))) return   // não pode: ciclo
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    alvo.classList.add('rh2-alvo')
}

async function soltarPessoaRH(event, gestor, alvo) {
    event.preventDefault()
    event.stopPropagation()
    alvo?.classList.remove('rh2-alvo')
    const id = event.dataTransfer.getData('application/x-gcs-pessoa') || estadoRH.arrastando
    estadoRH.arrastando = null
    if (!id) return
    const pessoa = estadoRH.porId.get(String(id))
    if (!pessoa || String(pessoa.gestor || '') === String(gestor || '')) return
    if (gestor && pessoaEAbaixoRH(id).has(String(gestor)))
        return popup({ mensagem: 'Não dá para colocar alguém abaixo de quem já está na equipe dele.' })
    await salvarGestorRH(id, gestor || null)
}

async function salvarGestorRH(id, gestor) {
    const pessoa = estadoRH.porId.get(String(id))
    const anterior = pessoa?.gestor ?? null
    if (pessoa) pessoa.gestor = gestor
    renderizarRH()
    try {
        const resposta = await enviar(`clientes/${id}/gestor`, gestor)
        if (resposta?.mensagem && !resposta?.success) throw new Error(resposta.mensagem)
        return true
    } catch (erro) {
        if (pessoa) pessoa.gestor = anterior
        renderizarRH()
        popup({ mensagem: `Não foi possível definir o gestor: ${escaparAtributo(erro.message || 'erro desconhecido')}` })
        return false
    }
}

function escolherGestorRH(id) {
    const abaixo = pessoaEAbaixoRH(id)
    const opcoes = estadoRH.pessoas.filter(p => !abaixo.has(p.id) && !p.desligado)
    const pessoa = estadoRH.porId.get(String(id))
    popup({
        titulo: `Gestor de ${escaparAtributo(pessoa?.nome || '')}`,
        elemento: `
            <div class="rh2-escolher-gestor" data-pessoa="${escaparAtributo(id)}">
                <input type="search" placeholder="Buscar pessoa" oninput="filtrarGestoresRH(this)">
                <div class="rh2-gestores">
                    <button type="button" class="rh2-gestor-opcao" data-gestor="" onclick="definirGestorRH(this)"><b>Sem gestor</b></button>
                    ${opcoes.map(p => `
                        <button type="button" class="rh2-gestor-opcao" data-gestor="${escaparAtributo(p.id)}" data-busca="${escaparAtributo(normalizarRH([p.nome, p.cargo].join(' ')))}" onclick="definirGestorRH(this)">
                            <b>${escaparAtributo(p.nome || 'Sem nome')}</b>${p.cargo ? `<small>${escaparAtributo(p.cargo)}</small>` : ''}
                        </button>`).join('')}
                </div>
            </div>`
    })
}

function filtrarGestoresRH(input) {
    const termo = normalizarRH(input.value).trim()
    input.closest('.rh2-escolher-gestor').querySelectorAll('.rh2-gestor-opcao[data-busca]')
        .forEach(b => { b.hidden = !!termo && !b.dataset.busca.includes(termo) })
}

async function definirGestorRH(botao) {
    const caixa = botao.closest('.rh2-escolher-gestor')
    const id = caixa.dataset.pessoa
    const gestor = botao.dataset.gestor || null
    const janela = botao.closest('.popup')?.id
    if (janela) removerPopup(janela)
    await salvarGestorRH(id, gestor)
}

async function atalhoDocumentos(idCliente = null) {

    const colunas = {
        'Editar': {},
        'Arquivo': { chave: 'doc' },
        'Foto': {},
        'Nome': { chave: 'nome_cargo', op: 'includes' },
        'Cidade': { chave: 'cidade' },
        'Realizado': { chave: 'realizado' },
        'Validade': { chave: 'validade' },
        'Dif/Dias': {}
    }

    const btnExtras = `
    <div style="${horizontal}; gap: 2px;">
        <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo('atrasados')">Atrasados</button>
        <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo('proximo')">Venc. Próximo (60d)</button>
        <button type="button" class="rh-filtro-tempo" onclick="filtrarPorTempo()">Todos</button>
    </div>
    `

    const pag = 'rh'

    const filtros = idCliente
        ? {
            funcionario: { op: '=', value: idCliente }
        }
        : {}

    const tabela = await modTab({
        btnExtras,
        pag,
        body: 'bodyDocumentos',
        filtros,
        base: 'vw_documentos',
        colunas,
        criarLinha: 'criarLinhaRH'
    })

    const elemento = `
        <div style="padding: 0.5rem;">
            ${tabela}
        </div>
    `

    popup({ elemento, titulo: 'Documentos' })

    await paginacao(pag)

}

async function filtrarPorTempo(tempo) {

    controles.rh.filtros ??= {}

    const hoje = dataServidor().toLocaleDateString()

    if (tempo == 'atrasados') {
        controles.rh.filtros['validade'] = { op: '<=d', value: hoje }

    } else if (tempo == 'proximo') {

        const dias60 = 60 * 24 * 60 * 60 * 1000
        controles.rh.filtros['validade'] = [
            { op: '<=d', value: new Date(agoraServidor() + dias60).toLocaleDateString() },
            { op: '>=d', value: hoje }
        ]

    } else {
        delete controles.rh.filtros['validade']
    }

    await paginacao()

}

function criarLinhaRH(documento) {

    const { doc, anexo, id, funcionario, cidade, nome_cargo, foto, realizado, validade } = documento || {}
    const [nome, cargo] = Array.isArray(nome_cargo) ? nome_cargo : []

    const tempoExpiracao = expiraEm(validade)
    const a = (typeof anexo === 'object' && anexo) ? anexo : {}
    const temAnexo = !!a.link

    const tds = `
        <td>
            <img src="imagens/pesquisar.svg" onclick="incluirDocumento('${id}')">
        </td>
        <td>
            <div class="rh-arquivo">
                <div class="rh-arquivo-pilula ${temAnexo ? 'com-anexo' : 'sem-anexo'}">
                    <span class="rh-arquivo-tipo" title="${escaparAtributo(doc || '')}">${escaparAtributo(doc || '--')}</span>
                    ${temAnexo
                        ? `<button type="button" class="rh-arquivo-acao" title="${escaparAtributo(a.nome || '')}"
                            data-link="${escaparAtributo(a.link)}" onclick="abrirArquivo(this.dataset.link)">Ver</button>`
                        : '<span class="rh-arquivo-acao">Ausente</span>'}
                </div>
                ${assinaturaRH(a)}
            </div>
        </td>
        <td>${funcionario ? `<button type="button" title="Abrir cadastro do funcionário" aria-label="Abrir cadastro do funcionário"
            data-funcionario="${escaparAtributo(funcionario)}" onclick="formularioCliente(Number(this.dataset.funcionario))"
            style="padding: 0; border: none; background: transparent; cursor: pointer;">
            <img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(foto))}" alt="" loading="lazy"
                onerror="this.onerror = null; this.src = logo">
        </button>` : `<img class="cliente-foto" src="${escaparAtributo(urlFotoCliente(foto))}" alt="" loading="lazy"
            onerror="this.onerror = null; this.src = logo">`}</td>
        <td>
            <div style="${vertical}; align-items: start; text-align: left; gap: 3px;">
                <span>${escaparAtributo(nome || '')}</span>
                ${cargo ? `<strong>${escaparAtributo(cargo)}</strong>` : ''}
            </div>
        </td>
        <td>${cidade || ''}</td>
        <td>${realizado || ''}</td>
        <td>${validade || ''}</td>
        <td>
            <div style="${horizontal}; justify-content: left; gap: 5px;">
                <img src="${tempoExpiracao.icone}" style="width: 1.2rem;">
                <label>${tempoExpiracao.dias}</label>
            </div>
        </td>`

    return `<tr>${tds}</tr>`
}

// Resultado gravado pelo servidor (SCRIPTS/assinaturas_digitais.js) depois do upload.
// Assinatura escaneada ou desenhada é só imagem: aparece como "Sem assinatura digital".
const SITUACOES_ASSINATURA_RH = {
    assinado: { classe: 'ok', texto: 'Digital' },
    invalida: { classe: 'erro', texto: 'Inválida', detalhe: 'O arquivo foi alterado depois de assinado: a assinatura não confere.' },
    sem_assinatura: { classe: 'alerta', texto: 'Sem assinatura digital', detalhe: 'O PDF não tem assinatura digital. Se há assinatura, ela é escaneada ou desenhada.' },
    invalidada: { classe: 'erro', texto: 'Assinatura invalidada', detalhe: 'O PDF foi assinado, mas depois foi salvo de novo por outro programa (ex.: aberto no navegador e salvo, ou "imprimir em PDF") e as assinaturas perderam a validade. Envie o arquivo original assinado.' },
    nao_pdf: { classe: 'neutro', texto: 'Não é PDF', detalhe: 'Só PDFs podem ter assinatura digital.' },
    arquivo_ausente: { classe: 'neutro', texto: 'Não verificado', detalhe: 'O arquivo não foi encontrado no servidor.' },
    erro: { classe: 'neutro', texto: 'Não verificado', detalhe: 'Não foi possível ler o PDF (protegido por senha ou corrompido).' }
}

// Nomes vêm do certificado em maiúsculas: "MARIA DA SILVA" vira "Maria da Silva".
function nomeAssinanteRH(nome) {
    if (!String(nome || '').trim()) return 'Assinante não identificado'
    return String(nome).toLowerCase()
        .replace(/(^|\s)(\p{L})/gu, (_, espaco, letra) => espaco + letra.toUpperCase())
        .replace(/ (Da|De|Do|Das|Dos|E) /g, parte => parte.toLowerCase())
}

// Quem assinou, um por linha com ✓ (ou ✗ se a assinatura não confere), cortado com … pelo CSS;
// os detalhes ficam no title. Selo só quando há algo a avisar (sem assinatura, inválida...).
function assinaturaRH(anexo) {
    if (!anexo?.link) return ''

    const resultado = anexo.assinatura_digital
    if (!resultado)
        return '<div class="rh-assinatura neutro" title="Ainda não verificado"><span class="rh-assinatura-selo">Verificando...</span></div>'

    const situacao = SITUACOES_ASSINATURA_RH[resultado.situacao] || SITUACOES_ASSINATURA_RH.erro
    const assinaturas = resultado.assinaturas || []
    const linhas = assinaturas.map(a => {
        const data = a.data && !Number.isNaN(new Date(a.data).getTime()) ? new Date(a.data).toLocaleString('pt-BR') : ''
        const origem = a.origem === 'outro' ? 'outro certificado' : a.origem
        return `${a.confere ? '✓' : '✗'} ${nomeAssinanteRH(a.nome)}${origem ? ` (${origem})` : ''}${data ? ' em ' + data : ''}`
    })
    if (situacao.detalhe) linhas.unshift(situacao.detalhe)
    if (resultado.alterado_depois) linhas.push('Atenção: o arquivo recebeu alterações depois da última assinatura.')

    const selo = resultado.alterado_depois && situacao.classe === 'ok'
        ? { classe: 'alerta', texto: 'Alterado após assinar' }
        : situacao.classe === 'ok' ? null : situacao
    const nomes = assinaturas.map(a => `
        <span class="rh-assinante ${a.confere ? 'confere' : 'nao-confere'}">
            <span class="rh-assinante-marca" aria-hidden="true">${a.confere ? '✓' : '✗'}</span>
            <span class="rh-assinante-nome">${escaparAtributo(nomeAssinanteRH(a.nome))}</span>
        </span>`).join('')

    return `<div class="rh-assinatura ${selo?.classe || 'ok'}" title="${escaparAtributo(linhas.join('\n'))}">
        ${selo ? `<span class="rh-assinatura-selo">${selo.texto}</span>` : ''}
        ${nomes}
    </div>`
}

function expiraEm(dtValidade) {

    if (!dtValidade)
        return { dias: 0, icone: 'gifs/interrogacao.gif', status: 'Desconhecido', validade: '' };

    let validade;

    // Suporta data BR (DD/MM/AAAA) ou ISO do banco (YYYY-MM-DDTHH...)
    if (typeof dtValidade === 'string' && dtValidade.includes('/')) {
        const [dia, mes, ano] = dtValidade.split(' ')[0].split('/');
        validade = new Date(ano, mes - 1, dia);
    } else {
        validade = new Date(dtValidade);
    }

    const hoje = dataServidor();

    // Zera as horas para comparar só os dias
    validade.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);

    // Calcula a diferença em dias
    const dias = Math.round((validade - hoje) / (1000 * 60 * 60 * 24));

    // Formata retorno (DD/MM/AAAA)
    const dd = String(validade.getDate()).padStart(2, '0');
    const mm = String(validade.getMonth() + 1).padStart(2, '0');
    const aa = validade.getFullYear();
    const dataValidade = isNaN(validade.getTime()) ? '' : `${dd}/${mm}/${aa}`;

    // Regras de Status
    let icone = 'gifs/interrogacao.gif';
    let status = 'Desconhecido';

    if (dias < 0) {
        icone = 'imagens/offline.png';
        status = 'Vencido';
    } else if (dias <= 30) {
        icone = 'imagens/pendente.png';
        status = 'Próximo';
    } else {
        icone = 'imagens/online.png';
        status = 'Ativo';
    }

    return { dias: isNaN(dias) ? 0 : dias, icone, status, validade: dataValidade };
}

// Área pontilhada do anexo: o arquivo solto vai para o próprio <input name="anexo">, que é o que
// salvarDocumento lê. Um arquivo por documento (fica o primeiro, se vierem vários).
function soltarAnexoRH(event, area) {
    event.preventDefault()
    area.classList.remove('arrastando')

    const arquivo = event.dataTransfer?.files?.[0]
    if (!arquivo) return

    const input = area.querySelector('input[type="file"]')
    const transferencia = new DataTransfer()
    transferencia.items.add(arquivo)
    input.files = transferencia.files
    mostrarAnexoRH(input)
}

function mostrarAnexoRH(input) {
    const area = input.closest('.rh-anexo-area')
    const texto = area?.querySelector('.rh-anexo-texto')
    const arquivo = input.files?.[0]
    if (!texto) return

    area.classList.toggle('com-arquivo', !!arquivo)
    texto.innerHTML = arquivo
        ? `<b>${escaparAtributo(arquivo.name)}</b><small>Clique ou arraste outro para trocar</small>`
        : 'Arraste o arquivo aqui ou <u>clique para escolher</u>'
    // PDF de ASO, ficha de EPI ou certificado: lê e preenche o formulário (js/rh_leitor.js).
    if (typeof analisarAnexoRH === 'function') analisarAnexoRH(input)
}

// inicial.pasta / inicial.arquivo: vindos de um arquivo do computador solto numa pasta do RH.
async function incluirDocumento(id, funcionarioInicial = null, inicial = {}) {

    const registro = id ? await recuperarDado('documentos', id) || {} : {}
    const { realizado, anexo } = registro
    // inicial.doc: tipo já escolhido (ex.: clique num treinamento ou no ASO da Ficha, js/rh_ficha.js).
    const doc = registro.doc ?? inicial.doc
    const pasta = registro.pasta ?? inicial.pasta
    const funcionario = registro.funcionario ?? funcionarioInicial
    const { nome } = funcionario ? await recuperarDado('clientes', funcionario) || {} : {}
    const dataOriginal = String(realizado || '').trim()
    const dataBR = dataOriginal.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
    const dataFormulario = dataBR
        ? `${dataBR[3]}-${dataBR[2]}-${dataBR[1]}`
        : dataOriginal.slice(0, 10)

    controlesCxOpcoes.funcionario = {
        base: 'clientes',
        retornar: ['nome'],
        // Ordem nativa do servidor (sem ordem alfabética forçada), como no recebedor de pagamentos.
        ordenar: null,
        filtros: {
            usuario: { op: 'NOT_EMPTY' }
        },
        colunas: {
            'Usuário': { chave: 'usuario', alinhar: 'esquerda' },
            'Nome': { chave: 'nome', alinhar: 'esquerda' },
            'Estado': { chave: 'estado' },
            'Cidade': { chave: 'cidade' }
        }
    }

    controlesCxOpcoes.doc = {
        base: 'rh_documentos_regras',
        retornar: ['id'],
        colunas: {
            'Documento': { chave: 'id' }
        }
    }

    const linhas = [
        {
            texto: 'Anexo',
            elemento: `
                <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0;">
                    ${anexo?.link ? `
                        <button type="button" data-link="${escaparAtributo(anexo.link)}"
                            onclick="abrirArquivo(this.dataset.link)" style="white-space: normal; overflow-wrap: anywhere;">
                            Ver anexo: ${escaparAtributo(anexo.nome || 'Arquivo anexado')}
                        </button>
                        <small>Selecione outro arquivo para substituir o anexo atual.</small>
                    ` : id ? '<small>Este documento não possui anexo.</small>' : ''}
                    <label class="rh-anexo-area" data-soltar-arquivo="soltarAnexoRH"
                        ondragenter="event.preventDefault(); this.classList.add('arrastando')"
                        ondragover="event.preventDefault()"
                        ondragleave="if (!this.contains(event.relatedTarget)) this.classList.remove('arrastando')"
                        ondrop="soltarAnexoRH(event, this)">
                        <input name="anexo" type="file" aria-label="Selecionar anexo" onchange="mostrarAnexoRH(this)">
                        <span class="rh-anexo-icone" aria-hidden="true">⇪</span>
                        <span class="rh-anexo-texto">Arraste o arquivo aqui ou <u>clique para escolher</u></span>
                    </label>
                </div>`
        },
        {
            texto: 'Funcionário',
            elemento: `
            <div style="${horizontal}; gap: 3px;">
                <span 
                ${funcionario ? `id="${funcionario}"` : ''} 
                class="opcoes" 
                name="funcionario" 
                onclick="cxOpcoes('funcionario')">
                    ${escaparAtributo(nome || 'Selecionar')}
                </span>
                <img onclick="formularioCliente()" src="imagens/baixar.png">
            </div>
            `
        },
        {
            texto: 'Doc',
            elemento: `<span ${doc ? `id="${escaparAtributo(doc)}"` : ''} class="opcoes" name="doc" onclick="cxOpcoes('doc')">${escaparAtributo(doc || 'Selecionar')}</span>`
        },
        {
            texto: 'Feito em',
            elemento: `<input name="realizado" value="${escaparAtributo(dataFormulario)}" type="date">`
        },
        {
            // Vazio = pasta padrão do tipo (CERTIFICADOS para NRs/PTA/APR, PESSOAL para ASO/Ficha de EPI).
            texto: 'Pasta',
            elemento: `<select name="pasta">
                <option value="">Padrão do tipo de documento</option>
                ${PASTAS_RH.map(nome => `<option ${pasta === nome ? 'selected' : ''}>${nome}</option>`).join('')}
            </select>`
        }

    ]

    const funcao = id
        ? `salvarDocumento('${id}')`
        : `salvarDocumento()`

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    if (id)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirDocumento('${id}')` })

    popup({ botoes, linhas, titulo: 'Incluir Documento' })

    if (inicial.arquivo && typeof DataTransfer === 'function') {
        const input = [...document.querySelectorAll('.rh-anexo-area input[name="anexo"]')].pop()
        if (input) {
            const transferencia = new DataTransfer()
            transferencia.items.add(inicial.arquivo)
            input.files = transferencia.files
            mostrarAnexoRH(input)
        }
    }

}

function confirmarExcluirDocumento(id) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirDocumento('${id}')` }
    ]

    popup({ mensagem: 'Deseja excluir o documento?', botoes, removerAnteriores: true })

}

async function excluirDocumento(id) {

    await deletar(`documentos/${id}`)

}

async function verificarDoc(funcionario, doc) {

    const exsitente = await pesquisarDB({
        base: 'vw_documentos',
        filtros: {
            'funcionario': { op: '=', value: funcionario },
            'doc': { op: '=', value: doc }
        }
    })

    return exsitente

}

async function salvarDocumento(id = crypto.randomUUID()) {

    overlayAguarde()

    const obVal = (n) => {
        const painel = document.querySelector('.painel-padrao')
        const elemento = painel.querySelector(`[name="${n}"]`)
        return elemento ? elemento : null
    }

    const input = obVal('anexo')
    // Anexos retornados numa lista [{}, {}], 
    // só retorna 1, porque é o limite para este formulário;
    const anexoAPI = await importarAnexos({ input })
    const funcionario = obVal('funcionario')?.id
    const doc = obVal('doc')?.id

    if (!funcionario)
        return popup({ mensagem: 'Escolha um funcionário' })

    // Sem tipo vale para arquivo de pasta (precisa de anexo, novo ou já existente).
    if (!doc && !anexoAPI?.[0] && !(await recuperarDado('documentos', id))?.anexo?.link)
        return popup({ mensagem: 'Selecione o tipo de documento ou anexe um arquivo' })

    // Se existir algum documento para este funcionário do mesmo tipo, substituir;
    const existente = doc ? await verificarDoc(Number(funcionario), doc) : null
    const resultados = existente?.resultados || []
    if (resultados.length)
        id = existente.resultados[0].id

    if (resultados.length > 1) {
        for (let i = 1; i < resultados.length; i++)
            await excluirDocumento(resultados[i].id)
    }

    const { usuario, anexo, pasta: pastaAtual } = await recuperarDado('documentos', id) || {}
    // Só manda "pasta" quando escolhida ou quando o documento já tinha uma (antes da migração a coluna não existe).
    const pastaEscolhida = obVal('pasta')?.value || null

    const campos = ['realizado']

    const atualizado = {
        id,
        funcionario: Number(funcionario),
        doc,
        usuario: usuario || acesso.usuario,
        anexo: anexoAPI?.[0] ?? anexo ?? {},
        ...(pastaEscolhida || pastaAtual ? { pasta: pastaEscolhida } : {}),
        ...Object.fromEntries(
            campos.map(n => [n, obVal(n)?.value || ''])
        )
    }

    const resposta = await enviar(`documentos/${id}`, atualizado)

    // Exames do ASO / EPIs da ficha lidos do PDF: lança na Ficha (js/rh_leitor.js), se marcado no painel.
    const leitura = resposta?.success && typeof aplicarLeituraRH === 'function'
        ? await aplicarLeituraRH(input, Number(funcionario)).catch(erro => (console.error('[RH] leitura', erro), { falhas: 1 }))
        : null

    removerPopup()
    if (leitura && (leitura.lancados || leitura.catalogados || leitura.falhas))
        popup({
            mensagem: [
                leitura.lancados ? `Ficha atualizada: ${leitura.lancados} lançamento(s) lido(s) do arquivo.` : '',
                leitura.catalogados ? `${leitura.catalogados} EPI(s) incluído(s) no catálogo.` : '',
                leitura.falhas ? `${leitura.falhas} item(ns) não foram gravados: confira a Ficha.` : ''
            ].filter(Boolean).join('<br>')
        })

    // Tela de documentos aberta: recarrega com o documento novo/alterado.
    if (document.querySelector('.tela-rh2')) carregarRH()
}

// ---------------- Cadeado das pastas (rh_pastas_acesso) ----------------
// Por pasta (vale para todos os funcionários): permissões e usuários que veem os documentos dela.
// Listas vazias = livre (cadeado apagado). O servidor é quem esconde os documentos de quem não está
// na lista (sem exceção, nem adm); aqui só se mostra o cadeado, a pasta "restrita" e o formulário.
// Mudar o acesso: adm e diretoria (o servidor confere: ref_permissoes_bases, editar).
const PERMISSOES_PASTA_RH = ['adm', 'diretoria', 'fin', 'gerente', 'analista', 'log', 'user', 'técnico']
const EDITAM_ACESSO_PASTA_RH = ['adm', 'diretoria']

function listaJsonRH(valor) {
    if (typeof valor === 'string') try { valor = JSON.parse(valor) } catch { valor = [] }
    return Array.isArray(valor) ? valor.map(String) : []
}

function acessoPastaRH(pasta) {
    const a = estadoRH.acessoPastas.get(pasta) || {}
    return { permissoes: listaJsonRH(a.permissoes), usuarios: listaJsonRH(a.usuarios) }
}

const pastaRestritaRH = pasta => { const a = acessoPastaRH(pasta); return a.permissoes.length + a.usuarios.length > 0 }

function podeVerPastaRH(pasta) {
    const a = acessoPastaRH(pasta)
    return !pastaRestritaRH(pasta) || a.permissoes.includes(acesso?.permissao) || a.usuarios.includes(acesso?.usuario)
}

function botaoCadeadoRH(pasta) {
    const ligado = pastaRestritaRH(pasta)
    const titulo = ligado
        ? `Pasta restrita${podeVerPastaRH(pasta) ? ' (você tem acesso)' : ' (você não tem acesso)'}. Clique para ver quem pode ver.`
        : 'Pasta livre: todos veem. Clique para ver ou restringir.'
    return `
        <button type="button" class="rh2-cadeado ${ligado ? 'ligado' : ''}" data-pasta="${escaparAtributo(pasta)}" title="${escaparAtributo(titulo)}"
            aria-label="${escaparAtributo(titulo)}" onclick="event.stopPropagation(); abrirAcessoPastaRH(this.dataset.pasta)">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="${ligado ? 'M4.5 7V5a3.5 3.5 0 0 1 7 0v2' : 'M4.5 7V5a3.5 3.5 0 0 1 6.8-1.2'}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                <rect x="2.5" y="7" width="11" height="8" rx="1.6" fill="currentColor"/>
            </svg>
        </button>`
}

let usuariosAcessoRH = null   // [{ usuario, nome, permissao }] carregado ao abrir o formulário

async function abrirAcessoPastaRH(pasta) {
    const pode = EDITAM_ACESSO_PASTA_RH.includes(acesso?.permissao)
    const atual = acessoPastaRH(pasta)
    if (!usuariosAcessoRH) {
        overlayAguarde()
        try {
            const lista = await pesquisarTodosRH('vw_2_clientes', { usuario: { op: 'NOT_EMPTY' } })
            usuariosAcessoRH = lista.filter(c => !c.excluido && !c.desligado && c.usuario && c.permissao !== 'cliente')
                .map(c => ({ usuario: String(c.usuario), nome: String(c.nome || ''), permissao: String(c.permissao || '') }))
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        } catch { usuariosAcessoRH = [] }
        finally { removerOverlay() }
    }
    // Quem já está na lista aparece mesmo se não vier na consulta (ex.: desligado depois).
    const conhecidos = new Set(usuariosAcessoRH.map(u => u.usuario))
    // Quem edita nunca perde o acesso: com a pasta restrita, o próprio usuário fica marcado e travado
    // (o servidor também inclui). Vem primeiro na lista, depois os marcados.
    const eu = String(acesso?.usuario || '')
    const extras = [...atual.usuarios, ...(pode && eu ? [eu] : [])].filter((u, i, l) => !conhecidos.has(u) && l.indexOf(u) === i)
    const peso = u => (pode && u.usuario === eu ? 2 : 0) + (atual.usuarios.includes(u.usuario) ? 1 : 0)
    const usuarios = [...extras.map(u => ({ usuario: u, nome: u, permissao: u === eu ? String(acesso?.permissao || '') : '' })), ...usuariosAcessoRH]
        .sort((a, b) => peso(b) - peso(a))
    const restritaAgora = pastaRestritaRH(pasta)
    const marcado = (lista, valor) => lista.includes(valor) ? 'checked' : ''
    const bloqueio = pode ? '' : 'disabled'

    const elemento = `
        <div class="rh2-acesso" data-pasta="${escaparAtributo(pasta)}">
            <p class="rh2-acesso-resumo">
                ${pastaRestritaRH(pasta)
                    ? `<b>Pasta restrita.</b> Só as permissões e os usuários marcados veem os documentos desta pasta, de todos os funcionários. ${podeVerPastaRH(pasta) ? 'Você tem acesso.' : 'Você não tem acesso ao conteúdo.'}`
                    : '<b>Pasta livre.</b> Todos que acessam o RH veem os documentos desta pasta. Marque abaixo para restringir.'}
            </p>
            <p class="rh2-acesso-nota">Um documento arrastado para fora desta pasta passa a seguir o acesso da pasta de destino.</p>
            <div class="rh2-acesso-colunas">
                <fieldset ${bloqueio}>
                    <legend>Permissões</legend>
                    ${PERMISSOES_PASTA_RH.map(p => `<label><input type="checkbox" name="permissao" value="${escaparAtributo(p)}" ${marcado(atual.permissoes, p)} onchange="sincronizarAcessoPastaRH(this)"> ${escaparAtributo(p)}</label>`).join('')}
                </fieldset>
                <fieldset ${bloqueio}>
                    <legend>Usuários <small class="rh2-acesso-contagem"></small></legend>
                    <input type="search" class="rh2-acesso-busca" placeholder="Buscar usuário" oninput="filtrarUsuariosAcessoRH(this)">
                    <div class="rh2-acesso-usuarios">
                        ${usuarios.map(u => {
                            const proprio = pode && u.usuario === eu
                            const marcar = proprio ? restritaAgora : atual.usuarios.includes(u.usuario)
                            return `
                            <label data-busca="${escaparAtributo(normalizarRH(`${u.nome} ${u.usuario} ${u.permissao}`))}" class="${marcar ? 'marcado' : ''} ${proprio ? 'proprio' : ''}"
                                ${proprio ? 'title="Você sempre vê as pastas cujo acesso define: com a pasta restrita, seu usuário entra automaticamente."' : ''}>
                                <input type="checkbox" name="usuario" value="${escaparAtributo(u.usuario)}" ${marcar ? 'checked' : ''} ${proprio ? 'data-proprio disabled' : ''} onchange="sincronizarAcessoPastaRH(this)">
                                <span>${escaparAtributo(u.nome || u.usuario)}${proprio ? ' <b class="rh2-acesso-voce">você</b>' : ''}</span><small>${escaparAtributo(u.usuario)}${u.permissao ? ` · ${escaparAtributo(u.permissao)}` : ''}</small>
                            </label>`
                        }).join('') || '<small>Nenhum usuário encontrado.</small>'}
                    </div>
                </fieldset>
            </div>
            ${pode ? '' : '<p class="rh2-acesso-nota">Só adm e diretoria mudam o acesso das pastas.</p>'}
        </div>`

    popup({
        titulo: `Acesso à pasta ${pasta}`,
        elemento,
        botoes: pode ? [{ texto: 'Salvar', img: 'concluido', funcao: `salvarAcessoPastaRH('${escaparAtributo(pasta)}')` }] : []
    })
    const primeiro = [...document.querySelectorAll('.rh2-acesso')].pop()?.querySelector('input[name="usuario"]')
    if (primeiro) contarUsuariosAcessoRH(primeiro)
}

function filtrarUsuariosAcessoRH(input) {
    const termo = normalizarRH(input.value).trim()
    input.closest('.rh2-acesso').querySelectorAll('.rh2-acesso-usuarios label')
        .forEach(l => { l.hidden = !!termo && !l.dataset.busca.includes(termo) })
}

// Marcou qualquer permissão ou outro usuário: a pasta fica restrita e o próprio usuário entra (travado).
// Desmarcou tudo: volta a ser livre (o próprio sai junto).
function sincronizarAcessoPastaRH(input) {
    const caixa = input.closest('.rh2-acesso')
    const proprio = caixa.querySelector('input[data-proprio]')
    if (proprio) {
        const outros = [...caixa.querySelectorAll('input[name="permissao"]:checked, input[name="usuario"]:checked')].filter(i => i !== proprio).length
        proprio.checked = outros > 0
    }
    caixa.querySelectorAll('input[name="usuario"]').forEach(i => i.parentElement.classList.toggle('marcado', i.checked))
    contarUsuariosAcessoRH(input)
}

function contarUsuariosAcessoRH(input) {
    const caixa = input.closest('.rh2-acesso')
    const n = caixa.querySelectorAll('input[name="usuario"]:checked').length
    caixa.querySelector('.rh2-acesso-contagem').textContent = n ? `(${n} marcado${n > 1 ? 's' : ''})` : ''
}

async function salvarAcessoPastaRH(pasta) {
    const caixa = [...document.querySelectorAll('.rh2-acesso')].find(c => c.dataset.pasta === pasta)
    if (!caixa) return
    const valores = nome => [...caixa.querySelectorAll(`input[name="${nome}"]:checked`)].map(i => i.value)
    const registro = { id: pasta, permissoes: valores('permissao'), usuarios: valores('usuario'), usuario: acesso.usuario }
    const restrita = registro.permissoes.length + registro.usuarios.length > 0
    if (restrita && !registro.usuarios.includes(acesso.usuario)) registro.usuarios.unshift(acesso.usuario)
    const euVejo = !restrita || registro.permissoes.includes(acesso.permissao) || registro.usuarios.includes(acesso.usuario)

    overlayAguarde()
    try {
        const resposta = await enviar(`rh_pastas_acesso/${pasta}`, registro)
        if (!resposta?.success) throw new Error(resposta?.mensagem || 'falha ao salvar')
        estadoRH.acessoPastas.set(pasta, registro)
        removerPopup()
        if (!euVejo) popup({ mensagem: `Acesso salvo. Você não está na lista: os documentos da pasta ${escaparAtributo(pasta)} deixam de aparecer para você.` })
        carregarRH()
    } catch (erro) {
        popup({ mensagem: `Não foi possível salvar o acesso: ${escaparAtributo(erro.message || 'erro desconhecido')}` })
    } finally {
        removerOverlay()
    }
}
