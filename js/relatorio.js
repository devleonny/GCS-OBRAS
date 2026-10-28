async function telaRelatorio() {

    overlayAguarde()

    const colunas = {
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

    const tabela = await modTab({
        colunas,
        pag: 'relatorioOcorrencias',
        detalhes: true,
        body: 'bodyRelatorioOcorrencias',
        base: 'vw_dados_ocorrencias',
        criarLinha: 'criarLinhaRelatorio'
    })

    tela.innerHTML = `
            <div class="pagina-conteudo">
                <div class="cabecalho-pagina"><h2>Relatório de Ocorrências</h2></div>
                ${tabela}
            </div>
        `

    removerOverlay()

    await paginacao()

}

function textoRelatorioOcorrencia(valor) {
    return valor == null || String(valor).trim() === '' ? '—' : escaparAtributo(valor)
}

async function criarLinhaRelatorio(ocorrencia) {

    const { id, snapshots, data_registro } = ocorrencia || {}
    const { nomesStatus, ultimaCorrecao } = snapshots || {}
    const { cliente, empresa, tipo, prioridade, sistema } = ocorrencia || {}

    const labelTipoCorrecao = (Array.isArray(nomesStatus) ? nomesStatus : [nomesStatus])
        .filter(st => st != null && String(st).trim() !== '')
        .map(st => formatacaoTipoCorrecao(st))
        .join('')

    const executores = [...new Set(
        Object.values(ocorrencia?.correcoes || {})
            .flatMap(correcao => correcao?.executor)
            .filter(Boolean) // Remove valores nulos, indefinidos ou strings vazias
    )]
        .map(nome => `<span>• ${escaparAtributo(nome)}</span>`)
        .join('')

    const datasAgendadas = (Array.isArray(ultimaCorrecao) ? ultimaCorrecao : [])
        .filter(corr => corr?.dtCorrecao)
        .map(corr => corr.dtCorrecao)

    const tds = `
        <td>${textoRelatorioOcorrencia(empresa)}</td>
        <td>${textoRelatorioOcorrencia(id)}</td>
        <td>
            <div style="${vertical}; gap: 1px;">${labelTipoCorrecao || '—'}</div>
        </td>
        <td>${textoRelatorioOcorrencia(data_registro)}</td>
        <td>
            ${textoRelatorioOcorrencia(datasAgendadas.join(', '))}
        </td>
        <td>${textoRelatorioOcorrencia(ocorrencia?.usuario)}</td>
        <td>
            <div style="${vertical}; gap: 2px;">${executores || '—'}</div>
        </td>
        <td>${textoRelatorioOcorrencia(tipo)}</td>
        <td>${textoRelatorioOcorrencia(cliente?.nome)}</td>
        <td>${textoRelatorioOcorrencia(cliente?.cidade)}</td>
        <td>${textoRelatorioOcorrencia(cliente?.estado)}</td>
        <td>${textoRelatorioOcorrencia(sistema)}</td>
        <td>${textoRelatorioOcorrencia(prioridade)}</td>
    `

    return { linha: `<tr>${tds}</tr>`, detalhes: tabelaCorrecoesRelatorio(ocorrencia?.correcoes) }

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

async function telaRelatorioCorrecoes() {

    overlayAguarde()

    const colunas = {
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

    const tabela = await modTab({
        colunas,
        base: 'mvw_relatorio_correcoes',
        detalhes: true,
        pag: 'relatorioCorrecoes',
        body: 'bodyCorrecoes',
        criarLinha: 'criarLinhasCorrecoes',
    })


    tela.innerHTML = `
            <div class="pagina-conteudo">
                <div class="cabecalho-pagina"><h2>Relatório de Correções</h2></div>
                ${tabela}
            </div>
        `

    removerOverlay()

    await paginacao()


}

async function criarLinhasCorrecoes(correcao) {
    const dados = correcao || {}
    const campos = ['empresa', 'Chamado', 'Tipo Correção', 'Data Registro', 'Solicitante', 'Executor', 'Técnico', 'Loja', 'Cidade', 'Estado', 'Sistema']
    const tds = campos.map(campo => {
        const valor = dados[campo]
        if (campo === 'Tipo Correção' && valor)
            return `<td>${formatacaoTipoCorrecao(escaparAtributo(valor))}</td>`
        return `<td>${textoRelatorioOcorrencia(valor)}</td>`
    }).join('')

    return {
        linha: `<tr>${tds}</tr>`,
        detalhes: `<strong>Descrição</strong><div style="white-space: pre-wrap; overflow-wrap: anywhere;">${dados['Descrição'] || '—'}</div>`
    }

}

async function telaRelatorioPecas() {

    overlayAguarde()

    const colunas = {
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
        'Fabricante': { chave: 'Fabricante' },
    }

    const tabela = await modTab({
        colunas,
        base: 'mvw_relatorio_pecas',
        pag: 'relatorioPecas',
        body: 'bodyPecas',
        criarLinha: 'criarLinhasPecas',
    })

    tela.innerHTML = `
            <div class="pagina-conteudo">
                <div class="cabecalho-pagina"><h2>Relatório de Peças</h2></div>
                ${tabela}
            </div>
        `

    removerOverlay()

    await paginacao()

}

async function criarLinhasPecas(equipamento) {
    const campos = ['Chamado', 'empresa', 'Loja', 'Técnico', 'Data Correção', 'Origem', 'Série', 'Descrição', 'Unidade', 'Quantidade', 'Modelo', 'Fabricante']
    const tds = campos
        .map(campo => `<td>${textoRelatorioOcorrencia(equipamento?.[campo])}</td>`)
        .join('')

    return `<tr>${tds}</tr>`

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
