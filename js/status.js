let unidadeOrc = null
const altNumOrc = ['adm', 'analista']
// Desde 13/11/2026 só Venda e Serviço (cada pedido vira um item e uma nota: NF-e ou NFS-e). Locação entra
// como Serviço; Venda + Serviço vira dois pedidos; POC saiu (nunca gerou nota). Pedido antigo com outro
// tipo continua mostrando o dele ao editar.
const opcoesPedidos = ['', 'Venda', 'Serviço']
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
    'FATURADO',
    'FERRAMENTAS'
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

    const registro = await recuperarDado('pedidos', id) || {}
    const { pedido, tipo, valor, comentario, pagamento, departamento, condicao_pagamento } = registro
    let { empresa, limite_faturamento_dia } = registro
    const depAtivo = controles?.ocorrencias?.ativo

    if (!departamento && !depAtivo)
        return mensagem({ mensagem: 'Departamento não localizado' })

    // Ponte (gcs /condicao-pagamento-empresa), só no que o pedido ainda não tem: condição de pagamento
    // (pedido antigo: o texto "3x" / "30 dias") e empresa a faturar vêm dos Dados do Cliente do
    // orçamento e, sem eles, do cadastro da empresa do cliente; o limite de faturamento, da empresa.
    let condicao = normalizarCondicaoPag(condicao_pagamento) || normalizarCondicaoPag(pagamento)
    const doOrcamento = [], daEmpresaCampos = []
    let nomeEmpresaCliente = ''
    if (!condicao || !empresa || limite_faturamento_dia == null) {
        const ponte = await condicaoPagamentoEmpresa(departamento || depAtivo) || {}
        nomeEmpresaCliente = ponte.nome || ''
        if (!condicao && ponte.orcamento?.condicao) {
            condicao = ponte.orcamento.condicao
            doOrcamento.push('condição de pagamento')
        } else if (!condicao && ponte.condicao) {
            condicao = ponte.condicao
            daEmpresaCampos.push('condição de pagamento')
        }
        if (!empresa && ponte.orcamento?.empresa_faturamento) {
            empresa = ponte.orcamento.empresa_faturamento
            doOrcamento.push('empresa a faturar')
        } else if (!empresa && ponte.empresa_faturamento) {
            empresa = ponte.empresa_faturamento
            daEmpresaCampos.push('empresa a faturar')
        }
        if (limite_faturamento_dia == null && ponte.limite_faturamento_dia) {
            limite_faturamento_dia = ponte.limite_faturamento_dia
            daEmpresaCampos.push('limite de faturamento')
        }
    }
    const origemCondicao = [
        doOrcamento.length ? `Do orçamento: ${doOrcamento.join(', ')}.` : '',
        daEmpresaCampos.length ? `Do cadastro da empresa ${nomeEmpresaCliente}: ${daEmpresaCampos.join(', ')}.` : ''
    ].filter(Boolean).join(' ')
    condicao = { ...(condicao || { modo: 'MESES', parcelas: 1, base: 'EMISSAO' }) }
    if (!condicao.forma) condicao.forma = '15'

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
                    ${[...opcoesPedidos, ...(tipo && !opcoesPedidos.some(op => op.toUpperCase() === String(tipo).toUpperCase()) ? [tipo] : [])]
                        .map(op => `<option ${String(tipo || '').toUpperCase() === op.toUpperCase() ? 'selected' : ''}>${op}</option>`).join('')}
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
                    <option value="" ${empresas.includes(empresa) ? '' : 'selected'}>Selecione</option>
                    ${EMPRESAS_FATURAMENTO.filter(([v]) => empresas.includes(v))
                        .map(([v, t]) => `<option value="${v}" ${empresa == v ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            `
        },
        {
            texto: 'Limite de faturamento (dia)',
            elemento: `
            <div style="${vertical}; gap: 2px; width: 100%;">
                <input type="number" id="limite_faturamento_dia" min="1" max="31" step="1" inputmode="numeric" placeholder="Sem limite"
                    value="${escaparAtributo(limite_faturamento_dia ?? '')}" oninput="this.nextElementSibling.textContent = textoLimiteFaturamento(this.value)">
                <small style="color: #6b7a71;">${escaparAtributo(textoLimiteFaturamento(limite_faturamento_dia))}</small>
            </div>
            `
        },
        {
            // Condição completa: vai para a NF-e (duplicatas com os vencimentos) e para as faturas a receber.
            texto: 'Condição de pagamento',
            elemento: `
            <div style="${vertical}; gap: 3px; width: 100%;" id="condicao_pedido">
                ${htmlCondicaoPag(condicao)}
            </div>
            ${origemCondicao ? `<small style="color: #6b7a71;">${escaparAtributo(origemCondicao)}</small>` : ''}
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
    iniciarCondicoesPag(document.getElementById('condicao_pedido'))

}

// Condição padrão da empresa do cliente faturado do departamento (gcs: /condicao-pagamento-empresa).
async function condicaoPagamentoEmpresa(departamento) {
    if (!departamento) return null
    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const r = await fetch(`${api}/condicao-pagamento-empresa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ departamento })
        })
        return r.ok ? await r.json() : null
    } catch {
        return null
    }
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
        const autorizado_por = document.querySelector('[name="autorizado_por"]').id

        if (!valor.value || !tipo.value || !pedido.value)
            return popup({ mensagem: 'Existem campos em Branco' })

        if (pedido.value == 'Sem Pedido' && autorizado_por == '')
            return popup({ mensagem: 'Quem autorizou este pedido?' })

        // Sem empresa pré-escolhida: antes vinha AC e o pedido saía como AC sem ninguém decidir.
        if (!empresa.value)
            return popup({ mensagem: 'Escolha a empresa a faturar.' })

        const { condicao, erros } = lerCondicaoPag(document.querySelector('#condicao_pedido [data-condicao-pag]'))
        if (erros.length)
            return popup({ mensagem: `Condição de pagamento: ${erros[0]}` })

        const limiteTexto = document.getElementById('limite_faturamento_dia').value
        const limite_faturamento_dia = limiteTexto === '' ? null : Number(limiteTexto)
        if (limite_faturamento_dia !== null && !(Number.isInteger(limite_faturamento_dia) && limite_faturamento_dia >= 1 && limite_faturamento_dia <= 31))
            return popup({ mensagem: 'Limite de faturamento: informe um dia de 1 a 31, ou deixe vazio.' })

        const dados = {
            departamento,
            data: dataServidor().toLocaleString(),
            executor: acesso.usuario,
            comentario: comentario_status.value,
            // "pagamento" segue com o nº de vezes (telas e relatórios antigos); a condição completa vai junto.
            pagamento: String(vezesCondicaoPag(condicao)),
            condicao_pagamento: condicao,
            limite_faturamento_dia,
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

        // Um atalho por orçamento: reabrir (ou recarregar depois de salvar) atualiza a janela DESTE
        // orçamento; outro orçamento abre a sua própria janela (antes sobrescrevia a que estivesse aberta).
        const menuOpcoesOrcamento = document.querySelector(`.menu-opcoes-orcamento[data-orcamento="${CSS.escape(id)}"]`)

        if (menuOpcoesOrcamento) {
            menuOpcoesOrcamento.innerHTML = acumulado
            removerOverlay()
            trazerJanelaParaFrente(menuOpcoesOrcamento)
        } else {
            const identificacao = contrato && contrato !== 'sequencial' ? ` · ${contrato}` : ''
            popup({ elemento: `<div class="menu-opcoes-orcamento" data-orcamento="${escaparAtributo(id)}">${acumulado}</div>`, titulo: `Opções do Orçamento${identificacao}` })
            // Vencido e ainda sem centro de custo: pergunta (por cima das opções) se quer estender.
            perguntarProrrogacaoOrcamento(id, orcamento)
        }

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao abrir os atalhos: Fale com o suporte.' })
    }

}

async function confirmarProspeccao(id) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `iniciarChamadoProspeccao('${id}')` }
    ]

    popup({ botoes, imagem: 'imagens/prospeccao.png', mensagem: 'Criar uma prospecção?', removerAnteriores: true, modal: true })

}

async function iniciarChamadoProspeccao(id) {

    overlayAguarde()

    const { dados_orcam } = await recuperarDado('dados_orcamentos', id) || {}
    const { omie_cliente, contrato } = dados_orcam || {}

    const existente = await consultarChamadoOrcamento(contrato)
    if (existente?.excluido != null) {
        popup({ mensagem: `O chamado ${escaparAtributo(contrato)} deste orçamento foi excluído. Restaure o chamado antes de continuar.` })
        return
    }

    const novo = {
        id: contrato,
        unidade: omie_cliente,
        sistema: '17', // SERVIÇO DE INFRA
        prioridade: 'v2ttQ', // Serviço de INFRA
        tipo: 'wgVdc', // Prospecção
        descricao: `Chamado de Prospecção do ${contrato}`,
        data_registro: dataServidor().toLocaleString('pt-BR'),
        usuario: acesso.usuario,
    }

    await enviar(`dados_ocorrencias/${contrato}`, novo)

    controles.ocorrencias ??= {}
    controles.ocorrencias.filtros ??= {}
    controles.ocorrencias.filtros = {
        'chamados': { op: 'includes', value: contrato }
    }

    await telaOcorrencias()

}

async function vincularOrcamento(contratoSlave) {

    // Um "Vincular orçamentos" por vez: confirmarVinculo lê [name="orcamento"] da página e a lista
    // de escolha (controlesCxOpcoes.orcamento) é uma só.
    const vinculoAberto = document.querySelector('[name="orcamento"][data-slave]')
    if (vinculoAberto) {
        trazerJanelaParaFrente(vinculoAberto)
        if (vinculoAberto.dataset.slave !== contratoSlave)
            popup({ mensagem: `Já existe um <b>Vincular orçamentos</b> aberto para o ${escaparAtributo(vinculoAberto.dataset.slave)}.<br>Conclua ou feche esse antes de abrir outro.` })
        return
    }

    overlayAguarde()

    // mvw_dados_orcamentos (a mesma da tela de orçamentos) já traz cliente, cidade e responsáveis;
    // dados_orcamentos não tem esses campos em snapshots, e as linhas vinham em branco.
    controlesCxOpcoes.orcamento = {
        base: 'mvw_dados_orcamentos',
        retornar: ['dados_orcam.contrato'],
        colunas: {
            'Orçamento': { chave: 'dados_orcam.contrato' },
            'Cliente': { chave: 'cliente' },
            'Cidade': { chave: 'cidade' },
            'Responsáveis': { chave: 'responsaveis' }
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

    popup({ linhas, botoes, titulo: `Vincular orçamentos · ${contratoSlave}` })

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

async function consultarChamadoOrcamento(contrato) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${read}/estado-chamado`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ contrato: String(contrato || '') }),
        signal: AbortSignal.timeout(15000)
    })
    if (!resposta.ok)
        throw new Error('Não foi possível verificar o estado do chamado. Confirme se o serviço de leitura foi atualizado.')
    const resultado = await resposta.json()
    if (resultado.estado === 'inexistente') return null
    if (resultado.estado === 'excluido') return { id: resultado.id, excluido: resultado.excluido }
    if (resultado.estado !== 'ativo') throw new Error('Estado do chamado inválido.')
    const chamado = await recuperarDado('dados_ocorrencias', contrato)
    if (!chamado?.id) throw new Error('Não foi possível carregar o chamado existente. Tente novamente.')
    return chamado
}

async function checklistChamado(id, chamadoConsultado = undefined) {

    const contrato = controles.ocorrencias.ativo

    // Para abrir transformar um orcamento em chamado, ele precisa ter um pedido (Enviado e Aprovado);
    const existente = chamadoConsultado === undefined
        ? await consultarChamadoOrcamento(contrato)
        : chamadoConsultado

    const pChamado = existente?.excluido != null
        ? `<div role="status"><strong>Chamado excluído</strong><p>O chamado ${escaparAtributo(contrato)} deste orçamento foi excluído. É necessário restaurá-lo antes de voltar a utilizá-lo.</p></div>`
        : existente
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

    const existente = await consultarChamadoOrcamento(contrato)
    if (existente?.excluido != null) {
        popup({ mensagem: `O chamado ${escaparAtributo(contrato)} deste orçamento foi excluído. Restaure o chamado antes de continuar.` })
        return
    }

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

        if (!contrato) {
            await enviar(`dados_orcamentos/${id}/excluido`, null)
            popup({ mensagem: 'O orçamento estava inacessível, tente de novo em instantes!' })
            return
        }

        controles.ocorrencias ??= {}
        controles.ocorrencias.ativo = contrato

        const chamado = await consultarChamadoOrcamento(contrato)
        const statusOcorrencia = chamado?.excluido != null
            ? ['CHAMADO EXCLUÍDO']
            : !chamado ? ['CHAMADO NÃO ABERTO']
                : Array.isArray(nomes_status) && nomes_status.length
                    ? [...new Set(nomes_status.filter(Boolean))] : ['SEM STATUS']
        const labelTipoCorrecao = statusOcorrencia
            .map(st => formatacaoTipoCorrecao(st))
            .join('')

        // Visão escolhida pelo usuário (salva no perfil): 'secoes' (a de sempre) ou 'esquema'.
        const visao = await preferenciaUsuario(PREF_VISAO_HISTORICO, 'secoes') === 'esquema' ? 'esquema' : 'secoes'

        const elemento = `
            <div class="painel-historico" data-historico-orc="${escaparAtributo(id)}" data-contrato="${escaparAtributo(contrato)}" data-visao="${visao}">

                <div class="historico-cabecalho">
                    <div class="historico-identificacao">
                        <span class="historico-contrato">${escaparAtributo(contrato || '')}</span>
                        <span class="historico-cliente">${escaparAtributo(cliente || 'Cliente não informado')}</span>
                    </div>
                    <div class="historico-cabecalho-acoes">
                        <div class="historico-visao" role="radiogroup" aria-label="Visualização">
                            <button type="button" role="radio" data-visao-opcao="secoes" aria-checked="${visao === 'secoes'}"
                                onclick="trocarVisaoHistorico(this, 'secoes')" title="Pedidos, requisições, notas e demais seções lado a lado">
                                <span aria-hidden="true">▦</span> Seções
                            </button>
                            <button type="button" role="radio" data-visao-opcao="esquema" aria-checked="${visao === 'esquema'}"
                                onclick="trocarVisaoHistorico(this, 'esquema')" title="Cada pedido com as requisições e notas que nasceram dele">
                                <span aria-hidden="true">⤷</span> Esquema
                            </button>
                        </div>
                        <button class="historico-ver-status" onclick="verHistoricoStatus('${id}')">
                            <img src="imagens/historico.png" alt="">
                            Histórico de status
                        </button>
                    </div>
                </div>

                <div class="historico-resumo">
                    <div class="historico-resumo-item">
                        <label class="historico-rotulo">Chamado</label>
                        <div class="status-check-ocorrencias"></div>
                    </div>
                    <div class="historico-resumo-item">
                        <label class="historico-rotulo">Status da Ocorrência</label>
                        <div class="historico-status-lista">${labelTipoCorrecao}</div>
                    </div>
                    <div class="historico-resumo-item">
                        <label class="historico-rotulo">Status do Orçamento</label>
                        <span class="and">${escaparAtributo(status_atual || 'Sem status')}</span>
                    </div>
                </div>

                <div class="bloco-st"${visao === 'secoes' ? '' : ' hidden'}></div>
                <div class="bloco-esquema-historico"${visao === 'esquema' ? '' : ' hidden'}></div>

            </div>
        `

        popup({ elemento, titulo: 'Histórico do Orçamento' })

        // Checklist Chamado;
        await checklistChamado(id, chamado)

        const painel = [...document.querySelectorAll(`[data-historico-orc="${CSS.escape(id)}"]`)].pop()
        await carregarVisaoHistorico(painel, visao)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir o esquema: Fale com o suporte.' })
    }


}

// ---------------------------------------------------------------- Histórico: visões

const PREF_VISAO_HISTORICO = 'historico_orcamento_visao'

// Troca de visão no cabeçalho: mostra a escolhida (carrega na primeira vez) e lembra no perfil.
async function trocarVisaoHistorico(botao, visao) {
    const painel = botao.closest('.painel-historico')
    if (!painel || painel.dataset.visao === visao) return
    painel.dataset.visao = visao
    painel.querySelectorAll('[data-visao-opcao]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.visaoOpcao === visao)))
    painel.querySelector('.bloco-st').hidden = visao !== 'secoes'
    painel.querySelector('.bloco-esquema-historico').hidden = visao !== 'esquema'
    salvarPreferenciaUsuario(PREF_VISAO_HISTORICO, visao)
    await carregarVisaoHistorico(painel, visao)
}

async function carregarVisaoHistorico(painel, visao) {
    if (!painel || painel.dataset[`carregado_${visao}`]) return
    painel.dataset[`carregado_${visao}`] = '1'
    if (visao === 'esquema') return carregarEsquemaHistorico(painel)
    await carregarSecoesHistorico(painel)
}

// Visão "Seções" (a original): uma tabela por assunto filtrada pelo ORC.
async function carregarSecoesHistorico(painel) {
    const contrato = painel.dataset.contrato
    const local = painel.querySelector('.bloco-st')

    try {
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
                        nude: true,
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
                        <section class="historico-secao" style="--cor-secao: ${cor};">
                            <button
                                class="historico-secao-acao"
                                style="background-color: ${cor};" 
                                onclick="${funcao}">
                                ${titulo}
                            </button>
                            ${tabela}
                        </section>
                    `)

                    await paginacao(chave)
                })
        )

    } catch (err) {
        console.error(err)
        delete painel.dataset.carregado_secoes
        popup({ mensagem: 'Falha ao abrir o esquema: Fale com o suporte.' })
    }
}

// Visão "Esquema": cada pedido do ORC com as requisições e notas que nasceram dele (fluxo_itens no
// servidor, rota /fluxo-itens/esquema). O que não tem pedido de origem fica de fora.
const ETAPAS_ESQUEMA_HIST = [
    ['PEDIDO', 'Pedido'], ['REQUISICAO', 'Requisição'], ['SEPARADO', 'Separado'],
    ['FATURADO', 'Faturado'], ['ENTREGUE', 'Entregue'], ['CONCLUIDO', 'Concluído']
]

async function carregarEsquemaHistorico(painel) {
    const local = painel.querySelector('.bloco-esquema-historico')
    local.innerHTML = '<div class="esq-hist-carregando">Montando o esquema…</div>'
    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const resposta = await fetch(`${api}/fluxo-itens/esquema`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ contrato: painel.dataset.contrato })
        })
        const dados = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(dados.mensagem || `Falha (${resposta.status})`)
        local.innerHTML = htmlEsquemaHistorico(dados.itens || [])
    } catch (err) {
        delete painel.dataset.carregado_esquema
        local.innerHTML = `<div class="esq-hist-vazio">Não foi possível montar o esquema: ${escaparAtributo(err.message)}
            <button type="button" onclick="recarregarEsquemaHistorico(this)">Tentar de novo</button></div>`
    }
}

function recarregarEsquemaHistorico(botao) {
    const painel = botao.closest('.painel-historico')
    if (!painel) return
    painel.dataset.carregado_esquema = '1'
    carregarEsquemaHistorico(painel)
}

function htmlEsquemaHistorico(itens) {
    const esc = escaparAtributo
    const barra = `
        <div class="esq-hist-topo">
            <div class="esq-hist-resumo">
                <span><b>${itens.length}</b> ${itens.length === 1 ? 'pedido' : 'pedidos'}</span>
                <span>Pedidos <b>${dinheiro(itens.reduce((s, i) => s + (i.pedido.valor || 0), 0))}</b></span>
                <span>Notas <b>${dinheiro(itens.reduce((s, i) => s + i.notas.filter(n => !n.cancelada).reduce((t, n) => t + (n.total || 0), 0), 0))}</b></span>
            </div>
            <button type="button" class="esq-hist-atualizar" onclick="recarregarEsquemaHistorico(this)" title="Buscar de novo">↻ Atualizar</button>
        </div>`

    if (!itens.length)
        return `${barra}<div class="esq-hist-vazio">Nenhum pedido neste orçamento.<br><small>Requisições e notas sem pedido de origem não aparecem nesta visão; veja em Seções.</small></div>`

    const vazio = texto => `<div class="esq-no esq-no-vazio">${texto}</div>`
    // Etiqueta do tipo (pedido e nota): cor pela família, para comparar de relance o que foi pedido com o que foi faturado.
    const tipoEsq = (tipo, titulo = '') => {
        if (!tipo) return ''
        const t = String(tipo).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
        const cls = t.includes('VENDA') && t.includes('SERVICO') ? 'misto'
            : t.includes('DEVOLUCAO') ? 'devolucao'
            : t.includes('SERVICO') ? 'servico'
            : t.includes('VENDA') ? 'venda'
            : t.includes('REMESSA') || t.includes('RETORNO') ? 'remessa'
            : t.includes('LOCACAO') ? 'locacao' : 'outro'
        return `<span class="esq-tipo ${cls}"${titulo ? ` title="${esc(titulo)}"` : ''}>${esc(tipo)}</span>`
    }
    const etapas = etapa => {
        const atual = ETAPAS_ESQUEMA_HIST.findIndex(([k]) => k === etapa)
        return `<ol class="esq-hist-etapas" aria-label="Etapa: ${esc(ETAPAS_ESQUEMA_HIST[atual]?.[1] || etapa)}">${ETAPAS_ESQUEMA_HIST
            .map(([, nome], i) => `<li class="${i < atual ? 'feita' : i === atual ? 'atual' : ''}">${nome}</li>`).join('')}</ol>`
    }

    // Tipo da nota vem da própria nota: Omie = categoria (venda, serviço, remessa); NF-e do GCS = tipo da
    // operação (quando o servidor manda) e NFS-e = Serviço.
    const tipoNotaEsq = n => {
        const t = String(n.tipo || n.categoria || '').trim()
        if (t) return t[0].toUpperCase() + t.slice(1).toLowerCase()
        return n.modelo === 'NFSE' ? 'Serviço' : ''
    }

    const noNota = n => {
        const gcs = n.origem === 'GCS'
        const situacao = gcs
            ? ({ AUTORIZADA: 'Autorizada', RASCUNHO: 'Rascunho', PROCESSANDO: 'Processando', REJEITADA: 'Rejeitada', CANCELADA: 'Cancelada', DENEGADA: 'Denegada' }[n.status] || n.status)
            : n.cancelada ? 'Cancelada' : ''
        const tom = n.cancelada ? 'cancelada' : gcs && n.status !== 'AUTORIZADA' ? 'pendente' : 'ok'
        const titulo = gcs
            ? `${n.modelo === 'NFSE' ? 'NFS-e' : 'NF-e'} ${n.numero ? esc(n.numero) : '(sem número)'}`
            : `NF ${esc(n.numero || '—')}`
        const data = gcs && n.data ? new Date(n.data).toLocaleDateString('pt-BR') : esc(n.data || '')
        const acao = gcs ? `abrirDocumentoFiscal('${esc(n.id)}')` : `abrirDANFE('${esc(n.id)}')`
        return `
            <button type="button" class="esq-no esq-no-nota ${tom}" onclick="${acao}" title="${gcs ? 'Abrir a nota' : 'Abrir o DANFE'}">
                <span class="esq-no-cabeca">
                    ${tipoEsq(tipoNotaEsq(n) || 'Tipo não informado', n.detalhe)}
                    <span class="esq-no-tipo">${gcs ? 'GCS' : 'Omie'}${n.app ? ` · ${esc(n.app)}` : ''}</span>
                </span>
                <b>${titulo}</b>
                ${n.detalhe && n.detalhe !== n.tipo ? `<span class="esq-no-quem">${esc(n.detalhe)}</span>` : ''}
                <span class="esq-no-linha"><span>${data}</span><b>${dinheiro(n.total || 0)}</b></span>
                ${situacao ? `<span class="esq-no-situacao">${esc(situacao)}</span>` : ''}
            </button>`
    }

    const noRequisicao = r => `
        <button type="button" class="esq-no esq-no-req" onclick="gerarPdfRequisicao('${esc(r.id)}', true)" title="Visualizar a requisição">
            <span class="esq-no-cabeca">
                <span class="esq-no-tipo">Requisição</span>
                ${r.avulso ? '<span class="esq-tipo avulsa">Avulsa</span>' : ''}
            </span>
            <b>${r.itens} ${r.itens === 1 ? 'item' : 'itens'}</b>
            <span class="esq-no-linha"><span>${esc(String(r.data).slice(0, 10))}</span><b>${dinheiro(r.total || 0)}</b></span>
            ${r.executor ? `<span class="esq-no-quem">${esc(r.executor)}</span>` : ''}
        </button>`

    const cadeias = itens.map(i => {
        const p = i.pedido
        const verde = i.emissao_status === 'OK' || i.notas.some(n => !n.cancelada && (n.origem === 'OMIE' || n.status === 'AUTORIZADA'))
        return `
            <article class="esq-cadeia${verde ? ' faturada' : ''}${i.emissao_status === 'ERRO' ? ' erro' : ''}">
                <header class="esq-cadeia-topo">
                    <span class="esq-cadeia-titulo">Pedido ${esc(p.numero || 'sem número')}${p.tipo ? ` ${tipoEsq(p.tipo)}` : ''}${i.empresa ? ` <small class="esq-empresa">${esc(i.empresa)}</small>` : ''}</span>
                    ${etapas(i.etapa)}
                </header>
                <div class="esq-cadeia-corpo">
                    <div class="esq-coluna esq-col-pedido">
                        <button type="button" class="esq-no esq-no-pedido" onclick="painelAdicionarPedido('${esc(p.id)}')" title="Abrir o pedido">
                            <span class="esq-no-cabeca">
                                <span class="esq-no-tipo">Pedido</span>
                                ${tipoEsq(p.tipo || 'Tipo não informado')}
                            </span>
                            <b>${esc(p.numero || 'Sem número')}</b>
                            <span class="esq-no-linha"><span>${esc(String(p.data).slice(0, 10))}</span><b>${dinheiro(p.valor || 0)}</b></span>
                            ${p.executor ? `<span class="esq-no-quem">${esc(p.executor)}</span>` : ''}
                        </button>
                    </div>
                    <div class="esq-seta" aria-hidden="true"></div>
                    <div class="esq-coluna esq-col-ramo${i.requisicoes.length > 1 ? ' varios' : ''}">
                        ${i.requisicoes.length ? i.requisicoes.map(noRequisicao).join('') : vazio('Sem requisição')}
                    </div>
                    <div class="esq-seta" aria-hidden="true"></div>
                    <div class="esq-coluna esq-col-ramo${i.notas.length > 1 ? ' varios' : ''}">
                        ${i.notas.length ? i.notas.map(noNota).join('') : vazio('Sem nota')}
                    </div>
                </div>
            </article>`
    }).join('')

    return `${barra}
        <div class="esq-hist-legenda"><span>Pedido</span><span>Requisições</span><span>Notas</span></div>
        <div class="esq-hist-lista">${cadeias}</div>`
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
            funcao: `confirmarApagarGenerico('${id}','${tabela}')`
        }
    ]

    popup({ botoes, mensagem: 'Excluir item?', titulo: 'Excluir Status' })
}


async function confirmarApagarGenerico(id, tabela) {

    try {
        removerPopup()
        // Sem overlay: o deletar() já bloqueia a linha com o loading.

        if (tabela == 'parceiros') {
            const pagamento = await recuperarDado('lista_pagamentos', id)
            const parceiro = await recuperarDado('parceiros', id)

            if (pagamento || Object.keys(parceiro?.solicitacoes || {}).length)
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

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao tentar excluir o status: Fale com o suporte.' })
    }

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

    // Recusas de validação chegam com status 4xx e a mensagem para o usuário.
    const dados = await resposta.json().catch(() => ({}))

    if (!resposta.ok)
        return { success: false, mensagem: dados.mensagem || 'Falha ao vincular: Fale com o suporte.' }

    return dados
}
