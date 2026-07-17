async function telaRelatorio() {

    overlayAguarde()

    const btnExtras = `
        <div class="toolbar-itens">
            <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">
            <span onclick="baixarExcelRelatorioOcorrencias()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
            <div style="${horizontal}; gap: 2px;" id="toolbarRelatorio"></div>
        </div>
    `

    const colunas = {
        '': {},
        'Empresa': { chave: 'snapshots.empresa' },
        'Chamado': { chave: 'id' },
        'Status': { chave: 'snapshots.nomesStatus' },
        'Data da Abertura': { chave: 'data_registro', tipoPesquisa: 'data' },
        'Data do Agendamento': { chave: 'snapshots.ultimaCorrecao.*.dtCorrecao', tipoPesquisa: 'data' },
        'Solicitante': { chave: 'usuario' },
        'Executores': { chave: 'snapshots.executores' },
        'Tipo Correção': { chave: 'snapshots.ultimaCorrecao.*.nome' },
        'Loja': { chave: 'snapshots.cliente.nome' },
        'Cidade': { chave: 'snapshots.cliente.cidade' },
        'Estado': { chave: 'snapshots.cliente.estado' },
        'Sistema': { chave: 'snapshots.sistema' },
        'Prioridade': { chave: 'snapshots.prioridade' }
    }

    const tabela = await modTab({
        colunas,
        btnExtras,
        pag: 'relatorioOcorrencias',
        body: 'bodyRelatorioOcorrencias',
        base: 'dados_ocorrencias',
        funcaoAdicional: ['atualizarToolbarRelatorio'],
        criarLinha: 'criarLinhaRelatorio'
    })

    tela.innerHTML = `<div class="painel-interno">${tabela}</div>`

    titulo.textContent = 'Relatório de Ocorrências'

    removerOverlay()

    await paginacao()

}

async function atualizarToolbarRelatorio() {

    const toolbarRelatorio = document.getElementById('toolbarRelatorio')

    if (toolbarRelatorio)
        toolbarRelatorio.innerHTML = `<img src="gifs/loading.gif" style="width: 5rem;">`

    const modelo = ({ texto, qtde, porcentagem, cor }) => `
        <div style="background-color: ${cor};" class="balao-totais">
            <label>${texto}</label>

            <div style="${horizontal}; gap: 1rem;">
                <label style="font-size: 2rem;">${qtde}</label>
                ${porcentagem ? `<label>${(porcentagem * 100).toFixed(0)}%</label>` : ''}
            </div>

        </div>`

    const filtros = controles?.relatorioOcorrencias?.filtros || {}

    const contador = await contarPorCampo({
        base: 'dados_ocorrencias',
        filtros,
        explode: { path: 'snapshots.ultimaCorrecao' },
        path: 'nome'
    })

    const { todos, SOLUCIONADA } = contador

    const campos = []
    campos.push(
        modelo({ texto: 'Total', qtde: todos, cor: '#222' }),
        modelo({ texto: 'Solucionados', porcentagem: SOLUCIONADA / todos, qtde: SOLUCIONADA || 0, cor: '#1d7e45' }),
        modelo({ texto: 'Em Aberto', porcentagem: (todos - SOLUCIONADA) / todos, qtde: todos ? (todos - SOLUCIONADA) : 0, cor: '#b12425' })
    )

    if (toolbarRelatorio)
        toolbarRelatorio.innerHTML = campos.join('')

}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '-'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

async function criarLinhaRelatorio(ocorrencia) {

    const { id, snapshots, data_registro } = ocorrencia || {}
    const { nomesStatus, ultimaCorrecao, cliente, empresa, tipo, prioridade, sistema } = snapshots || {}

    const labelTipoCorrecao = (nomesStatus || [])
        .map(st => formatacaoTipoCorrecao(st))
        .join('')

    const executores = [...new Set(
        Object.values(ocorrencia?.correcoes || {})
            .flatMap(correcao => correcao?.executor)
            .filter(Boolean) // Remove valores nulos, indefinidos ou strings vazias
    )]
        .map(nome => `<span>• ${nome}</span>`)
        .join('')

    const datasAgendadas = (ultimaCorrecao || [])
        .filter(corr => corr.dtCorrecao)
        .map(corr => corr.dtCorrecao)

    const tds = `
        <td>
            <div style="${horizontal}">
                <img src="imagens/pesquisar2.png" style="width: 2rem; cursor: pointer;" onclick="abrirCorrecaoRelatorio('${id}')">
            </div>
        </td>
        <td>${empresa}</td>
        <td>${id}</td>
        <td>
            <div style="${vertical}; gap: 1px;">${labelTipoCorrecao}</div>
        </td>
        <td>${data_registro || ''}</td>
        <td>
            ${datasAgendadas.join(', ')}
        </td>
        <td>${ocorrencia?.usuario || ''}</td>
        <td>
            <div style="${vertical}; gap: 2px;">${executores}</div>
        </td>
        <td>${tipo}</td>
        <td>${cliente?.nome || '-'}</td>
        <td>${cliente?.cidade || '-'}</td>
        <td>${cliente?.estado || '-'}</td>
        <td>${sistema}</td>
        <td>${prioridade}</td>
    `

    return `<tr>${tds}</tr>`

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
        'Empresa': { chave: 'snapshots.empresa' },
        'Chamado': { chave: 'id' },
        'Tipo Correção': { chave: 'tipoCorrecao' },
        'Descrição': { chave: 'descricao' },
        'Data Registro': { chave: 'data', tipoPesquisa: 'data' },
        'Solicitante': { chave: 'usuario' },
        'Executor': { chave: 'executor' },
        'Loja': { chave: 'snapshots.cliente.nome' },
        'Cidade': { chave: 'snapshots.cliente.cidade' },
        'Estado': { chave: 'snapshots.cliente.estado' },
        'Sistema': { chave: 'snapshots.sistema' }
    }

    const btnExtras = `
        <div class="toolbar-itens">
            <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">
            <span onclick="baixarExcelRelatorioCorrecoes()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
        </div>
    `

    const tabela = await modTab({
        colunas,
        btnExtras,
        filtros: {
            ...(
                acesso.permissao == 'cliente'
                    ? { 'snapshots.cliente.empresa': { op: '=', value: acesso?.empresa } }
                    : {}
            )
        },
        substituicoes: [
            {
                path: 'tipoCorrecao',
                tabela: 'correcoes',
                campoBusca: 'id',
                retorno: 'nome',
                destino: 'tipoCorrecaoNome'
            }
        ],
        explode: {
            path: 'correcoes'
        },
        base: 'dados_ocorrencias',
        pag: 'relatorioCorrecoes',
        body: 'bodyCorrecoes',
        criarLinha: 'criarLinhasCorrecoes',
    })


    tela.innerHTML = `<div class="painel-interno">${tabela}</div>`

    titulo.textContent = 'Relatório de Correções'

    removerOverlay()

    await paginacao()


}

async function criarLinhasCorrecoes(correcao) {

    const { id, snapshots, tipoCorrecao, descricao, executor, data, usuario, tipoCorrecaoNome } = correcao || {}
    const { cliente, empresa, sistema } = snapshots || {}
    const { nome, cidade, estado } = cliente || {}

    const dtRegistro = data
        ? data.split(',')[0]
        : ''

    const tds = `
        <td>${empresa}</td>
        <td>${id}</td>
        <td>${formatacaoTipoCorrecao(tipoCorrecaoNome)}</td>
        <td>
            <div style="white-space: pre-wrap;">${descricao || ''}</div>
        </td>
        <td>${dtRegistro}</td>
        <td>${usuario || ''}</td>
        <td>${executor || ''}</td>
        <td>${nome || ''}</td>
        <td>${cidade || ''}</td>
        <td>${estado || ''}</td>
        <td>${sistema}</td>
        `

    return `<tr>${tds}</tr>`

}

async function telaRelatorioPecas() {

    overlayAguarde()

    const colunas = {
        'Chamado': { chave: 'id' },
        'Empresa': { chave: 'snapshots.empresa' },
        'Loja': { chave: 'snapshots.cliente.nome' },
        'Técnico': { chave: 'tecnico' },
        'Data Correção': { chave: 'dtCorrecao', tipoPesquisa: 'data' },
        'Origem': { chave: 'origem' },
        'Série': { chave: 'serie' },
        'Descrição': { chave: 'descricao' },
        'Unidade': { chave: 'unidade' },
        'Quantidade': { chave: 'quantidade' },
        'Modelo': { chave: 'modelo' },
        'Fabricante': { chave: 'fabricante' },
    }

    const btnExtras = `
        <div class="toolbar-itens">
            <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">
            <span onclick="baixarExcelRelatorioPecas()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
        </div>
    `

    const tabela = await modTab({
        colunas,
        btnExtras,
        filtros: {
            ...(
                acesso.permissao == 'cliente'
                    ? {
                        'snapshots.cliente.empresa': [
                            { op: 'NOT_EMPTY' },
                            { op: '=', value: acesso?.empresa }
                        ]
                    }
                    : {}
            )
        },
        explode: {
            path: 'snapshots.equipamentos'
        },
        base: 'dados_ocorrencias',
        pag: 'relatorioPecas',
        body: 'bodyPecas',
        criarLinha: 'criarLinhasPecas',
    })

    tela.innerHTML = `<div class="painel-interno">${tabela}</div>`

    titulo.textContent = 'Relatório de Peças'

    removerOverlay()

    await paginacao()

}

async function criarLinhasPecas(equipamento) {

    const {
        id,
        departamento,
        correcoes,
        snapshots,
        tecnico = [],
        dtCorrecao,
        serie,
        descricao,
        unidade,
        quantidade,
        modelo,
        origem,
        fabricante
    } = equipamento || {}

    const {
        cliente,
        empresa
    } = snapshots || {}

    const tds = `
            <td>${departamento}</td>
            <td>${empresa || ''}</td>
            <td>${cliente?.nome || ''}</td>
            <td>${tecnico ? tecnico.join(', ') : ''}</td>
            <td>${dtCorrecao || ''}</td>
            <td>${origem || ''}</td>
            <td>${serie ? serie.filter(v => v).join(' ,') : ''}</td>
            <td>${descricao || ''}</td>
            <td>${unidade || ''}</td>
            <td>${quantidade || ''}</td>
            <td>${modelo || ''}</td>
            <td>${fabricante || ''}</td>
            `

    return `<tr>${tds}</tr>`

}

async function baixarExcelRelatorioOcorrencias() {
    
    overlayAguarde()

    const schema = {
        view: "vw_relatorio_ocorrencias",
        titulo: `Ocorrencias_${Date.now()}.xlsx`,

        filtros: [
            { custom: "(excluido IS NULL OR excluido = '')" }
        ],

        formatacao: {
            datas: ["Data Registro", "Data Agendamento"]
        }
    }

    if (acesso.permissao === 'cliente') {
        schema.filtros.push({
            field: "id_empresa",
            op: "=",
            value: acesso.empresa
        })
    }

    try {
        await baixarRelatorioExcel(schema, `Ocorrências_${Date.now()}`)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }
}

async function baixarExcelRelatorioCorrecoes() {

    overlayAguarde()
    const schema = {
        view: "vw_relatorio_correcoes",
        titulo: "Relatorio_correcoes.xlsx",

        filtros: [
            { custom: "(excluido IS NULL OR excluido = '')" }
        ],

        formatacao: {}
    }

    if (acesso.permissao === 'cliente') {
        schema.filtros.push({
            field: "id_empresa",
            op: "=",
            value: acesso.empresa
        })
    }

    try {
        await baixarRelatorioExcel(schema, `Correções_${Date.now()}`)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }
}

async function baixarExcelRelatorioPecas() {

    overlayAguarde()

    const schema = {
        view: "vw_relatorio_pecas",
        titulo: "Relatorio_pecas.xlsx",

        filtros: [
            { custom: "(excluido IS NULL OR excluido = '')" }
        ],

        formatacao: {}
    }

    if (acesso.permissao === 'cliente') {
        schema.filtros.push({
            field: "id_empresa",
            op: "=",
            value: acesso.empresa
        })
    }

    try {
        await baixarRelatorioExcel(schema, `Peças_${Date.now()}`)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }

}