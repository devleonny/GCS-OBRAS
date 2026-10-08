let unidadeOrc = null
const altNumOrc = ['adm', 'analista']
const opcoesPedidos = ['', 'Locação', 'Serviço', 'Venda', 'Venda + Serviço', 'POC']
const opcoesRequisicao = ['SERVIÇO', 'VENDA', 'USO E CONSUMO', 'LOCAÇÃO']
const permAtalhos = ['adm', 'fin', 'diretoria', 'coordenacao', 'gerente']
const permAltStatus = ['adm', 'diretoria']
const statusExclusivosLog = ['ENVIADO', 'ENTREGUE']
const fluxograma = [
    'SEM STATUS',
    'ORC PENDENTE',
    'ORC ENVIADO',
    'ORC APROVADO',
    'ORC REPROVADO',
    'REQUISIÇÃO',
    'ENVIADO',
    'ENTREGUE',
    'AGENDAMENTO',
    'EM ANDAMENTO',
    'PENDENTE OS/RELATÓRIO',
    'PENDENTE PEDIDO',
    'REPROVADO PELO FINANCEIRO',
    'CONCLUÍDO',
    'FATURADO'
]

const esquemaBtnStatus = [
    {
        chave: 'pedidos',
        titulo: 'Novo Pedido',
        cor: '#4CAF50',
        funcao: `painelAdicionarPedido()`
    },
    {
        chave: 'requisicoes',
        titulo: 'Requisição de Materiais',
        cor: '#B12425',
        funcao: `formularioRequisicao()`
    },
    {
        chave: 'notas',
        titulo: 'Nota Avulsa',
        cor: '#ff4500',
        funcao: `adicionarNotaAvulsa()`
    },
    {
        chave: 'parceiros',
        titulo: 'LPU Parceiro',
        cor: '#0062d5',
        funcao: `formularioParceiro()`
    },
    {
        chave: 'levantamentos',
        titulo: 'Levantamentos',
        cor: '#222',
        funcao: `formDocAdicional('LEVANTAMENTO')`
    }
    ,
    {
        chave: 'finalizado',
        titulo: 'Finalizações',
        cor: '#222',
        funcao: `formDocAdicional('FINALIZADO')`
    }

]

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

    try {
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

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao salvar o pedido: Fale com o suporte.' })
    }

}

async function adicionarNotaAvulsa(id = crypto.randomUUID()) {

    overlayAguarde()

    const {
        categoria,
        n_nota,
        total,
        d_emi_inicial,
    } = await recuperarDado('notas', id) || {}

    const linhas = [
        {
            texto: 'Número da nota',
            elemento: `<input id="nf"  value="${n_nota || ''}">`
        },
        {
            texto: 'Data de Emissão',
            elemento: `<input id="d_emi_inicial" type="date" value="${conversorDt(d_emi_inicial, 'input')}">`
        },
        {
            texto: 'Tipo',
            elemento: `<select id="tipo">${['venda', 'serviço', 'remessa'].map(op => `<option ${categoria == op ? 'selected' : ''} value="${op}">${inicialMaiuscula(op)}</option>`).join('')}</select>`
        },
        {
            texto: 'Valor',
            elemento: `<div>R$ <input type="number" id="valor" placeholder="0,00" value="${total || ''}"></div>`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarNotaAvulsa('${id}')` }
    ]

    popup({ linhas, botoes, titulo: 'Nota Fiscal Avulsa' })

}

async function salvarNotaAvulsa(id) {

    overlayAguarde()

    const contrato = controles.ocorrencias.ativo

    const valor = (id) => {
        return document.getElementById(id).value
    }

    const nota = {
        executor: acesso.usuario,
        d_emi_inicial: conversorDt(valor('d_emi_inicial')),
        n_nota: valor('nf'),
        categoria: String(valor('tipo')).toLocaleLowerCase(),
        total: Number(valor('valor')),
        departamento: contrato
    }

    await enviar(`notas/${id}`, nota)

    removerPopup()

}

async function abrirAtalhos(id) {

    try {

        overlayAguarde()

        const orcamento = await recuperarDado('mvw_dados_orcamentos', id) || {}
        const emAnalise = orcamento.aprovacao && orcamento.aprovacao.status !== 'aprovado'
        const botoesDisponiveis = []
        const { executor: autorizados, contrato } = orcamento.dados_orcam || {}

        // Gambiarra para não mudar a posição das paradas;
        if (!emAnalise)
            botoesDisponiveis.push(
                modeloBotoes('esquema', 'Histórico', `abrirEsquema('${id}')`),
                modeloBotoes('painelcustos', 'Painel de Custos', `painelCustos('${contrato}')`),
                modeloBotoes('pdf', 'Abrir Orçamento em PDF', `irPdf('${id}')`),
                modeloBotoes('checklist', 'Checklist', `telaChecklist('${id}')`),
                modeloBotoes('excel', 'Baixar Orçamento em Excel', `irExcelOrcamento('${id}')`),
                modeloBotoes('LG', 'OS em PDF', `carregarOS('${id}')`)
            )

        // Vinculados;
        const [estaVinculado, pesqMaster] = await Promise.all([
            recuperarDado('contratos_vinculados', contrato),
            pesquisarDB({ base: 'contratos_vinculados', filtros: { 'master': { op: '=', value: contrato } } })
        ])

        let avisoMaster = ''

        if (estaVinculado) {
            botoesDisponiveis.push(modeloBotoes('exclamacao', 'Desvincular Orçamento', `confirmarRemoverVinculo('${contrato}')`))
        } else if (!pesqMaster.resultados.length) {
            botoesDisponiveis.push(modeloBotoes('link', 'Vincular Orçamento', `vincularOrcamento('${contrato}')`))
        } else {

            const slaves = pesqMaster.resultados
                .map(res => `<span class="tag-vinculado slave">${res.slave}</span>`)
                .join('')

            avisoMaster = `
            <hr>
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="text-align: left; width: 400px;">Este orçamento é <b>master</b>, ele não pode ser vinculado a ninguém. 
                <br>A não ser que estes filhos sejam desvinculados...</span>
                ${slaves}
            </div>
            `
        }

        botoesDisponiveis.push(
            modeloBotoes('duplicar', 'Duplicar Orçamento', `confirmarDuplicarOrcamento('${id}')`)
        )

        if (orcamento?.usuario == acesso.usuario || permAtalhos.includes(acesso.permissao) || (autorizados || []).includes(acesso.usuario)) {
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

                const acumulado = `
                <div style="${vertical}; gap: 2px;">
                    ${(orcamento?.contrato || []).map(d => `<span>${d}</span>`).join('')}
                </div>
                <hr>
                ${aviso}
                <div class="opcoes-orcamento">${botoesDisponiveis.join('')}</div>
                ${avisoMaster}
    `

        const menuOpcoesOrcamento = document.querySelector('.menu-opcoes-orcamento')

        if (menuOpcoesOrcamento)
            return menuOpcoesOrcamento.innerHTML = acumulado

        popup({ elemento: `<div class="menu-opcoes-orcamento">${acumulado}</div>`, titulo: 'Opções do Orçamento' })

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao abrir os atalhos: Fale com o suporte.' })
    }

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

async function vincularOrcamento(contratoSlave) {

    overlayAguarde()

    controlesCxOpcoes.orcamento = {
        base: 'dados_orcamentos',
        retornar: ['dados_orcam.contrato'],
        colunas: {
            'Orçamento': { chave: 'snapshots.contrato' },
            'Cidade': { chave: 'snapshots.cidade' },
            'Responsáveis': { chave: 'snapshots.responsavel' }
        }
    }

    const linhas = [
        {
            texto: 'Escolha o orçamento para vincular',
            elemento: `<span class="opcoes" data-slave="${contratoSlave}" name="orcamento" onclick="cxOpcoes('orcamento')">Selecione</span>`
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            img: 'concluido',
            funcao: `confirmarVinculo()`
        }
    ]

    popup({ linhas, botoes, titulo: 'Vincular orçamentos' })

}

async function confirmarVinculo() {

    try {

        overlayAguarde()

        const contratos = document.querySelector('[name="orcamento"]')
        const master = contratos?.textContent
        const slave = contratos.dataset.slave

        if (master == 'Selecione')
            return popup({ mensagem: 'Escolha um orçamento' })

        if (master == slave)
            return popup({ mensagem: 'Os orçamentos são iguais!' })

        const { mensagem = 'Falha ao vincular: Fale com o suporte.' } = await enviarVinculo({ master, slave })

        removerTodosPopups()

        popup({ mensagem })

    } catch (err) {

        console.error(err)
        popup({ mensagem: 'Falha ao abrir a ferramenta: Fale com o suporte.' })

    }

}

async function confirmarRemoverVinculo(contrato) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `desfazerVinculo('${contrato}')` }
    ]

    popup({ botoes, mensagem: 'Deseja desfazer vínculo?', })

}

async function desfazerVinculo(contrato) {

    try {

        removerTodosPopups()

        overlayAguarde()

        const { mensagem } = await enviarVinculo({ slave: contrato, desvincular: true })

        if (mensagem)
            return popup({ mensagem })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao desvincular o orçamento: Fale com o suporte.' })
    }

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
    const valor = Math.max(
        0,
        Number(porcentagem) || 0
    )

    const largura = Math.min(valor, 100)

    const cor =
        valor > 100
            ? '#2196f399'
            : valor >= 70
                ? '#7ee182'
                : valor >= 40
                    ? '#ffc107'
                    : '#f44336'

    return `
        <div class="div-porcentagem">
            <div
                style="
                    width: ${largura}%;
                    height: 100%;
                    background: ${cor};
                "
            ></div>

            <label
                style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 0.7rem;
                    color: #000;
                "
            >
                ${valor}%
            </label>
        </div>
    `
}

async function checklistChamado(id) {

    const contrato = controles.ocorrencias.ativo

    // Para abrir transformar um orcamento em chamado, ele precisa ter um pedido (Enviado e Aprovado);
    const existente = await recuperarDado('dados_ocorrencias', contrato)

    const pChamado = existente
        ?
        `
                <div class="chamado-aberto">
                    <img src="imagens/concluido.png">
                    <span>Chamado já aberto > ${contrato}</span>
                </div>
            `
        : `
        <button onclick="auxAberturaChamado('${id}')">Abrir Chamado</button>
        <button onclick="confirmarProspeccao('${id}')">Chamado Prospecção</button>
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

    try {

        overlayAguarde()

        const {
            dados_orcam,
            nomes_status,
            cliente,
            status_atual
        } = await recuperarDado('mvw_dados_orcamentos', id) || {}

        const contrato = dados_orcam?.contrato

        controles.ocorrencias ??= {}
        controles.ocorrencias.ativo = contrato

        const labelTipoCorrecao = (nomes_status || ['CHAMADO NÃO ABERTO'])
            .map(st => formatacaoTipoCorrecao(st))
            .join('')

        const elemento = `
            <div class="painel-historico">

                <div style="${horizontal}; justify-content: start; gap: 1rem;">

                    <div class="status-check-ocorrencias"></div>

                    <div style="${vertical}; gap: 2px;">
                        <label>Status da Ocorrência</label>
                        ${labelTipoCorrecao}
                    </div>

                    <div style="${vertical}; gap: 2px;">
                        <label>Status do Orçamento</label>
                        <span class="and">${status_atual}</span>
                    </div>

                    <img onclick="verHistoricoStatus('${id}')" src="imagens/historico.png">

                    <label style="font-size: 1.5rem;">${contrato} - ${cliente || '??'}</label>

                </div>

                <hr>

                <div class="bloco-st"></div>

            </div>
    `

        popup({ elemento, titulo: 'Histórico do Orçamento' })

        // Checklist Chamado;
        checklistChamado(id)

        const local = document.querySelector('.bloco-st')

        await Promise.all(
            esquemaBtnStatus
                .map(async (botao) => {

                    const {
                        chave,
                        titulo,
                        cor,
                        funcao
                    } = botao

                    const dados = {
                        base: chave,
                        body: `body_${chave}`,
                        pag: chave,
                        filtros: {
                            departamento: {
                                op: 'includes',
                                value: contrato
                            }
                        },
                        criarLinha: `lin${inicialMaiuscula(chave)}`
                    }

                    if (chave == 'levantamentos' || chave == 'finalizado') {
                        dados.base = 'anexos'
                        dados.criarLinha = 'linAnexos'
                        dados.filtros.origem = {
                            op: '=',
                            value: chave == 'levantamentos'
                                ? 'LEVANTAMENTO'
                                : 'FINALIZADO'
                        }
                    }

                    const tabela = await modTab(dados)

                    local.insertAdjacentHTML('beforeend', `
                        <div style="${vertical}; gap: 2px;">
                            <button
                                style="background-color: ${cor};" 
                                onclick="${funcao}">
                                ${titulo}
                            </button>
                            ${tabela}
                        </div>
                    `)

                    await paginacao(chave)
                })
        )

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir o esquema: Fale com o suporte.' })
    }


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
        {
            texto: 'Confirmar',
            img: 'concluido',
            fechar: true,
            funcao: `confirmarApagarGenerico('${id}','${tabela}')`
        }
    ]

    popup({ botoes, mensagem: 'Excluir item?', titulo: 'Excluir Status', removerAnteriores: true })
}


async function confirmarApagarGenerico(id, tabela) {

    if (tabela == 'parceiros') {
        const pagamento = await recuperarDado('lista_pagamentos', id)

        if (pagamento)
            return popup({ mensagem: 'Você não pode excluir essa LPU: Já existe um pagamento solicitado.' })

        // Deletar também o cartão da correção;
        const { ativo } = controles.ocorrencias
        const { master } = await recuperarDado('contratos_vinculados', ativo) || {}
        const departamento = master || ativo

        if (!departamento)
            return popup({ mensagem: 'Falha ao excluir o cartão: Fale com o suporte' })

        await deletar(`dados_ocorrencias/${departamento}/correcoes/${id}`)
    }

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


async function enviarVinculo({ master, slave, desvincular = null }) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/vincular-contrato`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ master, slave, desvincular })
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()
}