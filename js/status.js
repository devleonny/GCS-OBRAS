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
    'FERRAMENTAS',
    'KIT PEÇAS',
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

const esquemaBtnStatus = {
    pedidos: [
        {
            titulo: 'Novo Pedido',
            cor: '#4CAF50',
            funcao: `painelAdicionarPedido()`
        }
    ],
    requisicoes: [
        {
            titulo: 'Requisição de Materiais',
            cor: '#B12425',
            funcao: `formularioRequisicao()`
        }
    ],
    notas: [
        {
            titulo: 'Nota Avulsa',
            cor: '#ff4500',
            funcao: `adicionarNotaAvulsa()`
        }
    ],
    materiais: [
        {
            titulo: 'Envio de Material',
            cor: '#b17724',
            funcao: `envioMaterial()`
        }
    ],
    parceiros: [
        {
            titulo: 'LPU Parceiro',
            cor: '#0062d5',
            funcao: `formularioParceiro()`
        }
    ],
    levantamentos: [
        {
            titulo: 'Levantamentos',
            cor: '#222',
            funcao: `formDocAdicional('LEVANTAMENTO')`
        }
    ],
    finalizado: [
        {
            titulo: 'Finalizações',
            cor: '#222',
            funcao: `formDocAdicional('FINALIZADO')`
        }
    ]
}

const botaoAnexoStatus = ({ id, cor, tabela }) => {

    return `
        <div class="contorno-botoes" style="background-color: ${cor}">
            <img src="imagens/anexo2.png" style="width: 1.5rem;">
            <label>Anexo
                <input type="file" style="display: none;" onchange="salvarAnexo('${id}', '${tabela}', this)" multiple>  
            </label>
        </div>
    `
}

const botaoFotoStatus = ({ id, cor, tabela }) => {

    return `
        <div onclick="painelFotos('${id}', '${tabela}')" class="contorno-botoes" style="background-color: ${cor}">
            <img src="imagens/camera2.png" style="width: 1.5rem;">
            <label>Foto</label>
        </div>
    `
}

const botaoEditarStatus = ({ id, cor, funcao }) => {

    return `
        <div style="background-color: ${cor};" 
            class="contorno-botoes" onclick="${funcao}">
            <img src="imagens/editar4.png" style="width: 1.5rem;">
            <label>Editar</label>
        </div>
    `
}

const blocoAnexosCompleto = ({ id, tabela, anexos }) => {

    const stringAnexos = Object.entries(anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `excluirAnexo('${id}', '${tabela}', '${idAnexo}', 'anexos')`))
        .join('')

    return `
        <div style="${vertical};">
            ${stringAnexos}
        </div>
    `
}

const blocoFotosCompleto = ({ id, tabela, fotos }) => {

    const stringFotos = Object.entries(fotos || {})
        .map(([idFoto, { link }]) => `
        <div style="position: relative;">
            <img onclick="excluirAnexo('${id}', '${tabela}', '${idFoto}', 'fotos')" src="imagens/cancel.png" style="position: absolute; top: 2px; right: 2px; width: 1.5rem;">
            <img class="foto-status" id="${idFoto}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${idFoto}')">
        </div>
        `)
        .join('')

    return `
        <div style="display: flex; flex-wrap: wrap; gap: 3px;">
            ${stringFotos}
        </div>
    `
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

async function painelAdicionarPedido(id = crypto.randomUUID()) {

    overlayAguarde()

    const { pedido, tipo, empresa, valor, comentario, pagamento, departamento } = await recuperarDado('pedidos', id) || {}
    const depAtivo = controles?.ocorrencias?.ativo

    if (!departamento && !depAtivo)
        return mensagem({ mensagem: 'Departamento não localizado' })

    const opcoes = ['Sem Pedido', 'Aprovado por E-mail', 'Aprovado com número']
        .map(op => `
            <div style="${horizontal}; gap: 1rem;">
                <input ${op == pedido ? 'checked' : ''} name="status-pedido" data-campo="${op}" type="radio" style="box-shadow: none; width: 2rem; height: 2rem;" onclick="marcarStatusPedido()">
                <span>${op}</span>
            </div>
            `)
        .join('')

    controlesCxOpcoes.autorizado_por = {
        base: 'clientes',
        retornar: ['usuario'],
        filtros: {
            usuario: { op: 'NOT_EMPTY' }
        },
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const linhas = [
        {
            texto: 'Departamento',
            elemento: `<input id="departamento" value="${departamento || depAtivo}" readOnly>`
        },
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
                    <span name="autorizado_por" class="opcoes" onclick="cxOpcoes('autorizado_por')">Selecione</span>
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
            funcao: `salvarPedido('${id}')`,
            img: 'concluido'
        }
    ]

    popup({ linhas, botoes, titulo: 'Novo Pedido' })
    marcarStatusPedido()

}

async function salvarPedido(id) {

    overlayAguarde()

    const departamento = document.getElementById('departamento').value
    const comentario_status = document.getElementById('comentario_status')
    const valor = document.getElementById('valor')
    const tipo = document.getElementById('tipo')
    const pedido = document.getElementById('pedido')
    const empresa = document.getElementById('empresa')
    const pagamento = document.getElementById('pagamento')
    const autorizado_por = document.querySelector('[name="autorizado_por"]').id

    if (!valor.value || !tipo.value || !pedido.value)
        return popup({ mensagem: 'Existem campos em Branco' })

    if (pedido.value == 'Sem Pedido' && autorizado_por == '')
        return popup({ mensagem: 'Quem autorizou este pedido?' })

    const dados = {
        departamento,
        data: new Date().toLocaleString(),
        executor: acesso.usuario,
        comentario: comentario_status.value,
        pagamento: pagamento.value,
        valor: Number(valor.value),
        tipo: tipo.value,
        pedido: pedido.value,
        autorizado_por,
        empresa: empresa.value
    }

    await enviar(`pedidos/${id}`, dados)

    removerPopup()

}

async function adicionarNotaAvulsa(id = crypto.randomUUID()) {

    overlayAguarde()

    const {
        n_nota,
        total,
        parcelas,
    } = await recuperarDado('notas', id) || {}

    const linhas = [
        {
            texto: 'Número da nota',
            elemento: `<input id="nf" class="inputParcelas" value="${n_nota || ''}">`
        },
        {
            texto: 'Tipo',
            elemento: `<select id="tipo" class="inputParcelas">${['Venda', 'Serviço', 'Remessa'].map(op => `<option>${op}</option>`).join('')}</select>`
        },
        {
            texto: 'Valor',
            elemento: `<div>R$ <input type="number" id="valor" placeholder="0,00" class="inputParcelas" value="${total || ''}"></div>`
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

    const contrato = controles.ocorrencias.ativo

    const valor = (id) => {
        return document.getElementById(id).value
    }

    const parcelas = [...document.querySelectorAll('[name="parcela"]')]
        .map((input, i) => {
            return { nParcela: (i + 1), nValor: Number(input.value), dDtVenc: new Date(input.value).toLocaleDateString('pt-BR') }
        })

    const nota = {
        executor: acesso.usuario,
        d_emi_inicial: new Date().toLocaleDateString('pt-BR'),
        n_nota: valor('nf'),
        categoria: valor('tipo'),
        total: Number(valor('valor')),
        parcelas,
        departamento: [contrato]
    }

    await enviar(`notas/${id}`, nota)

    removerPopup()

}

async function abrirAtalhos(id, idMaster) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const emAnalise = orcamento.aprovacao && orcamento.aprovacao.status !== 'aprovado'
    const botoesDisponiveis = []
    const autorizados = orcamento?.dados_orcam?.executor || []

    // Gambiarra para não mudar a posição das paradas;
    if (!emAnalise)
        botoesDisponiveis.push(
            modeloBotoes('esquema', 'Histórico', `abrirEsquema('${id}')`),
            modeloBotoes('painelcustos', 'Painel de Custos', `painelCustos('${id}')`),
            modeloBotoes('pdf', 'Abrir Orçamento em PDF', `irPdf('${id}')`),
            modeloBotoes('checklist', 'CHECKLIST', `telaChecklist('${id}')`),
            modeloBotoes('excel', 'Baixar Orçamento em Excel', `irExcelOrcamento('${id}')`),
            modeloBotoes('LG', 'OS em PDF', `carregarOS('${id}')`),
        )

    if (idMaster)
        botoesDisponiveis.push(modeloBotoes('exclamacao', 'Desvincular Orçamento', `confirmarRemoverVinculo('${id}', '${idMaster}')`))
    else
        botoesDisponiveis.push(modeloBotoes('link', 'Vincular Orçamento', `vincularOrcamento('${id}')`))

    botoesDisponiveis.push(
        modeloBotoes('duplicar', 'Duplicar Orçamento', `confirmarDuplicarOrcamento('${id}')`)
    )

    if (orcamento?.usuario == acesso.usuario || permAtalhos.includes(acesso.permissao) || autorizados.includes(acesso.usuario)) {
        botoesDisponiveis.push(
            modeloBotoes('apagar', 'Excluir Orçamento', `confirmarExclusaoOrcamentoBase('${id}')`),
            modeloBotoes('editar', 'Editar Orçamento', `editar('${id}')`),
            modeloBotoes('gerente', 'Editar Dados do Cliente', `painelClientes('${id}')`)
        )
    }

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
            <span>Classificar como <b>PREVENTIVA</b></span>
            <input ${orcamento?.preventiva == 'S' ? 'checked' : ''} onclick="ativarChave(this, '${id}', 'preventiva')" ${styChek} type="checkbox">
        </div>
        <hr>
        ${aviso}
        <div class="opcoes-orcamento">${botoesDisponiveis.join('')}</div>

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
        data_registro: new Date().toLocaleString('pt-BR'),
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
            'Orçamento': { chave: 'snapshots.contrato' },
            'Cidade': { chave: 'snapshots.cidade' },
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
        <div class="div-porcentagem">
            <div style="width: ${valor}%; height: 100%; background: ${valor >= 70 ? "#4caf50" : valor >= 40 ? "#ffc107" : "#f44336"};"></div>
            <label style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.7rem; color: #000;">
                ${valor}%
            </label>
        </div>
    `
}

async function checklistChamado(id) {

    const contrato = controles.ocorrencias.ativo

    // Para abrir transformar um orcamento em chamado, ele precisa ter um pedido (Enviado e Aprovado);
    const pedidos = await pesquisarDB({
        base: 'pedidos',
        filtros: {
            departamento: {
                op: 'includes',
                value: contrato
            }
        }
    })

    const existente = await recuperarDado('dados_ocorrencias', contrato)

    const pChamado = existente
        ? `
        <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/concluido.png">
            <span>Ocorrência já aberta ${contrato}</span>
        </div>
    `
        : `
        <span>Abra uma <b>OCORRÊNCIA</b> de duas formas:<br></span>
        <br>
        <span>
            Para orçamentos de levantamento: 
            O orçamento pode ser R$ 0,00 para edição posterior.
        </span>
        <button onclick="confirmarProspeccao('${id}')">Orçamento Prospecção</button>
        <br>
        <span>
            Quando o orçamento é solicitado 
            pelo cliente de forma <b>padrão</b>.<br>
            Mas antes, faça o envio do 
            orçamento por e-mail, aguarde 
            a aprovação e crie um pedido: 
            Esse botão verde "<b>Novo Pedido</b>" aqui ao lado.
        </span>
        <button onclick="auxAberturaChamado('${id}')">Orçamento Aprovado</button>
    `

    const local = document.querySelector('.status-check-ocorrencias')

    if (local)
        local.innerHTML = pChamado

}

async function auxAberturaChamado(id) {

    overlayAguarde()

    const { dados_orcam } = await recuperarDado('dados_orcamentos', id) || {}
    const { contrato, omie_cliente } = dados_orcam || {}

    const pedidos = await pesquisarDB({
        base: 'pedidos',
        filtros: {
            'departamento': {
                op: 'includes',
                value: contrato
            }
        }
    })

    if (!pedidos.resultados.length)
        return popup({ mensagem: 'Abra um pedido antes de abrir a ocorrência!' })

    unidadeOrc = omie_cliente

    await formularioOcorrencia(contrato)

}

async function abrirEsquema(id) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const contrato = orcamento?.dados_orcam?.contrato
    const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
    const { cliente } = orcamento?.snapshots || {}
    const { snapshots } = await recuperarDado('dados_ocorrencias', contrato) || {}

    controles.ocorrencias ??= {}
    controles.ocorrencias.ativo = contrato

    const labelTipoCorrecao = (snapshots?.nomesStatus || [])
        .map(st => formatacaoTipoCorrecao(st))
        .join('')

    const acumulado = `
        <div style="${vertical}; gap: 10px; padding: 3px;">

            <div style="${horizontal}; gap: 2rem;">

                <div style="${vertical}; gap: 2px;">
                    <label>Status atual</label>
                    ${labelTipoCorrecao}
                </div>

                <label style="font-size: 1.5rem;">${contrato} - ${cliente || '??'}</label>

            </div>

        </div>

        <div id="${contrato}" class="container-blocos">

            <div class="status-check-ocorrencias">
                <img src="gifs/loading.gif" style="width: 5rem;">
            </div>

            <div class="bloco-st"></div>
        </div>`

    popup({ elemento: `<div class="painel-historico">${acumulado}</div>`, titulo: 'Histórico do Orçamento' })

    // Carregar tabelas adicionais;
    abrirEsquemaOcorrencias(contrato)

    // Checklist Chamado;
    checklistChamado(id)

}

async function painelFotos(id, tabela) {

    const elemento = `
        <div style="${vertical}; gap: 3px; background-color: #d2d2d2;">
            <div class="capturar" style="position: fixed; bottom: 10px; left: 10px; z-index: 10003;" onclick="tirarFotoStatus('${id}', '${tabela}')">
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

async function tirarFotoStatus(id, tabela) {

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
    await enviar(`${tabela}/${id}/fotos/${idFoto}`, resposta[0])

    removerPopup()

}

async function excluirAnexo(id, tabela, idAnexo, coluna) {

    overlayAguarde()
    await deletar(`${tabela}/${id}/${coluna}/${idAnexo}`)
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

async function salvarAnexo(id, tabela, input) {

    overlayAguarde()

    if (input.files.length === 0) {
        popup({ elemento: 'Nenhum arquivo selecionado...' })
        return
    }

    // Retorna uma lista [{}, {}]
    const anexos = await importarAnexos({ input })

    if (anexos.resposta)
        return popup({ mensagem: anexos.mensagem })

    const anexosEmParalelo = anexos.map(async (anexo) => {
        const idAnexo = crypto.randomUUID()
        await enviar(`${tabela}/${id}/anexos/${idAnexo}`, anexo)
    })

    await Promise.all(anexosEmParalelo)

    removerOverlay()

}

async function apagarGenerico(id, tabela) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `confirmarApagarGenerico('${id}','${tabela}')` }
    ]

    popup({ botoes, mensagem: 'Excluir item?', titulo: 'Excluir Status' })
}


async function confirmarApagarGenerico(id, tabela) {

    removerPopup()
    await deletar(`${tabela}/${id}`)

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

async function envioMaterial(id = crypto.randomUUID()) {

    const {
        transportadora,
        rastreio,
        previsao,
        custo_frete,
        data_saida,
        volumes,
        nf,
        comentario
    } = await recuperarDado('materiais', id) || {}

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
        { texto: 'Salvar', img: 'concluido', funcao: `registrarEnvioMaterial('${id}')"` }
    ]

    popup({ linhas, botoes, titulo: 'Envio de Material' })
}

async function registrarEnvioMaterial(id) {

    overlayAguarde()

    const campos = ['rastreio', 'transportadora', 'custo_frete', 'nf', 'comentario', 'volumes', 'data_saida', 'previsao']

    const material = await recuperarDado('materiais', id) || {}
    const departamento = controles?.ocorrencias?.ativo
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

    const dados = {
        ...material,
        departamento,
        data: new Date().toLocaleString(),
        ...dadosCampos
    }

    await enviar(`materiais/${id}`, dados)

    removerPopup()

}

async function irOS(idOrcamento) {
    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    localStorage.setItem('pdf', JSON.stringify(orcamento))

    window.open('os.html', '_blank')
}

async function formDocAdicional(origem) {

    const linhas = [
        {
            texto: `Incluir ${origem}`,
            elemento: '<input type="file" id="docAdicional" multiple>'
        }
    ]

    const botoes = [
        { texto: 'Salvar', titulo: `Incluir doc ${origem}`, img: 'concluido', funcao: `salvarDocAdicional('${origem}')` }
    ]

    popup({ linhas, botoes })

}

async function salvarDocAdicional(origem) {

    overlayAguarde()

    try {

        const input = document.getElementById('docAdicional')
        const anexos = await importarAnexos({ input }) // Função de upload
        const departamento = controles.ocorrencias.ativo

        const promessasAnexos = anexos.map(anexo => {
            const id = crypto.randomUUID()
            return enviar(`anexos/${id}`, {
                id,
                origem,
                departamento,
                ...anexo
            })
        })

        await Promise.all(promessasAnexos)

        removerPopup()

    } catch (error) {
        popup({ mensagem: `Erro ao fazer upload: ${error.message}`, })
    }
}

function confirmarExclusaoDocAdicional(id) {

    const linhas = [
        { texto: 'Tem certeza?' }
    ]

    const botoes = [{
        texto: 'Confirmar',
        img: 'concluido',
        funcao: `excluirDocAdicional('${id}')`
    }]

    popup({ mensagem: 'Tem certeza?', botoes })
}

async function excluirDocAdicional(id) {

    removerPopup()
    await deletar(`anexos/${id}`)

}