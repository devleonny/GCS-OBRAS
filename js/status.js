let unidadeOrc = null
const altNumOrc = ['adm', 'analista']
const opcoesPedidos = ['Locação', 'Serviço', 'Venda', 'Venda + Serviço', 'POC']
const opcoesRequisicao = ['SERVIÇO', 'VENDA', 'USO E CONSUMO', 'LOCAÇÃO']
const transportadoras = ['', 'JAMEF', 'CORREIOS', 'RODOVIÁRIA', 'JADLOG', 'AÉREO', 'OUTRAS']
const permAtalhos = ['adm', 'fin', 'diretoria', 'coordenacao', 'gerente']
const permAltStatus = ['adm', 'diretoria']
const statusExclusivosLog = ['ENVIADO', 'ENTREGUE']

const fluxograma = [
    'SEM STATUS',
    'COTAÇÃO',
    'ORC PENDENTE',
    'ORC ENVIADO',
    'ORC APROVADO',
    'ORC REPROVADO',
    'VENDA DIRETA',
    'REQUISIÇÃO',
    'NFE VENDA',
    'PEND INFRA',
    'PEND ASSISTÊNCIA TÉCNICA',
    'ENVIADO',
    'ENTREGUE',
    'AGENDAMENTO',
    'EM ANDAMENTO',
    'POC EM ANDAMENTO',
    'OBRA PARALISADA',
    'PENDENTE OS/RELATÓRIO',
    'ACORDO FINANCEIRO',
    'PENDENTE PEDIDO',
    'REPROVADO PELO FINANCEIRO',
    'CONCLUÍDO',
    'FATURADO',
    'ATRASADO',
    'PAG RECEBIDO',
    'LOCAÇÃO',
    'GARANTIA'
]

const coresST = {
    'PEDIDO': { cor: '#4CAF50' },
    'LPU PARCEIRO': { cor: '#0062d5' },
    'REQUISIÇÃO': { cor: '#B12425' },
    'MATERIAL SEPARADO': { cor: '#b17724' },
    'FATURADO': { cor: '#ff4500' },
    'MATERIAL ENVIADO': { cor: '#b17724' },
    'MATERIAL ENTREGUE': { cor: '#b17724' }
}

function aprovadoEmail(input) {

    const pedido = document.getElementById('pedido')
    pedido.value = input.checked ? 'Aprovado Via E-mail' : ''
    pedido.contentEditable = !input.checked

}

async function painelAdicionarPedido(id, chave) {

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const { pedido, tipo, empresa, valor, comentario } = orcamento?.status?.historico?.[chave] || {}

    const linhas = [
        {
            texto: 'Tipo de Pedido',
            elemento: `
                <select id="tipo">
                    ${opcoesPedidos.map(op => `<option ${tipo == op ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Aprovado por E-mail',
            elemento: `<input type="checkbox" style="width: 2rem; height: 2rem;" onclick="aprovadoEmail(this)">`
        },
        {
            texto: 'Número do Pedido',
            elemento: `<input type="text" id="pedido" value="${pedido || ''}">`
        },
        {
            texto: 'Valor do Pedido',
            elemento: `<input type="number" id="valor" value="${valor || ''}">`
        },
        {
            texto: 'Empresa a faturar',
            elemento: `
                <select id="empresa">
                    ${empresas.map(e => `<option ${empresa == e ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Comentário',
            elemento: `<textarea rows="5" id="comentario_status">${comentario || ''}</textarea>`
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            funcao: chave
                ? `salvarPedido('${id}', '${chave}')`
                : `salvarPedido('${id}')`,
            img: 'concluido'
        }
    ]

    popup({ linhas, botoes, titulo: chave ? 'Editar Pedido' : 'Novo Pedido' })

}

async function salvarPedido(id, chave = ID5digitos()) {

    overlayAguarde()

    const comentario_status = document.getElementById('comentario_status')
    const valor = document.getElementById('valor')
    const tipo = document.getElementById('tipo')
    const pedido = document.getElementById('pedido')
    const empresa = document.getElementById('empresa')

    if (valor.value == '' || tipo.value == 'Selecione' || pedido.value == '') {

        return popup({ mensagem: `Existem campos em Branco` })

    }

    const orcamento = await recuperarDado('dados_orcamentos', id)

    orcamento.status ??= {}
    orcamento.status.historico ??= {}

    const dados = {
        data: new Date().toLocaleString(),
        executor: acesso.usuario,
        comentario: comentario_status.value,
        valor: Number(valor.value),
        tipo: tipo.value,
        pedido: pedido.value,
        empresa: empresa.value,
        status: 'PEDIDO'
    }

    orcamento.status.historico[chave] = dados

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id}/status/historico/${chave}`, dados)

    removerPopup()
    await abrirEsquema(id)

}

function adicionarNotaAvulsa(id) {

    const linhas = [
        {
            texto: 'Número da nota',
            elemento: `<input id="nf" class="inputParcelas">`
        },
        {
            texto: 'Tipo',
            elemento: `<select id="tipo" class="inputParcelas">${['Venda', 'Serviço', 'Remessa'].map(op => `<option>${op}</option>`).join('')}</select>`
        },
        {
            texto: 'Valor',
            elemento: `R$ <input type="number" id="valor" placeholder="0,00" class="inputParcelas">`
        },
        {
            texto: `<div style="${horizontal}; gap: 1rem;"><span>Parcelas</span> <img src="imagens/baixar.png" onclick="maisParcela()"></div>`,
            elemento: `<div class="blocoParcelas"></div>`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarNotaAvulsa('${id}')` }
    ]

    popup({ linhas, botoes, titulo: 'Vincular Nota Fiscal' })
    maisParcela()
}

function maisParcela() {

    const htmlParcela = `
        <div name="parcela" style="${horizontal}; gap: 5px;">
            <label>R$</label>
            <input type="number" placeholder="0,00" class="inputParcelas">
            <input type="date" class="inputParcelas">
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
        </div>
    `

    document
        .querySelector('.blocoParcelas')
        .insertAdjacentHTML('beforeend', htmlParcela)
}

async function salvarNotaAvulsa(id) {

    overlayAguarde()

    const valor = (id) => {
        return document.getElementById(id).value
    }

    let nota = {
        status: 'FATURADO',
        executor: acesso.usuario,
        data: new Date().toLocaleDateString('pt-BR'),
        nf: valor('nf'),
        tipo: valor('tipo'),
        valor: Number(valor('valor')),
        parcelas: []
    }

    const parcelas = document.querySelectorAll('[name="parcela"]')

    parcelas.forEach((div, i) => {
        const inputs = div.querySelectorAll('input')
        nota.parcelas.push({ nParcela: (i + 1), nValor: Number(inputs[0].value), dDtVenc: new Date(inputs[1].value).toLocaleDateString('pt-BR') })
    })

    const idStatus = ID5digitos()
    const orcamento = await recuperarDado('dados_orcamentos', id)

    orcamento.status ??= {}
    orcamento.status.historico ??= {}

    orcamento.status.historico[idStatus] = nota

    await enviar(`dados_orcamentos/${id}/status/historico/${idStatus}`, nota)
    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    removerPopup()
    await abrirEsquema(id)

}

async function abrirAtalhos(id, idMaster) {

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const emAnalise = orcamento.aprovacao && orcamento.aprovacao.status !== 'aprovado'
    let botoesDisponiveis = ''
    let termoArquivar = 'Arquivar Orçamento'
    let iconeArquivar = 'pasta'

    if (orcamento.arquivado == 'S') {
        termoArquivar = 'Desarquivar Orçamento'
        iconeArquivar = 'desarquivar'
    }

    // Gambiarra para não mudar a posição das paradas;
    if (!emAnalise)
        botoesDisponiveis += `
        ${modeloBotoes('esquema', 'Histórico', `abrirEsquema('${id}')`)}
        ${modeloBotoes('painelcustos', 'Painel de Custos', `painelCustos('${id}')`)}`

    botoesDisponiveis += modeloBotoes('pdf', 'Abrir Orçamento em PDF', `irPdf('${id}', ${emAnalise})`)

    if (!emAnalise) {
        botoesDisponiveis += `
        ${modeloBotoes('Checklist', 'CHECKLIST', `telaChecklist('${id}')`)}
        ${modeloBotoes('excel', 'Baixar Orçamento em Excel', `ir_excel('${id}')`)}
        ${modeloBotoes('duplicar', 'Duplicar Orçamento', `duplicar('${id}')`)}
        ${modeloBotoes(iconeArquivar, termoArquivar, `arquivarOrcamento('${id}')`)}
        ${modeloBotoes('LG', 'OS em PDF', `abrirOS('${id}')`)}
        ${modeloBotoes('alerta', 'Definir Prioridade', `formularioOrcAprovado('${id}')`)}
        ${idMaster
                ? modeloBotoes('exclamacao', 'Desvincular Orçamento', `confirmarRemoverVinculo('${id}', '${idMaster}')`)
                : modeloBotoes('link', 'Vincular Orçamento', `vincularOrcamento('${id}')`)
            }
        `
    }

    if (orcamento?.usuario == acesso.usuario || permAtalhos.includes(acesso.permissao) || orcamento?.usuarios?.[acesso.usuario]) {
        botoesDisponiveis += `
        ${modeloBotoes('chave', 'Delegar outro analista', `usuariosAutorizados('${id}')`)}
        ${modeloBotoes('apagar', 'Excluir Orçamento', `confirmarExclusaoOrcamentoBase('${id}')`)}
        ${modeloBotoes('editar', 'Editar Orçamento', `editar('${id}')`)}
        ${modeloBotoes('gerente', 'Editar Dados do Cliente', `painelClientes('${id}')`)}
        `
    }

    if (altNumOrc.includes(acesso.permissao)) botoesDisponiveis += modeloBotoes('editar3', 'Alterar ORC > novo', `mudarNumORC('${id}')`)

    const modAlerta = (texto) => `
        <div class="alerta-pendencia" onclick="irORC('${id}')">
            <img src="gifs/alerta.gif">
            <span>${texto}</span>
        </div>
    `
    // Alertas
    const souResponsavel = Object
        .values(orcamento?.pda?.acoes || {})
        .some(a => a.responsavel == acesso.usuario && a.status == 'pendente')

    const atalho = souResponsavel
        ? modAlerta('Você tem <b>ações</b> pendentes! <br><small>Clique <b>aqui</b> para ver mais</small>')
        : ''

    let prioridade = 3
    const stLiberado = Object
        .values(orcamento?.status?.historicoStatus || {})
        .some(h => stLista.includes(h.para))

    if (!stLiberado) {
        const inicio = new Date(orcamento?.inicio)
        const hoje = new Date()
        const diffDias = Math.abs(hoje - inicio) / (1000 * 60 * 60 * 24)
        if (diffDias < 7) prioridade = 0
        else if (diffDias < 14) prioridade = 1
        else if (diffDias < 21) prioridade = 2
    }

    const prioridadeAtalho = prioridade < 3
        ? modAlerta(`Obra começará em breve! <br><small>Mude o status para 
            <b>Finalizado</b>, 
            <br><b>Obra paralisada</b>, 
            <b>POC Em andamento</b> 
            <br>ou 
            <b>Em andamento</b> 
            para remover</small>`)
        : ''

    const aviso = emAnalise
        ? `
        <div style="${horizontal}; gap: 1rem; padding: 1rem;">
            <img src="gifs/alerta.gif">
            <span>Este orçamento precisa ser aprovado!</span>
        </div>`
        : ''

    const dadosCabecalho = [
        ...orcamento.snapshots?.contrato || [],
        orcamento.snapshots?.cidade
    ]
        .filter(o => o)
        .join('<br>')

    const acumulado = `
        <div style="text-align: left;">
            ${dadosCabecalho}
        </div>
        <hr>
        <div style="${horizontal}; gap: 5px;">
            <span>Classificar como <b>CHAMADO</b></span>
            <input ${orcamento?.chamado == 'S' ? 'checked' : ''} onclick="ativarChamado(this, '${id}')" ${styChek} type="checkbox">
        </div>
        <hr>
        ${aviso}
        <div class="opcoes-orcamento">${botoesDisponiveis}</div>

        ${atalho}
        ${prioridadeAtalho}
    `

    const menuOpcoesOrcamento = document.querySelector('.menu-opcoes-orcamento')

    if (menuOpcoesOrcamento)
        return menuOpcoesOrcamento.innerHTML = acumulado

    popup({ elemento: `<div class="menu-opcoes-orcamento">${acumulado}</div>`, titulo: 'Opções do Orçamento' })

}

async function mudarNumORC(id) {

    overlayAguarde()

    const resposta = await numORC(id)

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    if (resposta.numero) {

        const orcamento = await recuperarDado('dados_orcamentos', id)
        orcamento.dados_orcam.contrato = resposta.numero
        await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

        popup({ mensagem: `Alterado para <b>${resposta.numero}</b>` })
    }

    removerOverlay()

}

async function abrirOS(idOrcamento) {

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))
    window.open('os.html', '_blank')

}

async function vincularOrcamento(idOrcamento) {

    controlesCxOpcoes.orcamento = {
        base: 'dados_orcamentos',
        retornar: ['snapshots.contrato'],
        colunas: {
            'Nome': { chave: 'snapshots.cliente' },
            'Tags': { chave: 'snapshots.tags' },
            'Dados': { chave: 'snapshots.contrato' },
            'Criado por': { chave: 'usuario' },
            'Responsáveis': { chave: 'snapshots.responsavel' }
        }
    }

    const elemento = `
        <div style="${vertical}; padding: 1rem;">
            <span>Escolha o <b>Orçamento</b> para vincular</span>

            <div style="${horizontal}; gap: 1rem;">
                <span class="opcoes"
                name="orcamento"
                onclick="cxOpcoes('orcamento')">
                    Selecione
                </span>
                <img src="imagens/concluido.png" style="width: 2rem;" onclick="confirmarVinculo('${idOrcamento}')">
            </div>
        </div>`

    popup({ elemento, titulo: 'Vincular orçamentos' })

}

async function confirmarVinculo(idOrcamento) {

    overlayAguarde()

    const orcamentoMaster = document.querySelector('[name="orcamento"]')
    const idMaster = orcamentoMaster.id

    if (!idMaster)
        return popup({ mensagem: 'Escolha um orçamento' })

    if (idMaster == idOrcamento)
        return popup({ mensagem: 'Os orçamentos são iguais [O mesmo]' })

    const dados = {
        data: new Date().toLocaleString(),
        usuario: acesso.usuario
    }

    enviar(`dados_orcamentos/${idMaster}/vinculados/${idOrcamento}`, dados)

    const orcamento = await recuperarDado('dados_orcamentos', idMaster)

    orcamento.vinculados ??= {}
    orcamento.vinculados[idOrcamento] = dados
    await inserirDados({ [idMaster]: orcamento }, 'dados_orcamentos')

    removerPopup()
    removerPopup()

}

async function confirmarRemoverVinculo(idOrcamento, master) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `desfazerVinculo('${idOrcamento}', '${master}')` }
    ]

    popup({ botoes, mensagem: 'Deseja desfazer vínculo?', nra: true })

}

async function desfazerVinculo(idSlave, idMaster) {

    overlayAguarde()

    const orcMaster = await recuperarDado('dados_orcamentos', idMaster)

    delete orcMaster.vinculados[idSlave]

    deletar(`dados_orcamentos/${idMaster}/vinculados/${idSlave}`)

    await inserirDados({ [idMaster]: orcMaster }, 'dados_orcamentos')

    removerPopup()

}

async function usuariosAutorizados(id) {

    controlesCxOpcoes.usuario = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const elemento = `
        <div style="${vertical}; padding: 1rem;">
            
            <div style="${horizontal}; gap: 5px;">
                <span class="opcoes" name="usuario" onclick="cxOpcoes('usuario')">Selecionar</span>
                <img src="imagens/concluido.png" style="width: 2rem;" onclick="delegarUsuario('${id}')">
            </div>

            <hr style="width: 100%;">

            <div id="autorizados" style="${vertical}; gap: 3px;"></div>
        </div>
    `

    popup({ elemento, autoDestruicao: ['usuario'] })

    await carregarAutorizados(id)

}

async function delegarUsuario(id, usuario) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)

    orcamento.usuarios ??= {}

    let dados = {}

    if (usuario) {

        delete orcamento.usuarios[usuario]
        dados = orcamento.usuarios
        deletar(`dados_orcamentos/${id}/usuarios/${usuario}`)

    } else {

        usuario = document.querySelector('[name="usuario"]').id

        if (!usuario) return popup({ mensagem: 'Selecione um usuário antes' })

        dados = {
            data: new Date().toLocaleString('pt-BR'),
            responsavel: acesso.usuario
        }

        orcamento.usuarios[usuario] = dados
        enviar(`dados_orcamentos/${id}/usuarios/${usuario}`, dados)
    }

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    await carregarAutorizados(id)

    removerOverlay()
}

async function carregarAutorizados(id) {

    const modelo = (usuario, dados) => `
        <span style="${horizontal}; gap: 3px;">
            <img onclick="delegarUsuario('${id}', '${usuario}')" src="imagens/cancel.png" style="width: 1.2rem;">
            ${usuario} - liberado em <b>${dados.data}</b> por <b>${dados.responsavel}</b>
        </span>
    `

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const liberados = Object.entries(orcamento?.usuarios || {})
        .map(([usuario, dados]) => modelo(usuario, dados))
        .join('')

    document.getElementById('autorizados').innerHTML = liberados ? liberados : 'Sem usuários autorizados por enquanto'

}

async function arquivarOrcamento(id) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)

    const arquivamento = orcamento?.arquivado == 'S' ? 'N' : 'S'
    orcamento.arquivado = arquivamento
    enviar(`dados_orcamentos/${id}/arquivado`, arquivamento)

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    removerOverlay()

    const img = orcamento.arquivado
        ? 'desarquivar'
        : 'pasta'

    const mensagem = orcamento.arquivado
        ? 'Arquivado com sucesso!'
        : 'Desarquivado com sucesso!'

    popup({ mensagem, imagem: `imagens/${img}.png` })

}

function divPorcentagem(porcentagem) {
    const valor = Math.max(0, Math.min(100, Number(porcentagem) || 0))

    return `
        <div style="z-index: 0; position: relative; border: 1px solid #666666; width: 100%; height: 16px; background: #eee; border-radius: 8px; overflow: hidden;">
            <div style="width: ${valor}%; height: 100%; background: ${valor >= 70 ? "#4caf50" : valor >= 40 ? "#ffc107" : "#f44336"};"></div>
            <label style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.7rem; color: #000;">
                ${valor}%
            </label>
        </div>
    `
}

function elementosEspecificos(id, chave, historico, orcamento) {

    const acumulado = []
    let funcaoEditar = ''

    const { status } = historico || {}

    if (status == 'REQUISIÇÃO') {

        const { transportadora, volumes, total_requisicao, pedido } = historico || {}

        const hisPedido = orcamento?.status?.historico?.[pedido] || {}

        funcaoEditar = `formularioRequisicao({id:'${id}', chave: '${chave}'})`
        acumulado.push(`
            ${hisPedido.pedido ? labelDestaque('Nº Pedido', hisPedido.pedido) : ''}
            ${hisPedido.tipo ? labelDestaque('Tipo', hisPedido.tipo) : ''}
            ${hisPedido.valor ? labelDestaque('Valor', dinheiro(hisPedido.valor)) : ''}
            ${hisPedido.empresa ? labelDestaque('Empresa a faturar', hisPedido.empresa) : ''}
            ${labelDestaque('Total Requisição', dinheiro(total_requisicao))}
            ${transportadora ? labelDestaque('Transportadora', transportadora) : ''}
            ${volumes ? labelDestaque('Volumes', volumes) : ''}

            <div style="background-color: ${coresST?.[status]?.cor || '#808080'}" 
                class="contorno-botoes" onclick="gerarPdfRequisicao('${id}', '${chave}', true)">
                <img src="imagens/pdfw.png" style="width: 1.5rem;">
                <label>Visualizar</label>
            </div>

            <div style="background-color: ${coresST?.[status]?.cor || '#808080'}" 
                class="contorno-botoes" onclick="gerarPdfRequisicao('${id}', '${chave}')">
                <img src="imagens/pdfw.png" style="width: 1.5rem;">
                <label>Baixar PDF</label>
            </div>`)

    } else if (status == 'LPU PARCEIRO') {

        funcaoEditar = `modalLPUParceiro('${id}', '${chave}')`

        acumulado.push(`
            ${labelDestaque('Total Parceiro', dinheiro(historico?.totais?.parceiro))}
            ${labelDestaque('Magem Disponível', dinheiro(historico?.totais?.margem))}
            ${labelDestaque('Desvio', dinheiro(historico?.totais?.desvio))},

            <div style="background-color: ${coresST?.[historico.status]?.cor || '#808080'}" 
                class="contorno-botoes" 
                onclick="gerarPdfParceiro('${id}', '${chave}', true)">
                <img src="imagens/pdfw.png" style="width: 1.5rem;">
                <label>Visualizar</label>
            </div>

            <div style="background-color: ${coresST?.[historico.status]?.cor || '#808080'}" 
                class="contorno-botoes" 
                onclick="gerarPdfParceiro('${id}', '${chave}')">
                <img src="imagens/pdfw.png" style="width: 1.5rem;">
                <label>Baixar PDF</label>
            </div>
        `)

    } else if (status == 'PEDIDO') {

        acumulado.push(`
            <div style="${vertical}; gap: 2px;">
                ${historico.empresa ? labelDestaque('Empresa a faturar', historico.empresa) : ''}
                ${labelDestaque('Pedido', historico.pedido)}
                ${labelDestaque('Valor', dinheiro(historico.valor))}
                ${labelDestaque('Tipo', historico.tipo)}
            </div>`)

        funcaoEditar = `painelAdicionarPedido('${id}', '${chave}')`

    } else if (status == 'FATURADO') {

        const parcelas = (historico?.parcelas || [])
            .map(parcela => `Parcela ${parcela.nParcela} <br> ${labelDestaque(parcela.dDtVenc, dinheiro(parcela.nValor))}`)
            .join('')


        let botaoDANFE = `
            ${labelDestaque('Nota', historico.nf)}
            ${labelDestaque('Tipo', historico.tipo)}
        `

        const codOmie = historico?.codOmie || historico?.notaOriginal?.compl?.nIdNF || historico?.notaOriginal?.Cabecalho?.nCodNF
        if (codOmie) {
            const tipo = historico.tipo.toLowerCase() == 'serviço' ? 'serviço' : 'venda_remessa'
            botaoDANFE = balaoPDF({ nf: historico.nf, codOmie, tipo, app: historico.app })
        }

        acumulado.push(`
            ${labelDestaque('Valor Total', dinheiro(historico.valor))}
            <br>
            ${botaoDANFE}
            ${parcelas}
        `)

    } else if (status.includes('MATERIAL')) {

        funcaoEditar = `envioMaterial('${id}', '${chave}')`

        acumulado.push(`
            ${labelDestaque('Rastreio', historico.rastreio)}
            ${labelDestaque('Transportadora', historico.transportadora)}
            ${labelDestaque('Data de Saída', conversorData(historico.data_saida))}
            ${labelDestaque('Data de Entrega', conversorData(historico.previsao))}
        `)
    }

    if (funcaoEditar !== '') {
        acumulado.push(`
        <div style="background-color: ${coresST?.[historico.status]?.cor || '#808080'}" class="contorno-botoes" onclick="${funcaoEditar}">
            <img src="imagens/editar4.png" style="width: 1.5rem;">
            <label>Editar</label>
        </div>`)
    }

    return acumulado.join('')

}

async function abrirEsquema(id) {

    overlayAguarde()

    if (!id)
        return popup({ mensagem: 'Ué, não abriu? Tente novamente...', imagem: 'gifs/offline.gif' })

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const contrato = orcamento?.dados_orcam?.contrato
    const oficial = orcamento?.dados_orcam?.chamado || orcamento?.dados_orcam?.contrato
    const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omie_cliente) || {}
    let blocosStatus = {}

    for (const [chave, historico] of Object.entries(orcamento?.status?.historico || {})) {

        const { anexos } = historico

        const statusCartao = historico.status
        const cor = coresST?.[statusCartao]?.cor || '#808080'

        blocosStatus[statusCartao] ??= ''

        const excluir = (historico.executor == acesso.usuario || acesso.permissao == 'adm')
            ? `<span 
                class="close" 
                style="font-size: 1.2rem; position: absolute; top: 5px; right: 15px;" 
                onclick="apagarStatusHistorico('${id}', '${chave}')">&times;</span>`
            : ''

        const stringAnexos = Object.entries(anexos || {})
            .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexo('${id}', '${chave}', '${idAnexo}', this)`))
            .join('')

        blocosStatus[statusCartao] += `
            <div class="bloco-status" style="border: 1px solid ${cor};">

                <div class="bloco-status-interno" style="background-color: ${cor}1f;">
                    ${excluir}
                    ${labelDestaque('Chamado', oficial)}
                    ${labelDestaque('Executor', historico.executor)}
                    ${labelDestaque('Data', historico.data)}
                    ${labelDestaque('Comentário', historico?.comentario || '')}

                    ${elementosEspecificos(id, chave, historico, orcamento)}
        
                    <div class="contorno-botoes" style="background-color: ${cor}">
                        <img src="imagens/anexo2.png" style="width: 1.5rem;">
                        <label>Anexo
                            <input type="file" style="display: none;" onchange="salvarAnexo('${id}', '${chave}', this)" multiple>  
                        </label>
                    </div>

                    <div name="anexos_${chave}" style="${vertical};">
                        ${stringAnexos}
                    </div>

                </div>

            </div>`
    }

    const blocos = Object
        .values(blocosStatus)
        .map(div => `
            <div class="cartao-status">
                ${div}
            </div>`)
        .join('')

    const linha1 = `
        <div style="${horizontal}; gap: 2rem;">

            <div style="${vertical}; gap: 2px;">
                <label>Status atual</label>
                ${seletorStatus(orcamento)}
            </div>
 
            <img onclick="mostrarHistoricoStatus('${id}')" src="imagens/historico.png">

            <label style="font-size: 1.5rem;">${oficial} - ${cliente?.nome || '??'}</label>

        </div>`

    const strAnexos = {
        levantamentos: '',
        finalizado: ''
    }

    for (const [idAnexo, anexo] of Object.entries(orcamento?.levantamentos || {})) {

        const local = anexo?.finalizado == 'S'
            ? 'finalizado'
            : 'levantamentos'

        strAnexos[local] += criarAnexoVisual(anexo.nome, anexo.link, `excluirLevantamentoStatus('${idAnexo}', '${id}')`)
    }

    const divLevantamentos = (finalizado) => {

        const local = finalizado
            ? 'finalizado'
            : 'levantamentos'

        return `
            <div style="${vertical}; gap: 2px; margin-right: 20px; margin-top: 10px;">

                <div class="contorno-botoes" onclick="document.getElementById('${local}').click()">
                    <img src="imagens/anexo2.png">
                    <label>Anexar ${local}</label>

                    <input
                        type="file" 
                        id="${local}"
                        style="display:none" 
                        data-finalizado="${finalizado ? 'S' : 'N'}"
                        onchange="salvarLevantamento('${id}', '${local}')" 
                        multiple>
                </div>

                ${strAnexos[local]}

            </div>`
    }

    // Checklist chamado;
    const enviado = Object.values(orcamento?.status?.historicoStatus || {})
        .some(h => h.para == 'ORC ENVIADO')

    const aprovado = Object.values(orcamento?.status?.historicoStatus || {})
        .some(h => h.para == 'ORC APROVADO')

    const pedido = Object.values(orcamento?.status?.historico || {})
        .some(h => h.status == 'PEDIDO')

    const chamado = orcamento?.chamado == 'S'
    const etapas = [
        {
            texto: `
                <div style="${horizontal}; gap: 5px;">
                    <span>Classificar como <b>CHAMADO</b></span>
                    <input ${chamado ? 'checked' : ''} onclick="ativarChamado(this, '${id}')" ${styChek} type="checkbox">
                </div>
            `,
            status: chamado
        },
        { texto: 'Orçamento enviado', status: enviado },
        { texto: 'Orçamento aprovado', status: aprovado },
        { texto: 'Criar um pedido', status: pedido }
    ]

    let liberado = true
    const checks = etapas
        .map(e => {

            if (!e.status) liberado = false

            return `
        <div class="status-check-item">
            <img src="imagens/${e.status ? 'concluido' : 'cancel'}.png">
            <div>${e.texto}</div>
        </div>`
        }).join('')

    const existente = await recuperarDado('dados_ocorrencias', contrato)
    const f1 = liberado
        ? `unidadeOrc = '${omie_cliente}'; formularioOcorrencia('${contrato}')`
        : ''
    const f2 = existente
        ? `formularioCorrecao('${contrato}')`
        : ''

    const pChamado = `
        <div class="status-check-ocorrencias">
            <span>Para abrir a <b>OCORRÊNCIA</b><br></span>
            <span>Realize as etapas abaixo:</span>
            <hr>
            ${checks}
            <hr>
            <div style="${horizontal}; gap: 1rem;">
                <button onclick="${f1}" style="opacity: ${liberado ? '1' : '0.5'};">Abrir chamado</button>
                <button onclick="${f2}" style="background-color: rgb(228, 122, 0); opacity: ${existente ? '1' : '0.5'};">Incluir correção</button>
                ${existente ? `<img src="imagens/pesquisar2.png" onclick="verCorrecoes('${contrato}')">` : ''}
            </div>
        </div>
    `

    const acumulado = `
        <div style="${vertical}; gap: 10px; padding: 3px;">

            ${linha1}

            <hr>

            <div class="status-botoes">
                
                ${botao('Novo Pedido', `painelAdicionarPedido('${id}')`, '#4CAF50')}
                ${botao('Requisição Materiais', `formularioRequisicao({id:'${id}', modalidade: 'materiais'})`, '#B12425')}
                ${botao('Requisição Equipamentos', `formularioRequisicao({id:'${id}', modalidade: 'equipamentos'})`, '#B12425')}
                ${botao('Nova Nota Fiscal', `adicionarNotaAvulsa('${id}')`, '#ff4500')}
                ${botao('Novo Envio de Material', `envioMaterial('${id}')`, '#b17724')}
                ${botao('LPU Parceiro', `modalLPUParceiro('${id}')`, '#0062d5')}

            </div>
        </div>

        <div class="container-blocos">
            <div style="${vertical}; witdth: 100%; gap: 0.5rem;">
                ${pChamado}
                ${divLevantamentos()}
                <hr>
                ${divLevantamentos(true)}
            </div>
            ${blocos}
        </div>`

    const janelaAtiva = document.querySelector('.painel-historico')
    if (janelaAtiva) {
        removerOverlay()
        janelaAtiva.innerHTML = acumulado
        return
    }

    popup({ elemento: `<div class="painel-historico">${acumulado}</div>`, titulo: 'Histórico do Orçamento' })

}

async function verCorrecoes(idOcorrencia) {

    const elemento = `
        <div class="status-correcoes">
            ${carregarCorrecoes()}
        </div>`

    popup({ elemento, titulo: 'Correções' })
}

function mostrarConfirmacao(elemento) {
    let img = elemento.nextElementSibling;
    img.style.display = 'block'
}

async function alterarStatus(id, select) {

    const orcamento = await recuperarDado('dados_orcamentos', id)
    if (!orcamento) return

    if (typeof orcamento.status == 'string' || !orcamento.status)
        orcamento.status = {}

    orcamento.status.historicoStatus ??= {}

    const statusAnterior = orcamento.status.atual || ''
    const novoSt = select.value

    if (statusAnterior === novoSt) return

    if (acesso?.setor === 'LOGÍSTICA' && !orcamento?.snapshots?.responsavel?.includes(acesso.usuario)) {
        if (!statusExclusivosLog.includes(novoSt)) {
            select.value = statusAnterior
            return popup({ mensagem: '<b>Seu acesso é de Logística:</b> Altere apenas os seus orçamentos ou somente para os status ENTREGUE ou ENVIADO' })
        }
    }

    const bloq = ['REQUISIÇÃO', 'CONCLUÍDO']

    const temPedido = Object.values(orcamento?.status?.historico || {})
        .some(s => s?.status === 'PEDIDO')

    if (!temPedido && bloq.includes(novoSt)) {
        select.value = statusAnterior
        popup({ mensagem: 'Não é possível ir para <b>REQUISIÇÃO</b> ou <b>CONCLUÍDO</b> se o orçamento não tiver Pedido' })
        return
    }

    const idStatus = ID5digitos()
    const agora = Date.now()

    const registroStatus = {
        timestamp: agora,
        de: statusAnterior,
        para: novoSt,
        usuario: acesso?.usuario || ''
    }

    orcamento.status.atual = novoSt
    orcamento.status.historicoStatus[idStatus] = registroStatus

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    enviar(`dados_orcamentos/${id}/status/atual`, novoSt)
    enviar(`dados_orcamentos/${id}/status/historicoStatus/${idStatus}`, registroStatus)

    if (novoSt === 'ORC PENDENTE')
        formularioOrcPendente(id, idStatus)

    if (novoSt === 'ORC APROVADO') {
        formularioOrcAprovado()
        const resposta = await criarDepartamento(id)
        if (resposta?.mensagem) popup({ mensagem: resposta.mensagem })
    }

    const pHistorico = document.querySelector('.painel-historico')
    if (pHistorico) await abrirEsquema(id)
}

async function formularioOrcAprovado(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const linhas = [
        {
            texto: 'Qual a previsão de início?',
            elemento: `
                <div style="${horizontal}; gap: 1rem;">
                    <input name="prioridade" oninput="mostrarPrioridade()" type="date" value="${orcamento?.inicio || ''}">
                    <div id="indicador"></div>
                </div>
                `
        }
    ]

    const funcao = `salvarPrioridade('${id}')`
    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao },
        { texto: 'Cancelar', img: 'cancel', funcao: 'removerPopup()' },
    ]

    popup({ linhas, botoes, titulo: 'Prioridade do Orçamento' })

}

async function salvarPrioridade(id) {

    const input = document.querySelector('[name="prioridade"]')
    const orcamento = await recuperarDado('dados_orcamentos', id)

    if (!input.value)
        return removerPopup()

    orcamento.inicio = input.value
    removerPopup()

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id}/inicio`, input.value)

    await abrirAtalhos(id)

}

async function irORC(id) {

    overlayAguarde()

    const tGerenciamento = document.querySelector('.tela-gerenciamento')
    if (!tGerenciamento)
        await telaInicialGCS()

    await tabelaPorAba({ id })

    removerPopup()

}

function mostrarPrioridade() {
    const div = document.getElementById('indicador')
    const input = document.querySelector('[name="prioridade"]')

    if (!div || !input || !input.value) return

    const hoje = new Date()
    const data = new Date(input.value)

    const diffDias = Math.abs(hoje - data) / (1000 * 60 * 60 * 24)

    let img = ''

    if (diffDias < 7) img = 'gifs/atencao.gif'
    else if (diffDias < 14) img = 'gifs/alerta.gif'
    else if (diffDias < 21) img = 'imagens/pendente.png'
    else img = 'imagens/online.png'

    div.innerHTML = `<img src="${img}">`
}

async function mostrarInfo(idOrcamento) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    const historico = Object.entries(orcamento?.status?.historicoStatus || {})
        .sort(([, a], [, b]) => {
            const aTemInfo = !!a?.info
            const bTemInfo = !!b?.info

            if (aTemInfo && !bTemInfo) return -1
            if (!aTemInfo && bTemInfo) return 1
            return 0
        })

    let campos = ''

    for (const [chave, his] of historico) {

        campos += `
        <div id="${chave}" class="etiquetas" style="${vertical}; gap: 2px; padding: 0.5rem;">
            <span>${his.para} • ${his.data}</span>
            <div name="info" oninput="editarHistorico('${chave}')" class="comentario-padrao" contentEditable="true">${his.info || ''}</div>
            <div style="${horizontal}; gap: 1rem;">
                <span name="responsavel">${his.usuario}</span>
                <img name="confirmar" onclick="salvarInfoAdicional('${chave}')" src="imagens/concluido.png" style="display: none;">
            </div>
        </div>
        `
    }

    const elemento = `
        <div class="comentario-orcamento">
            ${campos || 'Sem histórico de Status'}
        </div>
    `

    popup({ elemento, titulo: 'Informações' })

}

function editarHistorico(chave) {
    const div = document.getElementById(chave)
    div.querySelector('[name="responsavel"]').textContent = acesso.usuario
    div.querySelector('[name="confirmar"]').style.display = ''
}

function formularioOrcPendente(id, idStatus) {
    const linhas = [
        {
            texto: 'Por que <b>ORC PENDENTE</b>?',
            elemento: `
            <div id="${idStatus}">
                <div class="comentario-padrao" name="info" contentEditable="true"></div>
            </div>
            `
        }
    ]
    const funcao = `salvarInfoAdicional('${id}', '${idStatus}')`
    const botoes = [{ texto: 'Salvar', img: 'concluido', funcao }]
    popup({ linhas, botoes, titulo: 'Informação adicional' })

}

async function salvarInfoAdicional(id, idStatus) {

    overlayAguarde()
    const div = document.getElementById(idStatus)
    const info = div.querySelector('[name="info"]').textContent
    const orcamento = await recuperarDado('dados_orcamentos', id)
    orcamento.status.historicoStatus[idStatus].info = info
    orcamento.status.historicoStatus[idStatus].usuario = acesso.usuario
    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id}/status/historicoStatus/${idStatus}/info`, info)
    enviar(`dados_orcamentos/${id}/status/historicoStatus/${idStatus}/usuario`, acesso.usuario)
    removerPopup()

}

async function mostrarHistoricoStatus(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id)

    if (!orcamento?.status?.historicoStatus || Object.entries(orcamento.status.historicoStatus).length === 0) {
        popup({ mensagem: 'Nenhuma alteração de status registrada', titulo: 'Histórico de Status' })
        return
    }

    const elemento = `
        <div style="${vertical}; padding: 1rem;">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Status Anterior</th>
                            <th>Novo Status</th>
                            <th>Alterado por</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(orcamento.status.historicoStatus).map(([chave, registro]) => `
                            <tr id="ST_${chave}">
                                <td>${registro.data}</td>
                                <td>${registro.de}</td>
                                <td>${registro.para}</td>
                                <td>${registro.usuario}</td>
                                <td>
                                    ${acesso.permissao == 'adm' ? `<img onclick="excluirHiStatus('${id}', '${chave}')" src="imagens/cancel.png">` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    popup({ elemento, titulo: 'Histórico de Alterações de Status' })
}

async function excluirHiStatus(id, idStatus) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)
    delete orcamento.status.historicoStatus[idStatus]

    const trExistente = document.getElementById(`ST_${idStatus}`)
    if (trExistente)
        trExistente.remove()

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    deletar(`dados_orcamentos/${id}/status/historicoStatus/${idStatus}`)

    const pHistorico = document.querySelector('.painel-historico')
    if (pHistorico)
        await abrirEsquema(id)

    removerOverlay()

}

async function excluirAnexo(id, chave, idAnexo, img) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)

    delete orcamento.status.historico[chave].anexos[idAnexo]

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    deletar(`dados_orcamentos/${id}/status/historico/${chave}/anexos/${idAnexo}`)

    img.parentElement.remove()

    removerOverlay()

}

async function confirmarExclusaoOrcamentoBase(id) {
    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirOrcamentoBase('${id}')` }
    ]
    popup({ mensagem: 'Deseja realmente excluir o orçamento?', botoes })
}

async function excluirOrcamentoBase(idOrcamento) {
    removerPopup()
    overlayAguarde()

    await deletarDB('dados_orcamentos', idOrcamento)

    deletar(`dados_orcamentos/${idOrcamento}`)

    removerPopup()
}

async function formularioRequisicao({ id, chave = ID5digitos(), modalidade }) {

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const cliente = await recuperarDado('dados_clientes', orcamento.dados_orcam.omie_cliente) || {}
    const cartao = orcamento?.status?.historico?.[chave] || {}
    const { volumes, transportadora, empresa, pedido } = cartao

    const pedidos = Object.fromEntries(
        Object.entries(orcamento?.status?.historico || {})
            .filter(([, dados]) => dados.status == 'PEDIDO')
            .map(([chave, dados]) => {
                return [chave, { id: chave, ...dados }]
            })
    )

    controlesCxOpcoes.pedido = {
        base: pedidos,
        retornar: ['pedido'],
        colunas: {
            'Pedido': { chave: 'pedido' },
            'Tipo': { chave: 'tipo' },
            'Valor': { chave: 'valor' },
        }
    }

    const numPedido = orcamento?.status?.historico?.[pedido]?.pedido || 'Selecionar'

    const campos = `
        <div class="requisicao-contorno" style="width: 500px;">
            <div class="requisicao-titulo">Dados da Requisição</div>
            <div class="requisicao-dados">

                <div style="${vertical}; width: 100%;">
                    <span>Número do Pedido</span>
                    <span ${pedido ? `id="${pedido}"` : ''} name="pedido" class="opcoes" onclick="cxOpcoes('pedido')">
                        ${numPedido}
                    </span>
                </div>
                
                <div style="${vertical}; width: 100%;">
                    <span>Transportadora</span>
                    <select id="transportadora">
                        ${transportadoras.map(op => `<option ${transportadora == op ? 'selected' : ''}>${op}</option>`).join('')}
                    </select>
                </div>

                <div style="${vertical}; width: 100%;">
                    <span>Volumes</span>
                    <input value="${volumes || ''}" id="volumes" type="number">
                </div>

                <div style="${vertical}; width: 100%;">
                    <label>Comentário</label>
                    <textarea rows="3" id="comentario" style="width: 80%;">${cartao?.comentario || ''}</textarea>
                </div>

                <button data-ocultar onclick="salvarRequisicao('${id}', '${chave}')">Salvar Requisição</button>
            </div>
        </div>`

    const modeloLabel = (valor1, valor2) => `<label><b>${valor1}</b> ${valor2}</label>`

    const colunas = {
        'Imagem': {},
        'Cod GCS': { chave: 'codigo' },
        'Cod OMIE': {},
        'Informações do Item': { chave: 'descricao' },
        'Tipo': { chave: 'tipo' },
        'Quantidade': {},
        'Quantidade Orçada': {},
        'Valor Unitário': {},
        'Valor Total': {}
    }

    const materiais = ['eletrocalha', 'eletroduto', 'perfilado', 'sealtubo']

    const base = Object.fromEntries(
        Object.entries(cartao.requisicao || orcamento.dados_composicoes || {})
            .filter(([, dados]) => {

                if (dados.tipo == 'SERVIÇO')
                    return false

                if (!modalidade)
                    return true

                const contemMaterial = materiais
                    .some(m => (dados.descricao || '').toLowerCase().includes(m))

                if (modalidade === 'materiais' && contemMaterial)
                    return true

                if (modalidade === 'equipamentos')
                    return true

                return false
            })
    )

    const tabela = modTab({
        base,
        pag: 'requisicao',
        funcaoAdicional: ['calcularRequisicao'],
        body: 'bodyRequisicao',
        colunas,
        criarLinha: 'criarLinhaRequisicao'
    })

    const elemento = `
    <div id="pdf" class="requisicao-tela" data-chave="${chave}" data-id="${id}">

        <div class="requisicao-contorno" style="width: 98%">
            <div class="requisicao-cabecalho">
                <img src="https://i.imgur.com/5zohUo8.png">
                <span>REQUISIÇÃO DE COMPRA DE MATERIAL</span>
            </div>
        </div>

        <div style="${horizontal}; gap: 2rem; margin: 10px;">

            ${campos}
                
            <div class="requisicao-contorno">
                <div class="requisicao-titulo">Dados do Cliente</div>
                <div class="requisicao-dados">

                    ${modeloLabel('Cliente', cliente?.nome || '')}
                    ${modeloLabel('CNPJ', cliente?.cnpj || '')}
                    ${modeloLabel('Endereço', cliente?.endereco || '')}
                    ${modeloLabel('Bairro', cliente?.bairro || '')}
                    ${modeloLabel('Cidade', cliente?.cidade || '')}
                    ${modeloLabel('Chamado', orcamento.dados_orcam.contrato)}
                    ${modeloLabel('Condições', orcamento.dados_orcam.condicoes)}

                </div>
            </div>

            <div class="requisicao-contorno">
                <div class="requisicao-titulo">Total</div>
                <div class="requisicao-dados">
                    <label style="white-space: nowrap;" id="total_requisicao"></label> 
                </div>
            </div>

        </div>

        ${tabela}

    <div>`

    popup({ elemento, cor: 'white', titulo: 'Requisição', autoDestruicao: ['requisicao', 'pedido'] })

    await paginacao()

}

async function criarLinhaRequisicao(item) {

    const { imagem, codigo, custo, tipo, adicionais, descricao, qtde_enviar, qtde } = item || {}

    const { omie } = await recuperarDado('dados_composicoes', codigo) || {}

    const linhaPrincipal = `
        <tr data-codigo="${codigo}">
            <td>
                <img src="${imagem || logo}">
            </td>
            <td style="font-size: 1.2em; white-space: nowrap;">
                ${codigo}
            </td>
            <td>
                <input class="requisicao-campo" style="min-width: 10rem;" value="${omie || ''}">
            </td>
            <td>
                <div style="${horizontal}; justify-content: space-between; min-width: 200px; gap: 1rem;">
                    <div style="${vertical}; gap: 2px;">
                        <label><strong>DESCRIÇÃO</strong></label>
                        <label style="text-align: left;">${descricao || ''}</label>
                    </div>
                    <img src="imagens/construcao.png" onclick="abrirAdicionais('${codigo}')">
                </div>
            </td>
            <td>
                <select class="opcoesSelect" style="min-width: 150px;"  onchange="controles.requisicao.base['${codigo}'].tipo = this.value">
                    ${opcoesRequisicao.map(o => `<option ${tipo == o ? 'selected' : ''}>${o}</option>`).join('')}
                </option>
            </td>
            <td>
                <div style="${vertical}; gap: 2px;">
                    <label>Quantidade a enviar</label>
                    <input 
                        class="requisicao-campo" 
                        type="number" name="qtde" 
                        oninput="calcularRequisicao()" 
                        min="0" 
                        value="${qtde_enviar || ''}">
                </div>
            </td>
            <td style="text-align: center;" name="qtde_orcamento">
                ${qtde || 0}
            </td>
            <td style="white-space: nowrap;" name="custo">
                ${dinheiro(custo)}
            </td>
            <td name="total" style="white-space: nowrap;"></td>
        </tr>
        `

    const linhaAdicional = Object.values(adicionais || {})
        .map(a => {
            const tr = `
                    <tr style="background-color: #ededed;">
                        <td></td>
                        <td>${codigo}</td>
                        <td></td>
                        <td>${a.descricao}</td>
                        <td>ITEM ADICIONAL</td>
                        <td style="text-align: center;">${a.qtde}</td>
                        <td colspan="3">${a.comentario}</td>
                    </tr>
                `
            return tr
        })
        .join('')

    return linhaPrincipal + linhaAdicional
}

async function abrirAdicionais(codigo) {

    const ths = ['Descrição', 'Quantidade', 'Comentário', '']
        .map(op => `<th>${op}</th>`)
        .join('')

    const botoes = [
        { texto: 'Adicionar Peça', img: 'baixar', funcao: `criarLinhaPeca()` },
        { texto: 'Atualizar', img: 'atualizar', funcao: 'atualizarGCS()' },
        { texto: 'Salvar', img: 'concluido', funcao: `salvarAdicionais('${codigo}')` }
    ]

    const linhas = [
        {
            elemento: `
            <div style="${vertical}; width: 100%;">
                <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela">
                            <thead><tr>${ths}</tr></thead>
                            <tbody id="linhasManutencao"></tbody>
                        </table>
                    </div>
                <div class="rodape-tabela"></div>
            </div>`
        }
    ]

    popup({ linhas, botoes, titulo: 'Itens Adicionais' })

    const adicionais = controles.requisicao?.base?.[codigo]?.adicionais || {}

    for (const [codigo, dados] of Object.entries(adicionais)) {

        criarLinhaPeca(codigo, dados)

    }

}

async function salvarAdicionais(codigo) {

    const linhas = document.querySelectorAll('#linhasManutencao tr')

    const adicionais = [...linhas].reduce((acc, linha) => {

        const tds = linha.querySelectorAll('td')
        const cod = linha.id

        const span = tds[0].querySelector('span')
        const qtde = Number(tds[1].querySelector('input')?.value || 0)
        const comentario = tds[2].querySelector('textarea')?.value || ''

        acc[cod] = {
            descricao: span.textContent,
            qtde,
            comentario
        }

        return acc
    }, {})

    controles.requisicao.base[codigo].adicionais = adicionais

    removerPopup()
    await paginacao()
}


async function calcularRequisicao() {

    const tRequisicao = document.querySelector('.requisicao-tela')
    const id = tRequisicao.dataset.id

    if (!id)
        return

    const chave = tRequisicao.dataset.chave
    const { status } = await recuperarDado('dados_orcamentos', id) || {}

    const reqs = Object.entries(status.historico || {})
        .filter(([c, his]) => (c !== chave && his.status == 'REQUISIÇÃO'))

    const linhas = document.querySelectorAll('#bodyRequisicao tr')

    let total = 0

    for (const linha of linhas) {

        const codigo = linha.dataset.codigo
        if (!codigo)
            continue

        // Cálculo total deste item em outras requisições;
        const totalExistente = reqs
            .map(([, r]) => r?.requisicao?.[codigo]?.qtde_enviar || 0)
            .reduce((soma, valor) => soma + valor, 0)

        // Quantidade orçada;
        const qtdeOrcamento = conversor(linha.querySelector('[name="qtde_orcamento"]').textContent)
        const quantidadeRestante = qtdeOrcamento - totalExistente
        const campoQtde = linha.querySelector('[name="qtde"]')

        if (Number(campoQtde.value) > quantidadeRestante)
            campoQtde.value = quantidadeRestante

        const custo = conversor(linha.querySelector('[name="custo"]').textContent)
        const qtde = Number(campoQtde?.value || 0)

        // Objeto será capturado depois;
        controles.requisicao.base[codigo].qtde_enviar = qtde

        const totalLinha = custo * qtde
        total += totalLinha

        linha.querySelector('[name="total"]').textContent = dinheiro(totalLinha)

    }

    document.querySelector('#total_requisicao').textContent = dinheiro(total)

}

async function salvarRequisicao(id, chave) {

    overlayAguarde()
    const orcamento = await recuperarDado('dados_orcamentos', id) || {}

    try {
        orcamento.status ??= {}
        orcamento.status.historico ??= {}

        const pedido = document.querySelector('[name="pedido"]')?.id

        if (!pedido)
            return popup({ mensagem: 'Escolha um pedido' })

        orcamento.status.historico[chave] = {
            ...orcamento.status.historico[chave],
            executor: acesso.usuario,
            status: 'REQUISIÇÃO',
            data: new Date().toLocaleString(),
            comentario: document.querySelector('#comentario').value || '',
            pedido,
            volumes: document.querySelector('#volumes').value || 0,
            transportadora: document.querySelector('#transportadora').value || '',
            total_requisicao: conversor(document.querySelector('#total_requisicao').textContent),
            requisicao: controles.requisicao.base || {}
        }

        await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
        enviar(`dados_orcamentos/${id}/status/historico/${chave}`, orcamento.status.historico[chave])
        removerPopup()
        await abrirEsquema(id)

    } catch (err) {
        console.warn(err)
        popup({ mensagem: err.message || 'Falha ao salvar Requisição' })
    }

}

async function salvarAnexo(id, chave, input) {

    const orcamento = await recuperarDado('dados_orcamentos', id)

    if (input.files.length === 0) {
        popup({ elemento: 'Nenhum arquivo selecionado...' })
        return
    }

    // Retorna uma lista [{}, {}]
    const anexos = await importarAnexos({ input })

    if (anexos.resposta)
        return popup({ mensagem: anexos.mensagem })

    orcamento.status.historico[chave].anexos ??= {}

    orcamento.status.historico[chave].anexos = {
        ...orcamento.status.historico[chave].anexos,
        ...Object.fromEntries(
            anexos.map(a => {
                console.log(a)
                return [a.link, a]
            })
        )
    }

    enviar(`dados_orcamentos/${id}/status/historico/${chave}/anexos`, orcamento.status.historico[chave].anexos)

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')

    const div = document.querySelector(`[name="anexos_${chave}"]`)

    const stringAnexos = Object.entries(orcamento.status.historico[chave].anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexo('${id}', '${chave}', '${idAnexo}', this)`))
        .join('')

    div.innerHTML = stringAnexos

}

async function apagarStatusHistorico(id, chave) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `confirmarExclusaoStatus('${id}', '${chave}')` }
    ]

    popup({ botoes, mensagem: 'Excluir item do histórico?', titulo: 'Excluir Status' })
}


async function confirmarExclusaoStatus(id, chave) {

    removerPopup()
    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    delete orcamento.status.historico[chave]
    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    deletar(`dados_orcamentos/${id}/status/historico/${chave}`)

    await abrirEsquema(id)

}

if (typeof window !== 'undefined' && window.process && window.process.type) {
    const { shell: electronShell } = require('electron');
    shell = electronShell;
}

let ipcRenderer = null;
if (typeof window !== 'undefined' && window.process && window.process.type) {
    const { ipcRenderer: ipc } = require('electron');
    ipcRenderer = ipc;

    ipcRenderer.on('open-save-dialog', (event, { htmlContent, nomeArquivo }) => {
        ipcRenderer.send('save-dialog', { htmlContent, nomeArquivo });
    });
}

async function envioMaterial(id, chave = ID5digitos()) {

    const orcamento = await recuperarDado('dados_orcamentos', id)

    const { transportadora, rastreio, previsao, custo_frete, data_saida, volumes, nf, comentario } = orcamento?.status?.historico?.[chave] || {}

    const oTransportadoras = transportadoras
        .map(o => `<option ${transportadora == o ? 'selected' : ''}>${o}</option>`)
        .join('')

    const linhas = [
        {
            texto: 'Número de rastreio',
            elemento: `<input class="pedido" id="rastreio" value="${rastreio || ''}">`
        },
        {
            texto: 'Transportadora',
            elemento: `
            <select class="pedido" id="transportadora">
                ${oTransportadoras}
            </select>
            `
        },
        {
            texto: 'Custo do Frete',
            elemento: `<input  type="number" id="custo_frete" value="${custo_frete || ''}">`
        },
        {
            texto: 'Nota Fiscal',
            elemento: `<input id="nf" value="${nf || ''}">`
        },
        {
            texto: 'Comentário',
            elemento: `<textarea id="comentario">${comentario || ''}</textarea>`
        },
        {
            texto: 'Quantos volumes',
            elemento: `<input  type="number" id="volumes" value="${volumes || ''}">`
        },
        {
            texto: 'Data de Saída',
            elemento: `<input type="date" id="data_saida" value="${data_saida || ''}">`
        },
        {
            texto: 'Data de Entrega',
            elemento: `<input type="date" id="previsao" value="${previsao || ''}">`
        },
    ]


    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `registrarEnvioMaterial('${id}', '${chave}')"` }
    ]

    popup({ linhas, botoes, titulo: 'Envio de Material' })
}

async function registrarEnvioMaterial(id, chave) {

    overlayAguarde()

    const campos = ['rastreio', 'transportadora', 'custo_frete', 'nf', 'comentario', 'volumes', 'data_saida', 'previsao']

    const orcamento = await recuperarDado('dados_orcamentos', id)
    orcamento.status ??= {}
    orcamento.status.historico ??= {}

    const dadosCampos = campos.reduce((acc, campo) => {
        const info = document.getElementById(campo)
        if (!info) return acc

        let valor = info.value

        if (info.type === 'number') {
            valor = Number(valor)
        }

        acc[campo] = valor
        return acc
    }, {})

    orcamento.status.historico[chave] = {
        ...orcamento.status.historico[chave],
        status: 'MATERIAL ENVIADO',
        data: new Date().toLocaleString(),
        ...dadosCampos
    }

    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${id}/status/historico/${chave}`, orcamento.status.historico[chave])

    removerPopup()
    await abrirEsquema(id)
}

async function irOS(idOrcamento) {
    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))

    window.open('os.html', '_blank')
}

async function gerarPdfRequisicao(id, chave, visualizar) {

    overlayAguarde()

    const { status, dados_orcam, snapshots } = await recuperarDado('dados_orcamentos', id) || {}
    const { requisicao, volumes, empresa, executor, pedido, transportadora, comentario, total_requisicao } = status?.historico?.[chave] || {}


    const dStatus = Object.entries({ transportadora, volumes, empresa, executor, total_requisicao })
        .filter(([, valor]) => valor)
        .map(([chave, valor]) => {

            if (chave == 'total_requisicao')
                valor = dinheiro(valor)

            return `<span><b>${inicialMaiuscula(chave)}</b> ${valor}</span>`
        })
        .join('')

    const { nome, cnpj, cidade, bairro, endereco, cep } = await recuperarDado('dados_clientes', dados_orcam?.omie_cliente) || {}
    const dCabecalho = Object.entries({ orçamento: dados_orcam?.contrato, chamado: dados_orcam?.chamado, nome, cnpj, endereco, bairro, cidade, cep })
        .filter(([, valor]) => valor)
        .map(([chave, valor]) => {
            return `<span><b>${inicialMaiuscula(chave)}</b> ${valor}</span>`
        })
        .join('')

    const colunas = [
        'Imagem',
        'Código GCS',
        'Código OMIE',
        'Descrição',
        'Unidade',
        'Tipo',
        'Quantidade',
        'Valor Unitário',
        'Valor Total'
    ]

    const linhas = []

    const modTR = (dados) => {

        const { imagem, codigo, omie, descricao, modelo, fabricante, unidade, tipo, qtde_enviar = 0, custo = 0 } = dados || {}

        const descFinal = Object.entries({ descricao, modelo, fabricante })
            .filter(([, valor]) => valor)
            .map(([chave, valor]) => {
                return `<span><b>${chave.toUpperCase()}</b> ${valor}</span>`
            })
            .join('')

        const tr = `
            <tr>
                <td>
                    <img src="${imagem || logo}" style="width: 4rem;">
                </td>
                <td>${codigo}</td>
                <td>${omie || ''}</td>
                <td>
                    <div style="${vertical}">
                        ${descFinal}
                    </div>
                </td>
                <td>${unidade || ''}</td>
                <td>${tipo || 'ADICIONAL'}</td>
                <td style="text-align: center;">${qtde_enviar || ''}</td>
                <td style="white-space: nowrap;">${dinheiro(custo)}</td>
                <td style="white-space: nowrap;">${dinheiro(custo * qtde_enviar)}</td>
            </tr>
        `

        return tr
    }

    for (const [codigo, item] of Object.entries(requisicao || {})) {

        const { qtde_enviar = 0, adicionais } = item || {}

        if (qtde_enviar < 1)
            continue

        const produto = await recuperarDado('dados_composicoes', codigo) || {}

        // Item principal || a "descrição" final sobrepõe a do item;
        linhas.push(modTR({ ...produto, ...item }))

        // Adicionais qtde nele é equivalente ao qtde_enviar do Item principal;
        for (const adicional of Object.values(adicionais || {})) {
            linhas.push(modTR({ qtde_enviar: adicional.qtde, ...adicional, codigo: produto.codigo }))
        }

    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            <style>

            @page {
                size: A4;
                margin: 0.5cm;
            }

            body {
                overflow-x: hidden;
                padding: 2rem;
                font-size: 0.7rem;
                font-family: 'Poppins', sans-serif;
                margin: 0;
                padding: 20px;
                display: flex;
                align-itens: start;
                justify-content: start;
                flex-direction: column;
                gap: 0.5rem;
            }

            .header {
                width: 100%;
                text-align: center;
                margin-bottom: 20px;
                padding: 10px 0;
                border-radius: 5px;
            }

            .header img {
                height: 70px;
            }

            .tabela {
                width: 100%;
                border-collapse: collapse;
                border-radius: 5px;
                overflow: hidden;
                margin-bottom: 20px;
            }

            .tabela th {
                background-color: #dfdede;
                padding: 10px;
                text-align: left;
            }

            .tabela th, .tabela td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }

            .tabela td {
                background-color: #ffffff;
            }

            .tabela tr:nth-child(even) td {
                background-color: #f9f9f9;
            }

            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }

            </style>
        </head>
        <body>

            <div style="${horizontal}; width: 100%; justify-content: space-between; padding: 1rem;">
                <span style="font-size: 2rem;">REQUISIÇÃO DE MATERIAIS</span>
                <img style="width: 10rem;" src="https://i.imgur.com/5zohUo8.png">
            </div>

            <div style="${horizontal}; justify-content: start; width: 100%; gap: 2rem;">

                <div style="${vertical}; gap: 2px;">

                    ${dCabecalho}

                </div>

                <div style="${vertical}; gap: 2px;">

                    ${dStatus}

                </div>

            </div>

            <br>
            
            <table class="tabela">
                <thead>
                    ${colunas.map(c => `<th>${c}</th>`).join('')}
                </thead>
                <tbody>
                    ${linhas.join('')}
                </tbody>
            </table>

            <div style="${vertical};">
                <span><b>COMENTÁRIO</b></span>
                <div style="white-space: pre-wrap;">${comentario || 'Sem comentários'}</div>
            </div>
        </body>
        </html>`

    const elemento = `<div style="padding: 2rem;">${htmlContent}</div>`

    if (visualizar)
        return popup({ elemento, titulo: 'PDF' })

    try {

        const campos = [
            'Requisição',
            ...snapshots?.contrato,
            Date.now()
        ]

        const nome = campos
            .filter(c => c)
            .join('-')

        await gerarPdfOnline(htmlContent, nome)
        removerOverlay()

    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gerar o PDF, tente novamente ou fale com o Suporte' })

    }

}
