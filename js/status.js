let unidadeOrc = null
const altNumOrc = ['adm', 'analista']
const opcoesPedidos = ['', 'Locação', 'Serviço', 'Venda', 'Venda + Serviço', 'POC']
const opcoesRequisicao = ['SERVIÇO', 'VENDA', 'USO E CONSUMO', 'LOCAÇÃO']
const transportadoras = ['', 'JAMEF', 'CORREIOS', 'RODOVIÁRIA', 'JADLOG', 'AÉREO', 'OUTRAS']
const permAtalhos = ['adm', 'fin', 'diretoria', 'coordenacao', 'gerente']
const permAltStatus = ['adm', 'diretoria']
const statusExclusivosLog = ['ENVIADO', 'ENTREGUE']

const fluxograma = [
    'PROSPECÇÃO',
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


function marcarStatusPedido() {

    const opcao = [...document.querySelectorAll('[name="status-pedido"]:checked')][0]

    if (!opcao)
        return

    const pedido = document.getElementById('pedido')
    const autorizado = document.getElementById('autorizado')
    const retorno = opcao.dataset.campo
    pedido.readOnly = true
    pedido.value = retorno

    if (retorno.includes('número')) {
        pedido.value = ''
        pedido.readOnly = false
    }

    autorizado.style.display = retorno == 'Sem Pedido'
        ? 'flex'
        : 'none'

}

async function painelAdicionarPedido(id, chave) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const { pedido, tipo, empresa, valor, comentario, pagamento } = orcamento?.status?.historico?.[chave] || {}

    const opcoes = ['Sem Pedido', 'Aprovado por E-mail', 'Aprovado com número']
        .map(op => `
            <div style="${horizontal}; gap: 1rem;">
                <input ${op == pedido ? 'checked' : ''} name="status-pedido" data-campo="${op}" type="radio" style="box-shadow: none; width: 2rem; height: 2rem;" onclick="marcarStatusPedido()">
                <span>${op}</span>
            </div>
            `)
        .join('')

    controlesCxOpcoes.autorizadoPor = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

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
            texto: 'Status do Pedido',
            elemento: `
            <div style="${vertical}; gap: 5px;">
                ${opcoes}
                <div id="autorizado" style="${horizontal}; display: none; gap: 1rem;">
                    <span>Autorizado por?</span>
                    <span name="autorizadoPor" class="opcoes" onclick="cxOpcoes('autorizadoPor')">Selecione</span>
                </div>
            </div>`
        },
        {
            texto: 'Número do Pedido',
            elemento: `<input type="text" id="pedido" value="${pedido || ''}" readOnly>`
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
            texto: 'Condições de pagamento',
            elemento: `
            <select id="pagamento">
                ${parcelas.map(p => `<option ${pagamento == p ? 'selected' : ''}>${p}</option>`).join('')}
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
    marcarStatusPedido()

}

async function salvarPedido(id, chave = crypto.randomUUID()) {

    overlayAguarde()

    const comentario_status = document.getElementById('comentario_status')
    const valor = document.getElementById('valor')
    const tipo = document.getElementById('tipo')
    const pedido = document.getElementById('pedido')
    const empresa = document.getElementById('empresa')
    const pagamento = document.getElementById('pagamento')
    const autorizadoPor = document.querySelector('[name="autorizadoPor"]').id

    if (!valor.value || !tipo.value || !pedido.value)
        return popup({ mensagem: 'Existem campos em Branco' })

    if (pedido.value == 'Sem Pedido' && autorizadoPor == '')
        return popup({ mensagem: 'Quem autorizou este pedido?' })

    const dados = {
        data: new Date().toLocaleString(),
        executor: acesso.usuario,
        comentario: comentario_status.value,
        pagamento: pagamento.value,
        valor: Number(valor.value),
        tipo: tipo.value,
        pedido: pedido.value,
        autorizadoPor,
        empresa: empresa.value,
        status: 'PEDIDO'
    }

    await enviar(`dados_orcamentos/${id}/status/historico/${chave}`, dados)

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

    await enviar(`dados_orcamentos/${id}/status/historico/${idStatus}`, nota)

    removerPopup()
    await abrirEsquema(id)

}

async function abrirAtalhos(id, idMaster) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const emAnalise = orcamento.aprovacao && orcamento.aprovacao.status !== 'aprovado'
    const botoesDisponiveis = []
    let termoArquivar = 'Arquivar Orçamento'
    let iconeArquivar = 'pasta'

    if (orcamento.arquivado == 'S') {
        termoArquivar = 'Desarquivar Orçamento'
        iconeArquivar = 'desarquivar'
    }

    // Gambiarra para não mudar a posição das paradas;
    if (!emAnalise)
        botoesDisponiveis.push(
            modeloBotoes('esquema', 'Histórico', `abrirEsquema('${id}')`),
            modeloBotoes('painelcustos', 'Painel de Custos', `painelCustos('${id}')`)
        )

    botoesDisponiveis.push(
        modeloBotoes('duplicar', 'Duplicar Orçamento', `duplicar('${id}')`)
    )

    if (!emAnalise) {
        botoesDisponiveis.push(
            modeloBotoes('pdf', 'Abrir Orçamento em PDF', `irPdf('${id}', ${emAnalise})`),
            modeloBotoes('checklist', 'CHECKLIST', `telaChecklist('${id}')`),
            modeloBotoes('excel', 'Baixar Orçamento em Excel', `ir_excel('${id}')`),
            modeloBotoes(iconeArquivar, termoArquivar, `arquivarOrcamento('${id}')`),
            modeloBotoes('LG', 'OS em PDF', `carregarOS('${id}')`),
            modeloBotoes('alerta', 'Definir Prioridade', `formularioOrcAprovado('${id}')`)
        )

        if (idMaster)
            botoesDisponiveis.push(modeloBotoes('exclamacao', 'Desvincular Orçamento', `confirmarRemoverVinculo('${id}', '${idMaster}')`))
        else
            botoesDisponiveis.push(modeloBotoes('link', 'Vincular Orçamento', `vincularOrcamento('${id}')`))
    }

    if (orcamento?.usuario == acesso.usuario || permAtalhos.includes(acesso.permissao) || orcamento?.usuarios?.[acesso.usuario]) {
        botoesDisponiveis.push(
            modeloBotoes('apagar', 'Excluir Orçamento', `confirmarExclusaoOrcamentoBase('${id}')`),
            modeloBotoes('editar', 'Editar Orçamento', `editar('${id}')`),
            modeloBotoes('gerente', 'Editar Dados do Cliente', `painelClientes('${id}')`)
        )

    }

    if (orcamento?.status?.atual == 'PROSPECÇÃO')
        botoesDisponiveis.push(modeloBotoes('prospeccao', 'Prospecção', `confirmarProspeccao('${id}')`))

    const modAlerta = (texto) => `
        <div class="alerta-pendencia" onclick="irORC('${id}')">
            <img src="gifs/alerta.gif">
            <span>${texto}</span>
        </div>
    `

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
            <input ${orcamento?.chamado == 'S' ? 'checked' : ''} onclick="ativarChave(this, '${id}', 'chamado')" ${styChek} type="checkbox">
        </div>

        <div style="${horizontal}; gap: 5px;">
            <span>Classificar como <b>PREVENTIVA</b></span>
            <input ${orcamento?.preventiva == 'S' ? 'checked' : ''} onclick="ativarChave(this, '${id}', 'preventiva')" ${styChek} type="checkbox">
        </div>
        <hr>
        ${aviso}
        <div class="opcoes-orcamento">${botoesDisponiveis.join('')}</div>

        ${prioridadeAtalho}
    `

    const menuOpcoesOrcamento = document.querySelector('.menu-opcoes-orcamento')

    if (menuOpcoesOrcamento)
        return menuOpcoesOrcamento.innerHTML = acumulado

    popup({ elemento: `<div class="menu-opcoes-orcamento">${acumulado}</div>`, titulo: 'Opções do Orçamento' })

}

async function confirmarProspeccao(id) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `iniciarChamadoProspeccao('${id}')` }
    ]

    popup({ botoes, imagem: 'imagens/prospeccao.png', mensagem: 'Criar uma prospecção?', removerAnteriores: true })

}

async function iniciarChamadoProspeccao(id) {

    overlayAguarde()

    const { dados_orcam } = await recuperarDado('dados_orcamentos', id) || {}
    const { omie_cliente, contrato } = dados_orcam || {}

    const novo = {
        id: contrato,
        equipamentos: {},
        unidade: omie_cliente,
        sistema: '17', // SERVIÇO DE INFRA
        prioridade: 'v2ttQ', // Serviço de INFRA
        tipo: 'wgVdc', // Prospecção
        descricao: `Chamado de Prospecção do ${contrato}`,
        dataRegistro: new Date().toLocaleString('pt-BR'),
        usuario: acesso.usuario,
        anexos: {}
    }

    await enviar(`dados_ocorrencias/${contrato}`, novo)

    await telaOcorrencias()

    controles.ocorrencias.filtros = {
        'snapshots.contrato': { op: 'includes', value: contrato }
    }

    await paginacao('ocorrencias')

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

    await enviar(`dados_orcamentos/${idMaster}/vinculados/${idOrcamento}`, dados)

    removerPopup()
    removerPopup()

}

async function confirmarRemoverVinculo(idOrcamento, master) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `desfazerVinculo('${idOrcamento}', '${master}')` }
    ]

    popup({ botoes, mensagem: 'Deseja desfazer vínculo?', })

}

async function desfazerVinculo(idSlave, idMaster) {

    overlayAguarde()

    await deletar(`dados_orcamentos/${idMaster}/vinculados/${idSlave}`)

    removerPopup()

}

async function arquivarOrcamento(id) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)

    const arquivamento = orcamento?.arquivado == 'S' ? 'N' : 'S'
    await enviar(`dados_orcamentos/${id}/arquivado`, arquivamento)

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
            ${labelDestaque('Desvio', dinheiro(historico?.totais?.desvio))}

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

        const { empresa, pedido, pagamento, valor, tipo, autorizadoPor } = historico || {}

        acumulado.push(`
            <div style="${vertical}; gap: 2px;">
                ${labelDestaque('Empresa a faturar', empresa)}
                ${labelDestaque('Pagamento', pagamento)}
                ${labelDestaque('Pedido', pedido)}
                ${labelDestaque('Autorizado por', autorizadoPor)}
                ${labelDestaque('Valor', dinheiro(valor))}
                ${labelDestaque('Tipo', tipo)}
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

async function checklistChamado(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const contrato = orcamento?.dados_orcam?.contrato

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
                    <input ${chamado ? 'checked' : ''} onclick="ativarChave(this, '${id}', 'chamado')" ${styChek} type="checkbox">
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
        ? `unidadeOrc = '${orcamento.dados_orcam.omie_cliente}'; formularioOcorrencia('${contrato}')`
        : ''

    const pChamado = `
        <span>Para abrir a <b>OCORRÊNCIA</b><br></span>
        <span>Realize as etapas abaixo:</span>
        <hr>
        ${checks}
        <hr>
        <div style="${horizontal}; gap: 1rem;">
            <button onclick="${f1}" style="opacity: ${liberado ? '1' : '0.5'};">Abrir chamado</button>
        </div>
    `

    const local = document.querySelector('.status-check-ocorrencias')

    if (local)
        local.innerHTML = pChamado

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

        const { anexos, fotos } = historico

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

        const stringFotos = Object.entries(fotos || {})
            .map(([idFoto, { link }]) => `
            <div style="position: relative;">
                <img onclick="confirmarExcluirFotoStatus('${id}', '${chave}', '${idFoto}')" src="imagens/cancel.png" style="position: absolute; top: 2px; right: 2px; width: 1.5rem;">
                <img class="foto-status" id="${idFoto}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${idFoto}')">
            </div>
            `)
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

                    <div onclick="painelFotos('${id}', '${chave}')" class="contorno-botoes" style="background-color: ${cor}">
                        <img src="imagens/camera2.png" style="width: 1.5rem;">
                        <label>Foto</label>
                    </div>

                    <div name="fotos_${chave}" style="display: flex; flex-wrap: wrap; gap: 3px;">
                        ${stringFotos}
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
                <div class="status-check-ocorrencias">
                    <img src="gifs/loading.gif" style="width: 5rem;">
                </div>
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
    } else {
        popup({ elemento: `<div class="painel-historico">${acumulado}</div>`, titulo: 'Histórico do Orçamento' })
    }

    // Checklist Chamado;
    await checklistChamado(id)

}

async function confirmarExcluirFotoStatus(id, chave, idFoto) {

    const botoes = [
        {
            texto: 'Confirmar',
            img: 'concluido',
            funcao: `excluirFotoStatus('${id}', '${chave}', '${idFoto}')`
        }
    ]

    popup({
        mensagem: 'Tem certeza?',
        botoes
    })

}

async function excluirFotoStatus(id, chave, idFoto) {

    overlayAguarde()
    await deletar(`dados_orcamentos/${id}/status/historico/${chave}/fotos/${idFoto}`)

    const foto = document.getElementById(idFoto)
    if (foto)
        foto.parentElement.remove()

    removerPopup()

}

async function painelFotos(id, chave) {

    const elemento = `
        <div style="${vertical}; gap: 3px; background-color: #d2d2d2;">
            <div class="capturar" style="position: fixed; bottom: 10px; left: 10px; z-index: 10003;" onclick="tirarFotoStatus('${id}', '${chave}')">
                <img src="imagens/camera.png">
                <span>Capturar Imagem</span>
            </div>

            <div class="cameraDiv">
                <video autoplay playsinline></video>
                <canvas style="display: none;"></canvas>
            </div>
        </div>
        `
    popup({ elemento })

    await abrirCamera()

}

async function tirarFotoStatus(id, chave) {

    overlayAguarde()

    const cameraDiv = document.querySelector('.cameraDiv')
    const canvas = cameraDiv.querySelector('canvas')
    const video = cameraDiv.querySelector('video')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    const src = canvas.toDataURL('image/png')

    pararCam()

    const resposta = await importarAnexos({ foto: src })
    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })

    const idFoto = crypto.randomUUID()
    await enviar(`dados_orcamentos/${id}/status/historico/${chave}/fotos/${idFoto}`, resposta[0])

    const foto = `
        <div style="position: relative;">
            <img onclick="confirmarExcluirFotoStatus('${id}', '${chave}', '${idFoto}')" src="imagens/cancel.png" style="position: absolute; top: 2px; right: 2px; width: 1.5rem;">
            <img class="foto-status" id="${idFoto}" src="${src}" onclick="ampliarImagem(this, '${idFoto}')">
        </div>
    `
    const local = document.querySelector(`[name="fotos_${chave}"]`)
    if (local)
        local.insertAdjacentHTML('beforeend', foto)

    removerPopup()

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
        data: agora,
        de: statusAnterior,
        para: novoSt,
        usuario: acesso?.usuario || ''
    }

    await enviar(`dados_orcamentos/${id}/status/atual`, novoSt)
    await enviar(`dados_orcamentos/${id}/status/historicoStatus/${idStatus}`, registroStatus)

    if (novoSt === 'ORC PENDENTE')
        formularioOrcPendente(id, idStatus)

    if (novoSt === 'ORC APROVADO') {
        formularioOrcAprovado()
        const resposta = await criarDepartamento(id)
        if (resposta?.mensagem) popup({ mensagem: resposta.mensagem })
    }

    const pHistorico = document.querySelector('.painel-historico')
    if (pHistorico)
        await abrirEsquema(id)

    await carregarToolbar()
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

    if (!input.value)
        return removerPopup()

    removerPopup()

    await enviar(`dados_orcamentos/${id}/inicio`, input.value)

    await abrirAtalhos(id)

}

async function irORC(id) {

    overlayAguarde()

    const tGerenciamento = document.querySelector('.tela-gerenciamento')
    if (!tGerenciamento)
        await telaInicialGCS()

    await tabelaPorAba({ id })

    removerOverlay()

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
                <img name="confirmar" onclick="salvarInfoAdicional('${idOrcamento}', '${chave}')" src="imagens/concluido.png" style="display: none;">
            </div>
        </div>
        `
    }

    const elemento = `
        <div style="${vertical}; padding: 1rem; gap: 1rem;">
            <span>Acrescente algum comentário por status se precisar</span>
            <hr>
            ${campos || 'Sem histórico de Status'}
        </div>`

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
            elemento: `<div class="comentario-padrao" id="${idStatus}" contentEditable="true"></div>`
        }
    ]
    const funcao = `salvarInfoAdicional('${id}', '${idStatus}')`
    const botoes = [{ texto: 'Salvar', img: 'concluido', funcao }]
    popup({ linhas, botoes, titulo: 'Informação adicional' })

}

async function salvarInfoAdicional(id, idStatus) {

    overlayAguarde()

    const info = document.getElementById(idStatus).textContent

    await enviar(`dados_orcamentos/${id}/status/historicoStatus/${idStatus}/info`, info)
    await enviar(`dados_orcamentos/${id}/status/historicoStatus/${idStatus}/usuario`, acesso.usuario)

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
                        ${Object.entries(orcamento.status.historicoStatus).map(([chave, registro]) => {

        const ts = toTimestamp(registro?.data || registro?.timestamp)

        return `
                            <tr id="ST_${chave}">
                                <td>${new Date(ts).toLocaleString()}</td>
                                <td>${registro.de}</td>
                                <td>${registro.para}</td>
                                <td>${registro.usuario}</td>
                                <td>
                                    ${acesso.permissao == 'adm' ? `<img onclick="excluirHiStatus('${id}', '${chave}')" src="imagens/cancel.png">` : ''}
                                </td>
                            </tr>
                        `}).join('')}
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

    const trExistente = document.getElementById(`ST_${idStatus}`)
    if (trExistente)
        trExistente.remove()

    await deletar(`dados_orcamentos/${id}/status/historicoStatus/${idStatus}`)

    const pHistorico = document.querySelector('.painel-historico')
    if (pHistorico)
        await abrirEsquema(id)

    removerOverlay()

}

async function excluirAnexo(id, chave, idAnexo, img) {

    overlayAguarde()

    await deletar(`dados_orcamentos/${id}/status/historico/${chave}/anexos/${idAnexo}`)

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

    await deletar(`dados_orcamentos/${idOrcamento}`)

    removerPopup()
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

    await enviar(`dados_orcamentos/${id}/status/historico/${chave}/anexos`, orcamento.status.historico[chave].anexos)

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

    await deletar(`dados_orcamentos/${id}/status/historico/${chave}`)

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
        if (!info)
            return acc

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

    await enviar(`dados_orcamentos/${id}/status/historico/${chave}`, orcamento.status.historico[chave])

    removerPopup()
    await abrirEsquema(id)
}

async function irOS(idOrcamento) {
    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))

    window.open('os.html', '_blank')
}
