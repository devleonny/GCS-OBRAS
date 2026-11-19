// ================================================================ RELATÓRIOS (ocorrências, correções, peças)
// Layout das NF-e/NFS-e emitidas e das contas a pagar/receber (css/financeiro.css, .fin-tela): tela inteira,
// título com a barra de ações (Excel), funil/arrastar/recolher colunas (js/tabelas-cabecalho.js), tabela na
// altura da tela e paginação no rodapé da janela. O "+" de expandir todos os detalhes fica no título da coluna.

const POR_PAGINA_REL_OC = 50

const RELATORIOS_OC = {
    relatorioOcorrencias: {
        titulo: 'Relatório de Ocorrências',
        base: 'vw_dados_ocorrencias',
        body: 'bodyRelatorioOcorrencias',
        criarLinha: 'criarLinhaRelatorio',
        detalhes: true,
        excel: 'baixarExcelRelatorioOcorrencias',
        acessoExcel: 'ocorrencias.relatorio.excel',
        aposCarregar: 'aposCarregarRelOcorrencias',
        unidade: ['ocorrência', 'ocorrências'],
        colunas: {
            'Empresa': { chave: 'empresa' },
            'Chamado': { chave: 'id' },
            'Status': { chave: 'snapshots.nomesStatus' },
            'Data da Abertura': { chave: 'data_registro', tipoPesquisa: 'data' },
            'Data do Agendamento': { chave: 'snapshots.ultimaCorrecao.*.dtCorrecao', tipoPesquisa: 'data' },
            'Solicitante': { chave: 'usuario' },
            'Executores': { chave: 'snapshots.executores' },
            'Tipo Correção': { chave: 'snapshots.ultimaCorrecao.*.nome' },
            'Loja': { chave: 'cliente.nome' },
            'Cidade': { chave: 'cliente.cidade' },
            'Estado': { chave: 'cliente.estado' },
            'Sistema': { chave: 'sistema' },
            'Prioridade': { chave: 'prioridade' }
        }
    },
    relatorioCorrecoes: {
        titulo: 'Relatório de Correções',
        base: 'mvw_relatorio_correcoes',
        body: 'bodyCorrecoes',
        criarLinha: 'criarLinhasCorrecoes',
        detalhes: true,
        excel: 'baixarExcelRelatorioCorrecoes',
        acessoExcel: 'ocorrencias.relatorio_correcoes.excel',
        aposCarregar: 'aposCarregarRelCorrecoes',
        unidade: ['correção', 'correções'],
        colunas: {
            'Empresa': { chave: 'empresa' },
            'Chamado': { chave: 'Chamado' },
            'Tipo Correção': { chave: 'Tipo Correção' },
            'Data Registro': { chave: 'Data Registro', tipoPesquisa: 'data' },
            'Solicitante': { chave: 'Solicitante' },
            'Executor': { chave: 'Executor' },
            'Técnico': { chave: 'Técnico' },
            'Loja': { chave: 'Loja' },
            'Cidade': { chave: 'Cidade' },
            'Estado': { chave: 'Estado' },
            'Sistema': { chave: 'Sistema' }
        }
    },
    relatorioPecas: {
        titulo: 'Relatório de Peças',
        base: 'mvw_relatorio_pecas',
        body: 'bodyPecas',
        criarLinha: 'criarLinhasPecas',
        detalhes: true,
        excel: 'baixarExcelRelatorioPecas',
        acessoExcel: 'ocorrencias.relatorio_pecas.excel',
        aposCarregar: 'aposCarregarRelPecas',
        unidade: ['peça', 'peças'],
        colunas: {
            'Chamado': { chave: 'Chamado' },
            'Empresa': { chave: 'empresa' },
            'Loja': { chave: 'Loja' },
            'Técnico': { chave: 'Técnico' },
            'Data Correção': { chave: 'Data Correção', tipoPesquisa: 'data' },
            'Origem': { chave: 'Origem' },
            'Série': { chave: 'Série' },
            'Descrição': { chave: 'Descrição' },
            'Unidade': { chave: 'Unidade' },
            'Quantidade': { chave: 'Quantidade' },
            'Modelo': { chave: 'Modelo' },
            'Fabricante': { chave: 'Fabricante' }
        }
    }
}

function telaRelatorio() { return telaRelatorioOc('relatorioOcorrencias') }
function telaRelatorioCorrecoes() { return telaRelatorioOc('relatorioCorrecoes') }
function telaRelatorioPecas() { return telaRelatorioOc('relatorioPecas') }

// funcaoAdicional do modTab chama sem argumentos: uma para cada relatório.
function aposCarregarRelOcorrencias() { return aposCarregarRelOc('relatorioOcorrencias') }
function aposCarregarRelCorrecoes() { return aposCarregarRelOc('relatorioCorrecoes') }
function aposCarregarRelPecas() { return aposCarregarRelOc('relatorioPecas') }

async function telaRelatorioOc(pag) {
    const rel = RELATORIOS_OC[pag]
    if (typeof recolherMenuPrincipalFin === 'function') recolherMenuPrincipalFin()
    const icone = nome => typeof iconeFin === 'function' ? iconeFin(nome) : ''
    tela.innerHTML = `
        <div class="fin-tela rel-oc-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>${rel.titulo}</h2>
                    <div class="fin-barra">
                        ${pode(rel.acessoExcel) ? `<button type="button" onclick="${rel.excel}()" title="Baixa o relatório completo em Excel">${icone('excel')} Excel</button>` : ''}
                    </div>
                </header>
                <div class="fin-tabela-area" data-tabela-rel-oc></div>
            </section>
        </div>`

    const area = tela.querySelector('[data-tabela-rel-oc]')
    try {
        delete controles[pag]
        area.innerHTML = await modTab({
            colunas: rel.colunas,
            base: rel.base,
            pag,
            body: rel.body,
            criarLinha: rel.criarLinha,
            detalhes: rel.detalhes,
            caber: true,
            limite: POR_PAGINA_REL_OC,
            funcaoAdicional: [rel.aposCarregar]
        })
        area.querySelector('.modtab')?.insertAdjacentHTML('beforeend', `<div class="fin-rodape" data-rodape-rel-oc="${pag}"></div>`)
        removerOverlay()
        await paginacao(pag)
    } catch (err) {
        console.error(err)
        removerOverlay()
        popup({ mensagem: `Falha ao abrir o relatório: ${escaparAtributo(err.message)}` })
    }
}

async function aposCarregarRelOc(pag) {
    const ctrl = controles[pag]
    const tabela = document.getElementById(ctrl?.body)?.closest('table')
    if (!tabela) return
    // Linha de enchimento: a tabela ocupa a altura da tela mesmo com poucas linhas (a sobra fica nela).
    if (!tabela.querySelector(':scope > tbody.fin-enchimento')) {
        const n = tabela.querySelector(':scope > thead > tr')?.children.length || 1
        const enchimento = document.createElement('tbody')
        enchimento.className = 'fin-enchimento'
        enchimento.innerHTML = `<tr><td colspan="${n}"></td></tr>`
        tabela.appendChild(enchimento)
    }
    // "+" de expandir todos: do topo do modTab (escondido neste layout) para o título da coluna dos detalhes.
    const expandir = tabela.closest('.modtab')?.querySelector('.topo-tabela [data-expandir-todos]')
    const thDetalhes = tabela.querySelector(':scope > thead > tr:first-child > th.tabela-coluna-detalhes')
    if (expandir && thDetalhes) thDetalhes.appendChild(expandir)
    if (typeof cabecalhoAvancadoTabela === 'function')
        await cabecalhoAvancadoTabela(pag, { prefKey: pag })
    atualizarBotaoTodosDetalhes(document.getElementById(ctrl.body))
    desenharRodapeRelOc(pag)
}

function desenharRodapeRelOc(pag) {
    const alvo = document.querySelector(`[data-rodape-rel-oc="${pag}"]`)
    const ctrl = controles[pag]
    if (!alvo || !ctrl) return
    const [um, varios] = RELATORIOS_OC[pag].unidade
    const total = Number(document.getElementById(`resultados_${pag}`)?.textContent) || 0
    const paginas = Math.max(1, Number(ctrl.total) || 1)
    const pagina = Math.min(ctrl.pagina || 1, paginas)
    const inicio = total ? (pagina - 1) * POR_PAGINA_REL_OC + 1 : 0
    const fim = Math.min(total, pagina * POR_PAGINA_REL_OC)
    const botao = (texto, destino, ativo, titulo = '') =>
        `<button type="button" ${ativo ? `onclick="irPaginaRelOc('${pag}', ${destino})"` : 'disabled'} ${titulo ? `title="${titulo}"` : ''}>${texto}</button>`
    alvo.innerHTML = `
        <span>${inicio} - ${fim} de ${total.toLocaleString('pt-BR')} ${total === 1 ? um : varios}</span>
        <div class="fin-paginas">
            ${botao('|‹', 1, pagina > 1, 'Primeira página')}
            ${botao('‹ anterior', pagina - 1, pagina > 1)}
            <label>Página <input type="number" min="1" max="${paginas}" value="${pagina}" onchange="irPaginaRelOc('${pag}', this.value)"></label>
            <span>de ${paginas.toLocaleString('pt-BR')}</span>
            ${botao('próximo ›', pagina + 1, pagina < paginas)}
            ${botao('›|', paginas, pagina < paginas, 'Última página')}
        </div>`
}

async function irPaginaRelOc(pag, n) {
    const ctrl = controles[pag]
    if (!ctrl) return
    const pagina = Math.min(Math.max(1, parseInt(n) || 1), Math.max(1, Number(ctrl.total) || 1))
    if (pagina === ctrl.pagina) return desenharRodapeRelOc(pag)
    ctrl.pagina = pagina
    await paginacao(pag)
}

function textoRelatorioOcorrencia(valor) {
    return valor == null || String(valor).trim() === '' ? '—' : escaparAtributo(valor)
}

// Linha de no máximo uma altura: o que é longo vira "…" (texto completo no title e nos detalhes do "+").
const vazioRel = v => v == null || String(v).trim() === ''

function tdRel(valor, classe = '') {
    if (vazioRel(valor)) return `<td class="rel-vazio${classe ? ` ${classe}` : ''}">—</td>`
    const texto = escaparAtributo(valor)
    return `<td${classe ? ` class="${classe}"` : ''} title="${texto}">${texto}</td>`
}

// Lista (status, executores, datas): só o 1º item na linha e "+N" com o resto (todos aparecem nos detalhes).
function tdListaRel(itens = [], formatar = escaparAtributo, classe = '') {
    const lista = [...new Set(itens.filter(v => !vazioRel(v)).map(String))]
    if (!lista.length) return `<td class="rel-vazio${classe ? ` ${classe}` : ''}">—</td>`
    const resto = lista.length - 1
    return `<td class="${classe}" title="${escaparAtributo(lista.join(' · '))}">${formatar(lista[0])}${resto ? ` <small class="rel-mais">+${resto}</small>` : ''}</td>`
}

// Bloco "rótulo: valor" dos detalhes, com o texto inteiro (quebra linha à vontade).
function camposDetalheRel(campos) {
    const itens = campos
        .filter(([, valor]) => !vazioRel(Array.isArray(valor) ? valor.join('') : valor))
        .map(([rotulo, valor, html = false]) => `
            <div class="rel-detalhe-campo">
                <small>${rotulo}</small>
                <div>${html ? valor : escaparAtributo(Array.isArray(valor) ? valor.join(', ') : valor)}</div>
            </div>`)
        .join('')
    return itens ? `<div class="rel-detalhe-campos">${itens}</div>` : ''
}

async function criarLinhaRelatorio(ocorrencia) {

    const { id, snapshots, data_registro } = ocorrencia || {}
    const { nomesStatus, ultimaCorrecao } = snapshots || {}
    const { cliente, empresa, tipo, prioridade, sistema } = ocorrencia || {}

    const status = (Array.isArray(nomesStatus) ? nomesStatus : [nomesStatus])
        .filter(st => !vazioRel(st))
        .map(String)

    const executores = [...new Set(
        Object.values(ocorrencia?.correcoes || {})
            .flatMap(correcao => correcao?.executor)
            .filter(Boolean) // Remove valores nulos, indefinidos ou strings vazias
    )]

    const datasAgendadas = [...new Set((Array.isArray(ultimaCorrecao) ? ultimaCorrecao : [])
        .filter(corr => corr?.dtCorrecao)
        .map(corr => corr.dtCorrecao))]

    const etiqueta = st => formatacaoTipoCorrecao(escaparAtributo(st))

    const tds = `
        ${tdRel(empresa)}
        ${tdRel(id)}
        ${tdListaRel(status, etiqueta)}
        ${tdRel(data_registro)}
        ${tdListaRel(datasAgendadas)}
        ${tdRel(ocorrencia?.usuario, 'rel-curta')}
        ${tdListaRel(executores, escaparAtributo, 'rel-curta')}
        ${tdRel(tipo, 'rel-curta')}
        ${tdRel(cliente?.nome, 'rel-curta')}
        ${tdRel(cliente?.cidade, 'rel-curta')}
        ${tdRel(cliente?.estado)}
        ${tdRel(sistema, 'rel-curta')}
        ${tdRel(prioridade)}
    `

    const loja = [cliente?.nome, [cliente?.cidade, cliente?.estado].filter(Boolean).join('/')].filter(Boolean).join(' — ')
    const detalhes = camposDetalheRel([
        ['Status', status.map(etiqueta).join(' '), true],
        ['Agendamentos', datasAgendadas],
        ['Solicitante', ocorrencia?.usuario],
        ['Executores', executores],
        ['Tipo correção', tipo],
        ['Loja', loja],
        ['Sistema', sistema]
    ]) + tabelaCorrecoesRelatorio(ocorrencia?.correcoes)

    return { linha: `<tr class="fin-linha">${tds}</tr>`, detalhes }

}

function tabelaCorrecoesRelatorio(correcoes = {}) {
    const registro = correcao => toTimestamp(String(correcao.data || '')
        .replace(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:)/, '$1, $2')) ?? -Infinity
    const dataBR = valor => String(valor || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')
    const lista = Object.values(correcoes || {})
        .filter(Boolean)
        .sort((a, b) => registro(b) - registro(a))
    const linhas = lista.map(correcao => {
        const executor = Array.isArray(correcao.executor) ? correcao.executor.filter(Boolean).join(', ') : correcao.executor
        const fotos = new Set([
            ...Object.keys(correcao.fotos || {}),
            ...Object.values(correcao.anexos || {})
                .map(anexo => anexo?.link)
                .filter(link => link && extensoes.includes(link.split('.').pop().toLowerCase()))
        ])
        const imagens = [...fotos].map(link => `<img src="${escaparAtributo(`${api}/uploads/${link}`)}" alt="Foto da correção" data-link="${escaparAtributo(link)}" onclick="ampliarImagem(this, this.dataset.link)">`).join('')
        return `<tr>
            <td>${textoRelatorioOcorrencia(correcao.data)}</td>
            <td>${textoRelatorioOcorrencia(correcao.tipoCorrecaoNome || correcao.nome)}</td>
            <td>${escaparAtributo(executor || 'Sem executor')}</td>
            <td>${textoRelatorioOcorrencia(dataBR(correcao.dtCorrecao))}</td>
            <td>${textoRelatorioOcorrencia(dataBR(correcao.dtCorrecaoFinal))}</td>
            <td class="relatorio-correcao-descricao">${correcao.descricao || '—'}</td>
            <td><div class="relatorio-correcao-fotos">${imagens || 'Sem imagens'}</div></td>
        </tr>`
    }).join('')
    return `<div class="relatorio-correcoes-detalhes">
        <strong>Correções (${lista.length})</strong>
        <div class="relatorio-correcoes-rolagem">
            <table class="tabela"><thead><tr>
                <th>Registro</th><th>Tipo de correção</th><th>Executores</th><th>Agendamento</th><th>Data limite</th><th>Descrição</th><th>Imagens</th>
            </tr></thead><tbody>${linhas || '<tr><td colspan="7">Nenhuma correção registrada.</td></tr>'}</tbody></table>
        </div>
    </div>`
}


async function abrirCorrecaoRelatorio(idOcorrencia) {

    overlayAguarde()

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const correcoesOC = ocorrencia?.correcoes || {}
    const { cliente } = ocorrencia?.snapshots || {}
    const thead = ['Executor', 'Descrição', 'Imagens']
        .map(op => `<th>${op}</th>`)
        .join('')

    let linhas = ''
    for (let correcao of Object.values(correcoesOC)) {

        const { localizacao } = correcao || {}

        let registros = ''
        let imagens = ''

        // Fotos
        imagens = Object.entries(correcao?.fotos || {})
            .map(([link,]) => `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        // Anexos
        imagens = Object.values(correcao?.anexos || {})
            .map(foto => {
                const link = foto.link
                const extensao = link.split('.').pop().toLowerCase()
                if (!extensoes.includes(extensao)) return ''
                return `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`
            })
            .join('')

        linhas += `
            <tr>
                <td>${correcao.executor}</td>
                <td style="width: 200px; text-align: left;">${correcao.descricao}</td>
                <td>
                    ${imagens !== '' ? `<div class="fotos" style="display: grid;">${imagens}</div>` : 'Sem Imagens'}
                </td>
            </tr>`
    }

    const elemento = `
        <div class="detalhes-correcao">

            <span style="font-size: 1.2rem;"><b>Dados da Loja</b></span>
            <hr>

            <div style="${horizontal}; justify-content: left; gap: 1rem;">
                <div style="${vertical}">
                    ${modelo('Loja', cliente?.nome || '...')}
                    ${modelo('Endereço', cliente?.bairro || '...')}
                </div>

                <div style="${vertical}">
                    ${modelo('Cidade', cliente?.cidade || '...')}
                    ${modelo('Cep', cliente?.cep || '...')}
                </div>
            </div>

            <span style="font-size: 1.2rem;"><b>Correções</b></span>
            <hr>

            <div class="blocoTabela" style="width: 100%;">
                <div class="painelBotoes"></div>
                <div class="recorteTabela">
                    <table class="tabela" style="width: max-content; min-width: 100%;">
                        <thead>${thead}</thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
        `

    popup({ elemento, titulo: 'Correções' })
}

async function criarLinhasCorrecoes(correcao) {
    const d = correcao || {}
    const etiqueta = v => formatacaoTipoCorrecao(escaparAtributo(v))
    const tds = `
        ${tdRel(d.empresa)}
        ${tdRel(d['Chamado'])}
        ${tdListaRel([d['Tipo Correção']], etiqueta)}
        ${tdRel(d['Data Registro'])}
        ${tdRel(d['Solicitante'], 'rel-curta')}
        ${tdRel(d['Executor'], 'rel-curta')}
        ${tdRel(d['Técnico'], 'rel-curta')}
        ${tdRel(d['Loja'], 'rel-curta')}
        ${tdRel(d['Cidade'], 'rel-curta')}
        ${tdRel(d['Estado'])}
        ${tdRel(d['Sistema'], 'rel-curta')}
    `
    const loja = [d['Loja'], [d['Cidade'], d['Estado']].filter(Boolean).join('/')].filter(Boolean).join(' — ')
    const detalhes = camposDetalheRel([
        ['Tipo correção', vazioRel(d['Tipo Correção']) ? '' : etiqueta(d['Tipo Correção']), true],
        ['Solicitante', d['Solicitante']],
        ['Executor', d['Executor']],
        ['Técnico', d['Técnico']],
        ['Loja', loja],
        ['Sistema', d['Sistema']]
    ]) + `<div class="rel-detalhe-texto"><small>Descrição</small><div>${d['Descrição'] || '—'}</div></div>`

    return { linha: `<tr class="fin-linha">${tds}</tr>`, detalhes }

}

async function criarLinhasPecas(equipamento) {
    const d = equipamento || {}
    const tds = `
        ${tdRel(d['Chamado'])}
        ${tdRel(d.empresa)}
        ${tdRel(d['Loja'], 'rel-curta')}
        ${tdRel(d['Técnico'], 'rel-curta')}
        ${tdRel(d['Data Correção'])}
        ${tdRel(d['Origem'], 'rel-curta')}
        ${tdRel(d['Série'], 'rel-curta')}
        ${tdRel(d['Descrição'], 'rel-curta')}
        ${tdRel(d['Unidade'])}
        ${tdRel(d['Quantidade'])}
        ${tdRel(d['Modelo'], 'rel-curta')}
        ${tdRel(d['Fabricante'], 'rel-curta')}
    `
    const detalhes = camposDetalheRel([
        ['Descrição', d['Descrição']],
        ['Loja', d['Loja']],
        ['Técnico', d['Técnico']],
        ['Origem', d['Origem']],
        ['Série', d['Série']],
        ['Modelo', d['Modelo']],
        ['Fabricante', d['Fabricante']],
        ['Quantidade', [d['Quantidade'], d['Unidade']].filter(v => !vazioRel(v)).join(' ')]
    ])

    return { linha: `<tr class="fin-linha">${tds}</tr>`, detalhes: detalhes || 'Sem detalhes.' }

}

async function baixarExcelRelatorioOcorrencias() {

    overlayAguarde()

    const dados = {
        base: "vw_relatorio_ocorrencias",
        titulo: `Ocorrências_${agoraServidor()}`,
        formatacao: {
            datas: ["Data Registro", "Data da Abertura", "Data do Agendamento"]
        }
    }

    try {
        await baixarRelatorioExcel(dados)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }
}

async function baixarExcelRelatorioCorrecoes() {

    overlayAguarde()
    const dados = {
        base: "mvw_relatorio_correcoes",
        titulo: `Correções_${agoraServidor()}`,
        formatacao: {
            datas: ['Data Registro', 'Data Agendamento', 'Data Limite']
        }
    }

    try {
        await baixarRelatorioExcel(dados)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }
}

async function baixarExcelRelatorioPecas() {

    overlayAguarde()

    const dados = {
        base: "mvw_relatorio_pecas",
        titulo: `Peças_${agoraServidor()}`,
        formatacao: {
            datas: ['Data Correção']
        }
    }

    try {
        await baixarRelatorioExcel(dados)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }

}
